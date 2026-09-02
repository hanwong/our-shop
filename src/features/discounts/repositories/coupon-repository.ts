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
