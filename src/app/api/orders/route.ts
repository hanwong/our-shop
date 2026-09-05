import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  buildGuestCartCookie,
  generateGuestCartId,
  readGuestCartId,
} from "@/lib/auth/guest-identity";
import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveSession } from "@/lib/auth/session-resolver";
import { createOrder } from "@/features/orders/services/order-service";
import type { OrderOwner } from "@/features/orders/types/order";

/**
 * SPEC-ORDER-001 M4 / SPEC-ORDER-004 M2 — POST /api/orders (create an order for
 * a member OR a guest).
 *
 * Traces: REQ-ORDER-051 (resolveSession decides membership), REQ-ORDER-053
 * (no session ⇒ guest, cookie read or minted), REQ-ORDER-055 (an Authorization
 * header is never grounds for member treatment here), REQ-ORDER-056 (the 409
 * member refusal is gone), REQ-ORDER-064 (CSRF gates the member path before the
 * transaction), REQ-ORDER-065 (guest behaviour observably unchanged).
 *
 * ORDER OF OPERATIONS — design.md §3.4, and not reorderable:
 *
 *   1. resolveSession(cookieStore)   read-only DB lookup; safe before CSRF
 *   2a. member → verifyCsrfRequest() fail ⇒ 403, no body parse, no transaction
 *   2b. guest  → no CSRF             guestId = readGuestCartId() ?? generate…
 *   3. body parse
 *   4. createOrder(owner, body)      the transaction
 *
 * CSRF cannot go first. It is scoped to the member path only, so "is this the
 * member path" must be answered first — and answering it IS resolveSession(),
 * itself a DB read. The invariant is "CSRF before the STATE-CHANGING
 * operation", not "CSRF before all DB access"; the session lookup mutates
 * nothing (REQ-AUTH-034), so preceding CSRF with it costs nothing CSRF protects.
 *
 * WHY THE CART DOMAIN'S IDENTITY RESOLVER IS NOT CALLED HERE (design.md
 * §3.2.1). It returns `{kind:"user", userId}` for ANY valid Bearer token and
 * offers no way to force a guest fallback — so routing this endpoint through it
 * would make REQ-ORDER-055 unimplementable: a valid Bearer would always produce
 * a member identity. The guest branch below is therefore built inline from
 * guest-identity.ts's three raw primitives. That duplicates ~3 lines, and buys
 * the property that no Bearer-parsing code path exists in this file at all —
 * the ignore is expressed as an absent call, not as a comment. cart-service.ts
 * keeps its Bearer branch untouched for the four cart routes (REQ-ORDER-054).
 */
export async function POST(request: Request): Promise<Response> {
  // 1. Identity. The ONLY source of member truth on this route.
  const jar = await cookies();
  const session = await resolveSession(jar);

  let owner: OrderOwner;
  // Non-null only when this request arrived without a guest cookie and we
  // minted one — the existing :79-82 behaviour, preserved verbatim below.
  let issuedGuestId: string | null = null;

  if (session !== null) {
    // 2a. Member. CSRF before anything that changes state (REQ-ORDER-064).
    // 403 says nothing about WHICH check failed, matching the discipline
    // staff/api/orders/[orderId]/status/route.ts already set.
    if (!verifyCsrfRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    owner = { kind: "user", userId: session.userId };
  } else {
    // 2b. Guest. No CSRF: the guest cookie is an identifier, not an
    // authenticator — forging it only lets an attacker order from their own
    // cart, and requiring CSRF here would break every existing guest client
    // (REQ-ORDER-065, design.md §3.3).
    //
    // Reached regardless of any Authorization header, which is REQ-ORDER-055.
    const existing = readGuestCartId(request);
    issuedGuestId = existing === null ? generateGuestCartId() : null;
    owner = { kind: "guest", guestId: existing ?? issuedGuestId! };
  }

  // 3. Body. Never parsed on the member-CSRF-failure path above.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON never reaches the domain — the same shape the cart and
    // auth routes already use for an unparseable body.
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 4. The transaction.
  const result = await createOrder(owner, body);

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
