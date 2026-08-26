import { randomBytes, createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { signAccessToken, type Role } from "@/lib/auth/jwt";

/**
 * SPEC-AUTH-001 M2 — the shared session-issuance path (plan.md §3.2).
 *
 * Both the email/password login route (M3) and the Google OAuth callback
 * (M5) call this SAME function once they have resolved a single confirmed
 * `userId` — this is what plan.md §3.2 calls "동일한 함수" ("the same
 * function"). Refresh-on-rotation (M4) does not reuse this function directly
 * (it has its own rotation logic) but follows the same claim-construction
 * rules via signAccessToken().
 */

// @MX:NOTE refresh-token expiry default — REQ-AUTH-008 fixes the default at
// 30 days, overridable via JWT_REFRESH_TOKEN_EXPIRY. Duration strings use the
// same day-suffix format the codebase's env vars document (e.g. "30d", "7d").
const DEFAULT_REFRESH_TOKEN_EXPIRY = "30d";

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/** Parses a simple "<N>d" / "<N>h" / "<N>m" duration string into milliseconds. */
function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([dhm])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Unsupported refresh-token expiry duration format: "${duration}"`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = unit === "d" ? 24 * 60 * 60 * 1000 : unit === "h" ? 60 * 60 * 1000 : 60 * 1000;
  return value * unitMs;
}

function getRefreshTokenExpiresAt(): Date {
  const duration = process.env.JWT_REFRESH_TOKEN_EXPIRY || DEFAULT_REFRESH_TOKEN_EXPIRY;
  return new Date(Date.now() + parseDurationToMs(duration));
}

/** SHA-256 hex digest of the raw opaque refresh token — the value persisted
 * to `RefreshToken.tokenHash` (REQ-AUTH-008: DB stores only the hash, never
 * the plaintext token; AC-AUTH-007b: round-trippable via this same function).
 */
function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Issues a new session for `userId`: generates an opaque, cryptographically
 * random refresh token, persists only its hash (with a fresh rotation
 * family), and signs a matching access token via the shared JWT path.
 *
 * Caller supplies `role` (looked up from `User.role` by the caller — M3
 * passes the just-authenticated User's role, M5 passes the resolved OAuth
 * user's role) since this function has no DB read path of its own beyond the
 * RefreshToken insert.
 */
export async function issueSession(userId: string, role: Role): Promise<IssuedSession> {
  // Cryptographically random opaque token — NOT Math.random(). 32 bytes of
  // entropy, base64url-encoded (no padding, URL/cookie-safe).
  const refreshToken = randomBytes(32).toString("base64url");
  const tokenHash = hashRefreshToken(refreshToken);
  const familyId = randomUUID();
  const refreshTokenExpiresAt = getRefreshTokenExpiresAt();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      familyId,
      expiresAt: refreshTokenExpiresAt,
    },
  });

  const accessToken = await signAccessToken({ sub: userId, role });

  return { accessToken, refreshToken, refreshTokenExpiresAt };
}
