"use client";

import { useId, useState } from "react";

import type { OrderDTO } from "@/features/orders/types/order";
import { OrderLookupResultView } from "@/components/orders/OrderLookupResultView";

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
  const orderNumberErrorId = `${orderNumberId}-error`;
  const phoneId = `${formId}-recipientPhone`;
  const phoneErrorId = `${phoneId}-error`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor={orderNumberId} className="block text-sm font-medium text-neutral-800">
          주문 번호
        </label>
        <input
          id={orderNumberId}
          name="orderNumber"
          type="text"
          value={orderNumber}
          aria-describedby={fieldErrors.orderNumber ? orderNumberErrorId : undefined}
          aria-invalid={fieldErrors.orderNumber ? true : undefined}
          onChange={(event) => setOrderNumber(event.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
        />
        {fieldErrors.orderNumber ? (
          <p id={orderNumberErrorId} className="mt-1 text-sm text-red-600">
            {fieldErrors.orderNumber}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={phoneId} className="block text-sm font-medium text-neutral-800">
          연락처
        </label>
        <input
          id={phoneId}
          name="recipientPhone"
          type="text"
          value={recipientPhone}
          autoComplete="tel"
          aria-describedby={fieldErrors.recipientPhone ? phoneErrorId : undefined}
          aria-invalid={fieldErrors.recipientPhone ? true : undefined}
          onChange={(event) => setRecipientPhone(event.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
        />
        {fieldErrors.recipientPhone ? (
          <p id={phoneErrorId} className="mt-1 text-sm text-red-600">
            {fieldErrors.recipientPhone}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {submitting ? "조회 중…" : "주문 조회"}
      </button>
    </form>
  );
}
