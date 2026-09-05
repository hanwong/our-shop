"use client";

import { useId, useState } from "react";

import type { OrderDTO } from "@/features/orders/types/order";
import { OrderLookupResultView } from "@/components/orders/OrderLookupResultView";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";

/**
 * SPEC-ORDER-003 M2 — the guest revisit lookup input screen's form
 * (REQ-ORDER-042, REQ-ORDER-043, REQ-ORDER-034).
 *
 * The two inputs REQ-ORDER-042 permits: an order number and a recipient
 * phone. This component decides NOTHING about whether either is well-formed —
 * lookupOrderByNumberAndPhone() already owns that (order-service.ts), so
 * every submission is forwarded to POST /api/orders/lookup unconditionally
 * and the response's `fieldErrors` are rendered exactly as received. Matches
 * the pattern CheckoutForm.tsx set for the order-creation form.
 *
 * On success, the form is REPLACED by the shared read-only result view
 * (OrderLookupResultView) rather than navigating to a separate URL — this
 * keeps the recipient phone value out of any URL, browser history, or
 * referrer header (design consideration recorded in progress.md §E.2 M2).
 */

interface LookupFailureBody {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export function OrderLookupForm() {
  const formId = useId();

  const [orderNumber, setOrderNumber] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderDTO | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber, recipientPhone }),
      });

      if (response.ok) {
        const order: OrderDTO = await response.json();
        setResult(order);
        return;
      }

      const failure: LookupFailureBody = await response.json();
      if (failure.fieldErrors) {
        setFieldErrors(failure.fieldErrors);
      }
      setFormError(failure.error ?? "주문을 조회하지 못했습니다");
    } catch {
      setFormError("주문을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setSubmitting(false);
    }
  }

  if (result !== null) {
    return <OrderLookupResultView order={result} />;
  }

  const orderNumberId = `${formId}-orderNumber`;
  const phoneId = `${formId}-recipientPhone`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FormField
        id={orderNumberId}
        name="orderNumber"
        type="text"
        label="주문 번호"
        value={orderNumber}
        error={fieldErrors.orderNumber}
        onChange={(event) => setOrderNumber(event.target.value)}
      />

      <FormField
        id={phoneId}
        name="recipientPhone"
        type="text"
        label="연락처"
        value={recipientPhone}
        autoComplete="tel"
        error={fieldErrors.recipientPhone}
        onChange={(event) => setRecipientPhone(event.target.value)}
      />

      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} fullWidth>
        {submitting ? "조회 중…" : "주문 조회"}
      </Button>
    </form>
  );
}
