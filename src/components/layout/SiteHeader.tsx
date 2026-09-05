import { cookies } from "next/headers";
import Link from "next/link";

import { resolveSession } from "@/lib/auth/session-resolver";
import { LogoutButton } from "@/components/layout/LogoutButton";

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
 */
export default async function SiteHeader() {
  const session = await resolveSession(await cookies());

  return (
    <header>
      {session === null ? (
        <Link href="/login">로그인</Link>
      ) : (
        <>
          <span>내 정보</span>
          <LogoutButton />
        </>
      )}
    </header>
  );
}
