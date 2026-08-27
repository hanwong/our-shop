import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashRefreshToken } from "@/lib/auth/session";
import { buildExpiredRefreshTokenCookie } from "@/lib/auth/cookies";
import { getRefreshTokenFromRequest } from "@/lib/auth/request-refresh-token";
import { verifyCsrfRequest } from "@/lib/auth/csrf";

/**
 * SPEC-AUTH-001 M4 — POST /api/auth/logout
 * Traces: REQ-AUTH-013 (revoke THIS session's refresh token only — "all
 * devices" logout is Out of Scope per spec.md §3 — and expire the cookie).
 * design.md §3.3 is the authoritative flow this implements.
 *
 * Idempotency choice: a missing cookie, or a cookie whose token is not found
 * in the DB (already logged out, or simply invalid), still returns 200 and
 * still expires the cookie, rather than erroring. Logout is a "make sure I'm
 * logged out" request from the client's perspective — there is no unsafe
 * side effect in responding success when there was nothing left to revoke,
 * and erroring here would only leak whether a given token was ever valid.
 *
 * SPEC-AUTH-001 M6 additive hardening — REQ-AUTH-023 also names
 * `/auth/logout` as a CSRF-verification target, alongside `/auth/refresh`.
 * `verifyCsrfRequest()` (csrf.ts) is checked before any DB access
 * (AC-AUTH-023). This route does not issue a csrf_token cookie itself
 * (logout only expires cookies, per its existing idempotency design — it is
 * not a "session issued/rotated" point per this milestone's Set-cookie
 * scope, which lists login/refresh/google-callback only); the cookie
 * verified here was issued by a prior login/refresh/google-callback
 * response.
 */

// Same convention as refresh/route.ts's GENERIC_CSRF_ERROR — the client
// cannot distinguish a missing token from a mismatched one.
const GENERIC_CSRF_ERROR = "Invalid or missing CSRF token";

export async function POST(request: Request): Promise<Response> {
  // REQ-AUTH-023 — CSRF double-submit verification runs first, before any
  // other check (including DB access).
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: GENERIC_CSRF_ERROR }, { status: 403 });
  }

  const rawToken = getRefreshTokenFromRequest(request);

  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    // See refresh/route.ts's NOTE: tokenHash is @@index-only (not @@unique)
    // in the M1 schema, so findFirst is used rather than findUnique.
    const found = await prisma.refreshToken.findFirst({ where: { tokenHash } });
    if (found) {
      // REQ-AUTH-013: only THIS token is revoked — sibling tokens in the
      // same family (other devices/sessions) are left untouched.
      await prisma.refreshToken.update({
        where: { id: found.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  const response = NextResponse.json({}, { status: 200 });
  const expiredCookie = buildExpiredRefreshTokenCookie();
  response.cookies.set(expiredCookie.name, expiredCookie.value, expiredCookie.options);
  return response;
}
