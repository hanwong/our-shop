"use client";

import { useState } from "react";

import { loadTossPaymentClient } from "@/lib/payment/toss-client";
import { Button } from "@/components/ui/Button";

/**
 * SPEC-PAYMENT-001 M4 — the checkout screen's payment-window trigger.
 *
 * Traces: REQ-PAYMENT-005 (SDK invocation shape, design.md §6). Pure UI: it
 * loads the Toss SDK client and calls requestPayment() with the props it was
 * given — orderId, amount, and orderName are all computed upstream by the
 * completion screen (design.md §6.1), never here. No authorization or
 * amount-validation logic lives in this component; the server re-verifies
 * both on the successUrl round trip regardless of what this button sends
 * (design.md §4).
 */

export interface PayButtonProps {
  orderId: string;
  amount: number;
  orderName: string;
}

export function PayButton({ orderId, amount, orderName }: PayButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsSubmitting(true);
    setError(null);
    try {
      const client = await loadTossPaymentClient();
      const origin = window.location.origin;
      await client.requestPayment({
        orderId,
        amount,
        orderName,
        successUrl: `${origin}/api/payments/confirm`,
        failUrl: `${origin}/checkout/complete/${orderId}?payment_failed=1`,
      });
    } catch {
      setError("결제창을 여는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <Button type="button" onClick={handleClick} disabled={isSubmitting} fullWidth>
        {isSubmitting ? "결제창을 여는 중..." : "결제하기"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
