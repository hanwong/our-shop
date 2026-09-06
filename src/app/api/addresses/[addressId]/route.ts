import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveSession } from "@/lib/auth/session-resolver";
import { removeAddress, updateAddress } from "@/features/addresses/services/address-service";
import type { AddressInput } from "@/features/addresses/types/address";

/**
 * SPEC-ADDRESS-001 M2 — `PATCH|DELETE /api/addresses/[addressId]`
 * (REQ-ADDRESS-005/006/008~011).
 *
 * Both handlers share the same four-step order (plan.md M2, not reorderable):
 *
 *   1. verifyCsrfRequest(request)   fail ⇒ 403, no body parse, no DB access
 *   2. resolveSession(jar)          null ⇒ 401
 *   3. body parse (PATCH only)      fail ⇒ 400
 *   4. address-service.ts call      owns the ownership-conditional write and
 *      the 404 that covers BOTH "no such address" and "not yours"
 *      (REQ-ADDRESS-011 — the response never distinguishes the two).
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

  // 3. Body parsing — malformed JSON never reaches the domain.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 4. address-service.ts owns validation, ownership, and the write.
  const result = await updateAddress(session.userId, addressId, (body ?? {}) as AddressInput);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 200 });
}

export async function DELETE(
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

  // 3. address-service.ts owns the ownership-conditional delete.
  const result = await removeAddress(session.userId, addressId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
