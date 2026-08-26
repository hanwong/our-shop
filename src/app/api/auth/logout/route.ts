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
 *
 * @MX:DEBT SPEC-AUTH-001 M6 — REQ-AUTH-023 also names `/auth/logout` as a
 * CSRF-verification target, alongside `/auth/refresh`. `verifyCsrfRequest()`
 * (csrf.ts) is implemented and unit-tested, but deliberately NOT called
 * here — wiring it in deterministically breaks every pre-existing M4 test
 * in tests/unit/api/auth/logout.test.ts and
 * tests/integration/auth/logout-then-refresh.test.ts (none send an
 * X-CSRF-Token header or csrf_token cookie). See the M6 self-verification
 * report's Blocker section — same conflict, same resolution, as
 * refresh/route.ts's identical @MX:DEBT marker.
 * @MX:CEILING CSRF verification is not enforced on this route until the
 * blocker is resolved; this route also does not issue a csrf_token cookie
 * (logout only expires cookies, per its existing idempotency design — it is
 * not a "session issued/rotated" point per this milestone's Set-cookie
 * scope, which lists login/refresh/google-callback only).
 * @MX:UPGRADE call `verifyCsrfRequest(request)` at the top of this handler
 * once the pre-existing M4 test fixtures are updated to carry a matching
 * csrf_token cookie + X-CSRF-Token header, or the "no prior test
 * modification" constraint is explicitly lifted for this milestone.
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
