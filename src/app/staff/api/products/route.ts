import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveAdminSession } from "@/features/admin/services/admin-session";
import { createProduct } from "@/features/admin/repositories/admin-product-repository";
import { parseProductInput } from "@/features/admin/services/product-validation";
import {
  GENERIC_AUTH_ERROR,
  isMissingCategoryError,
  MISSING_CATEGORY_ERRORS,
} from "@/app/staff/api/products/shared";

/**
 * SPEC-ADMIN-002 M4 — `POST /staff/api/products` (REQ-ADMIN-024/026~030/038~040).
 *
 * Order of operations, identical to SPEC-ADMIN-001's status/route.ts and to
 * this SPEC's other two write routes. Each step gates the next; none may be
 * reordered:
 *
 * 1. CSRF FIRST (REQ-ADMIN-039) — before ANY other check, including the
 *    session and any database access.
 * 2. A FRESH resolveAdminSession() (REQ-ADMIN-038). The route has no memory of
 *    the page-render-time check; every write re-verifies from the cookie the
 *    request itself carries.
 * 3. Body validation via the SHARED parser (REQ-ADMIN-026/027/029/030), before
 *    the database is touched — so a rejected submission provably creates
 *    nothing.
 * 4. The write. A P2003 foreign-key violation means `categoryId` names no
 *    existing category; it is converted into a field error rather than a 500
 *    (REQ-ADMIN-029).
 *
 * The CSRF-failure and session-failure responses are byte-identical (same
 * status, same body), so a requester cannot learn which check rejected them —
 * REQ-ADMIN-037's reason-blind rejection extended to the CSRF boundary.
 */
export async function POST(request: Request): Promise<Response> {
  // 1. CSRF first — no session lookup, no DB access at all on failure.
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 403 });
  }

  // 2. A fresh admin-session check, on this request's own cookie.
  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 3. Validation before any write — the same parser the edit route uses, so
  // the two routes cannot drift apart on what "valid" means.
  const parsed = parseProductInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  // 4. The write.
  try {
    const { id } = await createProduct(parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (isMissingCategoryError(error)) {
      return NextResponse.json({ errors: MISSING_CATEGORY_ERRORS }, { status: 400 });
    }
    throw error;
  }
}
