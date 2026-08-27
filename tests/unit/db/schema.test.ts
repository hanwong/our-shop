import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

/**
 * SPEC-AUTH-001 M1 characterization smoke test.
 *
 * Asserts that the generated Prisma client exposes the delegate methods for
 * the User / OAuthAccount / RefreshToken models defined in prisma/schema.prisma
 * (plan.md §3.1). This test asserts METHOD PRESENCE ONLY (typeof === "function")
 * and never invokes a delegate method — no live PostgreSQL connection is
 * available in this environment (no `.create()` / `.findMany()` calls).
 */
describe("prisma client singleton delegates (SPEC-AUTH-001 M1)", () => {
  it("exposes User delegate CRUD methods without connecting to a live DB", () => {
    expect(typeof prisma.user.create).toBe("function");
    expect(typeof prisma.user.findUnique).toBe("function");
    expect(typeof prisma.user.findMany).toBe("function");
    expect(typeof prisma.user.update).toBe("function");
  });

  it("exposes OAuthAccount delegate CRUD methods without connecting to a live DB", () => {
    expect(typeof prisma.oAuthAccount.create).toBe("function");
    expect(typeof prisma.oAuthAccount.findUnique).toBe("function");
    expect(typeof prisma.oAuthAccount.findMany).toBe("function");
  });

  it("exposes RefreshToken delegate CRUD methods without connecting to a live DB", () => {
    expect(typeof prisma.refreshToken.create).toBe("function");
    expect(typeof prisma.refreshToken.updateMany).toBe("function");
    expect(typeof prisma.refreshToken.findFirst).toBe("function");
  });
});
