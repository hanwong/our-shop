import type { Metadata } from "next";

import "./globals.css";

/**
 * SPEC-STOREFRONT-001 M1 — the root document shell (REQ-STOREFRONT-001/002).
 *
 * Next.js App Router cannot render any route segment without a root layout, so
 * this file is a prerequisite of the product detail page rather than a
 * side task (spec.md §1).
 *
 * SPEC-AUTH-003 M3 — the previously fully-static shell rendered the shared
 * site header (login-state display only) above `{children}` on every route
 * (REQ-AUTH-041).
 *
 * SPEC-AUTH-004 M1 — the header render moved out of this file entirely, into
 * `src/app/(shop)/layout.tsx` (REQ-AUTH-055~057). This file is a document
 * shell only now — `/staff/**` no longer inherits the customer header
 * because this root layout no longer renders one at all (plan.md §B.3).
 * Footer, global navigation, search, and the cart icon remain excluded —
 * that part of spec.md §3 (SPEC-STOREFRONT-001) is unchanged.
 *
 * @MX:WARN do not (re-)add `<SiteHeader />` to this root layout. Doing so
 * would make `/staff/**` inherit the customer header again, reintroducing
 * SPEC-AUTH-004's defect (an admin ending their own session via the
 * customer logout button). The header belongs only in
 * `src/app/(shop)/layout.tsx`.
 * @MX:NOTE this comment previously stated that only the header line was
 * narrowly amended by SPEC-AUTH-003, leaving footer/search/cart/category-nav
 * excluded (spec.md §1.4's 7-row table). SPEC-AUTH-004 M1 goes further: the
 * header no longer lives in this file at all — it moved to
 * `src/app/(shop)/layout.tsx`. Footer, search, category navigation, and the
 * cart icon remain excluded here exactly as before.
 */

/*
 * Typography comes from the system font stack in globals.css rather than
 * `next/font/google`.
 *
 * plan.md §A named next/font/google, with §K R7 recording the build-time
 * network fetch it introduces and pre-authorizing the system stack as the
 * reversible alternative that still satisfies REQ-STOREFRONT-001's "basic
 * typography". That fallback is taken here, for a second reason R7 did not
 * anticipate: `next/font` needs the Next.js SWC font loader, which vitest does
 * not run, so importing it made this shell untestable ("Inter is not a
 * function"). The system stack keeps the requirement satisfied, keeps the
 * shell testable, and removes the offline/CI build dependency R7 flagged.
 */

export const metadata: Metadata = {
  title: "our-shop",
  description: "간편하게 둘러보고 빠르게 구매하는 온라인 상점",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
