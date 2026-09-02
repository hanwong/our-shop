import type { PaymentEventSource } from "@prisma/client";

/**
 * SPEC-PAYMENT-001 M2 — wire/DTO types for the payment domain.
 *
 * Traces: REQ-PAYMENT-001 (audit-log source), REQ-PAYMENT-004/006/008/015
 * (failure/outcome classification for confirm and webhook). design.md §1,
 * §3.1, §4, §8.
 */

/** Mirrors the Prisma PaymentEventSource enum ("CONFIRM_API" | "WEBHOOK"). */
export type PaymentEventSourceDTO = PaymentEventSource;

/**
 * confirmPayment()'s failure classification (design.md §8):
 * - AMOUNT_MISMATCH — the redirect's amount disagrees with Order.totalAmount;
 *   the confirm API is never called (REQ-PAYMENT-006).
 * - ORDER_NOT_PENDING — the order does not exist, or is in a state this event
 *   cannot act on (e.g. already cancelled) — distinct from a genuine
 *   paymentKey mismatch.
 * - PAYMENT_KEY_MISMATCH — the order is already attributed to a DIFFERENT
 *   paymentKey (REQ-PAYMENT-004).
 * - CONFIRM_API_FAILED — Toss's confirm API call itself failed; the order
 *   stays pending_payment and is retryable (REQ-PAYMENT-008).
 */
export type ConfirmPaymentFailureCode =
  | "AMOUNT_MISMATCH"
  | "ORDER_NOT_PENDING"
  | "PAYMENT_KEY_MISMATCH"
  | "CONFIRM_API_FAILED";

export type ConfirmPaymentResult =
  | { ok: true }
  | { ok: false; code: ConfirmPaymentFailureCode };

/**
 * processWebhook()'s outcome classification. Every outcome except a signature
 * failure answers PG with 200 (design.md §3 — a duplicate or a rejected event
 * is still "received", so PG must not be told to retry it).
 */
export type WebhookOutcome =
  | "paid"
  | "cancelled"
  | "already-applied"
  | "amount-mismatch"
  | "payment-key-mismatch"
  | "order-not-pending";

export type ProcessWebhookResult =
  | { ok: true; outcome: WebhookOutcome }
  | { ok: false; reason: "invalid-signature" | "malformed-payload" };

/**
 * The subset of Toss's PAYMENT_STATUS_CHANGED webhook payload this SPEC reads
 * (research.md §4). `status` carries other values (e.g. PARTIAL_CANCELED,
 * which this SPEC also treats as a cancellation signal) beyond the two this
 * type names explicitly — the trailing `string` keeps those assignable.
 */
export interface PaymentStatusChangedPayload {
  orderId: string;
  paymentKey: string;
  amount: number;
  status: "DONE" | "CANCELED" | "PARTIAL_CANCELED" | string;
}
