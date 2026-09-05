/**
 * SPEC-ORDER-001 M2 — order domain types and the wire DTOs the checkout
 * endpoint and screens exchange.
 *
 * Framework-independent by design, matching features/cart/types/cart.ts:
 * nothing here imports from `next/*`; the one `@prisma/client` import below is
 * type-only, matching order-repository.ts's and discount-service.ts's own
 * convention, per structure.md's rule that `features/` must not depend on the
 * delivery mechanism. That is why `OrderStatusDTO` restates the three enum
 * values as a string union rather than re-exporting Prisma's generated enum.
 *
 * Note what is ABSENT, deliberately:
 *  - No payment-instrument field anywhere (REQ-ORDER-009). There is no card
 *    number, expiry or CVC to model, because none is ever collected.
 *  - No email (plan.md §0 #4). The completion screen shows once, right after
 *    the order; nothing in this SPEC's scope has a use for an address.
 *
 * SPEC-ORDER-004 M2 reopens exactly one of those absences: an order now carries
 * a member owner as well as a guest one, expressed as the `OrderOwner` union
 * below. The two payment/email absences above are unchanged.
 *
 * The contrast with CartItemDTO is the point of this SPEC: a cart line carries
 * the CURRENT price read live on every request, while an order line carries the
 * price AS OF the order and never changes again (REQ-ORDER-002).
 *
 * SPEC-DISCOUNT-001 M4 extends this file with the applied-discount snapshot
 * (`couponCode` / `discountAmount` on `CreateOrderInput` and `OrderDTO`) and
 * the four coupon refusal codes, folded into the SAME flat `OrderFailure`
 * union rather than a nested wrapper (design.md §4) — the route handler
 * switches on `.code` for these exactly as it already does for the other five.
 */

import type { DiscountFailure } from "@/features/discounts/types/discount";

/** The order lifecycle values. This SPEC only ever writes `pending_payment`. */
export type OrderStatusDTO = "pending_payment" | "paid" | "cancelled";

/**
 * SPEC-ORDER-004 M2 — who an order belongs to (REQ-ORDER-048's XOR invariant,
 * expressed as a type rather than as a review convention).
 *
 * Deliberately a discriminated union rather than `{ guestId?: string; userId?:
 * string }`: that shape makes "both" and "neither" representable, which is
 * exactly the pair the invariant forbids, and would push enforcement out of the
 * compiler and into code review (plan.md §G).
 *
 * The write path (M3/M4) dispatches on `kind`; the route (M2) is the only place
 * that DECIDES it, from `resolveSession()` alone (design.md §3.2.1).
 */
export type OrderOwner =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestId: string };

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
   * that gets stored (design.md §4). Now the DISCOUNTED figure, once a coupon
   * is applied (REQ-DISCOUNT-018).
   */
  confirmedTotal: number;
  /**
   * The coupon code the shopper submitted, or `null` for none
   * (SPEC-DISCOUNT-001 REQ-DISCOUNT-019). Deliberately REQUIRED rather than
   * optional-undefined: the validator must explicitly decide "no code
   * submitted" (`null`) from "some code submitted" (a string), so nothing
   * downstream can mistake an unset field for a decision never made.
   */
  couponCode: string | null;
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
  /**
   * The applied coupon's code, or `null` when none was applied
   * (SPEC-DISCOUNT-001 REQ-DISCOUNT-014/019). A snapshot copy, not a live
   * lookup — it does not move if the coupon is later changed or deleted.
   */
  couponCode: string | null;
  /** The discount already subtracted into `totalAmount` above. `0` for none. */
  discountAmount: number;
  shipping: ShippingInfo;
  createdAt: string;
}

/**
 * The four ways an otherwise well-formed submission can be refused
 * (design.md §8, extended by SPEC-ORDER-002 plan.md §2; SPEC-ORDER-004 M2
 * removed the fifth — the member-checkout refusal — when the member path
 * stopped being a refusal at all, REQ-ORDER-056), plus the four coupon
 * refusals SPEC-DISCOUNT-001 adds (spec.md §4 "쿠폰 검증과 거절",
 * `DiscountFailureCode` in features/discounts/types/discount.ts). Each is a
 * 409, not a 400: the request itself is fine, it is the server's state that
 * disagrees with it.
 *
 * `CONCURRENCY_RETRY` is the one that says nothing is wrong with the request AT
 * ALL — the database aborted the transaction to break a deadlock or a
 * serialization conflict, nothing was written, and the identical submission may
 * simply be sent again (REQ-ORDER-027).
 */
export type OrderFailureCode =
  | "CART_EMPTY"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED"
  | "CONCURRENCY_RETRY"
  | "COUPON_NOT_FOUND"
  | "COUPON_EXPIRED"
  | "COUPON_MINIMUM_NOT_MET"
  | "COUPON_EXHAUSTED";

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
  | { status: 409; error: string; code: "CART_EMPTY" }
  | {
      status: 409;
      error: string;
      code: "INSUFFICIENT_STOCK";
      products: InsufficientStockProduct[];
    }
  | { status: 409; error: string; code: "PRICE_CHANGED"; totalAmount: number }
  // Deliberately carries NO product list. The database aborted the transaction
  // to break a conflict; it never told us which line lost, and inventing one
  // would name a product that may be perfectly available (SPEC-ORDER-002
  // plan.md §3).
  | { status: 409; error: string; code: "CONCURRENCY_RETRY" }
  // SPEC-DISCOUNT-001 M4 — the four coupon refusals, mapped 1:1 from
  // DiscountFailure (design.md §3.1 3b, design.md §4). `Extract` pulls each
  // member's `code` + any extra field (COUPON_MINIMUM_NOT_MET's
  // `requiredMinimum`) straight from the SAME type discount-service.ts
  // returns, rather than hand-duplicating that shape here; `error` is added
  // because every OrderFailure variant carries one (OrderAbort's constructor
  // reads `failure.error`), which DiscountFailure itself does not.
  | (Extract<DiscountFailure, { code: "COUPON_NOT_FOUND" }> & { error: string })
  | (Extract<DiscountFailure, { code: "COUPON_EXPIRED" }> & { error: string })
  | (Extract<DiscountFailure, { code: "COUPON_MINIMUM_NOT_MET" }> & { error: string })
  | (Extract<DiscountFailure, { code: "COUPON_EXHAUSTED" }> & { error: string })
  // design.md §8's last row: an unexpected transaction failure answers 500 with
  // NO code. A cart line stored at quantity <= 0 lands here (REQ-ORDER-004) —
  // the request is well-formed and the server state is wrong, so there is
  // nothing the shopper can correct and no code worth naming for them.
  | { status: 500; error: string };

/** The service's return shape: a value, or a refusal that maps to a response. */
export type OrderResult<T> = { ok: true; data: T } | ({ ok: false } & OrderFailure);

/**
 * SPEC-ORDER-003 M1 — the guest revisit lookup submission (REQ-ORDER-034).
 * Both fields are the raw, untrimmed strings a form would submit; format
 * validation and normalization happen in order-service.ts.
 */
export interface LookupOrderInput {
  orderNumber: string;
  recipientPhone: string;
}

/**
 * The two ways a lookup submission can fail. Deliberately collapsed to ONE
 * shape for "no such order" and "a real order number with the wrong phone" —
 * order-repository.ts's findOrderByNumberAndPhone() makes that collapse
 * structural (a single WHERE clause returns the same `null` either way), so
 * this type never grows a discriminant for the missing case (REQ-ORDER-036).
 * `404` carries no order field of any kind — see AC-ORDER-038.
 */
export type LookupOrderFailure =
  | { status: 400; error: string; fieldErrors: Record<string, string> }
  | { status: 404; error: string; code: "NOT_FOUND" };

export type LookupOrderResult =
  | { ok: true; data: OrderDTO }
  | ({ ok: false } & LookupOrderFailure);
