import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * SPEC-ORDER-001 M2 — Prisma query layer for the order domain.
 *
 * Traces: REQ-ORDER-011 (the four effects run inside one transaction),
 * REQ-ORDER-013 (stock is decremented conditionally), REQ-ORDER-016
 * (idempotency), REQ-ORDER-020 (an order reads back only for its own guest).
 *
 * Like features/cart/repositories/*, this layer performs NO validation and
 * applies NO defaults — it trusts its arguments. Amount recomputation, the
 * confirmed-total comparison and failure mapping live one layer up in
 * services/order-service.ts.
 *
 * WHY EVERY FUNCTION TAKES A CLIENT: the order transaction's whole claim is
 * that its four effects are atomic (REQ-ORDER-012), and that claim is only true
 * if every statement runs on the client `prisma.$transaction` handed to the
 * callback. A function that closed over the module singleton would execute
 * OUTSIDE the transaction and would not be rolled back — an atomicity hole that
 * no green test on the happy path would reveal. The service therefore owns the
 * transaction boundary and passes the client down (design.md §2).
 *
 * The two read functions default to the singleton because they are also used
 * outside a transaction: the idempotency fast path runs before the transaction
 * opens (design.md §5), and the completion screen has no transaction at all.
 */

/**
 * The line projection. Ordered by insertion so the completion screen lists the
 * items the way the order summary did, rather than reshuffling between reads.
 */
const ORDER_INCLUDE = {
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/** The row the transaction writes. Mirrors the schema, minus its defaults. */
export interface CreateOrderRow {
  orderNumber: string;
  guestId: string;
  idempotencyKey: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  deliveryMemo: string | null;
  itemsSubtotal: number;
  shippingFee: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
}

/**
 * A client that can run order queries: the module singleton, or the one
 * `$transaction` hands its callback. Both satisfy `Prisma.TransactionClient`,
 * so no union is needed (design.md §2.1).
 */
type OrderClient = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The order a given idempotency key already produced, or null when the key is
 * new (REQ-ORDER-016).
 *
 * The items are joined because a replayed submission must answer with the WHOLE
 * first order, not merely acknowledge that one exists (AC-ORDER-016 (a)).
 */
export async function findOrderByIdempotencyKey(
  idempotencyKey: string,
  client: OrderClient = prisma
): Promise<OrderWithItems | null> {
  return client.order.findUnique({ where: { idempotencyKey }, include: ORDER_INCLUDE });
}

/**
 * The order, but ONLY for the guest it belongs to (REQ-ORDER-020).
 *
 * Ownership is part of the WHERE rather than a check applied to the result, so
 * there is no shape of this function that returns a stranger's order to be
 * filtered afterwards. `findFirst` rather than `findUnique` because the filter
 * is a compound of a unique id and a non-unique owner column.
 */
export async function findOrderForGuest(
  orderId: string,
  guestId: string,
  client: OrderClient = prisma
): Promise<OrderWithItems | null> {
  return client.order.findFirst({ where: { id: orderId, guestId }, include: ORDER_INCLUDE });
}

// ---------------------------------------------------------------------------
// Writes — transaction client REQUIRED, no singleton default
// ---------------------------------------------------------------------------

/**
 * Decrements a product's stock, but only if it currently holds enough
 * (REQ-ORDER-013, design.md §3).
 *
 * The condition lives in the UPDATE's own WHERE, so the DATABASE decides
 * whether the row qualifies while holding a lock on it. A read-then-write
 * would let two concurrent orders both observe sufficient stock and both
 * proceed, which is exactly the oversell this guards against. Prisma's
 * `update` cannot express a non-unique WHERE, hence `updateMany`.
 *
 * Returns the number of rows changed: 1 when the decrement happened, 0 when the
 * condition failed. That count IS the answer — the caller needs no second read.
 */
export async function decrementStockIfAvailable(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number
): Promise<number> {
  const updated = await tx.product.updateMany({
    where: { id: productId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  return updated.count;
}

/**
 * Writes the order and all of its lines as ONE nested create.
 *
 * Nested rather than an order insert followed by item inserts: a single
 * statement leaves no window in which an order exists with no lines, and it
 * keeps the write count independent of the cart's size.
 *
 * `status` is deliberately not set — the schema default supplies
 * `pending_payment` (REQ-ORDER-017), and stating it here would put a second
 * declaration of "what a new order is" beside the schema's.
 */
export async function createOrderWithItems(
  tx: Prisma.TransactionClient,
  row: CreateOrderRow
): Promise<{ id: string }> {
  const { items, ...order } = row;
  return tx.order.create({
    data: { ...order, items: { create: items } },
    select: { id: true },
  });
}
