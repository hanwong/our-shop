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
