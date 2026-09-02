/**
 * SPEC-PAYMENT-001 M2 — server-only Toss Payments adapter.
 *
 * Two isolated concerns, both authenticated with Basic auth via
 * PG_SECRET_KEY: the confirm(승인) API call, and the Payment Query API used
 * to re-verify a webhook's claimed payment against Toss's own record.
 * Traces: REQ-PAYMENT-007/008 (confirm), REQ-PAYMENT-011/012 (webhook
 * re-verification via server-to-server query). design.md §5, research.md
 * §3/§4.
 *
 * MUST NOT import anything from next/* (plan.md M2) — called from the
 * confirm/webhook route handlers (M3) but must stay usable outside the
 * Next.js request lifecycle (e.g. from this module's own tests).
 *
 * CORRECTION (addresses CodeRabbit PR #9 review, Finding 1): the general
 * PAYMENT_STATUS_CHANGED webhook does NOT carry a
 * tosspayments-webhook-signature header — Toss sends that header only for
 * payout.changed / seller.changed webhooks
 * (https://docs.tosspayments.com/reference/using-api/webhook-events). This
 * module therefore no longer exposes an HMAC signature verifier. Instead,
 * `queryTossPayment` re-fetches the authoritative payment record from
 * Toss's Payment Query API using the paymentKey the webhook names — Toss's
 * own documented recommendation for verifying this event type — so a
 * webhook's claimed status/amount is never trusted directly.
 */

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";
const TOSS_PAYMENT_QUERY_URL = "https://api.tosspayments.com/v1/payments";

/**
 * A hung Toss response must not hang the caller indefinitely — the shopper's
 * confirm redirect, or a webhook delivery, both need a bounded wait so the
 * caller can fail (and retry) rather than stall (Finding 4).
 */
const TOSS_REQUEST_TIMEOUT_MS = 10_000;

function tossBasicAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export interface TossConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export type TossConfirmResult = { ok: true } | { ok: false; status: number };

/**
 * Calls Toss's confirm(승인) API (research.md §3) with Basic auth built from
 * PG_SECRET_KEY. The secret is read at CALL time, not at module load, so a
 * missing env var surfaces as an ordinary call-time failure rather than
 * throwing on import (which would crash every test that merely imports this
 * module before setting the env var).
 *
 * The request carries a 10s timeout (`AbortSignal.timeout`); a timeout or
 * any other network failure is caught and reported as an ordinary failure
 * result — never a thrown exception — so the shopper's redirect flow can
 * retry instead of hanging (Finding 4).
 */
export async function confirmTossPayment(req: TossConfirmRequest): Promise<TossConfirmResult> {
  const secretKey = process.env.PG_SECRET_KEY;
  if (!secretKey) return { ok: false, status: 500 };

  let response: Response;
  try {
    response = await fetch(TOSS_CONFIRM_URL, {
      method: "POST",
      headers: {
        Authorization: tossBasicAuthHeader(secretKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(TOSS_REQUEST_TIMEOUT_MS),
      // CodeRabbit PR #9 round-2 Finding C (CWE-319) — never follow a
      // redirect on a request carrying the Authorization: Basic PG_SECRET_KEY
      // header. Without this, a response that redirected to an unintended
      // host could have the secret-bearing header replayed there.
      redirect: "error",
    });
  } catch {
    // Timeout (AbortSignal.timeout aborts the fetch) or a network-level
    // failure — neither carries an HTTP status. 504 (Gateway Timeout) is the
    // closest honest status; the caller only checks `ok`, not this number.
    return { ok: false, status: 504 };
  }

  return response.ok ? { ok: true } : { ok: false, status: response.status };
}

export interface TossPaymentRecord {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
}

export type TossQueryResult =
  | { ok: true; payment: TossPaymentRecord }
  | { ok: false; status: number };

/**
 * Toss's Payment Query API (research.md §4 correction) — `GET
 * /v1/payments/{paymentKey}`, the same Basic auth as the confirm call. This
 * is the ONLY trustworthy source of a PAYMENT_STATUS_CHANGED webhook's
 * status and amount: the webhook payload carries no verifiable signature
 * for this event type, so `processWebhook()` in payment-service.ts drives
 * every decision from the record this returns, never from the payload's own
 * claims (design.md §5).
 *
 * Same timeout/failure-result discipline as `confirmTossPayment` — a hung or
 * failed query must not hang webhook processing, and is reported as an
 * ordinary failure result rather than a thrown exception.
 */
export async function queryTossPayment(paymentKey: string): Promise<TossQueryResult> {
  const secretKey = process.env.PG_SECRET_KEY;
  if (!secretKey) return { ok: false, status: 500 };

  let response: Response;
  try {
    response = await fetch(`${TOSS_PAYMENT_QUERY_URL}/${encodeURIComponent(paymentKey)}`, {
      method: "GET",
      headers: { Authorization: tossBasicAuthHeader(secretKey) },
      signal: AbortSignal.timeout(TOSS_REQUEST_TIMEOUT_MS),
      // CodeRabbit PR #9 round-2 Finding C (CWE-319) — same rationale as
      // confirmTossPayment above: never follow a redirect on a request
      // carrying the Authorization: Basic PG_SECRET_KEY header.
      redirect: "error",
    });
  } catch {
    return { ok: false, status: 504 };
  }

  if (!response.ok) return { ok: false, status: response.status };

  let body: { paymentKey: string; orderId: string; status: string; totalAmount: number };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Toss returned 2xx but a non-JSON/unparseable body — treat the same as
    // any other query failure rather than throwing out of this adapter.
    return { ok: false, status: 502 };
  }

  return {
    ok: true,
    payment: {
      paymentKey: body.paymentKey,
      orderId: body.orderId,
      status: body.status,
      totalAmount: body.totalAmount,
    },
  };
}
