import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * SPEC-ADMIN-001 M3 — Prisma query layer for the admin order list.
 *
 * Traces: REQ-ADMIN-007 (every order regardless of guest attribution),
 * REQ-ADMIN-008 (optional status filter), REQ-ADMIN-009 (reuses the existing
 * catalog page/pageSize convention). Follows
 * src/features/catalog/repositories/product-repository.ts's exact pattern.
 *
 * This layer performs NO validation and applies NO defaults — it trusts the
 * arguments it is given, matching product-repository.ts's own documented
 * discipline. Validation, defaulting and clamping live one layer up, in the
 * caller (the `/staff/orders` Server Component).
 */

/**
 * List projection — exactly REQ-ADMIN-007's display fields. Deliberately
 * excludes recipientPhone/postalCode/address/deliveryMemo (shipping detail,
 * not needed by a list row), paymentKey (AC-ADMIN-011 forbids exposing
 * payment-sensitive fields), and item relations (no business need in the
 * list view) — the projection stays minimal on purpose.
 */
const LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  recipientName: true,
  totalAmount: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

/**
 * Orders carry no natural secondary-sort field the way products' price does,
 * so `createdAt desc` + `id asc` is the fixed two-key order for every query —
 * `id` breaks ties between orders created in the same millisecond so paging
 * stays stable.
 */
const ORDER_BY: Prisma.OrderOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];

export type AdminOrderListRow = Prisma.OrderGetPayload<{ select: typeof LIST_SELECT }>;

export interface ListOrdersForAdminArgs {
  page: number;
  pageSize: number;
  status?: OrderStatus;
}

export interface AdminOrdersPage {
  rows: AdminOrderListRow[];
  totalCount: number;
}

/**
 * Reads one page of orders plus the total row count for the SAME filter.
 * No `guestId` scoping anywhere — an admin sees every order regardless of
 * who placed it (REQ-ADMIN-007's "특정 게스트 귀속에 한정되지 않은 전체 주문").
 *
 * The two queries are issued concurrently: they are independent reads, and
 * serializing them would double the round-trip latency for no benefit.
 */
export async function listOrdersForAdmin({
  page,
  pageSize,
  status,
}: ListOrdersForAdminArgs): Promise<AdminOrdersPage> {
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      select: LIST_SELECT,
      orderBy: ORDER_BY,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { rows, totalCount };
}
