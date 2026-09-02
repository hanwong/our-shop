import { cookies } from "next/headers";

import { GUEST_CART_COOKIE_NAME } from "@/lib/auth/guest-identity";
import { getCart } from "@/features/cart/services/cart-service";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { CheckoutUnavailable } from "@/components/checkout/CheckoutUnavailable";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import {
  calculateShippingFee,
  generateIdempotencyKey,
} from "@/features/orders/services/order-service";

/**
 * SPEC-ORDER-001 M5 — `/checkout` (REQ-ORDER-005/006/007).
 *
 * A thin data adapter, matching the product detail page: read the identity, ask
 * the domain, branch on absence, hand the payload to pure views. The cart
 * SERVICE is called directly rather than this app's own `GET /api/cart` —
 * SPEC-STOREFRONT-001 plan.md §B set that precedent, and re-entering through
 * HTTP would add a round trip, need a base-URL variable, and drop the CartDTO
 * contract at the JSON boundary.
 *
 * IDENTITY HERE IS ONE COOKIE READ, AND NOTHING ELSE (design.md §6.1). It does
 * not verify a token, does not apply a member/guest precedence rule, and does
 * not mint an id. That is not a shortcut — it is the whole reason this screen
 * does not become a second authorization surface able to drift from the one the
 * cart service owns. What remains is the identity `cookie value === guest id`,
 * which has nothing in it to judge. AC-ORDER-021 (c) pins this by name: the
 * identity-resolution helpers must not appear anywhere under this route.
 *
 * The asymmetry is deliberate and explained in spec.md §3: cookies ride along
 * on a top-level navigation, so a guest identity always arrives, while the
 * member's access token — held in client memory — can never be attached to one.
 * That is why this SPEC builds guest checkout only.
 *
 * `cookies()` makes this a request-time render, which is what we want: a cached
 * checkout page would show one shopper's cart to another.
 */
export default async function CheckoutPage() {
  const jar = await cookies();
  // The NAME is imported, never re-typed: two copies of it are two places for
  // the identity to diverge (AC-ORDER-021 (d)).
  const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null;

  // No cookie means no guest id, and no guest id means there is no cart to look
  // up — a tautology rather than an inference, so nothing is queried. A server
  // component cannot set cookies anyway, so minting one here would be doubly
  // pointless; issuing is the route handler's job (design.md §6.2).
  if (guestId === null) {
    return <CheckoutUnavailable />;
  }

  const cart = await getCart({ kind: "guest", guestId });
  if (cart.items.length === 0) {
    return <CheckoutUnavailable />;
  }

  // Computed once, here, and shown and submitted from the same values, so the
  // figure the shopper confirms is exactly the one the server compares against
  // (REQ-ORDER-014).
  const itemsSubtotal = cart.subtotal;
  const shippingFee = calculateShippingFee(itemsSubtotal);
  const totalAmount = itemsSubtotal + shippingFee;

  // Minted server-side per render and carried in the form (design.md §5). A
  // refresh yields a new key, which is intended: the key exists to absorb a
  // duplicate DELIVERY of one submission, not to stop a shopper ordering again.
  const idempotencyKey = generateIdempotencyKey();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">주문서 작성</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <CheckoutForm idempotencyKey={idempotencyKey} confirmedTotal={totalAmount} />
        <OrderSummary
          cart={cart}
          itemsSubtotal={itemsSubtotal}
          shippingFee={shippingFee}
          totalAmount={totalAmount}
        />
      </div>

      {/* REQ-ORDER-018's counterpart on the entry side: the shopper is told up
          front that submitting does not pay, so the completion screen's notice
          is not a surprise. Payment is a separate SPEC (spec.md §3). */}
      <p className="mt-8 text-xs text-neutral-500">
        주문하기를 누르면 주문이 접수되며, 결제는 아직 진행되지 않습니다.
      </p>
    </main>
  );
}
