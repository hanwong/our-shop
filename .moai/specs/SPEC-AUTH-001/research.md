# Research: SPEC-AUTH-001 — Email/Password + JWT Session + Google OAuth

> Produced by the Explore subagent during plan-phase Deep Research (Phase 6). Read-only research — no implementation code included. Feeds Phase 8 SPEC Planning.

## Context recap

- Project: `our-shop`, solo-developed, mobile-first B2C fashion e-commerce, no code exists yet.
- Stack (tentative, per `tech.md`): TypeScript, Next.js App Router + Node.js, PostgreSQL + Prisma, pnpm, Vitest/Jest, Tailwind, Vercel/GitHub Actions.
- Constraint carried over from `product.md`: "개인정보 최소 수집 원칙" (minimum PII collection) — relevant to JWT claim contents and Google profile field storage.
- Scope confirmed in `interview.md`: email/password signup+login, JWT access (short) + refresh (long, DB-stored) issue/refresh/logout, Google OAuth, hand-rolled with `jose` + `bcrypt` (NextAuth/Auth.js explicitly excluded). Password-reset-via-email is out of scope.

## 1. JWT structure, expiry, storage, rotation, revocation

**Access-token claims**: `sub` (internal user id — never email), `iat`/`exp` (always set + validated), `iss`/`aud` (both set + validated on verify — stops cross-audience replay), `jti` (correlates to a session, not used as an access-token revocation list), a minimal `role` claim. Never embed email/name/address or any external-provider secret in the payload (JWTs are base64url-encoded, not encrypted).

**Expiry**: access token 5-15 min (15 min baseline); refresh token 7-30 days (30 days baseline) — pick and document a rotation policy (sliding vs. fixed absolute max) explicitly to avoid indefinite sessions.

**Storage (2026 baseline pattern)**: access token in memory client-side only (never localStorage — XSS-exfiltrable); refresh token in an **httpOnly, Secure, SameSite=Lax/Strict cookie**, with the DB holding a **hash** of the token (never raw) as the source of truth for validity/revocation.

**Rotation-on-refresh**: every `/auth/refresh` call issues a brand-new refresh token and invalidates the old one in the same transaction. A redeemed token must never be redeemable twice.

**Reuse detection / revocation**: `RefreshToken` allowlist table (`id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `familyId`, `replacedByTokenId`). On refresh: reuse of an already-rotated-out token → revoke the **entire token family** and force re-auth (standard Auth0/Okta mitigation). On logout: revoke the specific token (or the whole family for "sign out everywhere").

Sources: OWASP JWT Cheat Sheet, RFC 9700 (OAuth 2.0 Security BCP), Auth0/Okta refresh-rotation docs.

## 2. Combining hand-rolled JWT sessions with Google OAuth (no NextAuth)

Use Google's OAuth 2.0 Authorization Code flow directly via `google-auth-library`'s `OAuth2Client` (Google's own low-level client — consistent with "no auth framework" intent, lighter than the full `googleapis` package).

Flow: `GET /api/auth/google` builds the consent URL (`scope: openid,email,profile`, signed/opaque `state` for CSRF) → Google redirects to `GET /api/auth/google/callback` → validate `state` → exchange `code` for tokens → verify the **ID token** (`verifyIdToken`, checking `iss === https://accounts.google.com`, `aud` matches the client ID, and **`email_verified === true`** before trusting the email).

**Identity mapping (the key integration point)**: look up `OAuthAccount` by `(provider="google", providerAccountId=<google sub>)`. If found → resolve `User`. If not found but a `User` with that verified email exists → decide + document a policy (auto-link vs. explicit link-confirmation — a real product/security decision, belongs in acceptance criteria). If neither exists → create `User` (no password hash) + `OAuthAccount` in one transaction.

From the resolved `User`, issue the **exact same JWT access+refresh pair** via the exact same issuance function used for email/password login — Google OAuth and email/password are just two front doors into one shared "create a session for this userId" path; downstream middleware/refresh/logout is identical either way. (The `User`/`Account` split mirrors Auth.js's own Prisma adapter shape, used here only as a reference pattern, not a dependency.)

## 3. Password hashing (bcrypt)

- Cost factor: OWASP baseline ≥10; current practitioner guidance recommends **12** as a sensible minimum (13-14 for higher-resource deployments), tuned to ~250-500ms per hash. Start at 12, load-test before raising.
- **72-byte truncation pitfall**: bcrypt silently truncates beyond 72 bytes — enforce a max password length or pre-hash long passphrases with SHA-256 before bcrypt.
- Always use the library's constant-time `compare`, never manual `===`.
- Never log the raw password or hash.
- Salt is automatic per-hash — no separate global salt.
- Note: OWASP currently ranks Argon2id above bcrypt for new systems, but since bcrypt is the user's locked-in decision, keep it and document cost-factor (12) as an explicit, revisitable parameter rather than re-litigating the algorithm.
- **Timing side-channel**: run a dummy bcrypt compare (or equivalent delay) even when the email lookup fails, so "wrong password" and "no such user" have similar response times.

## 4. Prisma schema shape (conceptual — not final code)

- **`User`**: `id`, `email` (unique), `passwordHash` (nullable — null for OAuth-only users), `emailVerified`, `role` (customer/admin), `createdAt`/`updatedAt`. Avoid storing extra Google profile fields (locale, picture) unless the UI actually needs them (PII-minimization constraint).
- **`OAuthAccount`**: `id`, `userId` (FK, cascade delete), `provider` (e.g. `"google"`, extensible to more later), `providerAccountId` (Google's `sub`), `@@unique([provider, providerAccountId])` (prevents account-collision/double-link). Avoid persisting Google's own access/refresh tokens unless actually calling Google APIs beyond login.
- **`RefreshToken`**: `id`, `userId` (FK, cascade delete), `tokenHash`, `familyId`, `expiresAt`, `revokedAt` (nullable), `replacedByTokenId` (nullable self-FK), `createdAt`, optional `userAgent`/`ip` (useful for a future "active sessions" UI). Index `userId` and `tokenHash`.

This three-table shape supports the shared JWT-issuance path from §2 and lines up with `structure.md`'s proposed `lib/auth/` and `lib/db/` layering.

## 5. Security pitfalls → acceptance-criteria candidates

1. **Algorithm confusion / `"alg": "none"`** — pin the expected algorithm explicitly on verify (`jose`'s `jwtVerify(token, secret, { algorithms: [...] })`); never derive it from the token header.
2. **Missing/loose `exp`/`iss`/`aud` validation** — always set on issuance, always validate on verify.
3. **Refresh-token reuse without detection** — rotation alone is insufficient (RFC 9700); reuse of a rotated-out token must revoke the whole family.
4. **Refresh token storage** — never localStorage/sessionStorage; httpOnly+Secure+SameSite cookie, DB-hash as authority.
5. **CSRF on cookie-based refresh/logout** — `SameSite=Lax/Strict` baseline + consider a double-submit/synchronizer token for `/refresh` and `/logout`.
6. **Brute-force/credential-stuffing on login** — rate-limit login (~3-5/min per IP or account), temporary soft-lockout (15-20 min) rather than permanent (permanent lockout is itself a DoS vector); apply the same limiting to `/refresh` and the Google OAuth callback.
7. **Timing attacks on login** — constant-time compare + equalized response timing (see §3).
8. **OAuth `state` CSRF** — signed/stored `state` checked on the Google callback, independent of the app's own session CSRF protection.
9. **Google ID-token validation completeness** — signature via JWKS, `iss` exact match, `aud` match, `email_verified === true` gate before linking.
10. **Secret exposure** — JWT signing secret(s) and Google client secret must be server-only env vars; watch for accidental `NEXT_PUBLIC_*` prefixing in Next.js (a real, common footgun).
11. **Input validation** — max password byte-length (bcrypt 72-byte cap), server-side email format validation (not client-only).

## 6. Environment variables

- Carried over from `tech.md`: `DATABASE_URL`, `NODE_ENV`. **`NEXTAUTH_SECRET` is stale for this SPEC** (NextAuth is explicitly excluded) — replace with the naming below.
- New: `JWT_ACCESS_SECRET` (or asymmetric `JWT_ACCESS_PRIVATE_KEY`/`JWT_ACCESS_PUBLIC_KEY`); `JWT_REFRESH_SECRET` (only if the refresh token is itself a signed JWT — an **opaque random string + DB-hash lookup** is arguably simpler/safer since revocation is then a pure DB delete with no "still cryptographically valid but should be revoked" ambiguity; this is a design decision to state explicitly in the SPEC). `JWT_ACCESS_TOKEN_EXPIRY` / `JWT_REFRESH_TOKEN_EXPIRY` (configurable, not hardcoded). `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (server-only), `GOOGLE_REDIRECT_URI` (per-environment). `COOKIE_DOMAIN` / cookie-`Secure` derivation from `NODE_ENV`.
- Unrelated to this SPEC: `PG_API_KEY`/`PG_SECRET_KEY`/`PG_WEBHOOK_SECRET` (payment gateway, separate SPEC).

## Recommendations for the SPEC (summary)

1. Access token 15 min / refresh token 30 days, both configurable via env (documented default, revisitable).
2. Refresh token = **opaque random string, hashed in DB, delivered via httpOnly+Secure+SameSite cookie**; access token = short `jose`-signed JWT, client-memory only.
3. Rotation-with-family-revocation-on-reuse for `/auth/refresh`, backed by the `RefreshToken` table in §4.
4. Google OAuth via `google-auth-library`'s `OAuth2Client` (Authorization Code flow, `state` CSRF check, ID-token verification incl. `email_verified`), converging into the same JWT-issuance function as email/password login via the shared `User`/`OAuthAccount` schema.
5. bcrypt cost factor 12 (documented, revisitable), 72-byte password cap, constant-time compare, dummy-hash-on-not-found.
6. Acceptance criteria must explicitly cover: algorithm whitelisting, `exp`/`iss`/`aud` validation, refresh-reuse-detection, rate limiting (login/refresh/OAuth-callback), CSRF protection on cookie-driven endpoints, and no-secret-in-`NEXT_PUBLIC_*` guardrail.
7. Flag `tech.md`'s `NEXTAUTH_SECRET` placeholder as stale — to be replaced per the env-var naming above once this SPEC is approved.

## Sources

- OWASP JSON Web Token Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html
- RFC 9700 — Best Current Practice for OAuth 2.0 Security — https://datatracker.ietf.org/doc/rfc9700/
- Auth0 Docs — Refresh Token Rotation — https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation
- Okta Developer — Refresh access tokens and rotate refresh tokens — https://developer.okta.com/docs/guides/refresh-tokens/main/
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Authentication Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP — Blocking Brute Force Attacks — https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks
- OWASP API Security Top 10 — API2:2023 Broken Authentication — https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/
- google-auth-library-nodejs (official Google client) — https://github.com/googleapis/google-auth-library-nodejs
- next-auth Prisma adapter schema (reference shape only) — https://github.com/nextauthjs/next-auth/blob/main/packages/adapter-prisma/prisma/schema.prisma
- Cookies vs JWT Authentication: 2026 Developer Guide — https://crosscheck.cloud/blogs/cookies-vs-jwt-authentication-2026/
