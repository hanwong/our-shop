import { NextResponse } from "next/server";

import { lookupOrderByNumberAndPhone } from "@/features/orders/services/order-service";

/**
 * SPEC-ORDER-003 M2 — POST /api/orders/lookup (guest revisit lookup).
 *
 * Traces: REQ-ORDER-034 ~ 037 (the auth rule and failure surface, decided
 * entirely by lookupOrderByNumberAndPhone() — this route decides nothing),
 * REQ-ORDER-043 (a format failure answers with per-field errors).
 *
 * This route is a THIN forwarder, the same shape as POST /api/orders
 * (src/app/api/orders/route.ts): parse the body, hand it to the service, and
 * turn the service's result into a response by destructuring off the two
 * discriminant fields (`ok`, `status`) it needs and no others. No requirement
 * this SPEC states is decided here — REQ-ORDER-036's indistinguishable-failure
 * property and REQ-ORDER-043's field-error mapping both live one layer down,
 * already tested at the service seam (tests/unit/orders/order-service.test.ts).
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON never reaches the domain — the same shape POST
    // /api/orders already uses for an unparseable body.
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const result = await lookupOrderByNumberAndPhone({
    orderNumber: typeof input.orderNumber === "string" ? input.orderNumber : "",
    recipientPhone: typeof input.recipientPhone === "string" ? input.recipientPhone : "",
  });

  if (result.ok) {
    return NextResponse.json(result.data, { status: 200 });
  }

  const { ok, status, ...failure } = result;
  void ok;
  return NextResponse.json(failure, { status });
}
