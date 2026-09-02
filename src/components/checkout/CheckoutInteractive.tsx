"use client";

import { useId, useState } from "react";

import type { CartDTO } from "@/features/cart/types/cart";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { OrderSummary } from "@/components/checkout/OrderSummary";

/**
 * SPEC-DISCOUNT-001 M6b — the coupon input + result area, composed with
 * `OrderSummary` and `CheckoutForm` (design.md §5, REQ-DISCOUNT-023/024).
 *
 * WHY THIS COMPONENT EXISTS (the state-lifting problem): applying a coupon is
 * a client-side interaction (click -> fetch -> result) that must affect BOTH
 * `OrderSummary`'s discount line/total AND `CheckoutForm`'s submitted
 * `confirmedTotal` + `couponCode`. Server components cannot hold client
 * state, and two independent client components cannot share state without a
 * common owner — so this ONE client component owns the coupon-application
 * state and is the sole place that computes the discount-inclusive total both
 * children receive.
 *
 * Coupon application is a SEPARATE round trip from order submission
 * (design.md §5) — this component's `handleApply` calls
 * `POST /api/discounts/validate` (M6a, write-free), never `/api/orders`.
 * That endpoint's approval is a convenience, not an enforcement: the actual
 * gate is the order transaction's conditional atomic update
 * (REQ-DISCOUNT-016), so a code approved here may still be refused at
 * submission — that later refusal is correct and this component does not try
 * to prevent it.
 *
 * Minimal UI only (plan.md §0 확정 #1) — input + Apply button + a
 * `role="status"` result area + the composed children. No styling/layout
 * polish; card `t10` owns that later.
 */

interface AppliedDiscount {
  code: string;
  discountAmount: number;
}

/**
 * design.md §4's four coupon refusal codes, mapped to distinct Korean copy
 * (AC-DISCOUNT-024 — the four messages must form a set of size 4, none
 * empty, none a raw code string). `COUPON_MINIMUM_NOT_MET`'s message embeds
 * the numeric `requiredMinimum` the response carries.
 */
function messageFor(failure: { code?: string; requiredMinimum?: number }): string {
  switch (failure.code) {
    case "COUPON_NOT_FOUND":
      return "존재하지 않는 쿠폰 코드입니다";
    case "COUPON_EXPIRED":
      return "유효 기간이 지난 쿠폰입니다";
    case "COUPON_MINIMUM_NOT_MET": {
      const min = typeof failure.requiredMinimum === "number" ? failure.requiredMinimum : 0;
      return `최소 주문 금액 ${new Intl.NumberFormat("ko-KR").format(min)}원 이상부터 사용할 수 있는 쿠폰입니다`;
    }
    case "COUPON_EXHAUSTED":
      return "쿠폰 사용 가능 횟수가 모두 소진되었습니다";
    default:
      return "쿠폰을 적용하지 못했습니다";
  }
}

export function CheckoutInteractive({
  cart,
  itemsSubtotal,
  shippingFee,
  idempotencyKey,
}: {
  cart: CartDTO;
  itemsSubtotal: number;
  shippingFee: number;
  idempotencyKey: string;
}) {
  const inputId = useId();

  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  async function handleApply() {
    const trimmed = code.trim();
    if (trimmed === "" || applying) return;

    setApplying(true);
    setRejection(null);

    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: trimmed, itemsSubtotal }),
      });

      if (response.ok) {
        const data: { discountAmount: number } = await response.json();
        // Stored as the shopper typed it (trimmed) rather than server-
        // normalized: discount-service re-normalizes (uppercase) on every
        // lookup it performs, including the one order-service repeats inside
        // the order transaction (M4), so submitting the as-typed value is
        // equivalent and keeps this component from re-implementing that
        // normalization.
        setApplied({ code: trimmed, discountAmount: data.discountAmount });
        return;
      }

      const failure: { code?: string; requiredMinimum?: number } = await response.json();
      // A new rejection clears any previously-applied discount — trying a
      // different code that fails must not leave a stale discount in effect.
      setApplied(null);
      setRejection(messageFor(failure));
    } catch {
      setApplied(null);
      setRejection("쿠폰을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setApplying(false);
    }
  }

  const discountAmount = applied?.discountAmount ?? 0;
  const couponCode = applied?.code ?? null;
  // REQ-DISCOUNT-005: discount reduces itemsSubtotal only, never shippingFee.
  const totalAmount = itemsSubtotal - discountAmount + shippingFee;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-neutral-200 p-4">
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
          쿠폰 코드
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={inputId}
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={applying || code.trim() === ""}
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            적용
          </button>
        </div>
        {/* AC-DISCOUNT-023 (ii): this area must EXIST regardless of state —
            empty and neutral before any attempt, never conditionally
            mounted. */}
        <div
          role="status"
          aria-live="polite"
          className={`mt-2 text-sm ${rejection ? "text-red-600" : "text-neutral-700"}`}
        >
          {rejection ??
            (applied
              ? `쿠폰이 적용되었습니다 (-${new Intl.NumberFormat("ko-KR").format(applied.discountAmount)}원)`
              : null)}
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <CheckoutForm
          idempotencyKey={idempotencyKey}
          confirmedTotal={totalAmount}
          couponCode={couponCode}
        />
        <OrderSummary
          cart={cart}
          itemsSubtotal={itemsSubtotal}
          shippingFee={shippingFee}
          totalAmount={totalAmount}
          discountAmount={discountAmount}
          couponCode={couponCode}
        />
      </div>
    </div>
  );
}
