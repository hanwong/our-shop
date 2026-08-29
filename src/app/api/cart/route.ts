import { NextResponse } from "next/server";
import { buildGuestCartCookie } from "@/lib/auth/guest-identity";
import { getCart, resolveCartIdentity } from "@/features/cart/services/cart-service";

/**
 * SPEC-CART-001 M4 — GET /api/cart (the current cart, member or guest).
 *
 * Traces: REQ-CART-005 (items plus a subtotal computed from current prices),
 * REQ-CART-003 (identity resolution), REQ-CART-014 (no credentials required).
 *
 * Note there is no 401 branch anywhere below: an anonymous request is not an
 * unauthorized one, it is a guest, and the response teaches the browser who
 * that guest is by way of the Set-Cookie header. Setting that cookie is not
 * optional bookkeeping — without it the browser presents no id next time, gets
 * another fresh one, and appears to lose its cart on every request.
 *
 * The cookie is set inline rather than through a shared helper because a
 * Next.js route module may only export HTTP method handlers; the three-line
 * `response.cookies.set(...)` shape matches what login/route.ts and
 * google/callback/route.ts already do with theirs.
 */
export async function GET(request: Request): Promise<Response> {
  const { identity, issuedGuestId } = await resolveCartIdentity(request);

  const cart = await getCart(identity);

  const response = NextResponse.json(cart, { status: 200 });
  if (issuedGuestId !== null) {
    const cookie = buildGuestCartCookie(issuedGuestId);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
