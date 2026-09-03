/**
 * SPEC-STOREFRONT-002 M1 — the guidance screen shown when there is no cart
 * to show at "/cart" (REQ-STOREFRONT-017, design.md §4).
 *
 * A pure server component, matching CheckoutUnavailable and
 * ProductDetailView: it receives no props, performs no data access, and
 * returns markup only — so it can be rendered directly in a test.
 *
 * Reused verbatim from CheckoutUnavailable's visual pattern (design.md §4):
 * same container width, same heading/body scale. The one structural
 * difference is the trailing link — REQ-STOREFRONT-017 explicitly requires
 * a way back to browsing, which CheckoutUnavailable's screen has no need
 * for.
 *
 * The link points at "/" rather than a literal "/products" listing route:
 * this repository has no product-list page — only "/" (the home-route stub
 * SPEC-STOREFRONT-001 built as the browsing entry point) and the dynamic
 * "/products/[productId]" detail route exist. Linking to "/products" would
 * be a dead link in this codebase's actual current state.
 */
export function EmptyCart() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">장바구니가 비어 있습니다</h1>
      <p className="mt-4 text-sm leading-relaxed text-neutral-700">
        아직 담은 상품이 없습니다. 상품을 둘러보고 장바구니에 담아 보세요.
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        상품 목록으로 이동
      </a>
    </section>
  );
}
