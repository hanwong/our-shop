/**
 * SPEC-CART-001 M2 — cart domain types and the wire DTOs the cart endpoints
 * return.
 *
 * Framework-independent by design, matching features/catalog/types/product.ts:
 * nothing here imports from `next/*` or `@prisma/client`, per structure.md's
 * rule that `features/` must not depend on the delivery mechanism.
 *
 * Note what is ABSENT from CartItemDTO: any stored price. The cart joins
 * `Product.price` live on every read (plan.md §2.4), because nothing has been
 * promised to the shopper until checkout — and checkout owns its own price
 * confirmation. `price` below is therefore always the CURRENT catalogue price,
 * never a snapshot taken when the item was added.
 */

/** Which identity a cart request resolved to (REQ-CART-003). */
export type CartIdentity =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestId: string };

/** One line of the cart response (plan.md §3.1). */
export interface CartItemDTO {
  /** The CartItem id — the handle PATCH and DELETE address. */
  id: string;
  productId: string;
  name: string;
  /** The product's CURRENT price, in KRW. Not a snapshot (plan.md §2.4). */
  price: number;
  /** The first product image, or null when the product carries none. */
  image: string | null;
  /** The product's CURRENT stock, so a client can render its own limits. */
  stock: number;
  quantity: number;
  /** `price * quantity`, precomputed so clients agree on the arithmetic. */
  lineTotal: number;
}

/**
 * The response body shared by all four cart endpoints. The three mutating
 * endpoints deliberately return this same whole-cart shape rather than the one
 * item they touched (plan.md §3), so a client never has to issue a follow-up
 * GET to redraw the cart.
 */
export interface CartDTO {
  items: CartItemDTO[];
  /** Sum of every lineTotal (REQ-CART-005). */
  subtotal: number;
  /** Sum of every quantity — the badge count, not the number of lines. */
  itemCount: number;
}

/**
 * The response for an identity with no cart row yet. Returned WITHOUT creating
 * a row (plan.md §2.6): a visitor who only ever loads a page to render a cart
 * badge should not leave an empty cart behind in the database.
 */
export function emptyCart(): CartDTO {
  return { items: [], subtotal: 0, itemCount: 0 };
}
