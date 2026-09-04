import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ADMIN-002 M2/M5 — src/features/admin/repositories/admin-product-repository.
 *
 * Traces: REQ-ADMIN-021 (the admin list includes suspended products),
 * REQ-ADMIN-022 (category/search filter), REQ-ADMIN-024/025 (create/update),
 * REQ-ADMIN-031/032/033 (suspend/restore touches sellability ONLY).
 *
 * No live PostgreSQL is assumed here, so @/lib/db is mocked — the same pattern
 * admin-order-repository.test.ts uses. These tests assert the QUERY ARGUMENTS
 * handed to Prisma, because that argument shape is what decides the invariants
 * this SPEC cares about: that the admin list is NOT scoped to sellable rows,
 * and that a suspend writes nothing but `isActive`.
 */

const findMany = vi.fn();
const count = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const categoryFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
    category: {
      findMany: (...args: unknown[]) => categoryFindMany(...args),
    },
  },
}));

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
  count.mockReset().mockResolvedValue(0);
  findUnique.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue({ id: "prod_new" });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  categoryFindMany.mockReset().mockResolvedValue([]);
});

async function repo() {
  return import("@/features/admin/repositories/admin-product-repository");
}

describe("[AC-ADMIN-021a] listProductsForAdmin — suspended products are INCLUDED", () => {
  it("applies no isActive condition, so the admin sees what the customer cannot", async () => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page: 1, pageSize: 20 });

    // The inverse of findProductsPage's unconditional scope. An admin who
    // cannot see a suspended product has no way to restore it.
    expect(findMany.mock.calls[0]![0].where).toEqual({});
    expect(findMany.mock.calls[0]![0].where.isActive).toBeUndefined();
  });

  it("selects isActive so the list can show which products are suspended", async () => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page: 1, pageSize: 20 });

    expect(findMany.mock.calls[0]![0].select).toMatchObject({
      id: true,
      name: true,
      price: true,
      stock: true,
      isActive: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
    });
  });
});

describe("[AC-ADMIN-022] listProductsForAdmin — category and search filters", () => {
  it("filters by categoryId", async () => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page: 1, pageSize: 20, categoryId: "cat-tops" });

    expect(findMany.mock.calls[0]![0].where).toEqual({ categoryId: "cat-tops" });
  });

  it("matches the name case-insensitively, never the description", async () => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page: 1, pageSize: 20, search: "denim" });

    const where = findMany.mock.calls[0]![0].where;
    expect(where).toEqual({ name: { contains: "denim", mode: "insensitive" } });
    expect(where.description).toBeUndefined();
  });

  it("ANDs search and category into one clause", async () => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page: 1, pageSize: 20, categoryId: "cat-tops", search: "denim" });

    expect(findMany.mock.calls[0]![0].where).toEqual({
      categoryId: "cat-tops",
      name: { contains: "denim", mode: "insensitive" },
    });
  });

  it("counts the SAME filtered population the rows are drawn from", async () => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page: 2, pageSize: 20, search: "denim" });

    expect(count.mock.calls[0]![0].where).toEqual(findMany.mock.calls[0]![0].where);
  });
});

describe("[AC-ADMIN-023] listProductsForAdmin — pagination and stable ordering", () => {
  it.each([
    { page: 1, pageSize: 20, skip: 0, take: 20 },
    { page: 2, pageSize: 20, skip: 20, take: 20 },
    { page: 3, pageSize: 50, skip: 100, take: 50 },
  ])("page=$page pageSize=$pageSize -> skip=$skip take=$take", async ({ page, pageSize, skip, take }) => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page, pageSize });

    expect(findMany.mock.calls[0]![0]).toMatchObject({ skip, take });
  });

  it("orders by createdAt desc with id as the tie-breaker, matching listOrdersForAdmin", async () => {
    const { listProductsForAdmin } = await repo();
    await listProductsForAdmin({ page: 1, pageSize: 20 });

    // Without the secondary key, rows created in the same millisecond have no
    // defined order and can repeat or vanish across page boundaries.
    expect(findMany.mock.calls[0]![0].orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });

  it("returns the rows alongside the total count", async () => {
    findMany.mockResolvedValue([{ id: "p1" }]);
    count.mockResolvedValue(43);
    const { listProductsForAdmin } = await repo();

    const result = await listProductsForAdmin({ page: 1, pageSize: 20 });

    expect(result.rows).toEqual([{ id: "p1" }]);
    expect(result.totalCount).toBe(43);
  });
});

describe("findProductByIdForAdmin — reads a product regardless of sellability", () => {
  it("looks up by id with no isActive condition, so a suspended product can still be edited", async () => {
    const { findProductByIdForAdmin } = await repo();
    await findProductByIdForAdmin("prod_abc");

    expect(findUnique.mock.calls[0]![0].where).toEqual({ id: "prod_abc" });
  });

  it("selects the editable field set plus isActive", async () => {
    const { findProductByIdForAdmin } = await repo();
    await findProductByIdForAdmin("prod_abc");

    expect(findUnique.mock.calls[0]![0].select).toMatchObject({
      id: true,
      name: true,
      description: true,
      price: true,
      stock: true,
      images: true,
      categoryId: true,
      isActive: true,
    });
  });

  it("returns null for an id that does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const { findProductByIdForAdmin } = await repo();

    await expect(findProductByIdForAdmin("prod_nope")).resolves.toBeNull();
  });
});

const INPUT = {
  name: "린넨 셔츠",
  description: "설명",
  price: 39000,
  stock: 12,
  categoryId: "cat-tops",
  images: ["https://cdn.example.com/a.jpg"],
};

describe("[AC-ADMIN-024] createProduct", () => {
  it("writes exactly the submitted fields", async () => {
    const { createProduct } = await repo();
    await createProduct(INPUT);

    expect(create.mock.calls[0]![0].data).toMatchObject(INPUT);
  });

  it("creates the product sellable, without the caller having to say so", async () => {
    const { createProduct } = await repo();
    await createProduct(INPUT);

    // Either explicitly true, or omitted and left to the column default —
    // what must never happen is a new product arriving suspended.
    const { isActive } = create.mock.calls[0]![0].data;
    expect(isActive === true || isActive === undefined).toBe(true);
  });

  it("returns the new product's id", async () => {
    create.mockResolvedValue({ id: "prod_new" });
    const { createProduct } = await repo();

    await expect(createProduct(INPUT)).resolves.toEqual({ id: "prod_new" });
  });
});

describe("[AC-ADMIN-025] updateProduct", () => {
  it("updates exactly the submitted fields for that one product", async () => {
    const { updateProduct } = await repo();
    await updateProduct("prod_abc", INPUT);

    expect(updateMany.mock.calls[0]![0].where).toEqual({ id: "prod_abc" });
    expect(updateMany.mock.calls[0]![0].data).toEqual(INPUT);
  });

  it("never writes isActive, so an edit cannot change sellability", async () => {
    const { updateProduct } = await repo();
    await updateProduct("prod_abc", INPUT);

    expect(updateMany.mock.calls[0]![0].data).not.toHaveProperty("isActive");
  });

  it("reports updated=false for a product that does not exist, without throwing", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const { updateProduct } = await repo();

    await expect(updateProduct("prod_nope", INPUT)).resolves.toEqual({ updated: false });
  });

  it("reports updated=true when the row was written", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const { updateProduct } = await repo();

    await expect(updateProduct("prod_abc", INPUT)).resolves.toEqual({ updated: true });
  });
});

describe("[AC-ADMIN-031/032/033] setProductActive — sellability and nothing else", () => {
  it.each([false, true])("writes ONLY isActive=%p", async (isActive) => {
    const { setProductActive } = await repo();
    await setProductActive("prod_abc", isActive);

    const data = updateMany.mock.calls[0]![0].data;
    // The whole point of REQ-ADMIN-031: a suspend must not disturb name,
    // price, stock, images or category. Asserting the exact data object is
    // what makes that guarantee structural rather than aspirational.
    expect(data).toEqual({ isActive });
    expect(updateMany.mock.calls[0]![0].where).toEqual({ id: "prod_abc" });
  });

  it("[AC-ADMIN-033] never touches CartItem or OrderItem", async () => {
    const { setProductActive } = await repo();
    await setProductActive("prod_abc", false);

    // A soft delete leaves referencing rows alone by construction: the only
    // write issued is the product updateMany above. If this function ever
    // reached for cartItem/orderItem the mock would have no such delegate and
    // the call would throw.
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("reports updated=false for a product that does not exist", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const { setProductActive } = await repo();

    await expect(setProductActive("prod_nope", false)).resolves.toEqual({ updated: false });
  });
});

describe("[AC-ADMIN-029] listCategoriesForAdmin — the form's select options", () => {
  it("reads the id/name/slug of every category, ordered by name", async () => {
    const { listCategoriesForAdmin } = await repo();
    await listCategoriesForAdmin();

    const args = categoryFindMany.mock.calls[0]![0];
    expect(args.select).toEqual({ id: true, name: true, slug: true });
    expect(args.orderBy).toEqual([{ name: "asc" }]);
  });

  it("returns the rows as given", async () => {
    categoryFindMany.mockResolvedValue([{ id: "cat-tops", name: "상의", slug: "tops" }]);
    const { listCategoriesForAdmin } = await repo();

    await expect(listCategoriesForAdmin()).resolves.toEqual([
      { id: "cat-tops", name: "상의", slug: "tops" },
    ]);
  });
});

describe("REQ-ADMIN-020 — no physical delete path exists in this module", () => {
  it("exposes no delete function", async () => {
    const mod = await repo();

    // A soft-delete SPEC must not ship a hard-delete escape hatch alongside it.
    expect(Object.keys(mod).filter((k) => /delete/i.test(k))).toEqual([]);
  });
});
