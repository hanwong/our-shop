import { cookies } from "next/headers";
import Link from "next/link";

import { resolveSession } from "@/lib/auth/session-resolver";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { SiteHeaderNav } from "@/components/layout/SiteHeaderNav";

/**
 * SPEC-AUTH-003 M1 — the shared site header's single login-state branch
 * (REQ-AUTH-038~043).
 *
 * @MX:ANCHOR rendered by layout.tsx on every route — the sole layout-level
 * consumer of resolveSession(); a regression here breaks the login-state
 * indicator across the entire site, not just one screen.
 * @MX:REASON layout.tsx renders this on every route via the root layout, so
 * any change to its session branching changes what every visitor sees on
 * every page load, not just one screen's behavior.
 *
 * @MX:NOTE calls resolveSession() (src/lib/auth/session-resolver.ts)
 * as-is rather than re-implementing session logic (REQ-AUTH-038/039) —
 * cookie reading, token hashing, and the RefreshToken lookup all stay
 * inside that function. Every null reason (missing cookie / revoked /
 * expired) already collapses to the same `null` there, so this component
 * draws no further distinction beyond `session !== null` (REQ-AUTH-040).
 * Consequence worth knowing: calling resolveSession()/cookies() here makes
 * cookies() the first dynamic API in the tree rooted at the root layout, so
 * every route rendered through it becomes dynamically rendered (plan.md
 * §B.5) — an accepted trade-off, not an oversight.
 *
 * @MX:NOTE SPEC-BRAND-001 M3 (REQ-BRAND-010~013, design.md §3.2) — expanded
 * to render the brand logo and the SHOP/BESPOKE/STORY/CART navigation links
 * around this SAME session branch. The `resolveSession()`/`cookies()` call
 * above and the branch's JSX below are byte-for-byte unchanged from
 * SPEC-AUTH-003 — only relocated into a `sessionBranch` variable handed to
 * the new client-boundary component `SiteHeaderNav`, which owns the mobile
 * hamburger toggle (a `useState` client component). This file stays an
 * `async` server component precisely so `resolveSession()`/`cookies()`
 * still run server-side, preserving the `@MX:ANCHOR` rationale above.
 */
export default async function SiteHeader() {
  const session = await resolveSession(await cookies());

  const sessionBranch =
    session === null ? (
      <Link href="/login" className="text-accent hover:text-accent-2">
        로그인
      </Link>
    ) : (
      <>
        <span className="mr-[var(--space-3)]">내 정보</span>
        <LogoutButton />
      </>
    );

  return (
    /* SPEC-DESIGN-001 M3 (plan.md §C.4/§D.3 — `.nav`/`.nav-brand` Classical
       mapping, VISUAL STYLE ONLY): warm surface background + hairline
       divider border, matching the readme's editorial/booklike register.
       The session branch and every one of its child elements are unchanged
       (AC-AUTH-049 stays untouched — this file still exists ONLY inside
       src/app/(shop)/layout.tsx). `flex flex-wrap items-center
       justify-between` is SPEC-BRAND-001 M3's addition — logo left, nav
       (SiteHeaderNav) right on desktop, wrapping to a second row for the
       mobile dropdown (design.md §3.2). */
    <header className="flex flex-wrap items-center justify-between gap-[var(--space-3)] border-b border-divider bg-surface px-[var(--space-4)] py-[var(--space-3)] font-body text-sm text-text">
      <BrandLogo />
      <SiteHeaderNav sessionBranch={sessionBranch} />
    </header>
  );
}
