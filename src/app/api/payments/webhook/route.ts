import { NextResponse } from "next/server";

import { processWebhook } from "@/features/payments/services/payment-service";
import { checkIpRateLimit } from "@/lib/auth/rate-limit";

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
 *
 * CORRECTION (CodeRabbit PR #9 round-2 Finding B, CWE-400): this is a public,
 * unauthenticated endpoint, and every unique transmissionId previously
 * triggered an authenticated `queryTossPayment` call (consuming Toss API
 * quota) with no throttle. `checkIpRateLimit` (the existing rate-limit
 * utility, unmodified — read-only reuse) runs FIRST, before any body parsing
 * or Toss call, exactly as `src/app/api/auth/login/route.ts` gates its own
 * body first.
 */
export async function POST(request: Request): Promise<Response> {
  if (!checkIpRateLimit("payments-webhook", request).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
