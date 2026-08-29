import { randomBytes } from "node:crypto";

/**
 * SPEC-CART-001 M2 — guest identity: the opaque cookie that lets a shopper
 * keep a cart before they have an account.
 *
 * Traces: REQ-CART-003 (an unauthenticated request resolves to a guest cookie,
 * issued when absent), REQ-CART-004 / AC-CART-004 (httpOnly, cryptographically
 * random, and distinct in NAME and LIFETIME from every SPEC-AUTH-001 cookie).
 * plan.md §2.2 is the authoritative design.
 *
 * WHY THIS LIVES BESIDE THE AUTH COOKIES BUT IS NOT ONE OF THEM: a guest is an
 * independent identity axis, not a reduced-privilege session (spec.md §1). Two
 * consequences show up below and are deliberate.
 *
 * 1. The value is stored in `Cart.guestId` in PLAINTEXT, unlike
 *    `RefreshToken.tokenHash` which stores only a hash (REQ-AUTH-008). The
 *    asymmetry is a blast-radius judgement, not an oversight: a leaked refresh
 *    token takes over an account, while a leaked guest id exposes at worst the
 *    contents of a stranger's cart — no PII, no payment instrument, no account
 *    access. Storing plaintext keeps the lookup a plain indexed equality on
 *    `guestId`. The value is still 32 bytes of CSPRNG output, so enumeration
 *    remains infeasible.
 * 2. The lifetime is 14 days rather than the refresh token's 30. A guest cart
 *    has no re-authentication flow and is discarded if the visitor never comes
 *    back, so matching the session lifetime would be arbitrary; one day would
 *    throw away the cart of someone returning mid-week to finish buying.
 *
 * CSRF: cart mutations authenticated by this cookie carry no CSRF token. That
 * is an accepted residual risk recorded in spec.md §3 — forging a cart edit
 * discloses nothing and moves no money — not an omission.
 */

const GUEST_CART_COOKIE_NAME = "guest_cart_id";

/** 14 days — plan.md §2.2, deliberately NOT the refresh token's 30. */
const DEFAULT_GUEST_CART_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export { GUEST_CART_COOKIE_NAME };

export interface GuestCartCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  domain?: string;
}

export interface GuestCartCookie {
  name: string;
  value: string;
  options: GuestCartCookieOptions;
}

/**
 * Mirrors cookies.ts's module-private isSecureEnvironment(). Duplicated rather
 * than imported, following the precedent google-oauth.ts and csrf.ts already
 * set for this exact one-liner — cookies.ts is a PRESERVE file for this SPEC,
 * so widening its export surface is not this SPEC's to do.
 */
function isSecureEnvironment(): boolean {
  return process.env.NODE_ENV !== "development";
}

/**
 * Parses the "<N>d/h/m" duration form the JWT_* env vars use.
 *
 * Unlike session.ts's parser this FALLS BACK on a malformed value instead of
 * throwing. A guest cookie is a convenience, not a security control, so a typo
 * in `GUEST_CART_COOKIE_EXPIRY` should cost the operator the custom lifetime —
 * not turn every cart request in the deployment into a 500.
 */
function getGuestCartMaxAgeSeconds(): number {
  const duration = process.env.GUEST_CART_COOKIE_EXPIRY;
  if (!duration) {
    return DEFAULT_GUEST_CART_MAX_AGE_SECONDS;
  }
  const match = /^(\d+)([dhm])$/.exec(duration.trim());
  if (!match) {
    return DEFAULT_GUEST_CART_MAX_AGE_SECONDS;
  }
  const unit = match[2];
  const unitSeconds = unit === "d" ? 86_400 : unit === "h" ? 3_600 : 60;
  return Number(match[1]) * unitSeconds;
}

function baseOptions(maxAge: number): GuestCartCookieOptions {
  const options: GuestCartCookieOptions = {
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
 * A fresh opaque guest identifier — 32 bytes of CSPRNG output, base64url
 * encoded, following the same convention as csrf.ts's generateCsrfToken() and
 * google-oauth.ts's generateState(). Never `Math.random()`.
 */
export function generateGuestCartId(): string {
  return randomBytes(32).toString("base64url");
}

/** The cookie descriptor for handing a guest identifier to the browser. */
export function buildGuestCartCookie(guestId: string): GuestCartCookie {
  return {
    name: GUEST_CART_COOKIE_NAME,
    value: guestId,
    options: baseOptions(getGuestCartMaxAgeSeconds()),
  };
}

/**
 * The cookie descriptor for immediately expiring the guest cookie, set on a
 * login response once the guest cart has been merged (plan.md §6 step 3).
 * Leaving the cookie in place would have the browser keep presenting an id
 * that no longer resolves to any cart.
 */
export function buildExpiredGuestCartCookie(): GuestCartCookie {
  return {
    name: GUEST_CART_COOKIE_NAME,
    value: "",
    options: baseOptions(0),
  };
}

/**
 * Reads a single named cookie off the incoming Request's `Cookie` header.
 *
 * Relocated here from google/callback/route.ts, where it was module-private,
 * so the login route can share it rather than grow a second parser (plan.md §6
 * step 1). Behaviour is unchanged from that original, byte for byte.
 */
export function getCookieValue(request: Request, name: string): string | null {
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

/** The guest identifier this request presents, or null when it presents none. */
export function readGuestCartId(request: Request): string | null {
  return getCookieValue(request, GUEST_CART_COOKIE_NAME);
}
