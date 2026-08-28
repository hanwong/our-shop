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
