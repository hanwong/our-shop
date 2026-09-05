"use client";

import { useState } from "react";

import type { CartDTO, CartItemDTO } from "@/features/cart/types/cart";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { buttonClassName } from "@/components/ui/Button";

/**
 * SPEC-STOREFRONT-002 — the client component that owns cart state
 * (plan.md §A/§B/§C/§D, design.md §2/§3).
 *
 * WHY A SINGLE CLIENT COMPONENT OWNS THIS STATE (plan.md §A): quantity
 * changes and deletes both affect the per-item row AND the subtotal at the
 * bottom of the screen, and a server component cannot hold client state.
 * Individual item rows are NOT split into their own components — the item
 * count is small (single digits) and splitting would only reintroduce a
 * state-lifting problem for no benefit (constitution Enforce Simplicity).
 *
 * Initial state comes from the server component's first render (the
 * `initialCart` prop), matching CheckoutInteractive's `cart` prop pattern —
 * no client-side fetch draws the first screen.
 *
 * RESPONSE-REPLACE, NOT REFETCH (plan.md §B): every mutating endpoint
 * already returns the whole cart, so every handler below replaces `cart`
 * state with the response body directly. No handler re-issues GET
 * /api/cart.
 *
 * ABSOLUTE SET, IMMEDIATE COMMIT (plan.md §C): the stepper PATCHes the new
 * absolute quantity on every click — no separate "apply" step, no
 * debounce. The "+" button disables once the known `stock` is reached; that
 * is a UX hint only, never a guarantee (a concurrent shopper may have
 * already taken the remaining stock) — the server's own stock check is what
 * actually decides, and its 400 lands in the same error path as any other
 * rejection.
 *
 * PESSIMISTIC UPDATES (plan.md §D): `cart` state changes ONLY after a
 * successful response. A rejected PATCH/DELETE writes an error onto that
 * row's `errors` entry and leaves `cart` untouched — no optimistic apply,
 * no rollback flicker, and a failure on one row never disturbs any other
 * row's state.
 */

/**
 * Formats a won integer. A third copy of ProductDetailView.formatWon /
 * OrderSummary.formatWon (design.md §2 "formatWon 중복 처리") — this SPEC
 * does not introduce a shared `src/components/ui/` utility module (spec.md
 * §3 Out of Scope), so the existing one-line duplication pattern continues
 * rather than being broken by a new shared module this SPEC alone would own.
 */
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

const QUANTITY_CHANGE_FAILED = "수량을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요";
const DELETE_FAILED = "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요";

export function CartView({ initialCart }: { initialCart: CartDTO }) {
  const [cart, setCart] = useState<CartDTO>(initialCart);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearError(itemId: string) {
    setErrors((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  async function applyQuantity(item: CartItemDTO, quantity: number) {
    try {
      const response = await fetch(`/api/cart/items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity }),
      });

      if (response.ok) {
        const data: CartDTO = await response.json();
        setCart(data);
        clearError(item.id);
        return;
      }

      const failure: { error?: string } = await response.json();
      setErrors((prev) => ({ ...prev, [item.id]: failure.error ?? QUANTITY_CHANGE_FAILED }));
    } catch {
      setErrors((prev) => ({ ...prev, [item.id]: QUANTITY_CHANGE_FAILED }));
    }
  }

  async function deleteItem(item: CartItemDTO) {
    try {
      const response = await fetch(`/api/cart/items/${item.id}`, { method: "DELETE" });

      if (response.ok) {
        const data: CartDTO = await response.json();
        setCart(data);
        clearError(item.id);
        return;
      }

      const failure: { error?: string } = await response.json();
      setErrors((prev) => ({ ...prev, [item.id]: failure.error ?? DELETE_FAILED }));
    } catch {
      setErrors((prev) => ({ ...prev, [item.id]: DELETE_FAILED }));
    }
  }

  if (cart.items.length === 0) {
    return <EmptyCart />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">장바구니</h1>

      <ul className="mt-6">
        {cart.items.map((item: CartItemDTO) => {
          const error = errors[item.id];

          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 border-b border-neutral-100 py-4 md:flex-row md:items-center md:gap-4 last:border-b-0"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
                <p className="mt-1 text-xs text-neutral-500">{formatWon(item.price)}</p>
              </div>

              <div className="md:w-32 md:shrink-0">
                <div className="inline-flex items-center rounded-md border border-neutral-300">
                  <button
                    type="button"
                    aria-label={`${item.name} 수량 감소`}
                    disabled={item.quantity <= 1}
                    onClick={() => applyQuantity(item, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center text-sm text-neutral-700 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums text-neutral-900">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`${item.name} 수량 증가`}
                    disabled={item.quantity >= item.stock}
                    onClick={() => applyQuantity(item, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center text-sm text-neutral-700 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 md:w-40 md:shrink-0 md:justify-end">
                <p className="text-sm text-neutral-900">{formatWon(item.lineTotal)}</p>
                <button
                  type="button"
                  aria-label={`${item.name} 삭제`}
                  onClick={() => deleteItem(item)}
                  className="text-xs text-neutral-500 hover:text-red-600"
                >
                  삭제
                </button>
              </div>

              {error ? (
                <p role="alert" className="text-xs text-red-600 md:basis-full md:pl-24">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 text-base font-semibold">
        <p className="text-neutral-900">소계</p>
        <p className="text-neutral-900">{formatWon(cart.subtotal)}</p>
      </div>

      <a href="/checkout" className={buttonClassName({ className: "mt-6" })}>
        결제하기
      </a>
    </main>
  );
}
