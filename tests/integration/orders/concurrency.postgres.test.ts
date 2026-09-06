import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * SPEC-ORDER-002 M4 — the concurrency claims, against a LIVE PostgreSQL
 * (REQ-ORDER-024, REQ-ORDER-032, REQ-ORDER-033).
 *
 * Every other test in this SPEC runs against an in-memory fake that does not
 * model row locks. That fake can show the code is SHAPED like a conditional
 * atomic update; it cannot show that PostgreSQL actually serialises two
 * transactions competing for the same row, because it has no locks to take.
 * The repository has carried that gap since SPEC-ORDER-001, which recorded it
 * openly (design.md §3, `AC-013-EXCL-CONCURRENCY`). This file is the first
 * thing in the repository that closes it by observation rather than by
 * argument.
 *
 * CAPABILITY GATE (REQ-ORDER-032 is a `Where` requirement, plan.md §0 option
 * B): these tests run only when a real connection opens. When it does not,
 * they SKIP WITH A NAMED REASON and the gate test below fails if the reason is
 * missing — a silent skip would let an unreachable database read as a pass,
 * which is exactly what REQ-ORDER-033 forbids. Promoting this to a required CI
 * check needs `services: postgres` in a workflow file SPEC-CI-001 owns, and is
 * deliberately out of scope here.
 *
 * CONCURRENCY IS IN-PROCESS. Both orders are fired with `Promise.all` against
 * the service function directly. No second server, no child process, nothing
 * detached: the parallelism that matters is two overlapping DATABASE
 * transactions, and two promises on one client produce exactly that. A recipe
 * that spawned a background process to create load would be a defect in the
 * recipe.
 *
 * DATA IS DISPOSABLE. Every row is namespaced by a per-run id and deleted in
 * `afterAll`, so a re-run is idempotent and the shared local dev database is
 * left as it was found.
 */

// vitest's environment is `node` with no setup file, so `.env` is not loaded
// for us. Load it before anything imports the Prisma client, which reads
// DATABASE_URL at construction time. An absent file is not an error — the
// variable may legitimately come from the surrounding environment instead.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env here; fall through to whatever the environment already provides.
}

const { prisma } = await import("@/lib/db");
const { createOrder, isTransactionConflict } = await import(
  "@/features/orders/services/order-service"
);

/**
 * Whether a live PostgreSQL answered, and — when it did not — why.
 *
 * Probed once at module load with the application's OWN client, so what is
 * being tested is the connection the service itself would use.
 */
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

/**
 * SPEC-ORDER-004 M4 — createOrder() now takes an `OrderOwner` discriminated
 * union instead of a bare guest-id string (design.md §6.3).
 *
 * Every scenario in this file is a GUEST-vs-GUEST race, which is the point:
 * these measure row-lock serialisation and deadlock handling, and neither
 * depends on who owns the order. Wrapping the ids here rather than changing
 * them keeps each `GUEST_*` constant usable by `makeCart()` too, so the races
 * being measured are byte-identical to the pre-SPEC ones.
 */
function guest(guestId: string) {
  return { kind: "guest", guestId } as const;
}

/** Namespaces every row this run creates, so cleanup can find them all. */
const RUN = `m4-${randomUUID().slice(0, 8)}`;

const SHIPPING = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구 테헤란로 1",
  deliveryMemo: null,
};

function orderBody(confirmedTotal: number, key: string) {
  return { shipping: SHIPPING, idempotencyKey: `${RUN}-${key}`, confirmedTotal };
}

async function makeCategory() {
  await prisma.category.create({
    data: { id: `${RUN}-cat`, name: `${RUN} category`, slug: `${RUN}-cat` },
  });
}

/** SPEC-DISCOUNT-001 M4 — a coupon fixture for the AC-DISCOUNT-016 race. */
async function makeCoupon(suffix: string, maxRedemptions: number) {
  const { DiscountType } = await import("@prisma/client");
  return prisma.coupon.create({
    data: {
      code: `${RUN}-${suffix}`.toUpperCase(),
      type: DiscountType.FIXED_AMOUNT,
      value: 100,
      minOrderAmount: 0,
      maxRedemptions,
      startsAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2026-12-31T23:59:59Z"),
    },
  });
}

async function makeProduct(suffix: string, stock: number, price = 1000) {
  return prisma.product.create({
    data: {
      id: `${RUN}-${suffix}`,
      name: `${RUN} ${suffix}`,
      price,
      description: "SPEC-ORDER-002 M4 fixture",
      images: [],
      stock,
      categoryId: `${RUN}-cat`,
    },
  });
}

/**
 * A cart for `guestId` holding the given lines, with EXPLICIT `createdAt`
 * values.
 *
 * Explicit rather than defaulted because the cart's line order is what
 * REQ-ORDER-023 is about: two rows inserted back to back can land on the same
 * `now()`, which would make "these two carts hold the same products in
 * opposite order" untrue and the scenario meaningless.
 */
async function makeCart(guestId: string, lines: Array<{ productId: string; quantity: number }>) {
  const cart = await prisma.cart.create({ data: { id: `${RUN}-cart-${guestId}`, guestId } });
  for (const [index, cartLine] of lines.entries()) {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: cartLine.productId,
        quantity: cartLine.quantity,
        createdAt: new Date(Date.now() + index * 1000),
      },
    });
  }
  return cart;
}

/** A promise plus its resolver — the barrier the deadlock scenario needs. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

afterAll(async () => {
  if (reachable) {
    // Orders first: OrderItem.product is Restrict, so a product cannot be
    // deleted while an order line still points at it. Deleting the order
    // cascades its lines and clears the way. Coupons carry no FK to Order
    // (design.md §1.2 — a snapshot, not a relation), so their cleanup order
    // does not matter relative to the order delete.
    await prisma.order.deleteMany({ where: { guestId: { startsWith: RUN } } });
    await prisma.cart.deleteMany({ where: { guestId: { startsWith: RUN } } });
    await prisma.product.deleteMany({ where: { id: { startsWith: RUN } } });
    await prisma.category.deleteMany({ where: { id: { startsWith: RUN } } });
    await prisma.coupon.deleteMany({ where: { code: { startsWith: RUN.toUpperCase() } } });
  }
  await prisma.$disconnect();
});

describe("SPEC-ORDER-002 M4 — the capability gate (REQ-ORDER-032, REQ-ORDER-033)", () => {
  it("never skips silently — an unreachable database names its reason", () => {
    // The honesty requirement in one assertion. If this file skips its real
    // work, SOMETHING has to say so out loud; a green run with no database and
    // no explanation is the outcome REQ-ORDER-033 exists to prevent.
    if (reachable) {
      expect(skipReason).toBe("");
    } else {
      expect(skipReason.length).toBeGreaterThan(0);
    }
  });

  it("reports which mode this run took", () => {
    // Printed rather than merely asserted: the run's own output is the
    // artifact a reader consults to learn whether serialization was OBSERVED
    // or merely not contradicted.
    console.log(
      reachable
        ? `[SPEC-ORDER-002 M4] live PostgreSQL reachable — concurrency observed for real (run ${RUN})`
        : `[SPEC-ORDER-002 M4] SKIPPED — ${skipReason}. A skipped run is NOT a pass (REQ-ORDER-033).`
    );
    expect(typeof reachable).toBe("boolean");
  });
});

describe.skipIf(!reachable)(
  "SPEC-ORDER-002 M4 — two orders, one unit of stock (REQ-ORDER-024, AC-ORDER-035)",
  () => {
    const PRODUCT = `${RUN}-solo`;
    const GUEST_A = `${RUN}-guest-a`;
    const GUEST_B = `${RUN}-guest-b`;

    /** Both outcomes, captured once so every assertion reads the same run. */
    let settled: PromiseSettledResult<Awaited<ReturnType<typeof createOrder>>>[];

    beforeAll(async () => {
      await makeCategory();
      await makeProduct("solo", 1);
      await makeCart(GUEST_A, [{ productId: PRODUCT, quantity: 1 }]);
      await makeCart(GUEST_B, [{ productId: PRODUCT, quantity: 1 }]);

      // The whole point of the milestone: genuinely overlapping transactions,
      // both reaching for the same row. `allSettled` rather than `all` so a
      // rejection is DATA rather than a thrown test — an unclassified error is
      // one of the outcomes being measured.
      settled = await Promise.allSettled([
        createOrder(guest(GUEST_A), orderBody(1000, "a")),
        createOrder(guest(GUEST_B), orderBody(1000, "b")),
      ]);

      console.log(
        `[SPEC-ORDER-002 M4] scenario A outcomes: ${settled
          .map((result) =>
            result.status === "rejected"
              ? `REJECTED(${(result.reason as Error).message.split("\n")[0]})`
              : result.value.ok
                ? "ok"
                : `refused(${"code" in result.value ? result.value.code : result.value.status})`
          )
          .join(", ")}`
      );
    }, 30000);

    it("settles both orders — neither escapes as an unhandled error", () => {
      expect(settled.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    });

    it("lets exactly ONE of them succeed", () => {
      const succeeded = settled.filter(
        (result) => result.status === "fulfilled" && result.value.ok
      );

      // This is the assertion the whole SPEC exists for. Both succeeding is an
      // oversell; neither succeeding would mean the guard is too strict.
      expect(succeeded).toHaveLength(1);
    });

    it("refuses the loser with a code it can act on, never an unclassified 500", () => {
      const refused = settled.find((result) => result.status === "fulfilled" && !result.value.ok);
      expect(refused).toBeDefined();
      if (refused?.status !== "fulfilled" || refused.value.ok) return;

      expect(refused.value.status).toBe(409);
      expect(["INSUFFICIENT_STOCK", "CONCURRENCY_RETRY"]).toContain(
        "code" in refused.value ? refused.value.code : undefined
      );
    });

    it("leaves the stock at exactly 0 — never negative", async () => {
      const product = await prisma.product.findUnique({ where: { id: PRODUCT } });

      // Negative stock is the observable signature of a lost update: two
      // decrements that both believed they had the unit.
      expect(product?.stock).toBe(0);
    });

    it("creates exactly ONE order row", async () => {
      const orders = await prisma.order.findMany({ where: { guestId: { startsWith: RUN } } });

      expect(orders).toHaveLength(1);
    });
  }
);

describe.skipIf(!reachable)(
  "SPEC-ORDER-002 M4 — opposite-order carts do not strand a shopper (REQ-ORDER-023, AC-ORDER-034)",
  () => {
    const FIRST = `${RUN}-x`;
    const SECOND = `${RUN}-y`;
    const GUEST_C = `${RUN}-guest-c`;
    const GUEST_D = `${RUN}-guest-d`;

    let settled: PromiseSettledResult<Awaited<ReturnType<typeof createOrder>>>[];

    beforeAll(async () => {
      await makeProduct("x", 5);
      await makeProduct("y", 5);
      // The carts disagree about order: C holds x-then-y, D holds y-then-x.
      // Following cart order would make these two request the same rows in
      // opposite orders — the cycle REQ-ORDER-023 removes.
      await makeCart(GUEST_C, [
        { productId: FIRST, quantity: 1 },
        { productId: SECOND, quantity: 1 },
      ]);
      await makeCart(GUEST_D, [
        { productId: SECOND, quantity: 1 },
        { productId: FIRST, quantity: 1 },
      ]);

      settled = await Promise.allSettled([
        createOrder(guest(GUEST_C), orderBody(2000, "c")),
        createOrder(guest(GUEST_D), orderBody(2000, "d")),
      ]);

      console.log(
        `[SPEC-ORDER-002 M4] scenario B outcomes: ${settled
          .map((result) =>
            result.status === "rejected"
              ? `REJECTED(${(result.reason as Error).message.split("\n")[0]})`
              : result.value.ok
                ? "ok"
                : `refused(${"code" in result.value ? result.value.code : result.value.status})`
          )
          .join(", ")}`
      );
    }, 30000);

    it("settles both — neither is an unclassified server error", () => {
      // The defect this replaces: a deadlock reached the shopper as a 500 with
      // no code, because it matched neither OrderAbort nor P2002 and was
      // rethrown (spec.md §2 G1).
      expect(settled.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    });

    it("gives every order a named outcome", () => {
      for (const result of settled) {
        expect(result.status).toBe("fulfilled");
        if (result.status !== "fulfilled") continue;
        if (result.value.ok) continue;
        expect(result.value.status).not.toBe(500);
      }
    });

    it("does not oversell either product", async () => {
      const [x, y] = await Promise.all([
        prisma.product.findUnique({ where: { id: FIRST } }),
        prisma.product.findUnique({ where: { id: SECOND } }),
      ]);

      expect(x!.stock).toBeGreaterThanOrEqual(0);
      expect(y!.stock).toBeGreaterThanOrEqual(0);
    });
  }
);

describe.skipIf(!reachable)(
  "SPEC-ORDER-002 M4 — the hazard REQ-ORDER-023 removes is real (counterfactual)",
  () => {
    /**
     * Everything above shows the ordered path does not deadlock. On its own
     * that is weak evidence: a path that never deadlocks and a hazard that
     * never existed look identical from the outside.
     *
     * So this scenario reproduces the UNORDERED case deliberately, with raw
     * updates in opposite orders, and observes what PostgreSQL actually does.
     * It also answers empirically a question M2 could only take from the plan:
     * which Prisma error a real 40P01 arrives as. Nothing in `src/` is
     * exercised here — this is a statement about the database, which is
     * precisely what makes the ordering requirement worth having.
     *
     * THE ANSWER FALSIFIED THE ASSUMPTION, AND THE MAPPING WAS FIXED. The
     * abort arrives with no `code`, so the original REQ-ORDER-027 predicate —
     * which tested `error.code === "P2034"` alone — could never match a real
     * deadlock, leaving the requirement unsatisfied in production while its
     * unit test passed against an invented shape. `isTransactionConflict()` now
     * also reads the SQLSTATE out of the message, and the last assertion below
     * runs THAT function against the genuine aborted transaction captured here.
     *
     * That final assertion is what makes this file more than a record: the
     * message text it depends on is not an API contract, so if a future Prisma
     * reshapes it, this test fails and the mapping gets re-decided — rather
     * than the 500 quietly coming back (progress.md §E.2 M4 addendum).
     */
    const P = `${RUN}-d1`;
    const Q = `${RUN}-d2`;

    let settled: PromiseSettledResult<unknown>[];

    beforeAll(async () => {
      await makeProduct("d1", 50);
      await makeProduct("d2", 50);

      const pLocked = deferred();
      const qLocked = deferred();

      // Two interactive transactions, each taking one row lock, then waiting
      // for the other to take its own before reaching across. The barrier is
      // what guarantees the cycle forms rather than the two simply running
      // one after the other.
      const first = prisma.$transaction(
        async (tx) => {
          await tx.product.updateMany({ where: { id: P }, data: { stock: { decrement: 1 } } });
          pLocked.resolve();
          await qLocked.promise;
          await tx.product.updateMany({ where: { id: Q }, data: { stock: { decrement: 1 } } });
        },
        { timeout: 20000, maxWait: 20000 }
      );

      const second = prisma.$transaction(
        async (tx) => {
          await tx.product.updateMany({ where: { id: Q }, data: { stock: { decrement: 1 } } });
          qLocked.resolve();
          await pLocked.promise;
          await tx.product.updateMany({ where: { id: P }, data: { stock: { decrement: 1 } } });
        },
        { timeout: 20000, maxWait: 20000 }
      );

      settled = await Promise.allSettled([first, second]);

      console.log(
        `[SPEC-ORDER-002 M4] counterfactual outcomes: ${settled
          .map((result) =>
            result.status === "rejected"
              ? `REJECTED code=${
                  (result.reason as { code?: string }).code ?? "(none)"
                } :: ${(result.reason as Error).message.split("\n")[0]}`
              : "committed"
          )
          .join(" | ")}`
      );
    }, 40000);

    it("PostgreSQL aborts exactly one of the two — the deadlock is real", () => {
      const rejected = settled.filter((result) => result.status === "rejected");

      // If this ever returns 0, the ordering requirement is defending against
      // nothing on this engine and the SPEC's premise needs re-examining.
      expect(rejected).toHaveLength(1);
    });

    it("carries NO `code` property — plan.md §4 M2's P2034 assumption is falsified", () => {
      const rejected = settled.find((result) => result.status === "rejected");
      if (rejected?.status !== "rejected") throw new Error("expected one aborted transaction");

      const error = rejected.reason as { code?: string; constructor: { name: string } };
      console.log(
        `[SPEC-ORDER-002 M4] real deadlock arrives as ${error.constructor.name} with code=${String(
          error.code
        )}`
      );

      // MEASURED, not assumed. plan.md §4 M2 predicted a real 40P01 would
      // reach the service as Prisma `P2034`, and order-service's
      // isTransactionConflict() tests exactly `error.code === "P2034"`. On
      // Prisma 6.1 against PostgreSQL 16 it does not: the abort arrives as a
      // PrismaClientUnknownRequestError carrying no `code` at all, with the
      // SQLSTATE readable only inside the message text.
      //
      // This assertion is deliberately pinned to the OBSERVED shape rather
      // than the desired one, so it stays true. It is also a tripwire: if a
      // future Prisma starts classifying deadlocks, this test fails and sends
      // the reader to REQ-ORDER-027's mapping to re-decide it.
      expect(error.constructor.name).toBe("PrismaClientUnknownRequestError");
      expect(error.code).toBeUndefined();
    });

    it("names the SQLSTATE only inside the message text", () => {
      const rejected = settled.find((result) => result.status === "rejected");
      if (rejected?.status !== "rejected") throw new Error("expected one aborted transaction");

      // 40P01 is PostgreSQL's "deadlock detected". That it is reachable ONLY
      // by reading the message is the whole difficulty: a structured field can
      // be matched safely, a prose string cannot without the brittleness that
      // comes with it. Recording it here so the follow-up decision is made
      // against the real shape.
      expect((rejected.reason as Error).message).toContain("40P01");
      expect((rejected.reason as Error).message).toContain("deadlock detected");
    });

    it("is recognised by the SERVICE's own predicate (REQ-ORDER-027, closed)", () => {
      const rejected = settled.find((result) => result.status === "rejected");
      if (rejected?.status !== "rejected") throw new Error("expected one aborted transaction");

      // The production function, run against a real aborted transaction — not
      // a fixture, not a copy of its logic. This is the assertion that turns
      // REQ-ORDER-027 from "mapped, we believe" into "mapped, we watched it".
      //
      // It would have returned false before the fix: the error carries no
      // `code`, and the predicate tested only `code === "P2034"`.
      expect(isTransactionConflict(rejected.reason)).toBe(true);
    });
  }
);

// ---------------------------------------------------------------------------
// SPEC-DISCOUNT-001 M4 — REQ-DISCOUNT-016 (conditional atomic redemption
// increment), the coupon's own race, against the SAME live PostgreSQL.
// ---------------------------------------------------------------------------

describe.skipIf(!reachable)(
  "SPEC-DISCOUNT-001 M4 — two orders, one coupon redemption (REQ-DISCOUNT-016/017, AC-DISCOUNT-016/017)",
  () => {
    const PRODUCT = `${RUN}-coupon-solo`;
    const GUEST_E = `${RUN}-guest-e`;
    const GUEST_F = `${RUN}-guest-f`;

    /** maxRedemptions = 1 — the contended resource. Stock is plentiful, so
     * only the coupon's own conditional update is under test here; the
     * product-stock race is already covered above. */
    let coupon: { id: string; code: string };

    let settled: PromiseSettledResult<Awaited<ReturnType<typeof createOrder>>>[];

    /** itemsSubtotal 1000 (FIXED_AMOUNT 100 discount) -> totalAmount 900. */
    function couponOrderBody(key: string) {
      return { shipping: SHIPPING, idempotencyKey: `${RUN}-${key}`, couponCode: coupon.code, confirmedTotal: 900 };
    }

    beforeAll(async () => {
      coupon = await makeCoupon("coupon-solo", 1);
      await makeProduct("coupon-solo", 100);
      await makeCart(GUEST_E, [{ productId: PRODUCT, quantity: 1 }]);
      await makeCart(GUEST_F, [{ productId: PRODUCT, quantity: 1 }]);

      settled = await Promise.allSettled([
        createOrder(guest(GUEST_E), couponOrderBody("e")),
        createOrder(guest(GUEST_F), couponOrderBody("f")),
      ]);

      console.log(
        `[SPEC-DISCOUNT-001 M4] coupon-race outcomes: ${settled
          .map((result) =>
            result.status === "rejected"
              ? `REJECTED(${(result.reason as Error).message.split("\n")[0]})`
              : result.value.ok
                ? "ok"
                : `refused(${"code" in result.value ? result.value.code : result.value.status})`
          )
          .join(", ")}`
      );
    }, 30000);

    it("settles both orders — neither escapes as an unhandled error", () => {
      expect(settled.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    });

    it("lets exactly ONE of them succeed", () => {
      const succeeded = settled.filter(
        (result) => result.status === "fulfilled" && result.value.ok
      );

      // This is the assertion the milestone exists for. Both succeeding would
      // exceed maxRedemptions; neither succeeding means the guard is too strict.
      expect(succeeded).toHaveLength(1);
    });

    it("refuses the loser with 409 COUPON_EXHAUSTED — never an unclassified error", () => {
      const refused = settled.find((result) => result.status === "fulfilled" && !result.value.ok);
      expect(refused).toBeDefined();
      if (refused?.status !== "fulfilled" || refused.value.ok) return;

      expect(refused.value.status).toBe(409);
      expect("code" in refused.value ? refused.value.code : undefined).toBe("COUPON_EXHAUSTED");
    });

    it("leaves redeemedCount at exactly 1 — never exceeding maxRedemptions", async () => {
      const row = await prisma.coupon.findUnique({ where: { id: coupon.id } });

      // Negative or >1 would be the observable signature of a lost update —
      // two increments that both believed they had the last redemption.
      expect(row?.redeemedCount).toBe(1);
    });

    it("creates exactly ONE order, carrying the coupon snapshot", async () => {
      const orders = await prisma.order.findMany({
        where: { guestId: { in: [GUEST_E, GUEST_F] } },
      });

      expect(orders).toHaveLength(1);
      expect(orders[0]!.couponCode).toBe(coupon.code);
      expect(orders[0]!.discountAmount).toBe(100);
    });
  }
);
