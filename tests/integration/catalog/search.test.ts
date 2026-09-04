import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CATALOG-002 M4 — keyword search end to end, from the HTTP handler down
 * to the where clause, against a fixture catalog.
 *
 * Traces: AC-CATALOG-017 (case-insensitive substring), AC-CATALOG-018
 * (description is not searched), AC-CATALOG-021 (search AND category),
 * AC-CATALOG-022/023 (sort still applies), AC-CATALOG-024 (metadata over the
 * searched set), AC-CATALOG-025 (no match is an empty 200), AC-CATALOG-028
 * (the detail endpoint is unaffected).
 *
 * WHAT THIS SUITE ESTABLISHES AND WHAT IT DOES NOT — read before trusting a pass.
 *
 * No PostgreSQL is reachable in this sandbox, so the real Prisma engine cannot
 * run. Instead of asserting only on the ARGUMENT SHAPE the repository builds
 * (which tests/unit/catalog/product-repository.test.ts already covers), this
 * suite INTERPRETS that where clause against a fixture catalog using PostgreSQL's
 * documented semantics for the one operator involved:
 *
 *     { name: { contains: t, mode: "insensitive" } }  ==  name ILIKE '%t%'
 *
 * So a pass establishes: given the where clause this code generates, and given
 * that PostgreSQL implements ILIKE as documented, the endpoint returns exactly
 * these products. It does NOT establish that PostgreSQL behaves as documented,
 * nor that the M1 trigram index is chosen by the planner — both need a live
 * database and are recorded as gaps in progress.md §E.2.
 *
 * The evaluator is deliberately tiny and mirrors only the two operators this
 * SPEC emits; it is a test fixture, not a Prisma reimplementation.
 */

/**
 * Mocked at the PRISMA seam, not the repository seam.
 *
 * This is load-bearing. Stubbing findProductsPage would leave the repository's
 * where-clause construction unexecuted, and the evaluator below would end up
 * interpreting a clause the test itself had rebuilt — which cannot fail when
 * the repository is wrong. Mocking one layer lower means the REAL repository
 * builds the where clause and the evaluator interprets THAT. Verified by
 * mutation: flipping mode to "default" in the repository turns these tests red.
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
      // to findFirst (findUnique takes only unique fields in its where, and
      // isActive is not one). Without this delegate the detail route dies with
      // a TypeError before any assertion runs.
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
    category: {
      findUnique: (...args: unknown[]) => categoryFindUnique(...args),
    },
  },
}));

interface Fixture {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  categorySlug: string;
  createdAt: Date;
}

function product(
  id: string,
  name: string,
  overrides: Partial<Omit<Fixture, "id" | "name">> = {}
): Fixture {
  return {
    id,
    name,
    description: "일반 상품 설명.",
    price: 39000,
    categoryId: "cat-tops",
    categorySlug: "tops",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * The fixture catalog. Names are chosen so that acceptance.md's scenarios are
 * literally representable: mixed case for AC-CATALOG-017, a description-only
 * term for AC-CATALOG-018, and the same term across two categories for
 * AC-CATALOG-021.
 */
const CATALOG: Fixture[] = [
  product("p-jacket", "Classic Denim Jacket", {
    price: 89000,
    createdAt: new Date("2026-08-24T00:00:00.000Z"),
  }),
  product("p-shirt", "Denim Shirt", {
    price: 49000,
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
  }),
  product("p-jeans", "Denim Jeans", {
    price: 69000,
    categoryId: "cat-bottoms",
    categorySlug: "bottoms",
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
  }),
  product("p-tag", "Linen Shirt", {
    // The distinctive token lives ONLY in the description — AC-CATALOG-018
    // requires that searching for it matches nothing.
    description: "limited-edition-tag-xyz 를 포함한 설명.",
    price: 39000,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
  }),
  product("p-denim-lower", "denim overshirt", {
    price: 59000,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
  }),
];

const SLUG_TO_ID: Record<string, string> = { tops: "cat-tops", bottoms: "cat-bottoms" };

type WhereClause = {
  categoryId?: string;
  name?: { contains: string; mode?: string };
};

/**
 * Applies the where clause the repository built, using PostgreSQL's semantics
 * for the two operators this SPEC emits.
 *
 * `contains` + insensitive mode is ILIKE '%t%' — a case-folded substring test.
 * Case folding is done with toLowerCase(), which agrees with PostgreSQL for the
 * ASCII fixtures used here (full Unicode folding is collation-dependent, and
 * outside what this fixture can or should assert).
 */
function matches(row: Fixture, where: WhereClause): boolean {
  if (where.categoryId !== undefined && row.categoryId !== where.categoryId) return false;

  if (where.name !== undefined) {
    const term = where.name.contains;
    const insensitive = where.name.mode === "insensitive";
    const haystack = insensitive ? row.name.toLowerCase() : row.name;
    const needle = insensitive ? term.toLowerCase() : term;
    // Only `name` is consulted — a where clause that reached for description
    // would have to say so, and AC-CATALOG-018 asserts it never does.
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

const COMPARATORS: Record<string, (a: Fixture, b: Fixture) => number> = {
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id),
  price_asc: (a, b) => a.price - b.price || a.id.localeCompare(b.id),
  price_desc: (a, b) => b.price - a.price || a.id.localeCompare(b.id),
};

/** Maps the repository's orderBy array back onto a fixture comparator. */
function comparatorFor(orderBy: { createdAt?: string; price?: string }[]): (a: Fixture, b: Fixture) => number {
  const primary = orderBy[0]!;
  if (primary.price === "asc") return COMPARATORS.price_asc!;
  if (primary.price === "desc") return COMPARATORS.price_desc!;
  return COMPARATORS.newest!;
}

/**
 * Stands in for `prisma.product.findMany`, applying the where/orderBy/skip/take
 * the REAL repository constructed.
 */
function fakeFindMany(args: {
  where: WhereClause;
  orderBy: { createdAt?: string; price?: string }[];
  skip: number;
  take: number;
}) {
  const filtered = CATALOG.filter((row) => matches(row, args.where)).sort(comparatorFor(args.orderBy));

  return filtered.slice(args.skip, args.skip + args.take).map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    images: [],
    stock: 5,
    category: { id: row.categoryId, name: row.categorySlug, slug: row.categorySlug },
    createdAt: row.createdAt,
  }));
}

/** Stands in for `prisma.product.count` over the same where clause. */
function fakeCount(args: { where: WhereClause }) {
  return CATALOG.filter((row) => matches(row, args.where)).length;
}

async function listNames(query: string): Promise<string[]> {
  const { GET } = await import("@/app/api/products/route");
  const response = await GET(new Request(`http://localhost/api/products${query}`));
  expect(response.status).toBe(200);
  const body = await response.json();
  return body.items.map((item: { name: string }) => item.name);
}

async function listBody(query: string) {
  const { GET } = await import("@/app/api/products/route");
  const response = await GET(new Request(`http://localhost/api/products${query}`));
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  findMany.mockReset().mockImplementation(async (args) => fakeFindMany(args));
  count.mockReset().mockImplementation(async (args) => fakeCount(args));
  findUnique.mockReset().mockResolvedValue(null);
  findFirst.mockReset().mockResolvedValue(null); // SPEC-ADMIN-002 REQ-ADMIN-035
  categoryFindUnique
    .mockReset()
    .mockImplementation(async (args: { where: { slug: string } }) => {
      const id = SLUG_TO_ID[args.where.slug];
      return id === undefined ? null : { id };
    });
});

/** The where clause the REAL repository handed to Prisma on the last call. */
function lastWhere(): WhereClause {
  return findMany.mock.calls.at(-1)![0].where;
}

describe("AC-CATALOG-017 — case-insensitive substring match on name", () => {
  it.each(["denim", "DENIM", "Denim", "DeNiM"])(
    "matches the same products for search=%s",
    async (term) => {
      const names = await listNames(`?search=${term}`);

      expect(names).toContain("Classic Denim Jacket");
      expect(names).toContain("Denim Shirt");
      expect(names).toContain("denim overshirt");
      expect(names).not.toContain("Linen Shirt");
    }
  );

  it("matches a substring in the MIDDLE of a name, not just a prefix", async () => {
    // The property that forces a trigram index: 'denim' is not a prefix of
    // "Classic Denim Jacket", so a B-tree prefix seek could not find it.
    const names = await listNames("?search=denim");
    expect(names).toContain("Classic Denim Jacket");
  });

  it("matches a full name exactly (acceptance.md §2 — exact is a subset of partial)", async () => {
    const names = await listNames("?search=Denim%20Shirt");
    expect(names).toEqual(["Denim Shirt"]);
  });
});

describe("AC-CATALOG-018 — description is never searched", () => {
  it("returns nothing for a token that appears only in a description", async () => {
    const { status, body } = await listBody("?search=limited-edition-tag-xyz");

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.totalCount).toBe(0);
  });

  it("still returns that product when searched by its NAME", async () => {
    // Proves the previous test failed for the right reason — the product is
    // reachable, just not through its description.
    expect(await listNames("?search=Linen")).toEqual(["Linen Shirt"]);
  });
});

describe("AC-CATALOG-019/020 — a blank term is absence, not an error", () => {
  it.each(["?search=", "?search=%20%20%20", "?search=%09"])(
    "answers 200 with the unfiltered catalog for %s",
    async (query) => {
      const { status, body } = await listBody(query);
      const unfiltered = await listBody("");

      expect(status).toBe(200);
      expect(body.totalCount).toBe(CATALOG.length);
      expect(body.items).toEqual(unfiltered.body.items);
    }
  );
});

describe("AC-CATALOG-021 — search AND category", () => {
  it("returns only the product satisfying BOTH conditions", async () => {
    const names = await listNames("?search=denim&category=tops");

    // "Denim Jeans" matches the term but sits in bottoms, so AND excludes it.
    expect(names).toContain("Denim Shirt");
    expect(names).not.toContain("Denim Jeans");
  });

  it("returns the bottoms-only match when the category flips", async () => {
    expect(await listNames("?search=denim&category=bottoms")).toEqual(["Denim Jeans"]);
  });

  it("[acceptance.md §2] returns empty for an unknown category regardless of the term", async () => {
    const { status, body } = await listBody("?search=denim&category=nonexistent");

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    // No product query at all — the unmatched category already fixed the answer.
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it("builds a where clause carrying BOTH filters (the real repository's output)", async () => {
    await listBody("?search=denim&category=tops");

    // SPEC-ADMIN-002 REQ-ADMIN-034 — three ANDed siblings now, not two; the
    // search AND category composition this test guards is unchanged.
    expect(lastWhere()).toEqual({
      isActive: true,
      categoryId: "cat-tops",
      name: { contains: "denim", mode: "insensitive" },
    });
  });
});

describe("AC-CATALOG-022/023 — sort still applies to a searched result", () => {
  it("orders a searched result by price ascending", async () => {
    expect(await listNames("?search=denim&sort=price_asc")).toEqual([
      "Denim Shirt", // 49000
      "denim overshirt", // 59000
      "Denim Jeans", // 69000
      "Classic Denim Jacket", // 89000
    ]);
  });

  it("orders a searched result by price descending", async () => {
    expect(await listNames("?search=denim&sort=price_desc")).toEqual([
      "Classic Denim Jacket",
      "Denim Jeans",
      "denim overshirt",
      "Denim Shirt",
    ]);
  });

  it("defaults a searched result to newest when sort is omitted", async () => {
    expect(await listNames("?search=denim")).toEqual([
      "Classic Denim Jacket", // 08-24
      "Denim Shirt", // 08-23
      "Denim Jeans", // 08-22
      "denim overshirt", // 08-20
    ]);
  });

  it("still rejects an unsupported sort on a searched request", async () => {
    const { status } = await listBody("?search=denim&sort=relevance");
    expect(status).toBe(400);
  });
});

describe("AC-CATALOG-024 — pagination metadata describes the SEARCHED set", () => {
  it("counts only matching products, not the whole catalog", async () => {
    const { body } = await listBody("?search=denim&page=1&pageSize=2");

    // 4 of the 5 fixtures match; the metadata must not report 5.
    expect(body.totalCount).toBe(4);
    expect(body.totalPages).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it("pages through the searched set without repeating or dropping a row", async () => {
    const first = await listNames("?search=denim&page=1&pageSize=2");
    const second = await listNames("?search=denim&page=2&pageSize=2");

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(new Set([...first, ...second]).size).toBe(4);
  });

  it("answers a page past the end of the searched set with an empty 200", async () => {
    const { status, body } = await listBody("?search=denim&page=99&pageSize=2");

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.totalCount).toBe(4);
  });
});

describe("AC-CATALOG-025 — a term matching nothing is an empty 200", () => {
  it("returns items: [], totalCount: 0, totalPages: 0 — not 404, not 400", async () => {
    const { status, body } = await listBody("?search=zzz-no-match-zzz");

    expect(status).toBe(200);
    expect(body).toMatchObject({ items: [], totalCount: 0, totalPages: 0 });
  });

  it("[acceptance.md §2] handles a 5000-character term without a server error", async () => {
    const { status, body } = await listBody(`?search=${"a".repeat(5000)}`);

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("[acceptance.md §2] treats SQL metacharacters as literal text", async () => {
    // No product name contains "50%_off'", so the correct answer is an empty
    // set — NOT a wildcard match on everything, and NOT a 500.
    const { status, body } = await listBody("?search=50%25_off%27");

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
  });
});

describe("AC-CATALOG-028 — the detail endpoint ignores search", () => {
  it("answers 200 and the same body whether or not ?search= is appended", async () => {
    // SPEC-ADMIN-002 REQ-ADMIN-035 — the detail read is findFirst now.
    findFirst.mockResolvedValue({
      id: "p-shirt",
      name: "Denim Shirt",
      price: 49000,
      images: [],
      stock: 5,
      description: "설명",
      category: { id: "cat-tops", name: "상의", slug: "tops" },
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
      updatedAt: new Date("2026-08-23T00:00:00.000Z"),
    });
    const { GET } = await import("@/app/api/products/[productId]/route");
    const context = () => ({ params: Promise.resolve({ productId: "p-shirt" }) });

    const plain = await GET(new Request("http://localhost/api/products/p-shirt"), context());
    const withSearch = await GET(
      new Request("http://localhost/api/products/p-shirt?search=anything"),
      context()
    );

    expect(plain.status).toBe(200);
    expect(withSearch.status).toBe(200);
    expect(await withSearch.json()).toEqual(await plain.json());
    // The lookup key stays the route segment; the query string never reaches it.
    // SPEC-ADMIN-002 REQ-ADMIN-035 — the id is now joined by the sellability
    // scope, which is what makes a suspended product read as not-found. The
    // property this test guards is unchanged: `search` never reaches the where.
    expect(findFirst.mock.calls.at(-1)![0].where).toEqual({ id: "p-shirt", isActive: true });
  });
});

describe("AC-CATALOG-029 — SPEC-CATALOG-001 request shapes are unchanged", () => {
  it("returns the whole catalog for an unparameterised request", async () => {
    const { status, body } = await listBody("");

    expect(status).toBe(200);
    expect(body).toMatchObject({ page: 1, pageSize: 20, totalCount: CATALOG.length });
  });

  it("filters by category alone exactly as before", async () => {
    const names = await listNames("?category=bottoms");
    expect(names).toEqual(["Denim Jeans"]);
  });

  it("sorts alone exactly as before", async () => {
    const names = await listNames("?sort=price_desc");
    expect(names[0]).toBe("Classic Denim Jacket");
    expect(names.at(-1)).toBe("Linen Shirt");
  });

  it("issues a where clause with no name filter when search is absent", async () => {
    await listBody("?category=tops");

    // Byte-identical to what SPEC-CATALOG-001 produced — adding the search
    // capability must not alter the query for a request that omits it.
    // SPEC-ADMIN-002 REQ-ADMIN-034 — isActive joins the clause; the property
    // this test guards (no NAME filter when search is absent) is unchanged.
    expect(lastWhere()).toEqual({ isActive: true, categoryId: "cat-tops" });
  });

  it("issues a completely empty where clause for an unparameterised request", async () => {
    await listBody("");

    // SPEC-ADMIN-002 REQ-ADMIN-034 — "empty" now means "no caller-supplied
    // filter": the sellability scope is unconditional and is not a caller option.
    expect(lastWhere()).toEqual({ isActive: true });
  });
});
