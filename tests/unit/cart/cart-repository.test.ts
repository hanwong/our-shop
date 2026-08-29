import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CART-001 M2 — src/features/cart/repositories/cart-repository.ts
 *
 * Traces: REQ-CART-001 (ownership), REQ-CART-006 (add-is-increment via
 * upsert), REQ-CART-008 (absolute set), REQ-CART-009 (delete one item),
 * REQ-CART-013 (promotion / deletion of the merged guest cart), plan.md §2.1
 * (the XOR held by exposing only two construction paths).
 *
 * No live PostgreSQL in this sandbox — @/lib/db is mocked at the delegate
 * level, the same seam tests/unit/api/auth/login.test.ts already mocks. These
 * tests assert the SHAPE of the Prisma calls the repository issues, which is
 * what is verifiable without a database; that the resulting SQL behaves as
 * expected against a real server is recorded as a gap in progress.md §E.2.
 */

const cart = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const cartItem = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/lib/db", () => ({ prisma: { cart, cartItem } }));

beforeEach(() => {
  for (const fn of [...Object.values(cart), ...Object.values(cartItem)]) fn.mockReset();
  cart.findUnique.mockResolvedValue(null);
  cart.create.mockResolvedValue({ id: "cart-1", userId: null, guestId: null });
  cartItem.findUnique.mockResolvedValue(null);
});

describe("SPEC-CART-001 M2 — cart construction holds the ownership XOR (plan.md §2.1)", () => {
  it("createUserCart writes userId and leaves guestId unset", async () => {
    const { createUserCart } = await import("@/features/cart/repositories/cart-repository");

    await createUserCart("user-1");

    expect(cart.create).toHaveBeenCalledTimes(1);
    const { data } = cart.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.userId).toBe("user-1");
    expect(data.guestId).toBeUndefined();
  });

  it("createGuestCart writes guestId and leaves userId unset", async () => {
    const { createGuestCart } = await import("@/features/cart/repositories/cart-repository");

    await createGuestCart("guest-1");

    const { data } = cart.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.guestId).toBe("guest-1");
    expect(data.userId).toBeUndefined();
  });

  it("exposes no construction path that could set both owners or neither", async () => {
    const repo = await import("@/features/cart/repositories/cart-repository");

    const creators = Object.keys(repo).filter((k) => /^create/.test(k));
    expect(creators.sort()).toEqual(["createGuestCart", "createUserCart"]);
  });
});

describe("SPEC-CART-001 M2 — cart lookup", () => {
  it("findCartByUserId queries on userId and includes items joined to their product", async () => {
    const { findCartByUserId } = await import("@/features/cart/repositories/cart-repository");

    await findCartByUserId("user-9");

    const arg = cart.findUnique.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ userId: "user-9" });
    // The live price join (plan.md §2.4) requires the product on every item.
    expect(JSON.stringify(arg)).toContain("product");
  });

  it("findCartByGuestId queries on guestId", async () => {
    const { findCartByGuestId } = await import("@/features/cart/repositories/cart-repository");

    await findCartByGuestId("guest-9");

    const arg = cart.findUnique.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ guestId: "guest-9" });
  });

  it("returns null when the identity has no cart row (lazy creation, plan.md §2.6)", async () => {
    cart.findUnique.mockResolvedValue(null);
    const { findCartByGuestId } = await import("@/features/cart/repositories/cart-repository");

    expect(await findCartByGuestId("guest-none")).toBeNull();
    expect(cart.create).not.toHaveBeenCalled();
  });
});

describe("SPEC-CART-001 M2 — add is increment (REQ-CART-006)", () => {
  it("upserts on the (cartId, productId) pair, incrementing on conflict", async () => {
    const { incrementItemQuantity } = await import("@/features/cart/repositories/cart-repository");

    await incrementItemQuantity("cart-1", "prod-1", 3);

    expect(cartItem.upsert).toHaveBeenCalledTimes(1);
    const arg = cartItem.upsert.mock.calls[0]![0] as {
      where: { cartId_productId: { cartId: string; productId: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(arg.where.cartId_productId).toEqual({ cartId: "cart-1", productId: "prod-1" });
    // A fresh line starts at the requested amount ...
    expect(arg.create).toMatchObject({ cartId: "cart-1", productId: "prod-1", quantity: 3 });
    // ... and an existing one is incremented ATOMICALLY by the database, not
    // read-modify-written in application code, which is what keeps two
    // concurrent adds from losing one of the two (plan.md §8).
    expect(arg.update).toEqual({ quantity: { increment: 3 } });
  });
});

describe("SPEC-CART-001 M2 — quantity change is an absolute set (REQ-CART-008)", () => {
  it("writes the requested quantity rather than incrementing by it", async () => {
    const { setItemQuantity } = await import("@/features/cart/repositories/cart-repository");

    await setItemQuantity("item-1", 5);

    const arg = cartItem.update.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "item-1" });
    expect(arg.data).toEqual({ quantity: 5 });
  });
});

describe("SPEC-CART-001 M2 — item lookup and deletion (REQ-CART-009/010)", () => {
  it("findItemById returns the owning cartId so the caller can check ownership", async () => {
    cartItem.findUnique.mockResolvedValue({
      id: "item-1",
      cartId: "cart-1",
      productId: "prod-1",
      quantity: 2,
    });
    const { findItemById } = await import("@/features/cart/repositories/cart-repository");

    const row = await findItemById("item-1");

    expect(cartItem.findUnique.mock.calls[0]![0]).toMatchObject({ where: { id: "item-1" } });
    expect(row).toMatchObject({ id: "item-1", cartId: "cart-1" });
  });

  it("findItemById returns null for an unknown id", async () => {
    cartItem.findUnique.mockResolvedValue(null);
    const { findItemById } = await import("@/features/cart/repositories/cart-repository");

    expect(await findItemById("nope")).toBeNull();
  });

  it("deleteItem removes exactly the one row by id", async () => {
    const { deleteItem } = await import("@/features/cart/repositories/cart-repository");

    await deleteItem("item-1");

    expect(cartItem.delete).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });
});

describe("SPEC-CART-001 M2 — merge support (REQ-CART-013, plan.md §2.3)", () => {
  it("promoteGuestCartToUser transfers ownership instead of copying rows", async () => {
    const { promoteGuestCartToUser } = await import("@/features/cart/repositories/cart-repository");

    await promoteGuestCartToUser("cart-guest", "user-1");

    const arg = cart.update.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "cart-guest" });
    // Both halves matter: claiming the cart for the member AND releasing the
    // guest id, which is what makes the old cookie stop resolving (REQ-CART-013)
    // and therefore makes a repeat merge a no-op.
    expect(arg.data).toEqual({ userId: "user-1", guestId: null });
    // No item rows are touched — the whole point of promotion (plan.md §2.3).
    expect(cartItem.upsert).not.toHaveBeenCalled();
    expect(cartItem.delete).not.toHaveBeenCalled();
  });

  it("deleteCart removes the cart, relying on the FK cascade for its items", async () => {
    const { deleteCart } = await import("@/features/cart/repositories/cart-repository");

    await deleteCart("cart-guest");

    expect(cart.delete).toHaveBeenCalledWith({ where: { id: "cart-guest" } });
  });
});
