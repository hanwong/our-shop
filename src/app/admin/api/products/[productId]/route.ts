import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveAdminSession } from "@/features/admin/services/admin-session";
import { updateProduct } from "@/features/admin/repositories/admin-product-repository";
import { parseProductInput } from "@/features/admin/services/product-validation";
import {
  GENERIC_AUTH_ERROR,
  isMissingCategoryError,
  MISSING_CATEGORY_ERRORS,
} from "@/app/admin/api/products/shared";

/**
 * SPEC-ADMIN-002 M4 — `PATCH /admin/api/products/[productId]`
 * (REQ-ADMIN-025/026~030/038~040).
 *
 * The same four-step order the create route documents: CSRF -> fresh session
 * -> shared validation -> write. Sharing `parseProductInput` with the create
 * route is deliberate — two copies of the rules would eventually disagree
 * about the same submission (design.md §4).
 *
 * `isActive` is not part of ProductInput, so a submission carrying it is
 * ignored rather than honoured: sellability moves only through the sibling
 * `/active` route (design.md §1). That separation is what stops an edit-form
 * save from silently reviving or suspending a product.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> }
): Promise<Response> {
  // 1. CSRF first — no DB access at all on failure.
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 403 });
  }

  // 2. A fresh admin-session check on every write (never reused from render).
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

  // 3. Validation before the write, so a rejected edit provably changes nothing.
  const parsed = parseProductInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  // 4. The write. `updated: false` means no row carried that id — the
  // repository's updateMany reports it without throwing.
  try {
    const result = await updateProduct(productId, parsed.data);
    if (!result.updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    if (isMissingCategoryError(error)) {
      return NextResponse.json({ errors: MISSING_CATEGORY_ERRORS }, { status: 400 });
    }
    throw error;
  }
}
