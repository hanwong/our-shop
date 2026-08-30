import type { ProductDetail } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-001 M3 — the product detail presentation
 * (REQ-STOREFRONT-006/007/008/009).
 *
 * A pure server component: it receives a ProductDetail and returns markup. It
 * performs NO data access, which is what lets it be rendered directly in a
 * test instead of through the async page (plan.md §F, §K R2).
 *
 * @MX:NOTE the displayed fields are written out one by one rather than
 * iterated over the payload. That explicitness is what keeps AC-STOREFRONT-009
 * holding when the catalog DTO later grows a field: a new key appears on the
 * object without silently appearing on the screen.
 */

/**
 * Renders the price as a won integer amount (REQ-STOREFRONT-007).
 *
 * `Product.price` is already an integer number of won, so this only groups
 * thousands — no minor-unit division, and no currency-style formatter, which
 * would introduce a "₩" glyph and decimal places the requirement does not want.
 */
function formatWon(price: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const soldOut = product.stock === 0;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">{product.name}</h1>

      <p className="mt-2 text-sm text-neutral-500">{product.category.name}</p>

      <p className="mt-4 text-xl font-medium text-neutral-900">{formatWon(product.price)}</p>

      <p className="mt-2 text-sm">
        {soldOut ? (
          <span className="font-medium text-red-600">품절</span>
        ) : (
          <span className="text-neutral-600">재고 {product.stock}개 남음</span>
        )}
      </p>

      {/* The full description, deliberately not clamped or truncated
          (AC-STOREFRONT-006). */}
      <p className="mt-6 whitespace-pre-line leading-relaxed text-neutral-800">
        {product.description}
      </p>
    </article>
  );
}
