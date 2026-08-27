/**
 * SPEC-AUTH-001 M2 — refresh-token cookie builders.
 * Traces: REQ-AUTH-008 (httpOnly + Secure + SameSite + hash-only storage
 * upstream in session.ts), REQ-AUTH-023 (SameSite=Lax baseline; CSRF
 * double-submit/synchronizer defense is M6 scope, layered on top of this).
 *
 * Design choice: these builders return a Next.js
 * `response.cookies.set(name, value, options)`-shaped object rather than a
 * raw `Set-Cookie` header string, since that is the form a Next.js Route
 * Handler (M3/M4) consumes directly — `response.cookies.set(cookie.name,
 * cookie.value, cookie.options)`.
 */

const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

export interface RefreshTokenCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  domain?: string;
}

export interface RefreshTokenCookie {
  name: string;
  value: string;
  options: RefreshTokenCookieOptions;
}

/**
 * Secure is derived from NODE_ENV (design.md §4: "Secure 속성은 NODE_ENV에
 * 따라 파생") rather than read from a separate env var — every environment
 * except local development (`NODE_ENV=development`) sets Secure.
 */
function isSecureEnvironment(): boolean {
  return process.env.NODE_ENV !== "development";
}

function baseOptions(maxAge: number): RefreshTokenCookieOptions {
  const options: RefreshTokenCookieOptions = {
    httpOnly: true,
    secure: isSecureEnvironment(),
    sameSite: "lax",
    path: "/",
    maxAge,
  };
  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }
  return options;
}

/**
 * Builds the cookie descriptor for setting the refresh-token cookie on a
 * successful login/refresh/OAuth-callback response. `maxAge` (seconds) is
 * derived from the given `expiresAt` Date, clamped to a minimum of 0.
 */
export function buildRefreshTokenCookie(rawRefreshToken: string, expiresAt: Date): RefreshTokenCookie {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return {
    name: REFRESH_TOKEN_COOKIE_NAME,
    value: rawRefreshToken,
    options: baseOptions(maxAge),
  };
}

/**
 * Builds the cookie descriptor for immediately expiring the refresh-token
 * cookie (maxAge: 0) — used on logout (M4 consumes this; written now since
 * it shares the same option builder as the live cookie above).
 */
export function buildExpiredRefreshTokenCookie(): RefreshTokenCookie {
  return {
    name: REFRESH_TOKEN_COOKIE_NAME,
    value: "",
    options: baseOptions(0),
  };
}
