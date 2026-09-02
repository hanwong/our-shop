import { NextResponse } from "next/server";

import { confirmPayment } from "@/features/payments/services/payment-service";

/**
 * SPEC-PAYMENT-001 M3 — GET /api/payments/confirm (Toss successUrl target).
 *
 * Traces: REQ-PAYMENT-006/007/008 (confirm orchestration, delegated to
 * confirmPayment()). plan.md §3 M3, design.md §6 (successUrl is a server
 * route — approval is not yet confirmed at redirect time) + §8 (failure
 * redirects carry `?payment_failed=1`).
 *
 * This handler is a thin adapter: it parses the three redirect query params
 * and forwards them AS-IS to confirmPayment(), which re-verifies the amount
 * against Order.totalAmount before ever calling Toss (design.md §4). No
 * domain decision is made here — the query params are not trusted, only
 * relayed.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const paymentKey = url.searchParams.get("paymentKey") ?? "";
  const orderId = url.searchParams.get("orderId") ?? "";
  const amount = Number(url.searchParams.get("amount"));

  const result = await confirmPayment(orderId, paymentKey, amount);

  const destination = result.ok
    ? `/checkout/complete/${orderId}`
    : `/checkout/complete/${orderId}?payment_failed=1`;

  return NextResponse.redirect(new URL(destination, request.url));
}
