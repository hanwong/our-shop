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
  beforeEach(() => {
    vi.resetModules();
    clearGlobalPrismaCache();
  });

  afterEach(() => {
    // vi.stubEnv is the sanctioned way to write process.env.NODE_ENV: Next.js
    // declares it `readonly` on NodeJS.ProcessEnv, so a direct assignment is a
    // TS2540 compile error. unstubAllEnvs restores the pre-stub value.
    vi.unstubAllEnvs();
    clearGlobalPrismaCache();
  });

  it("caches the instance on globalThis when NODE_ENV is not production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { prisma } = await import(MODULE_PATH);
    expect((globalThis as GlobalWithPrisma).prisma).toBe(prisma);
  });

  it("does not cache the instance on globalThis when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await import(MODULE_PATH);
    expect((globalThis as GlobalWithPrisma).prisma).toBeUndefined();
  });

  it("reuses an existing globalThis.prisma instance instead of constructing a new one", async () => {
    const sentinel = { __sentinel: true };
    (globalThis as GlobalWithPrisma).prisma = sentinel;
    vi.stubEnv("NODE_ENV", "development");
    const { prisma } = await import(MODULE_PATH);
    expect(prisma).toBe(sentinel);
  });
});
