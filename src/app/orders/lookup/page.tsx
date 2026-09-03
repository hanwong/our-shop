import { OrderLookupForm } from "@/components/orders/OrderLookupForm";

/**
 * SPEC-ORDER-003 M2 — `/orders/lookup` (REQ-ORDER-042, AC-ORDER-046).
 *
 * Reads no cookie, no header, no auth state of any kind — the reason this
 * page is reachable without logging in is that there is no gate here to
 * bypass, matching the discipline `/checkout` sets for identity reads
 * (design.md §6.1). A single screen with two inputs, exactly what
 * REQ-ORDER-042 permits; the cookie-bypass path (REQ-ORDER-044) is a
 * SEPARATE entry point, `/orders/lookup/[orderNumber]`.
 */
export default function OrderLookupPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">주문 조회</h1>
      <p className="mt-2 text-sm text-neutral-600">
        주문 번호와 주문 시 입력한 연락처를 입력해 주세요.
      </p>
      <div className="mt-8">
        <OrderLookupForm />
      </div>
    </main>
  );
}
