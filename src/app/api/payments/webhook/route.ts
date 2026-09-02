import { NextResponse } from "next/server";

import { processWebhook } from "@/features/payments/services/payment-service";

/**
 * SPEC-PAYMENT-001 M3 — POST /api/payments/webhook (Toss PAYMENT_STATUS_CHANGED).
 *
 * Traces: REQ-PAYMENT-011/012 (Toss Payment Query re-verification, delegated
 * to processWebhook()). plan.md §3 M3, design.md §5.
 *
 * `request.text()` is read FIRST — this handler never calls `request.json()`
 * itself. JSON.parse happens inside processWebhook(), and only to extract
 * the paymentKey used to query Toss's own Payment Query API — the queried
 * record, not the parsed payload, is what actually drives any state
 * transition (CodeRabbit PR #9 Finding 1 correction: PAYMENT_STATUS_CHANGED
 * carries no verifiable signature header for this handler to check, so the
 * payload alone is never trusted).
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const result = await processWebhook(rawBody, {
    transmissionId: request.headers.get("tosspayments-webhook-transmission-id") ?? "",
  });

  if (result.ok) {
    // Every success outcome — paid, cancelled, already-applied, amount-
    // mismatch, payment-key-mismatch, order-not-pending, unhandled — is a
    // 200 to PG: design.md §3/§8, PG must be told "received" even for a
    // duplicate or a rejected event, or it will keep retrying.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // "toss-query-failed" is transient (network/timeout, or Toss itself
  // erroring) — a 5xx tells PG's retry policy this delivery may succeed on a
  // later retry. "malformed-payload" / "query-mismatch" are permanent for
  // this exact delivery — a 400 tells PG not to retry the same bytes.
  const status = result.reason === "toss-query-failed" ? 502 : 400;
  return NextResponse.json({ ok: false }, { status });
}
