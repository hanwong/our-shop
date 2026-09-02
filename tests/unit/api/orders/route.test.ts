import { describe, it, expect, beforeEach, vi } from "vitest";
import { signAccessToken } from "@/lib/auth/jwt";

/**
 * SPEC-ORDER-001 M4 — POST /api/orders.
 *
 * Traces: AC-ORDER-007 (no credentials required), AC-ORDER-010 (400 with
 * fieldErrors, nothing changed), AC-ORDER-013/014/015 (the 409 bodies),
 * AC-ORDER-016 (a replay answers with the first order), AC-ORDER-019 (no
 * payment integration), and above all AC-ORDER-022 (a member is refused).
 *
 * Mocked at the REPOSITORY seam, not the service seam, following
 * tests/unit/api/cart/route.test.ts: these criteria are stated in terms of
 * status codes, response bodies and Set-Cookie headers, and mocking the service
 * away would stop the tests from observing whether the guard actually holds.
 * The Authorization header in the member case carries a REAL signed token, so
 * the identity resolution under test is the production one.
 */

const orderRepo = {
  findOrderByIdempotencyKey: vi.fn(),
  findOrderForGuest: vi.fn(),
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

const db = {
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({ __brand: "tx" })),
  },
};
vi.mock("@/lib/db", () => db);

const { POST } = await import("@/app/api/orders/route");

const GUEST = "guest-cookie-value";

const SHIPPING = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구 테헤란로 1",
  deliveryMemo: null,
};

function cartRow(price = 10000, stock = 10, quantity = 2) {
  return {
    id: "cart-1",
    guestId: GUEST,
    items: [
      {
        id: "item-1",
        productId: "p-1",
        quantity,
        product: { id: "p-1", name: "Tee", price, images: [], stock },
      },
    ],
  };
}

function submit(
  body: unknown,
  headers: Record<string, string> = { cookie: `guest_cart_id=${GUEST}` }
): Promise<Response> {
  return POST(
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { shipping: SHIPPING, idempotencyKey: "key-1", confirmedTotal: 20000, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  db.prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ __brand: "tx" })
  );
  orderRepo.findOrderByIdempotencyKey.mockResolvedValue(null);
  orderRepo.decrementStockIfAvailable.mockResolvedValue(1);
  orderRepo.findStockByProductIds.mockResolvedValue([]);
  orderRepo.createOrderWithItems.mockResolvedValue({ id: "order-1" });
  cartRepo.findCartByGuestId.mockResolvedValue(cartRow());
  cartRepo.deleteCart.mockResolvedValue(undefined);
});

describe("SPEC-ORDER-001 M4 — a member submission is refused (AC-ORDER-022)", () => {
  async function submitAsMember() {
    const token = await signAccessToken({ sub: "user-1", role: "customer" });
    return submit(validBody(), {
      authorization: `Bearer ${token}`,
      cookie: `guest_cart_id=${GUEST}`,
    });
  }

  it("answers 409 MEMBER_CHECKOUT_UNSUPPORTED, not 401 or 403", async () => {
    const response = await submitAsMember();

    // 409 rather than an auth error: the credentials are perfectly valid, and
    // re-authenticating changes nothing. This scope simply has no member
    // checkout to offer (design.md §8).
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "MEMBER_CHECKOUT_UNSUPPORTED",
    });
  });

  it("refuses BEFORE opening a transaction (AC-ORDER-022 (e))", async () => {
    await submitAsMember();

    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates no order, moves no stock, empties no cart", async () => {
    await submitAsMember();

    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });

  it("does not quietly demote the member to their guest cookie", async () => {
    // Demoting would create an order the member can never open again: the
    // guest cookie is expired at login, so nothing would present it back
    // (research.md §6). Refusing is the honest answer.
    await submitAsMember();

    expect(cartRepo.findCartByGuestId).not.toHaveBeenCalled();
  });

  it("is reachable in practice, which is why the guard is code and not prose", async () => {
    // A browser form cannot attach an Authorization header, but this endpoint
    // is public — anyone holding a valid token can call it directly.
    const response = await submitAsMember();
    expect(response.status).toBe(409);
  });
});

describe("SPEC-ORDER-001 M4 — the guest happy path (AC-ORDER-007/011)", () => {
  it("answers 201 with the created order", async () => {
    const response = await submit(validBody());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.orderNumber).toMatch(/^ORD-\d{8}-[0-9A-Z]{6}$/);
    expect(body.status).toBe("pending_payment");
    expect(body.totalAmount).toBe(20000);
  });

  it("requires no credentials at all (REQ-ORDER-007)", async () => {
    const response = await submit(validBody());

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("returns no payment fields anywhere in the body (REQ-ORDER-009)", async () => {
    const raw = await (await submit(validBody())).text();

    expect(raw).not.toMatch(/card|cvc|expiry|paymentMethod/i);
  });
});

describe("SPEC-ORDER-001 M4 — refusals map to design.md §8's bodies", () => {
  it("400s a malformed JSON body without reaching the domain", async () => {
    const response = await submit("{not json");

    expect(response.status).toBe(400);
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("400s a missing shipping field and names it (AC-ORDER-010)", async () => {
    const response = await submit(
      validBody({ shipping: { ...SHIPPING, recipientName: "" } })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors).toHaveProperty("recipientName");
    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
  });

  it("409s an empty cart with CART_EMPTY (AC-ORDER-015)", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(null);

    const response = await submit(validBody());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "CART_EMPTY" });
  });

  it("409s insufficient stock, naming the product and what is left (AC-ORDER-013)", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(cartRow(10000, 2, 5));
    orderRepo.decrementStockIfAvailable.mockResolvedValue(0);
    // SPEC-ORDER-002 REQ-ORDER-025: `available` is now the figure re-read at
    // the moment of refusal rather than the transaction's opening snapshot.
    // The body this route serialises is unchanged; its source is not.
    orderRepo.findStockByProductIds.mockResolvedValue([{ id: "p-1", stock: 2 }]);

    const response = await submit(validBody({ confirmedTotal: 50000 }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("INSUFFICIENT_STOCK");
    expect(body.products).toEqual([{ productId: "p-1", name: "Tee", available: 2 }]);
  });

  it("409s an aborted transaction with CONCURRENCY_RETRY (SPEC-ORDER-002 AC-ORDER-029)", async () => {
    orderRepo.decrementStockIfAvailable.mockRejectedValue(
      Object.assign(new Error("Transaction failed due to a write conflict or a deadlock"), {
        code: "P2034",
      })
    );

    const response = await submit(validBody());
    const body = await response.json();

    // The route rebuilds nothing — it spreads whatever the service refused
    // with, so a new refusal shape reaches the wire without an edit here. This
    // asserts that property holds for the code SPEC-ORDER-002 adds.
    expect(response.status).toBe(409);
    expect(body.code).toBe("CONCURRENCY_RETRY");
    expect(body.error).toBeTruthy();
  });

  it("409s a changed price and reports the recomputed total (AC-ORDER-014)", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(cartRow(20000, 10, 2));

    const response = await submit(validBody({ confirmedTotal: 20000 }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("PRICE_CHANGED");
    expect(body.totalAmount).toBe(40000);
  });

  it("leaks no `ok` discriminant into the wire body", async () => {
    // The route serialises the service's failure shape directly rather than
    // rebuilding it, so the service stays the single owner of design.md §8's
    // table. `ok` is the only field that must not survive that pass-through.
    const body = await (await submit(validBody({ confirmedTotal: 1 }))).json();

    expect(body).not.toHaveProperty("ok");
  });
});

describe("SPEC-ORDER-001 M4 — guest cookie handling (AC-ORDER-015 (ii), design.md §6.2)", () => {
  it("attaches a freshly minted guest cookie when the request presented none", async () => {
    cartRepo.findCartByGuestId.mockResolvedValue(null);

    const response = await submit(validBody(), {});
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith("guest_cart_id="));

    // The order is refused (this new identity owns no cart), but the cookie is
    // still attached so the visitor's next add carries the same identity.
    expect(response.status).toBe(409);
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
  });

  it("sets no cookie when the request already presented one", async () => {
    const response = await submit(validBody());

    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe("SPEC-ORDER-001 M4 — idempotent replay (AC-ORDER-016)", () => {
  it("returns the first order and decrements nothing a second time", async () => {
    orderRepo.findOrderByIdempotencyKey.mockResolvedValue({
      id: "order-1",
      orderNumber: "ORD-20260831-AAAAAA",
      status: "pending_payment",
      guestId: GUEST,
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
    });

    const body = await (await submit(validBody())).json();

    expect(body.orderNumber).toBe("ORD-20260831-AAAAAA");
    expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
  });
});
