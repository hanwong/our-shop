"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * SPEC-AUTH-003 M2 — the site header's logout affordance
 * (REQ-AUTH-044/045).
 *
 * @MX:NOTE reads the csrf_token cookie via the SAME inline document.cookie
 * parse `CancelOrderButton.tsx` (src/app/staff/orders/[orderId]) and
 * `ProductForm.tsx` (src/app/staff/products) already use — the client-side
 * half of the double-submit CSRF pattern (`csrf_token` is deliberately not
 * httpOnly; csrf.ts's buildCsrfCookie doc comment). Deliberately NOT
 * extracted into a shared util even though this is now a third consumer:
 * doing so would require editing those two PRESERVE-listed staff files,
 * widening this SPEC's blast radius into the admin surface for no
 * functional gain (plan.md §B.3 / §G anti-pattern #1).
 *
 * Takes no props — it does not know who is logged in, or whether anyone is;
 * SiteHeader alone decides whether to render it (REQ-AUTH-048: no
 * client-side auth-state store here).
 */
function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : "";
}

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    let response: Response;
    try {
      response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": readCsrfToken() },
        credentials: "same-origin",
      });
    } catch {
      // t43 — a network-level failure (offline, DNS failure, etc.) throws
      // from fetch() itself, distinct from a non-200 HTTP response. The
      // no-op-on-failure contract (REQ-AUTH-045) below applies equally
      // here: deliberately empty, no navigation, no refresh, the button
      // stays exactly as it was.
      return;
    }

    // Non-200 (403 CSRF failure or 500) intentionally does nothing further —
    // no navigation, no refresh, the button stays exactly as it was
    // (REQ-AUTH-045). router.push() is never called on any path — a
    // rejected alternative recorded in plan.md §B.4 / §G anti-pattern #8.
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <Button type="button" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}

export default LogoutButton;
