import Link from "next/link";

import { ProductGrid } from "@/components/product/ProductGrid";
import { listProducts } from "@/features/catalog/services/product-service";
import { findAllCategories } from "@/features/catalog/repositories/category-repository";
import { PRODUCT_SORTS, type PaginatedProducts, type ProductSort } from "@/features/catalog/types/product";

/**
 * SPEC-BRAND-001 M5 — `/shop`, the real product listing page
 * (REQ-BRAND-014/015/016, design.md §3.3, plan.md §B.5).
 *
 * URL-driven filter/sort (plan.md §B.5): `?category=<slug>&sort=<sort>` is
 * read here and handed straight to the existing `listProducts` service
 * (SPEC-CATALOG-001) — no new product query path is written (REQ-BRAND-016).
 * Every control below is a plain `<Link>` to a new `?category=&sort=` URL,
 * never client state, so filtering is a full server round trip — acceptable
 * at the seeded catalog's scale (plan.md §B.5 "감수하는 것").
 *
 * The category filter buttons are DERIVED from `findAllCategories()`
 * (REQ-BRAND-014's "하드코딩 금지" clause, AC-BRAND-016) — adding or removing
 * a `Category` row changes the rendered button set with zero code change.
 * `flex flex-wrap` (not a fixed grid) keeps the layout indifferent to the
 * category count (design.md §3.3), which matters because §3.5 leaves the
 * count itself PROVISIONAL (3 vs 4).
 */

const SORT_LABELS: Record<ProductSort, string> = {
  newest: "신상품순",
  price_asc: "낮은 가격순",
  price_desc: "높은 가격순",
};

const SELECTED_CLASSNAME = "bg-accent text-bg";
const UNSELECTED_CLASSNAME = "bg-neutral-200 text-text hover:bg-neutral-300";

function filterLinkClassName(selected: boolean): string {
  return `rounded-md px-3 py-1.5 text-sm transition ${selected ? SELECTED_CLASSNAME : UNSELECTED_CLASSNAME}`;
}

function buildHref(params: { category?: string; sort?: string }): string {
  const query = new URLSearchParams();
  if (params.category !== undefined) query.set("category", params.category);
  if (params.sort !== undefined) query.set("sort", params.sort);
  const search = query.toString();
  return search.length > 0 ? `/shop?${search}` : "/shop";
}

const EMPTY_PAGE: PaginatedProducts = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const sp = await searchParams;

  const query = new URLSearchParams();
  if (sp.category !== undefined) query.set("category", sp.category);
  if (sp.sort !== undefined) query.set("sort", sp.sort);

  const [result, categories] = await Promise.all([listProducts(query), findAllCategories()]);

  // An invalid `?sort=` (hand-edited URL) is the ONLY way `listProducts`
  // rejects this page's own query — falls back to the empty page rather
  // than crashing; `?category=` never rejects (an unknown slug yields an
  // empty result, REQ-CATALOG-011).
  const data = result.ok ? result.data : EMPTY_PAGE;

  const selectedCategory = sp.category;
  const selectedSort = sp.sort;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-text">SHOP</h1>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="카테고리 필터">
        <Link
          href={buildHref({ sort: selectedSort })}
          className={filterLinkClassName(selectedCategory === undefined)}
        >
          전체
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={buildHref({ category: category.slug, sort: selectedSort })}
            className={filterLinkClassName(selectedCategory === category.slug)}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="정렬">
        {PRODUCT_SORTS.map((sort) => (
          <Link
            key={sort}
            href={buildHref({ category: selectedCategory, sort })}
            className={filterLinkClassName((selectedSort ?? "newest") === sort)}
          >
            {SORT_LABELS[sort]}
          </Link>
        ))}
      </div>

      {data.totalCount === 0 ? (
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-sm text-neutral-600">해당 조건의 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid products={data.items} />
        </div>
      )}
    </main>
  );
}
