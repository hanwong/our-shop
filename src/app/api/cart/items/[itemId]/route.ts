import { NextResponse } from "next/server";
import { removeItem, resolveCartIdentity, setQuantity } from "@/features/cart/services/cart-service";
import type { CartDTO } from "@/features/cart/types/cart";

/**
 * SPEC-CART-001 M4 — PATCH and DELETE /api/cart/items/:itemId.
 *
 * Traces: REQ-CART-008 (PATCH sets the quantity ABSOLUTELY — unlike POST,
 * which adds), REQ-CART-009 (DELETE removes one line and leaves the others
 * alone), REQ-CART-010 (404 for an item that does not exist OR belongs to
 * another cart — the same status for both, so the response cannot be used to
 * probe which item ids are real), REQ-CART-014 (no credentials required).
 *
 * `params` is awaited because Next.js 15 delivers dynamic route parameters as
 * a Promise, matching src/app/api/products/[productId]/route.ts.
 */

/**
 * Renders a service result. Local to this module because a Next.js route file
 * may export only HTTP method handlers.
 *
 * Unlike GET /api/cart and POST /api/cart/items, these two handlers never
 * issue a guest cookie. They cannot reach a state where one is needed: a
 * request arrives without a cookie only if it has no guest identity yet, and
 * such an identity has no cart, so every item lookup below answers 404 long
 * before a success response is built. Setting a cookie here would be
 * unreachable code rather than defensive code.
 */
function respond(
  result: { ok: true; data: CartDTO } | { ok: false; status: 400 | 404; error: string }
): Response {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 200 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
): Promise<Response> {
  const { itemId } = await context.params;
  const { identity } = await resolveCartIdentity(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await setQuantity(identity, itemId, (body ?? {}) as { quantity?: unknown });
  return respond(result);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
): Promise<Response> {
  const { itemId } = await context.params;
  const { identity } = await resolveCartIdentity(request);

  const result = await removeItem(identity, itemId);
  return respond(result);
}
