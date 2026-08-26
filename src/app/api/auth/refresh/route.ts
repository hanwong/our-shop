import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashRefreshToken } from "@/lib/auth/session";
import { signAccessToken } from "@/lib/auth/jwt";
import { buildRefreshTokenCookie } from "@/lib/auth/cookies";
import { getRefreshTokenFromRequest } from "@/lib/auth/request-refresh-token";
import { getRefreshTokenExpiresAt } from "@/lib/auth/refresh-token-duration";
import { checkIpRateLimit } from "@/lib/auth/rate-limit";
import { buildCsrfCookie, generateCsrfToken, verifyCsrfRequest } from "@/lib/auth/csrf";

/**
 * SPEC-AUTH-001 M4 — POST /api/auth/refresh
 * Traces: REQ-AUTH-010 (valid rotation), REQ-AUTH-011 (reuse detection ->
 * family-wide revoke), REQ-AUTH-012 (expired-token rejection). design.md
 * §3.2 is the authoritative flow this implements.
 *
 * SPEC-AUTH-001 M6 additive hardening — REQ-AUTH-021 (IP-keyed rate limit,
 * checked before any DB access), REQ-AUTH-023 (CSRF double-submit
 * verification via `verifyCsrfRequest()`, checked before any DB access; a
 * fresh csrf_token double-submit cookie is issued alongside the rotated
 * refresh-token cookie on a successful rotation, via csrf.ts). AC-AUTH-023
 * covers both halves: rejection on missing/mismatched CSRF token, and the
 * SameSite=Lax cookie attribute (unchanged since M2).
 */

// A single generic message for every 401 branch (not found / reused /
// expired / owning-user missing), same convention as login's
// GENERIC_LOGIN_ERROR — the client cannot distinguish WHY a refresh failed.
const GENERIC_REFRESH_ERROR = "Invalid refresh token";

// Same convention as GENERIC_REFRESH_ERROR/GENERIC_LOGIN_ERROR — the client
// cannot distinguish a missing token from a mismatched one.
const GENERIC_CSRF_ERROR = "Invalid or missing CSRF token";

export async function POST(request: Request): Promise<Response> {
  // REQ-AUTH-023 — CSRF double-submit verification runs first, before any
  // other check (including rate limiting and DB access).
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: GENERIC_CSRF_ERROR }, { status: 403 });
  }

  // REQ-AUTH-021 — IP-keyed check runs before any DB access; skipped when
  // the IP cannot be determined (see checkIpRateLimit's doc comment).
  if (!checkIpRateLimit("refresh", request).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawToken = getRefreshTokenFromRequest(request);
  if (!rawToken) {
    return NextResponse.json({ error: GENERIC_REFRESH_ERROR }, { status: 401 });
  }

  const tokenHash = hashRefreshToken(rawToken);
  // NOTE: RefreshToken.tokenHash carries `@@index` in prisma/schema.prisma
  // (M1), not `@@unique` — so Prisma's generated WhereUniqueInput rejects a
  // `findUnique({ where: { tokenHash } })` lookup (requires `id`). Schema
  // changes are out of M4's authorized scope (constraint: do not modify
  // prisma/schema.prisma), so `findFirst` is used instead — functionally
  // equivalent here since tokenHash values are SHA-256 digests of
  // cryptographically random 32-byte tokens (collision-negligible), but this
  // is a DB-level uniqueness invariant NOT actually enforced by the schema.
  // See the M4 self-verification report's Residual-risk section.
  const found = await prisma.refreshToken.findFirst({ where: { tokenHash } });
  if (!found) {
    return NextResponse.json({ error: GENERIC_REFRESH_ERROR }, { status: 401 });
  }

  const now = new Date();

  // REQ-AUTH-011/AC-AUTH-008 — reuse of an already-rotated-out token: revoke
  // the ENTIRE family (every still-valid member, not just this one) so no
  // token from this family can ever refresh again.
  if (found.revokedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: { familyId: found.familyId, revokedAt: null },
      data: { revokedAt: now },
    });
    return NextResponse.json({ error: GENERIC_REFRESH_ERROR }, { status: 401 });
  }

  // REQ-AUTH-012/AC-AUTH-009 — expired but never reused: reject, issue
  // nothing, and do NOT treat this as family-wide reuse (distinct branch).
  if (found.expiresAt < now) {
    return NextResponse.json({ error: GENERIC_REFRESH_ERROR }, { status: 401 });
  }

  // The current role is read fresh (not cached from token issuance) so a
  // role change since the last login/refresh is reflected in the new token.
  const user = await prisma.user.findUnique({ where: { id: found.userId } });
  if (!user) {
    return NextResponse.json({ error: GENERIC_REFRESH_ERROR }, { status: 401 });
  }

  const newRawToken = randomBytes(32).toString("base64url");
  const newTokenHash = hashRefreshToken(newRawToken);
  const newExpiresAt = getRefreshTokenExpiresAt();

  // @MX:WARN concurrency/race-condition-prone DB transaction — two
  // near-simultaneous /refresh requests presenting the SAME valid token
  // could both pass the reuse/expiry checks above before either writes here;
  // this transaction makes the create+revoke pair atomic (AC-AUTH-010) but
  // does NOT itself serialize concurrent requests against the same row (see
  // acceptance.md §7's noted race scenario — out of M4 scope to fully close).
  // @MX:REASON DB transaction wrapping a read-then-write rotation is
  // susceptible to a lost-update/double-rotation race under concurrent
  // refresh attempts on the same token; flagged for future row-level locking
  // or a unique-constraint-based CAS if the race proves exploitable.
  await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        userId: found.userId,
        tokenHash: newTokenHash,
        familyId: found.familyId,
        expiresAt: newExpiresAt,
      },
    });
    await tx.refreshToken.update({
      where: { id: found.id },
      data: { revokedAt: now, replacedByTokenId: created.id },
    });
  });

  const accessToken = await signAccessToken({ sub: found.userId, role: user.role });
  const cookie = buildRefreshTokenCookie(newRawToken, newExpiresAt);
  const csrfCookie = buildCsrfCookie(generateCsrfToken());

  const response = NextResponse.json({ accessToken }, { status: 200 });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  response.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.options);
  return response;
}
