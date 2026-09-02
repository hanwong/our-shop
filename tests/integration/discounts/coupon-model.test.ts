import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

/**
 * SPEC-DISCOUNT-001 M1 — the `Coupon` data model, against a REAL PostgreSQL.
 *
 * Traces: AC-DISCOUNT-001 (column set), AC-DISCOUNT-002 (unique constraint +
 * app-layer-normalized lookup), AC-DISCOUNT-003 (`DiscountType` has exactly
 * two values).
 *
 * M1 adds only the data model — no repository, no service. AC-DISCOUNT-002's
 * "case-insensitive lookup via the app layer" is therefore verified at the
 * boundary this milestone actually owns: normalizing the input the same way
 * the future repository will (`.toUpperCase()`) and confirming the stored,
 * upper-cased `code` is what a query against the normalized value finds.
 * design.md §1.1 records the tradeoff this rests on: a case-sensitive unique
 * index is sufficient BECAUSE normalization happens before every read and
 * write, not because Postgres itself folds case.
 *
 * This file talks to the same PostgreSQL the pre-flight `npx prisma migrate
 * status` already confirmed reachable (`DATABASE_URL`, localhost:5433) — no
 * capability gate is needed here the way SPEC-ORDER-002's concurrency test
 * needs one, because this milestone's pre-flight already established
 * reachability as a precondition, not an optional capability.
 */

// vitest's environment is `node` with no setup file, so `.env` is not loaded
// for us. Load it before anything imports the Prisma client, which reads
// DATABASE_URL at construction time (mirrors
// tests/integration/orders/concurrency.postgres.test.ts).
try {
  process.loadEnvFile(".env");
} catch {
  // No .env here; fall through to whatever the environment already provides.
}

const { prisma } = await import("@/lib/db");
const { DiscountType } = await import("@prisma/client");

/** Namespaces every row this run creates, so cleanup can find them all. */
const RUN = `m1-${randomUUID().slice(0, 8)}`;

afterAll(async () => {
  await prisma.coupon.deleteMany({ where: { code: { startsWith: RUN.toUpperCase() } } });
  await prisma.$disconnect();
});

describe("SPEC-DISCOUNT-001 M1 — AC-DISCOUNT-001 (Coupon column set)", () => {
  it("persists and reads back every required column", async () => {
    const code = `${RUN}-AC001`.toUpperCase();
    const startsAt = new Date("2026-01-01T00:00:00Z");
    const endsAt = new Date("2026-12-31T23:59:59Z");

    const created = await prisma.coupon.create({
      data: {
        code,
        type: DiscountType.PERCENTAGE,
        value: 10,
        minOrderAmount: 30000,
        maxRedemptions: 100,
        startsAt,
        endsAt,
      },
    });

    expect(created.code).toBe(code);
    expect(created.type).toBe(DiscountType.PERCENTAGE);
    expect(created.value).toBe(10);
    expect(created.minOrderAmount).toBe(30000);
    expect(created.maxRedemptions).toBe(100);
    // redeemedCount is not supplied — the schema default (0) must apply.
    expect(created.redeemedCount).toBe(0);
    expect(created.startsAt.toISOString()).toBe(startsAt.toISOString());
    expect(created.endsAt.toISOString()).toBe(endsAt.toISOString());

    const reread = await prisma.coupon.findUnique({ where: { id: created.id } });
    expect(reread).not.toBeNull();
    expect(reread?.code).toBe(code);
  });
});

describe("SPEC-DISCOUNT-001 M1 — AC-DISCOUNT-002 (unique code + normalized lookup)", () => {
  it("rejects a second coupon sharing the same code", async () => {
    const code = `${RUN}-AC002`.toUpperCase();

    await prisma.coupon.create({
      data: {
        code,
        type: DiscountType.FIXED_AMOUNT,
        value: 5000,
        maxRedemptions: 10,
        startsAt: new Date("2026-01-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T23:59:59Z"),
      },
    });

    await expect(
      prisma.coupon.create({
        data: {
          code,
          type: DiscountType.FIXED_AMOUNT,
          value: 9999,
          maxRedemptions: 1,
          startsAt: new Date("2026-01-01T00:00:00Z"),
          endsAt: new Date("2026-12-31T23:59:59Z"),
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("finds the same coupon through an app-layer-normalized (uppercased) code", async () => {
    const rawInput = `${RUN}-lookup`;
    const storedCode = rawInput.toUpperCase();

    const created = await prisma.coupon.create({
      data: {
        code: storedCode,
        type: DiscountType.PERCENTAGE,
        value: 15,
        maxRedemptions: 50,
        startsAt: new Date("2026-01-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T23:59:59Z"),
      },
    });

    // The normalization step every future caller (repository, service) MUST
    // perform before querying — asserted here at the boundary the model
    // owns, since no repository exists yet in M1 to own it instead.
    const foundViaLowercaseInput = await prisma.coupon.findUnique({
      where: { code: rawInput.toLowerCase().toUpperCase() },
    });

    expect(foundViaLowercaseInput?.id).toBe(created.id);
  });
});

describe("SPEC-DISCOUNT-001 M1 — AC-DISCOUNT-003 (DiscountType has exactly 2 values)", () => {
  it("carries only PERCENTAGE and FIXED_AMOUNT", () => {
    const values = Object.values(DiscountType).sort();
    expect(values).toEqual(["FIXED_AMOUNT", "PERCENTAGE"]);
  });
});
