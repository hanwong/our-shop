import { prisma } from "@/lib/db";
import { hashRefreshToken } from "@/lib/auth/session";

/**
 * SPEC-ADMIN-001 M1 — server-side admin session resolution.
 *
 * Traces: REQ-ADMIN-001 (a valid admin refresh-token cookie resolves to an
 * admin session), REQ-ADMIN-002 (read-only — never rotates or reissues the
 * refresh token, never creates a new RefreshToken row), REQ-ADMIN-003
 * (every invalid-session reason collapses to the same `null`; callers must
 * not leak which reason applied). design.md §2 — the 7-step algorithm this
 * function implements verbatim.
 *
 * This is a read-only reinterpretation of the EXISTING refresh-token
 * cookie (REQ-AUTH-008) — it reuses hashRefreshToken() from session.ts
 * (imported, never reimplemented) and stops after the lookup. It never
 * touches src/middleware.ts. See research.md §6 for why this reuse is
 * safe.
 */

// Matches the cookie name cookies.ts's buildRefreshTokenCookie() sets.
// REFRESH_TOKEN_COOKIE_NAME there is module-private (not exported), so this
// reads the literal cookie name rather than importing it — cookies.ts is a
// PRESERVE target for this SPEC and is not edited.
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/**
 * Minimal structural shape of Next.js `cookies()` this function needs —
 * duck-typed so the real `next/headers` cookies() object satisfies it with
 * no adapter, and a unit test can pass a plain mock with no Next.js
 * runtime.
 */
export interface AdminCookieStore {
  get(name: string): { value: string } | undefined;
}

export interface AdminSession {
  userId: string;
  role: "admin";
}

/**
 * Resolves the requesting admin's session from the existing refresh-token
 * cookie. Performs NO writes: it never issues a new cookie, never rotates
 * or reissues the refresh token, and never mutates the RefreshToken row it
 * reads (REQ-ADMIN-002). Every failure path (no cookie, no matching row,
 * expired, revoked, non-admin role) returns the same `null` — callers must
 * not attempt to distinguish the reason (REQ-ADMIN-003).
 */
export async function resolveAdminSession(cookieStore: AdminCookieStore): Promise<AdminSession | null> {
  const rawToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashRefreshToken(rawToken);

  // `tokenHash` is indexed (`@@index([tokenHash])`) but not a DB-level
  // unique constraint on the RefreshToken model (session.ts's own rotation
  // path does not require one), so `findFirst` is the type-correct query —
  // still a single read, no different in behavior since tokenHash values
  // are cryptographically unique in practice.
  const record = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.revokedAt !== null || record.expiresAt <= new Date()) {
    return null;
  }

  if (record.user.role !== "admin") {
    return null;
  }

  return { userId: record.user.id, role: "admin" };
}
