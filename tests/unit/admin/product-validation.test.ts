import { describe, it, expect } from "vitest";

/**
 * SPEC-ADMIN-002 M2 — parseProductInput (REQ-ADMIN-026/027/029/030,
 * AC-ADMIN-026/027/030).
 *
 * The create route and the edit route share this ONE function, so these tests
 * are the single specification of what "a valid product input" means. If the
 * two routes ever validated separately they would start disagreeing about the
 * same submission — that is the failure mode this shared parser exists to
 * prevent, and the reason these tests assert on the parser rather than through
 * either route.
 *
 * Pure and framework-independent by construction: nothing here imports
 * `next/*` or `@prisma/client`, matching product-service.ts's parseListQuery
 * and cart-service.ts's parseQuantity.
 */

const VALID = {
  name: "린넨 셔츠",
  description: "여름용 린넨 셔츠입니다",
  price: 39000,
  stock: 12,
  categoryId: "cat-tops",
  images: ["https://cdn.example.com/a.jpg"],
};

async function parse(body: unknown) {
  const { parseProductInput } = await import("@/features/admin/services/product-validation");
  return parseProductInput(body);
}

describe("parseProductInput — a fully valid submission", () => {
  it("accepts it and returns the parsed data", async () => {
    const result = await parse(VALID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(VALID);
  });

  it("stores name and description trimmed, not as submitted", async () => {
    const result = await parse({ ...VALID, name: "  린넨 셔츠  ", description: "  설명  " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("린넨 셔츠");
    expect(result.data.description).toBe("설명");
  });
});

describe("[AC-ADMIN-026] price — a whole number of won, at least 1", () => {
  it.each([0, -1, -39000, 39000.5, 0.1, "39000", null, undefined, NaN, Infinity])(
    "rejects price=%p",
    async (price) => {
      const result = await parse({ ...VALID, price });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.price).toBeDefined();
    }
  );

  it("accepts the boundary value 1", async () => {
    const result = await parse({ ...VALID, price: 1 });

    expect(result.ok).toBe(true);
  });
});

describe("[AC-ADMIN-026] stock — a whole number, zero allowed", () => {
  it.each([-1, -12, 12.5, "12", null, undefined, NaN, Infinity])(
    "rejects stock=%p",
    async (stock) => {
      const result = await parse({ ...VALID, stock });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.stock).toBeDefined();
    }
  );

  it("accepts the boundary value 0 — out of stock is a normal state, not an error", async () => {
    const result = await parse({ ...VALID, stock: 0 });

    expect(result.ok).toBe(true);
  });
});

describe("[AC-ADMIN-026] name and description must carry actual text", () => {
  it.each(["", "   ", "\t\n", 42, null, undefined, {}])("rejects name=%p", async (name) => {
    const result = await parse({ ...VALID, name });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeDefined();
  });

  it.each(["", "   ", 42, null, undefined])("rejects description=%p", async (description) => {
    const result = await parse({ ...VALID, description });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.description).toBeDefined();
  });
});

describe("[AC-ADMIN-027] images — a list of absolute URLs, empty allowed", () => {
  it("accepts an empty list, so a product can be registered with no photo yet", async () => {
    const result = await parse({ ...VALID, images: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.images).toEqual([]);
  });

  it("preserves list order, because array order is display order", async () => {
    const images = [
      "https://cdn.example.com/c.jpg",
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
    ];
    const result = await parse({ ...VALID, images });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.images).toEqual(images);
  });

  it.each([
    ["a relative path", ["/uploads/a.jpg"]],
    ["a bare filename", ["a.jpg"]],
    ["an empty string", [""]],
    ["a non-string entry", [42]],
    ["a null entry", [null]],
    ["a nested array", [["https://cdn.example.com/a.jpg"]]],
    ["a non-http protocol", ["ftp://cdn.example.com/a.jpg"]],
    ["a javascript: URL", ["javascript:alert(1)"]],
    ["not a list at all", "https://cdn.example.com/a.jpg"],
    ["null", null],
  ])("rejects %s", async (_label, images) => {
    const result = await parse({ ...VALID, images });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.images).toBeDefined();
  });

  it("rejects the whole list when only ONE entry is bad", async () => {
    const result = await parse({
      ...VALID,
      images: ["https://cdn.example.com/a.jpg", "not-a-url", "https://cdn.example.com/b.jpg"],
    });

    expect(result.ok).toBe(false);
  });
});

describe("[AC-ADMIN-029] categoryId — presence is checked here, existence is not", () => {
  it.each(["", "   ", 42, null, undefined])("rejects categoryId=%p", async (categoryId) => {
    const result = await parse({ ...VALID, categoryId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.categoryId).toBeDefined();
  });

  it("accepts a well-formed id WITHOUT consulting the database", async () => {
    // Existence is settled by the FK constraint at write time, not here — a
    // pre-check would still race with a category deleted between check and
    // insert, so this parser deliberately performs no lookup (design.md §4).
    const result = await parse({ ...VALID, categoryId: "cat-does-not-exist" });

    expect(result.ok).toBe(true);
  });
});

describe("[AC-ADMIN-030] a rejection identifies every field that needs fixing", () => {
  it("reports all bad fields at once rather than only the first", async () => {
    const result = await parse({
      name: "",
      description: "  ",
      price: -1,
      stock: -1,
      categoryId: "",
      images: ["nope"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "categoryId",
      "description",
      "images",
      "name",
      "price",
      "stock",
    ]);
  });

  it("names no field that was actually fine", async () => {
    const result = await parse({ ...VALID, price: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(["price"]);
  });

  it.each([null, undefined, "a string", 42, []])(
    "rejects a non-object body (%p) without throwing",
    async (body) => {
      const result = await parse(body);

      expect(result.ok).toBe(false);
    }
  );
});

describe("isActive is not part of the product input surface (design.md §1)", () => {
  it("never returns isActive, so an edit submission cannot flip sellability", async () => {
    // Suspend/restore is a separate route precisely so a form submission
    // cannot revive or suspend a product as a side effect.
    const result = await parse({ ...VALID, isActive: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty("isActive");
  });
});

/**
 * CodeRabbit review, PR #18 — `parseWholeNumber` bounded no upper end, so a
 * value above PostgreSQL's `Int` ceiling passed validation, reached Prisma, and
 * surfaced as an uncaught server error instead of the field-level rejection
 * these routes are built to return. A 500 reachable from ordinary form input.
 *
 * `Number.isSafeInteger` does not help here: 2147483648 is a perfectly safe
 * JavaScript integer. It is the COLUMN that cannot hold it. Both boundary sides
 * are pinned, so a later "just widen the check" edit cannot quietly drift.
 */
const INT32_MAX = 2147483647;

describe("[CodeRabbit PR#18] price and stock are bounded by the Int column, not just by JS", () => {
  it("accepts price at the signed 32-bit maximum", async () => {
    const result = await parse({ ...VALID, price: INT32_MAX });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.price).toBe(INT32_MAX);
  });

  it("rejects price one above the maximum, as a field error rather than a crash", async () => {
    const result = await parse({ ...VALID, price: INT32_MAX + 1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.price).toBeDefined();
  });

  it("accepts stock at the signed 32-bit maximum", async () => {
    const result = await parse({ ...VALID, stock: INT32_MAX });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.stock).toBe(INT32_MAX);
  });

  it("rejects stock one above the maximum, as a field error rather than a crash", async () => {
    const result = await parse({ ...VALID, stock: INT32_MAX + 1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.stock).toBeDefined();
  });

  it("reports both fields at once when both overflow", async () => {
    const result = await parse({ ...VALID, price: INT32_MAX + 1, stock: INT32_MAX + 1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["price", "stock"]);
  });
});
