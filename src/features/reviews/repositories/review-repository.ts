import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * SPEC-REVIEW-001 M2 — Prisma query layer for the review domain.
 *
 * Performs NO validation and applies NO defaults — it trusts the arguments it
 * is given, the same layering rule product-repository.ts and
 * cart-repository.ts already follow (plan.md §C). Validation, the duplicate
 * pre-check, and the P2002 race fallback all live one layer up in
 * review-service.ts.
 */

export type ReviewRow = Prisma.ReviewGetPayload<Record<string, never>>;

/**
 * Creates one review row. Left un-wrapped — a concurrent duplicate raises
 * Prisma's raw `P2002` unique-constraint error, which review-service.ts
 * catches and maps to a structured 409 (spec.md §1, plan.md M2, AC-REVIEW-016).
 */
export async function create(userId: string, productId: string, rating: number, body: string): Promise<ReviewRow> {
  return prisma.review.create({ data: { userId, productId, rating, body } });
}

/** The service-level pre-check (REQ-REVIEW-004) — not race-free on its own. */
export async function findByUserAndProduct(userId: string, productId: string): Promise<ReviewRow | null> {
  return prisma.review.findUnique({ where: { userId_productId: { userId, productId } } });
}

/** Newest-first (REQ-REVIEW-009). */
export async function listByProduct(productId: string): Promise<ReviewRow[]> {
  return prisma.review.findMany({ where: { productId }, orderBy: { createdAt: "desc" } });
}

/**
 * `prisma.review.aggregate()`'s raw rollup for one product (REQ-REVIEW-007).
 * `_avg.rating` is `null` when the product has no reviews — Prisma's own
 * behaviour, not a case this function needs to special-case.
 */
export async function aggregateByProduct(
  productId: string
): Promise<{ averageRating: number | null; count: number }> {
  const result = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });
  return { averageRating: result._avg.rating, count: result._count };
}

/**
 * A direct existence check (REQ-REVIEW-006) — plan.md M2 explicitly allows
 * either the catalog repository or a direct Prisma query; this stays
 * independent of the catalog domain rather than reaching into its
 * `isActive`-filtered `findProductById` (a suspended product is out of scope
 * for this SPEC either way, per spec.md §3).
 */
export async function productExists(productId: string): Promise<boolean> {
  const row = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  return row !== null;
}
