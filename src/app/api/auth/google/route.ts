import { NextResponse } from "next/server";
import { buildConsentUrl, buildOAuthStateCookie, generateState } from "@/lib/auth/google-oauth";

/**
 * SPEC-AUTH-001 M5 — GET /api/auth/google
 * Traces: REQ-AUTH-014 (consent URL + CSRF state), AC-AUTH-013.
 *
 * Generates a fresh CSRF `state`, sets it as the `oauth_state` double-
 * submit cookie (google-oauth.ts), and 302-redirects to Google's consent
 * screen carrying the same state as a query param.
 */
export async function GET(): Promise<Response> {
  const state = generateState();
  const consentUrl = buildConsentUrl(state);

  const response = NextResponse.redirect(consentUrl, 302);
  const stateCookie = buildOAuthStateCookie(state);
  response.cookies.set(stateCookie.name, stateCookie.value, stateCookie.options);
  return response;
}
