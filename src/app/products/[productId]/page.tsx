import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/product/ProductDetailView";
import { getProductDetail } from "@/features/catalog/services/product-service";

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
 * Anonymous by design (REQ-STOREFRONT-005): no session lookup, no redirect,
 * and `/products` is deliberately absent from the middleware matcher.
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

  return <ProductDetailView product={result.data} />;
}
