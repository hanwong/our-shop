import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ProductSort } from "@/features/catalog/types/product";

/**
 * SPEC-CATALOG-001 M2 — Prisma query layer for the product catalog.
 *
 * Traces: REQ-CATALOG-007 (totalCount), REQ-CATALOG-008 (sort -> orderBy),
 * REQ-CATALOG-010 (category filter), REQ-CATALOG-013 (detail projection).
 *
 * This layer performs NO validation and applies NO defaults — it trusts the
 * arguments it is given. Validation, defaulting and clamping live one layer up
 * in services/product-service.ts (plan.md §5), so that an invalid request can
 * be rejected before any database round trip (REQ-CATALOG-005).
 */

/**
 * List projection. `description` is deliberately excluded — see
 * ProductListItem's doc comment and plan.md §4.1.
 */
const LIST_SELECT = {
  id: true,
  name: true,
  price: true,
  images: true,
  stock: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

/** Detail projection — the list fields plus the full description. */
const DETAIL_SELECT = {
  ...LIST_SELECT,
  description: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

/**
 * Every ordering carries `id` as a secondary key. Without it, rows that tie on
 * the primary key (two products at the same price, or created in the same
 * millisecond) have no defined order between queries, so a row can appear twice
 * or not at all as the client pages through the collection.
 */
const SORT_ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  price_asc: [{ price: "asc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { id: "asc" }],
};

export type ProductListRow = Prisma.ProductGetPayload<{ select: typeof LIST_SELECT }>;
export type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof DETAIL_SELECT }>;

export interface FindProductsPageArgs {
  page: number;
  pageSize: number;
  sort: ProductSort;
  /** A resolved `Category.id`; absent means "no category filter". */
  categoryId?: string;
  /**
   * A trimmed, non-empty keyword; absent means "no keyword filter".
   * Normalisation lives in the service layer (REQ-CATALOG-020) — this layer
   * trusts what it is given, like every other argument here.
   */
  search?: string;
}

export interface ProductsPage {
  rows: ProductListRow[];
  totalCount: number;
}

/**
 * Reads one page of products plus the total row count for the SAME filter.
 *
 * The two queries are issued concurrently: they are independent reads, and
 * serializing them would double the round-trip latency this endpoint spends
 * against REQ-CATALOG-016's p95 300ms budget.
 */
export async function findProductsPage({
  page,
  pageSize,
  sort,
  categoryId,
  search,
}: FindProductsPageArgs): Promise<ProductsPage> {
  // The identical `where` feeds both queries so totalCount always describes the
  // filtered set rather than the whole table (REQ-CATALOG-007 + REQ-CATALOG-010).
  //
  // Sibling keys on a Prisma where object are ANDed, so spreading the two
  // optional filters composes them without an explicit AND array
  // (REQ-CATALOG-021). Both absent leaves `{}` — byte-identical to the
  // pre-search behaviour, which is what keeps AC-CATALOG-029 holding.
  //
  // `contains` + `mode: "insensitive"` compiles to `name ILIKE '%term%'`
  // (REQ-CATALOG-018). Prisma binds the term as a parameter, so wildcards and
  // quotes inside it are matched literally rather than interpreted — and the
  // GIN trigram index added in M1 is what keeps that scan off the table.
  //
  // SPEC-ADMIN-002 REQ-ADMIN-034 — `isActive: true` is UNCONDITIONAL, not a
  // caller option. An `includeInactive?` escape hatch was rejected (that SPEC's
  // design.md §3): the admin side runs its own queries, so no consumer would
  // use it, and an unconditional scope is one a future call site cannot forget
  // to apply. Because it feeds BOTH queries below, totalCount keeps describing
  // the same sellable population the rows are drawn from (AC-ADMIN-034).
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(categoryId ? { categoryId } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      select: LIST_SELECT,
      orderBy: SORT_ORDER_BY[sort],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { rows, totalCount };
}

/**
 * Reads a single product, or null when no row carries that id (REQ-CATALOG-014).
 *
 * SPEC-ADMIN-002 REQ-ADMIN-035 — a suspended product reads as "not found"
 * rather than returning its detail, which is why the lookup carries
 * `isActive: true`. That forces `findFirst` over `findUnique`: `findUnique`
 * accepts only unique fields in its where, and `isActive` is not one. `id` is
 * still the primary key, so this remains a single indexed read with an
 * unchanged return type — the call site in product-service.ts is untouched
 * (REQ-ADMIN-036). admin-session.ts:63 uses findFirst for the same reason.
 */
export async function findProductById(id: string): Promise<ProductDetailRow | null> {
  return prisma.product.findFirst({ where: { id, isActive: true }, select: DETAIL_SELECT });
}
