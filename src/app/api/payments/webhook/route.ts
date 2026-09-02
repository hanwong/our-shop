import { NextResponse } from "next/server";

import { processWebhook } from "@/features/payments/services/payment-service";

/**
 * SPEC-PAYMENT-001 M3 — POST /api/payments/webhook (Toss PAYMENT_STATUS_CHANGED).
 *
 * Traces: REQ-PAYMENT-011/012 (signature gate, delegated to processWebhook()).
 * plan.md §3 M3, design.md §5.
 *
 * `request.text()` is read FIRST — before any header parsing side effect
 * that could be confused for JSON handling, and well before anything that
 * would parse the body. The raw bytes are the only thing the HMAC signature
 * was computed over; a `request.json()` round-trip can re-order keys or
 * change whitespace and silently break the signature (design.md §5). This
 * handler never calls `request.json()` itself — JSON.parse happens inside
 * processWebhook(), and only after signature verification passes.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const result = await processWebhook(rawBody, {
    transmissionTime: request.headers.get("tosspayments-webhook-transmission-time") ?? "",
    signature: request.headers.get("tosspayments-webhook-signature") ?? "",
    transmissionId: request.headers.get("tosspayments-webhook-transmission-id") ?? "",
  });

  // Every outcome except an invalid signature (or a malformed post-signature
  // payload) is a 200 to PG — design.md §3/§8: PG must be told "received"
  // even for a duplicate or a rejected event, or it will keep retrying.
  return NextResponse.json({ ok: result.ok }, { status: result.ok ? 200 : 401 });
}
