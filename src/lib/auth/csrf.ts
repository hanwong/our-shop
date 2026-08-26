import { randomBytes } from "node:crypto";

/**
 * SPEC-AUTH-001 M6 — CSRF protection via the double-submit-cookie pattern.
 * Traces: REQ-AUTH-023 (CSRF defense on cookie-based /auth/refresh and
 * /auth/logout), AC-AUTH-023.
 *
 * This app has no server-side session store (the same precedent M5's OAuth
 * `state` cookie set in google-oauth.ts), so a synchronizer-token pattern
 * (a server-side token store keyed by session) is not available here;
 * double-submit-cookie is the applicable pattern given that constraint.
 *
 * Comparison note: verifyCsrfRequest() uses a plain `===` comparison, NOT a
 * constant-time comparison — same rationale as google-oauth.ts's `state`
 * comparison. This is a CSRF correlation token (it proves the request
 * originated from same-origin JS that could read the cookie), not a secret
 * checked against a stored secret to authenticate a party, so a timing
 * side-channel on this comparison grants an attacker nothing they could not
 * already get by reading the cookie directly (which requires same-origin JS
 * execution — i.e., already having what CSRF defense exists to deny to a
 * cross-origin attacker).
 */

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// @MX:NOTE default CSRF-cookie lifetime — mirrors the refresh-token
// cookie's own default (30 days, REQ-AUTH-008 / cookies.ts
// DEFAULT_REFRESH_TOKEN_EXPIRY). getCsrfCookieMaxAgeSeconds() below tracks
// JWT_REFRESH_TOKEN_EXPIRY when set so the two stay in sync at runtime too.
const DEFAULT_CSRF_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface SimpleCookieOptions {
  httpOnly: false;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export interface SimpleCookie {
  name: string;
  value: string;
  options: SimpleCookieOptions;
}

/**
 * Mirrors cookies.ts's private isSecureEnvironment() (duplicated here
 * following the same precedent google-oauth.ts already established for this
 * exact helper) — Secure derives from NODE_ENV; every environment except
 * local development sets it.
 */
function isSecureEnvironment(): boolean {
  return process.env.NODE_ENV !== "development";
}

/**
 * Mirrors refresh-token-duration.ts's duration parsing so the CSRF cookie's
 * lifetime tracks JWT_REFRESH_TOKEN_EXPIRY when set, falling back to the
 * same 30-day default cookies.ts uses for the refresh-token cookie itself.
 */
function getCsrfCookieMaxAgeSeconds(): number {
  const duration = process.env.JWT_REFRESH_TOKEN_EXPIRY;
  if (!duration) {
    return DEFAULT_CSRF_TOKEN_MAX_AGE_SECONDS;
  }
  const match = /^(\d+)([dhm])$/.exec(duration.trim());
  if (!match) {
    return DEFAULT_CSRF_TOKEN_MAX_AGE_SECONDS;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitSeconds = unit === "d" ? 86_400 : unit === "h" ? 3_600 : 60;
  return value * unitSeconds;
}

/**
 * Cryptographically random CSRF token — NOT `Math.random()` (same
 * convention as google-oauth.ts's `generateState()` / session.ts's opaque
 * refresh token).
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Builds the `csrf_token` cookie descriptor. NOT httpOnly — client JS must
 * be able to read this value to echo it back as the `X-CSRF-Token` request
 * header (the double-submit half of the pattern).
 */
export function buildCsrfCookie(token: string): SimpleCookie {
  return {
    name: CSRF_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: false,
      secure: isSecureEnvironment(),
      sameSite: "lax",
      path: "/",
      maxAge: getCsrfCookieMaxAgeSeconds(),
    },
  };
}

/** Reads a single named cookie off the incoming Request's `Cookie` header. */
function getCookieValue(request: Request, name: string): string | null {
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
    if (key === name) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return null;
}

/**
 * Verifies the CSRF double-submit pair: the `csrf_token` cookie value must
 * equal the `X-CSRF-Token` request header value. Returns false when either
 * is missing or they don't match (AC-AUTH-023). Callers MUST call this
 * BEFORE any DB access on `/auth/refresh` and `/auth/logout` (REQ-AUTH-023).
 */
export function verifyCsrfRequest(request: Request): boolean {
  const cookieValue = getCookieValue(request, CSRF_COOKIE_NAME);
  const headerValue = request.headers.get(CSRF_HEADER_NAME);
  if (!cookieValue || !headerValue) {
    return false;
  }
  return cookieValue === headerValue;
}
