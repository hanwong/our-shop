import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M1 — exercises the dev-hot-reload-safe singleton pattern in
 * src/lib/db/index.ts branch-by-branch (both the NODE_ENV guard and the
 * globalThis cache-reuse `??` fallback). schema.test.ts covers delegate
 * method presence; this file covers the module's own control flow.
 */

const MODULE_PATH = "@/lib/db";

type GlobalWithPrisma = typeof globalThis & { prisma?: unknown };

function clearGlobalPrismaCache(): void {
  delete (globalThis as GlobalWithPrisma).prisma;
}

// NOTE: getPrismaLogLevels() branch coverage is owned by
// tests/unit/db/prisma-log-levels.test.ts — not duplicated here.

describe("prisma client singleton caching behavior (SPEC-AUTH-001 M1)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    clearGlobalPrismaCache();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    clearGlobalPrismaCache();
  });

  it("caches the instance on globalThis when NODE_ENV is not production", async () => {
    process.env.NODE_ENV = "development";
    const { prisma } = await import(MODULE_PATH);
    expect((globalThis as GlobalWithPrisma).prisma).toBe(prisma);
  });

  it("does not cache the instance on globalThis when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";
    await import(MODULE_PATH);
    expect((globalThis as GlobalWithPrisma).prisma).toBeUndefined();
  });

  it("reuses an existing globalThis.prisma instance instead of constructing a new one", async () => {
    const sentinel = { __sentinel: true };
    (globalThis as GlobalWithPrisma).prisma = sentinel;
    process.env.NODE_ENV = "development";
    const { prisma } = await import(MODULE_PATH);
    expect(prisma).toBe(sentinel);
  });
});
