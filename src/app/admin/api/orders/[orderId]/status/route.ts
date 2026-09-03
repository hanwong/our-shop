import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyCsrfRequest } from "@/lib/auth/csrf";
import { resolveAdminSession } from "@/features/admin/services/admin-session";
import { cancelOrderAsAdmin } from "@/features/admin/repositories/admin-order-repository";

/**
 * SPEC-ADMIN-001 M4 — `PATCH /admin/api/orders/[orderId]/status`
 * (REQ-ADMIN-012~017).
 *
 * Order of operations — each step gates the next, and none may be reordered:
 *
 * 1. CSRF FIRST (REQ-ADMIN-016) — verifyCsrfRequest(request), before ANY
 *    other check, including DB access. Matches logout/route.ts's discipline
 *    exactly.
 * 2. Session re-verification (REQ-ADMIN-017) — a FRESH resolveAdminSession()
 *    call. The route has no memory of the page-render-time check; every
 *    write request re-verifies from the cookie the request itself carries.
 * 3. Body validation (REQ-ADMIN-012/013) — the ONLY accepted body is
 *    { status: "cancelled" }. Any other value — including "paid" — is
 *    rejected here, before cancelOrderAsAdmin() or the database is touched
 *    at all. The admin can NEVER transition an order to `paid` via any path;
 *    this is where that invariant is enforced at the API boundary.
 * 4. cancelOrderAsAdmin() inside a transaction. { transitioned: false }
 *    (already cancelled, or the order does not exist) answers a rejection —
 *    the repository's own conditional updateMany already guarantees no
 *    side effect occurred (AC-ADMIN-013).
 * 5. { transitioned: true } answers 200.
 *
 * The CSRF-failure and session-failure responses share the SAME status code
 * and the SAME body shape (both `{ error: <generic text> }` at 403) — per
 * AC-ADMIN-003's reason-blind rejection spirit, the response body never
 * discloses which of the two checks failed.
 */

const GENERIC_AUTH_ERROR = "Not authorized";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
): Promise<Response> {
  // 1. CSRF first — no DB access at all on failure.
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 403 });
  }

  // 2. A FRESH admin-session check, every write request, never reused from
  // page-render time.
  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 403 });
  }

  const { orderId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 3. Only { status: "cancelled" } is a recognized request. Any other value
  // — "paid" included — is rejected WITHOUT ever calling cancelOrderAsAdmin().
  const requestedStatus = (body as { status?: unknown } | null)?.status;
  if (requestedStatus !== "cancelled") {
    return NextResponse.json({ error: "Unsupported status transition" }, { status: 400 });
  }

  // 4. The conditional-atomic transition, inside a transaction.
  const result = await prisma.$transaction((tx) => cancelOrderAsAdmin(tx, orderId));

  if (!result.transitioned) {
    return NextResponse.json({ error: "Order cannot be cancelled" }, { status: 409 });
  }

  // 5. Success.
  return NextResponse.json({}, { status: 200 });
}
