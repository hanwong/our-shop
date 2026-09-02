import { describe, it, expect, beforeEach, vi } from "vitest";
import { signAccessToken } from "@/lib/auth/jwt";

/**
 * SPEC-ORDER-001 M7 — the order-creation transaction driven end to end through
 * the real route handlers against an in-memory database.
 *
 * Traces: AC-ORDER-002 (the snapshot survives a later price change),
 * AC-ORDER-004, AC-ORDER-011 (all four effects), AC-ORDER-012 (no partial
 * state), AC-ORDER-013/014/015 (the refusals), AC-ORDER-016 (idempotency, both
 * lines of defence), AC-ORDER-022 (a member is refused).
 *
 * Nothing is mocked at the repository or service seam: the fake below stands in
 * for PostgreSQL only. That is what makes this a check of the transaction
 * rather than a check that the transaction was called.
 *
 * THE FAKE IMPLEMENTS ROLLBACK, and that is not a detail — acceptance.md §0
 * makes AC-ORDER-011 and AC-ORDER-012 conditional on it. A fake whose
 * `$transaction` merely ran the callback and kept every write would turn those
 * two criteria green while proving nothing at all about atomicity, which is the
 * false-green hazard plan.md §5 records. `$transaction` here snapshots the
 * whole store, and restores it if the callback throws. "rolls back what the
 * fake stored" is asserted directly, below, so the property these criteria rest
 * on is itself verified rather than assumed.
 *
 * WHAT THIS STILL CANNOT PROVE, stated plainly and repeated in progress.md
 * §E.2: with no live PostgreSQL there is no evidence about REAL rollback
 * (`AC-012-EXCL-ROLLBACK`), about row-lock serialisation of concurrent orders
 * (`AC-013-EXCL-CONCURRENCY`), or about the unique constraint serialising a
 * simultaneous double submission (`AC-016-EXCL-UNIQUE-RACE`). A green run here
 * is evidence that the SERVICE writes only inside the callback and aborts by
 * throwing — never that the database undoes anything.
 */

interface FakeCart {
  id: string;
  userId: string | null;
  guestId: string | null;
}
interface FakeCartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
}
interface FakeProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
  stock: number;
}
interface FakeOrder {
  id: string;
  orderNumber: string;
  status: string;
  guestId: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  deliveryMemo: string | null;
  itemsSubtotal: number;
  shippingFee: number;
  totalAmount: number;
  couponCode: string | null;
  discountAmount: number;
  idempotencyKey: string;
  createdAt: Date;
}
interface FakeCoupon {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minOrderAmount: number;
  maxRedemptions: number;
  redeemedCount: number;
  startsAt: Date;
  endsAt: Date;
  updatedAt: Date;
}
interface FakeOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  createdAt: Date;
}

interface Store {
  carts: FakeCart[];
  cartItems: FakeCartItem[];
  products: FakeProduct[];
  orders: FakeOrder[];
  orderItems: FakeOrderItem[];
  coupons: FakeCoupon[];
  seq: number;
}

let store: Store;

/** Set by a test to make the NEXT order.create throw, simulating a race. */
let createOrderHook: (() => void) | null = null;

/**
 * Product ids in the order stock writes were actually attempted
 * (SPEC-ORDER-002 REQ-ORDER-023).
 *
 * Recorded rather than inferred: the locking order and the stored line order
 * are now deliberately different, and only a log taken at the write itself can
 * show both at once.
 */
let stockWriteLog: string[] = [];

/**
 * Orders another session committed while this transaction was open.
 *
 * A rollback undoes only the rolling-back transaction's own writes; rows some
 * other session already committed survive it. The snapshot-and-restore fake
 * below would otherwise erase them too, which would misrepresent exactly the
 * situation design.md §5's second line of defence exists for: the loser of a
 * race rolls back and must then FIND the winner's committed order.
 */
let externallyCommittedOrders: FakeOrder[] = [];

function joinCartItems(cartId: string) {
  return store.cartItems
    .filter((i) => i.cartId === cartId)
    .map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      product: store.products.find((p) => p.id === i.productId)!,
    }));
}

function cartWithItems(cart: FakeCart | undefined) {
  return cart ? { ...cart, items: joinCartItems(cart.id) } : null;
}

function orderWithItems(order: FakeOrder | undefined) {
  return order
    ? { ...order, items: store.orderItems.filter((i) => i.orderId === order.id) }
    : null;
}

/** Prisma's unique-violation error, as the service recognises it. */
function uniqueViolation(target: string): Error {
  return Object.assign(new Error(`Unique constraint failed on ${target}`), { code: "P2002" });
}

/**
 * One client surface, used both as the module singleton and as the object
 * `$transaction` hands its callback. Sharing it is deliberate: it means a write
 * issued on the "wrong" client is indistinguishable to the fake, so the only
 * thing keeping the service inside the transaction is the service itself. The
 * rollback assertion below is what turns that into an observation.
 */
const client = {
  cart: {
    findUnique: ({ where }: { where: { id?: string; userId?: string; guestId?: string } }) => {
      if (where.id !== undefined) return cartWithItems(store.carts.find((c) => c.id === where.id));
      if (where.userId !== undefined)
        return cartWithItems(store.carts.find((c) => c.userId === where.userId));
      if (where.guestId !== undefined)
        return cartWithItems(store.carts.find((c) => c.guestId === where.guestId));
      return null;
    },
    create: ({ data }: { data: { userId?: string; guestId?: string } }) => {
      const row: FakeCart = {
        id: `cart-${++store.seq}`,
        userId: data.userId ?? null,
        guestId: data.guestId ?? null,
      };
      store.carts.push(row);
      return { id: row.id };
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: { userId?: string; guestId?: string | null };
    }) => {
      const row = store.carts.find((c) => c.id === where.id)!;
      if (data.userId !== undefined) row.userId = data.userId;
      if (data.guestId !== undefined) row.guestId = data.guestId;
      return row;
    },
    delete: ({ where }: { where: { id: string } }) => {
      store.carts = store.carts.filter((c) => c.id !== where.id);
      // The FK cascade CartItem.cartId -> Cart.id, modelled here.
      store.cartItems = store.cartItems.filter((i) => i.cartId !== where.id);
      return { id: where.id };
    },
  },
  cartItem: {
    findUnique: ({ where }: { where: { id: string } }) =>
      store.cartItems.find((i) => i.id === where.id) ?? null,
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { cartId_productId: { cartId: string; productId: string } };
      create: { cartId: string; productId: string; quantity: number };
      update: { quantity: { increment: number } };
    }) => {
      const key = where.cartId_productId;
      const existing = store.cartItems.find(
        (i) => i.cartId === key.cartId && i.productId === key.productId
      );
      if (existing) {
        existing.quantity += update.quantity.increment;
        return existing;
      }
      const row: FakeCartItem = { id: `item-${++store.seq}`, ...create };
      store.cartItems.push(row);
      return row;
    },
    update: ({ where, data }: { where: { id: string }; data: { quantity: number } }) => {
      const row = store.cartItems.find((i) => i.id === where.id)!;
      row.quantity = data.quantity;
      return row;
    },
    delete: ({ where }: { where: { id: string } }) => {
      store.cartItems = store.cartItems.filter((i) => i.id !== where.id);
      return { id: where.id };
    },
  },
  product: {
    findUnique: ({ where }: { where: { id: string } }) => {
      const p = store.products.find((x) => x.id === where.id);
      return p ? { id: p.id, price: p.price, stock: p.stock } : null;
    },
    // The conditional decrement design.md §3 relies on. The `gte` guard is
    // evaluated here exactly as the database would, so a request for more than
    // is in stock changes no row and reports count 0.
    updateMany: ({
      where,
      data,
    }: {
      where: { id: string; stock: { gte: number } };
      data: { stock: { decrement: number } };
    }) => {
      const product = store.products.find((p) => p.id === where.id);
      stockWriteLog.push(where.id);
      if (!product || product.stock < where.stock.gte) return { count: 0 };
      product.stock -= data.stock.decrement;
      return { count: 1 };
    },
    // SPEC-ORDER-002 REQ-ORDER-025's re-read of the failure path. It reads the
    // SAME mutable store the decrement above writes, so it observes this
    // transaction's own effects exactly as a real one inside the transaction
    // would — including the decrements a subsequent rollback will undo.
    findMany: ({ where }: { where: { id: { in: string[] } } }) =>
      store.products
        .filter((p) => where.id.in.includes(p.id))
        .map((p) => ({ id: p.id, stock: p.stock })),
  },
  order: {
    findUnique: ({ where }: { where: { idempotencyKey: string } }) =>
      orderWithItems(store.orders.find((o) => o.idempotencyKey === where.idempotencyKey)),
    findFirst: ({ where }: { where: { id: string; guestId: string } }) =>
      orderWithItems(
        store.orders.find((o) => o.id === where.id && o.guestId === where.guestId)
      ),
    create: ({
      data,
    }: {
      data: Omit<FakeOrder, "id" | "status" | "createdAt"> & {
        items: { create: Array<Omit<FakeOrderItem, "id" | "orderId" | "createdAt">> };
      };
    }) => {
      createOrderHook?.();

      const { items, ...rest } = data;
      // Both unique constraints, enforced as the database would.
      for (const [column, value] of [
        ["orderNumber", rest.orderNumber],
        ["idempotencyKey", rest.idempotencyKey],
      ] as const) {
        if (store.orders.some((o) => o[column] === value)) {
          throw uniqueViolation(`Order.${column}`);
        }
      }

      const row: FakeOrder = {
        id: `order-${++store.seq}`,
        // The schema DEFAULT, applied here because the service deliberately
        // does not write the column (REQ-ORDER-017).
        status: "pending_payment",
        createdAt: new Date("2026-08-31T00:00:00.000Z"),
        ...rest,
      };
      store.orders.push(row);
      for (const item of items.create) {
        store.orderItems.push({
          id: `oi-${++store.seq}`,
          orderId: row.id,
          createdAt: new Date("2026-08-31T00:00:00.000Z"),
          ...item,
        });
      }
      return { id: row.id };
    },
  },
  coupon: {
    // Mirrors coupon-repository.ts's findCouponByCode: normalizes to
    // uppercase before the lookup (REQ-DISCOUNT-002).
    findUnique: ({ where }: { where: { code: string } }) =>
      store.coupons.find((c) => c.code === where.code.toUpperCase()) ?? null,
    // Mirrors coupon-repository.ts's incrementRedeemedCountIfAvailable — the
    // same conditional-atomic-update shape as product.updateMany above.
    updateMany: ({
      where,
      data,
    }: {
      where: { id: string; redeemedCount: { lt: number } };
      data: { redeemedCount: { increment: number } };
    }) => {
      const coupon = store.coupons.find((c) => c.id === where.id);
      if (!coupon || coupon.redeemedCount >= where.redeemedCount.lt) return { count: 0 };
      coupon.redeemedCount += data.redeemedCount.increment;
      coupon.updatedAt = new Date();
      return { count: 1 };
    },
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    ...client,
    user: {
      findUnique: ({ where }: { where: { email?: string; id?: string } }) =>
        where.email === "shopper@example.com" || where.id === "user-1"
          ? {
              id: "user-1",
              email: "shopper@example.com",
              passwordHash: "hashed",
              emailVerified: true,
              role: "customer" as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : null,
    },
    /**
     * Snapshot, run, and restore on throw.
     *
     * This is the property acceptance.md §0 makes AC-ORDER-011 and
     * AC-ORDER-012 conditional on. Without it a failing callback would leave
     * every write it had already issued in place, and the two criteria would
     * pass while demonstrating the opposite of what they claim.
     */
    $transaction: async <T>(callback: (tx: typeof client) => Promise<T>): Promise<T> => {
      const snapshot = structuredClone(store);
      try {
        return await callback(client);
      } catch (error) {
        store = snapshot;
        // A rollback undoes this transaction's writes, not another session's
        // commits — see externallyCommittedOrders.
        store.orders.push(...externallyCommittedOrders);
        throw error;
      }
    },
  },
}));

const GUEST = "guest-cookie-value";

const SHIPPING = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구 테헤란로 1",
  deliveryMemo: null,
};

beforeEach(() => {
  createOrderHook = null;
  externallyCommittedOrders = [];
  stockWriteLog = [];
  store = {
    carts: [],
    cartItems: [],
    orders: [],
    orderItems: [],
    coupons: [],
    seq: 0,
    products: [
      { id: "A", name: "클래식 데님 재킷", price: 10000, images: ["a.jpg"], stock: 10 },
      { id: "B", name: "코튼 볼캡", price: 5000, images: ["b.jpg"], stock: 8 },
    ],
  };
  vi.stubEnv("NODE_ENV", "test");
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
});

async function addToCart(productId: string, quantity: number, cookie = `guest_cart_id=${GUEST}`) {
  const { POST } = await import("@/app/api/cart/items/route");
  return POST(
    new Request("http://localhost/api/cart/items", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ productId, quantity }),
    })
  );
}

async function submitOrder(
  body: Record<string, unknown>,
  headers: Record<string, string> = { cookie: `guest_cart_id=${GUEST}` }
) {
  const { POST } = await import("@/app/api/orders/route");
  return POST(
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );
}

async function readCart(cookie = `guest_cart_id=${GUEST}`) {
  const { GET } = await import("@/app/api/cart/route");
  return (await GET(new Request("http://localhost/api/cart", { headers: { cookie } }))).json();
}

function orderBody(confirmedTotal: number, key = "key-1") {
  return { shipping: SHIPPING, idempotencyKey: key, confirmedTotal };
}

describe("SPEC-ORDER-001 — the fake's own rollback (the premise AC-011/012 rest on)", () => {
  it("restores every write when the transaction callback throws", async () => {
    const { prisma } = await import("@/lib/db");
    store.carts.push({ id: "cart-x", userId: null, guestId: GUEST });

    await expect(
      prisma.$transaction(async (tx) => {
        tx.product.updateMany({
          where: { id: "A", stock: { gte: 1 } },
          data: { stock: { decrement: 1 } },
        });
        tx.cart.delete({ where: { id: "cart-x" } });
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    // Without this property the two criteria below would be green and hollow.
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
    expect(store.carts).toHaveLength(1);
  });
});

describe("SPEC-ORDER-001 — all four effects land (AC-ORDER-011)", () => {
  beforeEach(async () => {
    await addToCart("A", 3);
  });

  it("records the order and its line", async () => {
    const response = await submitOrder(orderBody(30000));

    expect(response.status).toBe(201);
    expect(store.orders).toHaveLength(1);
    expect(store.orderItems).toHaveLength(1);
  });

  it("snapshots the unit price as the product's price at order time", async () => {
    await submitOrder(orderBody(30000));

    expect(store.orderItems[0]).toMatchObject({
      productId: "A",
      productName: "클래식 데님 재킷",
      unitPrice: 10000,
      quantity: 3,
      lineTotal: 30000,
    });
  });

  it("decrements the product's stock by the ordered quantity", async () => {
    await submitOrder(orderBody(30000));

    expect(store.products.find((p) => p.id === "A")!.stock).toBe(7);
  });

  it("leaves the guest with an empty cart, read back through the cart API", async () => {
    await submitOrder(orderBody(30000));

    await expect(readCart()).resolves.toEqual({ items: [], subtotal: 0, itemCount: 0 });
  });

  it("creates the order in the pending_payment state (REQ-ORDER-017)", async () => {
    await submitOrder(orderBody(30000));

    expect(store.orders[0]!.status).toBe("pending_payment");
  });
});

describe("SPEC-ORDER-002 M2 — locking order and line order are different things (AC-ORDER-025)", () => {
  /**
   * The cart is built B-then-A, so `CartItem.createdAt` order (B, A) and
   * ascending id order (A, B) disagree. That disagreement is what makes this
   * test able to fail: with a single shared order, one of the two assertions
   * below would have to give.
   */
  beforeEach(async () => {
    await addToCart("B", 1);
    await addToCart("A", 1);
  });

  it("locks by ascending product id, whatever order the cart was built in", async () => {
    await submitOrder(orderBody(15000));

    expect(stockWriteLog).toEqual(["A", "B"]);
  });

  it("stores the lines in cart order, and reads them back that way", async () => {
    const created = await (await submitOrder(orderBody(15000))).json();

    // Written in cart order...
    expect(store.orderItems.map((item) => item.productId)).toEqual(["B", "A"]);
    // ...returned to the submitting screen in cart order...
    expect(created.items.map((item: { productId: string }) => item.productId)).toEqual(["B", "A"]);

    // ...and, the one that matters for plan.md §5, read back to the COMPLETION
    // screen in cart order too. If the locking sort ever reached the stored
    // rows, this is the assertion that would catch it.
    const { getOrderForGuest } = await import("@/features/orders/services/order-service");
    const reread = await getOrderForGuest(created.id, GUEST);

    expect(reread!.items.map((item) => item.productId)).toEqual(["B", "A"]);
  });
});

describe("SPEC-ORDER-001 — the snapshot outlives the product (AC-ORDER-002)", () => {
  it("keeps the ordered price and name after the product changes", async () => {
    await addToCart("A", 2);
    const created = await (await submitOrder(orderBody(20000))).json();

    // The catalogue moves on: the price doubles and the product is renamed.
    const product = store.products.find((p) => p.id === "A")!;
    product.price = 20000;
    product.name = "클래식 데님 재킷 v2";

    const { getOrderForGuest } = await import("@/features/orders/services/order-service");
    const reread = await getOrderForGuest(created.id, GUEST);

    expect(reread!.items[0]).toMatchObject({ unitPrice: 10000, productName: "클래식 데님 재킷" });
    expect(reread!.itemsSubtotal).toBe(20000);
    expect(reread!.totalAmount).toBe(20000);
  });
});

describe("SPEC-ORDER-001 — no partial state on failure (AC-ORDER-012)", () => {
  it("leaves the FIRST product's stock untouched when a later line fails", async () => {
    await addToCart("A", 2);
    await addToCart("B", 1);
    // B has plenty of stock, so the refusal is injected: the order insert
    // throws after A's decrement has already been issued.
    createOrderHook = () => {
      throw new Error("write failed mid-transaction");
    };

    await expect(submitOrder(orderBody(25000))).rejects.toThrow();

    expect(store.orders).toHaveLength(0);
    expect(store.orderItems).toHaveLength(0);
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
    expect(store.products.find((p) => p.id === "B")!.stock).toBe(8);
  });

  it("leaves the cart intact when the transaction fails", async () => {
    await addToCart("A", 2);
    createOrderHook = () => {
      throw new Error("write failed mid-transaction");
    };

    await expect(submitOrder(orderBody(20000))).rejects.toThrow();

    const cart = await readCart();
    expect(cart.itemCount).toBe(2);
  });
});

describe("SPEC-ORDER-001 — insufficient stock (AC-ORDER-013)", () => {
  it("refuses and changes nothing", async () => {
    await addToCart("B", 5);
    // Stock drops below the cart's quantity between adding and ordering.
    store.products.find((p) => p.id === "B")!.stock = 2;

    const response = await submitOrder(orderBody(25000));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      products: [{ productId: "B", available: 2 }],
    });
    expect(store.orders).toHaveLength(0);
    expect(store.products.find((p) => p.id === "B")!.stock).toBe(2);
    await expect(readCart()).resolves.toMatchObject({ itemCount: 5 });
  });

  it("succeeds when the stock exactly equals the quantity (the gte boundary)", async () => {
    await addToCart("B", 8);

    const response = await submitOrder(orderBody(40000));

    expect(response.status).toBe(201);
    expect(store.products.find((p) => p.id === "B")!.stock).toBe(0);
  });
});

describe("SPEC-ORDER-001 — the price moved under the shopper (AC-ORDER-014)", () => {
  it("refuses with the recomputed total and changes nothing", async () => {
    await addToCart("A", 2);
    store.products.find((p) => p.id === "A")!.price = 20000;

    const response = await submitOrder(orderBody(20000));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "PRICE_CHANGED", totalAmount: 40000 });
    expect(store.orders).toHaveLength(0);
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
    await expect(readCart()).resolves.toMatchObject({ itemCount: 2 });
  });
});

describe("SPEC-ORDER-001 — nothing to order (AC-ORDER-015)", () => {
  it("refuses a guest cookie that owns no cart", async () => {
    const response = await submitOrder(orderBody(0));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "CART_EMPTY" });
    expect(store.orders).toHaveLength(0);
  });

  it("refuses a request with no cookie, but still hands one back", async () => {
    const response = await submitOrder(orderBody(0), {});

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "CART_EMPTY" });
    // Attached so this visitor's next add lands under the same identity
    // (design.md §6.2).
    expect(
      response.headers.getSetCookie().some((c) => c.startsWith("guest_cart_id="))
    ).toBe(true);
  });
});

describe("SPEC-ORDER-001 — a resubmitted order is still one order (AC-ORDER-016)", () => {
  it("returns the same order twice and decrements stock once", async () => {
    await addToCart("A", 3);

    const first = await (await submitOrder(orderBody(30000, "same-key"))).json();
    const second = await (await submitOrder(orderBody(30000, "same-key"))).json();

    expect(second.id).toBe(first.id);
    expect(second.orderNumber).toBe(first.orderNumber);
    expect(store.orders).toHaveLength(1);
    // 7, not 4 — the replay decremented nothing.
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(7);
  });

  it("recovers the winner's order when the unique constraint fires", async () => {
    await addToCart("A", 3);

    // Simulates the loser of a race: it passed the pre-transaction lookup, and
    // its INSERT then collides with an order the winner committed in the
    // meantime. The winner's row goes into externallyCommittedOrders because it
    // belongs to a DIFFERENT transaction and therefore survives this one's
    // rollback — which is the whole situation design.md §5's second line of
    // defence addresses.
    createOrderHook = () => {
      externallyCommittedOrders.push({
        id: "order-winner",
        orderNumber: "ORD-20260831-WINNER",
        status: "pending_payment",
        guestId: GUEST,
        ...SHIPPING,
        itemsSubtotal: 30000,
        shippingFee: 0,
        totalAmount: 30000,
        couponCode: null,
        discountAmount: 0,
        idempotencyKey: "race-key",
        createdAt: new Date("2026-08-31T00:00:00.000Z"),
      });
      createOrderHook = null;
      throw uniqueViolation("Order.idempotencyKey");
    };

    const response = await submitOrder(orderBody(30000, "race-key"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.orderNumber).toBe("ORD-20260831-WINNER");
    // The loser's whole transaction rolled back, so its decrement is undone.
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
  });
});

describe("SPEC-ORDER-001 — a cart line below quantity 1 (AC-ORDER-004)", () => {
  it("persists no order and no line at a quantity under 1", async () => {
    await addToCart("A", 2);
    // Injected directly: the cart API's own validation makes this unreachable
    // through the endpoints, but the SCHEMA permits it, so the order path must
    // not depend on that validation having run (design.md §1.5).
    store.cartItems[0]!.quantity = 0;

    const response = await submitOrder(orderBody(0));

    expect(response.status).toBe(500);
    expect(store.orders).toHaveLength(0);
    expect(store.orderItems).toHaveLength(0);
    expect(store.orderItems.filter((i) => i.quantity < 1)).toHaveLength(0);
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
  });
});

/**
 * SPEC-ORDER-001 — AC-ORDER-023.
 *
 * The security audit's F1: the two idempotency-key lookups returned whatever
 * order the key named, without ever asking whose it was. Knowing a stranger's
 * key was therefore enough to be handed their order — shipping PII included.
 *
 * F2 is why it shipped green: the replay path WAS covered (AC-ORDER-016 above),
 * but every existing case replayed a key under the guest that minted it, so the
 * cross-guest question was never put to it. These cases put it.
 *
 * The victim's shipping values below appear nowhere else in this file, which is
 * what lets the assertions scan the WHOLE raw response body for them rather than
 * naming fields. A field-by-field assertion would pass a response that leaked
 * the same values under a different shape; a string scan cannot.
 */
const OTHER_GUEST = "another-guest-cookie-value";

const VICTIM_SHIPPING = {
  recipientName: "김영희",
  recipientPhone: "010-9876-5432",
  postalCode: "48058",
  address: "부산시 해운대구 센텀중앙로 99",
  deliveryMemo: "부재 시 경비실에 맡겨 주세요",
};

const VICTIM_ID = "order-victim";
const VICTIM_NUMBER = "ORD-20260831-VICTIM";

/** Everything AC-ORDER-023 (a) forbids appearing anywhere in the response. */
const VICTIM_SECRETS = [VICTIM_ID, VICTIM_NUMBER, ...Object.values(VICTIM_SHIPPING)];

function victimRow(idempotencyKey: string): FakeOrder {
  return {
    id: VICTIM_ID,
    orderNumber: VICTIM_NUMBER,
    status: "pending_payment",
    guestId: GUEST,
    ...VICTIM_SHIPPING,
    itemsSubtotal: 30000,
    shippingFee: 0,
    totalAmount: 30000,
    couponCode: null,
    discountAmount: 0,
    idempotencyKey,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
  };
}

function expectNoVictimDisclosure(rawBody: string) {
  for (const secret of VICTIM_SECRETS) {
    expect(rawBody).not.toContain(secret);
  }
}

describe("SPEC-ORDER-001 — an idempotency key alone does not reach another guest's order (AC-ORDER-023)", () => {
  const VICTIM_KEY = "victim-key";

  it("does not disclose the order to a DIFFERENT guest replaying the key (initial lookup)", async () => {
    store.orders.push(victimRow(VICTIM_KEY));
    await addToCart("A", 3, `guest_cart_id=${OTHER_GUEST}`);

    const response = await submitOrder(orderBody(30000, VICTIM_KEY), {
      cookie: `guest_cart_id=${OTHER_GUEST}`,
    });

    // (a) nothing of the victim's order — id, number, or any of the five
    //     shipping PII values — appears anywhere in the body.
    expectNoVictimDisclosure(await response.text());

    // (b) the victim's order is still one row, still theirs, still unedited.
    const victim = store.orders.filter((o) => o.idempotencyKey === VICTIM_KEY);
    expect(victim).toHaveLength(1);
    expect(victim[0]).toEqual(victimRow(VICTIM_KEY));
  });

  it("does not disclose the order to a request carrying NO guest cookie (initial lookup)", async () => {
    store.orders.push(victimRow(VICTIM_KEY));

    const response = await submitOrder(orderBody(30000, VICTIM_KEY), {});

    expectNoVictimDisclosure(await response.text());
    expect(store.orders.filter((o) => o.idempotencyKey === VICTIM_KEY)).toHaveLength(1);
    expect(store.orders.find((o) => o.id === VICTIM_ID)).toEqual(victimRow(VICTIM_KEY));
  });

  it("does not disclose a FOREIGN winner's order when the unique constraint fires (race recovery)", async () => {
    const RACE_KEY = "foreign-race-key";
    await addToCart("A", 3, `guest_cart_id=${OTHER_GUEST}`);

    // The key is unused, so the pre-transaction lookup finds nothing and this
    // request proceeds — reaching the SECOND lookup, in the P2002 recovery
    // branch, which is a separate call site and needs its own evidence. The
    // winner committed in another transaction and belongs to a different guest.
    createOrderHook = () => {
      externallyCommittedOrders.push(victimRow(RACE_KEY));
      createOrderHook = null;
      throw uniqueViolation("Order.idempotencyKey");
    };

    const response = await submitOrder(orderBody(30000, RACE_KEY), {
      cookie: `guest_cart_id=${OTHER_GUEST}`,
    });

    expectNoVictimDisclosure(await response.text());
    expect(store.orders.find((o) => o.id === VICTIM_ID)).toEqual(victimRow(RACE_KEY));
  });

  it("still returns the owner their OWN order on replay — AC-ORDER-016 is not narrowed", async () => {
    store.orders.push(victimRow(VICTIM_KEY));

    const response = await submitOrder(orderBody(30000, VICTIM_KEY), {
      cookie: `guest_cart_id=${GUEST}`,
    });

    // (c) the ownership check must reject strangers without costing the owner
    //     the replay behaviour REQ-ORDER-016 promises them.
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe(VICTIM_ID);
    expect(body.orderNumber).toBe(VICTIM_NUMBER);
    expect(body.shipping).toEqual(VICTIM_SHIPPING);
  });
});

describe("SPEC-ORDER-001 — a member submission is refused end to end (AC-ORDER-022)", () => {
  it("returns 409 and leaves orders, stock and carts untouched", async () => {
    await addToCart("A", 3);
    const token = await signAccessToken({ sub: "user-1", role: "customer" });

    const response = await submitOrder(orderBody(30000), {
      authorization: `Bearer ${token}`,
      cookie: `guest_cart_id=${GUEST}`,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "MEMBER_CHECKOUT_UNSUPPORTED",
    });
    expect(store.orders).toHaveLength(0);
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
    await expect(readCart()).resolves.toMatchObject({ itemCount: 3 });
  });
});

// ---------------------------------------------------------------------------
// SPEC-DISCOUNT-001 M4 — order-transaction integration, driven end to end
// ---------------------------------------------------------------------------

function pushCoupon(overrides: Partial<FakeCoupon> & { code: string }) {
  store.coupons.push({
    id: `coupon-${++store.seq}`,
    type: "PERCENTAGE",
    value: 10,
    minOrderAmount: 0,
    maxRedemptions: 100,
    redeemedCount: 0,
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T23:59:59Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("SPEC-DISCOUNT-001 M4 — the applied discount is a snapshot, not a join (AC-DISCOUNT-014)", () => {
  it("keeps couponCode, discountAmount and totalAmount after the coupon changes or is deleted", async () => {
    pushCoupon({ code: "SAVE10", value: 10 });
    await addToCart("A", 3); // 3 x 10,000 = 30,000

    const created = await (
      await submitOrder({
        shipping: SHIPPING,
        idempotencyKey: "coupon-key",
        couponCode: "save10",
        confirmedTotal: 27000, // 30,000 - 3,000 (10%)
      })
    ).json();

    expect(created.couponCode).toBe("SAVE10");
    expect(created.discountAmount).toBe(3000);
    expect(created.totalAmount).toBe(27000);

    // The coupon's value changes and the row is deleted entirely — neither
    // moves the already-created order's numbers, because Order.couponCode /
    // discountAmount are a snapshot copy, not a foreign key (design.md §1.2).
    const coupon = store.coupons.find((c) => c.code === "SAVE10")!;
    coupon.value = 50;
    store.coupons = store.coupons.filter((c) => c.code !== "SAVE10");

    const { getOrderForGuest } = await import("@/features/orders/services/order-service");
    const reread = await getOrderForGuest(created.id, GUEST);

    expect(reread!.couponCode).toBe("SAVE10");
    expect(reread!.discountAmount).toBe(3000);
    expect(reread!.totalAmount).toBe(27000);
  });

  it("increments the coupon's redeemedCount inside the order transaction (REQ-DISCOUNT-015/016)", async () => {
    pushCoupon({ code: "SAVE10", value: 10 });
    await addToCart("A", 3);

    await submitOrder({
      shipping: SHIPPING,
      idempotencyKey: "coupon-key-2",
      couponCode: "save10",
      confirmedTotal: 27000,
    });

    expect(store.coupons.find((c) => c.code === "SAVE10")!.redeemedCount).toBe(1);
  });
});

describe("SPEC-DISCOUNT-001 M4 — a coupon already at its cap is refused end to end (REQ-DISCOUNT-012/017)", () => {
  it("returns 409 COUPON_EXHAUSTED and creates no order, decrements no stock", async () => {
    pushCoupon({ code: "GONE10", maxRedemptions: 1, redeemedCount: 1 });
    await addToCart("A", 1);

    const response = await submitOrder({
      shipping: SHIPPING,
      idempotencyKey: "exhausted-key",
      couponCode: "gone10",
      confirmedTotal: 9000,
    });
    const responseBody = await response.json();

    expect(response.status).toBe(409);
    expect(responseBody.code).toBe("COUPON_EXHAUSTED");
    expect(store.orders).toHaveLength(0);
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
  });
});

describe("SPEC-DISCOUNT-001 M4 — a submission with no coupon is unchanged end to end (REQ-DISCOUNT-019, AC-DISCOUNT-019)", () => {
  it("creates the order with discountAmount 0 and couponCode null", async () => {
    await addToCart("A", 2);

    const created = await (await submitOrder(orderBody(20000))).json();

    expect(created.discountAmount).toBe(0);
    expect(created.couponCode).toBeNull();
  });
});

describe("SPEC-DISCOUNT-001 M4 — a later rollback undoes the redemption increment (REQ-DISCOUNT-015, AC-DISCOUNT-015)", () => {
  it("leaves redeemedCount at its pre-attempt value when step 4 (stock) fails afterward", async () => {
    pushCoupon({ code: "SAVE10", value: 10, maxRedemptions: 5, redeemedCount: 0 });
    // Stock drops below the cart's quantity between adding and ordering, so
    // 3f's coupon increment succeeds and step 4's stock decrement fails next —
    // exercising the SAME fake-DB rollback (snapshot/restore) AC-ORDER-012
    // already rests on, now over BOTH the order tables and the coupon row.
    await addToCart("B", 5);
    store.products.find((p) => p.id === "B")!.stock = 2;

    const response = await submitOrder({
      shipping: SHIPPING,
      idempotencyKey: "coupon-rollback-key",
      couponCode: "save10",
      confirmedTotal: 22500, // 25,000 - 2,500 (10%)
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(store.orders).toHaveLength(0);
    // The whole point of this test: 3f's increment ran and then rolled back.
    expect(store.coupons.find((c) => c.code === "SAVE10")!.redeemedCount).toBe(0);
  });
});
