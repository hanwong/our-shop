import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";

/**
 * SPEC-AUTH-001 M6 — /admin route RBAC gate.
 * Traces: REQ-AUTH-022 (admin-route middleware — `role === "admin"`
 * required, reject otherwise), AC-AUTH-022(a)/(b).
 *
 * @MX:ANCHOR fan-in target — the sole global entry point that gates every
 * request under /admin/**; any change to its pass/reject logic changes
 * access control for the entire admin surface.
 * @MX:REASON global route-matcher middleware invoked on every /admin
 * request — a regression here is an authorization bypass, not a cosmetic
 * bug, so changes should be reviewed with that weight.
 *
 * Known limitation (documented explicitly, per this milestone's
 * instructions, rather than left implicit or worked around with an
 * undocumented cookie-based bypass): REQ-AUTH-009 keeps the access token in
 * client memory ONLY — never a cookie, never localStorage/sessionStorage —
 * so a same-origin fetch/XHR made by client JS can attach an `Authorization:
 * Bearer <token>` header, but a raw top-level browser NAVIGATION to
 * /admin/... cannot: a top-level navigation carries no custom request
 * headers. This middleware checks the Authorization header when present and
 * treats its absence as "no valid session" (AC-AUTH-022(b)'s no-valid-
 * session branch) — that is a direct, expected consequence of the
 * memory-only access-token design this SPEC chose (REQ-AUTH-009), not a bug
 * in this middleware. A real frontend serving protected admin pages would
 * need a same-origin API-call pattern (e.g. a client-side route guard that
 * calls a same-origin endpoint carrying the header, rather than relying on
 * a raw top-level navigation to carry auth) — that frontend pattern is
 * outside this SPEC's API-only scope.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const claims = await verifyAccessToken(token);
    if (claims.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
