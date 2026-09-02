import { describe, it, expect } from "vitest";
import { calculateDiscount } from "@/features/discounts/services/discount-engine";

/**
 * SPEC-DISCOUNT-001 M2 — src/features/discounts/services/discount-engine.ts
 *
 * Traces: REQ-DISCOUNT-004 (pure function — no DB/clock/random/network),
 * REQ-DISCOUNT-005 (applies to itemsSubtotal only, caller adds shippingFee
 * separately), REQ-DISCOUNT-006 (order-level number, no per-line
 * allocation), REQ-DISCOUNT-007 (PERCENTAGE floors, boundary pinned at
 * 33333 * 10% -> 3333, not 3334), REQ-DISCOUNT-008 (clamped to
 * itemsSubtotal, so totalAmount never goes negative).
 *
 * Time-window, minimum-order and exhaustion checks are explicitly OUT of
 * scope here (design.md §2) — they belong to M3's discount-service.ts,
 * which is the only module allowed to touch `now`.
 */

describe("calculateDiscount", () => {
  it("floors a PERCENTAGE discount at the won boundary (AC-DISCOUNT-007)", () => {
    // 33333 * 10 / 100 = 3333.3 -> floor -> 3333, never 3334 (ceil) or 3333.3 rounded.
    const result = calculateDiscount({ type: "PERCENTAGE", value: 10 }, 33333);
    expect(result).toBe(3333);
  });

  it("floors down even when the fractional part is >= 0.5", () => {
    // 100 * 33.335 / 100 = 33.335 -> floor -> 33 (never rounds up to 34).
    const result = calculateDiscount({ type: "PERCENTAGE", value: 33.335 }, 100);
    expect(result).toBe(33);
  });

  it("computes a FIXED_AMOUNT discount as the flat value, unclamped case", () => {
    const result = calculateDiscount({ type: "FIXED_AMOUNT", value: 3000 }, 50000);
    expect(result).toBe(3000);
  });

  it("clamps a FIXED_AMOUNT discount to itemsSubtotal so totalAmount never goes negative (AC-DISCOUNT-008)", () => {
    const result = calculateDiscount({ type: "FIXED_AMOUNT", value: 10000 }, 5000);
    expect(result).toBe(5000);
  });

  it("clamps a 100%+ PERCENTAGE discount to itemsSubtotal", () => {
    const result = calculateDiscount({ type: "PERCENTAGE", value: 100 }, 12345);
    expect(result).toBe(12345);
  });

  it("returns 0 when itemsSubtotal is 0, for either discount type", () => {
    expect(calculateDiscount({ type: "PERCENTAGE", value: 10 }, 0)).toBe(0);
    expect(calculateDiscount({ type: "FIXED_AMOUNT", value: 5000 }, 0)).toBe(0);
  });

  it("never returns a value exceeding itemsSubtotal, or below 0 (REQ-DISCOUNT-008)", () => {
    const percentResult = calculateDiscount({ type: "PERCENTAGE", value: 100 }, 999);
    const fixedResult = calculateDiscount({ type: "FIXED_AMOUNT", value: 999999 }, 999);
    expect(percentResult).toBeLessThanOrEqual(999);
    expect(percentResult).toBeGreaterThanOrEqual(0);
    expect(fixedResult).toBeLessThanOrEqual(999);
    expect(fixedResult).toBeGreaterThanOrEqual(0);
  });
});
