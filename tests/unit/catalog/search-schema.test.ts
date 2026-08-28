import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * SPEC-CATALOG-002 M1 — the pg_trgm extension and the GIN trigram index that
 * make `ILIKE '%term%'` indexable (plan.md §2.3).
 *
 * Traces: REQ-CATALOG-016B (the p95 300ms budget extended to search requests),
 * and the plan.md §2.3 decision to take alternative A (pg_trgm) over alternative
 * B (accept a sequential scan).
 *
 * WHAT THIS SUITE ESTABLISHES AND WHAT IT DOES NOT — read before trusting a pass.
 *
 * No PostgreSQL is reachable in this sandbox (no .env, no server — the same
 * constraint SPEC-CATALOG-001 recorded in tests/unit/catalog/schema.test.ts and
 * progress.md G2/G5/G6). So this suite asserts that the schema and the migration
 * DECLARE the extension and the index correctly. It CANNOT establish that the
 * extension installs, that the index is created, or that the query planner
 * actually chooses it — an `EXPLAIN` proving index usage needs a live database.
 * That residual gap is recorded in progress.md §E.2 rather than passed over.
 *
 * Kept separate from tests/unit/catalog/schema.test.ts so SPEC-CATALOG-001's
 * schema suite stays untouched (PRESERVE).
 */

const ROOT = path.resolve(__dirname, "../../..");
const SCHEMA_PATH = path.join(ROOT, "prisma/schema.prisma");
const MIGRATIONS_DIR = path.join(ROOT, "prisma/migrations");

const schema = readFileSync(SCHEMA_PATH, "utf8");

/** Extracts the body of a top-level `<keyword> <name> { ... }` block. */
function block(keyword: string, name: string): string {
  const match = schema.match(new RegExp(`${keyword}\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`${keyword} ${name} not found in prisma/schema.prisma`);
  return match[1]!;
}

function modelBody(name: string): string {
  return block("model", name);
}

/** The SQL of the migration that adds the trigram index, or null if absent. */
function trigramMigrationSql(): string | null {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const dir of dirs) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
    if (/gin_trgm_ops/i.test(sql)) return sql;
  }
  return null;
}

describe("SPEC-CATALOG-002 M1 — pg_trgm extension is declared (plan.md §2.3)", () => {
  it("enables the postgresqlExtensions preview feature on the generator", () => {
    // Without this flag Prisma ignores the `extensions` field entirely, so the
    // extension would never reach the migration.
    expect(block("generator", "client")).toMatch(/previewFeatures\s*=\s*\[\s*"postgresqlExtensions"\s*\]/);
  });

  it("lists pg_trgm on the datasource", () => {
    expect(block("datasource", "db")).toMatch(/extensions\s*=\s*\[[^\]]*\bpg_trgm\b[^\]]*\]/);
  });
});

describe("SPEC-CATALOG-002 M1 — GIN trigram index on Product.name", () => {
  it("declares a GIN index over name using gin_trgm_ops", () => {
    const body = modelBody("Product");

    // The three parts that make this index usable by `ILIKE '%term%'`:
    // the Gin type, the name column, and the trigram operator class. A plain
    // B-tree index on name would NOT accelerate a leading-wildcard match.
    expect(body).toMatch(/@@index\(\s*\[\s*name\(ops:\s*raw\("gin_trgm_ops"\)\)\s*\][^)]*type:\s*Gin/);
  });

  it("maps the index to the name the migration creates", () => {
    expect(modelBody("Product")).toMatch(/map:\s*"product_name_trgm_idx"/);
  });

  it("leaves the three SPEC-CATALOG-001 indexes in place (PRESERVE)", () => {
    const body = modelBody("Product");
    expect(body).toContain("@@index([categoryId])");
    expect(body).toContain("@@index([createdAt])");
    expect(body).toContain("@@index([price])");
  });
});

describe("SPEC-CATALOG-002 M1 — the migration carries both statements", () => {
  it("ships a migration containing the trigram index", () => {
    expect(trigramMigrationSql()).not.toBeNull();
  });

  it("creates the pg_trgm extension before the index that depends on it", () => {
    const sql = trigramMigrationSql();
    expect(sql).not.toBeNull();
    if (sql === null) return;

    // IF NOT EXISTS keeps the migration replayable against a database where a
    // platform (Neon/Supabase) pre-installed the extension.
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS\s+"?pg_trgm"?/i);
    expect(sql).toMatch(/CREATE INDEX[\s\S]*USING\s+GIN[\s\S]*gin_trgm_ops/i);

    // Ordering matters: the operator class does not exist until the extension
    // is installed, so an index-first migration fails on a clean database.
    expect(sql.search(/CREATE EXTENSION/i)).toBeLessThan(sql.search(/CREATE INDEX/i));
  });

  it("names the index exactly as the schema's map directive does", () => {
    const sql = trigramMigrationSql();
    if (sql === null) return;
    expect(sql).toMatch(/"product_name_trgm_idx"/);
  });

  it("touches no SPEC-AUTH-001 or SPEC-CATALOG-001 table (additive only)", () => {
    const sql = trigramMigrationSql();
    if (sql === null) return;
    expect(sql).not.toMatch(/DROP\s+(TABLE|INDEX|COLUMN)/i);
    expect(sql).not.toMatch(/ALTER TABLE\s+"(User|OAuthAccount|RefreshToken|Category)"/i);
  });
});
