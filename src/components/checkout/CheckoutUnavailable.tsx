/**
 * SPEC-ORDER-001 M5 — the screen shown when there is no guest cart to check out
 * (REQ-ORDER-006, design.md §7.1).
 *
 * THE WORDING IS A CONTRACT, not a stylistic choice, and AC-ORDER-006 pins it.
 *
 * A request arriving without a resolvable guest cart is one of two people, and
 * the server cannot tell them apart: a visitor who has never added anything, or
 * a member who just logged in — because login expires the guest cookie and the
 * access token lives only in client memory, so a member reaches a
 * server-rendered page carrying no identity at all (research.md §6).
 *
 * Two rules follow, and both are load-bearing:
 *
 *  1. Do not assert that the visitor's cart is empty. For the member that is
 *     simply false: their cart may be full and merely unreachable from here.
 *     Say only what the server actually observed — that this request carries no
 *     guest cart it can find.
 *  2. Say that member checkout is out of scope. It is the only way a logged-in
 *     member can learn why this screen has nothing for them; without it the
 *     page looks broken rather than bounded.
 */
export function CheckoutUnavailable() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">주문서를 열 수 없습니다</h1>

      {/* Rule 1 — the observation, not a conclusion about the visitor. */}
      <p className="mt-4 text-sm leading-relaxed text-neutral-700">
        이 요청에 연결된 게스트 장바구니를 찾을 수 없습니다. 상품을 담은 뒤 다시 시도해 주세요.
      </p>

      {/* Rule 2 — the scope notice. */}
      <p className="mt-3 text-sm leading-relaxed text-neutral-500">
        현재는 비회원(게스트) 주문만 지원합니다. 회원 체크아웃은 아직 제공되지 않으며, 로그인한
        상태에서는 이 화면에서 장바구니를 불러올 수 없습니다.
      </p>
    </section>
  );
}
