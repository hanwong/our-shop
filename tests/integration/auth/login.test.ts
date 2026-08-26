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

      const nonexistentDurations: number[] = [];
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const start = performance.now();
        const response = await POST(makeRequest({ email: "ghost@example.com", password: "irrelevant-password" }));
        nonexistentDurations.push(performance.now() - start);
        expect(response.status).toBe(401);
      }

      const wrongPasswordDurations: number[] = [];
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const start = performance.now();
        const response = await POST(
          makeRequest({ email: "real-user@example.com", password: "wrong-password-guess" })
        );
        wrongPasswordDurations.push(performance.now() - start);
        expect(response.status).toBe(401);
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
    30000
  );
});
