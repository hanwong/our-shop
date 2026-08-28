import { NextResponse } from "next/server";
import { listProducts } from "@/features/catalog/services/product-service";

/**
 * SPEC-CATALOG-001 M4 — GET /api/products (public product list).
 *
 * Traces: REQ-CATALOG-003 (public — no authentication of any kind),
 * REQ-CATALOG-004/005/006 (pagination defaults, rejection, clamping),
 * REQ-CATALOG-007 (pagination metadata), REQ-CATALOG-008/009 (sorting),
 * REQ-CATALOG-010/011 (category filter).
 *
 * The handler is deliberately thin: it parses the URL, delegates every
 * decision to the catalog service, and maps the service's discriminated result
 * onto a response (structure.md layering — app/ routes, features/ decides).
 *
 * This route is NOT covered by src/middleware.ts, whose matcher is
 * ["/admin/:path*"], so no authentication runs ahead of it — which is exactly
 * what REQ-CATALOG-003 requires. Adding this path to that matcher would break
 * AC-CATALOG-003.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const result = await listProducts(searchParams);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
