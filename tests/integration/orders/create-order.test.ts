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
  idempotencyKey: string;
  createdAt: Date;
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
  seq: number;
}

let store: Store;

/** Set by a test to make the NEXT order.create throw, simulating a race. */
let createOrderHook: (() => void) | null = null;

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
      if (!product || product.stock < where.stock.gte) return { count: 0 };
      product.stock -= data.stock.decrement;
      return { count: 1 };
    },
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
  store = {
    carts: [],
    cartItems: [],
    orders: [],
    orderItems: [],
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
