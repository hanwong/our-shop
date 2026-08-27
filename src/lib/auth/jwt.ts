import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";

/**
 * SPEC-AUTH-001 M2 — shared JWT access-token issuance/verification path.
 * Traces: REQ-AUTH-006 (claim shape), REQ-AUTH-007 (configurable expiry),
 * REQ-AUTH-020 (algorithm whitelist + iss/aud/exp verification).
 */

const ISSUER = "our-shop";
const AUDIENCE = "our-shop-api";

// @MX:NOTE access-token expiry default — REQ-AUTH-007 fixes the default at
// 15 minutes (900s), overridable via JWT_ACCESS_TOKEN_EXPIRY (a jose
// duration string, e.g. "5m", "1h").
const DEFAULT_ACCESS_TOKEN_EXPIRY = "15m";

// Explicit algorithm allowlist (REQ-AUTH-020) — verification NEVER trusts the
// `alg` value in an incoming token's header; only algorithms named here are
// ever accepted, closing the "alg: none" / algorithm-confusion attack class.
const ALLOWED_ALGORITHMS = ["HS256"] as const;
const SIGNING_ALGORITHM = "HS256";

export type Role = "customer" | "admin";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface VerifiedAccessTokenClaims extends JWTPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

function getAccessTokenExpiry(): string {
  return process.env.JWT_ACCESS_TOKEN_EXPIRY || DEFAULT_ACCESS_TOKEN_EXPIRY;
}

/**
 * Signs a new access token. Caller supplies only `sub` (internal user id)
 * and `role`; `iat`/`exp`/`iss`/`aud`/`jti` are all auto-populated here so
 * every issued token carries EXACTLY these seven claims and nothing else
 * (REQ-AUTH-006 — no PII, no extra fields).
 */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: SIGNING_ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(getAccessTokenExpiry())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .sign(getSecretKey());
}

/**
 * @MX:ANCHOR fan-in target — M3 (login/signup routes), M4 (refresh/logout),
 * and M6 (auth middleware, /admin RBAC gate) all call this function to
 * validate an incoming access token. Any signature change here has fan-out
 * across those milestones.
 *
 * Verifies an access token: explicit algorithm allowlist (never trusts the
 * token header's `alg`), and validates `iss`/`aud`/`exp` on every call
 * (REQ-AUTH-020). Throws/rejects on any failure — alg-confusion, wrong
 * secret, wrong iss, wrong aud, or expired exp.
 */
export async function verifyAccessToken(token: string): Promise<VerifiedAccessTokenClaims> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: [...ALLOWED_ALGORITHMS],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return payload as VerifiedAccessTokenClaims;
}
