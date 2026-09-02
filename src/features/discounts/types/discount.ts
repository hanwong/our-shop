/**
 * SPEC-DISCOUNT-001 M2 — pure discount-engine types.
 *
 * No imports (design.md §2 — the type module carries only shapes). Mirrors
 * the `DiscountType` enum name in prisma/schema.prisma without importing
 * `@prisma/client`, per structure.md's rule that `features/` must not depend
 * on the delivery mechanism (REQ-DISCOUNT-004).
 */

/** Mirrors `enum DiscountType` in prisma/schema.prisma, as a string union. */
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

/**
 * The subset of a `Coupon` row the pure calculation engine needs.
 *
 * `minOrderAmount` is intentionally NOT part of this shape: design.md §2's
 * documented signature is `{ type, value, minOrderAmount }`, but nothing in
 * REQ-DISCOUNT-004~008 uses a minimum-order figure inside the calculation
 * itself — that check is a rejection decision (REQ-DISCOUNT-011), which
 * belongs to M3's discount-service.ts alongside the other validation checks
 * (expiry, exhaustion) this engine deliberately excludes. Carrying an unused
 * field here would be dead input the engine ignores, so the shape is narrowed
 * to exactly what `calculateDiscount` reads.
 */
export interface DiscountInput {
  type: DiscountType;
  /** PERCENTAGE: 0 < value <= 100. FIXED_AMOUNT: won, > 0. */
  value: number;
}

/**
 * SPEC-DISCOUNT-001 M3 — the four ways a coupon can be refused
 * (spec.md §4 "쿠폰 검증과 거절", design.md §4).
 *
 * Mirrors `OrderFailureCode` in features/orders/types/order.ts one-for-one:
 * this domain extends the SAME failure-code system the order domain already
 * established (REQ-DISCOUNT-013), rather than inventing a parallel shape.
 */
export type DiscountFailureCode =
  | "COUPON_NOT_FOUND"
  | "COUPON_EXPIRED"
  | "COUPON_MINIMUM_NOT_MET"
  | "COUPON_EXHAUSTED";

/**
 * A coupon refusal. All four are `409` (REQ-DISCOUNT-013) — the request is
 * well-formed, it is the server's state (no such code, outside its window,
 * subtotal too low, redemptions used up) that disagrees with it.
 *
 * `COUPON_MINIMUM_NOT_MET` alone carries `requiredMinimum`, for the same
 * reason `OrderFailure`'s `INSUFFICIENT_STOCK` carries `products` and
 * `PRICE_CHANGED` carries `totalAmount`: it is a failure the shopper can act
 * on, so the amount they are short by must be named (REQ-DISCOUNT-011).
 */
export type DiscountFailure =
  | { status: 409; code: "COUPON_NOT_FOUND" }
  | { status: 409; code: "COUPON_EXPIRED" }
  | { status: 409; code: "COUPON_MINIMUM_NOT_MET"; requiredMinimum: number }
  | { status: 409; code: "COUPON_EXHAUSTED" };
