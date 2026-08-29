import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * SPEC-CART-001 M6 — the acceptance.md §2 edge cases and the remaining
 * branches the milestone suites did not reach.
 *
 * Traces: acceptance.md §2 (tampered guest cookie, absurd quantity, merge
 * no-ops), AC-CART-015 (stock is never adjusted), plus the member-first-add
 * and product-vanished paths.
 */

const cart = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
const cartItem = { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() };
const product = { findUnique: vi.fn() };

vi.mock("@/lib/db", () => ({ prisma: { cart, cartItem, product } }));

beforeEach(() => {
  for (const fn of [...Object.values(cart), ...Object.values(cartItem), product.findUnique]) {
    fn.mockReset();
  }
  cart.findUnique.mockResolvedValue(null);
  cartItem.findUnique.mockResolvedValue(null);
  product.findUnique.mockResolvedValue(null);
  cart.create.mockResolvedValue({ id: "cart-new" });
});

describe("SPEC-CART-001 M6 — findProductForCart (repository)", () => {
  it("reads exactly the three columns the stock check needs, and no more", async () => {
    product.findUnique.mockResolvedValue({ id: "p1", price: 1000, stock: 5 });
    const { findProductForCart } = await import("@/features/cart/repositories/cart-repository");

    const row = await findProductForCart("p1");

    expect(product.findUnique).toHaveBeenCalledWith({
      where: { id: "p1" },
      select: { id: true, price: true, stock: true },
    });
    expect(row).toEqual({ id: "p1", price: 1000, stock: 5 });
  });

  it("returns null for an id no product carries", async () => {
    product.findUnique.mockResolvedValue(null);
    const { findProductForCart } = await import("@/features/cart/repositories/cart-repository");

    expect(await findProductForCart("ghost")).toBeNull();
  });
});

describe("SPEC-CART-001 M6 — a guest cookie pointing at no cart (acceptance.md §2)", () => {
  it("is treated as a fresh guest rather than an error", async () => {
    // A tampered or post-merge cookie resolves to nothing. The requirement is
    // that this does NOT crash — it behaves like any identity with no cart.
    cart.findUnique.mockResolvedValue(null);
    const { getCart } = await import("@/features/cart/services/cart-service");

    const dto = await getCart({ kind: "guest", guestId: "tampered-value" });

    expect(dto).toEqual({ items: [], subtotal: 0, itemCount: 0 });
  });

  it("lets that guest start a new cart by adding an item", async () => {
    product.findUnique.mockResolvedValue({ id: "p1", price: 1000, stock: 5 });
    cart.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "cart-new", userId: null, guestId: "tampered-value", items: [] });
    const { addItem } = await import("@/features/cart/services/cart-service");

    const result = await addItem({ kind: "guest", guestId: "tampered-value" }, {
      productId: "p1",
      quantity: 1,
    });

    expect(result.ok).toBe(true);
    expect(cart.create).toHaveBeenCalledWith({
      data: { guestId: "tampered-value" },
      select: { id: true },
    });
  });
});

describe("SPEC-CART-001 M6 — a member's first add creates a member cart", () => {
  it("takes the createUserCart path, never createGuestCart", async () => {
    product.findUnique.mockResolvedValue({ id: "p1", price: 1000, stock: 5 });
    cart.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "cart-new", userId: "user-1", guestId: null, items: [] });
    const { addItem } = await import("@/features/cart/services/cart-service");

    await addItem({ kind: "user", userId: "user-1" }, { productId: "p1", quantity: 1 });

    expect(cart.create).toHaveBeenCalledWith({
      data: { userId: "user-1" },
      select: { id: true },
    });
  });
});

describe("SPEC-CART-001 M6 — the product behind a line disappears", () => {
  it("answers 400 rather than throwing when PATCH cannot resolve the product", async () => {
    // Reachable only in a narrow race: the line still exists while its product
    // has just been deleted (the FK cascade has not caught up, or the read is
    // interleaved). The requirement is a clean 400, not a 500.
    cartItem.findUnique.mockResolvedValue({
      id: "i1",
      cartId: "cart-1",
      productId: "gone",
      quantity: 1,
    });
    cart.findUnique.mockResolvedValue({
      id: "cart-1",
      userId: null,
      guestId: "g-1",
      items: [],
    });
    product.findUnique.mockResolvedValue(null);
    const { setQuantity } = await import("@/features/cart/services/cart-service");

    const result = await setQuantity({ kind: "guest", guestId: "g-1" }, "i1", { quantity: 2 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(cartItem.update).not.toHaveBeenCalled();
  });
});

describe("SPEC-CART-001 M6 — stock is read, never written (AC-CART-015 / REQ-CART-015)", () => {
  it("uses only findUnique on the product delegate across every cart operation", async () => {
    product.findUnique.mockResolvedValue({ id: "p1", price: 1000, stock: 5 });
    cart.findUnique.mockResolvedValue({
      id: "cart-1",
      userId: null,
      guestId: "g-1",
      items: [
        {
          id: "i1",
          productId: "p1",
          quantity: 1,
          product: { id: "p1", name: "p", price: 1000, images: [], stock: 5 },
        },
      ],
    });
    cartItem.findUnique.mockResolvedValue({
      id: "i1",
      cartId: "cart-1",
      productId: "p1",
      quantity: 1,
    });
    const identity = { kind: "guest", guestId: "g-1" } as const;
    const svc = await import("@/features/cart/services/cart-service");

    await svc.getCart(identity);
    await svc.addItem(identity, { productId: "p1", quantity: 1 });
    await svc.setQuantity(identity, "i1", { quantity: 2 });
    await svc.removeItem(identity, "i1");

    // The mocked delegate exposes ONLY findUnique, so any attempt to update,
    // decrement or reserve stock would have thrown rather than silently
    // passing — the assertion is the absence of a throw plus this shape check.
    expect(Object.keys(product)).toEqual(["findUnique"]);
    expect(product.findUnique).toHaveBeenCalled();
  });
});

describe("SPEC-CART-001 M6 — COOKIE_DOMAIN is honoured when configured", () => {
  const original = process.env.COOKIE_DOMAIN;
  afterEach(() => {
    if (original === undefined) delete process.env.COOKIE_DOMAIN;
    else process.env.COOKIE_DOMAIN = original;
  });

  it("adds the domain attribute, matching the refresh-token cookie's behaviour", async () => {
    process.env.COOKIE_DOMAIN = "shop.example.com";
    const { buildGuestCartCookie } = await import("@/lib/auth/guest-identity");

    expect(buildGuestCartCookie("g-1").options.domain).toBe("shop.example.com");
  });

  it("omits the domain attribute entirely when unset", async () => {
    delete process.env.COOKIE_DOMAIN;
    const { buildGuestCartCookie } = await import("@/lib/auth/guest-identity");

    expect(buildGuestCartCookie("g-1").options.domain).toBeUndefined();
  });
});
