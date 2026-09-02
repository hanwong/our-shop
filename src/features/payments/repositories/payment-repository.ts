import type { OrderStatus, Prisma, PaymentEventSource } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * SPEC-PAYMENT-001 M2 — Prisma query layer for the payment domain.
 *
 * Traces: REQ-PAYMENT-001 (one audit-log row per transition), REQ-PAYMENT-002
 * (append-only — no update/delete export on PaymentAuditLog), REQ-PAYMENT-004
 * (paymentKey attribution lookup), REQ-PAYMENT-014 (cancel restores stock in
 * the SAME transaction), REQ-PAYMENT-016/017 (idempotency + the conditional-
 * transition shape). design.md §2, §2.1, §3.
 *
 * This is a NEW module rather than an extension of
 * src/features/orders/repositories/order-repository.ts (design.md §2.1):
 * that file's every write runs inside the order-CREATION transaction, and
 * adding a payment transition there would break that invariant. This module
 * therefore performs its OWN Prisma queries for order lookups — it does not
 * import from the orders feature (plan.md §4 PRESERVE list).
 *
 * Like features/cart/repositories/*, this layer performs NO validation and
 * applies NO defaults — it trusts its arguments. Validation, amount checks
 * and failure-code mapping live one layer up in services/payment-service.ts.
 *
 * @MX:ANCHOR fan-in target — every payment state transition in this SPEC
 * writes through markOrderPaid / markOrderCancelledAndRestoreStock, and every
 * audit trail write goes through createAuditLog.
 * @MX:REASON PaymentAuditLog's append-only invariant (REQ-PAYMENT-002) is
 * held HERE, at the application layer, by never exporting an update/delete/
 * upsert function for it (design.md §1.2) — not by a DB trigger. A reader
 * adding a mutator here would silently break that invariant.
 */

/**
 * A client capable of running these queries: the module singleton below, or
 * the one `prisma.$transaction` hands its callback — both satisfy
 * `Prisma.TransactionClient` (same pattern as cart-repository.ts's
 * `CartClient`), so no union type is needed.
 */
type PaymentClient = Prisma.TransactionClient;

export interface OrderForPayment {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  paymentKey: string | null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The order fields the payment domain needs: current status (to decide
 * whether a transition applies), totalAmount (REQ-PAYMENT-006/015's amount
 * check), and paymentKey (REQ-PAYMENT-004's attribution check).
 *
 * `client` defaults to the module singleton so a plain pre-transaction lookup
 * (the service's amount check) needs no transaction; passing the transaction
 * client re-reads the CURRENT row from inside the transaction for the
 * count!==1 disambiguation procedure (design.md §3.1).
 */
export async function findOrderById(
  orderId: string,
  client: PaymentClient = prisma
): Promise<OrderForPayment | null> {
  return client.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, totalAmount: true, paymentKey: true },
  });
}

/**
 * The second idempotency defence (design.md §3): a webhook resend carries the
 * SAME transmissionId, so looking this up BEFORE re-running any processing
 * logic is what lets a duplicate delivery short-circuit to a no-op.
 */
export async function findAuditLogByTransmissionId(
  transmissionId: string,
  client: PaymentClient = prisma
): Promise<{ id: string } | null> {
  return client.paymentAuditLog.findUnique({
    where: { transmissionId },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// Conditional transitions (REQ-PAYMENT-017 — always `updateMany` with a
// status precondition, never an unconditional `update`)
// ---------------------------------------------------------------------------

/**
 * pending_payment -> paid (confirm-API path and DONE-webhook path share this
 * function). The `count` this returns is not a boolean success/fail — `1`
 * means this call performed the transition, `0` means it did not (already
 * applied by a racing trigger, or the order was not pending). Distinguishing
 * those two `0` causes is design.md §3.1's job, done by the caller via a
 * fresh findOrderById() re-read — never thrown as an error here (plan.md §6).
 */
export async function markOrderPaid(
  tx: PaymentClient,
  args: { orderId: string; paymentKey: string }
): Promise<number> {
  const updated = await tx.order.updateMany({
    where: { id: args.orderId, status: "pending_payment" },
    data: { status: "paid", paymentKey: args.paymentKey },
  });
  return updated.count;
}

/**
 * paid -> cancelled, restoring every line's stock, all inside the transaction
 * `tx` already belongs to (REQ-PAYMENT-014, design.md §0#4/§2). Stock is only
 * touched when the conditional transition actually applied (`count === 1`) —
 * a duplicate or too-early cancel event does nothing, matching the acceptance
 * edge case where a CANCELED webhook arrives for a still-pending order.
 *
 * Items are read via `tx.orderItem`, not via order-repository.ts (plan.md §4
 * PRESERVE) — the payment domain does its own Prisma queries for order data.
 */
export async function markOrderCancelledAndRestoreStock(
  tx: PaymentClient,
  orderId: string
): Promise<number> {
  const updated = await tx.order.updateMany({
    where: { id: orderId, status: "paid" },
    data: { status: "cancelled" },
  });
  if (updated.count !== 1) return updated.count;

  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true },
  });
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
  return updated.count;
}

// ---------------------------------------------------------------------------
// Writes — PaymentAuditLog. `create` ONLY. No update/delete/upsert is
// exported for PaymentAuditLog anywhere in this module (REQ-PAYMENT-002,
// AC-PAYMENT-002's static check).
// ---------------------------------------------------------------------------

export interface CreateAuditLogArgs {
  orderId: string;
  source: PaymentEventSource;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  paymentKey: string | null;
  /** Absent for confirm-path events — only a webhook delivery carries one. */
  transmissionId?: string | null;
}

/** Appends exactly one immutable transition record (REQ-PAYMENT-001). */
export async function createAuditLog(
  client: PaymentClient,
  args: CreateAuditLogArgs
): Promise<{ id: string }> {
  return client.paymentAuditLog.create({
    data: {
      orderId: args.orderId,
      source: args.source,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus,
      paymentKey: args.paymentKey,
      transmissionId: args.transmissionId ?? null,
    },
    select: { id: true },
  });
}
