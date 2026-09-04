import { prisma } from "@/lib/db";
import { hashRefreshToken } from "@/lib/auth/session";

/**
 * SPEC-AUTH-002 M1 — role-agnostic server-side session resolution.
 *
 * Traces: REQ-AUTH-033 (a valid refresh-token cookie resolves to a session
 * regardless of role — customer or admin), REQ-AUTH-034 (read-only — never
 * rotates or reissues the refresh token, never creates/updates a
 * RefreshToken row), REQ-AUTH-035 (every invalid-session reason collapses
 * to the same `null`; callers must not leak which reason applied).
 *
 * This is `resolveAdminSession` (SPEC-ADMIN-001,
 * src/features/admin/services/admin-session.ts) generalized by removing
 * its `role !== "admin"` filter — the same algorithm otherwise. The two
 * functions intentionally stay independent (no delegation) — see spec.md
 * §3 Out of Scope ("resolveAdminSession 리팩터").
 */

// Matches the cookie name cookies.ts's buildRefreshTokenCookie() sets, same
// literal admin-session.ts already uses (cookies.ts is a PRESERVE target,
// not imported from here either).
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/**
 * Minimal structural shape of Next.js `cookies()` this function needs —
 * duck-typed so the real `next/headers` cookies() object satisfies it with
 * no adapter, and a unit test can pass a plain mock with no Next.js
 * runtime. Same shape as admin-session.ts's `AdminCookieStore`.
 */
export interface SessionCookieStore {
  get(name: string): { value: string } | undefined;
}

export interface Session {
  userId: string;
  role: "customer" | "admin";
}

/**
 * Resolves the requesting user's session from the existing refresh-token
 * cookie, for either role. Performs NO writes: it never issues a new
 * cookie, never rotates or reissues the refresh token, and never mutates
 * the RefreshToken row it reads (REQ-AUTH-034). Every failure path (no
 * cookie, no matching row, expired, revoked) returns the same `null` —
 * callers must not attempt to distinguish the reason (REQ-AUTH-035).
 */
export async function resolveSession(cookieStore: SessionCookieStore): Promise<Session | null> {
  const rawToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashRefreshToken(rawToken);

  const record = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.revokedAt !== null || record.expiresAt <= new Date()) {
    return null;
  }

  return { userId: record.user.id, role: record.user.role };
}
