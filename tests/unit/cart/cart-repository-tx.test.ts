import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * SPEC-ORDER-001 M2 — the ONE exception plan.md §4.1 opens in the cart domain.
 *
 * The order transaction must read the guest cart and delete it INSIDE the
 * transaction (design.md §2 steps 1 and 6). The cart repository's functions are
 * bound to the module Prisma singleton, so the alternatives were to duplicate
 * the ownership query in the order domain or to let these two functions accept
 * a client. Duplication was rejected: cart-repository.ts declares itself the
 * single fan-in point for cart ownership queries, and a second copy of
 * `where: { guestId }` forks an authorization surface (design.md §2.1).
 *
 * This suite is the mechanical boundary on that exception. It asserts what the
 * change IS (two functions gain an optional client) and — more importantly —
 * what it is NOT: no other function gains one, and every existing call site
 * keeps working untouched because the parameter is optional.
 */

const singleton = {
  cart: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn(), update: vi.fn() },
  cartItem: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  product: { findUnique: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: singleton }));

/**
 * A stand-in for the client `prisma.$transaction` hands its callback. Each mock
 * declares its argument through vi.fn's TYPE PARAMETER so `mock.calls[0]` is a
 * non-empty tuple under `noUncheckedIndexedAccess`, without an unused
 * implementation parameter that no-unused-vars would reject.
 */
type CartTxCall<T> = (args: unknown) => Promise<T>;

function fakeTx() {
  return {
    cart: {
      findUnique: vi.fn<CartTxCall<{ id: string; items: [] }>>(async () => ({
        id: "cart-tx",
        items: [],
      })),
      delete: vi.fn<CartTxCall<{ id: string }>>(async () => ({ id: "cart-tx" })),
    },
  };
}

const repo = await import("@/features/cart/repositories/cart-repository");
const SOURCE = readFileSync("src/features/cart/repositories/cart-repository.ts", "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  singleton.cart.findUnique.mockResolvedValue(null);
  singleton.cart.delete.mockResolvedValue({ id: "cart-1" });
});

describe("SPEC-ORDER-001 §4.1 — findCartByGuestId accepts a transaction client", () => {
  it("still defaults to the module singleton, so existing callers are unchanged", async () => {
    await repo.findCartByGuestId("G1");

    expect(singleton.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guestId: "G1" } })
    );
  });

  it("runs the query on the given client instead", async () => {
    const tx = fakeTx();
    await repo.findCartByGuestId("G1", tx as never);

    expect(tx.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guestId: "G1" } })
    );
    expect(singleton.cart.findUnique).not.toHaveBeenCalled();
  });

  it("keeps the same projection on both paths — behaviour is unchanged", async () => {
    const tx = fakeTx();
    await repo.findCartByGuestId("G1");
    await repo.findCartByGuestId("G1", tx as never);

    const viaSingleton = singleton.cart.findUnique.mock.calls[0]![0];
    const viaTx = tx.cart.findUnique.mock.calls[0]![0];
    expect(viaTx).toEqual(viaSingleton);
  });
});

describe("SPEC-ORDER-004 §6.1 — findCartByUserId accepts a transaction client", () => {
  it("still defaults to the module singleton, so cart-service.ts is unchanged", async () => {
    await repo.findCartByUserId("user-1");

    expect(singleton.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("runs the query on the given client instead", async () => {
    const tx = fakeTx();
    await repo.findCartByUserId("user-1", tx as never);

    expect(tx.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
    expect(singleton.cart.findUnique).not.toHaveBeenCalled();
  });

  it("keeps the same projection on both paths — behaviour is unchanged", async () => {
    const tx = fakeTx();
    await repo.findCartByUserId("user-1");
    await repo.findCartByUserId("user-1", tx as never);

    const viaSingleton = singleton.cart.findUnique.mock.calls[0]![0];
    const viaTx = tx.cart.findUnique.mock.calls[0]![0];
    expect(viaTx).toEqual(viaSingleton);
  });
});

describe("SPEC-ORDER-001 §4.1 — deleteCart accepts a transaction client", () => {
  it("still defaults to the module singleton", async () => {
    await repo.deleteCart("cart-1");

    expect(singleton.cart.delete).toHaveBeenCalledWith({ where: { id: "cart-1" } });
  });

  it("runs the delete on the given client instead", async () => {
    const tx = fakeTx();
    await repo.deleteCart("cart-1", tx as never);

    expect(tx.cart.delete).toHaveBeenCalledWith({ where: { id: "cart-1" } });
    expect(singleton.cart.delete).not.toHaveBeenCalled();
  });
});

describe("SPEC-ORDER-001 §4.1 — the exception does not widen", () => {
  /** The parameter list of `export async function <name>(...)` in the source. */
  function paramsOf(name: string): string {
    const match = SOURCE.match(new RegExp(`export async function ${name}\\(([\\s\\S]*?)\\)\\s*:`));
    if (!match) throw new Error(`${name} not found in cart-repository.ts`);
    return match[1]!;
  }

  it("opens exactly the two functions plan.md §4.1 names", () => {
    expect(paramsOf("findCartByGuestId")).toMatch(/client/);
    expect(paramsOf("deleteCart")).toMatch(/client/);
  });

  it("opens findCartByUserId too — SPEC-ORDER-004's second exception", () => {
    // SPEC-ORDER-001 asserted the OPPOSITE here, and correctly so: member
    // checkout was out of scope, so opening an invariant for a function that
    // SPEC never called would have widened the hole for nothing.
    //
    // SPEC-ORDER-004 is what makes the member path real. Its order transaction
    // reads and empties the MEMBER cart inside the transaction, which is the
    // identical argument that opened the first two (design.md §6.1). The
    // property this suite exists to hold is "the exception does not widen
    // SILENTLY" — not "the list is frozen at two" — so the list is updated in
    // step with the SPEC that widens it, and the next assertion is what keeps
    // the widening bounded.
    expect(paramsOf("findCartByUserId")).toMatch(/client/);
  });

  it("leaves every other function's signature untouched", () => {
    for (const name of [
      "createUserCart",
      "createGuestCart",
      "findProductForCart",
      "findItemById",
      "incrementItemQuantity",
      "setItemQuantity",
      "deleteItem",
      "promoteGuestCartToUser",
    ]) {
      expect(paramsOf(name)).not.toMatch(/client/);
    }
  });

  it("adds the client as an OPTIONAL trailing parameter, never a required one", () => {
    // This is what makes "existing call sites diff 0 lines" true rather than
    // merely intended — a required parameter would break every caller.
    expect(paramsOf("findCartByGuestId")).toMatch(/client\s*:\s*[^=]+=\s*prisma/);
    expect(paramsOf("deleteCart")).toMatch(/client\s*:\s*[^=]+=\s*prisma/);
    // SPEC-ORDER-004 M3 — the same shape, which is what keeps cart-service.ts
    // at zero changed lines (plan.md M3 DoD).
    expect(paramsOf("findCartByUserId")).toMatch(/client\s*:\s*[^=]+=\s*prisma/);
  });
});
