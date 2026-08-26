/**
 * SPEC-AUTH-001 M4 — refresh-token expiry duration for the rotation flow
 * (design.md §3.2, step "신규 RefreshToken 생성").
 *
 * This mirrors session.ts's module-private `parseDurationToMs()` /
 * `getRefreshTokenExpiresAt()` exactly: same "<N>d/h/m" format, same
 * `DEFAULT_REFRESH_TOKEN_EXPIRY = "30d"` default, same `JWT_REFRESH_TOKEN_EXPIRY`
 * env var. It is duplicated here rather than imported because those
 * functions are private in session.ts, and M4's authorized refactor of
 * session.ts is scoped to exporting `hashRefreshToken` only (see the M4
 * self-verification report's Gaps section) — no other export was requested
 * or made.
 */
const DEFAULT_REFRESH_TOKEN_EXPIRY = "30d";

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

/** Computes the expiry Date for a newly-rotated refresh token. */
export function getRefreshTokenExpiresAt(): Date {
  const duration = process.env.JWT_REFRESH_TOKEN_EXPIRY || DEFAULT_REFRESH_TOKEN_EXPIRY;
  return new Date(Date.now() + parseDurationToMs(duration));
}
