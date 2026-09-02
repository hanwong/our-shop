import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * SPEC-DISCOUNT-001 M3 — the coupon query layer.
 *
 * Traces: REQ-DISCOUNT-002 (the lookup normalizes the submitted code to
 * uppercase before every read — the same rule the stored `code` column
 * already assumes, per M1's coupon-model.test.ts).
 *
 * This is a READ, and — unlike `coupon-repository.ts`'s eventual M4 write —
 * it defaults to the module singleton, mirroring order-repository.ts's two
 * read functions (`findOrderByIdempotencyKey`, `findOrderForGuest`), which
 * default to the singleton because a caller outside any transaction (M3's
 * discount-service.ts) needs to run it too.
 */

const singleton = {
  coupon: { findUnique: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: singleton }));

function fakeTx() {
  return {
    coupon: {
      findUnique: vi.fn<(args: unknown) => Promise<null>>(async () => null),
    },
  };
}

const repo = await import("@/features/discounts/repositories/coupon-repository");

beforeEach(() => {
  vi.clearAllMocks();
  singleton.coupon.findUnique.mockResolvedValue(null);
});

describe("SPEC-DISCOUNT-001 M3 — findCouponByCode (REQ-DISCOUNT-002)", () => {
  it("normalizes a lowercase code to uppercase before the lookup", async () => {
    await repo.findCouponByCode("save10");

    expect(singleton.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } });
  });

  it("normalizes a mixed-case code to uppercase before the lookup", async () => {
    await repo.findCouponByCode("SaVe10");

    expect(singleton.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } });
  });

  it("leaves an already-uppercase code unchanged", async () => {
    await repo.findCouponByCode("SAVE10");

    expect(singleton.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } });
  });

  it("returns the raw row Prisma resolves, with no reshaping", async () => {
    const row = {
      id: "c-1",
      code: "SAVE10",
      type: "PERCENTAGE",
      value: 10,
      minOrderAmount: 30000,
      maxRedemptions: 5,
      redeemedCount: 0,
      startsAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2026-12-31T23:59:59Z"),
    };
    singleton.coupon.findUnique.mockResolvedValue(row);

    await expect(repo.findCouponByCode("save10")).resolves.toEqual(row);
  });

  it("returns null when no coupon matches the normalized code", async () => {
    await expect(repo.findCouponByCode("nope")).resolves.toBeNull();
  });

  it("runs on a given client instead of the singleton when one is passed", async () => {
    const tx = fakeTx();
    await repo.findCouponByCode("save10", tx as never);

    expect(tx.coupon.findUnique).toHaveBeenCalledTimes(1);
    expect(singleton.coupon.findUnique).not.toHaveBeenCalled();
  });

  it("defaults to the singleton client when none is given (mirrors order-repository.ts reads)", async () => {
    await repo.findCouponByCode("save10");

    expect(singleton.coupon.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("SPEC-DISCOUNT-001 M3 — module boundaries", () => {
  const source = readFileSync("src/features/discounts/repositories/coupon-repository.ts", "utf8");

  it("imports nothing from next/*, keeping features/ delivery-independent", () => {
    expect(source).not.toMatch(/from\s+["']next\//);
  });

  it("imports only types from @prisma/client, matching order-repository.ts's convention", () => {
    // design.md §2 — features/ stays delivery-independent of the concrete
    // Prisma runtime beyond its types, so every import line naming
    // "@prisma/client" must be a type-only import.
    const prismaImportLines = source
      .split("\n")
      .filter((line) => line.includes('"@prisma/client"') || line.includes("'@prisma/client'"));
    for (const line of prismaImportLines) {
      expect(line).toMatch(/^import\s+type\s/);
    }
  });
});
