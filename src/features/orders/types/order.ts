/**
 * SPEC-ORDER-001 M2 — order domain types and the wire DTOs the checkout
 * endpoint and screens exchange.
 *
 * Framework-independent by design, matching features/cart/types/cart.ts:
 * nothing here imports from `next/*` or `@prisma/client`, per structure.md's
 * rule that `features/` must not depend on the delivery mechanism. That is why
 * `OrderStatusDTO` restates the three enum values as a string union rather than
 * re-exporting Prisma's generated enum.
 *
 * Note what is ABSENT, deliberately:
 *  - No payment-instrument field anywhere (REQ-ORDER-009). There is no card
 *    number, expiry or CVC to model, because none is ever collected.
 *  - No email (plan.md §0 #4). The completion screen shows once, right after
 *    the order; nothing in this SPEC's scope has a use for an address.
 *  - No member attribution. An order belongs to a guest identity and to nothing
 *    else (design.md §1.4) — the same boundary the schema enforces.
 *
 * The contrast with CartItemDTO is the point of this SPEC: a cart line carries
 * the CURRENT price read live on every request, while an order line carries the
 * price AS OF the order and never changes again (REQ-ORDER-002).
 */

/** The order lifecycle values. This SPEC only ever writes `pending_payment`. */
export type OrderStatusDTO = "pending_payment" | "paid" | "cancelled";

/**
 * Everything the shopper is asked for — exactly the five fields REQ-ORDER-008
 * permits, no more. `deliveryMemo` is the only optional one.
 */
export interface ShippingInfo {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  deliveryMemo: string | null;
}

/** The submission body, after validation. */
export interface CreateOrderInput {
  shipping: ShippingInfo;
  /**
   * Issued by the server when it rendered the form, echoed back on submit
   * (design.md §5). Client-minted keys would move collision and reuse
   * responsibility to the client.
   */
  idempotencyKey: string;
  /**
   * The total the shopper actually saw. Compared against the server's own
   * recomputation and then DISCARDED — it is a cross-check, never the figure
   * that gets stored (design.md §4).
   */
  confirmedTotal: number;
}

/** One line of an order, frozen at creation (REQ-ORDER-002). */
export interface OrderItemDTO {
  productId: string;
  /** The product's name AS OF the order. Renaming the product never moves it. */
  productName: string;
  /** The product's price AS OF the order, in KRW. */
  unitPrice: number;
  quantity: number;
  /** `unitPrice * quantity`, stored rather than recomputed (design.md §1.1). */
  lineTotal: number;
}

/** The order as the API and both checkout screens see it. */
export interface OrderDTO {
  id: string;
  orderNumber: string;
  status: OrderStatusDTO;
  items: OrderItemDTO[];
  itemsSubtotal: number;
  shippingFee: number;
  totalAmount: number;
  shipping: ShippingInfo;
  createdAt: string;
}

/**
 * The four ways an otherwise well-formed submission can be refused
 * (design.md §8). Each is a 409, not a 400: the request itself is fine, it is
 * the server's state that disagrees with it.
 */
export type OrderFailureCode =
  | "MEMBER_CHECKOUT_UNSUPPORTED"
  | "CART_EMPTY"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED";

/** One product the cart wanted more of than the catalogue currently has. */
export interface InsufficientStockProduct {
  productId: string;
  name: string;
  available: number;
}

/**
 * A refusal. The discriminant is `code` for the 409s and its absence for the
 * 400, which mirrors design.md §8's response table one-for-one — so the route
 * handler serialises the failure rather than re-deciding its shape.
 */
export type OrderFailure =
  | { status: 400; error: string; fieldErrors: Record<string, string> }
  | { status: 409; error: string; code: "MEMBER_CHECKOUT_UNSUPPORTED" }
  | { status: 409; error: string; code: "CART_EMPTY" }
  | {
      status: 409;
      error: string;
      code: "INSUFFICIENT_STOCK";
      products: InsufficientStockProduct[];
    }
  | { status: 409; error: string; code: "PRICE_CHANGED"; totalAmount: number };

/** The service's return shape: a value, or a refusal that maps to a response. */
export type OrderResult<T> = { ok: true; data: T } | ({ ok: false } & OrderFailure);
