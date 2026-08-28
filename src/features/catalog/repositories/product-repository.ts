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
}: FindProductsPageArgs): Promise<ProductsPage> {
  // The identical `where` feeds both queries so totalCount always describes the
  // filtered set rather than the whole table (REQ-CATALOG-007 + REQ-CATALOG-010).
  const where: Prisma.ProductWhereInput = categoryId ? { categoryId } : {};

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

/** Reads a single product, or null when no row carries that id (REQ-CATALOG-014). */
export async function findProductById(id: string): Promise<ProductDetailRow | null> {
  return prisma.product.findUnique({ where: { id }, select: DETAIL_SELECT });
}
