import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  MAX_PAGE_SIZE,
  PRODUCT_SORTS,
  type ListProductsQuery,
  type PaginatedProducts,
  type ProductDetail,
  type ProductListItem,
  type ProductSort,
} from "@/features/catalog/types/product";
import {
  findProductById,
  findProductsPage,
  type ProductDetailRow,
  type ProductListRow,
} from "@/features/catalog/repositories/product-repository";
import { findCategoryIdBySlug } from "@/features/catalog/repositories/category-repository";

/**
 * SPEC-CATALOG-001 M3 — query validation, defaulting and response assembly for
 * the public catalog endpoints.
 *
 * Traces: REQ-CATALOG-004 (defaults), REQ-CATALOG-005 (reject invalid
 * pagination without reading the database), REQ-CATALOG-006 (clamp an
 * oversized pageSize), REQ-CATALOG-007 (pagination metadata), REQ-CATALOG-008
 * /009 (sort defaulting and rejection), REQ-CATALOG-010/011 (category filter),
 * REQ-CATALOG-013/014/015 (detail, 404, field whitelist).
 *
 * @MX:ANCHOR fan-in target — three callers enter the catalog domain
 * exclusively through listProducts() and getProductDetail(): the two public
 * route handlers under src/app/api/products/, and the product detail page at
 * src/app/products/[productId]/page.tsx (SPEC-STOREFRONT-001). The
 * repositories are never called from the app/ layer directly.
 * @MX:REASON this module is the only place query parameters are validated, so
 * a regression here is an input-validation hole on two unauthenticated public
 * endpoints, not a local bug.
 *
 * Framework-independent by design (structure.md layering): it accepts a plain
 * URLSearchParams and returns a discriminated result, leaving the mapping onto
 * HTTP responses to the route handlers.
 */

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404; error: string };

/**
 * Parses one query parameter as a positive integer.
 *
 * An ABSENT parameter falls back to the caller's default (REQ-CATALOG-004); a
 * PRESENT one must be a positive integer or the whole request is rejected
 * (REQ-CATALOG-005). An empty value (`?page=`) counts as present-and-invalid:
 * the requirement rejects a received value that is not an integer, and an empty
 * string is not one.
 *
 * `^\d+$` alone rejects "abc", "1.5", "-1" and ""; the two numeric guards then
 * reject "0" and values too large to hold exactly as a JavaScript integer.
 */
function parsePositiveInt(raw: string | null, fallback: number): number | null {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

/** Narrows a raw `sort` value to the supported set (REQ-CATALOG-008/009). */
function parseSort(raw: string | null): ProductSort | null {
  if (raw === null) return DEFAULT_SORT;
  return (PRODUCT_SORTS as readonly string[]).includes(raw) ? (raw as ProductSort) : null;
}

/**
 * Normalises the `search` term (REQ-CATALOG-020).
 *
 * This returns a value rather than a nullable result because a blank term is
 * NOT a validation failure: `?search=` and `?search=%20%20` mean "the user
 * cleared the search box", which is a request for the unfiltered list, not a
 * malformed request. So unlike parsePositiveInt / parseSort, there is no error
 * branch here and no 400 is reachable from this parameter.
 *
 * Trimming happens before the emptiness test so a whitespace-only term
 * normalises to absent, and a padded term ("  denim  ") filters on "denim"
 * rather than on a string no product name contains.
 *
 * No minimum length is imposed (plan.md §2.4): Prisma parameterises the term so
 * a short one opens no injection surface, and the M1 trigram index — not an
 * arbitrary length floor — is what bounds the cost of a broad match.
 */
function parseSearch(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Validates and normalises the list query.
 *
 * Note the ordering: an oversized pageSize is a VALID positive integer, so it
 * passes the integer guard and is then clamped (REQ-CATALOG-006) rather than
 * rejected — only non-integers and non-positive values reach the 400 branch
 * (REQ-CATALOG-005).
 */
export function parseListQuery(searchParams: URLSearchParams): ServiceResult<ListProductsQuery> {
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  if (page === null) {
    return { ok: false, status: 400, error: "Invalid 'page' — expected a positive integer" };
  }

  const requestedPageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  if (requestedPageSize === null) {
    return { ok: false, status: 400, error: "Invalid 'pageSize' — expected a positive integer" };
  }

  const sort = parseSort(searchParams.get("sort"));
  if (sort === null) {
    return {
      ok: false,
      status: 400,
      error: `Invalid 'sort' — expected one of: ${PRODUCT_SORTS.join(", ")}`,
    };
  }

  const category = searchParams.get("category");
  const search = parseSearch(searchParams.get("search"));

  return {
    ok: true,
    data: {
      page,
      pageSize: Math.min(requestedPageSize, MAX_PAGE_SIZE),
      sort,
      ...(category === null ? {} : { category }),
      ...(search === undefined ? {} : { search }),
    },
  };
}

/**
 * Projects a query row onto the wire DTO.
 *
 * The object is built field by field rather than spread from the row: an
 * explicit whitelist is what guarantees AC-CATALOG-015 keeps holding when a
 * later SPEC adds `reviews` or `relatedProducts` to the row shape.
 */
function toListItem(row: ProductListRow): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    images: row.images,
    stock: row.stock,
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(row: ProductDetailRow): ProductDetail {
  return {
    ...toListItem(row),
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function emptyPage(query: ListProductsQuery): PaginatedProducts {
  return { items: [], page: query.page, pageSize: query.pageSize, totalCount: 0, totalPages: 0 };
}

/**
 * `GET /api/products` — one validated, filtered, searched, sorted page.
 *
 * SPEC-CATALOG-002 added `search`, a case-insensitive substring match on the
 * product NAME (REQ-CATALOG-017/018); `description` is not matched
 * (REQ-CATALOG-019). It is the only spelling read — `q` remains unsupported and
 * falls through silently (plan.md §2.1 deliberately declined an alias).
 *
 * Filters compose with AND: a request carrying both `search` and `category`
 * returns only products satisfying both (REQ-CATALOG-021).
 */
export async function listProducts(
  searchParams: URLSearchParams
): Promise<ServiceResult<PaginatedProducts>> {
  const parsed = parseListQuery(searchParams);
  if (!parsed.ok) return parsed;
  const query = parsed.data;

  let categoryId: string | undefined;
  if (query.category !== undefined) {
    const resolved = await findCategoryIdBySlug(query.category);
    // A slug matching no category is an empty result, never an error
    // (REQ-CATALOG-011). Returning here also skips a product query whose filter
    // could not have matched anything.
    //
    // This check stays AHEAD of the search query on purpose: the two filters
    // are ANDed, so an unmatched category already fixes the answer at empty and
    // no search term can widen it. Evaluating search first would spend a round
    // trip that cannot change the result (acceptance.md §2).
    if (resolved === null) return { ok: true, data: emptyPage(query) };
    categoryId = resolved;
  }

  const { rows, totalCount } = await findProductsPage({
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    categoryId,
    search: query.search,
  });

  return {
    ok: true,
    data: {
      items: rows.map(toListItem),
      page: query.page,
      pageSize: query.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / query.pageSize),
    },
  };
}

/** `GET /api/products/:id` — the full representation, or a 404 result. */
export async function getProductDetail(id: string): Promise<ServiceResult<ProductDetail>> {
  const row = await findProductById(id);
  if (row === null) return { ok: false, status: 404, error: "Product not found" };
  return { ok: true, data: toDetail(row) };
}
