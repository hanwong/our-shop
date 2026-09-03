import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  decrementRedeemedCountIfPositive,
  findCouponByCode,
} from "@/features/discounts/repositories/coupon-repository";

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

// ---------------------------------------------------------------------------
// SPEC-ADMIN-001 M4 — admin order detail + status-change (REQ-ADMIN-010~015)
// ---------------------------------------------------------------------------

/**
 * Detail projection — REQ-ADMIN-010's display fields (shipping snapshot,
 * item lines, amount breakdown, current status). Deliberately a `select`, not
 * an `include`: `paymentKey` is absent from this object entirely, so it is
 * structurally impossible for a row returned by this query to carry it
 * (AC-ADMIN-011 — the stronger, query-level guarantee, not merely an unused
 * DTO field).
 */
const DETAIL_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  recipientName: true,
  recipientPhone: true,
  postalCode: true,
  address: true,
  deliveryMemo: true,
  itemsSubtotal: true,
  shippingFee: true,
  totalAmount: true,
  items: {
    select: {
      productId: true,
      productName: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
    // Same stable two-key order-repository.ts's ORDER_INCLUDE uses for the
    // guest-facing order detail — items list in insertion order.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.OrderSelect;

export type AdminOrderDetailRow = Prisma.OrderGetPayload<{ select: typeof DETAIL_SELECT }>;

/**
 * Reads one order's admin-detail projection, or `null` when no order matches
 * `orderId` (REQ-ADMIN-010). No `guestId` scoping — same as
 * `listOrdersForAdmin`, an admin may open any order regardless of who placed
 * it.
 */
export async function findOrderByIdForAdmin(orderId: string): Promise<AdminOrderDetailRow | null> {
  return prisma.order.findUnique({ where: { id: orderId }, select: DETAIL_SELECT });
}

export interface CancelOrderAsAdminResult {
  transitioned: boolean;
}

/**
 * The admin-triggered cancellation transition (REQ-ADMIN-012~015). Follows
 * design.md §4's pseudocode: the CURRENT status is read first (needed for the
 * audit log's `previousStatus` — `updateMany` never returns a pre-image),
 * then the conditional-atomic transition runs (`updateMany` with a
 * non-unique WHERE, never a plain `update` — the same shape
 * `markOrderCancelledAndRestoreStock` in payment-repository.ts uses for the
 * `paid` source, extended here to ALSO accept `pending_payment` as a source,
 * per REQ-ADMIN-012).
 *
 * When the conditional update does not apply (`count !== 1` — the order was
 * already `cancelled`, some other non-transitionable status, or does not
 * exist at all), this returns `{ transitioned: false }` immediately: no
 * stock, no coupon, no audit log row is touched (REQ-ADMIN-013,
 * AC-ADMIN-013's "no side effects on an invalid transition" invariant).
 *
 * On success, this reproduces the SAME side effects
 * `markOrderCancelledAndRestoreStock` produces for its `paid` source — stock
 * restoration per item, then coupon-redemption release when a coupon was
 * applied — reimplemented here rather than imported, per design.md §4's
 * explicit PRESERVE decision (payment-repository.ts is SPEC-PAYMENT-001's
 * file and is not modified by this SPEC). `findCouponByCode` /
 * `decrementRedeemedCountIfPositive` themselves ARE imported and reused, not
 * reimplemented — only the loop/conditional "shell" around them is
 * duplicated.
 *
 * @MX:NOTE this function's stock-restore loop duplicates
 * markOrderCancelledAndRestoreStock's shell (design.md §4's acknowledged
 * WET tradeoff). A future cross-SPEC refactor could extract both into a
 * shared `stock-restore.ts` utility — out of this SPEC's scope.
 */
export async function cancelOrderAsAdmin(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<CancelOrderAsAdminResult> {
  const current = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  const updated = await tx.order.updateMany({
    where: { id: orderId, status: { in: ["pending_payment", "paid"] as OrderStatus[] } },
    data: { status: "cancelled" },
  });
  if (updated.count !== 1 || current === null) {
    return { transitioned: false };
  }

  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true },
  });
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { couponCode: true },
  });
  if (order?.couponCode != null) {
    const coupon = await findCouponByCode(order.couponCode, tx);
    if (coupon !== null) {
      await decrementRedeemedCountIfPositive(tx, coupon.id);
    }
    // coupon === null: the coupon row was deleted since the order was
    // placed — silently skip, matching markOrderCancelledAndRestoreStock's
    // documented handling of the same case.
  }

  await tx.paymentAuditLog.create({
    data: {
      orderId,
      source: "ADMIN_ACTION",
      previousStatus: current.status,
      newStatus: "cancelled",
      paymentKey: null,
    },
  });

  return { transitioned: true };
}
