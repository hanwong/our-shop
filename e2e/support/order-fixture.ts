/**
 * SPEC-E2E-001 M1 — a real `pending_payment` Order for the spike test.
 *
 * The spike (plan.md §B "M1 스파이크가 먼저 증명해야 하는 것") only needs
 * confirmPayment()'s existing guards (order exists, status pending_payment,
 * amount matches) to pass so execution actually reaches confirmTossPayment()
 * — it does not need the full cart → checkout journey (that is M3's job).
 * Creating the row directly via Prisma is the smaller, more direct fixture
 * for exactly that purpose.
 */
import { DiscountType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Mirrors GUEST_CART_COOKIE_NAME (src/lib/auth/guest-identity.ts, spec.md §4.2). */
export const GUEST_COOKIE_NAME = "guest_cart_id";

export interface SpikeOrderHandle {
  orderId: string;
  guestId: string;
  totalAmount: number;
}

export async function createSpikeOrder(): Promise<SpikeOrderHandle> {
  const product = await prisma.product.findFirst({ where: { isActive: true } });
  if (!product) {
    throw new Error(
      "[e2e] no seeded active Product found in the database — the M1 spike order fixture needs one."
    );
  }

  const unique = `e2e-m1-spike-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const quantity = 1;
  const lineTotal = product.price * quantity;
  const itemsSubtotal = lineTotal;
  const shippingFee = 3000;
  const totalAmount = itemsSubtotal + shippingFee;

  const order = await prisma.order.create({
    data: {
      orderNumber: `E2E-${unique}`.toUpperCase(),
      guestId: `${unique}-guest`,
      recipientName: "E2E Spike",
      recipientPhone: "010-0000-0000",
      postalCode: "00000",
      address: "E2E spike fixture address",
      itemsSubtotal,
      shippingFee,
      totalAmount,
      idempotencyKey: unique,
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            quantity,
            lineTotal,
          },
        ],
      },
    },
  });

  return { orderId: order.id, guestId: order.guestId, totalAmount: order.totalAmount };
}

export async function deleteSpikeOrder(orderId: string): Promise<void> {
  try {
    await prisma.order.delete({ where: { id: orderId } });
  } catch {
    // Best-effort cleanup — already gone (or never committed) is fine.
  }
}

export async function disconnectSpikeOrderClient(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * SPEC-E2E-001 M3 — a real seeded, sellable Product for the happy-path
 * journey (plan.md §F M3).
 *
 * Unlike `createSpikeOrder()` above, M3 does not create the Order directly:
 * the whole point of REQ-E2E-008/009 is that the cart -> checkout -> order
 * path is driven through the real UI. This fixture supplies only the one
 * thing the journey cannot itself originate — a product that actually
 * exists and can be added to cart (`stock > 0`, matching AddToCartButton's
 * own `stock === 0` disabled-state guard).
 */
export interface SeededProductHandle {
  productId: string;
  name: string;
  price: number;
}

export async function getSeededProduct(): Promise<SeededProductHandle> {
  const product = await prisma.product.findFirst({
    where: { isActive: true, stock: { gt: 0 } },
  });
  if (!product) {
    throw new Error(
      "[e2e] no seeded active Product with stock > 0 found — the M3 happy-path fixture needs one."
    );
  }
  return { productId: product.id, name: product.name, price: product.price };
}

/**
 * SPEC-E2E-001 M5 (REQ-E2E-015) — mirrors `toss-sdk-stub.js`'s success-mode
 * paymentKey derivation EXACTLY (`"e2e_stub_payment_key_" + options.orderId`)
 * so any scenario or fixture that needs to know a given order's stub-issued
 * key never has to re-type the template and risk drifting from it.
 *
 * Superseded (M5): a single shared literal constant used to fill this role
 * (`STUB_SUCCESS_PAYMENT_KEY = "e2e_stub_payment_key"`) — every scenario that
 * completed a payment in success mode drove the SAME value through
 * `confirmTossPayment()`, and `Order.paymentKey` carries a DB-level unique
 * constraint (`prisma/schema.prisma`). Because a scenario's server-side
 * confirm write can still be in flight when a LATER scenario's own confirm
 * call landed (progress.md §E.2 M2 residual-risk note — M2's own success
 * scenario does not await its triggered navigation settling before
 * returning), two DIFFERENT orders could momentarily race to claim the SAME
 * literal key, tripping Prisma P2002 on `markOrderPaid()`'s `updateMany()`.
 * Deriving the key from each order's own id — always unique, since every
 * order is a fresh Prisma row — removes the collision at its source: no two
 * scenarios' keys can ever coincide, regardless of write timing.
 */
export function stubSuccessPaymentKey(orderId: string): string {
  return `e2e_stub_payment_key_${orderId}`;
}

/**
 * SPEC-E2E-001 M3 — narrow, scenario-scoped defensive cleanup, retained as a
 * belt-and-suspenders guard after the M5 per-order key derivation above
 * removed the actual cross-scenario collision source. Nulls out any row that
 * still holds a given paymentKey (e.g. a leftover from a prior interrupted
 * run reusing the exact same order id, or an in-flight retry) immediately
 * before a scenario's own payment step. Callers now pass their OWN order's
 * derived key (`stubSuccessPaymentKey(orderId)`), not a value shared with
 * every other scenario in the suite.
 */
export async function clearStalePaymentKey(paymentKey: string): Promise<void> {
  await prisma.order.updateMany({
    where: { paymentKey },
    data: { paymentKey: null },
  });
}

/**
 * SPEC-E2E-001 M4 (REQ-E2E-014) — a real, currently-valid PERCENTAGE Coupon
 * row for the checkout-screen coupon-apply scenario.
 *
 * `prisma/seed-coupons.ts` (SPEC-DISCOUNT-001 M1) already defines a
 * comparable "happy path" coupon (`WELCOME10`), but that script is
 * "standalone, dev-only" (its own module doc) — it is not wired into
 * `npm run test:e2e`'s webServer startup, so its rows are not guaranteed to
 * exist in whatever database this suite runs against. This fixture creates
 * its OWN row directly via Prisma instead, the same self-contained pattern
 * `createSpikeOrder()` above already uses for Order rows: the scenario does
 * not depend on a separate script having been run first.
 *
 * `code` is upserted rather than plain-created so re-running this suite
 * against a database that already has a leftover row from a prior run
 * (crash, interrupted test) does not collide on the `@unique` constraint
 * (`prisma/schema.prisma` — `Coupon.code`).
 *
 * `minOrderAmount: 0` deliberately — this fixture does not know the seeded
 * product's price (`getSeededProduct()` is independent), so the coupon must
 * apply regardless of cart total.
 */
const E2E_COUPON_CODE = "E2E4M4COUPON";

export interface DiscountCouponHandle {
  code: string;
}

export async function createDiscountCoupon(): Promise<DiscountCouponHandle> {
  const now = Date.now();
  const startsAt = new Date(now - 24 * 60 * 60 * 1000);
  const endsAt = new Date(now + 24 * 60 * 60 * 1000);

  await prisma.coupon.upsert({
    where: { code: E2E_COUPON_CODE },
    create: {
      code: E2E_COUPON_CODE,
      type: DiscountType.PERCENTAGE,
      value: 10,
      minOrderAmount: 0,
      maxRedemptions: 1000,
      redeemedCount: 0,
      startsAt,
      endsAt,
    },
    update: {
      // Reset in case a prior interrupted run left it exhausted or expired.
      redeemedCount: 0,
      startsAt,
      endsAt,
    },
  });

  return { code: E2E_COUPON_CODE };
}

export async function deleteDiscountCoupon(code: string): Promise<void> {
  try {
    await prisma.coupon.delete({ where: { code } });
  } catch {
    // Best-effort cleanup — already gone (or never committed) is fine.
  }
}
