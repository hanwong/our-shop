import { cookies } from "next/headers";

import { GUEST_CART_COOKIE_NAME } from "@/lib/auth/guest-identity";
import { resolveSession } from "@/lib/auth/session-resolver";
import type { CartIdentity } from "@/features/cart/types/cart";
import { getCart } from "@/features/cart/services/cart-service";
import { CheckoutInteractive } from "@/components/checkout/CheckoutInteractive";
import { CheckoutUnavailable } from "@/components/checkout/CheckoutUnavailable";
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
 * IDENTITY HERE IS TWO COOKIE READS AND NO JUDGEMENT BETWEEN THEM
 * (SPEC-ORDER-004 M5, design.md §5.1). The screen still verifies no token,
 * mints no id, and applies no precedence rule of its own — the session cookie
 * and the guest cookie are read in a fixed order, and the first one that
 * resolves is the identity. That is the whole reason this screen does not
 * become a second ownership surface able to drift from the one the cart
 * service owns. AC-ORDER-021 (c) still holds: the cart domain's own
 * identity-resolution helpers appear nowhere under this route.
 *
 * SPEC-ORDER-001 built the guest path only, on the reasoning that a member's
 * access token lives in client memory and so cannot ride a top-level
 * navigation. That reasoning was sound and its conclusion is now obsolete:
 * SPEC-ORDER-004 resolves the member from the `refresh_token` COOKIE, which
 * does ride one (design.md §3.2). Member checkout is in scope as of this SPEC.
 *
 * `cookies()` makes this a request-time render, which is what we want: a cached
 * checkout page would show one shopper's cart to another.
 */
export default async function CheckoutPage() {
  const jar = await cookies();

  // SESSION FIRST, GUEST COOKIE SECOND — and the order is load-bearing rather
  // than stylistic (design.md §5.1). Reversed, a member still carrying a guest
  // cookie for any reason would open the order form on their OLD guest cart
  // instead of the member cart login merged their items into. Login expires
  // the guest cookie unconditionally, so that should never arise — which is
  // precisely why this must hold by construction rather than by that expiry
  // happening to land. The read is a session lookup, not a judgement: it
  // answers null for every failure reason alike.
  const session = await resolveSession(jar);

  let identity: CartIdentity;
  if (session !== null) {
    identity = { kind: "user", userId: session.userId };
  } else {
    // Reached ONLY when no session resolved, so for a member the guest cookie
    // is never read at all — there are never two candidate identities in hand
    // to choose between (AC-ORDER-065). The NAME is imported, never re-typed:
    // two copies of it are two places for the identity to diverge
    // (AC-ORDER-021 (d)).
    const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null;

    // No session and no cookie means no identity, and no identity means there
    // is no cart to look up — a tautology rather than an inference, so nothing
    // is queried. A server component cannot set cookies anyway, so minting one
    // here would be doubly pointless; issuing is the route handler's job
    // (design.md §6.2).
    if (guestId === null) {
      return <CheckoutUnavailable />;
    }
    identity = { kind: "guest", guestId };
  }

  // One lookup, under whichever identity resolved. The empty-cart branch below
  // is shared rather than duplicated per identity: having a session is not
  // having something to order.
  const cart = await getCart(identity);
  if (cart.items.length === 0) {
    return <CheckoutUnavailable />;
  }

  // Computed once, here, and shown and submitted from the same values, so the
  // figure the shopper confirms is exactly the one the server compares against
  // (REQ-ORDER-014).
  const itemsSubtotal = cart.subtotal;
  const shippingFee = calculateShippingFee(itemsSubtotal);
  // No `totalAmount` computed here any more (SPEC-DISCOUNT-001 M6b):
  // CheckoutInteractive is the single owner of the discount-inclusive total
  // now — it derives `itemsSubtotal - discountAmount + shippingFee` itself
  // once a coupon is (or is not) applied, so a value computed here would be
  // stale the moment a coupon changes it.

  // Minted server-side per render and carried in the form (design.md §5). A
  // refresh yields a new key, which is intended: the key exists to absorb a
  // duplicate DELIVERY of one submission, not to stop a shopper ordering again.
  const idempotencyKey = generateIdempotencyKey();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">주문서 작성</h1>

      <div className="mt-8">
        {/* SPEC-DISCOUNT-001 M6b — CheckoutInteractive is the single client
            component that owns coupon-application state and composes the
            coupon input with OrderSummary + CheckoutForm (design.md §5): a
            server component cannot hold client state, and two independent
            client components could not share it without this common owner. */}
        <CheckoutInteractive
          cart={cart}
          itemsSubtotal={itemsSubtotal}
          shippingFee={shippingFee}
          idempotencyKey={idempotencyKey}
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
