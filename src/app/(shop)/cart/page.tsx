import { cookies } from "next/headers";

import { GUEST_CART_COOKIE_NAME } from "@/lib/auth/guest-identity";
import { getCart } from "@/features/cart/services/cart-service";
import { CartView } from "@/components/cart/CartView";
import { EmptyCart } from "@/components/cart/EmptyCart";

/**
 * SPEC-STOREFRONT-002 M1 — "/cart" (REQ-STOREFRONT-016/017).
 *
 * A thin data adapter, matching the checkout page and the product detail
 * page: read the identity, ask the domain, branch on absence, hand the
 * payload to a pure/client view. The cart SERVICE is called directly
 * rather than this app's own "GET /api/cart" — SPEC-STOREFRONT-001 plan.md
 * §B set that precedent for the product detail page and SPEC-ORDER-001
 * M5 repeated it for "/checkout"; re-entering through HTTP would add a
 * round trip, need a base-URL variable, and drop the CartDTO contract at
 * the JSON boundary.
 *
 * Guest-only, matching "/checkout" (spec.md §1 "회원 신원 — 이 화면들도
 * 게스트 전용이다"): the guest cart cookie is the only identity this
 * screen resolves, by design — no token verification, no member/guest
 * precedence rule, no id minting. `cookies()` makes this a request-time
 * render, so one shopper is never shown another's cart from a cache.
 */
export default async function CartPage() {
  const jar = await cookies();
  const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null;

  // No cookie means no guest id, and no guest id means there is no cart to
  // look up (design.md §0 precedent — CheckoutPage's identical branch). A
  // server component cannot set cookies anyway, so minting one here would
  // be doubly pointless; issuing one is the API route handlers' job.
  if (guestId === null) {
    return <EmptyCart />;
  }

  const cart = await getCart({ kind: "guest", guestId });
  if (cart.items.length === 0) {
    return <EmptyCart />;
  }

  return <CartView initialCart={cart} />;
}
