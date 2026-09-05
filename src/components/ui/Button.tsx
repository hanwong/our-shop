import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * SPEC-DESIGN-001 M1 — Classical outline button primitive (spec.md §1.2,
 * plan.md §D.1b/§D.2/§D.4-1).
 *
 * Classical readme, verbatim: "Do not fill cards or buttons with solid
 * accent color." The current codebase's 13-file solid-fill convergence (a
 * dark-neutral filled background plus white text, spec.md §1.3) is the
 * REPLACEMENT target, not the source of this primitive's styling (spec.md
 * §1.2) — this renders transparent background + accent-colour border +
 * accent-colour text.
 *
 * @MX:ANCHOR fan-in target — plan.md §H projected 13+ call sites once M2-M4
 * replaced every primary-action button consumer (the 13-file solid-fill
 * survey, spec.md §1.3) plus LogoutButton (REQ-DESIGN-006), all with this
 * single definition. M5 final measurement: fan-in is **14**
 * (`grep -rl 'from "@/components/ui/Button"' src/` — login/signup ×2,
 * staff/login, ProductForm, staff/products/page, CartView, EmptyCart,
 * CheckoutForm, CheckoutInteractive, PayButton, LogoutButton,
 * OrderLookupForm, AddToCartButton, ReviewForm), confirming the ANCHOR
 * classification (fan_in >= 3, CLAUDE.md § MX Tag Quality Gates).
 * @MX:REASON this is the site's single definition point for the
 * primary-action button (REQ-DESIGN-003/004/005) — a regression here changes
 * every primary-action button on the site once consumers are migrated.
 */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Renders `w-full` instead of `inline-block` — absorbs the width variant
   * observed across the 13-file survey (plan.md §D.2) rather than requiring
   * each caller to override the primitive's layout class directly.
   */
  fullWidth?: boolean;
  children: ReactNode;
}

const FOCUS_VISIBLE_CLASSES =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Builds the Classical outline-button class string. Exported separately from
 * the `Button` component so a non-`<button>` consumer that must render the
 * same visual treatment on an `<a>` element (`CartView.tsx` / `EmptyCart.tsx`
 * / `staff/products/page.tsx` link-as-button usages, plan.md §D.3) can apply
 * it without the primitive taking on `<button>`/`<a>` polymorphism it does
 * not otherwise need (Simplicity ladder — CLAUDE.md § Agent Core Behaviors).
 */
export function buttonClassName({
  fullWidth = false,
  className = "",
}: { fullWidth?: boolean; className?: string } = {}): string {
  return [
    "rounded-md border border-accent bg-transparent px-[var(--space-4)] py-[var(--space-2)] text-sm font-medium text-accent",
    "disabled:opacity-60",
    FOCUS_VISIBLE_CLASSES,
    fullWidth ? "w-full" : "inline-block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({ fullWidth = false, className, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClassName({ fullWidth, className })} {...rest}>
      {children}
    </button>
  );
}
