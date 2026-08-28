import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CATALOG-001 M4 — src/app/api/products/route.ts and
 * src/app/api/products/[productId]/route.ts.
 *
 * Traces: REQ-CATALOG-003 (public access), REQ-CATALOG-005/006 (400 vs clamp
 * as seen at the HTTP boundary), REQ-CATALOG-007 (metadata in the body),
 * REQ-CATALOG-010/011 (category filter), REQ-CATALOG-013/014/015 (detail, 404,
 * field whitelist).
 *
 * Mocked at the REPOSITORY seam rather than the service seam, so each test
 * exercises the route handler and the service together — the ACs are stated in
 * terms of HTTP status codes and response bodies, and mocking the service away
 * would stop these tests from observing either.
 */

const findProductsPage = vi.fn();
const findProductById = vi.fn();
const findCategoryIdBySlug = vi.fn();

vi.mock("@/features/catalog/repositories/product-repository", () => ({
  findProductsPage: (...args: unknown[]) => findProductsPage(...args),
  findProductById: (...args: unknown[]) => findProductById(...args),
}));

vi.mock("@/features/catalog/repositories/category-repository", () => ({
  findCategoryIdBySlug: (...args: unknown[]) => findCategoryIdBySlug(...args),
}));

const CREATED_AT = new Date("2026-08-20T01:02:03.000Z");
const UPDATED_AT = new Date("2026-08-21T04:05:06.000Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_abc",
    name: "린넨 셔츠",
    price: 39000,
    images: ["https://cdn.example.com/a.jpg"],
    stock: 12,
    category: { id: "cat-tops", name: "상의", slug: "tops" },
    createdAt: CREATED_AT,
    description: "가볍고 통기성 좋은 여름용 린넨 셔츠.",
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** A request carrying NO Authorization header and no cookies (AC-CATALOG-003). */
function listRequest(query = ""): Request {
  return new Request(`http://localhost/api/products${query}`, { method: "GET" });
}

function detailContext(productId: string) {
  return { params: Promise.resolve({ productId }) };
}

beforeEach(() => {
  findProductsPage.mockReset().mockResolvedValue({ rows: [], totalCount: 0 });
  findProductById.mockReset().mockResolvedValue(null);
  findCategoryIdBySlug.mockReset().mockResolvedValue(null);
});

describe("GET /api/products — public access (AC-CATALOG-003)", () => {
  it("answers 200 for an unauthenticated request, never 401 or 403", async () => {
    const { GET } = await import("@/app/api/products/route");

    const response = await GET(listRequest());

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("still answers 200 when an Authorization header happens to be present but invalid", async () => {
    const { GET } = await import("@/app/api/products/route");

    const response = await GET(
      new Request("http://localhost/api/products", {
        method: "GET",
        headers: { authorization: "Bearer not-a-real-token" },
      })
    );

    expect(response.status).toBe(200);
  });
});

describe("GET /api/products — response body (AC-CATALOG-007/008)", () => {
  it("serialises items plus page, pageSize, totalCount and totalPages", async () => {
    findProductsPage.mockResolvedValue({ rows: [row()], totalCount: 43 });
    const { GET } = await import("@/app/api/products/route");

    const response = await GET(listRequest("?page=1&pageSize=20"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ page: 1, pageSize: 20, totalCount: 43, totalPages: 3 });
    expect(body.items).toHaveLength(1);
  });

  it("omits description from every list item (plan.md §4.1)", async () => {
    findProductsPage.mockResolvedValue({ rows: [row()], totalCount: 1 });
    const { GET } = await import("@/app/api/products/route");

    const body = await (await GET(listRequest())).json();

    expect(body.items[0].description).toBeUndefined();
    expect(body.items[0].name).toBe("린넨 셔츠");
  });

  it("clamps an oversized pageSize to 100 and reports the clamped value (AC-CATALOG-007)", async () => {
    const { GET } = await import("@/app/api/products/route");

    const response = await GET(listRequest("?pageSize=500"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pageSize).toBe(100);
  });
});

describe("GET /api/products — rejected queries (AC-CATALOG-006 / AC-CATALOG-009)", () => {
  it.each(["?page=0", "?page=abc", "?pageSize=-5", "?sort=popularity"])(
    "answers %s with 400 and an error message, without reading the database",
    async (query) => {
      const { GET } = await import("@/app/api/products/route");

      const response = await GET(listRequest(query));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(typeof body.error).toBe("string");
      expect(findProductsPage).not.toHaveBeenCalled();
    }
  );
});

describe("GET /api/products — category filter (AC-CATALOG-010/011)", () => {
  it("returns only the matching category's items for a known slug", async () => {
    findCategoryIdBySlug.mockResolvedValue("cat-tops");
    findProductsPage.mockResolvedValue({ rows: [row({ id: "p1" }), row({ id: "p2" })], totalCount: 2 });
    const { GET } = await import("@/app/api/products/route");

    const body = await (await GET(listRequest("?category=tops"))).json();

    expect(body.items).toHaveLength(2);
    expect(body.items.every((item: { category: { slug: string } }) => item.category.slug === "tops")).toBe(true);
  });

  it("answers an unknown slug with 200 and an empty result set, not 400 or 404", async () => {
    findCategoryIdBySlug.mockResolvedValue(null);
    const { GET } = await import("@/app/api/products/route");

    const response = await GET(listRequest("?category=nonexistent-category"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.totalCount).toBe(0);
  });
});

describe("GET /api/products/:id (AC-CATALOG-004/013/014/015)", () => {
  it("answers 200 for an existing id without any authentication", async () => {
    findProductById.mockResolvedValue(row());
    const { GET } = await import("@/app/api/products/[productId]/route");

    const response = await GET(
      new Request("http://localhost/api/products/prod_abc"),
      detailContext("prod_abc")
    );

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(401);
  });

  it("returns the full representation including the complete description", async () => {
    findProductById.mockResolvedValue(row());
    const { GET } = await import("@/app/api/products/[productId]/route");

    const body = await (
      await GET(new Request("http://localhost/api/products/prod_abc"), detailContext("prod_abc"))
    ).json();

    expect(body).toMatchObject({
      id: "prod_abc",
      name: "린넨 셔츠",
      price: 39000,
      description: "가볍고 통기성 좋은 여름용 린넨 셔츠.",
      stock: 12,
      category: { id: "cat-tops", name: "상의", slug: "tops" },
    });
    expect(body.images).toEqual(["https://cdn.example.com/a.jpg"]);
  });

  it("passes the dynamic route segment through to the repository as the lookup id", async () => {
    findProductById.mockResolvedValue(row());
    const { GET } = await import("@/app/api/products/[productId]/route");

    await GET(new Request("http://localhost/api/products/prod_xyz"), detailContext("prod_xyz"));

    expect(findProductById).toHaveBeenCalledWith("prod_xyz");
  });

  it("answers 404 for an id no product carries", async () => {
    findProductById.mockResolvedValue(null);
    const { GET } = await import("@/app/api/products/[productId]/route");

    const response = await GET(
      new Request("http://localhost/api/products/prod_nonexistent"),
      detailContext("prod_nonexistent")
    );

    expect(response.status).toBe(404);
    expect(typeof (await response.json()).error).toBe("string");
  });

  it("[AC-CATALOG-015] carries no reviews and no relatedProducts key", async () => {
    findProductById.mockResolvedValue({
      ...row(),
      reviews: [{ id: "r1" }],
      relatedProducts: [{ id: "p2" }],
    });
    const { GET } = await import("@/app/api/products/[productId]/route");

    const body = await (
      await GET(new Request("http://localhost/api/products/prod_abc"), detailContext("prod_abc"))
    ).json();

    expect(body.reviews).toBeUndefined();
    expect(body.relatedProducts).toBeUndefined();
    expect(Object.keys(body).sort()).toEqual([
      "category",
      "createdAt",
      "description",
      "id",
      "images",
      "name",
      "price",
      "stock",
      "updatedAt",
    ]);
  });
});
