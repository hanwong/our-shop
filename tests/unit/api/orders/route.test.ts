import { describe, it, expect, beforeEach, vi } from "vitest";
import { signAccessToken } from "@/lib/auth/jwt";

/**
 * SPEC-ORDER-001 M4 / SPEC-ORDER-004 M2 — POST /api/orders.
 *
 * Traces: AC-ORDER-007 (no credentials required), AC-ORDER-010 (400 with
 * fieldErrors, nothing changed), AC-ORDER-013/014/015 (the 409 bodies),
 * AC-ORDER-016 (a replay answers with the first order), AC-ORDER-019 (no
 * payment integration) — and, where SPEC-ORDER-001 asserted AC-ORDER-022 (a
 * member is refused), SPEC-ORDER-004 asserts AC-ORDER-054/055/057/069/070 (a
 * member SUCCEEDS, behind CSRF, from a session cookie alone).
 *
 * Mocked at the REPOSITORY seam, not the service seam, following
 * tests/unit/api/cart/route.test.ts: these criteria are stated in terms of
 * status codes, response bodies and Set-Cookie headers, and mocking the service
 * away would stop the tests from observing whether the guard actually holds.
 *
 * The member cases keep that discipline. `resolveSession` is NOT mocked — the
 * `refreshToken.findFirst` seam is, and the cookie carries a token whose REAL
 * hash matches the stored row, so the identity resolution under test is the
 * production one. That is the same seam SPEC-AUTH-002's own suite uses
 * (tests/unit/auth/session-resolver.test.ts, itself reusing
 * tests/unit/admin/admin-session.test.ts's strategy). The Authorization header
 * likewise still carries a REAL signed token, which is what makes
 * AC-ORDER-057's "a valid Bearer is not member evidence here" meaningful.
 */

// SPEC-ORDER-004 M2 — the route resolves member identity from next/headers
// cookies(), so every test in this file needs the store mocked or `cookies()`
// throws outside a request scope. Default is "no refresh_token" ⇒
// resolveSession() returns null ⇒ the guest path, which is what every
// pre-existing test in this file exercises. `mock`-prefixed so vitest's
// vi.mock hoisting check allows the factory to close over it.
const mockSessionCookie: { value: string | undefined } = { value: undefined };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "refresh_token" && mockSessionCookie.value !== undefined
        ? { value: mockSessionCookie.value }
        : undefined,
  }),
}));

const orderRepo = {
  findOrderByIdempotencyKey: vi.fn(),
  findOrderForGuest: vi.fn(),
  findOrderForUser: vi.fn(),
  decrementStockIfAvailable: vi.fn(),
  findStockByProductIds: vi.fn(),
  createOrderWithItems: vi.fn(),
};
vi.mock("@/features/orders/repositories/order-repository", () => orderRepo);

const cartRepo = {
  findCartByGuestId: vi.fn(),
  findCartByUserId: vi.fn(),
  deleteCart: vi.fn(),
};
vi.mock("@/features/cart/repositories/cart-repository", () => cartRepo);

// `refreshToken.findFirst` is resolveSession()'s only database call
// (session-resolver.ts) — mocking it here rather than resolveSession itself
// keeps the production identity resolution in the path under test.
const db = {
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({ __brand: "tx" })),
    refreshToken: { findFirst: vi.fn() },
  },
};
vi.mock("@/lib/db", () => db);

const { POST } = await import("@/app/api/orders/route");
// Imported AFTER the mocks, not at the top: session.ts pulls in @/lib/db, and a
// static import would evaluate it before vi.mock's hoisted factory can close
// over `db`. Same dynamic-import shape session-resolver.test.ts uses.
const { hashRefreshToken } = await import("@/lib/auth/session");

const GUEST = "guest-cookie-value";

/** The raw refresh token a member's browser presents; hashed to match the row. */
const REFRESH = "raw-refresh-token-for-user-1";
const CSRF = "csrf-token-value";
const MEMBER_CART = "cart-member";

/**
 * Puts the request into the member path: a `refresh_token` cookie whose real
 * hash matches a live, unrevoked RefreshToken row (SPEC-AUTH-002's own fixture
 * shape). `cookies()` is read from next/headers rather than from the Request,
 * so the value is staged on the mock store above.
 */
function asMember(): void {
  mockSessionCookie.value = REFRESH;
  db.prisma.refreshToken.findFirst.mockResolvedValue({
    id: "rt-1",
    tokenHash: hashRefreshToken(REFRESH),
    revokedAt: null,
    expiresAt: new Date(Date.now() + 1_000_000),
    user: { id: "user-1", role: "customer" },
  });
}

/** The member's own cart — a different row from the guest cookie's. */
function memberCartRow(price = 10000, stock = 10, quantity = 2) {
  return {
    id: MEMBER_CART,
    userId: "user-1",
    guestId: null,
    items: [
      {
        id: "item-m1",
        productId: "p-1",
        quantity,
        product: { id: "p-1", name: "Tee", price, images: [], stock },
      },
    ],
  };
}

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
  // Default: no session cookie ⇒ resolveSession() returns null ⇒ the guest
  // path, which is what every pre-existing test in this file exercises.
  mockSessionCookie.value = undefined;
  db.prisma.refreshToken.findFirst.mockResolvedValue(null);
  orderRepo.findOrderByIdempotencyKey.mockResolvedValue(null);
  orderRepo.decrementStockIfAvailable.mockResolvedValue(1);
  orderRepo.findStockByProductIds.mockResolvedValue([]);
  orderRepo.createOrderWithItems.mockResolvedValue({ id: "order-1" });
  cartRepo.findCartByGuestId.mockResolvedValue(cartRow());
  cartRepo.findCartByUserId.mockResolvedValue(memberCartRow());
  cartRepo.deleteCart.mockResolvedValue(undefined);
});

describe("SPEC-ORDER-004 M2 — a member submission succeeds (AC-ORDER-054/055)", () => {
  /** A member submission: session cookie + the matching CSRF double-submit pair. */
  async function submitAsMember() {
    asMember();
    return submit(validBody(), {
      cookie: `guest_cart_id=${GUEST}; csrf_token=${CSRF}`,
      "x-csrf-token": CSRF,
    });
  }

  it("answers 201 with the created order (AC-ORDER-055)", async () => {
    const response = await submitAsMember();
    const body = await response.json();

    // Where SPEC-ORDER-001 refused this with a 409 and a member-checkout
    // refusal code, the member path is now the supported path. That code is
    // gone from the codebase entirely, which AC-ORDER-059 checks with a plain
    // repo-wide substring grep — so it is deliberately not spelled out here.
    expect(response.status).toBe(201);
    expect(body.orderNumber).toMatch(/^ORD-\d{8}-[0-9A-Z]{6}$/);
    expect(body.status).toBe("pending_payment");
    expect(body.code).toBeUndefined();
  });

  it("OPENS a transaction — the member path is a write path now", async () => {
    await submitAsMember();

    // The exact inversion of SPEC-ORDER-001's "refuses BEFORE opening a
    // transaction": there is nothing left to refuse, so the transaction runs.
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("creates the order, moves the stock and empties the cart, as a member's", async () => {
    await submitAsMember();

    expect(orderRepo.createOrderWithItems).toHaveBeenCalledTimes(1);
    expect(orderRepo.decrementStockIfAvailable).toHaveBeenCalled();
    expect(cartRepo.deleteCart).toHaveBeenCalledWith(MEMBER_CART, expect.anything());

    // The owner reaching the repository is the member, not a guest — this is
    // where AC-ORDER-055's "userId populated, guestId null" is decided.
    const [, row] = orderRepo.createOrderWithItems.mock.calls[0]! as [
      unknown,
      Record<string, unknown>,
    ];
    expect(row.owner).toEqual({ kind: "user", userId: "user-1" });
  });

  it("does not quietly demote the member to their guest cookie", async () => {
    // The PRESERVED intent of SPEC-ORDER-001's assertion of the same name. Its
    // original comment: "Demoting would create an order the member can never
    // open again: the guest cookie is expired at login, so nothing would
    // present it back." That hazard is unchanged — only the correct answer is.
    // SPEC-ORDER-001 avoided it by refusing; SPEC-ORDER-004 avoids it by using
    // the MEMBER cart. Note the request DOES carry a guest cookie and it is
    // still never read.
    await submitAsMember();

    expect(cartRepo.findCartByUserId).toHaveBeenCalledWith("user-1", expect.anything());
    expect(cartRepo.findCartByGuestId).not.toHaveBeenCalled();
  });

  it("treats a valid Bearer with NO session cookie as a guest (AC-ORDER-057)", async () => {
    // SPEC-ORDER-001 asserted 409 here, to show the member guard was reachable
    // in practice. The boundary this now guards is REQ-ORDER-055: an
    // Authorization header is not member evidence ON THIS ROUTE, however valid
    // it is. The route calls resolveCartIdentity() nowhere, so no code path
    // exists here that could read the token at all (design.md §3.2.1).
    const token = await signAccessToken({ sub: "user-1", role: "customer" });

    const response = await submit(validBody(), {
      authorization: `Bearer ${token}`,
      cookie: `guest_cart_id=${GUEST}`,
    });

    expect(response.status).toBe(201);
    expect(cartRepo.findCartByGuestId).toHaveBeenCalledWith(GUEST, expect.anything());
    expect(cartRepo.findCartByUserId).not.toHaveBeenCalled();

    const [, row] = orderRepo.createOrderWithItems.mock.calls[0]! as [
      unknown,
      Record<string, unknown>,
    ];
    expect(row.owner).toEqual({ kind: "guest", guestId: GUEST });
  });
});

describe("SPEC-ORDER-004 M2 — CSRF gates the member path (AC-ORDER-069/070)", () => {
  it("403s a member with no CSRF header, before body parse or transaction", async () => {
    asMember();

    const response = await submit(validBody(), {
      cookie: `guest_cart_id=${GUEST}; csrf_token=${CSRF}`,
    });

    expect(response.status).toBe(403);
    // The invariant is "CSRF before the STATE-CHANGING operation", not "before
    // all DB access" — resolveSession() is a read and necessarily precedes it
    // (design.md §3.4). What must not happen is any of this:
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(orderRepo.createOrderWithItems).not.toHaveBeenCalled();
    expect(orderRepo.decrementStockIfAvailable).not.toHaveBeenCalled();
    expect(cartRepo.deleteCart).not.toHaveBeenCalled();
  });

  it("403s a member whose CSRF header does not match the cookie", async () => {
    asMember();

    const response = await submit(validBody(), {
      cookie: `guest_cart_id=${GUEST}; csrf_token=${CSRF}`,
      "x-csrf-token": "a-different-token",
    });

    expect(response.status).toBe(403);
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not parse the body on the CSRF-failure path", async () => {
    asMember();

    // Malformed JSON would 400 if the body were parsed; a 403 proves the
    // refusal happened first (AC-ORDER-069).
    const response = await submit("{not json", {
      cookie: `guest_cart_id=${GUEST}; csrf_token=${CSRF}`,
    });

    expect(response.status).toBe(403);
  });

  it("201s a guest with no CSRF header at all (AC-ORDER-070)", async () => {
    // The guest identity is an identifier, not an authenticator: requiring
    // CSRF here would break every existing guest client and buy nothing
    // (design.md §3.3). This is the no-regression half of REQ-ORDER-065.
    const response = await submit(validBody());

    expect(response.status).toBe(201);
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
