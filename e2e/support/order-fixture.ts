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
import { PrismaClient } from "@prisma/client";

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
 * SPEC-E2E-001 M3 — the literal success-mode paymentKey `toss-sdk-stub.js`
 * hardcodes (plan.md §D's concept script: `paymentKey", "e2e_stub_payment_key"`).
 * Exported here, not re-typed at each call site, so the M3 scenario and this
 * fixture's own cleanup helper below can never disagree on the value.
 */
export const STUB_SUCCESS_PAYMENT_KEY = "e2e_stub_payment_key";

/**
 * SPEC-E2E-001 M3 — narrow, scenario-scoped defensive cleanup for a known
 * residual risk (progress.md §E.2 M2): every scenario that completes a
 * payment in success mode drives the SAME literal paymentKey through
 * `confirmTossPayment()`, and `Order.paymentKey` carries a DB-level unique
 * constraint (`prisma/schema.prisma`). M2's own success scenario does not
 * wait for its triggered navigation to fully settle before the test
 * function returns (it only awaits the initial request), so the
 * server-side confirm write it triggers can still be in flight when a
 * LATER scenario's own confirm call targets the same literal key — tripping
 * Prisma P2002 on `markOrderPaid()`'s `updateMany()` and turning that
 * confirm redirect into an unhandled 500 instead of the paid-state PASS the
 * scenario expects.
 *
 * Nulling out any row still holding the key immediately before a scenario's
 * own payment step closes exactly that window. This is deliberately NOT the
 * general seed/isolation cleanup deferred to M5 (plan.md §F) — it touches
 * only the one column this suite's shared stub literal can collide on, and
 * only a stale value, never a row's other fields.
 */
export async function clearStalePaymentKey(paymentKey: string): Promise<void> {
  await prisma.order.updateMany({
    where: { paymentKey },
    data: { paymentKey: null },
  });
}
