import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

/**
 * SPEC-DISCOUNT-001 M6a — POST /api/discounts/validate against a REAL
 * PostgreSQL, proving REQ-DISCOUNT-025's write-free guarantee.
 *
 * Traces: AC-DISCOUNT-025 — 10 successful validate calls against a coupon
 * with `maxRedemptions: 5, redeemedCount: 0` must leave `redeemedCount`
 * at 0, `updatedAt` unchanged, and create zero `Order` rows.
 *
 * CAPABILITY GATE: an earlier version of this file (and its M1 sibling)
 * assumed the pre-flight `npx prisma migrate status` reachability check made
 * a runtime gate unnecessary. That assumption was wrong — the pre-flight
 * only runs on a developer's machine; CI's `DATABASE_URL`
 * (.github/workflows/ci.yml) is a permanently-unreachable placeholder, so an
 * ungated version of this file hard-fails CI's required `verify` check. This
 * file now mirrors `tests/integration/orders/concurrency.postgres.test.ts`'s
 * pattern: probe reachability once at module load, skip with a named reason
 * when absent, and never let an unreachable database read as a silent pass.
 *
 * Exercises the actual route handler (not the service directly) so the
 * observation covers the full HTTP-layer call path this endpoint exposes.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // No .env here; fall through to whatever the environment already provides.
}

const { prisma } = await import("@/lib/db");
const { DiscountType } = await import("@prisma/client");
const { POST } = await import("@/app/api/discounts/validate/route");

const RUN = `m6a-${randomUUID().slice(0, 8)}`;

/**
 * Whether a live PostgreSQL answered, and — when it did not — why.
 *
 * Probed once at module load with the application's OWN client, mirroring
 * `tests/integration/orders/concurrency.postgres.test.ts`.
 */
let reachable = false;
let skipReason = "";

if (!process.env.DATABASE_URL) {
  skipReason = "DATABASE_URL is not set";
} else {
  try {
    await prisma.$queryRaw`select 1`;
    reachable = true;
  } catch (error) {
    skipReason = `connection failed: ${(error as Error).message.split("\n")[0]}`;
  }
}

afterAll(async () => {
  if (reachable) {
    await prisma.coupon.deleteMany({ where: { code: { startsWith: RUN.toUpperCase() } } });
  }
  await prisma.$disconnect();
});

describe("SPEC-DISCOUNT-001 M6a — the capability gate", () => {
  it("never skips silently — an unreachable database names its reason", () => {
    if (reachable) {
      expect(skipReason).toBe("");
    } else {
      expect(skipReason.length).toBeGreaterThan(0);
    }
  });
});

function submit(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/discounts/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe.skipIf(!reachable)("SPEC-DISCOUNT-001 M6a — AC-DISCOUNT-025 (write-free)", () => {
  it("leaves redeemedCount, updatedAt and Order count untouched across 10 successful calls", async () => {
    const code = `${RUN}-AC025`.toUpperCase();

    const before = await prisma.coupon.create({
      data: {
        code,
        type: DiscountType.FIXED_AMOUNT,
        value: 5000,
        minOrderAmount: 0,
        maxRedemptions: 5,
        startsAt: new Date("2026-01-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T23:59:59Z"),
      },
    });
    expect(before.redeemedCount).toBe(0);

    const orderCountBefore = await prisma.order.count();

    // Post-sync-audit addition: this route now calls checkIpRateLimit
    // (5 requests/60s per IP, see route.ts's module doc). This test's 10
    // rapid same-endpoint calls carry no x-forwarded-for header, so without
    // a reset they would themselves trip the limit at the 6th call — the
    // same shape of self-interference login.test.ts's AC-AUTH-005 test
    // already documents and resets around. Reset before EACH call so every
    // one is measured as an isolated request, matching what the test is
    // actually modeling (10 separate shoppers' precheck calls, not one
    // client bursting the endpoint).
    const { __resetRateLimitStoreForTests } = await import("@/lib/auth/rate-limit");

    for (let i = 0; i < 10; i += 1) {
      __resetRateLimitStoreForTests();
      const response = await submit({ code, itemsSubtotal: 30000 });
      // Every call must actually succeed — a validate call that failed would
      // trivially leave redeemedCount untouched for the wrong reason.
      expect(response.status).toBe(200);
      const body: { discountAmount: number } = await response.json();
      expect(body.discountAmount).toBe(5000);
    }

    const after = await prisma.coupon.findUnique({ where: { id: before.id } });
    expect(after).not.toBeNull();
    // Not even one increment — this is the observation REQ-DISCOUNT-025 exists
    // to make (§H of acceptance.md): SKIPPED never counts as PASS, and an
    // increment of even 1 here would falsify the write-free claim.
    expect(after?.redeemedCount).toBe(0);
    expect(after?.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());

    const orderCountAfter = await prisma.order.count();
    expect(orderCountAfter).toBe(orderCountBefore);
  });
});
