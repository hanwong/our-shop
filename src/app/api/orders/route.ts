import { NextResponse } from "next/server";

import { buildGuestCartCookie } from "@/lib/auth/guest-identity";
import { resolveCartIdentity } from "@/features/cart/services/cart-service";
import { createOrder } from "@/features/orders/services/order-service";

/**
 * SPEC-ORDER-001 M4 — POST /api/orders (create a guest order).
 *
 * Traces: REQ-ORDER-007 (no credentials required), REQ-ORDER-010 (400 naming
 * the invalid fields, nothing persisted), REQ-ORDER-013/014/015 (the 409
 * refusals), REQ-ORDER-016 (a replay returns the first order), REQ-ORDER-021
 * (a member submission is refused).
 *
 * This is the ONLY place in the SPEC where an identity is decided, and it does
 * so by calling SPEC-CART-001's resolveCartIdentity() rather than reimplementing
 * the rules — so the order endpoint and the cart endpoints can never disagree
 * about who a request is (design.md §6.2). The read paths (the two checkout
 * screens) decide nothing at all: they read one cookie.
 *
 * The member guard sits FIRST, before the body is even parsed, because it must
 * not open a transaction (AC-ORDER-022 (e)) and because refusing early is the
 * cheapest correct answer.
 */
export async function POST(request: Request): Promise<Response> {
  const { identity, issuedGuestId } = await resolveCartIdentity(request);

  // REQ-ORDER-021. A member's credentials are VALID here — they are simply for
  // an identity this scope cannot serve, so this is 409 rather than 401/403:
  // logging in again would produce the same answer (design.md §8).
  //
  // Refusing is deliberately preferred over silently demoting the request to
  // its guest cookie. A demoted order would be attributed to a guest id the
  // member no longer presents (login expires it), leaving them with an order
  // they could never open — the exact defect the guest-only scope exists to
  // avoid (spec.md §3).
  if (identity.kind === "user") {
    return NextResponse.json(
      {
        error: "회원 체크아웃은 아직 제공되지 않습니다",
        code: "MEMBER_CHECKOUT_UNSUPPORTED",
      },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON never reaches the domain — the same shape the cart and
    // auth routes already use for an unparseable body.
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await createOrder(identity.guestId, body);

  // The service's failure object IS design.md §8's response body, minus the
  // two discriminants. Destructuring it rather than rebuilding it field by
  // field keeps the service the single owner of that table: a new refusal shape
  // needs no edit here, and no refusal can drift between the two files.
  //
  // 201 on success because this request created a resource. A replay answers
  // 201 as well — the outcome IS the same created order, which is the whole
  // point of REQ-ORDER-016.
  let response: NextResponse;
  if (result.ok) {
    response = NextResponse.json(result.data, { status: 201 });
  } else {
    const { ok, status, ...failure } = result;
    void ok;
    response = NextResponse.json(failure, { status });
  }

  // design.md §6.2: a request that presented no guest cookie was just given an
  // identity. That identity owns no cart, so the order above was refused with
  // CART_EMPTY — but the cookie is still attached, so this visitor's next add
  // lands under the same identity instead of minting another.
  if (issuedGuestId !== null) {
    const cookie = buildGuestCartCookie(issuedGuestId);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}
