# SPEC-CART-001 — Sync-phase Security Review (`--security` lens)

Date: 2026-08-29
Scope: `prisma/schema.prisma`, `src/lib/auth/guest-identity.ts`, `src/features/cart/**`, `src/app/api/cart/**`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/google/callback/route.ts` (git diff `cab1cdb..8b2e27d`).

## Findings

### F1 — Guest cart cookie randomness (checked, no weakness found)

`generateGuestCartId()` (`src/lib/auth/guest-identity.ts:107-109`) uses `randomBytes(32)` from Node's `crypto` module (CSPRNG), base64url-encoded — not `Math.random()`. Cookie attributes: `httpOnly: true`, `sameSite: "lax"`, `secure` in non-development environments, cookie name `guest_cart_id` (distinct from `refresh_token` / `csrf_token` / `oauth_state`), `maxAge` 14 days (distinct from the 30-day refresh token). No weakness found.

### F2 — Merge stock-clamp logic (checked, no weakness found)

`mergeGuestCartIntoUserCart()` (`src/features/cart/services/cart-service.ts:308-344`) computes `target = Math.min(guestItem.quantity + (existing?.quantity ?? 0), stock)`; when `target < 1` the existing line is deleted rather than persisted at zero. This correctly clamps merged quantities to current stock and correctly omits sold-out lines. Matches AC-CART-012 / AC-CART-013. No weakness found.

### F3 — Auth-route additions are non-invasive (checked, no weakness found)

Both `src/app/api/auth/login/route.ts` and `src/app/api/auth/google/callback/route.ts` gate 100% of the new cart-merge code behind `if (guestCartId !== null)`, call `mergeGuestCartIntoUserCart` inside a `try { } catch { }` that never lets a cart-merge failure fail the login/OAuth response, and run only after the pre-existing session-issuance code. The baseline auth test suites (132 tests) pass unchanged file-for-file (`Test Files 16 passed (16)` / `Tests 132 passed (132)`, identical to the run-phase baseline in progress.md §E.2/§E.3). No weakness found.

## Accepted residual (already documented, not a new finding)

- **Merge-failure observability gap**: a cart-merge failure inside the login/OAuth success path is intentionally swallowed (never allowed to fail login) but this repository has no logging infrastructure, so a merge failure is not recorded anywhere. This is a known, already-documented observability gap (`progress.md` §E.2 "환경 제약으로 검증 불가" — 병합 실패의 관측 가능성), reiterated here rather than newly discovered.

## Verdict

PASS — no blocking security defects found. One accepted residual (observability gap), already tracked, not a new item.
