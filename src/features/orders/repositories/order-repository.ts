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
  /** SPEC-DISCOUNT-001 M4 — the applied discount snapshot. `null`/`0` for none. */
  couponCode: string | null;
  discountAmount: number;
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

/**
 * The order matching BOTH the order number and the recipient phone
 * (SPEC-ORDER-003 M1 — REQ-ORDER-034 ~ 037, plan.md §1).
 *
 * Same discipline as findOrderForGuest() above: the comparison is part of the
 * WHERE, never "fetch by orderNumber then compare recipientPhone in
 * application code". A fetch-then-compare shape is one missed branch away
 * from leaking a stranger's order — plan.md §1's explicitly rejected
 * alternative. This also gives REQ-ORDER-036 its indistinguishable-failure
 * property for free: a nonexistent order number and a real order number with
 * the wrong phone both produce the same `null`, so the caller cannot even ask
 * which one happened.
 */
export async function findOrderByNumberAndPhone(
  orderNumber: string,
  recipientPhone: string,
  client: OrderClient = prisma
): Promise<OrderWithItems | null> {
  return client.order.findFirst({
    where: { orderNumber, recipientPhone },
    include: ORDER_INCLUDE,
  });
}

/**
 * The order matching BOTH the order number and the presenting guest's own
 * identity (SPEC-ORDER-003 M2 — REQ-ORDER-044, plan.md §3 M2).
 *
 * This is the COOKIE-BYPASS path: a request whose guest cookie already owns
 * the order opens it without presenting the contrast phone value at all
 * (AC-ORDER-048). Same discipline as findOrderForGuest() and
 * findOrderByNumberAndPhone() above — ownership is part of the WHERE, never
 * "fetch by order number then compare guestId in application code".
 */
export async function findOrderByNumberForGuest(
  orderNumber: string,
  guestId: string,
  client: OrderClient = prisma
): Promise<OrderWithItems | null> {
  return client.order.findFirst({
    where: { orderNumber, guestId },
    include: ORDER_INCLUDE,
  });
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
 * The stock those products hold RIGHT NOW, read on the given transaction client
 * (SPEC-ORDER-002 REQ-ORDER-025, plan.md §1).
 *
 * This is a read, but unlike the two above it takes no singleton default. The
 * only caller is the failure path of a decrement that has just been refused,
 * and the figure it needs is the one visible INSIDE that transaction — which is
 * the whole difference between reporting what is true now and repeating the
 * snapshot the transaction opened with. A singleton fallback would quietly read
 * outside the transaction and reintroduce the stale figure this function exists
 * to replace, so the client is required rather than defaulted.
 *
 * Returns the rows as read. Products missing from the result (deleted since the
 * cart was written) simply do not appear; the caller decides what an absent row
 * means rather than having a default invented here.
 */
export async function findStockByProductIds(
  tx: Prisma.TransactionClient,
  productIds: string[]
): Promise<Array<{ id: string; stock: number }>> {
  return tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, stock: true },
  });
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
