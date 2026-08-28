import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Category, Product } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * SPEC-CATALOG-001 M5 — the catalog's accepted query surface and generated
 * model shape.
 *
 * Traces: AC-CATALOG-012 (no keyword/full-text search parameter — acceptance.md
 * asks for a STATIC check that no such parameter is read), AC-CATALOG-001
 * (product field completeness, checked here against the GENERATED Prisma types
 * rather than the schema text that tests/unit/catalog/schema.test.ts covers).
 */

const ROOT = path.resolve(__dirname, "../../..");

const CATALOG_SOURCES = [
  "src/features/catalog/services/product-service.ts",
  "src/app/api/products/route.ts",
  "src/app/api/products/[productId]/route.ts",
] as const;

/** Every string literal the source passes to `searchParams.get(...)`. */
function readQueryParamNames(relativePath: string): string[] {
  const source = readFileSync(path.join(ROOT, relativePath), "utf8");
  return [...source.matchAll(/\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1]!);
}

/**
 * SPEC-CATALOG-002 supersedes AC-CATALOG-012 for `search` ONLY.
 *
 * SPEC-CATALOG-001 §3 recorded keyword search as deferred scope, not as a
 * permanent prohibition, and REQ-CATALOG-017/018 now implement it. What the
 * original assertion was actually protecting — that the list API reads a closed,
 * documented set of parameters rather than accumulating undocumented ones —
 * still holds and is still enforced below, with `search` added to the set.
 *
 * `q` is NOT added: plan.md §2.1 chose a single spelling and declined an alias.
 */
describe("AC-CATALOG-012 (as amended by SPEC-CATALOG-002) — closed query surface", () => {
  it("reads exactly the five documented query parameters and nothing else", () => {
    const readParams = new Set(CATALOG_SOURCES.flatMap(readQueryParamNames));

    // A whitelist rather than a "does not contain q" assertion: this fails if a
    // future edit starts reading ANY undocumented parameter.
    expect([...readParams].sort()).toEqual(["category", "page", "pageSize", "search", "sort"]);
  });

  it.each(["q", "keyword", "query"])("never reads a '%s' alias for search", (name) => {
    const readParams = new Set(CATALOG_SOURCES.flatMap(readQueryParamNames));
    expect(readParams.has(name)).toBe(false);
  });

  it("reads 'search' — the one spelling SPEC-CATALOG-002 documents", () => {
    const readParams = new Set(CATALOG_SOURCES.flatMap(readQueryParamNames));
    expect(readParams.has("search")).toBe(true);
  });
});

describe("AC-CATALOG-026 — no relevance-ranked sort option (REQ-CATALOG-023)", () => {
  it("PRODUCT_SORTS still carries exactly the three SPEC-CATALOG-001 values", async () => {
    const { PRODUCT_SORTS } = await import("@/features/catalog/types/product");
    expect([...PRODUCT_SORTS]).toEqual(["newest", "price_asc", "price_desc"]);
  });

  it.each(["relevance", "rank", "score", "best_match"])(
    "does not accept '%s' as a sort value",
    async (candidate) => {
      const { PRODUCT_SORTS } = await import("@/features/catalog/types/product");
      expect((PRODUCT_SORTS as readonly string[]).includes(candidate)).toBe(false);
    }
  );
});

describe("AC-CATALOG-027 — search is substring matching, not full-text (REQ-CATALOG-024)", () => {
  const SEARCH_SOURCES = [
    "src/features/catalog/services/product-service.ts",
    "src/features/catalog/repositories/product-repository.ts",
    "src/features/catalog/repositories/category-repository.ts",
    "src/features/catalog/types/product.ts",
  ] as const;

  /** Source with line comments and block comments stripped. */
  function codeOf(relativePath: string): string {
    return readFileSync(path.join(ROOT, relativePath), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it.each(["$queryRaw", "$executeRaw", "tsvector", "to_tsquery", "plainto_tsquery", "ts_rank"])(
    "never reaches for '%s' in the catalog feature code",
    (token) => {
      // Comments are stripped first so the prose explaining WHY full-text is
      // out of scope does not itself trip the check.
      for (const source of SEARCH_SOURCES) {
        expect(codeOf(source)).not.toContain(token);
      }
    }
  );

  it("matches with Prisma's contains + insensitive mode instead", () => {
    const repository = codeOf("src/features/catalog/repositories/product-repository.ts");
    expect(repository).toMatch(/contains:/);
    expect(repository).toMatch(/mode:\s*"insensitive"/);
  });
});

describe("AC-CATALOG-001 — the generated Product model carries every required field", () => {
  it("type-checks a Product against the REQ-CATALOG-001 field set", () => {
    // A compile-time assertion: `npx tsc --noEmit` fails if the generated
    // Product type is missing a field or declares it with a different type.
    // The runtime body only has to prove the assignment is reachable.
    const shape: {
      id: string;
      name: string;
      price: number;
      description: string;
      images: string[];
      stock: number;
      categoryId: string;
      createdAt: Date;
      updatedAt: Date;
    } = {
      id: "prod_abc",
      name: "린넨 셔츠",
      price: 39000,
      description: "설명",
      images: ["https://cdn.example.com/a.jpg"],
      stock: 12,
      categoryId: "cat-tops",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Product;

    expect(Object.keys(shape).sort()).toEqual([
      "categoryId",
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

  it("type-checks a Category against its slug-keyed shape", () => {
    const shape: { id: string; name: string; slug: string; createdAt: Date; updatedAt: Date } = {
      id: "cat-tops",
      name: "상의",
      slug: "tops",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Category;

    expect(shape.slug).toBe("tops");
  });

  it("exposes product and category delegates on the shared Prisma client", () => {
    // Method presence only — no live PostgreSQL here, so nothing is invoked
    // (the constraint tests/unit/db/schema.test.ts documented for SPEC-AUTH-001).
    expect(typeof prisma.product.findMany).toBe("function");
    expect(typeof prisma.product.findUnique).toBe("function");
    expect(typeof prisma.product.count).toBe("function");
    expect(typeof prisma.category.findUnique).toBe("function");
  });
});
