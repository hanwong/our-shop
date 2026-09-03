import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GUEST_CART_COOKIE_NAME } from "@/lib/auth/guest-identity";
import { getOrderByNumberForGuest } from "@/features/orders/services/order-service";
import { OrderLookupResultView } from "@/components/orders/OrderLookupResultView";

/**
 * SPEC-ORDER-003 M2 — `/orders/lookup/[orderNumber]` (REQ-ORDER-044, AC-ORDER-048).
 *
 * The COOKIE-BYPASS entry point: a request whose guest cookie already owns
 * this order opens it without presenting the contrast phone value at all.
 * Same discipline as `/checkout/complete/[orderId]/page.tsx` (REQ-ORDER-045
 * — that page is unchanged by this addition, a separate entry point rather
 * than an edit to it):
 *
 * KNOWING THE ORDER NUMBER IS NOT ENOUGH. Ownership is part of the query
 * itself (getOrderByNumberForGuest → findOrderByNumberForGuest), so there is
 * no shape of this page that fetches a stranger's order and then decides not
 * to show it. Every refusal is notFound() — never a distinguishable status,
 * same reasoning as the completion page: a distinct "forbidden" would tell a
 * guesser the order number is real.
 *
 * This is a SEPARATE route from `/orders/lookup` (the phone-based input
 * screen) — reaching this path with a matching cookie needs no form
 * submission at all.
 */
export default async function OrderLookupByNumberPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  const jar = await cookies();
  const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null;

  // No cookie means nothing to match the order's owner against — nothing to
  // look up, the same tautology the completion page and the order form rely
  // on.
  if (guestId === null) {
    notFound();
  }

  const order = await getOrderByNumberForGuest(orderNumber, guestId);
  if (order === null) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">주문 조회</h1>
      <div className="mt-8">
        <OrderLookupResultView order={order} />
      </div>
    </main>
  );
}
