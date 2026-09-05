import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";

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
 * @MX:WARN do not (re-)add the shared login-state header component to this
 * root layout. Doing so would make `/staff/**` inherit the customer header
 * again, reintroducing SPEC-AUTH-004's defect (an admin ending their own
 * session via the customer logout button). That header component belongs
 * only in `src/app/(shop)/layout.tsx` — AC-AUTH-049 requires this file's
 * source to contain zero references to that component's name, so this
 * comment deliberately does not spell it out.
 * @MX:NOTE this comment previously stated that only the header line was
 * narrowly amended by SPEC-AUTH-003, leaving footer/search/cart/category-nav
 * excluded (spec.md §1.4's 7-row table). SPEC-AUTH-004 M1 goes further: the
 * header no longer lives in this file at all — it moved to
 * `src/app/(shop)/layout.tsx`. Footer, search, category navigation, and the
 * cart icon remain excluded here exactly as before.
 */

/*
 * SPEC-DESIGN-001 M0 — `next/font/google` loads the Classical design
 * system's serif pairing (plan.md §D.1): Cormorant Garamond for headings,
 * Lora for body text.
 *
 * SPEC-DESIGN-001 sync-audit F1 fix (2026-09-05) — this loader call self-
 * hosts the two fonts and applies their className to <html>, but that alone
 * does not make either font render: every visible element lives under
 * <body>, which carries its own explicit `font-family` declaration in
 * globals.css, and CSS inheritance resolves from an element's own rule, not
 * an ancestor's. The actual application point is the `body` / heading rules
 * in `src/app/globals.css` (`var(--font-body)` / `var(--font-heading)`),
 * not this <html> className — this loader call's job is only to fetch and
 * expose the fonts as CSS-consumable values.
 *
 * SPEC-STOREFRONT-001 previously tried `next/font/google` here and reverted
 * to the system font stack, for two reasons (plan.md §K R7, this file's
 * prior revision): (a) the build-time network fetch it introduces, and (b)
 * `next/font` needs the Next.js SWC font loader, which vitest does not run,
 * so importing it made this shell untestable (`<FontName> is not a
 * function`).
 *
 * That prior tradeoff does not hold here. Reason (a) is not a cost unique to
 * this approach — `next/font` self-hosts at build time specifically to
 * remove the *runtime* network request the alternative (`globals.css`
 * `@import`, Classical's own loading method) would carry instead. Reason (b)
 * is resolved, not avoided: `vitest.config.ts` aliases `next/font/google` to
 * a stub (`tests/mocks/next-font-google.ts`) so this shell stays testable
 * with the real import in place (SPEC-DESIGN-001 plan.md §B.5, §F M0).
 *
 * The deciding difference from SPEC-STOREFRONT-001: that SPEC only needed
 * "basic typography", so the system stack satisfied its requirement.  This
 * SPEC's requirement is a specific serif pairing (Cormorant Garamond + Lora)
 * — the system stack is not an option that satisfies it, so the tradeoff
 * that favored reverting there does not apply here.
 */
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});
const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "our-shop",
  description: "간편하게 둘러보고 빠르게 구매하는 온라인 상점",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${cormorantGaramond.className} ${lora.className}`}>
      {/* SPEC-DESIGN-001 M3 cascade follow-up (plan.md §D.1b "흰 배경 → var(--color-bg)"):
          AC-DESIGN-010 requires all 15 pages to inherit the Classical
          background/text tokens from this single point. `bg-white` is a
          literal Tailwind color with no Classical mapping (unlike
          `text-neutral-900`, which M1's @theme override already redirects to
          Classical's warm ink color) — `bg-bg`/`text-text` complete that
          inheritance. Layout.tsx is not itself an M3 file, but this one-line
          swap is what M3's own AC-DESIGN-010 depends on; see progress.md
          §E.2 M3 for the scope rationale. */}
      <body className="bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}
