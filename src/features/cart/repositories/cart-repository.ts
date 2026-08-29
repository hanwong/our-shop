import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * SPEC-CART-001 M2 — Prisma query layer for the cart domain.
 *
 * Traces: REQ-CART-001 (ownership), REQ-CART-006 (add is an increment),
 * REQ-CART-008 (quantity change is an absolute set), REQ-CART-009 (delete one
 * item), REQ-CART-013 (the merged guest cart stops resolving).
 *
 * Like features/catalog/repositories/*, this layer performs NO validation and
 * applies NO defaults — it trusts its arguments. Validation, stock checks and
 * response assembly live one layer up in services/cart-service.ts, so an
 * invalid request is rejected before any database round trip.
 *
 * @MX:ANCHOR fan-in target — every cart mutation and read in the SPEC reaches
 * the database through this module: the four public endpoints via
 * cart-service.ts, and the login-time merge via mergeGuestCartIntoUserCart().
 * @MX:REASON the two construction functions below are what hold the ownership
 * invariant that keeps one shopper's cart separate from another's, so a change
 * here is an authorization-boundary change rather than a query detail.
 */

/**
 * The item projection. `product` is always joined because the cart has no
 * stored price and must read the CURRENT one (plan.md §2.4); `stock` rides
 * along because every mutation validates against it (REQ-CART-007).
 */
const CART_INCLUDE = {
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      product: { select: { id: true, name: true, price: true, images: true, stock: true } },
    },
    // A stable order so the response does not reshuffle between reads for
    // reasons the client cannot see. Insertion order is the least surprising
    // one for a cart; `id` breaks ties within the same millisecond.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;

export interface CartItemLookup {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Construction — the ownership XOR (plan.md §2.1)
//
// These two functions are the ONLY way a Cart row is created. The schema
// leaves both owner columns nullable, so "exactly one owner" cannot be a DB
// constraint here; it is held instead by never writing a shape that violates
// it. Adding a third, general `createCart({ userId?, guestId? })` would
// reintroduce exactly the both-or-neither states these two exclude, which is
// why no such function exists (and why a test asserts it does not).
// ---------------------------------------------------------------------------

/** Creates the cart owned by a member. Never sets `guestId`. */
export async function createUserCart(userId: string): Promise<{ id: string }> {
  return prisma.cart.create({ data: { userId }, select: { id: true } });
}

/** Creates the cart owned by a guest cookie. Never sets `userId`. */
export async function createGuestCart(guestId: string): Promise<{ id: string }> {
  return prisma.cart.create({ data: { guestId }, select: { id: true } });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The member's cart, or null when they have none.
 *
 * Null is an ordinary result, not an error: a cart row is created lazily on
 * the first add (plan.md §2.6), so "no row" is the normal state of an identity
 * that has only ever browsed.
 */
export async function findCartByUserId(userId: string): Promise<CartWithItems | null> {
  return prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
}

/**
 * The guest cookie's cart, or null when it has none.
 *
 * Also returns null for a guest id that no longer resolves — a tampered
 * cookie, or one whose cart was merged away at login. Both are handled as
 * "this identity has no cart yet" rather than as an error (acceptance.md §2).
 */
export async function findCartByGuestId(guestId: string): Promise<CartWithItems | null> {
  return prisma.cart.findUnique({ where: { guestId }, include: CART_INCLUDE });
}

/**
 * The price and stock of one product, or null when no product carries that id.
 *
 * Deliberately a cart-owned query rather than a call into the catalog
 * repository: the cart needs only three columns, while the catalog's
 * projections are shaped for its own list and detail responses. Reaching
 * across would couple this SPEC's stock check to the catalog's response
 * design, so that a later change to a catalog projection could silently break
 * cart validation.
 */
export async function findProductForCart(
  productId: string
): Promise<{ id: string; price: number; stock: number } | null> {
  return prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, price: true, stock: true },
  });
}

/** The item plus its owning cart id, so the caller can verify ownership. */
export async function findItemById(itemId: string): Promise<CartItemLookup | null> {
  return prisma.cartItem.findUnique({
    where: { id: itemId },
    select: { id: true, cartId: true, productId: true, quantity: true },
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Adds `delta` to this cart's line for `productId`, creating the line when it
 * does not exist yet (REQ-CART-006).
 *
 * The increment is expressed as Prisma's `{ increment }` rather than as a read
 * followed by a write. That matters beyond brevity: it makes the update a
 * single atomic UPDATE in the database, so two tabs adding the same product at
 * the same moment produce +1+1 instead of one of them silently overwriting the
 * other with a stale total (plan.md §8's concurrency note).
 */
export async function incrementItemQuantity(
  cartId: string,
  productId: string,
  delta: number
): Promise<void> {
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity: delta },
    update: { quantity: { increment: delta } },
  });
}

/**
 * Sets a line to exactly `quantity` (REQ-CART-008) — an absolute write, NOT an
 * increment. The difference from incrementItemQuantity() above is the whole
 * distinction between POST (add one more) and PATCH (make it this many), and
 * is deliberate per plan.md §2.5.
 */
export async function setItemQuantity(itemId: string, quantity: number): Promise<void> {
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

/** Removes one line, leaving the rest of the cart untouched (REQ-CART-009). */
export async function deleteItem(itemId: string): Promise<void> {
  await prisma.cartItem.delete({ where: { id: itemId } });
}

/**
 * Hands a guest cart to a member: claims it via `userId` and releases
 * `guestId` in the same write (plan.md §2.3 step 2).
 *
 * This is the first-login path, where the member has no cart of their own. It
 * transfers OWNERSHIP rather than copying rows — cheaper, and it means the
 * item ids the shopper's open tab already knows keep working.
 *
 * Clearing `guestId` is what satisfies REQ-CART-013: the old cookie stops
 * resolving to anything, so replaying the same cookie at a later login finds
 * no guest cart and merges nothing. No "already merged" flag is needed.
 */
export async function promoteGuestCartToUser(cartId: string, userId: string): Promise<void> {
  await prisma.cart.update({ where: { id: cartId }, data: { userId, guestId: null } });
}

/**
 * Deletes a cart. Its items go with it via the FK cascade declared on
 * CartItem.cartId, so they are not deleted separately here.
 *
 * Used on the merge path (plan.md §2.3 step 3) once the guest cart's contents
 * have been folded into an existing member cart.
 */
export async function deleteCart(cartId: string): Promise<void> {
  await prisma.cart.delete({ where: { id: cartId } });
}
