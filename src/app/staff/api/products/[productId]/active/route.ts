import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveAdminSession } from "@/features/admin/services/admin-session";
import { setProductActive } from "@/features/admin/repositories/admin-product-repository";
import { GENERIC_AUTH_ERROR } from "@/app/admin/api/products/shared";

/**
 * SPEC-ADMIN-002 M5 — `PATCH /admin/api/products/[productId]/active`
 * (REQ-ADMIN-031/032/033/038/039/040).
 *
 * A dedicated sub-route rather than a field on the edit route, matching how
 * SPEC-ADMIN-001 split order status onto `/orders/[orderId]/status`. Two
 * reasons (design.md §1):
 *
 * - Suspension cannot happen by accident. An edit form that carried `isActive`
 *   could revive or suspend a product as a side effect of saving unrelated
 *   changes; here it takes a request sent on purpose.
 * - The edit route's accepted body stays exactly REQ-ADMIN-026/027/029's field
 *   set, with `isActive` outside it rather than an ignored extra.
 *
 * Same four-step order as its siblings: CSRF -> fresh session -> body check ->
 * write. The body is the narrowest possible: one boolean. Product fields
 * cannot reach a column through this route because the repository call takes a
 * bare boolean, not the body.
 *
 * REQ-ADMIN-033 (referencing CartItem/OrderItem rows are untouched) needs no
 * enforcement here — it holds structurally, because a soft delete issues no
 * DELETE for CartItem's ON DELETE CASCADE to react to.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> }
): Promise<Response> {
  // 1. CSRF first — no DB access at all on failure.
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 403 });
  }

  // 2. A fresh admin-session check on every write.
  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 403 });
  }

  const { productId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 3. The ONLY accepted body is { isActive: boolean }. A string "false" or a
  // 0 is a client that did not send what it claimed — rejected, never coerced,
  // because coercion here would silently suspend a product on a malformed
  // request.
  const requested = (body as { isActive?: unknown } | null)?.isActive;
  if (typeof requested !== "boolean") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 4. The write — sellability only.
  const result = await setProductActive(productId, requested);
  if (!result.updated) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({}, { status: 200 });
}
