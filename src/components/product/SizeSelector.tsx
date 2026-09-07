/**
 * SPEC-BRAND-001 M7 — display-only size selector (REQ-BRAND-022/023,
 * AC-BRAND-023).
 *
 * `disabled` is derived from EXACTLY ONE signal, `stock === 0` (plan.md
 * §B.1's most-contested decision) — never a per-size flag, because none
 * exists: `Product` carries no per-size inventory column, and none is
 * added here (spec.md §3 Out of Scope — Per-Size Inventory; a future
 * `SPEC-INVENTORY-001` would own that). Every size therefore shares
 * IDENTICAL disabled state; a mixed per-size state is impossible by
 * construction, not merely untested (REQ-BRAND-023's "shall not" clause).
 *
 * A plain server component, not a client one: nothing observes which size
 * was clicked (no size travels into AddToCartButton's payload, no per-size
 * cart line exists), so there is nothing for `useState` to hold. Rendering
 * `disabled` on an inert `<button>` needs no client boundary.
 *
 * SIZE LIST PROVENANCE: no SPEC artifact enumerates discrete size values —
 * only the brand-wide RANGE ("285mm부터 330mm까지", research.md §2) is
 * confirmed. The 10 sizes below are that exact range split at the standard
 * 5mm Mondopoint shoe-sizing increment (285/290/.../330) — a real-world
 * sizing convention, not an invented number, and NOT the kind of synthetic
 * per-product fill value REQ-BRAND-024 forbids (that clause bars treating a
 * rendering artifact as PRODUCT DATA; this is a brand-wide, product-
 * independent UI constant). Flagged here for visibility since it is a new
 * assumption this milestone introduces, distinct from design.md §8.3's 7
 * PROVISIONAL handoff items.
 */
export const AVAILABLE_SIZES_MM: readonly number[] = [285, 290, 295, 300, 305, 310, 315, 320, 325, 330];

export function SizeSelector({ stock }: { stock: number }) {
  const disabled = stock === 0;

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-text">사이즈</p>
      <div className="mt-2 grid grid-cols-5 gap-2" role="group" aria-label="사이즈 선택">
        {AVAILABLE_SIZES_MM.map((size) => (
          <button
            key={size}
            type="button"
            disabled={disabled}
            className="rounded-md border border-divider px-2 py-1 text-sm text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
