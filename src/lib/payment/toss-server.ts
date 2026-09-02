import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * SPEC-PAYMENT-001 M2 — server-only Toss Payments adapter.
 *
 * Two isolated concerns: the confirm(승인) API call (Basic auth via
 * PG_SECRET_KEY) and webhook signature verification (HMAC-SHA256 via
 * PG_WEBHOOK_SECRET). Traces: REQ-PAYMENT-007/008 (confirm), REQ-PAYMENT-
 * 011/012 (signature verification). design.md §5, research.md §3/§4.
 *
 * MUST NOT import anything from next/* (plan.md M2) — called from the
 * confirm/webhook route handlers (M3) but must stay usable outside the
 * Next.js request lifecycle (e.g. from this module's own tests).
 */

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

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
 */
export async function confirmTossPayment(req: TossConfirmRequest): Promise<TossConfirmResult> {
  const secretKey = process.env.PG_SECRET_KEY;
  if (!secretKey) return { ok: false, status: 500 };

  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  const response = await fetch(TOSS_CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  return response.ok ? { ok: true } : { ok: false, status: response.status };
}

export interface WebhookSignatureHeaders {
  transmissionTime: string;
  signature: string;
}

/**
 * Verifies a webhook's HMAC-SHA256 signature over the RAW request body
 * (design.md §5 — never over a re-serialized JSON.parse result, whose key
 * order and whitespace can differ from the bytes Toss actually signed).
 *
 * `timingSafeEqual` guards the comparison against a timing side-channel; the
 * length check before it is required because `timingSafeEqual` THROWS on
 * mismatched buffer lengths rather than returning false.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: WebhookSignatureHeaders
): boolean {
  const secret = process.env.PG_WEBHOOK_SECRET;
  if (!secret) return false;

  const message = `${headers.transmissionTime}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(message).digest("base64");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(headers.signature);
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
