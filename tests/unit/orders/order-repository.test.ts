import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * SPEC-ORDER-001 M2 — the order query layer.
 *
 * Traces: REQ-ORDER-011 (every write of the order transaction runs on the
 * client the transaction handed out), REQ-ORDER-013 (stock is decremented by a
 * CONDITIONAL update whose row count is the answer), REQ-ORDER-016 (the
 * idempotency lookup), REQ-ORDER-020 (an order is read back only for the guest
 * it belongs to).
 *
 * The load-bearing assertion in this file is not "the query returns rows" — it
 * is that a function GIVEN a transaction client uses THAT client and never the
 * module singleton. A repository that silently fell back to the singleton would
 * still pass a naive round-trip test while writing outside the transaction,
 * which is exactly the defect AC-ORDER-012 exists to catch (design.md §2).
 */

const singleton = {
  order: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  product: { updateMany: vi.fn(), findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: singleton }));

/**
 * A stand-in for the client `prisma.$transaction` hands its callback.
 *
 * Each mock declares its argument through vi.fn's TYPE PARAMETER rather than in
 * the implementation. A bare `vi.fn(async () => ...)` infers a zero-argument
 * signature, which makes `mock.calls[0]` an empty tuple under
 * `noUncheckedIndexedAccess` and every call-inspection below a type error —
 * while an unused `_args` parameter in the implementation would trip
 * no-unused-vars. The type parameter satisfies both.
 */
function fakeTx() {
  return {
    order: {
      findUnique: vi.fn<(args: unknown) => Promise<null>>(async () => null),
      findFirst: vi.fn<(args: unknown) => Promise<null>>(async () => null),
      create: vi.fn<(args: unknown) => Promise<{ id: string }>>(async () => ({ id: "order-1" })),
    },
    product: {
      updateMany: vi.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({ count: 1 })),
      findMany: vi.fn<(args: unknown) => Promise<Array<{ id: string; stock: number }>>>(
        async () => []
      ),
    },
  };
}

const repo = await import("@/features/orders/repositories/order-repository");

beforeEach(() => {
  vi.clearAllMocks();
  singleton.order.findUnique.mockResolvedValue(null);
  singleton.order.findFirst.mockResolvedValue(null);
  singleton.order.create.mockResolvedValue({ id: "order-singleton" });
  singleton.product.updateMany.mockResolvedValue({ count: 1 });
  singleton.product.findMany.mockResolvedValue([]);
});

describe("SPEC-ORDER-001 M2 — findOrderByIdempotencyKey (REQ-ORDER-016)", () => {
  it("looks the order up by its idempotency key", async () => {
    await repo.findOrderByIdempotencyKey("key-1");

    expect(singleton.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: "key-1" } })
    );
  });

  it("joins the items, so a replayed submission returns the WHOLE first order", async () => {
    await repo.findOrderByIdempotencyKey("key-1");

    const [arg] = singleton.order.findUnique.mock.calls[0]!;
    // Without the join the replay would answer with an order carrying no
    // lines, which is not "the order the first request created" (AC-016 (a)).
    expect(arg).toHaveProperty("include.items");
  });

  it("runs on the transaction client when given one", async () => {
    const tx = fakeTx();
    await repo.findOrderByIdempotencyKey("key-1", tx as never);

    expect(tx.order.findUnique).toHaveBeenCalledTimes(1);
    expect(singleton.order.findUnique).not.toHaveBeenCalled();
  });
});

describe("SPEC-ORDER-001 M2 — decrementStockIfAvailable (REQ-ORDER-013, design.md §3)", () => {
  it("guards the decrement with a stock condition inside the UPDATE itself", async () => {
    const tx = fakeTx();
    await repo.decrementStockIfAvailable(tx as never, "p-1", 3);

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      // The `gte` in the WHERE is what makes this safe under concurrency: the
      // database, not the application, decides whether the row qualifies.
      where: { id: "p-1", stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
  });

  it("returns the affected row count, which is the whole answer", async () => {
    const tx = fakeTx();
    tx.product.updateMany.mockResolvedValue({ count: 0 });

    // 0 means the condition did not hold — the caller turns that into
    // INSUFFICIENT_STOCK and aborts the transaction.
    await expect(repo.decrementStockIfAvailable(tx as never, "p-1", 99)).resolves.toBe(0);
  });

  it("never falls back to the module singleton", async () => {
    const tx = fakeTx();
    await repo.decrementStockIfAvailable(tx as never, "p-1", 1);

    expect(singleton.product.updateMany).not.toHaveBeenCalled();
  });
});

describe("SPEC-ORDER-002 M1 — findStockByProductIds (REQ-ORDER-025)", () => {
  it("reads the current stock of exactly the products it was given", async () => {
    const tx = fakeTx();
    await repo.findStockByProductIds(tx as never, ["p-1", "p-2"]);

    expect(tx.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["p-1", "p-2"] } },
      select: { id: true, stock: true },
    });
  });

  it("returns the rows as read, with no reshaping", async () => {
    const tx = fakeTx();
    tx.product.findMany.mockResolvedValue([
      { id: "p-1", stock: 0 },
      { id: "p-2", stock: 3 },
    ]);

    await expect(repo.findStockByProductIds(tx as never, ["p-1", "p-2"])).resolves.toEqual([
      { id: "p-1", stock: 0 },
      { id: "p-2", stock: 3 },
    ]);
  });

  it("takes the transaction client with no singleton default (REQ-ORDER-025)", async () => {
    const tx = fakeTx();
    await repo.findStockByProductIds(tx as never, ["p-1"]);

    // The whole value of this read is that it sees the CURRENT stock inside the
    // failing transaction. A singleton fallback would read outside it and hand
    // back the same stale figure the failure report exists to replace.
    expect(singleton.product.findMany).not.toHaveBeenCalled();
    expect(repo.findStockByProductIds.length).toBe(2);
  });
});

describe("SPEC-ORDER-001 M2 — createOrderWithItems (REQ-ORDER-001/002/011)", () => {
  const row = {
    orderNumber: "ORD-20260831-ABC123",
    guestId: "G1",
    idempotencyKey: "key-1",
    recipientName: "홍길동",
    recipientPhone: "010-0000-0000",
    postalCode: "06236",
    address: "서울시 어딘가 1",
    deliveryMemo: null,
    itemsSubtotal: 20000,
    shippingFee: 0,
    totalAmount: 20000,
    couponCode: null,
    discountAmount: 0,
    items: [
      { productId: "p-1", productName: "Tee", unitPrice: 10000, quantity: 2, lineTotal: 20000 },
    ],
  };

  it("writes the order and its lines in ONE nested create on the tx client", async () => {
    const tx = fakeTx();
    await repo.createOrderWithItems(tx as never, row);

    expect(tx.order.create).toHaveBeenCalledTimes(1);
    const [arg] = tx.order.create.mock.calls[0]! as [{ data: Record<string, unknown> }];
    // A nested create keeps the lines inside the same statement as the order,
    // so no intermediate state exists where an order has no items.
    expect(arg.data).toHaveProperty("items.create");
    expect(arg.data.guestId).toBe("G1");
    expect(singleton.order.create).not.toHaveBeenCalled();
  });

  it("carries the per-line snapshot fields through unchanged (REQ-ORDER-002)", async () => {
    const tx = fakeTx();
    await repo.createOrderWithItems(tx as never, row);

    const [arg] = tx.order.create.mock.calls[0]! as [
      { data: { items: { create: Array<Record<string, unknown>> } } },
    ];
    expect(arg.data.items.create).toEqual([
      { productId: "p-1", productName: "Tee", unitPrice: 10000, quantity: 2, lineTotal: 20000 },
    ]);
  });

  it("sets no status, leaving the schema default pending_payment (REQ-ORDER-017)", async () => {
    const tx = fakeTx();
    await repo.createOrderWithItems(tx as never, row);

    const [arg] = tx.order.create.mock.calls[0]! as [{ data: Record<string, unknown> }];
    // Writing the status explicitly would put a second declaration of "what a
    // new order is" beside the schema default; one is enough.
    expect(arg.data).not.toHaveProperty("status");
  });
});

describe("SPEC-ORDER-001 M2 — findOrderForGuest (REQ-ORDER-020)", () => {
  it("filters by BOTH the order id and the owning guest id", async () => {
    await repo.findOrderForGuest("order-1", "G1");

    // Knowing the id must not be enough — the guest cookie has to match too,
    // which is what stops a stranger opening someone else's order.
    expect(singleton.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1", guestId: "G1" } })
    );
  });

  it("joins the items so the completion screen can render the lines", async () => {
    await repo.findOrderForGuest("order-1", "G1");

    const [arg] = singleton.order.findFirst.mock.calls[0]!;
    expect(arg).toHaveProperty("include.items");
  });
});

describe("SPEC-ORDER-003 M1 — findOrderByNumberAndPhone (REQ-ORDER-034 ~ 037, plan.md §1)", () => {
  it("bakes BOTH orderNumber and recipientPhone into ONE findFirst where clause", async () => {
    await repo.findOrderByNumberAndPhone("ORD-20260903-0001", "010-1234-5678");

    // Both conditions in the SAME query, not "fetch by orderNumber then
    // compare recipientPhone in application code" — a fetch-then-compare
    // shape is one missed branch away from leaking a stranger's order
    // (plan.md §1's rejected alternative).
    expect(singleton.order.findFirst).toHaveBeenCalledTimes(1);
    expect(singleton.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: "ORD-20260903-0001", recipientPhone: "010-1234-5678" },
      })
    );
  });

  it("joins the items so the lookup result can render the order snapshot", async () => {
    await repo.findOrderByNumberAndPhone("ORD-20260903-0001", "010-1234-5678");

    const [arg] = singleton.order.findFirst.mock.calls[0]!;
    expect(arg).toHaveProperty("include.items");
  });

  it("runs on the transaction client when given one", async () => {
    const tx = fakeTx();
    await repo.findOrderByNumberAndPhone("ORD-20260903-0001", "010-1234-5678", tx as never);

    expect(tx.order.findFirst).toHaveBeenCalledTimes(1);
    expect(singleton.order.findFirst).not.toHaveBeenCalled();
  });
});

describe("SPEC-ORDER-003 M2 — findOrderByNumberForGuest (REQ-ORDER-044, plan.md §3 M2)", () => {
  it("bakes BOTH orderNumber and guestId into ONE findFirst where clause", async () => {
    await repo.findOrderByNumberForGuest("ORD-20260903-0001", "G1");

    // Same discipline as findOrderForGuest() and findOrderByNumberAndPhone()
    // above: ownership is part of the WHERE, never fetch-then-compare — this
    // is the cookie-bypass path (AC-ORDER-048), so it carries the same
    // structural guarantee against leaking a stranger's order.
    expect(singleton.order.findFirst).toHaveBeenCalledTimes(1);
    expect(singleton.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: "ORD-20260903-0001", guestId: "G1" },
      })
    );
  });

  it("joins the items so the cookie-bypass path can render the order snapshot", async () => {
    await repo.findOrderByNumberForGuest("ORD-20260903-0001", "G1");

    const [arg] = singleton.order.findFirst.mock.calls[0]!;
    expect(arg).toHaveProperty("include.items");
  });

  it("runs on the transaction client when given one", async () => {
    const tx = fakeTx();
    await repo.findOrderByNumberForGuest("ORD-20260903-0001", "G1", tx as never);

    expect(tx.order.findFirst).toHaveBeenCalledTimes(1);
    expect(singleton.order.findFirst).not.toHaveBeenCalled();
  });
});

describe("SPEC-ORDER-001 M2 — module boundaries", () => {
  const source = readFileSync("src/features/orders/repositories/order-repository.ts", "utf8");

  it("does not reach into the cart domain's queries (design.md §2.1)", () => {
    // The transaction reads and clears the cart through cart-repository's own
    // functions, given the tx client. Re-implementing the ownership query here
    // would fork the authorization surface the cart module anchors.
    expect(source).not.toMatch(/\.cart\./);
    expect(source).not.toMatch(/CART_INCLUDE|guestId:\s*guestId/);
  });

  it("imports nothing from next/*, keeping features/ delivery-independent", () => {
    expect(source).not.toMatch(/from\s+["']next\//);
  });
});
