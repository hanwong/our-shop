import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CATALOG-001 M2 — src/features/catalog/repositories/*.
 *
 * Traces: REQ-CATALOG-007 (totalCount for the pagination metadata),
 * REQ-CATALOG-008 (sort -> orderBy mapping), REQ-CATALOG-010 (category filter),
 * REQ-CATALOG-013 (detail projection), REQ-CATALOG-014 (missing id -> null).
 *
 * No live PostgreSQL in this sandbox, so @/lib/db is mocked (the same pattern
 * SPEC-AUTH-001 established in tests/unit/api/auth/login.test.ts). These tests
 * assert the QUERY ARGUMENTS the repository hands to Prisma — the projection,
 * the ordering, the where clause, and the skip/take arithmetic — because that
 * argument shape is the part of the repository this project can verify without
 * a database.
 */

const findMany = vi.fn();
const count = vi.fn();
const findUnique = vi.fn();
const categoryFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
    category: {
      findUnique: (...args: unknown[]) => categoryFindUnique(...args),
    },
  },
}));

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
  count.mockReset().mockResolvedValue(0);
  findUnique.mockReset().mockResolvedValue(null);
  categoryFindUnique.mockReset().mockResolvedValue(null);
});

describe("findProductsPage — projection", () => {
  it("[AC-CATALOG-008 support] selects list fields but NOT description (plan.md §4.1 payload trim)", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest" });

    const select = findMany.mock.calls[0]![0].select;
    expect(select).toMatchObject({
      id: true,
      name: true,
      price: true,
      images: true,
      stock: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
    });
    expect(select.description).toBeUndefined();
    expect(select.updatedAt).toBeUndefined();
  });
});

describe("findProductsPage — pagination arithmetic (REQ-CATALOG-004/007)", () => {
  it.each([
    { page: 1, pageSize: 20, skip: 0, take: 20 },
    { page: 2, pageSize: 20, skip: 20, take: 20 },
    { page: 3, pageSize: 20, skip: 40, take: 20 },
    { page: 99, pageSize: 20, skip: 1960, take: 20 },
    { page: 1, pageSize: 100, skip: 0, take: 100 },
  ])("page=$page pageSize=$pageSize -> skip=$skip take=$take", async ({ page, pageSize, skip, take }) => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page, pageSize, sort: "newest" });

    expect(findMany.mock.calls[0]![0]).toMatchObject({ skip, take });
  });

  it("returns the row array alongside the total count used for totalPages", async () => {
    findMany.mockResolvedValue([{ id: "p1" }]);
    count.mockResolvedValue(43);
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");

    const result = await findProductsPage({ page: 1, pageSize: 20, sort: "newest" });

    expect(result.totalCount).toBe(43);
    expect(result.rows).toEqual([{ id: "p1" }]);
  });
});

describe("findProductsPage — sort mapping (REQ-CATALOG-008)", () => {
  it.each([
    { sort: "newest" as const, primary: { createdAt: "desc" } },
    { sort: "price_asc" as const, primary: { price: "asc" } },
    { sort: "price_desc" as const, primary: { price: "desc" } },
  ])("maps sort=$sort to its Prisma orderBy", async ({ sort, primary }) => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort });

    const orderBy = findMany.mock.calls[0]![0].orderBy;
    expect(orderBy[0]).toEqual(primary);
    // A stable secondary key keeps pagination deterministic when the primary
    // key ties — without it a row can repeat or vanish across page boundaries.
    expect(orderBy[1]).toEqual({ id: "asc" });
  });
});

describe("findProductsPage — category filter (REQ-CATALOG-010)", () => {
  it("filters findMany AND count by the same categoryId so totalCount matches the filtered set", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest", categoryId: "cat-tops" });

    expect(findMany.mock.calls[0]![0].where).toEqual({ categoryId: "cat-tops" });
    expect(count.mock.calls[0]![0].where).toEqual({ categoryId: "cat-tops" });
  });

  it("applies no where filter when no categoryId is supplied", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest" });

    expect(findMany.mock.calls[0]![0].where).toEqual({});
    expect(count.mock.calls[0]![0].where).toEqual({});
  });
});

describe("findProductsPage — keyword search (SPEC-CATALOG-002 REQ-CATALOG-018)", () => {
  it("matches name with a case-insensitive substring filter, never description", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest", search: "denim" });

    const where = findMany.mock.calls[0]![0].where;
    // `contains` + insensitive mode is what compiles to ILIKE '%denim%'
    // (plan.md §2.2). REQ-CATALOG-019 keeps description out of the filter.
    expect(where).toEqual({ name: { contains: "denim", mode: "insensitive" } });
    expect(where.description).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it("[AC-CATALOG-021] composes search AND category into one where clause", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({
      page: 1,
      pageSize: 20,
      sort: "newest",
      categoryId: "cat-tops",
      search: "denim",
    });

    // Sibling keys on a Prisma where object are ANDed, so a product must match
    // BOTH to be returned — "Denim Jeans" in bottoms must not survive this.
    expect(findMany.mock.calls[0]![0].where).toEqual({
      categoryId: "cat-tops",
      name: { contains: "denim", mode: "insensitive" },
    });
  });

  it("[AC-CATALOG-024] applies the identical where to findMany and count", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 2, pageSize: 20, sort: "newest", search: "denim" });

    // totalCount must describe the SEARCHED set, not the whole table, or the
    // client's totalPages points at pages that cannot be fetched.
    expect(count.mock.calls[0]![0].where).toEqual(findMany.mock.calls[0]![0].where);
  });

  it("leaves the where clause empty when search is absent (REGRESSION — AC-CATALOG-029)", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest" });

    expect(findMany.mock.calls[0]![0].where).toEqual({});
  });

  it("still paginates and sorts normally alongside a search filter", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 3, pageSize: 20, sort: "price_asc", search: "denim" });

    const args = findMany.mock.calls[0]![0];
    expect(args).toMatchObject({ skip: 40, take: 20 });
    expect(args.orderBy[0]).toEqual({ price: "asc" });
  });

  it("passes a term containing SQL wildcards through as a bound parameter", async () => {
    // acceptance.md §2: Prisma parameterises the value, so %/_/' are data, not
    // syntax. The repository must not pre-escape or reject them.
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest", search: "50%_off'" });

    expect(findMany.mock.calls[0]![0].where).toEqual({
      name: { contains: "50%_off'", mode: "insensitive" },
    });
  });
});

describe("findProductById (REQ-CATALOG-013/014)", () => {
  it("selects the full detail projection including description and updatedAt", async () => {
    const { findProductById } = await import("@/features/catalog/repositories/product-repository");
    await findProductById("prod_abc");

    const args = findUnique.mock.calls[0]![0];
    expect(args.where).toEqual({ id: "prod_abc" });
    expect(args.select).toMatchObject({
      id: true,
      name: true,
      price: true,
      description: true,
      images: true,
      stock: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true } },
    });
  });

  it("[AC-CATALOG-015] never selects reviews or relatedProducts", async () => {
    const { findProductById } = await import("@/features/catalog/repositories/product-repository");
    await findProductById("prod_abc");

    const select = findUnique.mock.calls[0]![0].select;
    expect(select.reviews).toBeUndefined();
    expect(select.relatedProducts).toBeUndefined();
  });

  it("returns null for an id Prisma cannot find", async () => {
    const { findProductById } = await import("@/features/catalog/repositories/product-repository");
    await expect(findProductById("prod_nonexistent")).resolves.toBeNull();
  });
});

describe("findCategoryIdBySlug (REQ-CATALOG-010/011)", () => {
  it("resolves a known slug to its category id", async () => {
    categoryFindUnique.mockResolvedValue({ id: "cat-tops" });
    const { findCategoryIdBySlug } = await import("@/features/catalog/repositories/category-repository");

    await expect(findCategoryIdBySlug("tops")).resolves.toBe("cat-tops");
    expect(categoryFindUnique.mock.calls[0]![0].where).toEqual({ slug: "tops" });
  });

  it("[AC-CATALOG-011] resolves an unknown slug to null rather than throwing", async () => {
    categoryFindUnique.mockResolvedValue(null);
    const { findCategoryIdBySlug } = await import("@/features/catalog/repositories/category-repository");

    await expect(findCategoryIdBySlug("nonexistent-category")).resolves.toBeNull();
  });
});
