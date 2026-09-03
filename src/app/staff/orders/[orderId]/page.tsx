import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { resolveAdminSession } from "@/features/admin/services/admin-session";
import { findOrderByIdForAdmin } from "@/features/admin/repositories/admin-order-repository";
import type { AdminOrderDetailDTO } from "@/features/admin/types/admin";
import { CancelOrderButton } from "./CancelOrderButton";

/**
 * SPEC-ADMIN-001 M4 — `/staff/orders/[orderId]` (REQ-ADMIN-010~012).
 *
 * Same session-gate pattern as `/staff/orders` (M3): `resolveAdminSession()`
 * re-reads the refresh-token cookie on every request and, on `null` — no
 * cookie, expired, revoked, or a valid non-admin session, all collapsing to
 * the SAME reason-blind result per REQ-ADMIN-003 — redirects to
 * `/staff/login` BEFORE any order data is fetched.
 *
 * Calls `findOrderByIdForAdmin()` DIRECTLY (no `fetch`, no intermediate API
 * route) — same in-process discipline as `/staff/orders` (design.md §3).
 *
 * `orderId` is Next.js 15's dynamic-route Promise param, awaited — same
 * pattern as `/orders/lookup/[orderNumber]/page.tsx`. A missing order
 * answers `notFound()`.
 *
 * AC-ADMIN-011: `findOrderByIdForAdmin`'s Prisma `select` never includes
 * `paymentKey` at the query level, so this page structurally cannot render a
 * value it never received.
 *
 * AC-ADMIN-012: a "취소" (cancel) action renders ONLY when `status` is
 * `pending_payment` or `paid`. This page NEVER renders a "mark as paid"
 * control for ANY order status — only `SPEC-PAYMENT-001`'s confirm/webhook
 * path may ever transition an order to the paid state (REQ-ADMIN-012).
 */

const STATUS_LABEL: Record<AdminOrderDetailDTO["status"], string> = {
  pending_payment: "결제 대기",
  paid: "결제 완료",
  cancelled: "취소됨",
};

/** Mirrors ProductDetailView.formatWon / OrderLookupResultView.formatWon. */
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

export default async function StaffOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    redirect("/staff/login");
  }

  const row = await findOrderByIdForAdmin(orderId);
  if (row === null) {
    notFound();
  }

  const order: AdminOrderDetailDTO = {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    shipping: {
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      postalCode: row.postalCode,
      address: row.address,
      deliveryMemo: row.deliveryMemo,
    },
    items: row.items,
    itemsSubtotal: row.itemsSubtotal,
    shippingFee: row.shippingFee,
    totalAmount: row.totalAmount,
  };

  // REQ-ADMIN-012 — the only transition an admin may trigger is a
  // cancellation, and only from a source status that permits it. There is
  // deliberately no branch anywhere in this component that offers a
  // paid-transition control.
  const cancellable = order.status === "pending_payment" || order.status === "paid";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">주문 상세</h1>

      <dl className="mt-6 space-y-1 text-sm">
        <dt className="text-neutral-600">주문 번호</dt>
        <dd className="font-mono text-base text-neutral-900">{order.orderNumber}</dd>
        <dt className="mt-2 text-neutral-600">상태</dt>
        <dd className="text-neutral-900">{STATUS_LABEL[order.status]}</dd>
      </dl>

      <section aria-labelledby="ordered-items" className="mt-8">
        <h2 id="ordered-items" className="text-lg font-semibold text-neutral-900">
          주문 상품
        </h2>
        <ul className="mt-3 divide-y divide-neutral-100 border-y border-neutral-200">
          {order.items.map((item) => (
            <li
              key={item.productId}
              className="flex items-baseline justify-between gap-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">{item.productName}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatWon(item.unitPrice)} × {item.quantity}개
                </p>
              </div>
              <p className="shrink-0 text-neutral-900">{formatWon(item.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">상품 합계</dt>
            <dd className="text-neutral-900">{formatWon(order.itemsSubtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">배송비</dt>
            <dd className="text-neutral-900">{formatWon(order.shippingFee)}</dd>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold">
            <dt className="text-neutral-900">총액</dt>
            <dd className="text-neutral-900">{formatWon(order.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="shipping-summary" className="mt-8">
        <h2 id="shipping-summary" className="text-lg font-semibold text-neutral-900">
          배송지
        </h2>
        <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-neutral-800">
          <p>
            {order.shipping.recipientName} · {order.shipping.recipientPhone}
          </p>
          <p>
            ({order.shipping.postalCode}) {order.shipping.address}
          </p>
          {order.shipping.deliveryMemo ? (
            <p className="text-neutral-500">요청사항: {order.shipping.deliveryMemo}</p>
          ) : null}
        </address>
      </section>

      {cancellable ? (
        <div className="mt-8">
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </main>
  );
}
