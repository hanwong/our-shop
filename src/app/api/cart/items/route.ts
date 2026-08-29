import { NextResponse } from "next/server";
import { buildGuestCartCookie } from "@/lib/auth/guest-identity";
import { addItem, resolveCartIdentity } from "@/features/cart/services/cart-service";

/**
 * SPEC-CART-001 M4 — POST /api/cart/items (add to cart).
 *
 * Traces: REQ-CART-006 (adding a product already in the cart INCREMENTS its
 * line rather than creating a second one), REQ-CART-007 (400 for an unknown
 * product, a non-positive-integer quantity, or a result above stock, with
 * nothing persisted), REQ-CART-014 (no credentials required).
 *
 * Responds with the WHOLE cart rather than the single line it touched
 * (plan.md §3), so a client can redraw without a follow-up GET.
 */
export async function POST(request: Request): Promise<Response> {
  const { identity, issuedGuestId } = await resolveCartIdentity(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON never reaches the service — same shape as
    // login/route.ts's body guard.
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await addItem(identity, (body ?? {}) as { productId?: unknown; quantity?: unknown });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json(result.data, { status: 200 });
  if (issuedGuestId !== null) {
    const cookie = buildGuestCartCookie(issuedGuestId);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
