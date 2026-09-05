import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * SPEC-PAYMENT-001 M1 — prisma/schema.prisma Order.paymentKey /
 * PaymentEventSource / PaymentAuditLog.
 *
 * Traces: REQ-PAYMENT-001 (one PaymentAuditLog row per transition, with
 * previous/new status, source, order id, timestamp), REQ-PAYMENT-002
 * (append-only — no update/delete path), REQ-PAYMENT-003 (no new OrderStatus
 * value), REQ-PAYMENT-004 (one order to at most one paymentKey). design.md §1.
 *
 * Verification strategy matches tests/unit/orders/schema.test.ts: the schema
 * is read as TEXT because no live PostgreSQL is reachable here (research.md
 * §9). What is assertable is that the schema DECLARES the planned shape; what
 * is NOT assertable is that the migration applies against a real server.
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

/** Extracts the body of `enum <name> { ... }` from the schema text. */
function enumBody(name: string): string {
  const match = schema.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`enum ${name} not found in prisma/schema.prisma`);
  return match[1]!;
}

describe("SPEC-PAYMENT-001 M1 — Order.paymentKey (REQ-PAYMENT-004, design.md §1)", () => {
  it("adds an optional, unique paymentKey column to Order", () => {
    const body = modelBody("Order");
    expect(body).toMatch(/^\s*paymentKey\s+String\?\s+@unique\s*$/m);
  });

  it("adds the PaymentAuditLog back-relation without touching any existing Order field", () => {
    const body = modelBody("Order");
    expect(body).toMatch(/^\s*auditLogs\s+PaymentAuditLog\[\]/m);
    // PRESERVE spot-check — SPEC-ORDER-001's existing fields are untouched.
    expect(body).toMatch(/^\s*orderNumber\s+String\s+@unique/m);
    expect(body).toMatch(/^\s*status\s+OrderStatus\s+@default\(pending_payment\)/m);
    expect(body).toMatch(/^\s*guestId\s+String\?/m); // nullable since SPEC-ORDER-004 M1 (research.md §2.8)
    expect(body).toMatch(/^\s*idempotencyKey\s+String\s+@unique/m);
    expect(body).toContain("@@index([guestId])");
  });
});

describe("SPEC-PAYMENT-001 M1 — OrderStatus enum is UNCHANGED (§0 #2)", () => {
  it("still declares exactly the three original values, no new one added", () => {
    const body = enumBody("OrderStatus");
    const values = body
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter((line) => line.length > 0);
    expect(values).toEqual(["pending_payment", "paid", "cancelled"]);
  });
});

describe("SPEC-PAYMENT-001 M1 — PaymentEventSource enum (design.md §1)", () => {
  it("declares exactly the three event-source values (SPEC-ADMIN-001 M1 additive ADMIN_ACTION)", () => {
    const body = enumBody("PaymentEventSource");
    const values = body
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter((line) => line.length > 0);
    expect(values).toEqual(["CONFIRM_API", "WEBHOOK", "ADMIN_ACTION"]);
  });
});

describe("SPEC-PAYMENT-001 M1 — PaymentAuditLog model (REQ-PAYMENT-001/002)", () => {
  it("carries the order relation and the transition-record fields", () => {
    const body = modelBody("PaymentAuditLog");
    expect(body).toMatch(/^\s*orderId\s+String\s*$/m);
    expect(body).toMatch(
      /order\s+Order\s+@relation\([^)]*onDelete:\s*Restrict/
    );
    expect(body).toMatch(/^\s*source\s+PaymentEventSource\s*$/m);
    expect(body).toMatch(/^\s*previousStatus\s+OrderStatus\s*$/m);
    expect(body).toMatch(/^\s*newStatus\s+OrderStatus\s*$/m);
    expect(body).toMatch(/^\s*paymentKey\s+String\?\s*$/m);
    expect(body).toMatch(/^\s*createdAt\s+DateTime\s+@default\(now\(\)\)/m);
  });

  it("makes transmissionId unique — the second idempotency defence (REQ-PAYMENT-016/017)", () => {
    const body = modelBody("PaymentAuditLog");
    expect(body).toMatch(/^\s*transmissionId\s+String\?\s+@unique\s*$/m);
  });

  it("indexes orderId for lookups", () => {
    expect(modelBody("PaymentAuditLog")).toContain("@@index([orderId])");
  });
});

describe("SPEC-PAYMENT-001 M1 — migration", () => {
  const migrationDir = (): string => {
    const found = readdirSync(MIGRATIONS_DIR).find((d) =>
      d.endsWith("_add_payment_audit_log")
    );
    if (!found) throw new Error("no *_add_payment_audit_log migration directory found");
    return path.join(MIGRATIONS_DIR, found);
  };

  const migrationSql = (): string =>
    readFileSync(path.join(migrationDir(), "migration.sql"), "utf8");

  /** The SQL with `--` comment lines removed. */
  const migrationDdl = (): string => migrationSql().replace(/^\s*--.*$/gm, "");

  it("creates the PaymentAuditLog table and no other table", () => {
    const created = [...migrationSql().matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]!);
    expect(created).toEqual(["PaymentAuditLog"]);
  });

  it("creates the PaymentEventSource enum with both values", () => {
    const sql = migrationSql();
    expect(sql).toMatch(
      /CREATE TYPE "PaymentEventSource" AS ENUM \('CONFIRM_API', 'WEBHOOK'\)/
    );
  });

  it("does not touch the OrderStatus enum", () => {
    expect(migrationSql()).not.toMatch(/ALTER TYPE "OrderStatus"/);
    expect(migrationSql()).not.toMatch(/CREATE TYPE "OrderStatus"/);
  });

  it("is additive only — alters only Order (to add paymentKey), drops nothing", () => {
    const sql = migrationSql();
    const alters = [...sql.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1]!);
    expect(new Set(alters)).toEqual(new Set(["Order", "PaymentAuditLog"]));
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)/i);
  });

  it("adds paymentKey as a nullable, unique column on Order", () => {
    const ddl = migrationDdl();
    expect(ddl).toMatch(/ALTER TABLE "Order" ADD COLUMN\s+"paymentKey" TEXT/);
    expect(ddl).toMatch(/CREATE UNIQUE INDEX "Order_paymentKey_key" ON "Order"\("paymentKey"\)/);
  });

  it("makes transmissionId unique on PaymentAuditLog", () => {
    expect(migrationSql()).toMatch(
      /CREATE UNIQUE INDEX "PaymentAuditLog_transmissionId_key" ON "PaymentAuditLog"\("transmissionId"\)/
    );
  });

  it("restricts the PaymentAuditLog -> Order foreign key (append-only survives order lookups)", () => {
    expect(migrationSql()).toMatch(
      /ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_orderId_fkey"[\s\S]*?ON DELETE RESTRICT/
    );
  });
});
