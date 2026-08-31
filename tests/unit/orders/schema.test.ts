import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * SPEC-ORDER-001 M1 — prisma/schema.prisma OrderStatus / Order / OrderItem.
 *
 * Traces: REQ-ORDER-001 (one order belongs to exactly one GUEST identity),
 * REQ-ORDER-002 (the item carries its own price and name snapshot),
 * REQ-ORDER-003 (order number, status, money columns), REQ-ORDER-017
 * (a new order is pending_payment). Verifies AC-ORDER-001 (b)(c) — the
 * guest-only boundary is enforced by the SCHEMA, not by prose: no `userId`,
 * no `user` relation, no `@@index([userId])`, and `guestId` NOT nullable.
 *
 * Verification strategy matches tests/unit/cart/schema.test.ts: the schema is
 * read as TEXT because no live PostgreSQL is reachable here (research.md §5).
 * What is assertable is that the schema DECLARES the planned shape; what is
 * NOT assertable is that the migration applies against a real server.
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

/**
 * The same body with `//` comments removed.
 *
 * The forbidden-token assertions below are about what the schema DECLARES, and
 * the explanatory comments legitimately name the very things those assertions
 * forbid (a comment saying "no email is stored" contains "email"). Stripping
 * comments keeps the assertion pointed at declarations.
 */
function declarationsOf(body: string): string {
  return body.replace(/\/\/.*$/gm, "");
}

/** Extracts the body of `enum <name> { ... }` from the schema text. */
function enumBody(name: string): string {
  const match = schema.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`enum ${name} not found in prisma/schema.prisma`);
  return match[1]!;
}

describe("SPEC-ORDER-001 M1 — OrderStatus enum (REQ-ORDER-017, design.md §1)", () => {
  it("declares pending_payment plus the two values later SPECs will transition to", () => {
    const body = enumBody("OrderStatus");
    expect(body).toMatch(/^\s*pending_payment\b/m);
    // Reserved values only — this SPEC writes neither, and owns no transition
    // into them (REQ-ORDER-019).
    expect(body).toMatch(/^\s*paid\b/m);
    expect(body).toMatch(/^\s*cancelled\b/m);
  });
});

describe("SPEC-ORDER-001 M1 — Order model (REQ-ORDER-001/003, AC-ORDER-001)", () => {
  it("attributes an order to a NON-NULLABLE guest identity", () => {
    const body = modelBody("Order");
    // `String` with no `?`: a member-owned order is not representable, which is
    // how design.md §1.4 turns the guest-only scope into a type constraint.
    expect(body).toMatch(/^\s*guestId\s+String\s/m);
    expect(body).not.toMatch(/^\s*guestId\s+String\?/m);
  });

  it("declares NO member attribution at all (AC-ORDER-001 (b))", () => {
    const body = modelBody("Order");
    expect(body).not.toMatch(/^\s*userId\b/m);
    expect(body).not.toMatch(/^\s*user\s+User/m);
    expect(body).not.toContain("@@index([userId])");
  });

  it("carries a unique human-readable order number and a defaulted status", () => {
    const body = modelBody("Order");
    expect(body).toMatch(/^\s*orderNumber\s+String\s+@unique/m);
    expect(body).toMatch(/^\s*status\s+OrderStatus\s+@default\(pending_payment\)/m);
  });

  it("snapshots exactly the five shipping fields REQ-ORDER-008 permits", () => {
    const body = modelBody("Order");
    expect(body).toMatch(/^\s*recipientName\s+String\s/m);
    expect(body).toMatch(/^\s*recipientPhone\s+String\s/m);
    expect(body).toMatch(/^\s*postalCode\s+String\s/m);
    expect(body).toMatch(/^\s*address\s+String\s/m);
    // The one optional field — a delivery note the shopper may leave blank.
    expect(body).toMatch(/^\s*deliveryMemo\s+String\?/m);
    // REQ-ORDER-009: no payment instrument is stored, so no column exists.
    expect(declarationsOf(body)).not.toMatch(/card|cvc|expiry|email|birth/i);
  });

  it("freezes the three money figures at creation time (REQ-ORDER-003)", () => {
    const body = modelBody("Order");
    expect(body).toMatch(/^\s*itemsSubtotal\s+Int\b/m);
    expect(body).toMatch(/^\s*shippingFee\s+Int\b/m);
    expect(body).toMatch(/^\s*totalAmount\s+Int\b/m);
  });

  it("makes the idempotency key unique — the second line of defence (REQ-ORDER-016)", () => {
    expect(modelBody("Order")).toMatch(/^\s*idempotencyKey\s+String\s+@unique/m);
  });

  it("indexes guestId for the completion-screen lookup", () => {
    expect(modelBody("Order")).toContain("@@index([guestId])");
  });
});

describe("SPEC-ORDER-001 M1 — OrderItem model (REQ-ORDER-002/004)", () => {
  it("stores the price and name AS OF the order, not a join to the live product", () => {
    const body = modelBody("OrderItem");
    expect(body).toMatch(/^\s*productName\s+String\b/m);
    expect(body).toMatch(/^\s*unitPrice\s+Int\b/m);
    expect(body).toMatch(/^\s*quantity\s+Int\b/m);
    expect(body).toMatch(/^\s*lineTotal\s+Int\b/m);
  });

  it("restricts product deletion, deliberately UNLIKE CartItem's cascade", () => {
    const body = modelBody("OrderItem");
    // An order line is an accounting record: deleting the product must not
    // silently destroy it (design.md §1.2).
    expect(body).toMatch(/product\s+Product\s+@relation\([^)]*onDelete:\s*Restrict/);
    // The order owns its lines, so they go with it.
    expect(body).toMatch(/order\s+Order\s+@relation\([^)]*onDelete:\s*Cascade/);
  });

  it("indexes both foreign keys", () => {
    const body = modelBody("OrderItem");
    expect(body).toContain("@@index([orderId])");
    expect(body).toContain("@@index([productId])");
  });
});

describe("SPEC-ORDER-001 M1 — the preserved models (plan.md §4)", () => {
  it("leaves User completely untouched — no orders back-relation (AC-ORDER-001 (c))", () => {
    const body = modelBody("User");
    expect(body).not.toMatch(/orders?\s+Order/i);

    // PRESERVE spot-check — the fields SPEC-AUTH-001 and SPEC-CART-001 own.
    expect(body).toMatch(/^\s*email\s+String\s+@unique/m);
    expect(body).toMatch(/^\s*refreshTokens\s+RefreshToken\[\]/m);
    expect(body).toMatch(/^\s*carts\s+Cart\[\]/m);
  });

  it("adds only a back-relation field to Product, changing no existing field", () => {
    const body = modelBody("Product");
    expect(body).toMatch(/^\s*orderItems\s+OrderItem\[\]/m);

    // PRESERVE spot-check — SPEC-CATALOG-001/002 and SPEC-CART-001's fields.
    expect(body).toMatch(/^\s*price\s+Int\b/m);
    expect(body).toMatch(/^\s*stock\s+Int\b/m);
    expect(body).toMatch(/^\s*cartItems\s+CartItem\[\]/m);
    expect(body).toContain("product_name_trgm_idx");
  });

  it("leaves CartItem's product cascade in place (design.md §1.5 depends on it)", () => {
    // §1.5 deletes the PRODUCT_GONE branch precisely BECAUSE this cascade makes
    // an orphaned cart line unrepresentable. If this ever changes, that removed
    // branch has to come back.
    expect(modelBody("CartItem")).toMatch(
      /product\s+Product\s+@relation\([^)]*onDelete:\s*Cascade/
    );
  });
});

describe("SPEC-ORDER-001 M1 — migration", () => {
  const migrationDir = (): string => {
    const found = readdirSync(MIGRATIONS_DIR).find((d) => d.endsWith("_add_order_models"));
    if (!found) throw new Error("no *_add_order_models migration directory found");
    return path.join(MIGRATIONS_DIR, found);
  };

  const migrationSql = (): string =>
    readFileSync(path.join(migrationDir(), "migration.sql"), "utf8");

  /** The SQL with `--` comment lines removed — see declarationsOf() above. */
  const migrationDdl = (): string => migrationSql().replace(/^\s*--.*$/gm, "");

  it("creates both tables and no others", () => {
    const created = [...migrationSql().matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]!).sort();
    expect(created).toEqual(["Order", "OrderItem"]);
  });

  it("creates the OrderStatus enum with pending_payment as a value", () => {
    const sql = migrationSql();
    expect(sql).toMatch(/CREATE TYPE "OrderStatus" AS ENUM \([^)]*'pending_payment'/);
  });

  it("is additive — it alters and drops nothing that already exists", () => {
    const sql = migrationSql();
    // ALTER TABLE appears ONLY to add this migration's own foreign keys, and
    // only OrderItem carries any: Order has no relation to User, which is the
    // guest-only boundary showing up in the DDL (design.md §1.4).
    const alters = [...sql.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1]!);
    expect(new Set(alters)).toEqual(new Set(["OrderItem"]));
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)/i);
  });

  it("declares the unique constraints the idempotency and lookup paths depend on", () => {
    const sql = migrationSql();
    expect(sql).toMatch(/CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"\("orderNumber"\)/);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"\("idempotencyKey"\)/
    );
  });

  it("makes guestId NOT NULL and creates no userId column", () => {
    const ddl = migrationDdl();
    expect(ddl).toMatch(/"guestId" TEXT NOT NULL/);
    expect(ddl).not.toContain('"userId"');
  });

  it("restricts the OrderItem -> Product foreign key", () => {
    expect(migrationSql()).toMatch(
      /ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"[\s\S]*?ON DELETE RESTRICT/
    );
  });
});
