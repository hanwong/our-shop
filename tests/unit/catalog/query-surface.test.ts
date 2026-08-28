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

describe("AC-CATALOG-012 — the list API reads no search parameter", () => {
  it("reads exactly the four documented query parameters and nothing else", () => {
    const readParams = new Set(CATALOG_SOURCES.flatMap(readQueryParamNames));

    // A whitelist rather than a "does not contain q" assertion: this fails if a
    // future edit starts reading ANY undocumented parameter, not just `q`.
    expect([...readParams].sort()).toEqual(["category", "page", "pageSize", "sort"]);
  });

  it.each(["q", "search", "keyword", "query"])("never reads a '%s' parameter", (name) => {
    const readParams = new Set(CATALOG_SOURCES.flatMap(readQueryParamNames));
    expect(readParams.has(name)).toBe(false);
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
