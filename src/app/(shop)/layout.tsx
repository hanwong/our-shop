import SiteHeader from "@/components/layout/SiteHeader";

/**
 * SPEC-AUTH-004 M1 — the `(shop)` route-group layout (REQ-AUTH-055~057).
 *
 * This layout wraps every customer-facing route (home, cart, checkout,
 * login, orders, products, signup) with the shared site header. `/staff/**`
 * sits outside this route group, so it never inherits this layout and never
 * meets `SiteHeader` (plan.md §B.3).
 *
 * @MX:ANCHOR every customer route passes through this layout — a regression
 * here breaks the login-state indicator across the entire customer area, not
 * just one screen (the same rationale SPEC-AUTH-003 gave `SiteHeader`'s own
 * `@MX:ANCHOR` when it was root-layout-scoped; that rationale now applies to
 * this file instead).
 * @MX:NOTE this file's existence IS the bug fix. The header lives here
 * specifically to keep `/staff/**` out of its inheritance path — moving the
 * header back to the root layout (`src/app/layout.tsx`) would reintroduce
 * the exact defect SPEC-AUTH-004 fixes (an admin session ended via the
 * customer logout button, plan.md §A.2).
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
