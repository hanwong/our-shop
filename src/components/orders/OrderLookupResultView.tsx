import type { OrderDTO } from "@/features/orders/types/order";

/**
 * SPEC-ORDER-003 M2 — the read-only guest revisit lookup result view
 * (REQ-ORDER-038 ~ 041).
 *
 * Reuses the completion screen's display items (plan.md M2 — "결과 화면은
 * 완료 화면의 표시 항목을 재사용"): the same formatWon shape, and the same
 * <dl>/<ul>/<address> structure as `/checkout/complete/[orderId]/page.tsx`.
 * Two additions beyond that screen: the order date (`createdAt`) and, when a
 * discount was applied, a discount line naming the coupon code. Two
 * omissions: no payment-action button and no retry-banner for a failed
 * charge — this screen never lets the shopper act, it only shows them what
 * is stored (REQ-ORDER-039 covers this structurally too: OrderDTO carries
 * none of the internal identifiers a checkout flow needs, for this
 * component to even reach).
 *
 * Shared by BOTH lookup entry points (OrderLookupForm's inline render after a
 * phone-matched submission, and the cookie-bypass page
 * `/orders/lookup/[orderNumber]`) — one presentational component, so the two
 * paths cannot drift in what they show.
 */

/** Mirrors ProductDetailView.formatWon — a won integer, thousands grouped. */
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

/** REQ-ORDER-038 — the order date, absent from the completion screen. */
function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export function OrderLookupResultView({ order }: { order: OrderDTO }) {
  return (
    <div>
      <dl className="space-y-1 text-sm">
        <dt className="text-neutral-600">주문 번호</dt>
        <dd className="font-mono text-base text-neutral-900">{order.orderNumber}</dd>
        <dt className="mt-2 text-neutral-600">주문 일시</dt>
        <dd className="text-neutral-900">{formatOrderDate(order.createdAt)}</dd>
      </dl>

      {/* The 3-way status branch the completion screen owns (design.md §6),
          minus the payment action and the retry banner: this screen is
          read-only. */}
      {order.status === "pending_payment" ? (
        <p
          role="status"
          className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
        >
          아직 결제 전 단계입니다. 주문 내역만 접수되었으며, 결제는 진행되지 않았습니다.
        </p>
      ) : order.status === "paid" ? (
        <p
          role="status"
          className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900"
        >
          결제가 완료되었습니다.
        </p>
      ) : (
        <p
          role="status"
          className="mt-4 rounded-md bg-neutral-100 px-4 py-3 text-sm leading-relaxed text-neutral-700"
        >
          이 주문은 취소되었습니다.
        </p>
      )}

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
          {/* The addition beyond the completion screen: a discount line, shown
              only when a coupon actually reduced the total (SPEC-DISCOUNT-001). */}
          {order.discountAmount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-neutral-600">
                할인{order.couponCode ? ` (${order.couponCode})` : ""}
              </dt>
              <dd className="text-neutral-900">-{formatWon(order.discountAmount)}</dd>
            </div>
          ) : null}
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
    </div>
  );
}
