import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CATALOG-001 M3 — src/features/catalog/services/product-service.ts.
 *
 * Traces: REQ-CATALOG-004 (defaults), REQ-CATALOG-005 (reject invalid
 * page/pageSize BEFORE touching the database), REQ-CATALOG-006 (clamp an
 * oversized pageSize instead of rejecting it), REQ-CATALOG-007 (pagination
 * metadata), REQ-CATALOG-008/009 (sort defaulting and rejection),
 * REQ-CATALOG-010/011 (category filter, unknown slug -> empty set),
 * REQ-CATALOG-012 (no search parameter), REQ-CATALOG-013/014/015 (detail
 * projection, 404, no reviews/relatedProducts).
 *
 * The REPOSITORIES are mocked here rather than Prisma itself: this suite is
 * about validation, defaulting and response assembly, and mocking at the
 * repository seam is what lets AC-CATALOG-006 assert the stronger claim that
 * an invalid request performs no database read at all.
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
    ...overrides,
  };
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return row({ description: "가볍고 통기성 좋은 여름용 린넨 셔츠.", updatedAt: UPDATED_AT, ...overrides });
}

/** Builds the URLSearchParams the route handler would hand the service. */
function params(query: string): URLSearchParams {
  return new URL(`http://localhost/api/products${query}`).searchParams;
}

beforeEach(() => {
  findProductsPage.mockReset().mockResolvedValue({ rows: [], totalCount: 0 });
  findProductById.mockReset().mockResolvedValue(null);
  findCategoryIdBySlug.mockReset().mockResolvedValue(null);
});

describe("listProducts — defaults (AC-CATALOG-005 / REQ-CATALOG-004)", () => {
  it("applies page=1, pageSize=20 and sort=newest when no query parameters are given", async () => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params(""));

    expect(result.ok).toBe(true);
    expect(findProductsPage).toHaveBeenCalledWith({ page: 1, pageSize: 20, sort: "newest", categoryId: undefined });
  });

  it("caps a full default page at 20 items", async () => {
    findProductsPage.mockResolvedValue({
      rows: Array.from({ length: 20 }, (_, i) => row({ id: `p${i}` })),
      totalCount: 21,
    });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params(""));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(20);
    expect(result.data.items).toHaveLength(20);
  });
});

describe("listProducts — invalid pagination (AC-CATALOG-006 / REQ-CATALOG-005)", () => {
  it.each(["?page=0", "?page=-1", "?page=abc", "?page=1.5", "?pageSize=0", "?pageSize=-5", "?pageSize=xyz"])(
    "rejects %s with 400 and performs NO database read",
    async (query) => {
      const { listProducts } = await import("@/features/catalog/services/product-service");

      const result = await listProducts(params(query));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(400);
      expect(findProductsPage).not.toHaveBeenCalled();
      expect(findCategoryIdBySlug).not.toHaveBeenCalled();
    }
  );

  it("rejects an integer too large to represent exactly", async () => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?page=99999999999999999999"));

    expect(result.ok).toBe(false);
    expect(findProductsPage).not.toHaveBeenCalled();
  });
});

describe("listProducts — pageSize clamp (AC-CATALOG-007 / REQ-CATALOG-006)", () => {
  it("clamps pageSize=500 down to 100 and still answers 200 rather than 400", async () => {
    findProductsPage.mockResolvedValue({
      rows: Array.from({ length: 100 }, (_, i) => row({ id: `p${i}` })),
      totalCount: 250,
    });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?pageSize=500"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.pageSize).toBe(100);
    expect(result.data.items).toHaveLength(100);
    expect(findProductsPage).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
  });

  it("leaves pageSize=100 (exactly the maximum) untouched", async () => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    await listProducts(params("?pageSize=100"));

    expect(findProductsPage).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
  });
});

describe("listProducts — pagination metadata (AC-CATALOG-008 / REQ-CATALOG-007)", () => {
  it("reports totalCount=43 as totalPages=3 at pageSize=20", async () => {
    findProductsPage.mockResolvedValue({ rows: [row()], totalCount: 43 });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?page=1&pageSize=20"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ page: 1, pageSize: 20, totalCount: 43, totalPages: 3 });
  });

  it("reports totalPages=0 for an empty catalog rather than dividing by zero", async () => {
    findProductsPage.mockResolvedValue({ rows: [], totalCount: 0 });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params(""));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ items: [], totalCount: 0, totalPages: 0 });
  });

  it("[acceptance.md §9] answers a page past the end with 200 and an empty item list", async () => {
    findProductsPage.mockResolvedValue({ rows: [], totalCount: 43 });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?page=99"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toEqual([]);
    expect(result.data.page).toBe(99);
  });
});

describe("listProducts — sort (AC-CATALOG-009 / REQ-CATALOG-008/009)", () => {
  it.each(["newest", "price_asc", "price_desc"])("passes the supported sort=%s through to the query layer", async (sort) => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params(`?sort=${sort}`));

    expect(result.ok).toBe(true);
    expect(findProductsPage).toHaveBeenCalledWith(expect.objectContaining({ sort }));
  });

  it("defaults to newest when sort is omitted", async () => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    await listProducts(params(""));

    expect(findProductsPage).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest" }));
  });

  it("rejects an unsupported sort with 400 and no database read", async () => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?sort=popularity"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(findProductsPage).not.toHaveBeenCalled();
  });
});

describe("listProducts — category filter (AC-CATALOG-010/011 / REQ-CATALOG-010/011)", () => {
  it("resolves a known slug to its id and filters the query by it", async () => {
    findCategoryIdBySlug.mockResolvedValue("cat-tops");
    findProductsPage.mockResolvedValue({
      rows: [row({ id: "p1" }), row({ id: "p2" })],
      totalCount: 2,
    });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?category=tops"));

    expect(findCategoryIdBySlug).toHaveBeenCalledWith("tops");
    expect(findProductsPage).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "cat-tops" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items.every((item) => item.category.slug === "tops")).toBe(true);
  });

  it("answers an unknown slug with an empty 200 page — not 400, not 404", async () => {
    findCategoryIdBySlug.mockResolvedValue(null);
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?category=nonexistent-category"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ items: [], totalCount: 0, totalPages: 0, page: 1, pageSize: 20 });
  });

  it("skips the product query entirely when the category cannot match anything", async () => {
    findCategoryIdBySlug.mockResolvedValue(null);
    const { listProducts } = await import("@/features/catalog/services/product-service");

    await listProducts(params("?category=nonexistent-category"));

    expect(findProductsPage).not.toHaveBeenCalled();
  });

  it("applies no category filter when the parameter is absent", async () => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    await listProducts(params(""));

    expect(findCategoryIdBySlug).not.toHaveBeenCalled();
    expect(findProductsPage).toHaveBeenCalledWith(expect.objectContaining({ categoryId: undefined }));
  });
});

describe("listProducts — no search support (AC-CATALOG-012 / REQ-CATALOG-012)", () => {
  it("ignores q and search entirely, querying exactly as an unparameterised request would", async () => {
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params("?q=%EA%B2%80%EC%83%89%EC%96%B4&search=%EA%B2%80%EC%83%89%EC%96%B4"));

    expect(result.ok).toBe(true);
    expect(findProductsPage).toHaveBeenCalledWith({ page: 1, pageSize: 20, sort: "newest", categoryId: undefined });
  });
});

describe("listProducts — list item shape (REQ-CATALOG-007, AC-CATALOG-015)", () => {
  it("emits exactly the list fields, omitting description and any relation payload", async () => {
    findProductsPage.mockResolvedValue({ rows: [detailRow()], totalCount: 1 });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params(""));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const item = result.data.items[0]!;
    expect(Object.keys(item).sort()).toEqual([
      "category",
      "createdAt",
      "id",
      "images",
      "name",
      "price",
      "stock",
    ]);
    expect(Object.keys(item.category).sort()).toEqual(["id", "name", "slug"]);
  });

  it("serializes createdAt as an ISO-8601 string rather than leaking a Date", async () => {
    findProductsPage.mockResolvedValue({ rows: [row()], totalCount: 1 });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params(""));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]!.createdAt).toBe("2026-08-20T01:02:03.000Z");
  });

  it("[acceptance.md §9] passes through an empty images array and stock=0 without error", async () => {
    findProductsPage.mockResolvedValue({ rows: [row({ images: [], stock: 0 })], totalCount: 1 });
    const { listProducts } = await import("@/features/catalog/services/product-service");

    const result = await listProducts(params(""));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]!.images).toEqual([]);
    expect(result.data.items[0]!.stock).toBe(0);
  });
});

describe("getProductDetail (AC-CATALOG-013/014/015)", () => {
  it("returns the full representation including description for an existing id", async () => {
    findProductById.mockResolvedValue(detailRow());
    const { getProductDetail } = await import("@/features/catalog/services/product-service");

    const result = await getProductDetail("prod_abc");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      id: "prod_abc",
      name: "린넨 셔츠",
      price: 39000,
      description: "가볍고 통기성 좋은 여름용 린넨 셔츠.",
      stock: 12,
      category: { id: "cat-tops", name: "상의", slug: "tops" },
    });
    expect(result.data.images).toEqual(["https://cdn.example.com/a.jpg"]);
    expect(result.data.createdAt).toBe("2026-08-20T01:02:03.000Z");
    expect(result.data.updatedAt).toBe("2026-08-21T04:05:06.000Z");
  });

  it("returns 404 for an id no product carries", async () => {
    findProductById.mockResolvedValue(null);
    const { getProductDetail } = await import("@/features/catalog/services/product-service");

    const result = await getProductDetail("prod_nonexistent");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("emits exactly the detail fields — no reviews, no relatedProducts", async () => {
    findProductById.mockResolvedValue({
      ...detailRow(),
      // Fields a future SPEC might add to the row; the whitelist must drop them.
      reviews: [{ id: "r1" }],
      relatedProducts: [{ id: "p2" }],
    });
    const { getProductDetail } = await import("@/features/catalog/services/product-service");

    const result = await getProductDetail("prod_abc");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.data).sort()).toEqual([
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
