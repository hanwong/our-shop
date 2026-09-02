import type { CartDTO, CartItemDTO } from "@/features/cart/types/cart";

/**
 * SPEC-ORDER-001 M5 — the order summary beside the shipping form
 * (REQ-ORDER-005).
 *
 * A pure presentation component, matching ProductDetailView: it receives values
 * and returns markup, performs no data access, and can therefore be rendered
 * directly in a test rather than through the async page.
 *
 * The three money figures are passed IN rather than derived here. The total the
 * shopper sees has to be the same number the form submits for confirmation
 * (REQ-ORDER-014), and a component that recomputed it would be a second place
 * for that arithmetic to live — and so a second place for it to drift.
 */

/**
 * Formats a won integer. Mirrors ProductDetailView.formatWon: `Product.price`
 * is already an integer number of won, so this only groups thousands, with no
 * currency glyph or decimal places.
 */
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

/**
 * What this line's stock is worth saying, or null when it is worth saying
 * nothing (SPEC-ORDER-002 REQ-ORDER-028).
 *
 * Three states, and the silent one is deliberate: a badge on every line would
 * bury the two that actually need attention among the ones that do not.
 *
 * The figure comes from `CartItemDTO.stock`, which the cart already sends — no
 * new query (plan.md §3). It is therefore a RENDER-TIME reading and may be out
 * of date by the time the shopper submits, which is precisely why this notice
 * informs and never blocks: REQ-ORDER-029 leaves the verdict to the
 * transaction. `<= 0` rather than `=== 0` because `Product.stock` is a plain
 * integer column with no CHECK constraint, and "품절" is the honest reading of a
 * negative anomaly — "재고 부족 — 현재 -1개" is not.
 */
function stockNotice(item: CartItemDTO): string | null {
  if (item.stock <= 0) return "품절";
  if (item.stock < item.quantity) return `재고 부족 — 현재 ${item.stock}개`;
  return null;
}

export function OrderSummary({
  cart,
  itemsSubtotal,
  shippingFee,
  totalAmount,
  discountAmount,
  couponCode,
}: {
  cart: CartDTO;
  itemsSubtotal: number;
  shippingFee: number;
  totalAmount: number;
  /**
   * SPEC-DISCOUNT-001 M6b (AC-DISCOUNT-023). Passed IN, like the three money
   * figures above — this component recomputes nothing, so `totalAmount`
   * arriving discount-inclusive stays the single source of truth for what the
   * shopper is charged.
   */
  discountAmount: number;
  /** The applied coupon's code, or `null` when none is applied. Shown only to
   * label the discount row — never used to decide whether to render it
   * (`discountAmount > 0` alone decides that, per REQ-DISCOUNT-023). */
  couponCode: string | null;
}) {
  return (
    <section aria-labelledby="order-summary-heading" className="rounded-lg border border-neutral-200 p-4">
      <h2 id="order-summary-heading" className="text-lg font-semibold text-neutral-900">
        주문 상품
      </h2>

      <ul className="mt-4 divide-y divide-neutral-100">
        {cart.items.map((item) => {
          const notice = stockNotice(item);

          return (
            <li key={item.id} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
                {/* The unit price is shown next to the quantity so the line total
                    below is checkable by eye rather than taken on trust. */}
                <p className="mt-1 text-xs text-neutral-500">
                  {formatWon(item.price)} × {item.quantity}개
                </p>
                {notice === null ? null : (
                  <p className="mt-1 text-xs font-medium text-red-600">{notice}</p>
                )}
              </div>
              <p className="shrink-0 text-sm text-neutral-900">{formatWon(item.lineTotal)}</p>
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">상품 합계</dt>
          <dd className="text-neutral-900">{formatWon(itemsSubtotal)}</dd>
        </div>
        {/* REQ-DISCOUNT-023: present exactly while discountAmount > 0 — absent
            from the DOM (not merely hidden) otherwise. */}
        {discountAmount > 0 ? (
          <div className="flex justify-between">
            <dt className="text-neutral-600">
              할인 금액{couponCode ? ` (${couponCode})` : ""}
            </dt>
            <dd className="text-neutral-900">-{formatWon(discountAmount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-neutral-600">배송비</dt>
          <dd className="text-neutral-900">{formatWon(shippingFee)}</dd>
        </div>
        <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold">
          <dt className="text-neutral-900">결제 예정 금액</dt>
          <dd className="text-neutral-900">{formatWon(totalAmount)}</dd>
        </div>
      </dl>
    </section>
  );
}
