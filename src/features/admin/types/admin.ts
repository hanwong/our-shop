/**
 * SPEC-ADMIN-001 M3 — admin domain types.
 *
 * Framework-independent by design, matching
 * src/features/catalog/types/product.ts's discipline: nothing here imports
 * from `next/*` or `@prisma/client`. `status` is restated as a plain string
 * union rather than re-exporting Prisma's generated enum, per structure.md's
 * rule that `features/` must not depend on the delivery mechanism.
 *
 * `DEFAULT_PAGE` / `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` reuse
 * product.ts's exact values (REQ-ADMIN-009 — the admin list follows the
 * existing catalog pagination convention rather than inventing a new one).
 */

/** Applied when `page` is omitted or invalid. */
export const DEFAULT_PAGE = 1;

/** Applied when `pageSize` is omitted or invalid. */
export const DEFAULT_PAGE_SIZE = 20;

/** `pageSize` above this is clamped down, never rejected. */
export const MAX_PAGE_SIZE = 100;

/**
 * One row of the admin order list (REQ-ADMIN-007's display fields only —
 * no shipping address, no payment instrument, no item lines. `createdAt` is
 * an ISO-8601 string, serialized once at the response-assembly boundary
 * (the page component), matching ProductListItem's convention.
 */
export interface AdminOrderListItemDTO {
  id: string;
  orderNumber: string;
  status: "pending_payment" | "paid" | "cancelled";
  recipientName: string;
  totalAmount: number;
  createdAt: string;
}

/** The admin order list response, including pagination metadata. */
export interface PaginatedAdminOrders {
  items: AdminOrderListItemDTO[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * SPEC-ADMIN-001 M4 — admin order detail + status-change types.
 *
 * `AdminOrderDetailDTO` mirrors `OrderDTO` (src/features/orders/types/order.ts)
 * in shape — a `shipping` sub-object plus an `items` array plus the amount
 * breakdown — but is a SEPARATE type, not a reuse of `OrderDTO`/`ShippingInfo`:
 * this SPEC's admin module deliberately does not depend on the orders
 * feature's types (mirroring admin-order-repository.ts, which runs its own
 * Prisma queries rather than importing order-repository.ts). Deliberately
 * carries NO `paymentKey` field (AC-ADMIN-011) — matching the query-level
 * omission already structural in `findOrderByIdForAdmin`'s Prisma `select`.
 */

/** One item line of the admin order detail view. */
export interface AdminOrderItemDTO {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** The shipping snapshot shown on the admin order detail view. */
export interface AdminShippingInfo {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  deliveryMemo: string | null;
}

/** The admin order detail view (REQ-ADMIN-010). No paymentKey — AC-ADMIN-011. */
export interface AdminOrderDetailDTO {
  id: string;
  orderNumber: string;
  status: "pending_payment" | "paid" | "cancelled";
  shipping: AdminShippingInfo;
  items: AdminOrderItemDTO[];
  itemsSubtotal: number;
  shippingFee: number;
  totalAmount: number;
}

/**
 * The only body `PATCH /admin/api/orders/[orderId]/status` accepts
 * (REQ-ADMIN-012/013) — a plain `{ status: "cancelled" }`. Any other value,
 * including `"paid"`, is a malformed-request rejection at the API boundary,
 * never a recognized transition target.
 */
export interface CancelOrderRequestBody {
  status: "cancelled";
}

/** The status-change route's JSON response shape. */
export type AdminOrderStatusChangeResult =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 403 | 404 | 409; error: string };
