import { prisma } from "@/lib/db";

/**
 * SPEC-CATALOG-001 M2 — category lookups backing the list API's filter.
 *
 * Traces: REQ-CATALOG-010 (filter by an existing category slug),
 * REQ-CATALOG-011 (a slug matching no category yields an empty result set, not
 * an error).
 */

/**
 * Resolves a `Category.slug` to its id, or null when no category carries that
 * slug.
 *
 * Returning null rather than throwing is what lets the service answer an
 * unknown category with an empty page instead of a 404 (REQ-CATALOG-011), and
 * lets it skip the product query entirely — a filter that can match nothing
 * needs no second round trip.
 */
export async function findCategoryIdBySlug(slug: string): Promise<string | null> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  return category?.id ?? null;
}

/**
 * SPEC-BRAND-001 M5 — every category row, for `/shop`'s filter buttons
 * (REQ-BRAND-014). The caller MUST derive its button list from this result
 * rather than hardcoding names/slugs — a `Category` row added or removed
 * changes the returned array with no code change (AC-BRAND-016).
 *
 * Mirrors `listCategoriesForAdmin` (src/features/admin/repositories/
 * admin-product-repository.ts) at the query-shape level, but lives in
 * `features/catalog/` rather than `features/admin/` — the customer-facing
 * `/shop` page has no business importing an admin-scoped repository.
 */
export async function findAllCategories(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: [{ name: "asc" }],
  });
}
