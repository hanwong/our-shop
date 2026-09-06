import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveSession } from "@/lib/auth/session-resolver";
import { setDefaultAddress } from "@/features/addresses/services/address-service";

/**
 * SPEC-ADDRESS-001 M2 — `PATCH /api/addresses/[addressId]/default`
 * (REQ-ADDRESS-007/009~011).
 *
 * A dedicated sub-route rather than a field on the edit route — the direct
 * repository precedent is `staff/api/products/[productId]/active/route.ts`,
 * which split a single-boolean-state transition off the general edit route
 * the same way (plan.md M2). Setting the default is a transaction that
 * touches OTHER rows besides the target, so it does not belong in the same
 * handler as a plain field edit.
 *
 * Same four-step order as its siblings, minus a body (the target id in the
 * URL is the entire request):
 *
 *   1. verifyCsrfRequest(request)   fail ⇒ 403, no DB access
 *   2. resolveSession(jar)          null ⇒ 401
 *   3. setDefaultAddress()          the transaction (address-repository.ts
 *      `setDefault`); a 404 covers both "no such address" and "not yours"
 *      (REQ-ADDRESS-011).
 */
const GENERIC_AUTH_ERROR = "Not authorized";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ addressId: string }> }
): Promise<Response> {
  // 1. CSRF first — no DB access at all on failure.
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. A fresh session check on every write.
  const jar = await cookies();
  const session = await resolveSession(jar);
  if (session === null) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  const { addressId } = await context.params;

  // 3. The default-address transaction.
  const result = await setDefaultAddress(session.userId, addressId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
