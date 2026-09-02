import type { Prisma, Coupon } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * SPEC-DISCOUNT-001 M3 — Prisma query layer for the coupon domain.
 *
 * Traces: REQ-DISCOUNT-002 (a coupon code is looked up case-insensitively —
 * the application layer normalizes to uppercase before every read, since the
 * stored `code` column is itself uppercase-normalized; see M1's
 * coupon-model.test.ts and prisma/schema.prisma's `Coupon.code` comment).
 *
 * Like features/orders/repositories/order-repository.ts, this layer performs
 * NO validation — it trusts its argument and returns the raw row (or null).
 * Expiry, minimum-order, and exhaustion decisions live one layer up in
 * services/discount-service.ts (design.md §2).
 *
 * WHY THIS READ DEFAULTS TO THE SINGLETON: unlike the M4 conditional atomic
 * update this repository will also own (design.md §3.2, `Coupon.redeemedCount`
 * — which per that section's precedent from `findStockByProductIds` REQUIRES a
 * transaction client with no singleton default, because its correctness
 * depends on running inside the same transaction as the increment it guards),
 * this function only ever READS a coupon to validate one before an order
 * transaction opens. It is the discount-domain counterpart of
 * order-repository.ts's `findOrderByIdempotencyKey` / `findOrderForGuest`: a
 * client parameter is accepted so a future caller running inside a
 * transaction can pass one, but the common case — discount-service.ts's
 * pre-transaction validation — needs no transaction at all.
 */

/**
 * A client that can run coupon queries: the module singleton, or the one
 * `$transaction` hands its callback. Both satisfy `Prisma.TransactionClient`,
 * mirroring order-repository.ts's `OrderClient` alias.
 */
type CouponClient = Prisma.TransactionClient;

/**
 * The coupon matching `code`, normalized to uppercase before the lookup
 * (REQ-DISCOUNT-002), or `null` when no such code exists.
 *
 * Returns the raw Prisma row — discount-service.ts owns turning an absent row
 * into `COUPON_NOT_FOUND`, not this layer.
 */
export async function findCouponByCode(
  code: string,
  client: CouponClient = prisma
): Promise<Coupon | null> {
  return client.coupon.findUnique({ where: { code: code.toUpperCase() } });
}

// ---------------------------------------------------------------------------
// Writes — transaction client REQUIRED, no singleton default
// ---------------------------------------------------------------------------

/**
 * Conditionally increments a coupon's redemption count, but only while it is
 * still under `maxRedemptions` (SPEC-DISCOUNT-001 M4, design.md §3.2).
 *
 * Mirrors order-repository.ts's `decrementStockIfAvailable` shape exactly, for
 * the same reason: `updateMany`, not `update`, because the condition
 * (`redeemedCount < maxRedemptions`) is a NON-UNIQUE WHERE clause, and only
 * `updateMany` can express one. A plain read-then-write would let two
 * concurrent orders both observe an available slot and both increment,
 * silently exceeding `maxRedemptions` — precisely the oversell this atomic
 * update prevents (REQ-DISCOUNT-016).
 *
 * Takes NO singleton default — like `findStockByProductIds`, the only caller
 * is inside the order transaction (design.md §3.1's step 3f), and the count
 * this function guards must be read and written on that SAME transaction
 * client or the atomicity claim is void.
 *
 * Returns the number of rows changed: 1 when the increment happened, 0 when
 * the coupon had already reached `maxRedemptions` — the caller needs no
 * second read (REQ-DISCOUNT-017).
 */
export async function incrementRedeemedCountIfAvailable(
  tx: Prisma.TransactionClient,
  couponId: string,
  maxRedemptions: number
): Promise<number> {
  const updated = await tx.coupon.updateMany({
    where: { id: couponId, redeemedCount: { lt: maxRedemptions } },
    data: { redeemedCount: { increment: 1 } },
  });
  return updated.count;
}
