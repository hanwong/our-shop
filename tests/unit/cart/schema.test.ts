import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * SPEC-CART-001 M1 — prisma/schema.prisma Cart / CartItem models.
 *
 * Traces: REQ-CART-001 (a cart belongs to exactly one identity; an item
 * references one product and a quantity), plan.md §4 (the authoritative model
 * shapes), plan.md §2.1 (nullable userId/guestId with an app-level XOR).
 *
 * Verification strategy: this suite reads prisma/schema.prisma as TEXT, the
 * same strategy tests/unit/catalog/schema.test.ts already uses, because no live
 * PostgreSQL is reachable in this sandbox. What is assertable without a
 * database is that the schema DECLARES the planned shape; what is NOT
 * assertable is that a migration applies cleanly against a real server. See
 * progress.md §E.2 for the explicit gap note.
 */

const SCHEMA_PATH = path.resolve(__dirname, "../../../prisma/schema.prisma");
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations");
const schema = readFileSync(SCHEMA_PATH, "utf8");

/** Extracts the body of `model <name> { ... }` from the schema text. */
function modelBody(name: string): string {
  const match = schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`model ${name} not found in prisma/schema.prisma`);
  return match[1]!;
}

describe("SPEC-CART-001 M1 — Cart model (REQ-CART-001, plan.md §2.1/§4)", () => {
  it("declares userId and guestId as INDEPENDENTLY nullable owners", () => {
    const body = modelBody("Cart");

    // Both nullable: a cart is owned by a member OR a guest, never both. The
    // XOR itself is an app-level invariant (plan.md §2.1 alternative A) — the
    // schema's job is only to leave both columns optional.
    expect(body).toMatch(/^\s*userId\s+String\?/m);
    expect(body).toMatch(/^\s*guestId\s+String\?/m);
  });

  it("constrains each identity to at most one cart", () => {
    const body = modelBody("Cart");
    // `@unique` on a nullable column excludes NULLs from the uniqueness check
    // (standard Postgres behaviour), so this reads as "at most one cart per
    // member" and "at most one cart per guest cookie" — plan.md §4.
    expect(body).toMatch(/^\s*userId\s+String\?\s+@unique/m);
    expect(body).toMatch(/^\s*guestId\s+String\?\s+@unique/m);
  });

  it("relates to User optionally and owns its items", () => {
    const body = modelBody("Cart");
    expect(body).toMatch(/^\s*user\s+User\?\s+@relation\(/m);
    expect(body).toMatch(/^\s*items\s+CartItem\[\]/m);
  });

  it("indexes guestId for the guest-cookie lookup path", () => {
    expect(modelBody("Cart")).toContain("@@index([guestId])");
  });
});

describe("SPEC-CART-001 M1 — CartItem model (REQ-CART-001/002)", () => {
  it("declares cartId, productId and an integer quantity", () => {
    const body = modelBody("CartItem");
    expect(body).toMatch(/^\s*cartId\s+String\b/m);
    expect(body).toMatch(/^\s*productId\s+String\b/m);
    expect(body).toMatch(/^\s*quantity\s+Int\b/m);
  });

  it("carries one row per (cart, product) so add-is-increment can upsert", () => {
    // REQ-CART-006's "adding the same product again increments rather than
    // duplicating" is implemented as an upsert, which REQUIRES this compound
    // unique to exist as its conflict target (plan.md §4).
    expect(modelBody("CartItem")).toContain("@@unique([cartId, productId])");
  });

  it("cascades from both its cart and its product (plan.md §4, deliberate)", () => {
    const body = modelBody("CartItem");
    // Deleting a cart removes its items; deleting a product removes it from
    // every cart. The product side is deliberately Cascade rather than the
    // Restrict that Product->Category uses — a cart line has no reason to
    // outlive the product it points at (plan.md §8).
    expect(body).toMatch(/cart\s+Cart\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(body).toMatch(/product\s+Product\s+@relation\([^)]*onDelete:\s*Cascade/);
  });
});

describe("SPEC-CART-001 M1 — back-relations on the preserved models", () => {
  it("adds only a back-relation field to User, changing no existing field", () => {
    const body = modelBody("User");
    expect(body).toMatch(/^\s*carts\s+Cart\[\]/m);

    // PRESERVE spot-check — SPEC-AUTH-001's own fields are untouched.
    expect(body).toMatch(/^\s*email\s+String\s+@unique/m);
    expect(body).toMatch(/^\s*passwordHash\s+String\?/m);
    expect(body).toMatch(/^\s*refreshTokens\s+RefreshToken\[\]/m);
  });

  it("adds only a back-relation field to Product, changing no existing field", () => {
    const body = modelBody("Product");
    expect(body).toMatch(/^\s*cartItems\s+CartItem\[\]/m);

    // PRESERVE spot-check — SPEC-CATALOG-001/002's own fields and indexes.
    expect(body).toMatch(/^\s*price\s+Int\b/m);
    expect(body).toMatch(/^\s*stock\s+Int\b/m);
    expect(body).toMatch(/onDelete:\s*Restrict/);
    expect(body).toContain("product_name_trgm_idx");
  });
});

describe("SPEC-CART-001 M1 — migration", () => {
  const migrationDir = (): string => {
    const found = readdirSync(MIGRATIONS_DIR).find((d) => d.endsWith("_add_cart_cart_item"));
    if (!found) throw new Error("no *_add_cart_cart_item migration directory found");
    return path.join(MIGRATIONS_DIR, found);
  };

  it("creates both tables and no others", () => {
    const sql = readFileSync(path.join(migrationDir(), "migration.sql"), "utf8");
    const created = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]!).sort();
    expect(created).toEqual(["Cart", "CartItem"]);
  });

  it("is additive — it alters and drops nothing that already exists", () => {
    const sql = readFileSync(path.join(migrationDir(), "migration.sql"), "utf8");
    // ALTER TABLE is permitted ONLY to add this migration's own foreign keys.
    const alters = [...sql.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1]!);
    expect(new Set(alters)).toEqual(new Set(["Cart", "CartItem"]));
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)/i);
  });

  it("declares the unique and index constraints the query layer depends on", () => {
    const sql = readFileSync(path.join(migrationDir(), "migration.sql"), "utf8");
    expect(sql).toMatch(/CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"\("userId"\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "Cart_guestId_key" ON "Cart"\("guestId"\)/);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"\("cartId", "productId"\)/
    );
  });
});
