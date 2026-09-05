"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { FormField, fieldInputClassName, fieldLabelClassName } from "@/components/ui/FormField";

/**
 * SPEC-REVIEW-001 M4 — the product detail screen's review-writing control
 * (REQ-REVIEW-002, REQ-REVIEW-008). Rendered only for a logged-in visitor —
 * the login-prompt branch lives in ProductDetailView.tsx.
 *
 * A separate, self-contained client "island" (plan.md §C), the same pattern
 * AddToCartButton.tsx already established: it owns its own local
 * submitting/error state, and it is excluded from the first-render source
 * scan the same way AddToCartButton is — its fetch fires from a submit
 * handler, not from render, so it never runs a fetch on mount.
 *
 * NO local success state and NO optimistic list update (plan.md M4,
 * constitution Enforce Simplicity): on success this calls `router.refresh()`
 * so the Server Component re-reads the actual review list and aggregate from
 * the database, the same idiom CancelOrderButton.tsx already uses.
 */

const RATINGS = [5, 4, 3, 2, 1] as const;
const SUBMIT_FAILED = "리뷰를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요";

export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const ratingId = useId();
  const bodyId = useId();

  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, rating, body }),
      });

      if (response.ok) {
        setBody("");
        router.refresh();
        return;
      }

      const failure: { error?: string } = await response.json();
      setError(failure.error ?? SUBMIT_FAILED);
    } catch {
      setError(SUBMIT_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div>
        <label htmlFor={ratingId} className={fieldLabelClassName()}>
          평점
        </label>
        {/* Not a <FormField> consumer — <select> is outside FormField's
            input/textarea discriminant, and this control is intentionally
            auto-width (not the shared w-full), so the exported class builder
            is applied directly with an important-modifier override
            (AddToCartButton.tsx's quantity input set the same precedent). */}
        <select
          id={ratingId}
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className={fieldInputClassName({ className: "!w-auto" })}
        >
          {RATINGS.map((value) => (
            <option key={value} value={value}>
              {value}점
            </option>
          ))}
        </select>
      </div>

      <FormField
        id={bodyId}
        label="리뷰 내용"
        multiline
        value={body}
        onChange={(event) => setBody(event.target.value)}
        required
        rows={3}
      />

      <Button type="submit" disabled={submitting}>
        리뷰 등록
      </Button>

      {error !== null ? (
        <div role="alert" aria-live="polite" className="text-sm text-red-600">
          {error}
        </div>
      ) : null}
    </form>
  );
}
