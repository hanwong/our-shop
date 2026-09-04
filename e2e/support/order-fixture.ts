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
