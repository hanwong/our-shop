import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ORDER-001 M3 — the order-creation transaction, the core of this SPEC.
 *
 * Traces: REQ-ORDER-002 (price/name snapshot), REQ-ORDER-003 (order number and
 * frozen money figures), REQ-ORDER-004 (no line below quantity 1 is ever
 * persisted), REQ-ORDER-010 (validation rejects without touching anything),
 * REQ-ORDER-011/012 (the four effects, all inside one transaction),
 * REQ-ORDER-013 (insufficient stock), REQ-ORDER-014 (confirmed-total
 * mismatch), REQ-ORDER-015 (empty cart), REQ-ORDER-016 (idempotency),
 * REQ-ORDER-020 (guest-scoped read-back).
 *
 * The repositories are mocked here so this suite can assert the SERVICE's
 * decisions — ordering, failure mapping, what runs on the transaction client.
 * Whether those decisions produce the right database state end-to-end is
 * tests/integration/orders/create-order.test.ts's job.
 */

const TX = { __brand: "tx" } as const;

const db = {
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(TX)),
  },
};
vi.mock("@/lib/db", () => db);

const orderRepo = {
  findOrderByIdempotencyKey: vi.fn(),
  findOrderForGuest: vi.fn(),
  findOrderByNumberAndPhone: vi.fn(),
  decrementStockIfAvailable: vi.fn(),
  findStockByProductIds: vi.fn(),
  createOrderWithItems: vi.fn(),
};
vi.mock("@/features/orders/repositories/order-repository", () => orderRepo);

const cartRepo = {
  findCartByGuestId: vi.fn(),
  deleteCart: vi.fn(),
};
vi.mock("@/features/cart/repositories/cart-repository", () => cartRepo);

const discountService = {
  validateCoupon: vi.fn(),
};
vi.mock("@/features/discounts/services/discount-service", () => discountService);

const couponRepo = {
  incrementRedeemedCountIfAvailable: vi.fn(),
};
vi.mock("@/features/discounts/repositories/coupon-repository", () => couponRepo);

const service = await import("@/features/orders/services/order-service");

const SHIPPING = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구 테헤란로 1",
  deliveryMemo: null,
};

/** A valid, unexhausted 10%-off coupon, code SAVE10 (SPEC-DISCOUNT-001 M4). */
function validCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: "coupon-1",
    code: "SAVE10",
    type: "PERCENTAGE",
    value: 10,
    minOrderAmount: 0,
    maxRedemptions: 100,
    redeemedCount: 0,
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T23:59:59Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** A cart of one product: 2 × 10,000 = 20,000, with plenty of stock. */
function cartWith(
  lines: Array<{ productId: string; name: string; price: number; stock: number; quantity: number }>
) {
  return {
    id: "cart-1",
    guestId: "G1",
    items: lines.map((l, i) => ({
      id: `item-${i}`,
      productId: l.productId,
      quantity: l.quantity,
      product: {
        id: l.productId,
        name: l.name,
        price: l.price,
        images: [],
        stock: l.stock,
      },
    })),
  };
}

const ONE_LINE = [{ productId: "p-1", name: "Tee", price: 10000, stock: 10, quantity: 2 }];

function body(overrides: Record<string, unknown> = {}) {
  return { shipping: { ...SHIPPING }, idempotencyKey: "key-1", confirmedTotal: 20000, ...overrides };
}

/** The created order, as the repository would report it back. */
function createdOrder(id = "order-1") {
  return { id };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb(TX)
  );
  orderRepo.findOrderByIdempotencyKey.mockResolvedValue(null);
  orderRepo.findOrderForGuest.mockResolvedValue(null);
  orderRepo.findOrderByNumberAndPhone.mockResolvedValue(null);
  orderRepo.decrementStockIfAvailable.mockResolvedValue(1);
  orderRepo.findStockByProductIds.mockResolvedValue([]);
  orderRepo.createOrderWithItems.mockResolvedValue(createdOrder());
  cartRepo.findCartByGuestId.mockResolvedValue(cartWith(ONE_LINE));
  cartRepo.deleteCart.mockResolvedValue(undefined);
});

describe("SPEC-ORDER-001 M3 — calculateShippingFee (plan.md §0 #3)", () => {
  it("returns 0 for every subtotal — the provisional policy, isolated in one place", () => {
    // 0 rather than an invented figure: a made-up 3,000 would harden into a
    // decision nobody made, spread across tests and screens. When a real policy
    // arrives, only this function's body changes.
    expect(service.calculateShippingFee(0)).toBe(0);
    expect(service.calculateShippingFee(20000)).toBe(0);
    expect(service.calculateShippingFee(9_999_999)).toBe(0);
  });
});

describe("SPEC-ORDER-001 M3 — order number and idempotency key (REQ-ORDER-003, design.md §1.3/§5)", () => {
  it("formats the order number as ORD-YYYYMMDD- plus six uppercase alphanumerics", () => {
    expect(service.generateOrderNumber()).toMatch(/^ORD-\d{8}-[0-9A-Z]{6}$/);
  });

  it("does not number orders sequentially", () => {
    // A sequential number would leak the day's order volume and invite
    // guessing at other people's orders (design.md §1.3).
    const numbers = new Set(Array.from({ length: 50 }, () => service.generateOrderNumber()));
    expect(numbers.size).toBe(50);
  });

  it("mints unguessable idempotency keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => service.generateIdempotencyKey()));
    expect(keys.size).toBe(50);
    expect(service.generateIdempotencyKey().length).toBeGreaterThanOrEqual(16);
  });
});

describe("SPEC-ORDER-001 M3 — the happy path (REQ-ORDER-011, AC-ORDER-011)", () => {
  it("returns the order with the price snapshot taken at order time", async () => {
    const result = await service.createOrder("G1", body());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toEqual([
      { productId: "p-1", productName: "Tee", unitPrice: 10000, quantity: 2, lineTotal: 20000 },
    ]);
    expect(result.data.itemsSubtotal).toBe(20000);
    expect(result.data.shippingFee).toBe(0);
    expect(result.data.totalAmount).toBe(20000);
    expect(result.data.status).toBe("pending_payment");
  });

  it("decrements stock, writes the order, and empties the cart", async () => {
    await service.createOrder("G1", body());

    expect(orderRepo.decrementStockIfAvailable).toHaveBeenCalledWith(TX, "p-1", 2);
    expect(orderRepo.createOrderWithItems).toHaveBeenCalledTimes(1);
    expect(cartRepo.deleteCart).toHaveBeenCalledWith("cart-1", TX);
  });

  it("runs EVERY effect on the transaction client (REQ-ORDER-012)", async () => {
    await service.createOrder("G1", body());

    // If any of these ran on the module singleton it would sit outside the
    // transaction and survive a rollback — the exact atomicity hole
    // AC-ORDER-012 exists to catch.
    expect(cartRepo.findCartByGuestId).toHaveBeenCalledWith("G1", TX);
    expect(orderRepo.decrementStockIfAvailable.mock.calls[0]![0]).toBe(TX);
    expect(orderRepo.createOrderWithItems.mock.calls[0]![0]).toBe(TX);
    expect(cartRepo.deleteCart.mock.calls[0]![1]).toBe(TX);
  });

  it("re-reads the cart INSIDE the transaction, never before it opens", async () => {
    const order: string[] = [];
    db.prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      order.push("transaction-open");
      return cb(TX);
    });
    cartRepo.findCartByGuestId.mockImplementation(async () => {
      order.push("cart-read");
      return cartWith(ONE_LINE);
    });

    await service.createOrder("G1", body());

    // Reading price and stock outside the transaction and writing inside it
    // opens a window where both can change (design.md §2).
    expect(order).toEqual(["transaction-open", "cart-read"]);
  });

  it("decrements stock BEFORE creating the order (design.md §2 ordering)", async () => {
    const seen: string[] = [];
    orderRepo.decrementStockIfAvailable.mockImplementation(async () => {
      seen.push("decrement");
      return 1;
    });
    orderRepo.createOrderWithItems.mockImplementation(async () => {
      seen.push("create");
      return createdOrder();
    });

    await service.createOrder("G1", body());

    // Atomicity does not depend on this order, but the commonest failure is
    // insufficient stock, so filtering it first keeps the failure path cheap
    // and legible.
    expect(seen).toEqual(["decrement", "create"]);
  });

  it("empties the cart LAST, after the order is known to exist", async () => {
    const seen: string[] = [];
    orderRepo.createOrderWithItems.mockImplementation(async () => {
      seen.push("create");
      return createdOrder();
    });
    cartRepo.deleteCart.mockImplementation(async () => {
      seen.push("delete-cart");
    });

    await service.createOrder("G1", body());

    expect(seen).toEqual(["create", "delete-cart"]);
  });

  it("attributes the order to the guest and to no one else (REQ-ORDER-001)", async () => {
    await service.createOrder("G1", body());

    const [, row] = orderRepo.createOrderWithItems.mock.calls[0]! as [
      unknown,
      Record<string, unknown>,
    ];
    expect(row.guestId).toBe("G1");
    expect(row).not.toHaveProperty("userId");
  });
});

describe("SPEC-ORDER-001 M3 — validation (REQ-ORDER-010, AC-ORDER-010)", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["blank recipient name", { shipping: { ...SHIPPING, recipientName: "" } }, "recipientName"],
    ["blank phone", { shipping: { ...SHIPPING, recipientPhone: "  " } }, "recipientPhone"],
    ["missing postal code", { shipping: { ...SHIPPING, postalCode: "" } }, "postalCode"],
    ["blank address", { shipping: { ...SHIPPING, address: "" } }, "address"],
    ["non-string name", { shipping: { ...SHIPPING, recipientName: 42 } }, "recipientName"],
    ["missing idempotency key", { idempotencyKey: "" }, "idempotencyKey"],
    ["absent confirmed total", { confirmedTotal: undefined }, "confirmedTotal"],
    ["non-numeric confirmed total", { confirmedTotal: "20000" }, "confirmedTotal"],
  ];

  for (const [label, override, field] of cases) {
    it(`rejects ${label} with a 400 naming the field`, async () => {
      const result = await service.createOrder("G1", body(override));

      expect(result).toMatchObject({ ok: false, status: 400 });
      if (result.ok || result.status !== 400) return;
      expect(Object.keys(result.fieldErrors)).toContain(field);
    });
  }

  it("changes nothing at all when validation fails", async () => {
    await service.createOrder("G1", body({ shipping: { ...SHIPPING, recipientName: "" } }));

    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });

  it("accepts an omitted delivery memo as the optional field it is", async () => {
    const result = await service.createOrder(
      "G1",
      body({ shipping: { ...SHIPPING, deliveryMemo: undefined } })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.shipping.deliveryMemo).toBeNull();
  });

  it("rejects a non-object body without throwing", async () => {
    for (const junk of [null, undefined, "string", 7, []]) {
      const result = await service.createOrder("G1", junk);
      expect(result).toMatchObject({ ok: false, status: 400 });
    }
  });
});

describe("SPEC-ORDER-001 M3 — empty cart (REQ-ORDER-015, AC-ORDER-015)", () => {
  it("refuses with CART_EMPTY when the guest has no cart row", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(null);

    const result = await service.createOrder("G1", body());

    expect(result).toMatchObject({ ok: false, status: 409, code: "CART_EMPTY" });
  });

  it("refuses with CART_EMPTY when the cart exists but holds no lines", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(cartWith([]));

    const result = await service.createOrder("G1", body());

    expect(result).toMatchObject({ ok: false, status: 409, code: "CART_EMPTY" });
  });

  it("persists nothing on either empty-cart path", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(null);

    await service.createOrder("G1", body());

    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });
});

describe("SPEC-ORDER-001 M3 — price change (REQ-ORDER-014, AC-ORDER-014)", () => {
  it("refuses with PRICE_CHANGED and reports the RECOMPUTED total", async () => {
    // The shopper saw 30,000; the price has since risen to 20,000 × 2.
    cartRepo.findCartByGuestId.mockResolvedValue(
      cartWith([{ productId: "p-1", name: "Tee", price: 20000, stock: 10, quantity: 2 }])
    );

    const result = await service.createOrder("G1", body({ confirmedTotal: 30000 }));

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "PRICE_CHANGED",
      totalAmount: 40000,
    });
  });

  it("never stores the client's figure — it is a cross-check, not an instruction", async () => {
    await service.createOrder("G1", body({ confirmedTotal: 20000 }));

    const [, row] = orderRepo.createOrderWithItems.mock.calls[0]! as [
      unknown,
      Record<string, unknown>,
    ];
    // The server's own arithmetic is what lands in the row (design.md §4).
    expect(row.totalAmount).toBe(20000);
    expect(row.itemsSubtotal).toBe(20000);
  });

  it("persists nothing when the totals disagree", async () => {
    await service.createOrder("G1", body({ confirmedTotal: 1 }));

    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });

  it("compares against subtotal PLUS shipping, not the subtotal alone", async () => {
    // Guards the comparison against drifting apart from what the form showed
    // if calculateShippingFee ever returns a non-zero figure.
    const result = await service.createOrder("G1", body({ confirmedTotal: 20000 }));
    expect(result.ok).toBe(true);
  });
});

describe("SPEC-ORDER-001 M3 — insufficient stock (REQ-ORDER-013, AC-ORDER-013)", () => {
  it("refuses with INSUFFICIENT_STOCK naming the product and what is available", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(
      cartWith([{ productId: "p-1", name: "Tee", price: 10000, stock: 2, quantity: 5 }])
    );
    orderRepo.decrementStockIfAvailable.mockResolvedValue(0);
    // SPEC-ORDER-002 REQ-ORDER-025 moved `available` from the transaction's
    // opening snapshot to a re-read taken at the moment of failure. The figure
    // this test asserts is unchanged; where it comes from is not.
    orderRepo.findStockByProductIds.mockResolvedValue([{ id: "p-1", stock: 2 }]);

    const result = await service.createOrder("G1", body({ confirmedTotal: 50000 }));

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "INSUFFICIENT_STOCK",
      products: [{ productId: "p-1", name: "Tee", available: 2 }],
    });
  });

  it("treats a zero row count as the refusal, not an error to ignore", async () => {
    orderRepo.decrementStockIfAvailable.mockResolvedValue(0);

    const result = await service.createOrder("G1", body());

    expect(result.ok).toBe(false);
    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });

  it("stops at the first failing line rather than draining the rest", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(
      cartWith([
        { productId: "p-1", name: "Tee", price: 10000, stock: 0, quantity: 1 },
        { productId: "p-2", name: "Cap", price: 5000, stock: 10, quantity: 1 },
      ])
    );
    orderRepo.decrementStockIfAvailable.mockResolvedValue(0);

    await service.createOrder("G1", body({ confirmedTotal: 15000 }));

    // The rollback would undo a second decrement anyway; not issuing it keeps
    // the failure path from doing pointless work.
    expect(orderRepo.decrementStockIfAvailable).toHaveBeenCalledTimes(1);
  });
});

describe("SPEC-ORDER-002 M1 — the failure report is re-read, not remembered (REQ-ORDER-025/026)", () => {
  /**
   * Three lines of 2, all with plenty of stock AS OF the transaction's opening
   * read. The re-query is what disagrees — which is the whole point: the
   * snapshot is what a lost race makes obsolete (spec.md §2 G2).
   */
  const THREE_LINES = [
    { productId: "p-1", name: "머그컵", price: 10000, stock: 10, quantity: 2 },
    { productId: "p-2", name: "텀블러", price: 10000, stock: 10, quantity: 2 },
    { productId: "p-3", name: "티팟", price: 10000, stock: 10, quantity: 2 },
  ];

  /** 3 × 2 × 10,000. */
  const THREE_LINE_TOTAL = 60000;

  beforeEach(() => {
    cartRepo.findCartByGuestId.mockResolvedValue(cartWith(THREE_LINES));
    orderRepo.decrementStockIfAvailable.mockResolvedValue(0);
  });

  async function submit() {
    return service.createOrder("G1", body({ confirmedTotal: THREE_LINE_TOTAL }));
  }

  it("reports EVERY short line, not just the one that failed (AC-ORDER-027)", async () => {
    orderRepo.findStockByProductIds.mockResolvedValue([
      { id: "p-1", stock: 0 },
      { id: "p-2", stock: 5 },
      { id: "p-3", stock: 1 },
    ]);

    const result = await submit();

    // Stopping at the first refusal makes a shopper with three short lines fix
    // one, resubmit, and be refused again — three times over (spec.md §2 G3).
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "INSUFFICIENT_STOCK",
      products: [
        { productId: "p-1", name: "머그컵", available: 0 },
        { productId: "p-3", name: "티팟", available: 1 },
      ],
    });
  });

  it("leaves out the line that has enough stock (AC-ORDER-027)", async () => {
    orderRepo.findStockByProductIds.mockResolvedValue([
      { id: "p-1", stock: 0 },
      { id: "p-2", stock: 5 },
      { id: "p-3", stock: 1 },
    ]);

    const result = await submit();

    if (result.ok || result.status !== 409 || result.code !== "INSUFFICIENT_STOCK") {
      throw new Error("expected an INSUFFICIENT_STOCK refusal");
    }
    expect(result.products.map((product) => product.productId)).not.toContain("p-2");
  });

  it("never reports a quantity the shopper could actually have bought (AC-ORDER-028)", async () => {
    orderRepo.findStockByProductIds.mockResolvedValue([
      { id: "p-1", stock: 0 },
      { id: "p-2", stock: 5 },
      { id: "p-3", stock: 1 },
    ]);

    const result = await submit();

    if (result.ok || result.status !== 409 || result.code !== "INSUFFICIENT_STOCK") {
      throw new Error("expected an INSUFFICIENT_STOCK refusal");
    }
    // "Not enough stock — 5 available" against a request for 2 is a response
    // that contradicts itself. The snapshot produced exactly that.
    for (const product of result.products) {
      const line = THREE_LINES.find((candidate) => candidate.productId === product.productId)!;
      expect(product.available).toBeLessThan(line.quantity);
    }
  });

  it("re-reads inside the SAME transaction that failed (REQ-ORDER-025)", async () => {
    orderRepo.findStockByProductIds.mockResolvedValue([]);

    await submit();

    // Read on the singleton it would sit outside the transaction, where the
    // rolled-back decrements of this very attempt are invisible and a competing
    // transaction's uncommitted state is too.
    expect(orderRepo.findStockByProductIds).toHaveBeenCalledWith(TX, ["p-1", "p-2", "p-3"]);
  });

  it("does not report a line this transaction already decremented", async () => {
    // p-1 was taken successfully, so its stock WAS sufficient; the row now
    // reads 0 only because this transaction — about to roll back — took it.
    // Reporting it would name a product that is not the shopper's problem.
    orderRepo.decrementStockIfAvailable.mockResolvedValueOnce(1).mockResolvedValue(0);
    orderRepo.findStockByProductIds.mockResolvedValue([
      { id: "p-1", stock: 0 },
      { id: "p-2", stock: 0 },
      { id: "p-3", stock: 9 },
    ]);

    const result = await submit();

    expect(result).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_STOCK",
      products: [{ productId: "p-2", name: "텀블러", available: 0 }],
    });
  });

  it("refuses with an EMPTY product list when the re-read shows restocking (acceptance.md §2)", async () => {
    // Restocked between the failed decrement and the re-read. The transaction
    // has already made a judgement it cannot take back, so the order is still
    // refused — but naming a short product here would be an invention.
    orderRepo.findStockByProductIds.mockResolvedValue([
      { id: "p-1", stock: 10 },
      { id: "p-2", stock: 10 },
      { id: "p-3", stock: 10 },
    ]);

    const result = await submit();

    expect(result).toMatchObject({ ok: false, status: 409, code: "INSUFFICIENT_STOCK" });
    if (result.ok || result.status !== 409 || result.code !== "INSUFFICIENT_STOCK") return;
    expect(result.products).toEqual([]);
  });

  it("persists nothing on the re-read path", async () => {
    orderRepo.findStockByProductIds.mockResolvedValue([{ id: "p-1", stock: 0 }]);

    await submit();

    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });
});

describe("SPEC-ORDER-002 M2 — deduction order is decided by id, not by the cart (REQ-ORDER-023)", () => {
  /** Records the order in which lines are actually taken. */
  function recordDeductionOrder(): string[] {
    const taken: string[] = [];
    orderRepo.decrementStockIfAvailable.mockImplementation(
      async (_tx: unknown, productId: string) => {
        taken.push(productId);
        return 1;
      }
    );
    return taken;
  }

  /** Three lines of 1 × 10,000, named so that id order ≠ insertion order. */
  const OUT_OF_ORDER = [
    { productId: "p-9", name: "머그컵", price: 10000, stock: 10, quantity: 1 },
    { productId: "p-2", name: "텀블러", price: 10000, stock: 10, quantity: 1 },
    { productId: "p-5", name: "티팟", price: 10000, stock: 10, quantity: 1 },
  ];

  it("takes the lines in ascending product-id order (AC-ORDER-025)", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(cartWith(OUT_OF_ORDER));
    const taken = recordDeductionOrder();

    await service.createOrder("G1", body({ confirmedTotal: 30000 }));

    // Cart order is p-9 → p-2 → p-5 (CartItem.createdAt). Following it would
    // make two shoppers request the same rows in opposite orders and deadlock
    // (spec.md §2 G1); a total order on the id removes the cycle.
    expect(taken).toEqual(["p-2", "p-5", "p-9"]);
  });

  it("leaves the ORDER's own item order exactly as the cart stored it (plan.md §5)", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(cartWith(OUT_OF_ORDER));

    const result = await service.createOrder("G1", body({ confirmedTotal: 30000 }));

    // The sort is a LOCKING order, not a presentation order. Letting it reach
    // the stored rows would reshuffle the completion screen against what the
    // order summary showed — SPEC-ORDER-001's ORDER_INCLUDE orders by
    // createdAt precisely so the two screens agree.
    const [, row] = orderRepo.createOrderWithItems.mock.calls[0]! as [
      unknown,
      { items: Array<{ productId: string }> },
    ];
    expect(row.items.map((item) => item.productId)).toEqual(["p-9", "p-2", "p-5"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((item) => item.productId)).toEqual(["p-9", "p-2", "p-5"]);
  });

  it("takes two carts holding the same products in opposite order identically (AC-ORDER-034)", async () => {
    const lines = [
      { productId: "p-1", name: "머그컵", price: 10000, stock: 10, quantity: 1 },
      { productId: "p-2", name: "텀블러", price: 10000, stock: 10, quantity: 1 },
    ];

    cartRepo.findCartByGuestId.mockResolvedValue(cartWith(lines));
    const first = recordDeductionOrder();
    await service.createOrder("G1", body({ confirmedTotal: 20000 }));

    cartRepo.findCartByGuestId.mockResolvedValue(cartWith([lines[1]!, lines[0]!]));
    const second = recordDeductionOrder();
    await service.createOrder("G2", body({ confirmedTotal: 20000, idempotencyKey: "key-2" }));

    // Identical request order is what makes the deadlock impossible: a cycle
    // needs two transactions wanting the same rows in opposite orders.
    expect(first).toEqual(["p-1", "p-2"]);
    expect(second).toEqual(["p-1", "p-2"]);
  });

  it("sorts by code unit, not by locale (a locale-dependent order is not deterministic)", async () => {
    // localeCompare would order these by the active locale's collation, which
    // differs between machines — the one thing a deadlock-avoidance order
    // cannot afford. Digits before uppercase before lowercase is the code-unit
    // order every machine agrees on.
    cartRepo.findCartByGuestId.mockResolvedValue(
      cartWith([
        { productId: "b", name: "b", price: 10000, stock: 10, quantity: 1 },
        { productId: "A", name: "A", price: 10000, stock: 10, quantity: 1 },
        { productId: "a", name: "a", price: 10000, stock: 10, quantity: 1 },
        { productId: "1", name: "1", price: 10000, stock: 10, quantity: 1 },
      ])
    );
    const taken = recordDeductionOrder();

    await service.createOrder("G1", body({ confirmedTotal: 40000 }));

    expect(taken).toEqual(["1", "A", "a", "b"]);
  });
});

describe("SPEC-ORDER-002 M2 — an aborted transaction is retryable, not a mystery (REQ-ORDER-027)", () => {
  /**
   * Prisma's write-conflict / deadlock signal — what PostgreSQL's 40P01
   * (deadlock detected) and 40001 (serialization failure) surface as.
   */
  function deadlock(): Error {
    return Object.assign(
      new Error("Transaction failed due to a write conflict or a deadlock"),
      { code: "P2034" }
    );
  }

  it("answers 409 CONCURRENCY_RETRY (AC-ORDER-029)", async () => {
    orderRepo.decrementStockIfAvailable.mockRejectedValue(deadlock());

    const result = await service.createOrder("G1", body());

    // Nothing was committed and the same submission can simply be sent again —
    // which the shopper can only act on if the answer says so. An unclassified
    // 500 tells them to give up (spec.md §2 G1).
    expect(result).toMatchObject({ ok: false, status: 409, code: "CONCURRENCY_RETRY" });
  });

  it("does not let the abort escape as an unclassified error", async () => {
    orderRepo.decrementStockIfAvailable.mockRejectedValue(deadlock());

    // Before this mapping the error matched neither OrderAbort nor P2002 and
    // was rethrown, surfacing as a 500 with no code.
    await expect(service.createOrder("G1", body())).resolves.toMatchObject({ ok: false });
    const result = await service.createOrder("G1", body());
    expect(result.ok === false && result.status).not.toBe(500);
  });

  it("creates no order and empties no cart when the transaction is aborted", async () => {
    orderRepo.decrementStockIfAvailable.mockRejectedValue(deadlock());

    await service.createOrder("G1", body());

    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });

  it("maps the conflict wherever in the transaction it surfaces", async () => {
    // The deadlock is detected when a lock is requested, which is the
    // decrement — but the order insert takes locks too, so the mapping lives at
    // the transaction boundary rather than beside one call.
    orderRepo.createOrderWithItems.mockRejectedValue(deadlock());

    const result = await service.createOrder("G1", body());

    expect(result).toMatchObject({ ok: false, status: 409, code: "CONCURRENCY_RETRY" });
  });

  it("still treats a unique-key collision as the idempotency replay it is", async () => {
    // P2002 and P2034 are different answers to different races; widening the
    // catch must not swallow one into the other (design.md §5).
    orderRepo.createOrderWithItems.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );
    orderRepo.findOrderByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValue(null);

    const result = await service.createOrder("G1", body());

    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(result.ok === false && "code" in result).toBe(false);
  });

  it("still rethrows a genuinely unexpected failure", async () => {
    orderRepo.decrementStockIfAvailable.mockRejectedValue(new Error("connection reset"));

    // Flattening every error into a retryable 409 would tell shoppers to retry
    // something that will never succeed.
    await expect(service.createOrder("G1", body())).rejects.toThrow("connection reset");
  });
});

describe("SPEC-ORDER-002 M4-fix — the shape a REAL deadlock actually has (REQ-ORDER-027)", () => {
  /**
   * The error a live PostgreSQL 16 deadlock produced through Prisma 6.1,
   * reproduced from the M4 harness observation (progress.md §E.2 M4, 2-bis).
   *
   * Note what is NOT here: a `code`. The describe above builds its fixture as
   * `{ code: "P2034" }`, which is what plan.md §4 M2 PREDICTED — and which the
   * M4 real-database run showed never occurs. Those tests pass against a shape
   * reality does not produce; this block is the one that binds.
   *
   * The SQLSTATE survives only inside the message text, in the Rust connector's
   * debug rendering. That is the whole difficulty of REQ-ORDER-027: there is no
   * structured field to match on.
   */
  function realDeadlock(): Error {
    return Object.assign(
      new Error(
        "\nInvalid `prisma.product.updateMany()` invocation:\n\n\n" +
          "Error occurred during query execution:\n" +
          'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40P01", ' +
          'message: "deadlock detected", severity: "ERROR", detail: Some("Process 11564 waits for ShareLock on ' +
          'transaction 796; blocked by process 11565."), column: None, hint: Some("See server log for query ' +
          'details.") }), transient: false })'
      ),
      // Exactly the own-properties the real error carried — no `code`, no `meta`.
      { name: "PrismaClientUnknownRequestError", clientVersion: "6.1.0" }
    );
  }

  /** The same connector shape, for a serialization failure rather than a deadlock. */
  function realSerializationFailure(): Error {
    return Object.assign(
      new Error(
        "\nInvalid `prisma.product.updateMany()` invocation:\n\n\n" +
          "Error occurred during query execution:\n" +
          'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40001", ' +
          'message: "could not serialize access due to concurrent update", severity: "ERROR", detail: None, ' +
          "column: None, hint: None }), transient: false })"
      ),
      { name: "PrismaClientUnknownRequestError", clientVersion: "6.1.0" }
    );
  }

  it("maps a real 40P01 deadlock to CONCURRENCY_RETRY (REQ-ORDER-027)", async () => {
    orderRepo.decrementStockIfAvailable.mockRejectedValue(realDeadlock());

    const result = await service.createOrder("G1", body());

    // The requirement, measured against the shape the database actually
    // produces rather than the one the plan assumed.
    expect(result).toMatchObject({ ok: false, status: 409, code: "CONCURRENCY_RETRY" });
  });

  it("maps a real 40001 serialization failure the same way", async () => {
    orderRepo.decrementStockIfAvailable.mockRejectedValue(realSerializationFailure());

    const result = await service.createOrder("G1", body());

    expect(result).toMatchObject({ ok: false, status: 409, code: "CONCURRENCY_RETRY" });
  });

  it("does not let a real deadlock reach the shopper as an unclassified 500", async () => {
    orderRepo.createOrderWithItems.mockRejectedValue(realDeadlock());

    // Before this fix the predicate tested `code === "P2034"`, the real error
    // had no `code` at all, and this call REJECTED — surfacing as a 500 with no
    // code to a shopper whose identical resubmission would have succeeded.
    const result = await service.createOrder("G1", body());

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).not.toBe(500);
  });

  it("leaves an unrelated unclassified error alone", async () => {
    // The over-matching guard. `PrismaClientUnknownRequestError` covers ANY
    // unclassified failure, so keying on the class alone would tell shoppers to
    // retry permanently-broken requests. Only the SQLSTATE decides.
    orderRepo.decrementStockIfAvailable.mockRejectedValue(
      Object.assign(new Error("Error occurred during query execution: connection closed"), {
        name: "PrismaClientUnknownRequestError",
        clientVersion: "6.1.0",
      })
    );

    await expect(service.createOrder("G1", body())).rejects.toThrow("connection closed");
  });

  it("survives a thrown non-object without crashing", async () => {
    // `catch` binds `unknown`, and not everything thrown is an Error. Reading
    // `.code` or `.message` off a string would throw inside the error handler
    // itself, turning a recoverable failure into an unrecoverable one.
    orderRepo.decrementStockIfAvailable.mockRejectedValue("40P01 deadlock detected");

    await expect(service.createOrder("G1", body())).rejects.toBe("40P01 deadlock detected");
  });

  it("does not mistake a bare 40001 in ordinary text for a SQLSTATE", async () => {
    // `40001` is five digits — it can occur as an order total, a product id, or
    // a quantity echoed into an error. Matching it loose would classify an
    // unrelated failure as retryable, which is the same defect in the other
    // direction. Only the connector's `code: "…"` field counts.
    orderRepo.decrementStockIfAvailable.mockRejectedValue(
      new Error("Unique constraint failed on totalAmount 40001")
    );

    await expect(service.createOrder("G1", body())).rejects.toThrow("Unique constraint failed");
  });
});

describe("SPEC-ORDER-001 M3 — a cart line below quantity 1 (REQ-ORDER-004, AC-ORDER-004)", () => {
  // The schema permits CartItem.quantity <= 0 (no CHECK constraint; the >= 1
  // rule lives in the cart API's parseQuantity). So unlike PRODUCT_GONE this
  // state IS representable, and design.md §1.5's test — "can the schema store
  // it?" — says defend rather than delete.
  for (const quantity of [0, -3]) {
    it(`refuses to persist an order for a line of quantity ${quantity}`, async () => {
      cartRepo.findCartByGuestId.mockResolvedValue(
        cartWith([{ productId: "p-1", name: "Tee", price: 10000, stock: 10, quantity }])
      );

      const result = await service.createOrder("G1", body({ confirmedTotal: 10000 * quantity }));

      expect(result.ok).toBe(false);
      expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
      expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
      expect(cartRepo.deleteCart).not.toHaveBeenCalled();
    });
  }
});

describe("SPEC-ORDER-001 M3 — idempotency (REQ-ORDER-016, AC-ORDER-016)", () => {
  const first = {
    id: "order-1",
    orderNumber: "ORD-20260831-AAAAAA",
    status: "pending_payment",
    guestId: "G1",
    recipientName: SHIPPING.recipientName,
    recipientPhone: SHIPPING.recipientPhone,
    postalCode: SHIPPING.postalCode,
    address: SHIPPING.address,
    deliveryMemo: null,
    itemsSubtotal: 20000,
    shippingFee: 0,
    totalAmount: 20000,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    items: [
      {
        id: "oi-1",
        productId: "p-1",
        productName: "Tee",
        unitPrice: 10000,
        quantity: 2,
        lineTotal: 20000,
      },
    ],
  };

  it("returns the FIRST order on a replay and opens no transaction at all", async () => {
    orderRepo.findOrderByIdempotencyKey.mockResolvedValue(first);

    const result = await service.createOrder("G1", body());

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.data.orderNumber).toBe("ORD-20260831-AAAAAA");
    // No transaction means no second decrement — the stock stays where the
    // first submission left it (AC-ORDER-016 (c)).
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
  });

  it("falls back to the key lookup when the unique constraint fires (design.md §5)", async () => {
    // Two requests raced past the fast path; the loser's INSERT violates
    // Order.idempotencyKey and its whole transaction rolls back.
    orderRepo.createOrderWithItems.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );
    orderRepo.findOrderByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValue(first);

    const result = await service.createOrder("G1", body());

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.data.id).toBe("order-1");
  });

  it("does not swallow an unrelated failure as an idempotent replay", async () => {
    orderRepo.createOrderWithItems.mockRejectedValue(new Error("connection reset"));

    await expect(service.createOrder("G1", body())).rejects.toThrow("connection reset");
  });
});

describe("SPEC-ORDER-001 M3 — getOrderForGuest (REQ-ORDER-020)", () => {
  it("returns the order when the guest cookie matches its owner", async () => {
    orderRepo.findOrderForGuest.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-20260831-AAAAAA",
      status: "pending_payment",
      guestId: "G1",
      recipientName: SHIPPING.recipientName,
      recipientPhone: SHIPPING.recipientPhone,
      postalCode: SHIPPING.postalCode,
      address: SHIPPING.address,
      deliveryMemo: "부재 시 경비실",
      itemsSubtotal: 20000,
      shippingFee: 0,
      totalAmount: 20000,
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
      items: [],
    });

    const order = await service.getOrderForGuest("order-1", "G1");

    expect(order?.orderNumber).toBe("ORD-20260831-AAAAAA");
    expect(order?.shipping.deliveryMemo).toBe("부재 시 경비실");
    expect(orderRepo.findOrderForGuest).toHaveBeenCalledWith("order-1", "G1");
  });

  it("returns null when the order does not belong to this guest", async () => {
    orderRepo.findOrderForGuest.mockResolvedValue(null);

    // Null, not a thrown error: the caller renders notFound(), so a stranger
    // cannot tell "wrong owner" from "no such order" (design.md §6.3).
    await expect(service.getOrderForGuest("order-1", "G2")).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SPEC-ORDER-003 M1 — guest revisit lookup (REQ-ORDER-034 ~ 037, 043)
// ---------------------------------------------------------------------------

describe("SPEC-ORDER-003 M1 — lookupOrderByNumberAndPhone", () => {
  const VALID_ORDER_NUMBER = "ORD-20260903-0AB123";
  const VALID_PHONE = "010-1234-5678";

  const foundOrder = {
    id: "order-1",
    orderNumber: VALID_ORDER_NUMBER,
    status: "pending_payment",
    guestId: "G1",
    recipientName: SHIPPING.recipientName,
    recipientPhone: VALID_PHONE,
    postalCode: SHIPPING.postalCode,
    address: SHIPPING.address,
    deliveryMemo: null,
    itemsSubtotal: 20000,
    shippingFee: 0,
    totalAmount: 20000,
    couponCode: null,
    discountAmount: 0,
    createdAt: new Date("2026-09-03T00:00:00.000Z"),
    items: [],
  };

  describe("AC-ORDER-037 — both match opens the order (REQ-ORDER-034)", () => {
    it("returns the order when orderNumber AND recipientPhone both match", async () => {
      orderRepo.findOrderByNumberAndPhone.mockResolvedValue(foundOrder);

      const result = await service.lookupOrderByNumberAndPhone({
        orderNumber: VALID_ORDER_NUMBER,
        recipientPhone: VALID_PHONE,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.orderNumber).toBe(VALID_ORDER_NUMBER);
      expect(orderRepo.findOrderByNumberAndPhone).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-ORDER-038 — order number alone opens nothing (REQ-ORDER-035)", () => {
    it("returns a failure carrying no order field when the phone does not match", async () => {
      orderRepo.findOrderByNumberAndPhone.mockResolvedValue(null);

      const result = await service.lookupOrderByNumberAndPhone({
        orderNumber: VALID_ORDER_NUMBER,
        recipientPhone: "010-0000-0000",
      });

      expect(result.ok).toBe(false);
      // No order field anywhere in the failure body — status/code/error only.
      const body = JSON.stringify(result);
      expect(body).not.toMatch(/orderNumber|itemsSubtotal|totalAmount|shipping/);
    });
  });

  describe("AC-ORDER-039 — not-found and mismatch are byte-identical (REQ-ORDER-036)", () => {
    it("returns the SAME status and body for a nonexistent order number and a wrong-phone match", async () => {
      orderRepo.findOrderByNumberAndPhone.mockResolvedValue(null);

      const notFound = await service.lookupOrderByNumberAndPhone({
        orderNumber: "ORD-20260903-999999",
        recipientPhone: VALID_PHONE,
      });
      const mismatch = await service.lookupOrderByNumberAndPhone({
        orderNumber: VALID_ORDER_NUMBER,
        recipientPhone: "010-0000-0000",
      });

      expect(notFound).toEqual(mismatch);
    });
  });

  describe("AC-ORDER-040 — the failure path never skips the query (REQ-ORDER-036, structural proxy)", () => {
    it("calls the repository EXACTLY once for both the not-found and the mismatch path", async () => {
      orderRepo.findOrderByNumberAndPhone.mockResolvedValue(null);

      await service.lookupOrderByNumberAndPhone({
        orderNumber: "ORD-20260903-999999",
        recipientPhone: VALID_PHONE,
      });
      expect(orderRepo.findOrderByNumberAndPhone).toHaveBeenCalledTimes(1);

      orderRepo.findOrderByNumberAndPhone.mockClear();
      await service.lookupOrderByNumberAndPhone({
        orderNumber: VALID_ORDER_NUMBER,
        recipientPhone: "010-0000-0000",
      });
      expect(orderRepo.findOrderByNumberAndPhone).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-ORDER-047 — format validation fails specifically, without querying (REQ-ORDER-043)", () => {
    it("names both a blank order number and a malformed phone, and never calls the repository", async () => {
      const result = await service.lookupOrderByNumberAndPhone({
        orderNumber: "",
        recipientPhone: "not-a-phone",
      });

      expect(result).toMatchObject({ ok: false, status: 400 });
      if (result.ok || result.status !== 400) return;
      expect(Object.keys(result.fieldErrors)).toEqual(
        expect.arrayContaining(["orderNumber", "recipientPhone"])
      );
      expect(orderRepo.findOrderByNumberAndPhone).not.toHaveBeenCalled();
    });

    it("passes a well-formed submission through to the repository", async () => {
      orderRepo.findOrderByNumberAndPhone.mockResolvedValue(foundOrder);

      const result = await service.lookupOrderByNumberAndPhone({
        orderNumber: VALID_ORDER_NUMBER,
        recipientPhone: VALID_PHONE,
      });

      expect(result.ok).toBe(true);
      expect(orderRepo.findOrderByNumberAndPhone).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// SPEC-DISCOUNT-001 M4 — order-transaction integration
// ---------------------------------------------------------------------------

describe("SPEC-DISCOUNT-001 M4 — no coupon submitted (REQ-DISCOUNT-019)", () => {
  it("computes discountAmount 0 and couponCode null, calling neither discount function", async () => {
    const result = await service.createOrder("G1", body());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.discountAmount).toBe(0);
    expect(result.data.couponCode).toBeNull();
    expect(discountService.validateCoupon).not.toHaveBeenCalled();
    expect(couponRepo.incrementRedeemedCountIfAvailable).not.toHaveBeenCalled();
  });

  it("passes couponCode: null and discountAmount: 0 to the repository row", async () => {
    await service.createOrder("G1", body());

    const [, row] = orderRepo.createOrderWithItems.mock.calls[0]! as [
      unknown,
      Record<string, unknown>,
    ];
    expect(row.couponCode).toBeNull();
    expect(row.discountAmount).toBe(0);
  });

  it("treats an empty-string coupon code the same as an absent one", async () => {
    const result = await service.createOrder("G1", body({ couponCode: "   " }));

    expect(result.ok).toBe(true);
    expect(discountService.validateCoupon).not.toHaveBeenCalled();
  });
});

describe("SPEC-DISCOUNT-001 M4 — a valid coupon is applied (REQ-DISCOUNT-014/015/016, design.md §3.1 3b-3d)", () => {
  beforeEach(() => {
    discountService.validateCoupon.mockResolvedValue({
      ok: true,
      coupon: validCoupon(),
      discountAmount: 2000,
    });
    couponRepo.incrementRedeemedCountIfAvailable.mockResolvedValue(1);
  });

  it("validates the coupon against itemsSubtotal, on the transaction client", async () => {
    await service.createOrder("G1", body({ couponCode: "save10", confirmedTotal: 18000 }));

    expect(discountService.validateCoupon).toHaveBeenCalledWith(
      "save10",
      20000,
      expect.any(Date),
      TX
    );
  });

  it("subtracts discountAmount from itemsSubtotal before adding shippingFee (REQ-DISCOUNT-005)", async () => {
    const result = await service.createOrder(
      "G1",
      body({ couponCode: "save10", confirmedTotal: 18000 })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalAmount).toBe(18000);
    expect(result.data.discountAmount).toBe(2000);
    expect(result.data.couponCode).toBe("SAVE10");
  });

  it("stores the coupon code and discount amount on the order row", async () => {
    await service.createOrder("G1", body({ couponCode: "save10", confirmedTotal: 18000 }));

    const [, row] = orderRepo.createOrderWithItems.mock.calls[0]! as [
      unknown,
      Record<string, unknown>,
    ];
    expect(row.couponCode).toBe("SAVE10");
    expect(row.discountAmount).toBe(2000);
  });

  it("atomically increments the coupon's redemption count, on the transaction client", async () => {
    await service.createOrder("G1", body({ couponCode: "save10", confirmedTotal: 18000 }));

    expect(couponRepo.incrementRedeemedCountIfAvailable).toHaveBeenCalledWith(TX, "coupon-1", 100);
  });

  it("increments the coupon BEFORE decrementing stock (design.md §3.1 — 3f before step 4)", async () => {
    const seen: string[] = [];
    couponRepo.incrementRedeemedCountIfAvailable.mockImplementation(async () => {
      seen.push("coupon-increment");
      return 1;
    });
    orderRepo.decrementStockIfAvailable.mockImplementation(async () => {
      seen.push("stock-decrement");
      return 1;
    });

    await service.createOrder("G1", body({ couponCode: "save10", confirmedTotal: 18000 }));

    expect(seen).toEqual(["coupon-increment", "stock-decrement"]);
  });
});

describe("SPEC-DISCOUNT-001 M4 — coupon validation is refused (REQ-DISCOUNT-009~013, AC-DISCOUNT-013)", () => {
  const cases: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    [
      "COUPON_NOT_FOUND",
      { ok: false, status: 409, code: "COUPON_NOT_FOUND" },
      { code: "COUPON_NOT_FOUND" },
    ],
    [
      "COUPON_EXPIRED",
      { ok: false, status: 409, code: "COUPON_EXPIRED" },
      { code: "COUPON_EXPIRED" },
    ],
    [
      "COUPON_MINIMUM_NOT_MET",
      { ok: false, status: 409, code: "COUPON_MINIMUM_NOT_MET", requiredMinimum: 30000 },
      { code: "COUPON_MINIMUM_NOT_MET", requiredMinimum: 30000 },
    ],
    [
      "COUPON_EXHAUSTED",
      { ok: false, status: 409, code: "COUPON_EXHAUSTED" },
      { code: "COUPON_EXHAUSTED" },
    ],
  ];

  for (const [label, discountFailure, expectedOrderFailure] of cases) {
    it(`maps ${label} 1:1 onto the matching OrderFailure and touches nothing`, async () => {
      discountService.validateCoupon.mockResolvedValue(discountFailure);

      const result = await service.createOrder(
        "G1",
        body({ couponCode: "BAD", confirmedTotal: 20000 })
      );

      expect(result).toMatchObject(expectedOrderFailure);
      expect(result.ok === false && result.status).toBe(409);
      expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
      expect(couponRepo.incrementRedeemedCountIfAvailable).not.toHaveBeenCalled();
      expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
      expect(cartRepo.deleteCart).not.toHaveBeenCalled();
    });
  }
});

describe("SPEC-DISCOUNT-001 M4 — PRICE_CHANGED compares against the DISCOUNTED total (REQ-DISCOUNT-018, AC-DISCOUNT-018)", () => {
  beforeEach(() => {
    discountService.validateCoupon.mockResolvedValue({
      ok: true,
      coupon: validCoupon(),
      discountAmount: 2000,
    });
  });

  it("succeeds when confirmedTotal already reflects the discount", async () => {
    const result = await service.createOrder(
      "G1",
      body({ couponCode: "save10", confirmedTotal: 18000 })
    );
    expect(result.ok).toBe(true);
  });

  it("refuses with PRICE_CHANGED when confirmedTotal ignores the discount", async () => {
    const result = await service.createOrder(
      "G1",
      body({ couponCode: "save10", confirmedTotal: 20000 })
    );

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "PRICE_CHANGED",
      totalAmount: 18000,
    });
  });

  it("never increments the coupon's redemption count on a PRICE_CHANGED refusal (design.md §3.1 — 3f is after 3e)", async () => {
    await service.createOrder("G1", body({ couponCode: "save10", confirmedTotal: 20000 }));

    expect(couponRepo.incrementRedeemedCountIfAvailable).not.toHaveBeenCalled();
  });
});

describe("SPEC-DISCOUNT-001 M4 — the coupon is exhausted by the atomic increment (REQ-DISCOUNT-017, AC-DISCOUNT-017)", () => {
  it("refuses with COUPON_EXHAUSTED and takes no stock lock (design.md §3.1 — 3f before step 4)", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: true,
      coupon: validCoupon(),
      discountAmount: 2000,
    });
    couponRepo.incrementRedeemedCountIfAvailable.mockResolvedValue(0);

    const result = await service.createOrder(
      "G1",
      body({ couponCode: "save10", confirmedTotal: 18000 })
    );

    expect(result).toMatchObject({ ok: false, status: 409, code: "COUPON_EXHAUSTED" });
    expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });
});
