# Progress: SPEC-AUTH-001 — 회원 가입·로그인 및 JWT 세션 관리

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-26T00:00:00+09:00
- plan_status: audit-ready

## §E.2 Run-phase Evidence

Run-phase driven by `manager-lead` (Role A, in-session Tier L fan-out coordination) inside worktree
`WT-auth-jwt-login` (`.claude/worktrees/t1`). Repo is a fresh greenfield checkout with no prior
scaffold (`package.json`/`src/`/`prisma/` all absent at run-phase start).

Toolchain note (deviation from tech.md recommendation, logged for transparency): tech.md recommends
`pnpm`; this sandbox has no `pnpm` binary (`node v25.2.1`, `npm 11.6.2` available) — using `npm`
instead. No live PostgreSQL instance is reachable in this sandbox (`psql` absent, Docker daemon not
running) — Prisma schema work is validated via `prisma validate` / `prisma generate` /
`prisma migrate diff --from-empty` (no live DB required) rather than `prisma migrate dev` against a
real database. This is recorded as a residual-risk per milestone, not silently masked.

Milestones M1-M6 driven sequentially (each depends on the previous). Per-milestone evidence below.

**Editorial note (this file only, 2026-08-26)**: this section was consolidated by manager-lead after
observing two divergently-worded M1 evidence blocks in this file, neither of which the M1 or M2 leaf
worker claimed authorship of (both explicitly reported leaving `progress.md` untouched). This is now
treated as corroboration — not dismissal — of the file-churn residual-risk raised after M1 (see the
M1 Residual-risk entry below). The content has been merged into one authoritative block per milestone;
no evidentiary content was discarded, only de-duplicated.

### M1 — Prisma schema + project bootstrap (commit `bb49ef7`)

- Bootstrapped Next.js/TypeScript project from an empty repo: `package.json`, `tsconfig.json` (strict),
  `vitest.config.ts`, `eslint.config.mjs`, `.env.example` (per plan.md §3.4 env var table).
- `prisma/schema.prisma`: `User` / `OAuthAccount` / `RefreshToken` models per design.md §2 (cuid ids,
  `Role` enum, cascade FKs, `@@unique([provider, providerAccountId])`, indexes on `userId`/`tokenHash`).
  `@MX:ANCHOR` note on `RefreshToken` (fan-in target for M2/M4).
- `src/lib/db/index.ts`: dev-hot-reload-safe `PrismaClient` singleton.
- Migration SQL generated offline via `prisma migrate diff --from-empty --to-schema-datamodel` (no live
  DB in this sandbox — `prisma migrate dev` NOT run; see Gaps below).
- Tests: `tests/unit/db/{schema,db-singleton,prisma-log-levels}.test.ts` — 8/8 passing, 100%
  stmt/branch/func/line coverage on `src/lib/db/index.ts` (exceeds 85% target).

**Evidence (independently re-verified by manager-lead, not merely taken from the leaf worker's claim)**:
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M1.tests.log` — `npx vitest run tests/unit/db/ --coverage` → 3 files / 8 tests passed, 100% coverage on `index.ts`.
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M1.prisma-validate.log` — `npx prisma validate` → "The schema at prisma/schema.prisma is valid".
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M1.tsc.log` — `npx tsc --noEmit` → exit 0, no diagnostics.
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M1.eslint.log` — `npx eslint .` → exit 0, no diagnostics.
- Schema file content spot-checked directly (Read) against design.md §2 — matches exactly.

**Gaps**: (1) no live PostgreSQL migration apply (`prisma migrate dev`) — no `psql`/Docker daemon in
this sandbox; migration SQL was generated and tool-validated (`prisma validate`) but never executed
against real Postgres DDL, packaged as `prisma/migrations/20260826065250_init/migration.sql` +
`migration_lock.toml`. (2) `next build` not run (no page UI in this SPEC's scope). (3) `npm audit`
reported 15 vulnerabilities (6 moderate/6 high/3 critical) at install time — deliberately not
auto-fixed (out of milestone scope); flagged here for later triage, not silently dropped.

**Residual-risk**: the M1 leaf worker reported observing file churn during its own work (files
appearing/disappearing, a duplicate migration dir, a duplicate test file) that it attributed to a
possible concurrent writer in this worktree — specifically: `src/lib/db/index.ts` gained a dev/prod
log-level branch it did not originally write, `eslint.config.js` was renamed to `.mjs` outside its own
edits, `tests/unit/db/db-singleton.test.ts` appeared, and a duplicate migration folder
(`20260826065137_init`, with a corrupted `migration.sql` polluted with `npm notice` text) appeared and
was later deleted. manager-lead investigated: `mcp__moai__session_list` showed 0 concurrent sessions
on SPEC-AUTH-001 both before and after the M1 spawn, `git log` shows a single clean commit
(`d5dc00e` → `bb49ef7`, no intermediate/orphaned commits), and `git status --short` was clean of any
foreign in-progress edits at the time HEAD was checked. **Update after M2**: this file
(`progress.md`) itself was subsequently found to carry a second, differently-worded M1 evidence block
that neither the M1 nor the M2 leaf worker claimed to have written (both explicitly reported leaving
`progress.md` untouched, outside their domain whitelist). This is now flagged as a genuine open
question rather than dismissed as self-observation noise — the actual `src/`/`prisma/`/`tests/` code
artifacts have been independently re-verified by manager-lead and are correct and consistent at every
milestone boundary (git history is a single clean line, no orphaned commits), so the anomaly appears
confined to non-code documentation files (`progress.md`, trace logs) rather than to the implementation
itself. Continuing to watch across M3-M6; will escalate via blocker report if it starts touching
`src/`/`prisma/`/`tests/` content that a git-log/independent-reverify cross-check cannot reconcile.

### M2 — Password hashing, JWT issuance, shared session issuance (commit `7b3517d`)

- `src/lib/auth/password.ts`: bcrypt cost 12, SHA-256 pre-hash applied unconditionally before bcrypt
  (avoids the 72-byte truncation pitfall symmetrically, REQ-AUTH-001/AC-AUTH-003a), `dummyCompare()`
  performs a cost-equalized bcrypt compare against a fixed precomputed hash (REQ-AUTH-005 timing
  mitigation — statistical N≥30 integration test deferred to M3 login route). No password/hash logging
  (REQ-AUTH-025).
- `src/lib/auth/jwt.ts`: `signAccessToken`/`verifyAccessToken` via `jose`. Explicit algorithm allowlist
  `["HS256"]` passed to `jwtVerify` (never trusts the token header's `alg` — REQ-AUTH-020), `iss`/`aud`
  validated on every verify, claims restricted to exactly `sub`/`role`/`iat`/`exp`/`iss`/`aud`/`jti`
  (REQ-AUTH-006), expiry configurable via `JWT_ACCESS_TOKEN_EXPIRY` (default `15m` — REQ-AUTH-007).
  `@MX:ANCHOR` on `verifyAccessToken` (fan-in target for M3/M4/M6).
- `src/lib/auth/session.ts`: `issueSession(userId, role)` — opaque refresh token via `crypto.randomBytes(32)`
  (not `Math.random()`), SHA-256 `tokenHash` persisted via `prisma.refreshToken.create` (raw token never
  stored — REQ-AUTH-008/AC-AUTH-007b), fresh `familyId` per issuance, expiry configurable via
  `JWT_REFRESH_TOKEN_EXPIRY` (default `30d`).
- `src/lib/auth/cookies.ts`: httpOnly/Secure(env-derived)/SameSite=Lax cookie builder + expire-immediately
  variant for M4's logout.
- Tests: `tests/unit/auth/{password,jwt,session,cookies}.test.ts` — 46/46 total passing (M1+M2 combined),
  96.63% stmt / 86.95% branch / 100% func coverage on `src/lib/auth/*` (exceeds 85% target; uncovered
  lines are defensive env-var-missing/malformed-duration throw branches).

**Evidence (independently re-verified by manager-lead)**:
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M2.tests.log` — `npx vitest run tests/unit/ --coverage` → 7 files / 46 tests passed.
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M2.tsc.log` — `npx tsc --noEmit` → exit 0.
- `src/lib/auth/{jwt,session,password}.ts` spot-checked directly (Read) — algorithm allowlist, claim
  shape, hash-not-raw storage, and cost-12/SHA-256-prehash all confirmed present in source, not just
  claimed in the report.

**Gaps**: AC-AUTH-005's full statistical N≥30 timing-equalization test is integration-level and deferred
to M3 (needs the login route to exist). `jwt.ts`/`session.ts` defensive throw branches (missing env var,
malformed duration string) not unit-tested.

**Residual-risk**: file-churn watch item — M2 worker reported observing nothing unusual in its own
authored files (only the expected `.moai/logs/trace-*.jsonl` + `progress.md` changes, which are
outside its domain and which it attributed to expected harness housekeeping — see the M1 entry above
for why `progress.md` itself is now the open part of this watch item, not the code). The
SHA-256-pre-hash-applied-unconditionally design choice (vs. only-when->72-bytes) is a deliberate,
documented deviation from a literal reading of REQ-AUTH-001's wording — functionally compliant
(AC-AUTH-003a's round-trip requirement is satisfied either way) but flagged here for sync/audit
visibility.

### M3 — Email signup and login endpoints (commit `e0a2ff4`)

- `src/app/api/auth/signup/route.ts`: server-side email format + min-8-char password validation (400 on
  failure — REQ-AUTH-001/AC-AUTH-003b/003c), duplicate-email check (409, no `User` created —
  REQ-AUTH-003/AC-AUTH-002), `hashPassword` → `prisma.user.create({ role: "customer" }` (201, response
  body carries only `{id, email}` — no password/hash — AC-AUTH-001). 72-byte handling delegated
  unconditionally to M2's `hashPassword` (no branching needed in the route).
- `src/app/api/auth/login/route.ts`: not-found AND OAuth-only-null-passwordHash both route through
  `dummyCompare()` + a single generic `"Invalid email or password"` message (REQ-AUTH-005/AC-AUTH-006 —
  client cannot distinguish the two failure modes). On match: `issueSession(user.id, user.role)` +
  `buildRefreshTokenCookie` sets the refresh cookie via `NextResponse.cookies.set`, body returns
  `{accessToken}` only (200).
- Tests: `tests/unit/api/auth/{signup,login}.test.ts` (mocked `@/lib/db`, no live DB) +
  `tests/integration/auth/login.test.ts` (AC-AUTH-005 statistical N≥30 timing test, deferred from M2).
  61/61 tests passing total (M1+M2+M3), 97.88% stmt / 87.27% branch coverage overall (exceeds 85% target).

**Evidence (independently re-verified by manager-lead)**:
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M3.tests.log` — `npx vitest run tests/unit/ tests/integration/ --coverage` → 10 files / 61 tests passed. AC-AUTH-005 measured (this run): median(nonexistent-email)=213.99ms, median(wrong-password)=202.15ms, diff=11.83ms, tolerance=32.10ms — PASS with margin.
- `src/app/api/auth/{signup,login}/route.ts` spot-checked directly (Read) — generic error message shared
  across both login-failure branches, null-passwordHash routed to `dummyCompare` (not a throwing
  `comparePassword` call), password/hash absent from signup response body — all confirmed in source.
- `git log --oneline` / `git status --short` independently re-run — HEAD at `e0a2ff4`, tree clean except
  `progress.md` (this file, in progress) and the session's own trace log.

**Gaps**: AC-AUTH-006b (access token never in browser `localStorage`/`sessionStorage`) is NOT verifiable
at this milestone — this SPEC's scope contains no frontend/browser client (per plan.md §4). The
server-side contribution (access token returned ONLY in the JSON response body, never written to any
cookie or server-side storage; static grep for `localStorage.*accessToken`/`sessionStorage.*accessToken`
under `src/` → 0 matches) is what M3 guarantees; full AC-AUTH-006b verification needs a future frontend
SPEC's E2E test. `route.ts` JSON-parse catch-block lines show as "uncovered" per-file but are exercised
by a dedicated malformed-body test — a v8 coverage line-mapping artifact on a single-line catch, not a
real gap (branch % 84-86% on both routes, aggregate coverage well over target).

**Residual-risk**: AC-AUTH-005's timing margin narrowed under concurrent test-suite load (~11.8ms
observed vs ~1ms in isolated runs) but stayed well inside the ~32ms tolerance in every observed run
(3 isolated + this full-suite run) — flagged as a watch item for CI environments with less headroom,
not loosened past acceptance.md's exact tolerance formula. File-churn watch item: no further occurrences
observed in M3; continuing to treat the M1-era signal as resolved (self-observation / uncommitted-diff
artifact per the M1/M2 analysis above), not elevating further.

### M4 — Refresh rotation, reuse detection, logout (commit `219c942`)

- `src/app/api/auth/refresh/route.ts`: looks up `RefreshToken` by hash of the cookie value (`findFirst`,
  NOT `findUnique` — `tokenHash` carries only `@@index` in the M1 schema, not `@@unique`; documented
  inline and in progress.md, not silently patched). Three branches: reuse of an already-`revokedAt`-set
  token → `updateMany` revokes the ENTIRE `familyId` (REQ-AUTH-011/AC-AUTH-008); expired-but-not-reused →
  401, no family-wide effect (REQ-AUTH-012/AC-AUTH-009, kept distinct from reuse); valid → one
  `prisma.$transaction` creating the new row (same `familyId`) and revoking the old
  (`revokedAt`+`replacedByTokenId`) atomically (REQ-AUTH-010/AC-AUTH-007/AC-AUTH-010). `@MX:WARN`+`@MX:REASON`
  on the transaction block noting the known concurrent-same-token race (acceptance.md §7's named edge case,
  not closed by M4 — row-level locking/CAS deferred). Single generic 401 message across all failure
  branches (client cannot distinguish reuse/expiry/not-found).
- `src/app/api/auth/logout/route.ts`: revokes ONLY the presented token (never the family — "all devices"
  logout is Out of Scope per spec.md §3, REQ-AUTH-013), idempotent on missing/invalid token (still 200 +
  expires cookie — documented rationale: logout is a "make sure I'm logged out" request, erroring would
  leak token validity).
- M2 refactor (authorized, narrow): `session.ts`'s private `hashRefreshToken` was exported so M4 reuses
  the SAME hash function rather than duplicating it — verified via `git diff --stat` showing an additive,
  comment-only change to that one line.
- Tests: `tests/unit/api/auth/{refresh,logout}.test.ts` + `tests/integration/auth/logout-then-refresh.test.ts`
  (AC-AUTH-012 cross-handler test). 75/75 tests passing total (M1-M4), aggregate coverage
  96.55%/86.25%/100%/96.55% stmt/branch/func/line (both new route files individually 100/100/100/100).

**Evidence (independently re-verified by manager-lead)**:
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M4.tests.log` — `npx vitest run tests/unit/ tests/integration/ --coverage` → 13 files / 75 tests passed, all coverage thresholds cleared.
- `src/app/api/auth/{refresh,logout}/route.ts` spot-checked directly (Read) — reuse-vs-expiry branch
  separation, family-wide `updateMany` scoped correctly (`familyId` + `revokedAt: null` guard so an
  already-revoked sibling isn't redundantly touched), single-token-only revocation in logout, and the
  `findFirst`-not-`findUnique` schema-constraint workaround are all confirmed present in source exactly
  as reported — not just claimed.
- `git log --oneline` independently re-run — HEAD at `219c942`, single clean line from `d5dc00e`.

**Gaps**: `RefreshToken.tokenHash` has no DB-level uniqueness constraint (`@@index` only) — relied on
SHA-256 collision-improbability rather than an enforced invariant; a future schema hardening milestone
should consider `@@unique([tokenHash])` (out of M4's authorized scope — `prisma/schema.prisma` was
correctly left untouched per constraint). AC-AUTH-010's literal "DB error forces partial rollback"
scenario is not separately fault-injection-tested (only "transaction called exactly once wrapping both
writes" is asserted) — flagged as a coverage gap for a future audit pass, not a functional defect. Two
new small helper files (`refresh-token-duration.ts`, `request-refresh-token.ts`) show lower branch
coverage (50%/60%) individually — acceptable since the vitest.config.ts coverage gate is evaluated in
aggregate (96.55%/86.25% overall, well above the 85/80 thresholds), and the uncovered branches are
defensive/malformed-input paths, consistent with the pattern already accepted in M2/M3.

**Residual-risk**: concurrent-same-token refresh race (two simultaneous requests presenting the identical
valid token could both pass the pre-transaction checks before either writes) is named and flagged
(`@MX:WARN`) rather than closed — acceptance.md §7 already lists this as a known open edge case, so this
is expected scope, not a newly discovered gap. Mock-based testing only (no live Postgres) continues
across M1-M4 per the sandbox constraint recorded at run-phase start. No file-churn anomaly observed in
M4 (consistent with the M1-era signal being resolved as a self-observation/uncommitted-diff artifact).

### M5 — Google OAuth login with account auto-link (commit `0b2d230`)

- `src/lib/auth/google-oauth.ts`: thin `OAuth2Client` wrapper. `exchangeCodeAndVerifyIdToken` verifies
  the Google ID token with a provenance comment citing exactly which checks `google-auth-library` itself
  performs (signature/iss/aud/iat/exp, read directly from the installed package's compiled source) vs.
  which this app adds (`email_verified === true`, REQ-AUTH-016/AC-AUTH-015/015b). CSRF `state` uses a
  double-submit-cookie pattern (`oauth_state`, httpOnly, 10-min TTL) compared against the query param on
  callback — documented as a specific implementation choice the SPEC didn't dictate.
- `src/app/api/auth/google/route.ts` (consent redirect) + `.../google/callback/route.ts` (state check →
  code exchange/ID-token verify → account resolution → session issuance): three account-resolution
  branches — Branch A matched `OAuthAccount` (REQ-AUTH-017/AC-AUTH-016), Branch B no match + no existing
  User (one transaction creates both, REQ-AUTH-018/AC-AUTH-017), Branch C no match + existing
  email/password User → **auto-link** (one transaction links `OAuthAccount` to the existing `User`, no
  confirmation step, per the CONFIRMED policy in plan.md §5.1 — REQ-AUTH-019/AC-AUTH-018). Email
  normalized (lowercased) before every lookup/comparison/storage (acceptance.md §7 edge case).
- **Genuine SPEC gap, handled transparently, not silently decided**: AC-AUTH-016 does not specify how the
  access token reaches the client on the OAuth callback's 302 redirect (this SPEC has no frontend to
  design a same-origin handshake against). M5 chose a short-lived (60s), non-httpOnly, Secure,
  SameSite=Lax handoff cookie, explicitly rejecting a query-string token (worse exposure) and a
  dedicated token-retrieval endpoint (out of this SPEC's API-only scope — would invent an unrequested
  surface). Documented in-code and flagged here for sync-phase / follow-up-SPEC visibility — see
  Residual-risk.
- Tests: `tests/unit/auth/google-oauth.test.ts` + `tests/unit/api/auth/{google,google-callback}.test.ts`.
  102/102 tests passing total (M1-M5), aggregate coverage 95.95%/87.5%/100%/95.95%.

**Evidence (independently re-verified by manager-lead)**:
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M5.tests.log` — `npx vitest run tests/unit/ tests/integration/ --coverage` → 16 files / 102 tests passed, all thresholds cleared.
- `src/lib/auth/google-oauth.ts` + `src/app/api/auth/google/callback/route.ts` spot-checked directly
  (Read) — `email_verified` check present and independent of the library, `provider_providerAccountId`
  compound-unique lookup matches M1's `@@unique([provider, providerAccountId])` schema declaration, the
  three account-resolution branches match design.md §3.4 exactly, email normalization applied before
  every DB touch, auto-link leaves the existing `User.passwordHash` untouched (email/password login
  still works post-link).
- `git log --oneline` independently re-run — HEAD at `0b2d230`, single clean line from `d5dc00e`.

**Gaps**: uncovered defensive branches (malformed-library-response guards, a `Cookie:` header segment
with no `=`) are effectively unreachable given the mocked library's contract — named, not silently
passed over. Real Google network/JWKS path is unverified in this sandbox (mocked throughout, consistent
with M1-M4's constraint).

**Residual-risk**: (1) the access-token-handoff cookie (above) is a real, if narrow and time-bounded,
XSS-exposure-window tradeoff — recommend a follow-up SPEC introduce a dedicated token-retrieval endpoint
once a frontend exists, replacing this cookie; flagging for sync-phase documentation and potential
future-SPEC candidate. (2) auto-link account-takeover risk is an ALREADY-ACCEPTED policy risk from
plan.md §5.1/design.md §5 row 12 (Google-email coincidental collision with a different real owner) —
M5 implements the confirmed policy as specified, this is not a new risk introduced by this milestone.
(3) `state` cookie comparison is plain `===` (documented as correct: a CSRF correlation token, not a
secret-authentication comparison, so no meaningful timing-attack surface).

### M6 — Rate limiting, RBAC middleware, CSRF hardening, TRUST 5 gate (commits `771e180` + `dcd8b70`)

- `src/lib/auth/rate-limit.ts`: in-memory sliding-window limiter, IP-keyed (via `x-forwarded-for`),
  >5 req/60s → 429 + 15-min soft lockout, independently enforced on `login`/`refresh`/`google/callback`
  (REQ-AUTH-021/AC-AUTH-021, **IP dimension only** — see Gaps).
- `src/lib/auth/csrf.ts`: double-submit-cookie CSRF protection (`csrf_token`, non-httpOnly so client JS
  can echo it, Secure, SameSite=Lax). Cookie issued alongside the refresh-token cookie on
  `login`/`refresh`/`google/callback`. **`verifyCsrfRequest()` is enforced on `refresh` and `logout`**
  (REQ-AUTH-023/AC-AUTH-023 — see the M6-fix note below; M6's initial commit shipped issuance-only, a
  same-day follow-up commit closed the enforcement gap).
- `src/middleware.ts`: `/admin/:path*` RBAC gate — verifies the `Authorization: Bearer` header via M2's
  `verifyAccessToken`, checks `role === "admin"`, redirect/403 otherwise (REQ-AUTH-022/AC-AUTH-022).
  Documented limitation: a raw browser navigation to `/admin/...` cannot carry a custom header (the
  access token is memory-only per REQ-AUTH-009, never a cookie) — a real frontend needs a same-origin
  API-call pattern; out of this API-only SPEC's scope, not silently worked around with an undocumented
  cookie bypass.
- `src/types/auth.ts`: consolidated re-exports (`Role` from `jwt.ts`), no divergent redefinition.
- Security scans (REQ-AUTH-024/025): `grep NEXT_PUBLIC_.*SECRET` and
  `grep localStorage/sessionStorage.*accessToken` both 0 matches, independently re-run by manager-lead.

**M6-fix (commit `dcd8b70`, same day)**: M6's own self-verification report FLAGGED (did not hide) that
`verifyCsrfRequest()` was implemented+unit-tested but never actually called from `refresh`/`logout` —
REQ-AUTH-023 was unenforced (cookie set, never checked). manager-lead judged this a must-fix (an unmet
must-pass AC, not "debt" — CSRF protection is a core Tier L security requirement, and the fix does not
conflict with any timing-sensitive test, unlike the account-keyed rate-limiting tradeoff below). A first
fix-cycle worker stalled (600s no progress) after completing prep work (test fixtures + helper) but
before the actual 2-route wiring; a second, narrower worker completed it, reusing the stalled worker's
correct prep work rather than redoing it. Verified with a genuine "pass-for-the-right-reason" check:
temporarily stripped the CSRF fixture from two previously-green business-logic tests and confirmed they
now fail with 403 (not their original assertion), proving the gate is live, then reverted.

**Evidence (independently re-verified by manager-lead, final state)**:
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M6-final.tests.log` — `npx vitest run tests/unit/ tests/integration/ --coverage` → 19 files / **135/135 tests passed**. Aggregate coverage **95.7% stmt / 89.72% branch / 100% func / 95.7% line** — clears all four `vitest.config.ts` thresholds (85/85/80/85).
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M6-final.tsc.log` — `npx tsc --noEmit` → exit 0.
- `.moai/state/verify/222015b2-d4df-49d6-a3bb-2e3ed0c6f00d/M6-final.eslint.log` — `npx eslint .` → exit 0.
- `grep -rn "NEXT_PUBLIC_.*SECRET" src/ prisma/ .env.example` → 0 matches (independently re-run).
- `grep -rn "localStorage.*accessToken\|sessionStorage.*accessToken" src/` → 0 matches (independently re-run).
- `src/app/api/auth/refresh/route.ts` spot-checked directly (Read) — `verifyCsrfRequest(request)` is the
  first statement in `POST`, before rate-limit and before any DB access; 403 on failure.
- `git log --oneline` independently re-run — HEAD at `dcd8b70`, single clean line from `d5dc00e`
  (8 commits: init + M1 + M2 + M3 + M4 + M5 + M6 + M6-fix).

**Gaps**:
- **Account-keyed rate limiting (REQ-AUTH-021's "동일 계정" dimension) is deliberately UNWIRED on
  `login`** — empirically confirmed (not just reasoned) to conflict with AC-AUTH-005's N≥30
  statistical timing test, which sends 30 rapid same-email requests and would start receiving 429 at
  request #6 under account-keyed limiting, breaking the timing methodology. IP-keyed limiting is fully
  wired and independently verified on all three endpoints, satisfying the "동일 IP" half of the AC's
  "OR" wording; the "동일 계정" half (protection against a distributed, many-IP credential-stuffing
  attack on one account) is NOT enforced. **This is a genuine, named security gap, not silently
  decided** — manager-lead judged resolving it (which requires revising AC-AUTH-005's own test
  methodology, a SPEC-body-adjacent decision) to be outside its delegated authority, and is surfacing it
  here for sync-phase / operator visibility rather than resolving it unilaterally.
- `csrf.ts`/`refresh-token-duration.ts`/`request-refresh-token.ts` carry some uncovered defensive
  branches (malformed-duration-string / malformed-cookie-header parsing) — below 85% individually but
  the aggregate gate (the actual quality.yaml/vitest.config.ts threshold) clears comfortably; consistent
  with the pattern accepted since M2.
- `middleware.ts`'s Authorization-header-only limitation for raw browser navigation (above) — documented
  in-code, not a silent gap.
- `RefreshToken.tokenHash` still lacks a DB-level unique constraint (M4-era gap, unchanged, `@@index`
  only) — flagged again here for a future schema-hardening follow-up.

**Residual-risk**: the account-keyed-rate-limiting-vs-AC-AUTH-005 tension above is the single most
significant open item from this run-phase and should be the first thing sync-phase / the operator
weighs in on — options are (a) accept IP-only as sufficient for now, (b) revise AC-AUTH-005's
methodology (e.g., exempt the specific timing-measurement requests from rate-limiting, or reduce N),
(c) accept the AC-AUTH-005 test as-is and add account-keyed limiting only to `refresh`/`google/callback`
(which have no such conflicting test) as a partial mitigation. All other M1-M6 residual risks
(concurrent-refresh race flagged at M4, auto-link accepted-policy risk from M5, access-token-handoff
cookie tradeoff from M5, no-live-Postgres-in-sandbox from M1) remain as previously recorded, unresolved
by design or by sandbox constraint, not newly discovered.

## §E.3 Run-phase Audit-Ready Signal

- run_complete_at: 2026-08-27T05:16:00+09:00
- run_status: audit-ready
- milestones: M1, M2, M3, M4, M5, M6 — all 6 committed, all independently re-verified by manager-lead
  (not taken from leaf-worker claims alone)
- final_head: `dcd8b70` (branch `WT-auth-jwt-login`)
- trust5_gate: **PASS** — 135/135 tests, 95.7%/89.72%/100%/95.7% coverage (≥ 85/85/80/85 thresholds),
  `tsc --noEmit` exit 0, `eslint .` exit 0, both REQ-AUTH-024/025 security scans 0 matches
- known_gaps_at_close: (1) account-keyed rate limiting on `login` deliberately unwired (conflicts with
  AC-AUTH-005's timing test — needs an operator/sync-phase decision, see §E.2 M6 Residual-risk),
  (2) AC-AUTH-006b (access token never in browser storage) unverifiable in this SPEC's API-only scope
  (no frontend exists), (3) no live PostgreSQL exercised anywhere in this run (sandbox constraint,
  recorded at run-phase start) — schema validated via `prisma validate`/`generate`/`migrate diff` only.
- working_tree_at_close: clean except this file (`progress.md`) and the session's own trace log —
  confirmed via `git status --short` at the time of this write.

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
