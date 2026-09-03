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
