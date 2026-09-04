import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M3 — statistical timing-equalization verification for the
 * login route (AC-AUTH-005, REQ-AUTH-005). Integration-level: exercises the
 * actual POST handler end-to-end (real bcrypt/dummyCompare cost via
 * @/lib/auth/password), with only @/lib/db mocked (no live PostgreSQL) — per
 * structure.md's integration-test convention (closer to the real request/
 * response flow than a fully-mocked unit test, still no live DB).
 *
 * This test is inherently probabilistic (wall-clock measurement on a shared
 * machine) and may be flaky under CI-like jitter — see the M3 self-
 * verification report's Residual-risk section for observed local-run
 * variance. The tolerance formula is acceptance.md's exact AC-AUTH-005
 * formula and is NOT loosened here.
 *
 * @MX:NOTE t20 fix — 60 sequential real bcrypt(cost 12) round-trips take
 * ~22-24s even in full isolation (measured), leaving only ~20% headroom
 * against the prior 30s test timeout. Any CPU contention from concurrently
 * scheduled test-runner worker processes (a full-suite or --coverage run)
 * slows and destabilizes each bcrypt call, which can push the run past that
 * timeout — a false-negative FAIL unrelated to the timing-safety property
 * itself (confirmed: an isolated run passes with diff=2.71ms against a
 * 55.42ms tolerance, i.e. the design is correct — the margin was the bug).
 * The per-test timeout below is widened to absorb that contention without
 * masking a genuine timing-safety regression, which would still fail the
 * tolerance assertion regardless of how much wall-clock time it is given.
 * SAMPLE_SIZE stays at 30 (acceptance.md AC-AUTH-005 requires N≥30) and the
 * tolerance formula is unchanged — see backlog card t20.
 */

interface FakeUserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  role: "customer" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

let users: FakeUserRow[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        return users.find((u) => u.email === where.email) ?? null;
      }),
    },
    refreshToken: {
      create: vi.fn(async () => ({ id: "rt-unused" })),
    },
  },
}));

const SAMPLE_SIZE = 30;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  const { hashPassword } = await import("@/lib/auth/password");
  users = [
    {
      id: "user-1",
      email: "real-user@example.com",
      passwordHash: await hashPassword("the-real-password-123"),
      emailVerified: false,
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
});

describe("AC-AUTH-005 — response-time similarity between nonexistent-email and wrong-password login failures", () => {
  it(
    `median response time differs by less than max(20ms, 15% of the slower median) across N=${SAMPLE_SIZE} samples per case`,
    async () => {
      const { POST } = await import("@/app/api/auth/login/route");
      // [AUTO] 2026-08-27 F2/H1 fix — checkIpRateLimit no longer skips its
      // check for an undeterminable IP; without a reset per sample, this
      // test's 60 rapid same-endpoint calls (all lacking x-forwarded-for,
      // per this test's own design — it measures per-attempt comparison
      // timing, not client identity) would themselves trip the 5-per-window
      // limit at the 6th call. Reset before EACH sample so every call is
      // measured as an isolated single login attempt — the scenario this
      // AC-AUTH-005 test is actually modeling — rather than one client
      // making 60 requests in a row.
      const { __resetRateLimitStoreForTests } = await import("@/lib/auth/rate-limit");

      // @MX:NOTE t20 fix — interleaved (not two sequential blocks). A
      // full-suite/coverage run's background CPU load is NOT constant across
      // this test's ~24s+ duration; running all 30 nonexistent-email samples
      // THEN all 30 wrong-password samples confounds any load drift between
      // the two blocks with the thing being measured, producing a spurious
      // median gap that has nothing to do with the login handler's actual
      // timing-safety (reproduced: an isolated run passed with diff=2.71ms,
      // a contended full-suite run failed with diff=847.63ms against a
      // 184.21ms tolerance — a swing far larger than bcrypt's own per-call
      // jitter, consistent with a load-drift confound, not a handler
      // regression). Interleaving both conditions within the same loop
      // exposes both to the same time-varying load, which is the standard
      // mitigation for this class of confound in timing-side-channel
      // measurement. N stays 30 per condition (acceptance.md AC-AUTH-005
      // requires N≥30); the tolerance formula is unchanged.
      const nonexistentDurations: number[] = [];
      const wrongPasswordDurations: number[] = [];
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        __resetRateLimitStoreForTests();
        const startNonexistent = performance.now();
        const nonexistentResponse = await POST(
          makeRequest({ email: "ghost@example.com", password: "irrelevant-password" })
        );
        nonexistentDurations.push(performance.now() - startNonexistent);
        expect(nonexistentResponse.status).toBe(401);

        __resetRateLimitStoreForTests();
        const startWrongPassword = performance.now();
        const wrongPasswordResponse = await POST(
          makeRequest({ email: "real-user@example.com", password: "wrong-password-guess" })
        );
        wrongPasswordDurations.push(performance.now() - startWrongPassword);
        expect(wrongPasswordResponse.status).toBe(401);
      }

      const medianNonexistent = median(nonexistentDurations);
      const medianWrongPassword = median(wrongPasswordDurations);
      const diff = Math.abs(medianNonexistent - medianWrongPassword);
      const tolerance = Math.max(20, 0.15 * Math.max(medianNonexistent, medianWrongPassword));

      console.log(
        `[AC-AUTH-005] median(nonexistent-email)=${medianNonexistent.toFixed(2)}ms ` +
          `median(wrong-password)=${medianWrongPassword.toFixed(2)}ms diff=${diff.toFixed(2)}ms ` +
          `tolerance=${tolerance.toFixed(2)}ms`
      );

      expect(diff).toBeLessThan(tolerance);
    },
    90000
  );
});
