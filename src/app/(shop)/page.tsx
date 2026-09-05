import { ProductGrid } from "@/components/product/ProductGrid";
import { listProducts, type ServiceResult } from "@/features/catalog/services/product-service";
import type { PaginatedProducts } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-003 M3 — the home route (REQ-STOREFRONT-031/032/036).
 *
 * Replaces the SPEC-STOREFRONT-001 §4 minimal-exception stub with the first
 * page of the product grid. Server component, no `"use client"` — the only
 * data access is this direct `listProducts` call (REQ-STOREFRONT-039).
 *
 * `listProducts(new URLSearchParams())` is called with an intentionally
 * empty query: `parseListQuery` falls back to its own defaults for every
 * absent parameter (REQ-CATALOG-004), which already matches the first-page
 * result this SPEC wants (plan.md §B) — no query object is assembled by
 * hand, and no parameter is set explicitly here.
 */
export default async function HomePage() {
  const result = await listProducts(new URLSearchParams());

  // `result.ok` is always true here: an empty URLSearchParams always passes
  // parseListQuery's validation (REQ-CATALOG-004), so the `ok: false` branch
  // is unreachable from this call site (acceptance.md §2 row 1). No
  // defensive branch is added for it (plan.md §J) — the cast documents the
  // guarantee instead of testing an unreachable path.
  const { data } = result as Extract<ServiceResult<PaginatedProducts>, { ok: true }>;
  const { items, totalCount } = data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">our-shop</h1>

      {totalCount === 0 ? (
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-sm text-neutral-600">아직 등록된 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid products={items} />
        </div>
      )}
    </main>
  );
}
