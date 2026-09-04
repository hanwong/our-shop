import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ProductInput } from "@/features/admin/types/admin";

/**
 * SPEC-ADMIN-002 M2/M5 — Prisma query layer for admin product management.
 *
 * Traces: REQ-ADMIN-021 (list includes suspended products), REQ-ADMIN-022
 * (category/search filter), REQ-ADMIN-023 (existing pagination convention),
 * REQ-ADMIN-024/025 (create/update), REQ-ADMIN-031/032 (suspend/restore),
 * REQ-ADMIN-020 (no physical delete path).
 *
 * Like admin-order-repository.ts and product-repository.ts, this layer performs
 * NO validation and applies NO defaults — it trusts its arguments. Validation
 * lives one layer up in services/product-validation.ts, so a bad submission is
 * rejected before any database round trip.
 *
 * @MX:NOTE this module deliberately does NOT import
 * src/features/catalog/repositories/product-repository.ts, and duplicates its
 * list/detail query shape as a result (design.md §4's self-contained
 * principle, the same call SPEC-ADMIN-001 made for admin-order-repository.ts).
 * The requirements are inverted, not merely different: the customer-facing
 * functions are UNCONDITIONALLY scoped to `isActive: true` (REQ-ADMIN-034/035)
 * while the admin list must include suspended rows (REQ-ADMIN-021). Sharing
 * would mean drilling an `includeInactive` opt-out through the customer path —
 * an escape hatch a future customer-facing call site could forget to leave
 * closed. The accepted cost is a WET pair of query shapes; a future cross-SPEC
 * refactor could revisit it once a third consumer exists.
 *
 * @MX:NOTE no index is added for `isActive` (design.md §7). Its cardinality is
 * 2 and, in normal operation, the large majority of rows are `true`, so a
 * standalone B-tree index is too unselective for the planner to prefer over a
 * scan. The form that would help is a partial index on the existing sort keys
 * (WHERE "isActive" = true), which means rewriting all three of
 * SPEC-CATALOG-001's sort indexes and is that SPEC's decision. Revisit when
 * suspended products become a material share of the table, or when
 * REQ-CATALOG-016's p95 300ms budget is actually missed in measurement.
 */

/**
 * List projection — REQ-ADMIN-021's display fields.
 *
 * Includes `isActive`, which the customer-facing LIST_SELECT deliberately
 * omits (REQ-ADMIN-036): the admin list is the surface where a suspended
 * product is found and restored, so it is the one place sellability must be
 * visible. `description` and `images` are excluded — neither is a list column.
 */
const LIST_SELECT = {
  id: true,
  name: true,
  price: true,
  stock: true,
  isActive: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

/** Detail projection — exactly the edit form's fields, plus current sellability. */
const DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  images: true,
  categoryId: true,
  isActive: true,
} satisfies Prisma.ProductSelect;

/**
 * `createdAt desc` + `id asc`, the same two keys listOrdersForAdmin uses.
 * The secondary key breaks ties between products created in the same
 * millisecond, so a row cannot repeat or vanish as the admin pages through.
 */
const ORDER_BY: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];

export type AdminProductListRow = Prisma.ProductGetPayload<{ select: typeof LIST_SELECT }>;
export type AdminProductDetailRow = Prisma.ProductGetPayload<{ select: typeof DETAIL_SELECT }>;

export interface ListProductsForAdminArgs {
  page: number;
  pageSize: number;
  /** A resolved `Category.id`; absent means "no category filter". */
  categoryId?: string;
  /** A trimmed, non-empty keyword; absent means "no keyword filter". */
  search?: string;
}

export interface AdminProductsPage {
  rows: AdminProductListRow[];
  totalCount: number;
}

/**
 * Reads one page of products plus the total row count for the SAME filter.
 *
 * NOTE the absence of any `isActive` condition — that is the requirement, not
 * an oversight (REQ-ADMIN-021). An admin who could not see suspended products
 * would have no way to restore one.
 *
 * The two queries run concurrently: independent reads, so serializing them
 * would double the round-trip latency for no benefit.
 */
export async function listProductsForAdmin({
  page,
  pageSize,
  categoryId,
  search,
}: ListProductsForAdminArgs): Promise<AdminProductsPage> {
  // Sibling keys are ANDed by Prisma, so spreading the two optional filters
  // composes them without an explicit AND array. The identical `where` feeds
  // both queries, so totalCount always describes the filtered set.
  const where: Prisma.ProductWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      select: LIST_SELECT,
      orderBy: ORDER_BY,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { rows, totalCount };
}

/**
 * Reads one product's edit-form projection, or null when no row carries that
 * id. No `isActive` condition: a suspended product must remain editable and
 * restorable, so `findUnique` on the primary key is correct here — unlike the
 * customer-facing findProductById, which had to become a `findFirst` to carry
 * the sellability scope (REQ-ADMIN-035).
 */
export async function findProductByIdForAdmin(
  productId: string
): Promise<AdminProductDetailRow | null> {
  return prisma.product.findUnique({ where: { id: productId }, select: DETAIL_SELECT });
}

/**
 * Creates a product in the sellable state (REQ-ADMIN-024).
 *
 * `isActive` is set explicitly rather than left to the column default so the
 * intent is legible at the write site: a newly registered product is on sale.
 *
 * Throws Prisma's P2003 when `categoryId` names no existing category — the
 * caller converts that into a field error. That FK violation is the only
 * race-free existence check available; an application pre-check would still
 * race with a category deleted between check and insert (design.md §4).
 */
export async function createProduct(input: ProductInput): Promise<{ id: string }> {
  const created = await prisma.product.create({
    data: { ...input, isActive: true },
    select: { id: true },
  });
  return { id: created.id };
}

export interface UpdateProductResult {
  updated: boolean;
}

/**
 * Overwrites the six editable fields of one product (REQ-ADMIN-025).
 *
 * `updateMany` rather than `update` so a missing row answers `{ count: 0 }`
 * instead of throwing P2025 — the same no-exception idiom cancelOrderAsAdmin
 * uses for its `{ transitioned: boolean }` result.
 *
 * `isActive` is absent from `data` by construction (it is not a field of
 * ProductInput), so an edit can never change sellability (design.md §1).
 *
 * NOTE `stock` here is an ABSOLUTE overwrite, while cancelOrderAsAdmin restores
 * stock with a relative `increment`. A cancellation landing while an edit form
 * is open is therefore overwritten on save. This is a KNOWN, accepted residual
 * risk, not an oversight (spec.md §4): introducing optimistic locking here
 * alone would split the concurrency model across the two write paths. The
 * mitigation is the form's own notice that saving overwrites the field.
 */
export async function updateProduct(
  productId: string,
  input: ProductInput
): Promise<UpdateProductResult> {
  const result = await prisma.product.updateMany({
    where: { id: productId },
    data: { ...input },
  });
  return { updated: result.count === 1 };
}

export interface SetProductActiveResult {
  updated: boolean;
}

/**
 * Flips sellability and NOTHING else (REQ-ADMIN-031/032).
 *
 * The `data` object carries exactly one key, which is what makes
 * REQ-ADMIN-031's guarantee structural: name, price, stock, images and
 * category cannot be disturbed by a suspend because they are not written.
 *
 * Referencing CartItem / OrderItem rows are untouched (REQ-ADMIN-033) for the
 * same structural reason — no delete is issued, so CartItem's ON DELETE
 * CASCADE never fires and OrderItem's RESTRICT never has anything to block.
 * This is precisely why the SPEC soft-deletes instead of deleting.
 */
export async function setProductActive(
  productId: string,
  isActive: boolean
): Promise<SetProductActiveResult> {
  const result = await prisma.product.updateMany({
    where: { id: productId },
    data: { isActive },
  });
  return { updated: result.count === 1 };
}

/**
 * Every category, for the product form's <select> (REQ-ADMIN-029).
 *
 * Lives here rather than in catalog's category-repository.ts (which exposes
 * only findCategoryIdBySlug) per the self-contained principle noted above —
 * that file belongs to SPEC-CATALOG-001 and is PRESERVE-listed by this SPEC.
 * Ordered by name so the dropdown is stable and scannable.
 */
export async function listCategoriesForAdmin(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: [{ name: "asc" }],
  });
}
