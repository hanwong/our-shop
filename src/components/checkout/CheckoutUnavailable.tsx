/**
 * SPEC-ORDER-001 M5 — the screen shown when there is no cart to check out
 * (REQ-ORDER-006, design.md §7.1), amended by SPEC-ORDER-004 M7 once member
 * checkout shipped (REQ-ORDER-063, AC-ORDER-068, design.md §5.3).
 *
 * THE WORDING IS A CONTRACT, not a stylistic choice, and AC-ORDER-068 pins it.
 *
 * Two audiences reach this screen now: a member whose cart is empty, and a
 * request carrying no resolvable cart at all — a visitor who has never added
 * anything, or a member who just logged in, because login expires the guest
 * cookie and the access token lives only in client memory, so a member can
 * reach a server-rendered page carrying no identity at all (research.md §6).
 *
 * One rule follows, and it is load-bearing: do not assert that the visitor's
 * cart is empty. For the member arriving without identity that is simply
 * false — their cart may be full and merely unreachable from here. Say only
 * what the server actually observed: that this request carries no cart it can
 * find. That sentence is true for both audiences, which is why it carries no
 * "게스트" qualifier.
 *
 * The scope notice that used to sit below this — that member checkout was not
 * yet supported — is REMOVED rather than rephrased. SPEC-ORDER-004 shipped
 * member checkout, which made it false, and its entire content was the scope
 * limitation, so it has no true replacement.
 */
export function CheckoutUnavailable() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">주문서를 열 수 없습니다</h1>

      {/* The observation, not a conclusion about the visitor. */}
      <p className="mt-4 text-sm leading-relaxed text-neutral-700">
        이 요청에 연결된 장바구니를 찾을 수 없습니다. 상품을 담은 뒤 다시 시도해 주세요.
      </p>
    </section>
  );
}
