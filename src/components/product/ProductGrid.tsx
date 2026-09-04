import { ProductCard } from "@/components/product/ProductCard";
import type { ProductListItem } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-003 M2 — the home product grid (REQ-STOREFRONT-033).
 *
 * Server component, no `"use client"` (REQ-STOREFRONT-039). Pure display
 * layer per AC-STOREFRONT-041 — no pagination/sort/filter props (REQ-
 * STOREFRONT-038, plan.md §J anti-pattern list).
 *
 * `<ul>`/`<li>` semantics (not `<div>`): the grid is a genuine list of
 * products, matching ProductGallery.tsx's thumbnail-strip `<ul>`/`<li>`
 * choice and CartView.tsx's item list (design-notes.md §1).
 */
export function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
