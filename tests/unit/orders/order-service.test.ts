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
  decrementStockIfAvailable: vi.fn(),
  createOrderWithItems: vi.fn(),
};
vi.mock("@/features/orders/repositories/order-repository", () => orderRepo);

const cartRepo = {
  findCartByGuestId: vi.fn(),
  deleteCart: vi.fn(),
};
vi.mock("@/features/cart/repositories/cart-repository", () => cartRepo);

const service = await import("@/features/orders/services/order-service");

const SHIPPING = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구 테헤란로 1",
  deliveryMemo: null,
};

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
  orderRepo.decrementStockIfAvailable.mockResolvedValue(1);
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
