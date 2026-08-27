/**
 * SPEC-AUTH-001 M4 — reads the refresh-token cookie value off an incoming
 * Request's `Cookie` header.
 *
 * Route handlers in this codebase (login/signup, M3) take a plain `Request`
 * rather than `NextRequest`, and are tested with `new Request(...)` — so
 * this parses the raw `Cookie` header directly instead of relying on
 * `NextRequest.cookies`, keeping refresh/logout (M4) testable the same way.
 *
 * The cookie NAME below ("refresh_token") must stay in sync with the
 * private `REFRESH_TOKEN_COOKIE_NAME` constant in cookies.ts (M2). cookies.ts
 * is not modified by M4 (out of the authorized refactor scope — see M4's
 * self-verification report), so the name is duplicated here rather than
 * imported; if cookies.ts's cookie name ever changes, update this constant
 * to match.
 */
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/**
 * Returns the raw refresh-token cookie value from `request`, or `null` when
 * no `Cookie` header is present or it carries no `refresh_token` pair.
 */
export function getRefreshTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    const key = part.slice(0, eqIdx).trim();
    if (key === REFRESH_TOKEN_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return null;
}
