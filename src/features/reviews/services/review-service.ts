import type { CreateReviewInput, Review, ReviewSummary } from "@/features/reviews/types/review";
import {
  aggregateByProduct,
  create,
  findByUserAndProduct,
  listByProduct,
  productExists,
  type ReviewRow,
} from "@/features/reviews/repositories/review-repository";

/**
 * SPEC-REVIEW-001 M2 — validation, duplicate handling and response assembly
 * for the review domain (REQ-REVIEW-001/003~007).
 *
 * @MX:ANCHOR fan-in target — `POST /api/reviews` and the product detail page
 * enter this domain exclusively through `createReview()` /
 * `getProductReviewSummary()`. The repository is never called from app/.
 * @MX:REASON this is the only place rating/body validation and the
 * duplicate-review decision are made, so a regression here is a data-quality
 * or authorization-adjacent hole on a public write endpoint, not a local bug.
 *
 * Framework-independent by design, matching product-service.ts / cart-service.ts:
 * plain inputs in, discriminated results out — HTTP mapping stays in route.ts.
 */

export type ReviewResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404 | 409; error: string };

/** `body`, trimmed, must not exceed this length (plan.md M2 §D). */
const MAX_BODY_LENGTH = 2000;

const DUPLICATE_REVIEW_ERROR = "이미 이 상품에 리뷰를 작성했습니다";
const PRODUCT_NOT_FOUND_ERROR = "존재하지 않는 상품입니다";
const INVALID_PRODUCT_ID_ERROR = "Invalid 'productId' — expected a string";
const INVALID_RATING_ERROR = "Invalid 'rating' — expected an integer from 1 to 5";
const INVALID_BODY_ERROR = `Invalid 'body' — expected non-empty text up to ${MAX_BODY_LENGTH} characters`;

/** An integer 1-5 only — a decimal or an out-of-range value is rejected (REQ-REVIEW-005). */
function parseRating(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  return raw >= 1 && raw <= 5 ? raw : null;
}

/** Trimmed, non-empty, and within the 2000-character cap (REQ-REVIEW-005, plan.md M2). */
function parseBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_BODY_LENGTH) return null;
  return trimmed;
}

/**
 * Structural duck-typing on `.code`, the same pattern order-service.ts's
 * `isUniqueViolation()` and shared.ts's `isMissingCategoryError()` already
 * use — keeps this testable without constructing a real Prisma error object.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    userId: row.userId,
    productId: row.productId,
    rating: row.rating,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * `POST /api/reviews`'s domain logic (REQ-REVIEW-001/003~006, REQ-REVIEW-012).
 *
 * Validation order matters for "persist nothing on rejection": productId
 * shape, then rating, then body, then the product's existence, then the
 * duplicate pre-check — all before any write. `userId` carries no role check
 * (REQ-REVIEW-012 — an admin account reviews exactly like a customer,
 * AC-REVIEW-014); the caller (route.ts) is what already established the
 * session, this function does not care which role it belongs to.
 *
 * The duplicate pre-check alone is not race-free (spec.md §1): two concurrent
 * requests can both pass it, so the `create()` call is wrapped separately and
 * a P2002 violation from the `@@unique([userId, productId])` constraint is
 * caught and mapped to the SAME structured 409 the pre-check produces
 * (AC-REVIEW-016). Any other error re-throws unchanged.
 */
export async function createReview(
  userId: string,
  input: CreateReviewInput
): Promise<ReviewResult<Review>> {
  const productId = typeof input.productId === "string" ? input.productId : null;
  if (!productId) {
    return { ok: false, status: 400, error: INVALID_PRODUCT_ID_ERROR };
  }

  const rating = parseRating(input.rating);
  if (rating === null) {
    return { ok: false, status: 400, error: INVALID_RATING_ERROR };
  }

  const body = parseBody(input.body);
  if (body === null) {
    return { ok: false, status: 400, error: INVALID_BODY_ERROR };
  }

  if (!(await productExists(productId))) {
    return { ok: false, status: 404, error: PRODUCT_NOT_FOUND_ERROR };
  }

  const existing = await findByUserAndProduct(userId, productId);
  if (existing) {
    return { ok: false, status: 409, error: DUPLICATE_REVIEW_ERROR };
  }

  try {
    const row = await create(userId, productId, rating, body);
    return { ok: true, data: toReview(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, status: 409, error: DUPLICATE_REVIEW_ERROR };
    }
    throw error;
  }
}

/**
 * The product detail page's single read entry point (REQ-REVIEW-007/009,
 * plan.md §C "읽기는 직접 호출"). Rounds the average to one decimal place
 * (REQ-REVIEW-007) here, once, so every caller sees the same figure.
 */
export async function getProductReviewSummary(productId: string): Promise<ReviewSummary> {
  const [aggregate, rows] = await Promise.all([
    aggregateByProduct(productId),
    listByProduct(productId),
  ]);

  return {
    aggregate: {
      averageRating:
        aggregate.averageRating === null ? null : Math.round(aggregate.averageRating * 10) / 10,
      count: aggregate.count,
    },
    reviews: rows.map(toReview),
  };
}
