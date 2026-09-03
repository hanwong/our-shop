"use client";

import { useId, useState } from "react";

/**
 * SPEC-STOREFRONT-002 M4 — the product detail screen's "add to cart"
 * control (REQ-STOREFRONT-024..027, design.md §5).
 *
 * A separate, self-contained client component (plan.md §A) — it has
 * nothing to share with CartView's state (different screen, different
 * render tree), so it owns its own local success/failure/submitting state
 * the same way CheckoutForm owns its own independent of CheckoutInteractive.
 *
 * INCREMENT SEMANTICS (plan.md §B/§C): POST /api/cart/items ADDS `quantity`
 * MORE of this product (SPEC-CART-001's addItem is an increment, not an
 * absolute set) — this control does not need to know or display the
 * resulting cart total; only the response's `itemCount` is worth reading,
 * and even that is not shown here (design.md §5 shows only a confirmation
 * + a link to /cart, not a running count).
 *
 * PESSIMISTIC, MUTUALLY EXCLUSIVE RESULT (plan.md §D): success and failure
 * share one region and render exclusively — a later failed attempt does not
 * leave a stale success message visible, and vice versa.
 */

type Result = { kind: "success" } | { kind: "error"; message: string };

const ADD_FAILED = "장바구니에 담지 못했습니다. 잠시 후 다시 시도해 주세요";

export function AddToCartButton({ productId, stock }: { productId: string; stock: number }) {
  const qtyId = useId();

  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function handleQuantityChange(raw: string) {
    const parsed = Number(raw);
    setQuantity(Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1);
  }

  async function handleClick() {
    if (submitting || stock === 0) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });

      if (response.ok) {
        setResult({ kind: "success" });
        return;
      }

      const failure: { error?: string } = await response.json();
      setResult({ kind: "error", message: failure.error ?? ADD_FAILED });
    } catch {
      setResult({ kind: "error", message: ADD_FAILED });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex items-end gap-3">
        <div>
          <label htmlFor={qtyId} className="block text-sm font-medium text-neutral-800">
            수량
          </label>
          <input
            id={qtyId}
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => handleQuantityChange(event.target.value)}
            className="mt-1 w-20 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
          />
        </div>
        <button
          type="button"
          disabled={stock === 0 || submitting}
          onClick={handleClick}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          장바구니에 담기
        </button>
      </div>

      <div
        role={result?.kind === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`mt-2 text-sm ${result?.kind === "error" ? "text-red-600" : "text-neutral-700"}`}
      >
        {result?.kind === "success" ? (
          <>
            장바구니에 담았습니다 ·{" "}
            <a href="/cart" className="underline">
              장바구니로 이동
            </a>
          </>
        ) : result?.kind === "error" ? (
          result.message
        ) : null}
      </div>
    </>
  );
}
