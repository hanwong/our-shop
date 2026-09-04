import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

/**
 * SPEC-REVIEW-001 M2 — review-repository.ts, against a REAL PostgreSQL.
 *
 * Traces: the `@@unique([userId, productId])` constraint's actual DB-level
 * enforcement (spec.md §1's documented race — review-service.test.ts only
 * proves the SERVICE catches a P2002 it is handed; this file is what proves
 * Postgres actually raises one), REQ-REVIEW-007 (aggregate), REQ-REVIEW-009
 * (newest-first list).
 *
 * CAPABILITY GATE, mirroring
 * tests/integration/orders/concurrency.postgres.test.ts and
 * tests/integration/discounts/coupon-model.test.ts: runs only against a real
 * connection; an unreachable database SKIPS WITH A NAMED REASON rather than
 * silently passing.
 *
 * DATA IS DISPOSABLE — every row is namespaced by a per-run id and deleted in
 * `afterAll`.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // No .env here; fall through to whatever the environment already provides.
}

const { prisma } = await import("@/lib/db");
const repo = await import("@/features/reviews/repositories/review-repository");

const RUN = `m2-${randomUUID().slice(0, 8)}`;

let reachable = false;
let skipReason = "";

if (!process.env.DATABASE_URL) {
  skipReason = "DATABASE_URL is not set";
} else {
  try {
    await prisma.$queryRaw`select 1`;
    reachable = true;
  } catch (error) {
    skipReason = `connection failed: ${(error as Error).message.split("\n")[0]}`;
  }
}

async function makeUser(suffix: string) {
  return prisma.user.create({ data: { id: `${RUN}-${suffix}`, email: `${RUN}-${suffix}@example.com` } });
}

async function makeProduct(suffix: string) {
  await prisma.category.upsert({
    where: { id: `${RUN}-cat` },
    create: { id: `${RUN}-cat`, name: `${RUN} category`, slug: `${RUN}-cat` },
    update: {},
  });
  return prisma.product.create({
    data: {
      id: `${RUN}-${suffix}`,
      name: `${RUN} ${suffix}`,
      price: 1000,
      description: "SPEC-REVIEW-001 M2 fixture",
      images: [],
      stock: 5,
      categoryId: `${RUN}-cat`,
    },
  });
}

afterAll(async () => {
  if (reachable) {
    await prisma.review.deleteMany({ where: { userId: { startsWith: RUN } } });
    await prisma.product.deleteMany({ where: { id: { startsWith: RUN } } });
    await prisma.category.deleteMany({ where: { id: { startsWith: RUN } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: RUN } } });
  }
  await prisma.$disconnect();
});

describe("SPEC-REVIEW-001 M2 — the capability gate", () => {
  it("never skips silently — an unreachable database names its reason", () => {
    if (reachable) {
      expect(skipReason).toBe("");
    } else {
      expect(skipReason.length).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(!reachable)("review-repository.ts — against real PostgreSQL", () => {
  it("productExists() distinguishes a real product from an unknown id", async () => {
    const product = await makeProduct("exists");

    expect(await repo.productExists(product.id)).toBe(true);
    expect(await repo.productExists(`${RUN}-no-such-product`)).toBe(false);
  });

  it("creates a review, finds it by (userId, productId), and rejects a concurrent duplicate at the DB level", async () => {
    const user = await makeUser("dup");
    const product = await makeProduct("dup");

    const created = await repo.create(user.id, product.id, 4, "좋아요");
    expect(created.rating).toBe(4);

    const found = await repo.findByUserAndProduct(user.id, product.id);
    expect(found?.id).toBe(created.id);

    // The pre-check alone cannot stop a race (spec.md §1) — this asserts the
    // constraint itself is what review-service.ts's P2002 catch depends on.
    await expect(repo.create(user.id, product.id, 5, "또 씀")).rejects.toMatchObject({ code: "P2002" });
  });

  it("aggregateByProduct() and listByProduct() reflect real rows, newest first", async () => {
    const userA = await makeUser("agg-a");
    const userB = await makeUser("agg-b");
    const product = await makeProduct("agg");

    const empty = await repo.aggregateByProduct(product.id);
    expect(empty).toEqual({ averageRating: null, count: 0 });
    expect(await repo.listByProduct(product.id)).toEqual([]);

    const older = await repo.create(userA.id, product.id, 3, "이전 리뷰");
    await prisma.review.update({ where: { id: older.id }, data: { createdAt: new Date("2026-01-01T00:00:00Z") } });
    const newer = await repo.create(userB.id, product.id, 5, "최신 리뷰");
    await prisma.review.update({ where: { id: newer.id }, data: { createdAt: new Date("2026-01-02T00:00:00Z") } });

    const aggregate = await repo.aggregateByProduct(product.id);
    expect(aggregate.count).toBe(2);
    expect(aggregate.averageRating).toBe(4);

    const list = await repo.listByProduct(product.id);
    expect(list.map((row) => row.id)).toEqual([newer.id, older.id]);
  });
});
