# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added — SPEC-AUTH-001: Email/password and Google OAuth authentication

- `POST /api/auth/signup` — email/password registration with server-side validation, bcrypt cost-12 hashing (SHA-256 pre-hashed to defeat the 72-byte truncation limit), duplicate-email rejection.
- `POST /api/auth/login` — email/password login; a single generic error message and a dummy-compare timing-equalization path so the client cannot distinguish "no such user" from "wrong password" (AC-AUTH-005).
- `POST /api/auth/refresh` — refresh-token rotation with reuse detection (family-wide revocation on a reused/revoked token).
- `POST /api/auth/logout` — revokes the presented refresh token.
- `GET /api/auth/google` + `GET /api/auth/google/callback` — Google OAuth login: matched-account login, new-account creation, and auto-link to an existing email/password account.
- `src/middleware.ts` — RBAC gate on `/admin/*`, requiring an `admin`-role access token.
- Rate limiting (in-memory sliding window) on login/refresh/google-callback: 5 requests/60s per IP, 15-minute soft lockout.
- CSRF double-submit-cookie protection, verified on `refresh` and `logout`.
- Prisma schema: `User`, `OAuthAccount`, `RefreshToken` models.

### Fixed — sync-phase security review (2026-08-27)

A post-implementation security audit (independent quality + security review) found and closed three defects before this feature shipped:

- **Account pre-hijacking via unverified-email signup + OAuth auto-link** (critical): an attacker could register a victim's email address (no email-verification flow exists), then retain access after the victim's Google login got auto-linked to the attacker's account. Fixed by invalidating the existing password **and** revoking any live refresh tokens when auto-linking to a previously-unverified account, in the same transaction as the link itself. This required narrowing the original "auto-link always preserves password login" acceptance criterion to already-verified accounts only, with a new criterion (AC-AUTH-018b) covering the unverified case — see `.moai/specs/SPEC-AUTH-001/acceptance.md`.
- **Missing email case-normalization** in signup/login (the Google OAuth path already normalized): a mixed-case signup email was invisible to the OAuth auto-link's lowercase lookup, silently defeating both the auto-link feature and the account-hijacking fix above for any mixed-case address.
- **Rate-limit bypass via IP spoofing**: the IP extractor trusted the client-forgeable leftmost `x-forwarded-for` entry rather than the proxy-appended rightmost one, and requests with no `x-forwarded-for` header at all bypassed rate limiting entirely. Both are now closed (rightmost-entry trust; a shared rate-limited bucket for undeterminable IPs).

### Known limitations

- Account-keyed rate limiting (in addition to the wired IP-keyed limiting) is implemented but not enabled on `/login` — it conflicts with an existing statistical timing-equalization test's methodology. Tracked as `@MX:DEBT` in `src/app/api/auth/login/route.ts`.
- The Google OAuth callback hands off the access token via a short-lived (60s), non-`httpOnly` cookie — a reviewed, deliberately accepted trade-off pending a frontend SPEC that can replace it with a dedicated token-retrieval endpoint.
- No live PostgreSQL instance was available during development; the schema was validated via `prisma validate` / `generate` / `migrate diff` only, never `migrate dev` against a real database.
- A `tar` critical dependency advisory (via `bcrypt`'s install-time `node-pre-gyp` dependency) remains unresolved — tracked separately, not shipped-and-forgotten.
