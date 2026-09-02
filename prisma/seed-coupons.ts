/**
 * SPEC-DISCOUNT-001 M1 — verification coupon seed script.
 *
 * Standalone, dev-only. There is no admin authoring UI for coupons in this
 * repository by design (plan.md §0 확정, spec.md §3 Out of Scope — 관리자
 * 쿠폰 저작 화면·API): the `Category` model set the precedent of leaving
 * write-authoring to a future admin SPEC, and this SPEC follows it. This
 * script exists only so later milestones (the calculation engine, the
 * validation service, the checkout UI) have real rows to exercise against.
 *
 * Run with:
 *   node prisma/seed-coupons.ts
 *
 * (Node 22.6+ strips TypeScript types natively — no `tsx`/`ts-node`
 * dependency needed; this repository has neither installed. Verified against
 * the Node runtime in this environment: `node --version` → v25.2.1.)
 *
 * Every coupon is `upsert`ed keyed on `code`, so re-running this script is
 * safe and idempotent — it will not create duplicates or fail on a unique
 * constraint.
 */

import { DiscountType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOW = new Date();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const FAR_PAST = new Date(NOW.getTime() - ONE_YEAR_MS);
const YESTERDAY = new Date(NOW.getTime() - ONE_DAY_MS);
const FAR_FUTURE = new Date(NOW.getTime() + ONE_YEAR_MS);
const TOMORROW = new Date(NOW.getTime() + ONE_DAY_MS);

interface SeedCoupon {
  code: string;
  type: DiscountType;
  value: number;
  minOrderAmount?: number;
  maxRedemptions: number;
  redeemedCount?: number;
  startsAt: Date;
  endsAt: Date;
  note: string;
}

const SEED_COUPONS: SeedCoupon[] = [
  {
    // Active PERCENTAGE coupon with generous headroom — the default "happy
    // path" fixture for later milestones' engine/service/UI tests.
    code: "WELCOME10",
    type: DiscountType.PERCENTAGE,
    value: 10,
    maxRedemptions: 1000,
    startsAt: FAR_PAST,
    endsAt: FAR_FUTURE,
    note: "active PERCENTAGE 10%, generous maxRedemptions",
  },
  {
    // Active FIXED_AMOUNT coupon — the other half of REQ-DISCOUNT-003's two
    // supported types.
    code: "FLAT5000",
    type: DiscountType.FIXED_AMOUNT,
    value: 5000,
    maxRedemptions: 1000,
    startsAt: FAR_PAST,
    endsAt: FAR_FUTURE,
    note: "active FIXED_AMOUNT 5000원",
  },
  {
    // endsAt in the past — exercises COUPON_EXPIRED (REQ-DISCOUNT-010).
    code: "EXPIRED10",
    type: DiscountType.PERCENTAGE,
    value: 10,
    maxRedemptions: 100,
    startsAt: FAR_PAST,
    endsAt: YESTERDAY,
    note: "expired — endsAt is in the past",
  },
  {
    // redeemedCount === maxRedemptions — exercises COUPON_EXHAUSTED
    // (REQ-DISCOUNT-012). REQ-DISCOUNT-022: this is a GLOBAL cap, not a
    // per-guest one.
    code: "EXHAUSTED1",
    type: DiscountType.FIXED_AMOUNT,
    value: 1000,
    maxRedemptions: 5,
    redeemedCount: 5,
    startsAt: FAR_PAST,
    endsAt: FAR_FUTURE,
    note: "exhausted — redeemedCount === maxRedemptions",
  },
  {
    // High minOrderAmount — exercises COUPON_MINIMUM_NOT_MET
    // (REQ-DISCOUNT-011).
    code: "BIGORDER30",
    type: DiscountType.PERCENTAGE,
    value: 15,
    minOrderAmount: 300000,
    maxRedemptions: 100,
    startsAt: FAR_PAST,
    endsAt: FAR_FUTURE,
    note: "requires itemsSubtotal >= 300000",
  },
  {
    // startsAt in the future — the other COUPON_EXPIRED branch
    // (REQ-DISCOUNT-010 covers both endsAt-in-the-past and
    // startsAt-in-the-future).
    code: "NOTYETSTARTED",
    type: DiscountType.FIXED_AMOUNT,
    value: 2000,
    maxRedemptions: 100,
    startsAt: TOMORROW,
    endsAt: FAR_FUTURE,
    note: "not yet started — startsAt is in the future",
  },
];

async function main() {
  for (const coupon of SEED_COUPONS) {
    const result = await prisma.coupon.upsert({
      where: { code: coupon.code },
      create: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount ?? 0,
        maxRedemptions: coupon.maxRedemptions,
        redeemedCount: coupon.redeemedCount ?? 0,
        startsAt: coupon.startsAt,
        endsAt: coupon.endsAt,
      },
      update: {
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount ?? 0,
        maxRedemptions: coupon.maxRedemptions,
        redeemedCount: coupon.redeemedCount ?? 0,
        startsAt: coupon.startsAt,
        endsAt: coupon.endsAt,
      },
    });
    console.log(`[seed-coupons] ${result.code} — ${coupon.note}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("[seed-coupons] failed:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
