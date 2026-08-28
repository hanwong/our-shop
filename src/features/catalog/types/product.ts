/**
 * SPEC-CATALOG-001 M2 — catalog domain types and the tuning constants the
 * list API's validation layer reads.
 *
 * These are wire DTOs: `createdAt` / `updatedAt` are ISO-8601 STRINGS rather
 * than `Date`, because the service layer serializes them once at the response-
 * assembly boundary (plan.md §5) instead of leaving JSON serialization to the
 * framework. That keeps the response contract explicit and assertable.
 *
 * Framework-independent by design — nothing here imports from `next/*` or
 * `@prisma/client`, per structure.md's layering rule that `features/` must not
 * depend on the delivery mechanism.
 */

/** The `sort` values the list API accepts (REQ-CATALOG-008). */
export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc"] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** Applied when `page` is omitted (REQ-CATALOG-004). */
export const DEFAULT_PAGE = 1;

/** Applied when `pageSize` is omitted (REQ-CATALOG-004). */
export const DEFAULT_PAGE_SIZE = 20;

/** `pageSize` above this is clamped down, never rejected (REQ-CATALOG-006). */
export const MAX_PAGE_SIZE = 100;

/** Applied when `sort` is omitted (REQ-CATALOG-008). */
export const DEFAULT_SORT: ProductSort = "newest";

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
}

/**
 * A single row of the list response. Deliberately carries NO `description`:
 * the card-style list UI does not render it, and omitting it trims the payload
 * that REQ-CATALOG-016's p95 budget has to carry (plan.md §4.1).
 */
export interface ProductListItem {
  id: string;
  name: string;
  price: number;
  images: string[];
  stock: number;
  category: CategoryDTO;
  createdAt: string;
}

/** The detail response — every list field plus the full description. */
export interface ProductDetail extends ProductListItem {
  description: string;
  updatedAt: string;
}

/** The list response body, including the REQ-CATALOG-007 pagination metadata. */
export interface PaginatedProducts {
  items: ProductListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** A list request whose parameters have already passed validation. */
export interface ListProductsQuery {
  page: number;
  pageSize: number;
  sort: ProductSort;
  /** A `Category.slug`; absent means "no category filter". */
  category?: string;
}
