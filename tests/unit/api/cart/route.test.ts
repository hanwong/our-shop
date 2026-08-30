import { describe, it, expect, beforeEach, vi } from "vitest";
import { signAccessToken } from "@/lib/auth/jwt";

/**
 * SPEC-CART-001 M4 — the three cart route handlers:
 *   src/app/api/cart/route.ts                  GET
 *   src/app/api/cart/items/route.ts            POST
 *   src/app/api/cart/items/[itemId]/route.ts   PATCH, DELETE
 *
 * Traces: AC-CART-001 (the item echoes the requested product and quantity),
 * AC-CART-002/003 (identity resolution and cookie issuance at the HTTP
 * boundary), AC-CART-004 (cookie attributes as actually sent), AC-CART-005 to
 * 011 and AC-CART-015/016 (status codes and bodies).
 *
 * Mocked at the REPOSITORY seam, not the service seam, following
 * tests/unit/api/products/route.test.ts: the ACs here are stated in terms of
 * status codes, response bodies and Set-Cookie headers, and mocking the
 * service away would stop these tests from observing any of them.
 */

const repo = {
  createUserCart: vi.fn(),
  createGuestCart: vi.fn(),
  findCartByUserId: vi.fn(),
  findCartByGuestId: vi.fn(),
  findItemById: vi.fn(),
  findProductForCart: vi.fn(),
  incrementItemQuantity: vi.fn(),
  setItemQuantity: vi.fn(),
  deleteItem: vi.fn(),
  promoteGuestCartToUser: vi.fn(),
  deleteCart: vi.fn(),
};

vi.mock("@/features/cart/repositories/cart-repository", () => repo);

function cartRow(
  id: string,
  items: Array<{ id: string; productId: string; quantity: number; price?: number; stock?: number }>
) {
  return {
    id,
    userId: null,
    guestId: null,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      product: {
        id: i.productId,
        name: `product ${i.productId}`,
        price: i.price ?? 39000,
        images: ["https://cdn.example.com/a.jpg"],
        stock: i.stock ?? 10,
      },
    })),
  };
}

/** A cart request carrying NO Authorization header (AC-CART-015). */
function req(url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, init);
}

function jsonReq(url: string, body: unknown, method: string, cookie?: string): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function itemContext(itemId: string) {
  return { params: Promise.resolve({ itemId }) };
}

const GUEST_COOKIE = "guest_cart_id=g-1";

beforeEach(() => {
  for (const fn of Object.values(repo)) fn.mockReset();
  repo.findCartByGuestId.mockResolvedValue(null);
  repo.findCartByUserId.mockResolvedValue(null);
  repo.findItemById.mockResolvedValue(null);
  repo.findProductForCart.mockResolvedValue(null);
  repo.createGuestCart.mockResolvedValue({ id: "cart-new" });
  repo.createUserCart.mockResolvedValue({ id: "cart-new" });
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  // vi.stubEnv, not a direct assignment: Next.js declares NODE_ENV `readonly`
  // on NodeJS.ProcessEnv, so `process.env.NODE_ENV = x` is a TS2540 error.
  vi.stubEnv("NODE_ENV", "test");
});

// ---------------------------------------------------------------------------
// GET /api/cart
// ---------------------------------------------------------------------------

describe("GET /api/cart — guest access and cookie issuance (AC-CART-003/004/005)", () => {
  it("answers an unauthenticated, cookie-less request with 200 and an empty cart", async () => {
    const { GET } = await import("@/app/api/cart/route");

    const response = await GET(req("/api/cart"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(401);
    expect(body).toEqual({ items: [], subtotal: 0, itemCount: 0 });
  });

  it("sets a httpOnly guest_cart_id cookie on the first request (AC-CART-003/004)", async () => {
    const { GET } = await import("@/app/api/cart/route");

    const response = await GET(req("/api/cart"));
    const setCookie = response.headers.getSetCookie().find((c) => c.startsWith("guest_cart_id="));

    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    // 14 days, distinct from the refresh token's 30 (AC-CART-004).
    expect(setCookie).toContain(`Max-Age=${14 * 24 * 60 * 60}`);
  });

  it("creates NO cart row while issuing that cookie (AC-CART-005 lazy creation)", async () => {
    const { GET } = await import("@/app/api/cart/route");

    await GET(req("/api/cart"));

    expect(repo.createGuestCart).not.toHaveBeenCalled();
    expect(repo.createUserCart).not.toHaveBeenCalled();
  });

  it("reuses an existing guest cookie and issues no replacement", async () => {
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 2, price: 39000 }])
    );
    const { GET } = await import("@/app/api/cart/route");

    const response = await GET(req("/api/cart", { headers: { cookie: GUEST_COOKIE } }));
    const body = await response.json();

    expect(repo.findCartByGuestId).toHaveBeenCalledWith("g-1");
    expect(response.headers.getSetCookie().filter((c) => c.startsWith("guest_cart_id="))).toEqual([]);
    expect(body.subtotal).toBe(78000);
    expect(body.itemCount).toBe(2);
  });

  it("routes a valid Bearer token to the member cart (AC-CART-002)", async () => {
    const token = await signAccessToken({ sub: "user-7", role: "customer" });
    repo.findCartByUserId.mockResolvedValue(cartRow("cart-u", []));
    const { GET } = await import("@/app/api/cart/route");

    await GET(req("/api/cart", { headers: { authorization: `Bearer ${token}` } }));

    expect(repo.findCartByUserId).toHaveBeenCalledWith("user-7");
    expect(repo.findCartByGuestId).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/cart/items
// ---------------------------------------------------------------------------

describe("POST /api/cart/items — add (AC-CART-001/006/007/008)", () => {
  it("adds an item and answers with the whole cart including the subtotal", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 39000, stock: 10 });
    repo.findCartByGuestId
      .mockResolvedValueOnce(null)
      .mockResolvedValue(cartRow("cart-new", [{ id: "i1", productId: "p1", quantity: 2, price: 39000 }]));
    const { POST } = await import("@/app/api/cart/items/route");

    const response = await POST(
      jsonReq("/api/cart/items", { productId: "p1", quantity: 2 }, "POST", GUEST_COOKIE)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    // AC-CART-001 — the stored line echoes the requested product and quantity.
    expect(body.items[0]).toMatchObject({ productId: "p1", quantity: 2 });
    expect(body.subtotal).toBe(78000);
  });

  it("rejects a body that is not JSON with 400 rather than throwing", async () => {
    const { POST } = await import("@/app/api/cart/items/route");

    const response = await POST(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: GUEST_COOKIE },
        body: "{not json",
      })
    );

    expect(response.status).toBe(400);
    expect(typeof (await response.json()).error).toBe("string");
  });

  it("rejects an over-stock add with 400 and persists nothing (AC-CART-008)", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 3 });
    const { POST } = await import("@/app/api/cart/items/route");

    const response = await POST(
      jsonReq("/api/cart/items", { productId: "p1", quantity: 4 }, "POST", GUEST_COOKIE)
    );

    expect(response.status).toBe(400);
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
  });

  it("rejects an unknown productId with 400 (REQ-CART-007)", async () => {
    repo.findProductForCart.mockResolvedValue(null);
    const { POST } = await import("@/app/api/cart/items/route");

    const response = await POST(
      jsonReq("/api/cart/items", { productId: "ghost", quantity: 1 }, "POST", GUEST_COOKIE)
    );

    expect(response.status).toBe(400);
  });

  it("issues a guest cookie when an anonymous request adds its first item", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 10 });
    repo.findCartByGuestId
      .mockResolvedValueOnce(null)
      .mockResolvedValue(cartRow("cart-new", [{ id: "i1", productId: "p1", quantity: 1 }]));
    const { POST } = await import("@/app/api/cart/items/route");

    const response = await POST(
      jsonReq("/api/cart/items", { productId: "p1", quantity: 1 }, "POST")
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.getSetCookie().find((c) => c.startsWith("guest_cart_id="))
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PATCH / DELETE /api/cart/items/:itemId
// ---------------------------------------------------------------------------

describe("PATCH /api/cart/items/:itemId — absolute quantity (AC-CART-009/011/016)", () => {
  beforeEach(() => {
    repo.findItemById.mockResolvedValue({ id: "i1", cartId: "cart-1", productId: "p1", quantity: 2 });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 2 }])
    );
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 10 });
  });

  it("sets the quantity absolutely and answers with the whole cart", async () => {
    const { PATCH } = await import("@/app/api/cart/items/[itemId]/route");

    const response = await PATCH(
      jsonReq("/api/cart/items/i1", { quantity: 5 }, "PATCH", GUEST_COOKIE),
      itemContext("i1")
    );

    expect(response.status).toBe(200);
    expect(repo.setItemQuantity).toHaveBeenCalledWith("i1", 5);
    expect(await response.json()).toHaveProperty("subtotal");
  });

  it("answers 404 for an item outside the requester's cart (AC-CART-011)", async () => {
    repo.findItemById.mockResolvedValue({
      id: "i9",
      cartId: "cart-OTHER",
      productId: "p1",
      quantity: 1,
    });
    const { PATCH } = await import("@/app/api/cart/items/[itemId]/route");

    const response = await PATCH(
      jsonReq("/api/cart/items/i9", { quantity: 5 }, "PATCH", GUEST_COOKIE),
      itemContext("i9")
    );

    expect(response.status).toBe(404);
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
  });

  it("answers 400 for quantity 0 — zeroing out is DELETE's job", async () => {
    const { PATCH } = await import("@/app/api/cart/items/[itemId]/route");

    const response = await PATCH(
      jsonReq("/api/cart/items/i1", { quantity: 0 }, "PATCH", GUEST_COOKIE),
      itemContext("i1")
    );

    expect(response.status).toBe(400);
    expect(repo.deleteItem).not.toHaveBeenCalled();
  });

  it("answers 400 for a quantity above stock (AC-CART-016)", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 4 });
    const { PATCH } = await import("@/app/api/cart/items/[itemId]/route");

    const response = await PATCH(
      jsonReq("/api/cart/items/i1", { quantity: 5 }, "PATCH", GUEST_COOKIE),
      itemContext("i1")
    );

    expect(response.status).toBe(400);
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON PATCH body with 400", async () => {
    const { PATCH } = await import("@/app/api/cart/items/[itemId]/route");

    const response = await PATCH(
      new Request("http://localhost/api/cart/items/i1", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: GUEST_COOKIE },
        body: "nope",
      }),
      itemContext("i1")
    );

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/cart/items/:itemId (AC-CART-010/011)", () => {
  it("removes the addressed line and answers with what remains", async () => {
    repo.findItemById.mockResolvedValue({ id: "i1", cartId: "cart-1", productId: "p1", quantity: 2 });
    repo.findCartByGuestId
      .mockResolvedValueOnce(
        cartRow("cart-1", [
          { id: "i1", productId: "p1", quantity: 2 },
          { id: "i2", productId: "p2", quantity: 1 },
        ])
      )
      .mockResolvedValue(cartRow("cart-1", [{ id: "i2", productId: "p2", quantity: 1 }]));
    const { DELETE } = await import("@/app/api/cart/items/[itemId]/route");

    const response = await DELETE(
      req("/api/cart/items/i1", { method: "DELETE", headers: { cookie: GUEST_COOKIE } }),
      itemContext("i1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repo.deleteItem).toHaveBeenCalledWith("i1");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].productId).toBe("p2");
  });

  it("answers 404 for an unknown item and deletes nothing (AC-CART-011)", async () => {
    repo.findItemById.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/cart/items/[itemId]/route");

    const response = await DELETE(
      req("/api/cart/items/ghost", { method: "DELETE", headers: { cookie: GUEST_COOKIE } }),
      itemContext("ghost")
    );

    expect(response.status).toBe(404);
    expect(repo.deleteItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-CART-015 — the whole surface is reachable without credentials
// ---------------------------------------------------------------------------

describe("cart endpoints require no credentials (AC-CART-015 / REQ-CART-014)", () => {
  it("answers all four operations without a 401 or 403 when no Authorization header is sent", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 10 });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 1 }])
    );
    repo.findItemById.mockResolvedValue({ id: "i1", cartId: "cart-1", productId: "p1", quantity: 1 });

    const { GET } = await import("@/app/api/cart/route");
    const { POST } = await import("@/app/api/cart/items/route");
    const { PATCH, DELETE } = await import("@/app/api/cart/items/[itemId]/route");

    const statuses = [
      (await GET(req("/api/cart", { headers: { cookie: GUEST_COOKIE } }))).status,
      (await POST(jsonReq("/api/cart/items", { productId: "p1", quantity: 1 }, "POST", GUEST_COOKIE)))
        .status,
      (
        await PATCH(
          jsonReq("/api/cart/items/i1", { quantity: 2 }, "PATCH", GUEST_COOKIE),
          itemContext("i1")
        )
      ).status,
      (
        await DELETE(
          req("/api/cart/items/i1", { method: "DELETE", headers: { cookie: GUEST_COOKIE } }),
          itemContext("i1")
        )
      ).status,
    ];

    expect(statuses).toEqual([200, 200, 200, 200]);
    expect(statuses).not.toContain(401);
    expect(statuses).not.toContain(403);
  });

  it("never calls a stock-mutating repository function (REQ-CART-015)", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 10 });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 1 }])
    );
    const { POST } = await import("@/app/api/cart/items/route");

    await POST(jsonReq("/api/cart/items", { productId: "p1", quantity: 1 }, "POST", GUEST_COOKIE));

    // The cart repository exposes no product-writing function at all — the
    // structural half of REQ-CART-015. Only the read is ever used.
    expect(Object.keys(repo).filter((k) => /^(update|decrement|reserve).*Product/i.test(k))).toEqual(
      []
    );
    expect(repo.findProductForCart).toHaveBeenCalled();
  });
});
