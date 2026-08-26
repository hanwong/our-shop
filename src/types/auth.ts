/**
 * SPEC-AUTH-001 M6 — consolidated shared auth types.
 *
 * Pure re-exports, not a second definition — `Role` and the token/session
 * shapes are already defined and used throughout M2-M5 (jwt.ts, session.ts).
 * This file is the intended single import point for consumers that want
 * auth-domain types without reaching into a specific lib/auth/*
 * implementation module. Do NOT redefine `Role` (or any type re-exported
 * here) — doing so would create a second, divergent definition.
 */
export type { Role, AccessTokenPayload, VerifiedAccessTokenClaims } from "@/lib/auth/jwt";
export type { IssuedSession } from "@/lib/auth/session";
