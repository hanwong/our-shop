import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashRefreshToken } from "@/lib/auth/session";
import { buildExpiredRefreshTokenCookie } from "@/lib/auth/cookies";
import { getRefreshTokenFromRequest } from "@/lib/auth/request-refresh-token";

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
 */
export async function POST(request: Request): Promise<Response> {
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
