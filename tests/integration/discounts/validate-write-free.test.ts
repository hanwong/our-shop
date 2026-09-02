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
 * Talks to the same PostgreSQL M1's coupon-model.test.ts and the pre-flight
 * `npx prisma migrate status` already confirmed reachable (`DATABASE_URL`,
 * localhost:5433) — no capability gate is needed here, mirroring M1's
 * integration test (this is a plain reachability precondition, not the
 * concurrency-only capability gate AC-DISCOUNT-016 needs).
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

afterAll(async () => {
  await prisma.coupon.deleteMany({ where: { code: { startsWith: RUN.toUpperCase() } } });
  await prisma.$disconnect();
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

describe("SPEC-DISCOUNT-001 M6a — AC-DISCOUNT-025 (write-free)", () => {
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

    for (let i = 0; i < 10; i += 1) {
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
