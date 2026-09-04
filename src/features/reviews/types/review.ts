/**
 * SPEC-REVIEW-001 M2 — review domain types.
 *
 * Wire DTOs: `createdAt` is an ISO-8601 STRING rather than `Date`, the same
 * convention product.ts already uses (the service layer serializes once at
 * the response-assembly boundary, plan.md §C).
 *
 * Framework-independent by design — nothing here imports from `next/*` or
 * `@prisma/client`, matching structure.md's layering rule.
 */

/** The shape a `POST /api/reviews` body is expected to carry, pre-validation. */
export interface CreateReviewInput {
  productId?: unknown;
  rating?: unknown;
  body?: unknown;
}

/** One persisted review, projected onto the wire shape. */
export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  body: string;
  createdAt: string;
}

/**
 * The product-level rollup `prisma.review.aggregate()` produces.
 * `averageRating` is `null` — never `0` or `NaN` — when the product has no
 * reviews yet (AC-REVIEW-008).
 */
export interface ReviewAggregate {
  averageRating: number | null;
  count: number;
}

/** `getProductReviewSummary()`'s combined return — aggregate + full list. */
export interface ReviewSummary {
  aggregate: ReviewAggregate;
  /** Newest first (REQ-REVIEW-009) — the ordering is the repository's job. */
  reviews: Review[];
}
