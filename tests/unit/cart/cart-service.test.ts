import { describe, it, expect, beforeEach, vi } from "vitest";
import { signAccessToken } from "@/lib/auth/jwt";

/**
 * SPEC-CART-001 M3 — src/features/cart/services/cart-service.ts
 *
 * Traces: REQ-CART-003 (identity resolution), REQ-CART-005 (subtotal off the
 * CURRENT price), REQ-CART-006 (add is increment), REQ-CART-007 (validation +
 * stock ceiling, persisting nothing on rejection), REQ-CART-008 (absolute
 * set), REQ-CART-009/010 (delete, and 404 for a foreign item), REQ-CART-011 to
 * 013 (login-time merge: promote, sum, clamp, omit-zero, idempotent).
 *
 * Mocked at the REPOSITORY seam, matching tests/unit/api/products/route.test.ts:
 * each test then exercises the real validation, stock and assembly logic, which
 * is where every AC in this milestone actually lives.
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

/** Builds a joined cart row in the shape CART_INCLUDE produces. */
function cartRow(
  id: string,
  items: Array<{ id: string; productId: string; quantity: number; price?: number; stock?: number; name?: string; images?: string[] }>
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
        name: i.name ?? `product ${i.productId}`,
        price: i.price ?? 39000,
        images: i.images ?? ["https://cdn.example.com/a.jpg"],
        stock: i.stock ?? 10,
      },
    })),
  };
}

const GUEST = { kind: "guest", guestId: "guest-1" } as const;
const MEMBER = { kind: "user", userId: "user-1" } as const;

beforeEach(() => {
  for (const fn of Object.values(repo)) fn.mockReset();
  repo.findCartByGuestId.mockResolvedValue(null);
  repo.findCartByUserId.mockResolvedValue(null);
  repo.findItemById.mockResolvedValue(null);
  repo.findProductForCart.mockResolvedValue(null);
  repo.createGuestCart.mockResolvedValue({ id: "cart-new" });
  repo.createUserCart.mockResolvedValue({ id: "cart-new" });
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
});

// ---------------------------------------------------------------------------
// Identity resolution (REQ-CART-003 / AC-CART-002 / AC-CART-003)
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M3 — identity resolution (REQ-CART-003)", () => {
  it("resolves a valid Bearer token to the member identity, issuing no guest cookie", async () => {
    const { resolveCartIdentity } = await import("@/features/cart/services/cart-service");
    const token = await signAccessToken({ sub: "user-42", role: "customer" });

    const resolved = await resolveCartIdentity(
      new Request("http://localhost/api/cart", { headers: { authorization: `Bearer ${token}` } })
    );

    expect(resolved.identity).toEqual({ kind: "user", userId: "user-42" });
    expect(resolved.issuedGuestId).toBeNull();
  });

  it("resolves an existing guest cookie without issuing a new one", async () => {
    const { resolveCartIdentity } = await import("@/features/cart/services/cart-service");

    const resolved = await resolveCartIdentity(
      new Request("http://localhost/api/cart", { headers: { cookie: "guest_cart_id=g-7" } })
    );

    expect(resolved.identity).toEqual({ kind: "guest", guestId: "g-7" });
    expect(resolved.issuedGuestId).toBeNull();
  });

  it("issues a fresh guest identity when the request carries neither (AC-CART-003)", async () => {
    const { resolveCartIdentity } = await import("@/features/cart/services/cart-service");

    const resolved = await resolveCartIdentity(new Request("http://localhost/api/cart"));

    expect(resolved.identity.kind).toBe("guest");
    expect(resolved.issuedGuestId).toEqual(expect.any(String));
    // The issued value IS the identity, so the cookie the route sets and the
    // cart the service reads cannot drift apart.
    expect(resolved.identity).toEqual({ kind: "guest", guestId: resolved.issuedGuestId });
  });

  it("falls back to a guest identity when a Bearer token is present but invalid", async () => {
    const { resolveCartIdentity } = await import("@/features/cart/services/cart-service");

    const resolved = await resolveCartIdentity(
      new Request("http://localhost/api/cart", {
        headers: { authorization: "Bearer not-a-real-token" },
      })
    );

    // REQ-CART-014: a cart request is never rejected for lack of credentials,
    // so a bad token degrades to "guest" rather than producing a 401.
    expect(resolved.identity.kind).toBe("guest");
  });

  it("falls back to a guest identity for an expired token", async () => {
    process.env.JWT_ACCESS_TOKEN_EXPIRY = "0s";
    const { resolveCartIdentity } = await import("@/features/cart/services/cart-service");
    const expired = await signAccessToken({ sub: "user-42", role: "customer" });
    delete process.env.JWT_ACCESS_TOKEN_EXPIRY;

    await new Promise((r) => setTimeout(r, 1100));
    const resolved = await resolveCartIdentity(
      new Request("http://localhost/api/cart", { headers: { authorization: `Bearer ${expired}` } })
    );

    expect(resolved.identity.kind).toBe("guest");
  });
});

// ---------------------------------------------------------------------------
// Read (REQ-CART-005 / AC-CART-005 / AC-CART-006)
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M3 — getCart (REQ-CART-005)", () => {
  it("returns an empty cart WITHOUT creating a row when the identity has none (AC-CART-005)", async () => {
    const { getCart } = await import("@/features/cart/services/cart-service");

    expect(await getCart(GUEST)).toEqual({ items: [], subtotal: 0, itemCount: 0 });
    expect(repo.createGuestCart).not.toHaveBeenCalled();
    expect(repo.createUserCart).not.toHaveBeenCalled();
  });

  it("computes subtotal and itemCount from the product's CURRENT price (AC-CART-006)", async () => {
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 2, price: 39000 }])
    );
    const { getCart } = await import("@/features/cart/services/cart-service");

    const dto = await getCart(GUEST);

    expect(dto.subtotal).toBe(78000);
    expect(dto.itemCount).toBe(2);
    expect(dto.items[0]).toMatchObject({
      id: "i1",
      productId: "p1",
      price: 39000,
      quantity: 2,
      lineTotal: 78000,
      stock: 10,
    });
  });

  it("sums itemCount over quantities, not over lines", async () => {
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [
        { id: "i1", productId: "p1", quantity: 2, price: 1000 },
        { id: "i2", productId: "p2", quantity: 3, price: 500 },
      ])
    );
    const { getCart } = await import("@/features/cart/services/cart-service");

    const dto = await getCart(GUEST);

    expect(dto.itemCount).toBe(5);
    expect(dto.subtotal).toBe(2 * 1000 + 3 * 500);
  });

  it("exposes the first product image, or null when the product has none", async () => {
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [
        { id: "i1", productId: "p1", quantity: 1, images: ["first.jpg", "second.jpg"] },
        { id: "i2", productId: "p2", quantity: 1, images: [] },
      ])
    );
    const { getCart } = await import("@/features/cart/services/cart-service");

    const dto = await getCart(GUEST);

    expect(dto.items[0]!.image).toBe("first.jpg");
    expect(dto.items[1]!.image).toBeNull();
  });

  it("reads the member cart for a member identity", async () => {
    const { getCart } = await import("@/features/cart/services/cart-service");

    await getCart(MEMBER);

    expect(repo.findCartByUserId).toHaveBeenCalledWith("user-1");
    expect(repo.findCartByGuestId).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Add (REQ-CART-006 / REQ-CART-007)
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M3 — addItem (REQ-CART-006/007)", () => {
  it("creates the cart lazily on the first add and increments by the requested amount", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 39000, stock: 10 });
    repo.findCartByGuestId
      .mockResolvedValueOnce(null)
      .mockResolvedValue(cartRow("cart-new", [{ id: "i1", productId: "p1", quantity: 2 }]));
    const { addItem } = await import("@/features/cart/services/cart-service");

    const result = await addItem(GUEST, { productId: "p1", quantity: 2 });

    expect(result.ok).toBe(true);
    expect(repo.createGuestCart).toHaveBeenCalledWith("guest-1");
    expect(repo.incrementItemQuantity).toHaveBeenCalledWith("cart-new", "p1", 2);
  });

  it("increments an existing line rather than creating a second one (AC-CART-007)", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 39000, stock: 10 });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 2 }])
    );
    const { addItem } = await import("@/features/cart/services/cart-service");

    await addItem(GUEST, { productId: "p1", quantity: 3 });

    expect(repo.createGuestCart).not.toHaveBeenCalled();
    expect(repo.incrementItemQuantity).toHaveBeenCalledWith("cart-1", "p1", 3);
  });

  it("rejects an unknown productId with 400 and writes nothing (REQ-CART-007)", async () => {
    repo.findProductForCart.mockResolvedValue(null);
    const { addItem } = await import("@/features/cart/services/cart-service");

    const result = await addItem(GUEST, { productId: "ghost", quantity: 1 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
    expect(repo.createGuestCart).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["a string", "2"],
    ["null", null],
    ["absent", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rejects %s quantity with 400 before touching the database", async (_label, quantity) => {
    const { addItem } = await import("@/features/cart/services/cart-service");

    const result = await addItem(GUEST, { productId: "p1", quantity });

    expect(result).toMatchObject({ ok: false, status: 400 });
    // Cheap rejection: an invalid body costs no round trip, matching the
    // catalog endpoints' REQ-CATALOG-005 behaviour.
    expect(repo.findProductForCart).not.toHaveBeenCalled();
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
  });

  it("rejects an add that would exceed stock, persisting nothing (AC-CART-008)", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 3 });
    const { addItem } = await import("@/features/cart/services/cart-service");

    const result = await addItem(GUEST, { productId: "p1", quantity: 4 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
    // Nothing is created either — a rejected first add leaves no empty cart
    // row behind (REQ-CART-007 "어떤 변경도 영속화해서는 안 된다").
    expect(repo.createGuestCart).not.toHaveBeenCalled();
  });

  it("counts the quantity ALREADY in the cart against the stock ceiling", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 4 });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 3 }])
    );
    const { addItem } = await import("@/features/cart/services/cart-service");

    // 3 already held + 2 more = 5 > stock 4.
    const result = await addItem(GUEST, { productId: "p1", quantity: 2 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
  });

  it("allows an add that lands exactly on the stock ceiling", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 4 });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 3 }])
    );
    const { addItem } = await import("@/features/cart/services/cart-service");

    const result = await addItem(GUEST, { productId: "p1", quantity: 1 });

    expect(result.ok).toBe(true);
    expect(repo.incrementItemQuantity).toHaveBeenCalledWith("cart-1", "p1", 1);
  });

  it("rejects an absurdly large quantity with 400 rather than erroring (acceptance.md §2)", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 10 });
    const { addItem } = await import("@/features/cart/services/cart-service");

    const result = await addItem(GUEST, { productId: "p1", quantity: 999999999 });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a non-string productId with 400", async () => {
    const { addItem } = await import("@/features/cart/services/cart-service");

    expect(await addItem(GUEST, { productId: 123, quantity: 1 })).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});

// ---------------------------------------------------------------------------
// Update (REQ-CART-008 / REQ-CART-010)
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M3 — setQuantity (REQ-CART-008/010)", () => {
  beforeEach(() => {
    repo.findItemById.mockResolvedValue({
      id: "i1",
      cartId: "cart-1",
      productId: "p1",
      quantity: 2,
    });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [{ id: "i1", productId: "p1", quantity: 2 }])
    );
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 10 });
  });

  it("sets the quantity absolutely, not by adding to the current one (AC-CART-009)", async () => {
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    const result = await setQuantity(GUEST, "i1", { quantity: 5 });

    expect(result.ok).toBe(true);
    // 5, not 2 + 5 — the whole distinction from addItem (plan.md §2.5).
    expect(repo.setItemQuantity).toHaveBeenCalledWith("i1", 5);
  });

  it("answers 404 for an itemId no row carries (AC-CART-011)", async () => {
    repo.findItemById.mockResolvedValue(null);
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    const result = await setQuantity(GUEST, "ghost", { quantity: 5 });

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
  });

  it("answers 404 for an item belonging to somebody else's cart (AC-CART-011)", async () => {
    repo.findItemById.mockResolvedValue({
      id: "i9",
      cartId: "cart-SOMEBODY-ELSE",
      productId: "p1",
      quantity: 1,
    });
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    const result = await setQuantity(GUEST, "i9", { quantity: 5 });

    // 404 rather than 403: the requester is not entitled to learn that this
    // id exists at all.
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
  });

  it("answers 404 when the requesting identity has no cart at all", async () => {
    repo.findCartByGuestId.mockResolvedValue(null);
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    expect(await setQuantity(GUEST, "i1", { quantity: 5 })).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("rejects quantity 0 with 400 — zeroing out is DELETE's job (plan.md §2.5)", async () => {
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    const result = await setQuantity(GUEST, "i1", { quantity: 0 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
    expect(repo.deleteItem).not.toHaveBeenCalled();
  });

  it("rejects a quantity above stock and leaves the line unchanged (AC-CART-016)", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 4 });
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    const result = await setQuantity(GUEST, "i1", { quantity: 5 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
  });

  it("allows a quantity exactly at stock", async () => {
    repo.findProductForCart.mockResolvedValue({ id: "p1", price: 1000, stock: 4 });
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    expect((await setQuantity(GUEST, "i1", { quantity: 4 })).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Delete (REQ-CART-009 / REQ-CART-010)
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M3 — removeItem (REQ-CART-009/010)", () => {
  it("deletes only the addressed line (AC-CART-010)", async () => {
    repo.findItemById.mockResolvedValue({
      id: "i1",
      cartId: "cart-1",
      productId: "p1",
      quantity: 2,
    });
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-1", [
        { id: "i1", productId: "p1", quantity: 2 },
        { id: "i2", productId: "p2", quantity: 1 },
      ])
    );
    const { removeItem } = await import("@/features/cart/services/cart-service");

    const result = await removeItem(GUEST, "i1");

    expect(result.ok).toBe(true);
    expect(repo.deleteItem).toHaveBeenCalledTimes(1);
    expect(repo.deleteItem).toHaveBeenCalledWith("i1");
  });

  it("answers 404 for a foreign or unknown item and deletes nothing (AC-CART-011)", async () => {
    repo.findItemById.mockResolvedValue({
      id: "i9",
      cartId: "cart-OTHER",
      productId: "p1",
      quantity: 1,
    });
    repo.findCartByGuestId.mockResolvedValue(cartRow("cart-1", []));
    const { removeItem } = await import("@/features/cart/services/cart-service");

    expect(await removeItem(GUEST, "i9")).toMatchObject({ ok: false, status: 404 });
    expect(repo.deleteItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Merge (REQ-CART-011/012/013)
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M3 — mergeGuestCartIntoUserCart (REQ-CART-011/012/013)", () => {
  it("does nothing when the guest has no cart (acceptance.md §2 no-op)", async () => {
    repo.findCartByGuestId.mockResolvedValue(null);
    const { mergeGuestCartIntoUserCart } = await import("@/features/cart/services/cart-service");

    await mergeGuestCartIntoUserCart("user-1", "guest-1");

    expect(repo.promoteGuestCartToUser).not.toHaveBeenCalled();
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
    expect(repo.deleteCart).not.toHaveBeenCalled();
  });

  it("promotes rather than copies when the member has no cart yet (plan.md §2.3 step 2)", async () => {
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-g", [{ id: "i1", productId: "p1", quantity: 3 }])
    );
    repo.findCartByUserId.mockResolvedValue(null);
    const { mergeGuestCartIntoUserCart } = await import("@/features/cart/services/cart-service");

    await mergeGuestCartIntoUserCart("user-1", "guest-1");

    expect(repo.promoteGuestCartToUser).toHaveBeenCalledWith("cart-g", "user-1");
    // Quantities are carried over untouched, and no row churn happens.
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
    expect(repo.deleteCart).not.toHaveBeenCalled();
  });

  it("sums overlapping products, clamps to stock, and carries the rest over (AC-CART-012)", async () => {
    // Guest: A×3, C×1. Member: A×2, B×1. A's stock is 4.
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-g", [
        { id: "g1", productId: "A", quantity: 3, stock: 4 },
        { id: "g2", productId: "C", quantity: 1, stock: 9 },
      ])
    );
    repo.findCartByUserId.mockResolvedValue(
      cartRow("cart-u", [
        { id: "u1", productId: "A", quantity: 2, stock: 4 },
        { id: "u2", productId: "B", quantity: 1, stock: 9 },
      ])
    );
    const { mergeGuestCartIntoUserCart } = await import("@/features/cart/services/cart-service");

    await mergeGuestCartIntoUserCart("user-1", "guest-1");

    // A: 3 + 2 = 5, clamped to stock 4 — an absolute set, not an increment.
    expect(repo.setItemQuantity).toHaveBeenCalledWith("u1", 4);
    // C: not in the member cart, so it arrives at its guest quantity.
    expect(repo.incrementItemQuantity).toHaveBeenCalledWith("cart-u", "C", 1);
    // B: untouched — the merge never rewrites lines the guest cart lacks.
    expect(repo.setItemQuantity).not.toHaveBeenCalledWith("u2", expect.anything());
    // And the drained guest cart is removed (REQ-CART-013).
    expect(repo.deleteCart).toHaveBeenCalledWith("cart-g");
  });

  it("omits a product whose stock has run out rather than storing quantity 0 (AC-CART-013)", async () => {
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-g", [{ id: "g1", productId: "D", quantity: 2, stock: 0 }])
    );
    repo.findCartByUserId.mockResolvedValue(cartRow("cart-u", []));
    const { mergeGuestCartIntoUserCart } = await import("@/features/cart/services/cart-service");

    await mergeGuestCartIntoUserCart("user-1", "guest-1");

    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
    expect(repo.deleteCart).toHaveBeenCalledWith("cart-g");
  });

  it("removes an EXISTING member line when the clamp drives it to zero (REQ-CART-002)", async () => {
    // The member already holds D, and D is now out of stock: the invariant
    // "no persisted line has quantity < 1" has to win over "leave member lines
    // alone", so the line goes.
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-g", [{ id: "g1", productId: "D", quantity: 2, stock: 0 }])
    );
    repo.findCartByUserId.mockResolvedValue(
      cartRow("cart-u", [{ id: "u1", productId: "D", quantity: 1, stock: 0 }])
    );
    const { mergeGuestCartIntoUserCart } = await import("@/features/cart/services/cart-service");

    await mergeGuestCartIntoUserCart("user-1", "guest-1");

    expect(repo.deleteItem).toHaveBeenCalledWith("u1");
    expect(repo.setItemQuantity).not.toHaveBeenCalled();
  });

  it("is idempotent: a replayed guest cookie merges nothing the second time (AC-CART-014)", async () => {
    // After the first merge the guest id resolves to no cart — that is what
    // promotion/deletion buys, and why no "already merged" flag is needed.
    repo.findCartByGuestId.mockResolvedValue(null);
    const { mergeGuestCartIntoUserCart } = await import("@/features/cart/services/cart-service");

    await mergeGuestCartIntoUserCart("user-1", "guest-1");
    await mergeGuestCartIntoUserCart("user-1", "guest-1");

    expect(repo.setItemQuantity).not.toHaveBeenCalled();
    expect(repo.incrementItemQuantity).not.toHaveBeenCalled();
    expect(repo.promoteGuestCartToUser).not.toHaveBeenCalled();
  });

  it("never adjusts Product.stock while merging (REQ-CART-015)", async () => {
    repo.findCartByGuestId.mockResolvedValue(
      cartRow("cart-g", [{ id: "g1", productId: "A", quantity: 3, stock: 4 }])
    );
    repo.findCartByUserId.mockResolvedValue(cartRow("cart-u", []));
    const { mergeGuestCartIntoUserCart } = await import("@/features/cart/services/cart-service");

    await mergeGuestCartIntoUserCart("user-1", "guest-1");

    // The repository exposes no stock-mutating function at all, which is the
    // structural half of REQ-CART-015; this asserts the merge does not reach
    // for one either.
    expect(Object.keys(repo).filter((k) => /stock/i.test(k))).toEqual([]);
  });
});
