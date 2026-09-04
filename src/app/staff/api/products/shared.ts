import type { ProductInputErrors } from "@/features/admin/types/admin";

/**
 * SPEC-ADMIN-002 M4 — the two things all three admin product write routes say
 * identically.
 *
 * Extracted so the routes cannot drift: REQ-ADMIN-039 requires the CSRF and
 * session rejections to be indistinguishable, which is a property of the
 * SHARED constant, not of three separately-maintained string literals.
 */

/**
 * The single rejection text for BOTH a failed CSRF check and a failed admin
 * session (REQ-ADMIN-037/039). Deliberately says nothing about which check
 * failed, nor which of the four session-failure reasons applied.
 */
export const GENERIC_AUTH_ERROR = "Not authorized";

/** Prisma's error code for a foreign-key constraint violation. */
const FK_VIOLATION_CODE = "P2003";

/**
 * True when a write failed because `categoryId` names no existing category.
 *
 * The FK constraint is the ONLY race-free existence check available: an
 * application-level `category.findUnique` pre-check would still race with a
 * category deleted between the check and the insert (design.md §4). So the
 * violation is caught and translated rather than pre-empted.
 *
 * Structural duck-typing on `.code` rather than an `instanceof
 * PrismaClientKnownRequestError` check, so this stays testable without
 * constructing a real Prisma error object.
 */
export function isMissingCategoryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === FK_VIOLATION_CODE
  );
}

/**
 * The field-error body a missing category produces — shaped exactly like
 * parseProductInput's own rejection, so the client renders it through one code
 * path whether the category was rejected by the parser or by the database.
 */
export const MISSING_CATEGORY_ERRORS: ProductInputErrors = {
  categoryId: "존재하지 않는 카테고리입니다",
};
