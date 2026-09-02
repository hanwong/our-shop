import type { DiscountInput } from "@/features/discounts/types/discount";

/**
 * SPEC-DISCOUNT-001 M2 — the pure discount calculation engine.
 *
 * Traces: REQ-DISCOUNT-004 (pure function — no DB, clock, random, or network
 * access; AC-DISCOUNT-004 pins this with a static import/call-site check),
 * REQ-DISCOUNT-005 (applies to `itemsSubtotal` only — the caller computes
 * `totalAmount = itemsSubtotal - discountAmount + shippingFee`; this function
 * never sees `shippingFee`), REQ-DISCOUNT-006 (returns one order-level
 * number — it does not touch `OrderItem.lineTotal` or allocate per line),
 * REQ-DISCOUNT-007 (PERCENTAGE floors to the won, not rounds or ceils),
 * REQ-DISCOUNT-008 (clamped so the result never exceeds `itemsSubtotal`,
 * which is what keeps the caller's `totalAmount` from going negative).
 *
 * Deliberately OUT of scope (design.md §2): time-window / expiry, minimum-
 * order rejection, and usage-exhaustion checks. Those are rejection
 * decisions that need `now` and the database, so they live in M3's
 * discount-service.ts — the moment this module touched a clock it would stop
 * being pure.
 *
 * @MX:ANCHOR shared by the checkout screen and order-service so both compute
 * the SAME discount from the SAME function (design.md §2) — a regression
 * here diverges what the shopper sees from what gets charged.
 */

/**
 * Computes the discount amount for one coupon against `itemsSubtotal`.
 *
 * Always returns an integer in `[0, itemsSubtotal]` (REQ-DISCOUNT-008).
 */
export function calculateDiscount(coupon: DiscountInput, itemsSubtotal: number): number {
  const raw =
    coupon.type === "PERCENTAGE"
      ? Math.floor((itemsSubtotal * coupon.value) / 100) // REQ-DISCOUNT-007: floor, not round/ceil
      : coupon.value;

  // REQ-DISCOUNT-008: clamp to [0, itemsSubtotal] so the caller's
  // totalAmount (itemsSubtotal - discountAmount + shippingFee) never goes
  // negative. The lower bound is defensive — coupon.value is validated as
  // positive upstream — but costs nothing to hold here too.
  return Math.max(0, Math.min(raw, itemsSubtotal));
}
