import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createAuditLog,
  findAuditLogByTransmissionId,
  findOrderById,
  markOrderCancelledAndRestoreStock,
  markOrderPaid,
  type OrderForPayment,
} from "@/features/payments/repositories/payment-repository";
import { confirmTossPayment, queryTossPayment } from "@/lib/payment/toss-server";
import type {
  ConfirmPaymentResult,
  PaymentStatusChangedPayload,
  ProcessWebhookResult,
} from "@/features/payments/types/payment";

/**
 * SPEC-PAYMENT-001 M2 — confirm(승인) orchestration + webhook processing.
 *
 * Traces: REQ-PAYMENT-004 (paymentKey attribution), REQ-PAYMENT-006/007/008
 * (confirm flow), REQ-PAYMENT-011/012 (Toss Payment Query re-verification —
 * see processWebhook()'s own doc comment for the CodeRabbit PR #9 Finding 1
 * correction), REQ-PAYMENT-013/014 (webhook DONE/CANCELED), REQ-PAYMENT-015
 * (webhook amount mismatch),
 * REQ-PAYMENT-016/017 (idempotency + conditional transition). design.md §2,
 * §3, §3.1, §4, §5.
 *
 * @MX:ANCHOR fan-in target — every confirm redirect and every webhook
 * delivery this SPEC accepts enters the domain through confirmPayment() and
 * processWebhook() respectively; the M3 route handlers call these and nothing
 * else in this feature.
 * @MX:REASON amount verification MUST run before any external confirm-API
 * call (REQ-PAYMENT-006) and before any state transition (REQ-PAYMENT-015) —
 * reordering these checks would extend trust to an unconfirmed value.
 */

type DisambiguationOutcome =
  | { kind: "already-applied"; current: OrderForPayment }
  | { kind: "payment-key-mismatch"; current: OrderForPayment }
  | { kind: "order-not-pending"; current: OrderForPayment | null };

/**
 * design.md §3.1 — when a conditional `updateMany` returns `count !== 1`,
 * this decides whether that is (a) idempotent (another trigger already
 * applied the SAME paymentKey), (b) a genuine paymentKey mismatch, or (c) the
 * order is not in a state this event can act on at all (e.g. cancelled).
 * Re-reads the order via the SAME transaction client `tx`, so both the
 * classification AND the `current` it returns reflect the row as it stands
 * after the racing write — never the stale pre-transaction snapshot.
 */
async function disambiguateNonApplied(
  tx: Prisma.TransactionClient,
  orderId: string,
  incomingPaymentKey: string
): Promise<DisambiguationOutcome> {
  const current = await findOrderById(orderId, tx);
  if (current === null) return { kind: "order-not-pending", current: null };
  if (current.paymentKey === incomingPaymentKey) return { kind: "already-applied", current };
  if (current.status === "cancelled") return { kind: "order-not-pending", current };
  return { kind: "payment-key-mismatch", current };
}

/**
 * REQ-PAYMENT-006/007/008 — orchestrates the confirm(승인) redirect.
 *
 * Ordering is load-bearing: the amount check runs BEFORE any Toss call (an
 * unconfirmed redirect must not be extended trust by calling Toss with its
 * numbers — REQ-PAYMENT-006), and the confirm API call must SUCCEED before
 * any conditional transition is attempted (a failed/absent call must never
 * move Order.status — design.md §4/§8).
 */
export async function confirmPayment(
  orderId: string,
  paymentKey: string,
  amount: number
): Promise<ConfirmPaymentResult> {
  const order = await findOrderById(orderId);
  if (order === null) {
    return { ok: false, code: "ORDER_NOT_PENDING" };
  }

  if (order.totalAmount !== amount) {
    // REQ-PAYMENT-006 — reject before ever calling Toss.
    return { ok: false, code: "AMOUNT_MISMATCH" };
  }

  // Idempotent replay (AC-PAYMENT-008 ii): a second confirm redirect for a
  // payment already recorded under this EXACT paymentKey (e.g. a webhook won
  // the race and applied it first). Toss's confirm API is not re-invoked —
  // there is nothing left to confirm.
  if (order.paymentKey === paymentKey && order.status !== "pending_payment") {
    return { ok: true };
  }

  if (order.status !== "pending_payment") {
    // Not the idempotent-same-key case above, and not pending either — the
    // order moved to a state this redirect cannot act on (e.g. cancelled).
    return { ok: false, code: "ORDER_NOT_PENDING" };
  }

  const confirmed = await confirmTossPayment({ orderId, paymentKey, amount });
  if (!confirmed.ok) {
    // REQ-PAYMENT-008 — leaves Order.status untouched; the shopper can retry.
    return { ok: false, code: "CONFIRM_API_FAILED" };
  }

  return prisma.$transaction(async (tx) => {
    const count = await markOrderPaid(tx, { orderId, paymentKey });
    if (count === 1) {
      await createAuditLog(tx, {
        orderId,
        source: "CONFIRM_API",
        previousStatus: "pending_payment",
        newStatus: "paid",
        paymentKey,
      });
      return { ok: true };
    }

    const outcome = await disambiguateNonApplied(tx, orderId, paymentKey);
    if (outcome.kind === "already-applied") {
      return { ok: true };
    }
    if (outcome.kind === "order-not-pending") {
      return { ok: false, code: "ORDER_NOT_PENDING" };
    }
    const current = outcome.current;
    await createAuditLog(tx, {
      orderId,
      source: "CONFIRM_API",
      previousStatus: current.status,
      newStatus: current.status,
      paymentKey,
    });
    return { ok: false, code: "PAYMENT_KEY_MISMATCH" };
  });
}

/**
 * REQ-PAYMENT-011/012/013/014/015/016 — re-verifies, then processes, one
 * webhook delivery. Ordering is load-bearing throughout:
 *
 * 1. The transmissionId lookup runs FIRST (design.md §3) — a resend
 *    short-circuits before parsing the payload or calling Toss at all.
 * 2. The payload is parsed only to extract `paymentKey` — the field used to
 *    ask Toss which payment to look up. Nothing else in the parsed payload
 *    is trusted (CodeRabbit PR #9 Finding 1 correction, below).
 * 3. `queryTossPayment` re-fetches the authoritative record from Toss's own
 *    servers. Every downstream decision (orderId, amount, status) is driven
 *    by THIS record, never by the webhook payload's own claims.
 * 4. The amount check runs BEFORE any transition (REQ-PAYMENT-015).
 *
 * CORRECTION (Finding 1): earlier versions of this function gated on an
 * HMAC-SHA256 signature header. Toss's own docs confirm the general
 * PAYMENT_STATUS_CHANGED webhook carries no such header — only
 * payout.changed/seller.changed webhooks do — so a signature check here was
 * always a no-op the payload could never satisfy honestly. Toss's documented
 * recommendation is exactly the query-and-compare flow implemented below.
 *
 * Every `ok: true` outcome answers PG with 200 — PG must be told "received"
 * even for a duplicate or a rejected event, or it will keep retrying
 * (design.md §3). A `toss-query-failed` `ok: false` is transient (PG should
 * retry); `malformed-payload` and `query-mismatch` are not.
 */
export async function processWebhook(
  rawBody: string,
  headers: { transmissionId: string }
): Promise<ProcessWebhookResult> {
  const existingLog = await findAuditLogByTransmissionId(headers.transmissionId);
  if (existingLog !== null) {
    return { ok: true, outcome: "already-applied" };
  }

  let payload: PaymentStatusChangedPayload;
  try {
    payload = JSON.parse(rawBody) as PaymentStatusChangedPayload;
  } catch {
    return { ok: false, reason: "malformed-payload" };
  }

  const queried = await queryTossPayment(payload.paymentKey);
  if (!queried.ok) {
    return { ok: false, reason: "toss-query-failed" };
  }

  if (queried.payment.orderId !== payload.orderId) {
    // Toss's own record disagrees with what the webhook claimed — reject
    // without trusting either side.
    return { ok: false, reason: "query-mismatch" };
  }

  const order = await findOrderById(queried.payment.orderId);
  if (order === null) {
    return { ok: true, outcome: "order-not-pending" };
  }

  if (order.totalAmount !== queried.payment.totalAmount) {
    // REQ-PAYMENT-015 — logged, no transition. Both statuses are the
    // CURRENT one: nothing actually changed.
    await createAuditLog(prisma, {
      orderId: queried.payment.orderId,
      source: "WEBHOOK",
      previousStatus: order.status,
      newStatus: order.status,
      paymentKey: queried.payment.paymentKey,
      transmissionId: headers.transmissionId,
    });
    return { ok: true, outcome: "amount-mismatch" };
  }

  if (queried.payment.status === "DONE") {
    return prisma.$transaction(async (tx) => {
      const count = await markOrderPaid(tx, {
        orderId: queried.payment.orderId,
        paymentKey: queried.payment.paymentKey,
      });
      if (count === 1) {
        await createAuditLog(tx, {
          orderId: queried.payment.orderId,
          source: "WEBHOOK",
          previousStatus: "pending_payment",
          newStatus: "paid",
          paymentKey: queried.payment.paymentKey,
          transmissionId: headers.transmissionId,
        });
        return { ok: true, outcome: "paid" };
      }

      const outcome = await disambiguateNonApplied(tx, queried.payment.orderId, queried.payment.paymentKey);
      if (outcome.kind === "already-applied") {
        return { ok: true, outcome: "already-applied" };
      }
      const current = outcome.current ?? order;
      await createAuditLog(tx, {
        orderId: queried.payment.orderId,
        source: "WEBHOOK",
        previousStatus: current.status,
        newStatus: current.status,
        paymentKey: queried.payment.paymentKey,
        transmissionId: headers.transmissionId,
      });
      return {
        ok: true,
        outcome: outcome.kind === "payment-key-mismatch" ? "payment-key-mismatch" : "order-not-pending",
      } as const;
    });
  }

  if (queried.payment.status === "CANCELED") {
    // Finding 2 — never cancel on a paymentKey the stored order does not
    // itself carry, even though the QUERIED record already names this exact
    // paymentKey. Defence in depth: guards the case where the order's own
    // paymentKey was never actually attributed to this value (e.g. a cancel
    // arriving before any confirm/DONE ever attributed it).
    if (order.paymentKey !== queried.payment.paymentKey) {
      return { ok: true, outcome: "payment-key-mismatch" };
    }

    return prisma.$transaction(async (tx) => {
      const count = await markOrderCancelledAndRestoreStock(tx, queried.payment.orderId);
      if (count === 1) {
        await createAuditLog(tx, {
          orderId: queried.payment.orderId,
          source: "WEBHOOK",
          previousStatus: "paid",
          newStatus: "cancelled",
          paymentKey: queried.payment.paymentKey,
          transmissionId: headers.transmissionId,
        });
        return { ok: true, outcome: "cancelled" };
      }
      // count !== 1 — the order was not `paid` (e.g. cancel arrived for a
      // still-pending order, or a second delivery of the same cancellation
      // under a different transmissionId). Idempotent no-op; nothing to log.
      return { ok: true, outcome: "order-not-pending" };
    });
  }

  if (queried.payment.status === "PARTIAL_CANCELED") {
    // Finding 3 — this SPEC does not model partial cancellation (plan.md
    // scope). Recorded via an audit-log entry with no actual transition —
    // deliberately NOT routed into the full-cancellation path above, which
    // would over-restore stock and wrongly mark a still-partially-paid order
    // as fully cancelled.
    await createAuditLog(prisma, {
      orderId: queried.payment.orderId,
      source: "WEBHOOK",
      previousStatus: order.status,
      newStatus: order.status,
      paymentKey: queried.payment.paymentKey,
      transmissionId: headers.transmissionId,
    });
    return { ok: true, outcome: "unhandled" };
  }

  // An event this SPEC does not act on (spec.md §3 — out-of-scope statuses).
  return { ok: true, outcome: "order-not-pending" };
}
