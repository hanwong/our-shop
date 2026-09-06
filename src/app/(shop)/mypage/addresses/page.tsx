import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveSession } from "@/lib/auth/session-resolver";
import { listAddresses } from "@/features/addresses/services/address-service";
import { AddressForm } from "@/components/address/AddressForm";
import { AddressList } from "@/components/address/AddressList";

/**
 * SPEC-ADDRESS-001 M4 — `/mypage/addresses` (REQ-ADDRESS-012/013).
 *
 * @MX:NOTE the repository's FIRST customer-facing member-gated redirect
 * page. The mechanical gate SHAPE (fetch session first, redirect before any
 * data read) is carried over from `src/app/staff/products/page.tsx:84-89` —
 * a DIFFERENT function on a DIFFERENT route tree (`resolveAdminSession()`,
 * not `resolveSession()`), so only the shape is borrowed, not a customer-
 * facing precedent (spec.md §1.3).
 *
 * The gate runs BEFORE any address data is read — data must not be read and
 * then discarded, the same discipline the admin precedent states in its own
 * comment.
 *
 * `redirect("/login")` is called with NO return-path parameter
 * (REQ-ADDRESS-015). `SPEC-AUTH-002`'s REQ-AUTH-029 (Unwanted) forbids this
 * repository from implementing `redirect`/`next` query-parameter handling at
 * all, and `login/page.tsx` always navigates to `"/"` on success regardless
 * of what a query parameter said — so a parameter here would have zero
 * effect even if added. The resulting flow is "미로그인 → /login → 로그인
 * 성공 → /", and the member returns to `/mypage/addresses` by navigating
 * there again. This is a known, accepted UX rough edge (plan.md M4);
 * resolving it is a separate, not-yet-created SPEC's job.
 */
export default async function MyPageAddressesPage() {
  // The gate runs first: data must not be read and then discarded.
  const jar = await cookies();
  const session = await resolveSession(jar);
  if (session === null) {
    redirect("/login");
  }

  const addresses = await listAddresses(session.userId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">배송지 관리</h1>
      <p className="mt-2 text-sm text-neutral-600">
        자주 사용하는 배송지를 저장하고 기본 배송지를 지정할 수 있습니다.
      </p>

      <div className="mt-8">
        <AddressList addresses={addresses} />
      </div>

      <div className="mt-8 rounded-md border border-divider p-4">
        <h2 className="text-lg font-medium text-text">새 배송지 추가</h2>
        <div className="mt-4">
          <AddressForm />
        </div>
      </div>
    </main>
  );
}
