"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * SPEC-BRAND-001 M3 — the site header's navigation shell (REQ-BRAND-010),
 * client-boundary owner of the mobile hamburger toggle.
 *
 * @MX:NOTE `sessionBranch` is server-rendered JSX handed down from
 * SiteHeader (SPEC-AUTH-003's login-state branch, REQ-BRAND-011/012). This
 * component never re-implements or inspects session state itself — it only
 * decides where that branch renders relative to the nav links.
 *
 * @MX:NOTE one nav-links list, not two: the SAME <nav> element stays
 * mounted in the DOM regardless of the toggle state (design.md §3.2) — a
 * jsdom test with no viewport resolution sees the links either way, since
 * jsdom never evaluates `md:` responsive classes. The `useState` toggle only
 * switches `hidden`/`flex` on that one element below the `md:` breakpoint;
 * `md:flex` on the same element forces it always-visible at `md:` and
 * above, overriding the toggle state there. This avoids the double-render /
 * double-DOM-node hazard a two-list (desktop row + separate mobile
 * dropdown) design would create for `getAllByRole("link")` queries.
 */
const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/shop", label: "SHOP" },
  { href: "/bespoke", label: "BESPOKE" },
  { href: "/story", label: "STORY" },
  { href: "/cart", label: "CART" },
];

export function SiteHeaderNav({ sessionBranch }: { sessionBranch: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-3)] md:flex-nowrap">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="메뉴 열기"
        className="text-text md:hidden"
      >
        ☰
      </button>

      <nav
        className={`${open ? "flex basis-full" : "hidden"} w-full flex-col items-start gap-[var(--space-3)] md:flex md:w-auto md:basis-auto md:flex-row md:items-center`}
      >
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-text hover:text-accent">
            {link.label}
          </Link>
        ))}
        {sessionBranch}
      </nav>
    </div>
  );
}

export default SiteHeaderNav;
