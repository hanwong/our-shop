// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { CartDTO } from "@/features/cart/types/cart";

/**
 * SPEC-ORDER-002 M3 — the order summary tells the shopper what stock says
 * (REQ-ORDER-028, AC-ORDER-030).
 *
 * Until this SPEC the summary rendered name, unit price, quantity and line
 * total, and dropped `CartItemDTO.stock` on the floor — even though the cart
 * had been handing it over all along (spec.md §2 G4). A shopper whose cart held
 * a sold-out line learned that only after filling in the whole shipping form
 * and being refused.
 *
 * The component is pure, so it is rendered directly here rather than through
 * the async page — the same treatment product-detail-view.test.tsx gives
 * ProductDetailView.
 *
 * Note what this does NOT do: no new query. The figure shown is the one the
 * cart already sent (plan.md §3), which is also why it can be stale — see the
 * submit-is-never-blocked criterion in checkout-page.test.tsx.
 */

const { OrderSummary } = await import("@/components/checkout/OrderSummary");

function cart(items: CartDTO["items"]): CartDTO {
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function line(
  name: string,
  { stock, quantity }: { stock: number; quantity: number }
): CartDTO["items"][number] {
  return {
    id: `i-${name}`,
    productId: `p-${name}`,
    name,
    price: 10000,
    image: null,
    stock,
    quantity,
    lineTotal: 10000 * quantity,
  };
}

/** The `<li>` a given product name is rendered in. */
function lineFor(name: string): HTMLElement {
  const element = screen.getByText(name).closest("li");
  if (element === null) throw new Error(`no line rendered for ${name}`);
  return element as HTMLElement;
}

function renderSummary(items: CartDTO["items"]) {
  const built = cart(items);
  render(
    <OrderSummary
      cart={built}
      itemsSubtotal={built.subtotal}
      shippingFee={0}
      totalAmount={built.subtotal}
    />
  );
}

afterEach(cleanup);

describe("SPEC-ORDER-002 M3 — per-line stock state (AC-ORDER-030)", () => {
  /**
   * AC-ORDER-030's three lines: comfortable, short, and gone.
   *
   * The names are ordinary product names on purpose. Naming them after their
   * STATE ("품절", "부족") would make every assertion below match the product
   * name rather than the indicator, so the tests would pass on a component
   * that renders no indicator at all — which is exactly what happened on the
   * first run of this file.
   */
  const THREE_STATES = [
    line("머그컵", { stock: 10, quantity: 1 }),
    line("텀블러", { stock: 2, quantity: 3 }),
    line("티팟", { stock: 0, quantity: 1 }),
  ];

  it("says nothing about a line that has enough stock", () => {
    renderSummary(THREE_STATES);

    // Silence is the correct output here. A "10개 남음" badge on every line
    // would make the two lines that DO need attention harder to notice.
    expect(lineFor("머그컵").textContent).not.toMatch(/재고|품절/);
  });

  it("marks a line short, with the quantity actually available", () => {
    renderSummary(THREE_STATES);

    const short = lineFor("텀블러").textContent ?? "";
    expect(short).toMatch(/재고/);
    // The number matters as much as the label: "not enough" without "2" does
    // not tell the shopper what to change the quantity to.
    expect(short).toMatch(/2/);
  });

  it("marks a line with no stock left as sold out", () => {
    renderSummary(THREE_STATES);

    expect(lineFor("티팟").textContent).toMatch(/품절/);
  });

  it("does not call a sold-out line merely short", () => {
    renderSummary(THREE_STATES);

    // 0 is a different situation from "fewer than you asked for": the shopper
    // cannot fix it by lowering the quantity, only by removing the line.
    expect(lineFor("티팟").textContent).not.toMatch(/재고 부족/);
  });

  it("still shows every line's name, price and total (SPEC-ORDER-001 REQ-ORDER-005)", () => {
    renderSummary(THREE_STATES);

    // The stock notice is an ADDITION. If it had displaced any of what the
    // summary already showed, this SPEC would have broken a prior one.
    for (const name of ["머그컵", "텀블러", "티팟"]) {
      expect(lineFor(name).textContent).toMatch(/10,000원/);
    }
    expect(document.body.textContent).toContain("50,000");
  });

  it("treats a line whose quantity exactly matches stock as fine", () => {
    renderSummary([line("딱맞음", { stock: 3, quantity: 3 })]);

    // stock === quantity is buyable — the conditional decrement uses `gte`, so
    // marking it short here would contradict what the server will do.
    expect(lineFor("딱맞음").textContent).not.toMatch(/재고|품절/);
  });
});
