"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-ORDER-001 M5 — the shipping form (REQ-ORDER-008/010/013/014).
 *
 * The ONLY client component in this SPEC, and the only place a browser request
 * is made. That request happens in the submit handler and nowhere else: the
 * first render carries the whole order summary already (REQ-ORDER-005), so
 * there is nothing to load on mount — which is why no mount-time effect appears
 * below, and why AC-ORDER-005 (b) asserts its absence rather than trusting it.
 *
 * It collects exactly the five fields REQ-ORDER-008 permits. There is no card
 * number, expiry or CVC input, and no email: payment is out of scope
 * (REQ-ORDER-009) and nothing in this SPEC has a use for an address
 * (plan.md §0 #4).
 *
 * `confirmedTotal` is the figure the summary DISPLAYED. Submitting it lets the
 * server refuse when its own recomputation disagrees, so the shopper is never
 * charged an amount they did not see (design.md §4). It is a cross-check the
 * server compares against — never a figure it stores.
 */

/** Exactly the fields REQ-ORDER-008 permits. `deliveryMemo` is the optional one. */
const FIELDS = [
  { name: "recipientName", label: "수령인 이름", required: true, autoComplete: "name" },
  { name: "recipientPhone", label: "연락처", required: true, autoComplete: "tel" },
  { name: "postalCode", label: "우편번호", required: true, autoComplete: "postal-code" },
  { name: "address", label: "주소", required: true, autoComplete: "street-address" },
  { name: "deliveryMemo", label: "배송 요청사항 (선택)", required: false },
] as const;

type FieldName = (typeof FIELDS)[number]["name"];

const EMPTY: Record<FieldName, string> = {
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  address: "",
  deliveryMemo: "",
};

/** The refusal bodies design.md §8 defines, as the form needs to read them. */
interface SubmitFailure {
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  totalAmount?: number;
}

export function CheckoutForm({
  idempotencyKey,
  confirmedTotal,
}: {
  idempotencyKey: string;
  confirmedTotal: number;
}) {
  const router = useRouter();
  const formId = useId();

  const [values, setValues] = useState<Record<FieldName, string>>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shipping: {
            recipientName: values.recipientName,
            recipientPhone: values.recipientPhone,
            postalCode: values.postalCode,
            address: values.address,
            deliveryMemo: values.deliveryMemo === "" ? null : values.deliveryMemo,
          },
          idempotencyKey,
          confirmedTotal,
        }),
      });

      if (response.ok) {
        const order: { id: string } = await response.json();
        router.push(`/checkout/complete/${order.id}`);
        return;
      }

      const failure: SubmitFailure = await response.json();
      if (failure.fieldErrors) {
        setFieldErrors(failure.fieldErrors);
      }
      setFormError(failure.error ?? "주문을 완료하지 못했습니다");
      // A changed price is the one refusal the shopper can act on immediately,
      // so the new figure is surfaced rather than left in the response body.
      if (failure.code === "PRICE_CHANGED" && typeof failure.totalAmount === "number") {
        setFormError(
          `가격이 변경되었습니다. 새 결제 예정 금액은 ${new Intl.NumberFormat("ko-KR").format(
            failure.totalAmount
          )}원입니다. 새로고침 후 다시 확인해 주세요`
        );
      }
    } catch {
      setFormError("주문을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <h2 className="text-lg font-semibold text-neutral-900">배송 정보</h2>

      {FIELDS.map((field) => {
        const inputId = `${formId}-${field.name}`;
        const errorId = `${inputId}-error`;
        const error = fieldErrors[field.name];

        return (
          <div key={field.name}>
            <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
              {field.label}
            </label>
            <input
              id={inputId}
              name={field.name}
              type="text"
              value={values[field.name]}
              required={field.required}
              {...("autoComplete" in field ? { autoComplete: field.autoComplete } : {})}
              // The error is tied to its input programmatically, not merely
              // placed beside it, so a screen reader announces the two together.
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
              }
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            />
            {error ? (
              <p id={errorId} className="mt-1 text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

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
        {submitting ? "주문 처리 중…" : "주문하기"}
      </button>
    </form>
  );
}
