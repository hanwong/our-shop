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
const findFirst = vi.fn();
const categoryFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      // SPEC-ADMIN-002 REQ-ADMIN-035 — findProductById moved from findUnique
      // to findFirst (findUnique cannot take a non-unique `isActive` condition
      // in its where). Without this mock the delegate is `undefined` and the
      // call dies with a TypeError before any assertion runs.
      findFirst: (...args: unknown[]) => findFirst(...args),
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
  findFirst.mockReset().mockResolvedValue(null);
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

    // SPEC-ADMIN-002 REQ-ADMIN-034 — the customer-facing list is now
    // unconditionally scoped to sellable products; the category filter itself
    // is unchanged.
    expect(findMany.mock.calls[0]![0].where).toEqual({ isActive: true, categoryId: "cat-tops" });
    expect(count.mock.calls[0]![0].where).toEqual({ isActive: true, categoryId: "cat-tops" });
  });

  it("applies no where filter when no categoryId is supplied", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest" });

    // SPEC-ADMIN-002 REQ-ADMIN-034 — "no filter" now means "no CALLER-supplied
    // filter"; the isActive scope is not a caller option.
    expect(findMany.mock.calls[0]![0].where).toEqual({ isActive: true });
    expect(count.mock.calls[0]![0].where).toEqual({ isActive: true });
  });
});

describe("findProductsPage — keyword search (SPEC-CATALOG-002 REQ-CATALOG-018)", () => {
  it("matches name with a case-insensitive substring filter, never description", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest", search: "denim" });

    const where = findMany.mock.calls[0]![0].where;
    // `contains` + insensitive mode is what compiles to ILIKE '%denim%'
    // (plan.md §2.2). REQ-CATALOG-019 keeps description out of the filter.
    // SPEC-ADMIN-002 REQ-ADMIN-034 — isActive joins the clause; the name
    // filter's shape is unchanged, and description stays out of it.
    expect(where).toEqual({ isActive: true, name: { contains: "denim", mode: "insensitive" } });
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
    // SPEC-ADMIN-002 REQ-ADMIN-034 — three ANDed siblings now, not two.
    expect(findMany.mock.calls[0]![0].where).toEqual({
      isActive: true,
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

    // SPEC-ADMIN-002 REQ-ADMIN-034 — the intent this test guards is unchanged:
    // NO search condition is attached when `search` is absent. The clause is no
    // longer literally `{}` because isActive is always present.
    expect(findMany.mock.calls[0]![0].where).toEqual({ isActive: true });
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

    // SPEC-ADMIN-002 REQ-ADMIN-034 — isActive added; the term is still passed
    // through verbatim as a bound parameter.
    expect(findMany.mock.calls[0]![0].where).toEqual({
      isActive: true,
      name: { contains: "50%_off'", mode: "insensitive" },
    });
  });
});

describe("findProductById (REQ-CATALOG-013/014)", () => {
  it("selects the full detail projection including description and updatedAt", async () => {
    const { findProductById } = await import("@/features/catalog/repositories/product-repository");
    await findProductById("prod_abc");

    // SPEC-ADMIN-002 REQ-ADMIN-035 — findFirst, not findUnique; the id lookup
    // now carries the isActive scope alongside it. The projection is unchanged.
    const args = findFirst.mock.calls[0]![0];
    expect(args.where).toEqual({ id: "prod_abc", isActive: true });
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

    // SPEC-ADMIN-002 REQ-ADMIN-035 — mock target moved to findFirst; the
    // DETAIL_SELECT projection this asserts on is unchanged.
    const select = findFirst.mock.calls[0]![0].select;
    expect(select.reviews).toBeUndefined();
    expect(select.relatedProducts).toBeUndefined();
  });

  it("returns null for an id Prisma cannot find", async () => {
    const { findProductById } = await import("@/features/catalog/repositories/product-repository");
    // SPEC-ADMIN-002 REQ-ADMIN-035 — findFirst is the mock that resolves null
    // now (beforeEach); the expectation itself is unchanged.
    await expect(findProductById("prod_nonexistent")).resolves.toBeNull();
  });
});

/**
 * SPEC-ADMIN-002 M1 — the customer-facing soft-delete scope (REQ-ADMIN-034/035,
 * AC-ADMIN-034/035/036).
 *
 * These are NOT expectation refreshes of SPEC-CATALOG-001's tests above — they
 * are this SPEC's own specification tests for the new behaviour: a
 * suspended product must disappear from the customer list and read as
 * "not found" on detail, and the scope must never become a caller-selectable
 * option.
 */
describe("SPEC-ADMIN-002 — customer-facing queries are scoped to sellable products", () => {
  it("[AC-ADMIN-034] scopes the list to isActive products with NO opt-out available to callers", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest" });

    // Unconditional: there is no argument a caller can pass to see suspended
    // products through this function, so a future call site cannot forget it.
    expect(findMany.mock.calls[0]![0].where.isActive).toBe(true);
  });

  it("[AC-ADMIN-034] counts the SAME sellable population the rows are drawn from", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest", categoryId: "cat-tops", search: "denim" });

    // If the row query and the count query scoped differently, totalPages would
    // point at pages that cannot be fetched.
    expect(count.mock.calls[0]![0].where).toEqual(findMany.mock.calls[0]![0].where);
    expect(count.mock.calls[0]![0].where.isActive).toBe(true);
  });

  it("[AC-ADMIN-035] reads a suspended product as not-found rather than returning its detail", async () => {
    // findFirst with `isActive: true` matches no row for a suspended product,
    // so Prisma resolves null — the same not-found result REQ-CATALOG-014
    // already defines for an unknown id.
    findFirst.mockResolvedValue(null);
    const { findProductById } = await import("@/features/catalog/repositories/product-repository");

    await expect(findProductById("prod_suspended")).resolves.toBeNull();
    expect(findFirst.mock.calls[0]![0].where).toEqual({ id: "prod_suspended", isActive: true });
  });

  it("[AC-ADMIN-036] never exposes isActive in the customer-facing projections", async () => {
    const { findProductsPage, findProductById } = await import(
      "@/features/catalog/repositories/product-repository"
    );
    await findProductsPage({ page: 1, pageSize: 20, sort: "newest" });
    await findProductById("prod_abc");

    // Structural, not disciplinary: the value is absent from the select, so
    // toListItem/toDetail have no way to read it even by accident.
    expect(findMany.mock.calls[0]![0].select.isActive).toBeUndefined();
    expect(findFirst.mock.calls[0]![0].select.isActive).toBeUndefined();
  });

  it("[AC-ADMIN-036] leaves sort, pagination arithmetic and the detail projection untouched", async () => {
    const { findProductsPage } = await import("@/features/catalog/repositories/product-repository");
    await findProductsPage({ page: 3, pageSize: 20, sort: "price_asc", search: "denim" });

    const args = findMany.mock.calls[0]![0];
    expect(args).toMatchObject({ skip: 40, take: 20 });
    expect(args.orderBy).toEqual([{ price: "asc" }, { id: "asc" }]);
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
