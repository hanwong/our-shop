import { ProductGallery } from "@/components/product/ProductGallery";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { ReviewForm } from "@/components/product/ReviewForm";
import type { ProductDetail } from "@/features/catalog/types/product";
import type { ReviewSummary } from "@/features/reviews/types/review";

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
 *
 * SPEC-STOREFRONT-002 M4 — AddToCartButton is assembled here, immediately
 * after the stock paragraph and before the description (design.md §5's
 * precise insertion point). `AddToCartButton` is a separate client-component
 * "island" — the same pattern ProductGallery already established — so this
 * component stays a server component; only the button's own subtree crosses
 * the client boundary (plan.md §I R4).
 *
 * SPEC-REVIEW-001 M3 — a review section is appended after the description
 * (REQ-REVIEW-007/008/009), intentionally superseding REQ-STOREFRONT-009's
 * former "no reviews" assertion for the review section specifically (spec.md
 * §1). `reviewSummary`'s `body` is rendered as a plain JSX text child
 * (`{review.body}`) — never `dangerouslySetInnerHTML` — so React's default
 * escaping is what prevents stored XSS here, with no separate sanitize step
 * (plan.md M3). Both new props default so every existing caller that renders
 * `<ProductDetailView product={...} />` alone keeps working unchanged.
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

/** The pre-any-reviews shape (AC-REVIEW-008) — the default for existing callers. */
const EMPTY_REVIEW_SUMMARY: ReviewSummary = { aggregate: { averageRating: null, count: 0 }, reviews: [] };

export function ProductDetailView({
  product,
  isLoggedIn = false,
  reviewSummary = EMPTY_REVIEW_SUMMARY,
}: {
  product: ProductDetail;
  /** Whether the requesting visitor has a resolved session (REQ-REVIEW-008). */
  isLoggedIn?: boolean;
  reviewSummary?: ReviewSummary;
}) {
  const soldOut = product.stock === 0;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      {/* Only the two serializable values the gallery needs cross the
          server/client boundary — never the whole ProductDetail (plan.md §F). */}
      <ProductGallery images={product.images} productName={product.name} />

      <h1 className="mt-6 text-2xl font-semibold text-neutral-900">{product.name}</h1>

      <p className="mt-2 text-sm text-neutral-500">{product.category.name}</p>

      <p className="mt-4 text-xl font-medium text-neutral-900">{formatWon(product.price)}</p>

      <p className="mt-2 text-sm">
        {soldOut ? (
          <span className="font-medium text-red-600">품절</span>
        ) : (
          <span className="text-neutral-600">재고 {product.stock}개 남음</span>
        )}
      </p>

      <AddToCartButton productId={product.id} stock={product.stock} />

      {/* The full description, deliberately not clamped or truncated
          (AC-STOREFRONT-006). */}
      <p className="mt-6 whitespace-pre-line leading-relaxed text-neutral-800">
        {product.description}
      </p>

      {/* SPEC-REVIEW-001 M3 — average/count (REQ-REVIEW-007), the
          login-gated write branch (REQ-REVIEW-008), and the review list
          (REQ-REVIEW-009), in that order. */}
      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">리뷰</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {reviewSummary.aggregate.averageRating !== null
            ? `평균 평점 ${reviewSummary.aggregate.averageRating.toFixed(1)} · 리뷰 ${reviewSummary.aggregate.count}개`
            : `리뷰 ${reviewSummary.aggregate.count}개`}
        </p>

        {isLoggedIn ? (
          <ReviewForm productId={product.id} />
        ) : (
          <p className="mt-4 text-sm text-neutral-700">
            <a href="/login" className="underline">
              로그인하고 리뷰 남기기
            </a>
          </p>
        )}

        {reviewSummary.reviews.length > 0 ? (
          <ul className="mt-6 space-y-4">
            {reviewSummary.reviews.map((review) => (
              <li key={review.id} className="border-b border-neutral-100 pb-4">
                <p className="text-sm font-medium text-neutral-900">{review.rating}점</p>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-800">{review.body}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </article>
  );
}
