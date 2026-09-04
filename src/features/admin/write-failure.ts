/**
 * SPEC-ADMIN-003 M4 — the one message every admin write shows when its
 * request never reached a handler (REQ-ADMIN-046).
 *
 * Why this exists as a module rather than three string literals: the failure
 * it names is identical at all three call sites, and three separately-
 * maintained copies is how one of them ends up saying something else. The
 * same reasoning already produced GENERIC_AUTH_ERROR on the server side.
 *
 * @MX:NOTE the wording is load-bearing, not cosmetic. The defect this SPEC
 * closes was not "the write failed" — it was "the write failed and the screen
 * said it succeeded". A generic "저장에 실패했습니다" would report the failure
 * while erasing its cause, which is exactly why the `redirect: "manual"`
 * alternative was rejected (design.md §3.3): it produces ok:false with an
 * empty body, so the caller falls through to the pre-existing generic
 * wording. This sentence instead says what actually happened — the request
 * was not processed, and nothing was saved — so an operator who sees it knows
 * the screen is not lying about the outcome.
 */
export const REQUEST_NOT_DELIVERED =
  "요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.";
