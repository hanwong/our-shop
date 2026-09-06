import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveSession } from "@/lib/auth/session-resolver";
import { createAddress, listAddresses } from "@/features/addresses/services/address-service";
import type { AddressInput } from "@/features/addresses/types/address";

/**
 * SPEC-ADDRESS-001 M2 — `GET|POST /api/addresses` (REQ-ADDRESS-004/008~010/013).
 *
 * `GET` is not a state-changing operation, so it carries no CSRF check
 * (REQ-ADDRESS-009 scopes CSRF to state-changing endpoints only) — it still
 * requires a resolved session (REQ-ADDRESS-010) and returns only the
 * requesting member's own rows.
 *
 * `POST`'s order of operations (plan.md M2, not reorderable):
 *
 *   1. verifyCsrfRequest(request)   fail ⇒ 403, no body parse, no DB access
 *   2. resolveSession(jar)          null ⇒ 401
 *   3. body parse + validation      fail ⇒ 400 (address-service.ts owns this)
 *   4. createAddress()              the write
 *
 * This SPEC has NO guest branch (spec.md §1.5) — unlike POST /api/orders,
 * there is no "which branch is this?" question that requires a session read
 * before CSRF can run, so CSRF is literally step 1 here, matching
 * `/staff/api/orders/[orderId]/status`'s discipline.
 */
const GENERIC_AUTH_ERROR = "Not authorized";

export async function GET(): Promise<Response> {
  const jar = await cookies();
  const session = await resolveSession(jar);
  if (session === null) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  const addresses = await listAddresses(session.userId);
  return NextResponse.json(addresses, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
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

  // 3. Body parsing — malformed JSON never reaches the domain.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 4. address-service.ts owns field validation and the write.
  const result = await createAddress(session.userId, (body ?? {}) as AddressInput);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
