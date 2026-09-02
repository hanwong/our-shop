import type { Coupon, Prisma } from "@prisma/client";
import { findCouponByCode } from "@/features/discounts/repositories/coupon-repository";
import { calculateDiscount } from "@/features/discounts/services/discount-engine";
import type { DiscountFailure } from "@/features/discounts/types/discount";

/**
 * SPEC-DISCOUNT-001 M3 — coupon lookup + validation, composed with M2's pure
 * engine (design.md §2's third module: "조회 + 검증 + 엔진 호출 조합").
 *
 * Traces: REQ-DISCOUNT-009 (not found), REQ-DISCOUNT-010 (expired — a single
 * code covers both not-yet-started and already-ended, AC-DISCOUNT-010),
 * REQ-DISCOUNT-011 (minimum order, carries `requiredMinimum`),
 * REQ-DISCOUNT-012 (exhausted), REQ-DISCOUNT-013 (all four are 409s — see
 * `DiscountFailure` in types/discount.ts).
 *
 * Checks run in the order spec.md §4 lists them (REQ-DISCOUNT-009 through
 * -012): not-found, then expired, then minimum, then exhausted — fail fast on
 * the cheapest, most-decisive question first. `calculateDiscount` (M2) is
 * imported and called, never reimplemented, so the screen and the order
 * service that will both eventually call this path share ONE arithmetic
 * (design.md §2's whole reason for the engine/service split).
 *
 * `now` is an explicit parameter — never read internally via `new Date()` —
 * so every expiry boundary is testable without faking the system clock. This
 * extends design.md §2's "시각 비교는 엔진 밖" principle one layer further: the
 * comparison lives here, in the service, but the clock itself still belongs
 * to the caller.
 *
 * This module ONLY reads and calculates. It never writes `Coupon.redeemedCount`
 * — the conditional atomic increment (design.md §3.2) is M4's job, inside the
 * order transaction.
 */

export type ValidateCouponResult =
  | { ok: true; coupon: Coupon; discountAmount: number }
  | ({ ok: false } & DiscountFailure);

/**
 * Validates `code` against `itemsSubtotal` as of `now`, and — only when every
 * check passes — returns the discount M2's engine computes.
 *
 * `client` is threaded straight through to `findCouponByCode` (undefined by
 * default, resolving to the repository's own singleton default) so a future
 * caller running inside a transaction can pass one.
 */
export async function validateCoupon(
  code: string,
  itemsSubtotal: number,
  now: Date,
  client?: Prisma.TransactionClient
): Promise<ValidateCouponResult> {
  const coupon = await findCouponByCode(code, client);

  if (!coupon) {
    return { ok: false, status: 409, code: "COUPON_NOT_FOUND" };
  }

  if (now < coupon.startsAt || now > coupon.endsAt) {
    return { ok: false, status: 409, code: "COUPON_EXPIRED" };
  }

  if (itemsSubtotal < coupon.minOrderAmount) {
    return {
      ok: false,
      status: 409,
      code: "COUPON_MINIMUM_NOT_MET",
      requiredMinimum: coupon.minOrderAmount,
    };
  }

  if (coupon.redeemedCount >= coupon.maxRedemptions) {
    return { ok: false, status: 409, code: "COUPON_EXHAUSTED" };
  }

  const discountAmount = calculateDiscount(
    { type: coupon.type, value: coupon.value },
    itemsSubtotal
  );

  return { ok: true, coupon, discountAmount };
}
