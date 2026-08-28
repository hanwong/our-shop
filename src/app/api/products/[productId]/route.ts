import { NextResponse } from "next/server";
import { getProductDetail } from "@/features/catalog/services/product-service";

/**
 * SPEC-CATALOG-001 M4 — GET /api/products/:productId (public product detail).
 *
 * Traces: REQ-CATALOG-003 (public — no authentication), REQ-CATALOG-013 (full
 * representation including the complete description), REQ-CATALOG-014 (404 for
 * an unknown id), REQ-CATALOG-015 (no reviews, no related products).
 *
 * `params` is awaited because Next.js 15 delivers dynamic route parameters as
 * a Promise; destructuring it synchronously would yield undefined.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ productId: string }> }
): Promise<Response> {
  const { productId } = await context.params;

  const result = await getProductDetail(productId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
