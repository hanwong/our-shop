import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GUEST_CART_COOKIE_NAME } from "@/lib/auth/guest-identity";
import { getOrderForGuest } from "@/features/orders/services/order-service";

/**
 * SPEC-ORDER-001 M6 — `/checkout/complete/[orderId]` (REQ-ORDER-018/020).
 *
 * Identity here is the same single cookie read as the order form (design.md
 * §6.1): no token verification, no precedence rule, no id minting. This page
 * deliberately reads no request header at all, so a member presenting a bearer
 * credential gains nothing by it — the direct consequence of member checkout
 * being out of scope, and the property AC-ORDER-020 (b) pins statically by
 * scanning this directory for the header-reading tokens.
 *
 * KNOWING THE ORDER ID IS NOT ENOUGH. Ownership is part of the query itself
 * (getOrderForGuest), so there is no shape of this page that fetches a
 * stranger's order and then decides not to show it.
 *
 * Every refusal is notFound(), and none is a "forbidden" status — the precedent
 * SPEC-CART-001's findOwnedItem() set. A distinguishable status would let
 * someone holding a guessed id learn that it is real (design.md §6.3).
 *
 * This screen is for the moment just after ordering. A guest whose cookie has
 * expired cannot return to it, which is accepted rather than overlooked: a
 * re-visit mechanism belongs to the order-history SPEC (spec.md §3).
 */

/** Mirrors ProductDetailView.formatWon — a won integer, thousands grouped. */
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

export default async function CheckoutCompletePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const jar = await cookies();
  const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null;

  // No cookie means nothing to match the order's owner against, so there is
  // nothing to look up — the same tautology the order form relies on.
  if (guestId === null) {
    notFound();
  }

  const order = await getOrderForGuest(orderId, guestId);
  if (order === null) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">주문이 접수되었습니다</h1>

      {/* REQ-ORDER-018's payment notice. The order is pending_payment and this
          SPEC owns no transition out of it (REQ-ORDER-019), so any wording
          implying a completed payment would be false, not merely loose. */}
      <p
        role="status"
        className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
      >
        아직 결제 전 단계입니다. 주문 내역만 접수되었으며, 결제는 진행되지 않았습니다.
      </p>

      <dl className="mt-8 space-y-1 text-sm">
        <dt className="text-neutral-600">주문 번호</dt>
        <dd className="font-mono text-base text-neutral-900">{order.orderNumber}</dd>
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
                {/* The name and unit price are the SNAPSHOT taken at order
                    time, not the product's current values (REQ-ORDER-002). */}
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
            <dt className="text-neutral-900">결제 예정 금액</dt>
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
    </main>
  );
}
