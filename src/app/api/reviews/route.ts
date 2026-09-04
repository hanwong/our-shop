import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { resolveSession } from "@/lib/auth/session-resolver";
import { createReview } from "@/features/reviews/services/review-service";
import type { CreateReviewInput } from "@/features/reviews/types/review";

/**
 * SPEC-REVIEW-001 M4 — `POST /api/reviews` (REQ-REVIEW-002/003).
 *
 * `POST` only — deliberately no `GET` (spec.md §1: the detail page reads
 * through `getProductReviewSummary()` directly, never over HTTP) and no
 * `PATCH`/`DELETE`/`PUT` (REQ-REVIEW-011, AC-REVIEW-015: no edit, no delete,
 * no moderation).
 *
 * Order of operations, matching the established write-route shape
 * (staff/api/products/route.ts, cart/items/route.ts):
 *
 * 1. A fresh `resolveSession()` on THIS request's own cookie (REQ-REVIEW-003)
 *    — no role check, so a customer and an admin session are treated
 *    identically (REQ-REVIEW-012, AC-REVIEW-014).
 * 2. Body parsing, rejecting malformed JSON before any service call.
 * 3. `createReview()` owns every remaining decision (rating/body validation,
 *    product existence, the duplicate pre-check, and the P2002 race
 *    fallback) — this route only maps its result onto an HTTP status.
 */
export async function POST(request: Request): Promise<Response> {
  const jar = await cookies();
  const session = await resolveSession(jar);
  if (session === null) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await createReview(session.userId, (body ?? {}) as CreateReviewInput);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
