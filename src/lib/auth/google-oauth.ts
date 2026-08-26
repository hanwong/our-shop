import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

/**
 * SPEC-AUTH-001 M5 — Google OAuth login (design.md §3.4).
 * Traces: REQ-AUTH-014 (consent URL + state), REQ-AUTH-015 (state CSRF
 * rejection — verified by the callback route, not this module), REQ-AUTH-016
 * (Google ID token verification: signature/iss/aud/email_verified).
 *
 * This file is a thin wrapper around google-auth-library's `OAuth2Client`.
 * Account-resolution (matched / new-user / auto-link) and session issuance
 * live in the callback route, not here — this module only talks to Google.
 */

const GOOGLE_OAUTH_SCOPES = ["openid", "email", "profile"];

function getClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth environment variables are not fully configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI)"
    );
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

/**
 * Cryptographically random CSRF `state` token (REQ-AUTH-014) — NOT
 * `Math.random()`. 32 bytes of entropy, base64url-encoded (URL/cookie-safe),
 * matching the convention `issueSession()` uses for the opaque refresh token
 * (session.ts M2).
 */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Builds the Google consent-screen URL (AC-AUTH-013). `state` is caller-
 * generated (via `generateState()`) so the callback route (§ below) can
 * compare it against the double-submit cookie without this module knowing
 * about cookies at all.
 *
 * `access_type: "online"` — this app never needs to refresh Google's own
 * access token outside of the initial login (no background Google API
 * calls), so no Google refresh token is requested. Our OWN session
 * refresh (M2/M4) is independent of Google's token lifecycle.
 */
export function buildConsentUrl(state: string): string {
  const client = getClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: GOOGLE_OAUTH_SCOPES,
    state,
  });
}

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Exchanges an authorization `code` for tokens, then verifies the returned
 * Google ID token and extracts the verified identity (REQ-AUTH-016,
 * AC-AUTH-015/AC-AUTH-015b).
 *
 * Verification-check provenance (consulted verbatim against
 * `node_modules/google-auth-library/build/src/auth/oauth2client.js`
 * `verifySignedJwtWithCertsAsync`, the function `verifyIdToken()` delegates
 * to):
 *   - LIBRARY-PROVIDED: JWKS signature verification, `iat`/`exp` presence +
 *     expiry-window check, `iss` membership in
 *     `['accounts.google.com', 'https://accounts.google.com', <universeDomain>]`
 *     (the library's own default `issuers` list — NOT overridden here), and
 *     `aud` equality against the `audience` option passed below.
 *   - APPLICATION-ADDED (this function, NOT the library): `email_verified
 *     === true`. google-auth-library does not reject on this claim; REQ-
 *     AUTH-016 requires it, so it is checked explicitly here.
 * A bad signature, a wrong `iss`, or a wrong `aud` all surface as a rejected
 * `verifyIdToken()` promise (library-provided) and propagate as a throw from
 * this function; a `false` `email_verified` is caught by the explicit check
 * below.
 */
export async function exchangeCodeAndVerifyIdToken(code: string): Promise<VerifiedGoogleIdentity> {
  const client = getClient();

  // Code-exchange failure (network error, invalid code, etc.) is a distinct
  // failure mode from state/ID-token verification (acceptance.md §7 edge
  // case) — it simply propagates as a throw here, same as every other
  // failure branch in this function, and the callback route's single catch
  // handles all of them uniformly (400/401, no DB writes).
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google token exchange did not return an ID token");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is not set");
  }

  // Library-provided: signature (JWKS) + iss + aud + iat/exp — see the
  // provenance comment above.
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Google ID token verification returned no payload");
  }

  // Application-added: email_verified is NOT checked by the library.
  if (payload.email_verified !== true) {
    throw new Error("Google account email is not verified (email_verified !== true)");
  }
  if (!payload.email) {
    throw new Error("Google ID token payload carries no email claim");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
  };
}

// ---------------------------------------------------------------------------
// OAuth `state` CSRF cookie (REQ-AUTH-014/015, AC-AUTH-013/014) — double-
// submit-cookie pattern.
//
// Design choice (this app has no server-side session store — design.md §3.4
// documents the OAuth flow itself but not this storage mechanism, so it is
// recorded here explicitly): `GET /api/auth/google` sets a short-lived
// httpOnly cookie carrying the same `state` value embedded in the Google
// consent URL. `GET /api/auth/google/callback` reads the cookie and compares
// it against the `state` query param Google echoes back. A mismatch or a
// missing cookie is rejected (AC-AUTH-014) BEFORE any code exchange or DB
// access is attempted. This is deliberately a SEPARATE cookie from the
// refresh-token cookie (cookies.ts, M2) — different name, different (much
// shorter) lifetime, and a different purpose (CSRF correlation vs.
// authentication).
//
// Comparison note: the callback route (not this file) compares the cookie
// value to the query-param value with a plain `===`. This is a CSRF
// correlation token, not a secret being checked against a stored secret to
// authenticate a party — an attacker who can read the state value gains
// nothing (it grants no access on its own), so a non-constant-time
// comparison carries no meaningful timing-attack surface here, unlike a
// password or token-hash comparison. Documented explicitly per this
// milestone's instructions rather than left implicit.
// ---------------------------------------------------------------------------

export const OAUTH_STATE_COOKIE_NAME = "oauth_state";

const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes

/**
 * Access-token handoff cookie name (see the redirect-transport design
 * decision documented on `buildAccessTokenHandoffCookie` below).
 */
export const OAUTH_ACCESS_TOKEN_HANDOFF_COOKIE_NAME = "oauth_access_token_handoff";

const OAUTH_ACCESS_TOKEN_HANDOFF_MAX_AGE_SECONDS = 60; // 1 minute — single client read, then discarded

export interface SimpleCookieOptions {
  httpOnly: boolean;
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
 * Mirrors cookies.ts's (M2, private) `isSecureEnvironment()` — Secure is
 * derived from NODE_ENV, every environment except local development sets it.
 * Duplicated rather than imported: that function is module-private in
 * cookies.ts, and M2/M4 established the precedent of duplicating small
 * private helpers across milestone files rather than widening another
 * milestone's export surface (see session.ts / refresh-token-duration.ts).
 */
function isSecureEnvironment(): boolean {
  return process.env.NODE_ENV !== "development";
}

/** Builds the `oauth_state` cookie set on `GET /api/auth/google` (AC-AUTH-013). */
export function buildOAuthStateCookie(state: string): SimpleCookie {
  return {
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    options: {
      httpOnly: true,
      secure: isSecureEnvironment(),
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
    },
  };
}

/** Clears the `oauth_state` cookie once the callback has consumed it. */
export function buildExpiredOAuthStateCookie(): SimpleCookie {
  return {
    name: OAUTH_STATE_COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: isSecureEnvironment(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  };
}

/**
 * Access-token transport on the OAuth callback's redirect response — a
 * genuine SPEC/acceptance-criteria gap (AC-AUTH-016 only requires "a session
 * equivalent to email/password login is issued"; it does not specify HOW the
 * access token reaches the client on a 302, and there is no frontend in this
 * SPEC's scope to design a same-origin handshake against).
 *
 * Chosen option: a short-lived (60s), non-httpOnly, Secure, SameSite=Lax
 * cookie the client reads once via JS and (in a real frontend) immediately
 * discards. Rejected alternatives: (a) a query-string access token — leaks
 * into browser history, server access logs, and the `Referer` header, a
 * strictly worse exposure than a 60s cookie; (b) redirecting to a client
 * page that then calls a dedicated token-retrieval endpoint — the more
 * correct production answer (the access token never touches a cookie at
 * all), but it requires a frontend route + a second endpoint that do not
 * exist in this SPEC's API-only scope, so it is out of reach here without
 * inventing an unrequested API surface. See this milestone's self-
 * verification report, Gaps/Residual-risk, for the full reasoning and the
 * residual XSS-exposure-window risk this choice accepts.
 */
export function buildAccessTokenHandoffCookie(accessToken: string): SimpleCookie {
  return {
    name: OAUTH_ACCESS_TOKEN_HANDOFF_COOKIE_NAME,
    value: accessToken,
    options: {
      httpOnly: false,
      secure: isSecureEnvironment(),
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_ACCESS_TOKEN_HANDOFF_MAX_AGE_SECONDS,
    },
  };
}
