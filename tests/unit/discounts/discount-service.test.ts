import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-DISCOUNT-001 M3 — src/features/discounts/services/discount-service.ts
 *
 * Traces: REQ-DISCOUNT-009 (not found), REQ-DISCOUNT-010 (expired — both
 * not-yet-started and already-ended), REQ-DISCOUNT-011 (minimum order,
 * carries `requiredMinimum`), REQ-DISCOUNT-012 (exhausted), REQ-DISCOUNT-013
 * (all four map to HTTP 409, expressed here as `status: 409` on the service
 * result — the route/HTTP layer itself is M6's job).
 *
 * `findCouponByCode` is mocked (design.md §7 — "레포지토리 목") so each check
 * is isolated from the database; `calculateDiscount` is the REAL M2 engine,
 * imported and called rather than reimplemented (design.md §2).
 *
 * `now` is an explicit parameter throughout — never read internally via
 * `new Date()` — so every expiry boundary is exercised deterministically.
 */

const findCouponByCode = vi.fn();

vi.mock("@/features/discounts/repositories/coupon-repository", () => ({
  findCouponByCode: (...args: unknown[]) => findCouponByCode(...args),
}));

const service = await import("@/features/discounts/services/discount-service");

const NOW = new Date("2026-06-15T12:00:00Z");

/** A coupon row that would pass every check, unless one field is overridden. */
function validCoupon(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c-1",
    code: "SAVE10",
    type: "PERCENTAGE" as const,
    value: 10,
    minOrderAmount: 30000,
    maxRedemptions: 5,
    redeemedCount: 0,
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T23:59:59Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SPEC-DISCOUNT-001 M3 — validateCoupon: COUPON_NOT_FOUND (REQ-DISCOUNT-009, AC-DISCOUNT-009)", () => {
  it("rejects with COUPON_NOT_FOUND when the code does not resolve to a row", async () => {
    findCouponByCode.mockResolvedValue(null);

    const result = await service.validateCoupon("NOPE", 50000, NOW);

    expect(result).toMatchObject({ ok: false, status: 409, code: "COUPON_NOT_FOUND" });
  });

  it("looks the code up exactly once and touches nothing else", async () => {
    findCouponByCode.mockResolvedValue(null);

    await service.validateCoupon("NOPE", 50000, NOW);

    expect(findCouponByCode).toHaveBeenCalledTimes(1);
    expect(findCouponByCode).toHaveBeenCalledWith("NOPE", undefined);
  });
});

describe("SPEC-DISCOUNT-001 M3 — validateCoupon: COUPON_EXPIRED (REQ-DISCOUNT-010, AC-DISCOUNT-010)", () => {
  it("rejects with COUPON_EXPIRED when endsAt is in the past", async () => {
    findCouponByCode.mockResolvedValue(
      validCoupon({ startsAt: new Date("2026-01-01T00:00:00Z"), endsAt: new Date("2026-06-01T00:00:00Z") })
    );

    const result = await service.validateCoupon("SAVE10", 50000, NOW);

    expect(result).toMatchObject({ ok: false, status: 409, code: "COUPON_EXPIRED" });
  });

  it("rejects with the SAME COUPON_EXPIRED code when startsAt is in the future", async () => {
    findCouponByCode.mockResolvedValue(
      validCoupon({ startsAt: new Date("2026-07-01T00:00:00Z"), endsAt: new Date("2026-12-31T23:59:59Z") })
    );

    const result = await service.validateCoupon("SAVE10", 50000, NOW);

    expect(result).toMatchObject({ ok: false, status: 409, code: "COUPON_EXPIRED" });
  });

  it("accepts when now is exactly on the boundary (inclusive range)", async () => {
    findCouponByCode.mockResolvedValue(validCoupon({ startsAt: NOW, endsAt: NOW }));

    const result = await service.validateCoupon("SAVE10", 50000, NOW);

    expect(result.ok).toBe(true);
  });
});

describe("SPEC-DISCOUNT-001 M3 — validateCoupon: COUPON_MINIMUM_NOT_MET (REQ-DISCOUNT-011, AC-DISCOUNT-011)", () => {
  it("rejects with COUPON_MINIMUM_NOT_MET and the required minimum when subtotal falls short", async () => {
    findCouponByCode.mockResolvedValue(validCoupon({ minOrderAmount: 30000 }));

    const result = await service.validateCoupon("SAVE10", 29999, NOW);

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "COUPON_MINIMUM_NOT_MET",
      requiredMinimum: 30000,
    });
  });

  it("accepts when the subtotal exactly equals the minimum (inclusive)", async () => {
    findCouponByCode.mockResolvedValue(validCoupon({ minOrderAmount: 30000 }));

    const result = await service.validateCoupon("SAVE10", 30000, NOW);

    expect(result.ok).toBe(true);
  });
});

describe("SPEC-DISCOUNT-001 M3 — validateCoupon: COUPON_EXHAUSTED (REQ-DISCOUNT-012, AC-DISCOUNT-012)", () => {
  it("rejects with COUPON_EXHAUSTED when redeemedCount has reached maxRedemptions", async () => {
    findCouponByCode.mockResolvedValue(validCoupon({ maxRedemptions: 5, redeemedCount: 5 }));

    const result = await service.validateCoupon("SAVE10", 50000, NOW);

    expect(result).toMatchObject({ ok: false, status: 409, code: "COUPON_EXHAUSTED" });
  });

  it("accepts when redeemedCount is one below the cap", async () => {
    findCouponByCode.mockResolvedValue(validCoupon({ maxRedemptions: 5, redeemedCount: 4 }));

    const result = await service.validateCoupon("SAVE10", 50000, NOW);

    expect(result.ok).toBe(true);
  });
});

describe("SPEC-DISCOUNT-001 M3 — validateCoupon: check ordering (fail fast, spec.md §4 order)", () => {
  it("reports COUPON_NOT_FOUND even when the subtotal would also have failed the minimum", async () => {
    findCouponByCode.mockResolvedValue(null);

    const result = await service.validateCoupon("NOPE", 0, NOW);

    expect(result).toMatchObject({ code: "COUPON_NOT_FOUND" });
  });

  it("reports COUPON_EXPIRED before COUPON_MINIMUM_NOT_MET when both would fail", async () => {
    findCouponByCode.mockResolvedValue(
      validCoupon({ endsAt: new Date("2026-01-01T00:00:00Z"), minOrderAmount: 999999 })
    );

    const result = await service.validateCoupon("SAVE10", 1, NOW);

    expect(result).toMatchObject({ code: "COUPON_EXPIRED" });
  });

  it("reports COUPON_MINIMUM_NOT_MET before COUPON_EXHAUSTED when both would fail", async () => {
    findCouponByCode.mockResolvedValue(
      validCoupon({ minOrderAmount: 999999, maxRedemptions: 5, redeemedCount: 5 })
    );

    const result = await service.validateCoupon("SAVE10", 1, NOW);

    expect(result).toMatchObject({ code: "COUPON_MINIMUM_NOT_MET" });
  });
});

describe("SPEC-DISCOUNT-001 M3 — validateCoupon: success path (calls the REAL M2 engine)", () => {
  it("returns ok:true with the coupon and the calculated discount amount", async () => {
    findCouponByCode.mockResolvedValue(validCoupon({ type: "PERCENTAGE", value: 10 }));

    const result = await service.validateCoupon("SAVE10", 50000, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discountAmount).toBe(5000); // 50000 * 10 / 100, matching calculateDiscount
      expect(result.coupon).toMatchObject({ code: "SAVE10" });
    }
  });

  it("clamps a FIXED_AMOUNT discount larger than the subtotal, via the shared engine", async () => {
    findCouponByCode.mockResolvedValue(validCoupon({ type: "FIXED_AMOUNT", value: 999999, minOrderAmount: 0 }));

    const result = await service.validateCoupon("SAVE10", 5000, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discountAmount).toBe(5000);
    }
  });

  it("never mutates redeemedCount — this layer only reads and calculates (M4 owns the write)", async () => {
    const coupon = validCoupon({ redeemedCount: 2 });
    findCouponByCode.mockResolvedValue(coupon);

    await service.validateCoupon("SAVE10", 50000, NOW);

    expect(coupon.redeemedCount).toBe(2);
  });
});

describe("SPEC-DISCOUNT-001 M3 — validateCoupon: normalizes the code before lookup (REQ-DISCOUNT-002)", () => {
  it("passes the code through to the repository unchanged — normalization is the repository's job", async () => {
    // coupon-repository.ts already owns normalization (its own test file pins
    // this); discount-service.ts must not re-normalize and risk diverging.
    findCouponByCode.mockResolvedValue(null);

    await service.validateCoupon("save10", 50000, NOW);

    expect(findCouponByCode).toHaveBeenCalledWith("save10", undefined);
  });
});
