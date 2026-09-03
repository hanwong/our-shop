import { NextResponse } from "next/server";

import { checkIpRateLimit } from "@/lib/auth/rate-limit";
import { lookupOrderByNumberAndPhone } from "@/features/orders/services/order-service";

/**
 * SPEC-ORDER-003 M2/M3 — POST /api/orders/lookup (guest revisit lookup).
 *
 * Traces: REQ-ORDER-034 ~ 037 (the auth rule and failure surface, decided
 * entirely by lookupOrderByNumberAndPhone() — this route decides nothing),
 * REQ-ORDER-043 (a format failure answers with per-field errors), M3's
 * REQ-ORDER-037 (rate limit, AC-ORDER-041) and REQ-ORDER-039 (response
 * redaction, AC-ORDER-043).
 *
 * This route is a THIN forwarder, the same shape as POST /api/orders
 * (src/app/api/orders/route.ts): parse the body, hand it to the service, and
 * turn the service's result into a response by destructuring off the
 * discriminant / internal fields it needs and no others. Most of what this
 * SPEC requires is decided one layer down, already tested at the service seam
 * (tests/unit/orders/order-service.test.ts) — REQ-ORDER-036's
 * indistinguishable-failure property and REQ-ORDER-043's field-error mapping.
 * Two things ARE this route's own job, added in M3:
 *
 *  - AC-ORDER-041 — the rate-limit check runs FIRST, before any body parsing
 *    or service call, reusing checkIpRateLimit() exactly as
 *    src/app/api/auth/login/route.ts already does (REQ-AUTH-021's policy,
 *    not a new one — §0 AC-041-EXCL-RATELIMIT).
 *  - AC-ORDER-043 — `id` is the one field OrderDTO's declared type DOES carry
 *    that this guest-facing screen must not (checkout/complete needs it
 *    there; this screen never should). paymentKey / idempotencyKey / guestId
 *    are already absent from OrderDTO's type, so stripping them here is
 *    defense-in-depth against a future service-layer regression, not a fix
 *    for anything the type system currently allows through.
 */
export async function POST(request: Request): Promise<Response> {
  if (!checkIpRateLimit("orders-lookup", request).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured off to strip them from the response (AC-ORDER-043)
    const { id, paymentKey, idempotencyKey, guestId, ...safeData } = result.data as unknown as Record<
      string,
      unknown
    >;
    return NextResponse.json(safeData, { status: 200 });
  }

  const { ok, status, ...failure } = result;
  void ok;
  return NextResponse.json(failure, { status });
}
