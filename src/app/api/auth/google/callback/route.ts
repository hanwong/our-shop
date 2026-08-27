import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/auth/jwt";
import { issueSession } from "@/lib/auth/session";
import { buildRefreshTokenCookie } from "@/lib/auth/cookies";
import {
  OAUTH_STATE_COOKIE_NAME,
  buildAccessTokenHandoffCookie,
  buildExpiredOAuthStateCookie,
  exchangeCodeAndVerifyIdToken,
} from "@/lib/auth/google-oauth";
import { checkIpRateLimit } from "@/lib/auth/rate-limit";
import { buildCsrfCookie, generateCsrfToken } from "@/lib/auth/csrf";

/**
 * SPEC-AUTH-001 M5 — GET /api/auth/google/callback
 * Traces: REQ-AUTH-015 (state CSRF rejection), REQ-AUTH-016 (ID token
 * verification), REQ-AUTH-017 (matched-account login), REQ-AUTH-018
 * (new-user creation), REQ-AUTH-019 (auto-link, confirmed policy —
 * plan.md §5.1, design.md §5 threat-model row 12, accepted residual risk).
 * design.md §3.4 is the authoritative flow this implements.
 *
 * A single generic message on every failure branch (state mismatch / ID
 * token rejected / owning-User missing), same GENERIC_*_ERROR convention as
 * login (M3) and refresh (M4) — the client cannot distinguish WHY the OAuth
 * callback failed.
 *
 * SPEC-AUTH-001 M6 additive hardening — REQ-AUTH-021 (IP-keyed rate limit,
 * checked before the existing `state` CSRF check and any code exchange /
 * DB access), REQ-AUTH-023 (a csrf_token double-submit cookie is set
 * alongside the refresh-token cookie on session issuance).
 */
const GENERIC_OAUTH_ERROR = "Google login failed";

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

export async function GET(request: Request): Promise<Response> {
  // REQ-AUTH-021 — IP-keyed check runs before the state check / any code
  // exchange or DB access; skipped when the IP cannot be determined.
  if (!checkIpRateLimit("google-callback", request).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookieValue(request, OAUTH_STATE_COOKIE_NAME);

  // AC-AUTH-014 — a missing/mismatched state is rejected BEFORE any code
  // exchange or DB access is attempted. Comparison rationale: see
  // google-oauth.ts's "OAuth `state` CSRF cookie" design-choice comment
  // (plain `===` — a CSRF correlation token, not a secret comparison).
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: GENERIC_OAUTH_ERROR }, { status: 400 });
  }

  let identity: Awaited<ReturnType<typeof exchangeCodeAndVerifyIdToken>>;
  try {
    // Covers code-exchange failure (network/invalid code — acceptance.md §7
    // edge case, independent of the state check above) AND every ID-token
    // verification failure (bad signature / bad iss / bad aud / library
    // checks, plus this module's own email_verified check) uniformly: any
    // throw here means no DB write has happened yet, so the single catch
    // below is safe (AC-AUTH-015/AC-AUTH-015b).
    identity = await exchangeCodeAndVerifyIdToken(code);
  } catch {
    return NextResponse.json({ error: GENERIC_OAUTH_ERROR }, { status: 400 });
  }

  // acceptance.md §7 edge case — normalize BEFORE any lookup/comparison/
  // storage so a case-differing Google email (`User@Example.com`) still
  // matches an existing lowercase-stored User email.
  const normalizedEmail = identity.email.toLowerCase();

  const matchedOAuthAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: identity.sub,
      },
    },
  });

  let userId: string;
  let role: Role;

  if (matchedOAuthAccount) {
    // Branch A (REQ-AUTH-017/AC-AUTH-016) — matched OAuthAccount.
    const user = await prisma.user.findUnique({ where: { id: matchedOAuthAccount.userId } });
    if (!user) {
      return NextResponse.json({ error: GENERIC_OAUTH_ERROR }, { status: 400 });
    }
    userId = user.id;
    role = user.role as Role;
  } else {
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      // Branch C (REQ-AUTH-019/AC-AUTH-018/AC-AUTH-018b) — auto-link,
      // confirmed policy, no separate confirmation step (plan.md §5.1).
      //
      // [AUTO] @MX:WARN 2026-08-27 security fix (sync-phase audit finding
      // C1 — CRITICAL). Auto-linking to an existingUser whose email was
      // NEVER independently verified (`emailVerified === false`, the state
      // of every User this SPEC's signup route creates, since no email-
      // verification flow exists) let an attacker pre-register the
      // victim's email/password, then retain password access after the
      // real owner authenticated with Google and got auto-linked to the
      // attacker's row — full account takeover. Google's
      // `email_verified === true` is the first reliable proof of email
      // ownership this system has for that row, so from that point on the
      // OLD unverified password can no longer be trusted: it is invalidated
      // in the same transaction, and the row is marked verified.
      // [AUTO] @MX:REASON AC-AUTH-018 (unchanged) still governs the
      // already-verified case (password keeps working); AC-AUTH-018b is the
      // new unverified-account branch this comment describes.
      const wasUnverified = !existingUser.emailVerified;
      await prisma.$transaction(async (tx) => {
        await tx.oAuthAccount.create({
          data: {
            provider: "google",
            providerAccountId: identity.sub,
            userId: existingUser.id,
          },
        });
        if (wasUnverified) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { passwordHash: null, emailVerified: true },
          });
          // [AUTO] @MX:WARN 2026-08-27 C1 re-audit fix — nulling passwordHash
          // alone does not revoke a session an attacker already established
          // BEFORE the victim's Google login (e.g. by simply logging in with
          // the password they set at signup). Without this, the attacker's
          // existing RefreshToken keeps working and rotates indefinitely via
          // POST /api/auth/refresh, which checks token validity only — never
          // emailVerified or a credential-change signal — so the takeover
          // survives the password fix. Revoke every still-active refresh
          // token for this user in the SAME transaction as the link.
          // [AUTO] @MX:REASON this is a blanket per-user revocation (not
          // per-family, unlike refresh/route.ts's reuse-detection revoke) —
          // deliberately broader, since ANY existing session for this user
          // is untrusted at this point, not just one rotation family.
          await tx.refreshToken.updateMany({
            where: { userId: existingUser.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      });
      userId = existingUser.id;
      role = existingUser.role as Role;
    } else {
      // Branch B (REQ-AUTH-018/AC-AUTH-017) — no match, no existing User:
      // create both in one transaction. `role` is always "customer" for a
      // freshly-created OAuth signup (same fixed default the data literal
      // below writes), so no extra read-back query is needed.
      const createdUserId = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash: null,
            emailVerified: true,
            role: "customer",
          },
        });
        await tx.oAuthAccount.create({
          data: {
            provider: "google",
            providerAccountId: identity.sub,
            userId: newUser.id,
          },
        });
        return newUser.id;
      });
      userId = createdUserId;
      role = "customer";
    }
  }

  const { accessToken, refreshToken, refreshTokenExpiresAt } = await issueSession(userId, role);

  // Post-login redirect destination — this SPEC has no frontend to design
  // against, so a placeholder is used (see the M5 self-verification report's
  // Gaps section).
  const response = NextResponse.redirect(new URL("/", request.url), 302);

  const refreshCookie = buildRefreshTokenCookie(refreshToken, refreshTokenExpiresAt);
  response.cookies.set(refreshCookie.name, refreshCookie.value, refreshCookie.options);

  const csrfCookie = buildCsrfCookie(generateCsrfToken());
  response.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.options);

  const expiredStateCookie = buildExpiredOAuthStateCookie();
  response.cookies.set(expiredStateCookie.name, expiredStateCookie.value, expiredStateCookie.options);

  // Access-token transport design choice — see google-oauth.ts
  // buildAccessTokenHandoffCookie()'s doc comment for the full rationale.
  const accessTokenCookie = buildAccessTokenHandoffCookie(accessToken);
  response.cookies.set(accessTokenCookie.name, accessTokenCookie.value, accessTokenCookie.options);

  return response;
}
