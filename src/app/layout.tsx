import type { Metadata } from "next";

import "./globals.css";

/**
 * SPEC-STOREFRONT-001 M1 — the root document shell (REQ-STOREFRONT-001/002).
 *
 * Next.js App Router cannot render any route segment without a root layout, so
 * this file is a prerequisite of the product detail page rather than a
 * side task (spec.md §1).
 *
 * Minimal on purpose: header, footer, global navigation, search, and the cart
 * icon are all excluded by spec.md §3. This shell declares the document
 * language, the base typography, the global stylesheet, and the site-level
 * metadata — nothing else.
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
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
