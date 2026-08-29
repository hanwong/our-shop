import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * SPEC-CATALOG-001 M1 — prisma/schema.prisma Category / Product models.
 *
 * Traces: AC-CATALOG-001 (product field completeness), AC-CATALOG-002 (no
 * variant modelling), and the acceptance.md §10 gate "기존 User/OAuthAccount/
 * RefreshToken 모델에 diff 없음".
 *
 * Verification strategy: this suite reads prisma/schema.prisma as TEXT and
 * asserts on the model declarations, because no live PostgreSQL is available
 * in this sandbox (the same constraint SPEC-AUTH-001 documented in
 * tests/unit/db/schema.test.ts). AC-CATALOG-001 is written as "create a row,
 * then assert its fields"; without a database the reachable proxy is
 * "the schema DECLARES every required field with the required type", which is
 * what is asserted here. See progress.md §E.2 for the explicit gap note.
 */

const SCHEMA_PATH = path.resolve(__dirname, "../../../prisma/schema.prisma");
const schema = readFileSync(SCHEMA_PATH, "utf8");

/** Extracts the body of `model <name> { ... }` from the schema text. */
function modelBody(name: string): string {
  const match = schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`model ${name} not found in prisma/schema.prisma`);
  return match[1]!;
}

describe("SPEC-CATALOG-001 M1 — Product model (AC-CATALOG-001)", () => {
  it("declares every catalog field required by REQ-CATALOG-001 with the planned type", () => {
    const body = modelBody("Product");

    // name / description are free text; price and stock are integers
    // (plan.md §2.2 — KRW has no minor unit, so Int not Decimal).
    expect(body).toMatch(/^\s*name\s+String\s*$/m);
    expect(body).toMatch(/^\s*description\s+String\s*$/m);
    expect(body).toMatch(/^\s*price\s+Int\b/m);
    expect(body).toMatch(/^\s*stock\s+Int\b/m);

    // images is a native Postgres array of URLs (plan.md §2.3).
    expect(body).toMatch(/^\s*images\s+String\[\]/m);

    // category classification via FK to the Category table (plan.md §2.1).
    expect(body).toMatch(/^\s*categoryId\s+String\b/m);
    expect(body).toMatch(/category\s+Category\s+@relation\(/);
  });

  it("indexes the columns the list API filters and sorts on (REQ-CATALOG-008/010)", () => {
    const body = modelBody("Product");
    expect(body).toContain("@@index([categoryId])");
    expect(body).toContain("@@index([createdAt])");
    expect(body).toContain("@@index([price])");
  });

  it("restricts category deletion while products still reference it (plan.md §3)", () => {
    expect(modelBody("Product")).toMatch(/onDelete:\s*Restrict/);
  });
});

describe("SPEC-CATALOG-001 M1 — Category model", () => {
  it("declares a unique slug used as the list API's category filter key (REQ-CATALOG-010)", () => {
    const body = modelBody("Category");
    expect(body).toMatch(/^\s*slug\s+String\s+@unique/m);
    expect(body).toMatch(/^\s*name\s+String\s+@unique/m);
    expect(body).toMatch(/^\s*products\s+Product\[\]/m);
  });
});

describe("SPEC-CATALOG-001 M1 — variant modelling is absent (AC-CATALOG-002)", () => {
  it("declares no color/size/variant field on Product", () => {
    const body = modelBody("Product");
    expect(body).not.toMatch(/^\s*color\b/mi);
    expect(body).not.toMatch(/^\s*size\b/mi);
    expect(body).not.toMatch(/variant/i);
  });

  // [AUTO] SPEC-CART-001 M1 — this assertion was an exact-equality list over
  // every model name, which made it fail on ANY additive model, including ones
  // AC-CATALOG-002 says nothing about. AC-CATALOG-002 is about the ABSENCE of
  // variant/option/SKU modelling on the catalog, so the check is restated in
  // those terms: the catalog and auth models must still all be present, and no
  // model may model a product variant. Adding Cart/CartItem (SPEC-CART-001
  // plan.md §4) now passes; adding a `ProductVariant` still fails, which is
  // the behaviour this test exists to provide.
  it("declares no separate variant/option table anywhere in the schema", () => {
    const modelNames = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]!);

    expect(modelNames).toEqual(
      expect.arrayContaining(["User", "OAuthAccount", "RefreshToken", "Category", "Product"])
    );
    expect(modelNames.filter((name) => /variant|option|sku/i.test(name))).toEqual([]);
  });
});

describe("SPEC-CATALOG-001 M1 — SPEC-AUTH-001 models are preserved", () => {
  it("leaves the User / OAuthAccount / RefreshToken declarations intact", () => {
    // Spot-check the fields SPEC-AUTH-001's own tests depend on; a structural
    // change to these models would be a PRESERVE violation.
    expect(modelBody("User")).toMatch(/^\s*email\s+String\s+@unique/m);
    expect(modelBody("User")).toMatch(/^\s*passwordHash\s+String\?/m);
    expect(modelBody("RefreshToken")).toMatch(/^\s*tokenHash\s+String\b/m);
    expect(modelBody("OAuthAccount")).toContain("@@unique([provider, providerAccountId])");
  });
});
