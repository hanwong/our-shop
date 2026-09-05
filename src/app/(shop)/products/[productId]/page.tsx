import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/product/ProductDetailView";
import { getProductDetail } from "@/features/catalog/services/product-service";
import { getProductReviewSummary } from "@/features/reviews/services/review-service";
import { resolveSession } from "@/lib/auth/session-resolver";

/**
 * SPEC-STOREFRONT-001 M3 — `/products/{productId}` (REQ-STOREFRONT-003/004/005).
 *
 * A thin data adapter: unwrap `params`, enter the catalog domain through the
 * service, branch on failure, hand the payload to a pure view.
 *
 * The service is called DIRECTLY rather than over this app's own
 * `GET /api/products/:id` (plan.md §B). Re-entering through HTTP would add a
 * network round trip to work that finishes in-process, require a base-URL
 * environment variable, and drop the ProductDetail contract to `any` at the
 * JSON boundary. Sharing the service instead means the page and the API can
 * never disagree about what a 404 is.
 *
 * The product itself stays anonymous by design (REQ-STOREFRONT-005): the
 * catalog lookup above needs no session, and `/products` remains absent from
 * the middleware matcher. SPEC-REVIEW-001 M3 adds a SEPARATE `resolveSession()`
 * read — used only to decide the review section's write-vs-login-prompt
 * branch (REQ-REVIEW-008) — so this page still never redirects and never
 * gates the product data itself on being logged in. The review summary is
 * read directly through `getProductReviewSummary()`, the same
 * direct-service-call pattern as `getProductDetail()` above (spec.md §1
 * "읽기는 직접 호출").
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const result = await getProductDetail(productId);

  // The only reachable failure is 404: the route segment is always a string,
  // so the service's 400 branch cannot be produced from here (plan.md §B). The
  // internal `result.error` text is intentionally dropped rather than
  // forwarded — it is not for the visitor (REQ-STOREFRONT-004).
  if (!result.ok) {
    notFound();
  }

  const [session, reviewSummary] = await Promise.all([
    resolveSession(await cookies()),
    getProductReviewSummary(productId),
  ]);

  return (
    <ProductDetailView
      product={result.data}
      isLoggedIn={session !== null}
      reviewSummary={reviewSummary}
    />
  );
}
