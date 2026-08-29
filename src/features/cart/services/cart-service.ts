import { verifyAccessToken } from "@/lib/auth/jwt";
import { generateGuestCartId, readGuestCartId } from "@/lib/auth/guest-identity";
import {
  createGuestCart,
  createUserCart,
  deleteCart,
  deleteItem,
  findCartByGuestId,
  findCartByUserId,
  findItemById,
  findProductForCart,
  incrementItemQuantity,
  promoteGuestCartToUser,
  setItemQuantity,
  type CartWithItems,
} from "@/features/cart/repositories/cart-repository";
import { emptyCart, type CartDTO, type CartIdentity } from "@/features/cart/types/cart";

/**
 * SPEC-CART-001 M3 — identity resolution, validation, stock checks and
 * response assembly for the cart endpoints, plus the login-time merge.
 *
 * Traces: REQ-CART-003 (identity), REQ-CART-005 (subtotal off the live price),
 * REQ-CART-006 (add is increment), REQ-CART-007 (validation and the stock
 * ceiling, persisting nothing on rejection), REQ-CART-008 (absolute set),
 * REQ-CART-009/010 (delete; 404 for a foreign item), REQ-CART-011/012/013
 * (merge), REQ-CART-014/015 (no credentials required; stock is never adjusted).
 *
 * @MX:ANCHOR fan-in target — the three cart route handlers enter the domain
 * exclusively through this module, and both auth success routes call
 * mergeGuestCartIntoUserCart(). The repository is never called from app/.
 * @MX:REASON this is the only place a cart request's IDENTITY is decided, so a
 * regression here lets one shopper read or mutate another's cart; it is an
 * authorization surface, not just a validation layer.
 *
 * Framework-independent, matching product-service.ts: it takes a plain Request
 * (for header/cookie reading only) and returns discriminated results, leaving
 * HTTP mapping to the route handlers.
 */

export type CartServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404; error: string };

export interface ResolvedCartIdentity {
  identity: CartIdentity;
  /**
   * Non-null when this request had no guest cookie and one was minted for it.
   * The route handler must attach the corresponding cookie to its response;
   * otherwise the next request mints another id and the cart appears to vanish.
   */
  issuedGuestId: string | null;
}

/**
 * Decides whose cart this request addresses (REQ-CART-003).
 *
 * A VALID bearer token means the member; anything else means a guest. Note
 * that an invalid or expired token is NOT an error here — it degrades to a
 * guest identity. REQ-CART-014 forbids requiring credentials for cart access,
 * so answering 401 would break the guest flow for anyone holding a stale
 * token, and the same fall-through is what the public catalog endpoints
 * already do with a junk Authorization header.
 */
export async function resolveCartIdentity(request: Request): Promise<ResolvedCartIdentity> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (token) {
    try {
      const claims = await verifyAccessToken(token);
      return { identity: { kind: "user", userId: claims.sub }, issuedGuestId: null };
    } catch {
      // Fall through to the guest path.
    }
  }

  const existing = readGuestCartId(request);
  if (existing) {
    return { identity: { kind: "guest", guestId: existing }, issuedGuestId: null };
  }

  // Issue the identity now, and return the SAME value the route will put in
  // the cookie, so the cart this request reads and the cookie it hands back
  // can never disagree.
  const guestId = generateGuestCartId();
  return { identity: { kind: "guest", guestId }, issuedGuestId: guestId };
}

/** Reads the cart row for an identity, or null when it has none yet. */
async function findCart(identity: CartIdentity): Promise<CartWithItems | null> {
  return identity.kind === "user"
    ? findCartByUserId(identity.userId)
    : findCartByGuestId(identity.guestId);
}

/** Creates the cart row for an identity, on the XOR-safe path for its kind. */
async function createCartFor(identity: CartIdentity): Promise<string> {
  const created =
    identity.kind === "user"
      ? await createUserCart(identity.userId)
      : await createGuestCart(identity.guestId);
  return created.id;
}

/**
 * Projects a cart row onto the wire DTO, or the empty cart when there is no
 * row (plan.md §2.6 — "no cart yet" is a normal state, not an error).
 *
 * Every money figure is computed from `product.price` read in THIS query, so
 * the subtotal always reflects the current catalogue price (REQ-CART-005).
 */
function toCartDTO(cart: CartWithItems | null): CartDTO {
  if (cart === null) return emptyCart();

  const items = cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.product.name,
    price: item.product.price,
    image: item.product.images[0] ?? null,
    stock: item.product.stock,
    quantity: item.quantity,
    lineTotal: item.product.price * item.quantity,
  }));

  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    // The badge count: how many units are in the cart, not how many lines.
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

/** Re-reads and projects, so every mutation answers with the whole cart (plan.md §3). */
async function readCartDTO(identity: CartIdentity): Promise<CartDTO> {
  return toCartDTO(await findCart(identity));
}

/**
 * Narrows an untrusted `quantity` to a positive integer (REQ-CART-007).
 *
 * `Number.isSafeInteger` rejects strings, null, undefined, NaN, Infinity and
 * fractions in one test; the `>= 1` guard then rejects zero and negatives.
 * Zero is deliberately rejected rather than treated as a delete: "0 units"
 * would be a magic value meaning "remove", and DELETE already says that
 * plainly (plan.md §2.5).
 */
function parseQuantity(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 1) return null;
  return raw;
}

const INVALID_QUANTITY = "Invalid 'quantity' — expected an integer of 1 or more";
const ITEM_NOT_FOUND = "Cart item not found";

export interface AddItemBody {
  productId?: unknown;
  quantity?: unknown;
}

export interface SetQuantityBody {
  quantity?: unknown;
}

/** `GET /api/cart` — the current cart, without creating a row for it. */
export async function getCart(identity: CartIdentity): Promise<CartDTO> {
  return readCartDTO(identity);
}

/**
 * `POST /api/cart/items` — add `quantity` MORE of a product (REQ-CART-006).
 *
 * The ordering below is load-bearing for REQ-CART-007's "persist nothing on
 * rejection": the body is validated before any query, the product and the
 * stock ceiling are checked before any write, and the cart row is created only
 * once the add is known to be acceptable. A rejected first add therefore
 * leaves no empty cart behind.
 */
export async function addItem(
  identity: CartIdentity,
  body: AddItemBody
): Promise<CartServiceResult<CartDTO>> {
  const productId = typeof body.productId === "string" ? body.productId : null;
  if (!productId) {
    return { ok: false, status: 400, error: "Invalid 'productId' — expected a string" };
  }

  const quantity = parseQuantity(body.quantity);
  if (quantity === null) {
    return { ok: false, status: 400, error: INVALID_QUANTITY };
  }

  const product = await findProductForCart(productId);
  if (product === null) {
    return { ok: false, status: 400, error: "Unknown 'productId'" };
  }

  const cart = await findCart(identity);
  const alreadyHeld = cart?.items.find((item) => item.productId === productId)?.quantity ?? 0;

  // The ceiling applies to the RESULTING quantity, so repeatedly adding one at
  // a time cannot walk past stock (REQ-CART-007). This is a read-only check —
  // no stock is reserved or decremented (REQ-CART-015); checkout owns that.
  if (alreadyHeld + quantity > product.stock) {
    return {
      ok: false,
      status: 400,
      error: `Requested quantity exceeds available stock (${product.stock})`,
    };
  }

  const cartId = cart?.id ?? (await createCartFor(identity));
  await incrementItemQuantity(cartId, productId, quantity);

  return { ok: true, data: await readCartDTO(identity) };
}

/**
 * Resolves an item id against the requester's own cart.
 *
 * Returns 404 — never 403 — for an item that exists but belongs to someone
 * else, so that a caller cannot use the status code to discover which item ids
 * are real (REQ-CART-010 / AC-CART-011).
 */
async function findOwnedItem(
  identity: CartIdentity,
  itemId: string
): Promise<{ ok: true; item: { id: string; productId: string; quantity: number } } | { ok: false }> {
  const item = await findItemById(itemId);
  if (item === null) return { ok: false };

  const cart = await findCart(identity);
  if (cart === null || cart.id !== item.cartId) return { ok: false };

  return { ok: true, item };
}

/**
 * `PATCH /api/cart/items/:itemId` — set the line to exactly `quantity`
 * (REQ-CART-008). An ABSOLUTE set, unlike addItem's increment.
 */
export async function setQuantity(
  identity: CartIdentity,
  itemId: string,
  body: SetQuantityBody
): Promise<CartServiceResult<CartDTO>> {
  const quantity = parseQuantity(body.quantity);
  if (quantity === null) {
    return { ok: false, status: 400, error: INVALID_QUANTITY };
  }

  const owned = await findOwnedItem(identity, itemId);
  if (!owned.ok) {
    return { ok: false, status: 404, error: ITEM_NOT_FOUND };
  }

  const product = await findProductForCart(owned.item.productId);
  if (product === null) {
    return { ok: false, status: 400, error: "Unknown 'productId'" };
  }
  if (quantity > product.stock) {
    return {
      ok: false,
      status: 400,
      error: `Requested quantity exceeds available stock (${product.stock})`,
    };
  }

  await setItemQuantity(itemId, quantity);
  return { ok: true, data: await readCartDTO(identity) };
}

/** `DELETE /api/cart/items/:itemId` — remove one line (REQ-CART-009). */
export async function removeItem(
  identity: CartIdentity,
  itemId: string
): Promise<CartServiceResult<CartDTO>> {
  const owned = await findOwnedItem(identity, itemId);
  if (!owned.ok) {
    return { ok: false, status: 404, error: ITEM_NOT_FOUND };
  }

  await deleteItem(itemId);
  return { ok: true, data: await readCartDTO(identity) };
}

/**
 * Folds a guest cart into a member's cart at login (REQ-CART-011/012/013).
 *
 * Called from both auth success routes; it is NOT an HTTP endpoint (plan.md
 * §3.5). Two shapes, per plan.md §2.3:
 *
 *  - The member has no cart -> PROMOTE: hand the existing guest cart over by
 *    reassigning ownership. No rows are copied and no item ids change.
 *  - The member has a cart -> MERGE each guest line into it: sum the two
 *    quantities, clamp to current stock, drop anything that lands at zero, then
 *    delete the drained guest cart.
 *
 * Both paths end with the guest id resolving to nothing, which is what makes a
 * replayed cookie a no-op at the next login (AC-CART-014) without needing an
 * "already merged" flag.
 *
 * This function returns void and is intentionally forgiving: it is called on
 * the login success path, where a cart-merge problem must never cost the user
 * their login. The callers wrap it accordingly.
 */
export async function mergeGuestCartIntoUserCart(userId: string, guestId: string): Promise<void> {
  const guestCart = await findCartByGuestId(guestId);
  if (guestCart === null) return;

  const userCart = await findCartByUserId(userId);
  if (userCart === null) {
    await promoteGuestCartToUser(guestCart.id, userId);
    return;
  }

  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find((item) => item.productId === guestItem.productId);
    const stock = guestItem.product.stock;
    const target = Math.min(guestItem.quantity + (existing?.quantity ?? 0), stock);

    if (target < 1) {
      // Sold out entirely. REQ-CART-002 forbids persisting a line at zero, and
      // that invariant outranks "leave the member's own lines alone" — so an
      // existing line for this product is removed rather than left at a
      // quantity the shopper can no longer buy.
      if (existing) await deleteItem(existing.id);
      continue;
    }

    if (existing) {
      // An absolute set, not an increment: `target` is already the clamped
      // total of both carts, so incrementing would double-count the member's
      // own quantity.
      await setItemQuantity(existing.id, target);
    } else {
      await incrementItemQuantity(userCart.id, guestItem.productId, target);
    }
  }

  // Removes the guest cart and, via the FK cascade, its now-copied lines.
  await deleteCart(guestCart.id);
}
