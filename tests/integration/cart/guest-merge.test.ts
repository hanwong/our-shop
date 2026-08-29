import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CART-001 M6 — end-to-end guest -> member cart merge, driven through the
 * real route handlers against an in-memory database.
 *
 * Traces: AC-CART-012 (sum, clamp to stock, carry over the non-overlapping
 * item), AC-CART-013 (a sold-out product is omitted entirely rather than
 * stored at zero), AC-CART-014 (replaying the spent cookie merges nothing),
 * plus the promote path from acceptance.md §2.
 *
 * Unlike the unit suites, nothing here is mocked at the repository or service
 * seam: the fake below stands in for PostgreSQL only. That is what makes this
 * an actual check of the merge rather than a check that the merge was called —
 * the arithmetic, the clamp and the idempotence are all exercised for real.
 *
 * What it still cannot prove is stated plainly in progress.md §E.2: with no
 * live PostgreSQL there is no evidence about real constraint enforcement,
 * cascade behaviour, or the concurrent-add race plan.md §8 flags.
 */

interface FakeCart {
  id: string;
  userId: string | null;
  guestId: string | null;
}
interface FakeItem {
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

let carts: FakeCart[] = [];
let items: FakeItem[] = [];
let products: FakeProduct[] = [];
let seq = 0;

function joinItems(cartId: string) {
  return items
    .filter((i) => i.cartId === cartId)
    .map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      product: products.find((p) => p.id === i.productId)!,
    }));
}

function withItems(cart: FakeCart | undefined) {
  return cart ? { ...cart, items: joinItems(cart.id) } : null;
}

vi.mock("@/lib/auth/password", () => ({
  comparePassword: vi.fn(async () => true),
  dummyCompare: vi.fn(async () => undefined),
  hashPassword: vi.fn(async () => "hashed"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === "shopper@example.com" || where.id === "user-1") {
          return {
            id: "user-1",
            email: "shopper@example.com",
            passwordHash: "hashed",
            emailVerified: true,
            role: "customer" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      }),
    },
    refreshToken: { create: vi.fn(async ({ data }: { data: object }) => ({ id: "rt", ...data })) },
    product: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const p = products.find((x) => x.id === where.id);
        return p ? { id: p.id, price: p.price, stock: p.stock } : null;
      }),
    },
    cart: {
      findUnique: vi.fn(
        async ({ where }: { where: { id?: string; userId?: string; guestId?: string } }) => {
          if (where.id !== undefined) return withItems(carts.find((c) => c.id === where.id));
          if (where.userId !== undefined)
            return withItems(carts.find((c) => c.userId === where.userId));
          if (where.guestId !== undefined)
            return withItems(carts.find((c) => c.guestId === where.guestId));
          return null;
        }
      ),
      create: vi.fn(async ({ data }: { data: { userId?: string; guestId?: string } }) => {
        const row: FakeCart = {
          id: `cart-${++seq}`,
          userId: data.userId ?? null,
          guestId: data.guestId ?? null,
        };
        carts.push(row);
        return { id: row.id };
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { userId?: string; guestId?: string | null };
        }) => {
          const row = carts.find((c) => c.id === where.id)!;
          if (data.userId !== undefined) row.userId = data.userId;
          if (data.guestId !== undefined) row.guestId = data.guestId;
          return row;
        }
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        carts = carts.filter((c) => c.id !== where.id);
        // The FK cascade CartItem.cartId -> Cart.id, modelled here.
        items = items.filter((i) => i.cartId !== where.id);
        return { id: where.id };
      }),
    },
    cartItem: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return items.find((i) => i.id === where.id) ?? null;
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { cartId_productId: { cartId: string; productId: string } };
          create: { cartId: string; productId: string; quantity: number };
          update: { quantity: { increment: number } };
        }) => {
          const key = where.cartId_productId;
          const existing = items.find(
            (i) => i.cartId === key.cartId && i.productId === key.productId
          );
          if (existing) {
            existing.quantity += update.quantity.increment;
            return existing;
          }
          const row: FakeItem = { id: `item-${++seq}`, ...create };
          items.push(row);
          return row;
        }
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { quantity: number } }) => {
          const row = items.find((i) => i.id === where.id)!;
          row.quantity = data.quantity;
          return row;
        }
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        items = items.filter((i) => i.id !== where.id);
        return { id: where.id };
      }),
    },
  },
}));

const GUEST = "guest-cookie-value";

beforeEach(async () => {
  carts = [];
  items = [];
  seq = 0;
  products = [
    { id: "A", name: "product A", price: 1000, images: ["a.jpg"], stock: 4 },
    { id: "B", name: "product B", price: 2000, images: ["b.jpg"], stock: 9 },
    { id: "C", name: "product C", price: 3000, images: ["c.jpg"], stock: 9 },
    { id: "D", name: "product D", price: 500, images: [], stock: 0 },
  ];
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  process.env.NODE_ENV = "test";
  const { __resetRateLimitStoreForTests } = await import("@/lib/auth/rate-limit");
  __resetRateLimitStoreForTests();
});

async function addAsGuest(productId: string, quantity: number) {
  const { POST } = await import("@/app/api/cart/items/route");
  return POST(
    new Request("http://localhost/api/cart/items", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `guest_cart_id=${GUEST}` },
      body: JSON.stringify({ productId, quantity }),
    })
  );
}

/** Seeds the member's own cart directly, as if from an earlier session. */
function seedMemberCart(lines: Array<{ productId: string; quantity: number }>) {
  const cart: FakeCart = { id: "cart-member", userId: "user-1", guestId: null };
  carts.push(cart);
  for (const line of lines) {
    items.push({ id: `member-${line.productId}`, cartId: cart.id, ...line });
  }
}

async function login(cookie?: string) {
  const { POST } = await import("@/app/api/auth/login/route");
  return POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.9.0.${Math.floor(Math.random() * 250) + 1}`,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ email: "shopper@example.com", password: "pw" }),
    })
  );
}

async function memberCart(accessToken: string) {
  const { GET } = await import("@/app/api/cart/route");
  const response = await GET(
    new Request("http://localhost/api/cart", {
      headers: { authorization: `Bearer ${accessToken}` },
    })
  );
  return response.json();
}

describe("SPEC-CART-001 — guest cart survives login (AC-CART-012)", () => {
  it("sums the overlap, clamps it to stock, and carries the rest across", async () => {
    // Guest holds A×3 and C×1; the member already holds A×2 and B×1. A's stock is 4.
    await addAsGuest("A", 3);
    await addAsGuest("C", 1);
    seedMemberCart([
      { productId: "A", quantity: 2 },
      { productId: "B", quantity: 1 },
    ]);

    const loginResponse = await login(`guest_cart_id=${GUEST}`);
    const { accessToken } = await loginResponse.json();
    const cart = await memberCart(accessToken);

    const byProduct = Object.fromEntries(
      cart.items.map((i: { productId: string; quantity: number }) => [i.productId, i.quantity])
    );

    expect(loginResponse.status).toBe(200);
    // 3 + 2 = 5, clamped to stock 4.
    expect(byProduct.A).toBe(4);
    // Untouched — the guest cart had no B.
    expect(byProduct.B).toBe(1);
    // Carried across at its guest quantity.
    expect(byProduct.C).toBe(1);
    expect(cart.items).toHaveLength(3);
  });

  it("prices the merged cart from current prices", async () => {
    await addAsGuest("B", 2);
    seedMemberCart([{ productId: "C", quantity: 1 }]);

    const { accessToken } = await (await login(`guest_cart_id=${GUEST}`)).json();
    const cart = await memberCart(accessToken);

    expect(cart.subtotal).toBe(2 * 2000 + 1 * 3000);
    expect(cart.itemCount).toBe(3);
  });

  it("omits a sold-out product entirely rather than storing quantity 0 (AC-CART-013)", async () => {
    // D is added while still in stock, then sells out before the shopper logs in.
    products.find((p) => p.id === "D")!.stock = 5;
    await addAsGuest("D", 2);
    products.find((p) => p.id === "D")!.stock = 0;
    seedMemberCart([{ productId: "B", quantity: 1 }]);

    const { accessToken } = await (await login(`guest_cart_id=${GUEST}`)).json();
    const cart = await memberCart(accessToken);

    expect(cart.items.map((i: { productId: string }) => i.productId)).toEqual(["B"]);
    expect(cart.items.every((i: { quantity: number }) => i.quantity >= 1)).toBe(true);
  });

  it("promotes the guest cart wholesale when the member has none (acceptance.md §2)", async () => {
    await addAsGuest("A", 3);
    await addAsGuest("B", 2);

    const { accessToken } = await (await login(`guest_cart_id=${GUEST}`)).json();
    const cart = await memberCart(accessToken);

    expect(cart.itemCount).toBe(5);
    // Ownership moved rather than rows being copied: one cart row exists, and
    // it is the one the guest was using.
    expect(carts).toHaveLength(1);
    expect(carts[0]).toMatchObject({ userId: "user-1", guestId: null });
  });
});

describe("SPEC-CART-001 — the spent cookie cannot merge twice (AC-CART-014)", () => {
  it("adds nothing on a second login replaying the same guest cookie", async () => {
    await addAsGuest("A", 2);
    seedMemberCart([{ productId: "A", quantity: 1 }]);

    const first = await (await login(`guest_cart_id=${GUEST}`)).json();
    const afterFirst = await memberCart(first.accessToken);
    expect(afterFirst.items[0].quantity).toBe(3);

    // The browser was told to drop the cookie, but a replay must be harmless
    // on the server side regardless of whether the client complied.
    const second = await (await login(`guest_cart_id=${GUEST}`)).json();
    const afterSecond = await memberCart(second.accessToken);

    expect(afterSecond.items[0].quantity).toBe(3);
    expect(afterSecond.itemCount).toBe(afterFirst.itemCount);
  });

  it("tells the browser to drop the cookie on the merging login", async () => {
    await addAsGuest("A", 1);

    const response = await login(`guest_cart_id=${GUEST}`);
    const guestCookie = response.headers.getSetCookie().find((c) => c.startsWith("guest_cart_id="));

    expect(guestCookie).toContain("Max-Age=0");
  });

  it("leaves the guest cart unreachable by its old id afterwards (REQ-CART-013)", async () => {
    await addAsGuest("A", 1);
    await login(`guest_cart_id=${GUEST}`);

    const { GET } = await import("@/app/api/cart/route");
    const body = await (
      await GET(
        new Request("http://localhost/api/cart", { headers: { cookie: `guest_cart_id=${GUEST}` } })
      )
    ).json();

    expect(body).toEqual({ items: [], subtotal: 0, itemCount: 0 });
  });
});

describe("SPEC-CART-001 — cart operations never move stock (AC-CART-015)", () => {
  it("leaves Product.stock identical after add, change and delete", async () => {
    const before = products.map((p) => ({ id: p.id, stock: p.stock }));

    await addAsGuest("A", 2);
    const { PATCH, DELETE } = await import("@/app/api/cart/items/[itemId]/route");
    const itemId = items[0]!.id;
    await PATCH(
      new Request(`http://localhost/api/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: `guest_cart_id=${GUEST}` },
        body: JSON.stringify({ quantity: 3 }),
      }),
      { params: Promise.resolve({ itemId }) }
    );
    await DELETE(
      new Request(`http://localhost/api/cart/items/${itemId}`, {
        method: "DELETE",
        headers: { cookie: `guest_cart_id=${GUEST}` },
      }),
      { params: Promise.resolve({ itemId }) }
    );

    expect(products.map((p) => ({ id: p.id, stock: p.stock }))).toEqual(before);
  });
});

describe("SPEC-CART-001 — guest flow needs no credentials (AC-CART-015 / REQ-CART-014)", () => {
  it("carries a cart across requests using only the issued cookie (AC-CART-003)", async () => {
    const { GET } = await import("@/app/api/cart/route");

    // First contact: no cookie at all.
    const first = await GET(new Request("http://localhost/api/cart"));
    const issued = first.headers
      .getSetCookie()
      .find((c) => c.startsWith("guest_cart_id="))!
      .split(";")[0]!;

    expect(first.status).toBe(200);

    // Adding with the issued cookie, then reading it back, finds the same cart.
    const { POST } = await import("@/app/api/cart/items/route");
    await POST(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: issued },
        body: JSON.stringify({ productId: "B", quantity: 2 }),
      })
    );

    const second = await GET(new Request("http://localhost/api/cart", { headers: { cookie: issued } }));
    const body = await second.json();

    expect(body.itemCount).toBe(2);
    expect(body.items[0].productId).toBe("B");
  });
});
