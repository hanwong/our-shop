/**
 * SPEC-AUTH-001 M6 follow-up (REQ-AUTH-023 / AC-AUTH-023) — shared CSRF
 * double-submit test fixture.
 *
 * `verifyCsrfRequest()` (csrf.ts) requires a `csrf_token` cookie value that
 * matches the `X-CSRF-Token` request header. Every test in
 * tests/unit/api/auth/refresh.test.ts, tests/unit/api/auth/logout.test.ts,
 * and tests/integration/auth/logout-then-refresh.test.ts that expects a
 * route to succeed builds its request with this fixed token as BOTH the
 * cookie and the header, so the request reaches the route's own business
 * logic instead of being rejected at the CSRF gate. Rejection-path tests
 * omit or mismatch it deliberately.
 */
export const CSRF_TEST_TOKEN = "test-csrf-token-fixture-1234567890";
