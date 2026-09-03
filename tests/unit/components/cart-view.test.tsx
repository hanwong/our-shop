// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CartDTO } from "@/features/cart/types/cart";

/**
 * SPEC-STOREFRONT-002 M2/M3 — src/components/cart/CartView.tsx.
 *
 * Traces: AC-STOREFRONT-019 (absolute PATCH + redraw from the response),
 * AC-STOREFRONT-020 (rejection shown on the failing row only, other state
 * unchanged), AC-STOREFRONT-021 (DELETE + redraw), AC-STOREFRONT-022
 * (checkout entry link), AC-STOREFRONT-030 (accessibility).
 *
 * The whole-cart response contract (plan.md §B) is exercised directly, the
 * same way tests/unit/components/checkout-interactive.test.tsx exercises
 * CheckoutInteractive's fetch/state cycle.
 */

const { CartView } = await import("@/components/cart/CartView");

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function cart(items: CartDTO["items"]): CartDTO {
  return {
    items,
    subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

const ITEM_A = {
  id: "i-1",
  productId: "p-1",
  name: "머그컵",
  price: 10000,
  image: null,
  stock: 5,
  quantity: 2,
  lineTotal: 20000,
};

const ITEM_B = {
  id: "i-2",
  productId: "p-2",
  name: "코스터",
  price: 5000,
  image: null,
  stock: 3,
  quantity: 1,
  lineTotal: 5000,
};

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("CartView — AC-STOREFRONT-019", () => {
  it("PATCHes the absolute quantity to /api/cart/items/:itemId and redraws from the response", async () => {
    render(<CartView initialCart={cart([ITEM_A])} />);
    fetchMock.mockResolvedValue(jsonResponse(200, cart([{ ...ITEM_A, quantity: 3, lineTotal: 30000 }])));

    fireEvent.click(screen.getByRole("button", { name: /머그컵 수량 증가/ }));

    await waitFor(() => expect(document.body.textContent).toContain("30,000"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items/i-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ quantity: 3 }) })
    );
  });

  it("does not trigger a full page navigation on a quantity change", async () => {
    render(<CartView initialCart={cart([ITEM_A])} />);
    fetchMock.mockResolvedValue(jsonResponse(200, cart([{ ...ITEM_A, quantity: 3, lineTotal: 30000 }])));

    fireEvent.click(screen.getByRole("button", { name: /머그컵 수량 증가/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Still the same mounted screen — a navigation would tear this down.
    expect(screen.getByText("머그컵")).toBeDefined();
  });

  it("disables the decrease button at quantity 1", () => {
    render(<CartView initialCart={cart([{ ...ITEM_A, quantity: 1, lineTotal: 10000 }])} />);

    expect(screen.getByRole("button", { name: /머그컵 수량 감소/ })).toHaveProperty("disabled", true);
  });

  it("disables the increase button once quantity reaches stock", () => {
    render(<CartView initialCart={cart([{ ...ITEM_A, quantity: 5, lineTotal: 50000 }])} />);

    expect(screen.getByRole("button", { name: /머그컵 수량 증가/ })).toHaveProperty("disabled", true);
  });
});

describe("CartView — AC-STOREFRONT-020", () => {
  it("shows the rejection on the failing row only, and leaves the cart state unchanged", async () => {
    render(<CartView initialCart={cart([ITEM_A, ITEM_B])} />);
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "재고를 초과했습니다" }));

    fireEvent.click(screen.getByRole("button", { name: /머그컵 수량 증가/ }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("재고를 초과했습니다"));
    // The rejected change never landed.
    expect(document.body.textContent).toContain("20,000");
    // The untouched item is unaffected.
    expect(document.body.textContent).toContain("5,000");
  });

  it("shows a generic message and leaves state unchanged on a network failure", async () => {
    render(<CartView initialCart={cart([ITEM_A])} />);
    fetchMock.mockRejectedValue(new Error("network down"));

    fireEvent.click(screen.getByRole("button", { name: /머그컵 수량 증가/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(document.body.textContent).toContain("20,000");
  });
});

describe("CartView — AC-STOREFRONT-021", () => {
  it("DELETEs the item and redraws with only the remaining item", async () => {
    render(<CartView initialCart={cart([ITEM_A, ITEM_B])} />);
    fetchMock.mockResolvedValue(jsonResponse(200, cart([ITEM_B])));

    fireEvent.click(screen.getByRole("button", { name: /머그컵 삭제/ }));

    await waitFor(() => expect(screen.queryByText("머그컵")).toBeNull());
    expect(screen.getByText("코스터")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items/i-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("shows the empty-cart guidance after deleting the last item, without a reload", async () => {
    render(<CartView initialCart={cart([ITEM_A])} />);
    fetchMock.mockResolvedValue(jsonResponse(200, cart([])));

    fireEvent.click(screen.getByRole("button", { name: /머그컵 삭제/ }));

    await waitFor(() => expect(screen.getByText(/장바구니가 비어 있습니다/)).toBeDefined());
  });
});

describe("CartView — AC-STOREFRONT-022", () => {
  it("shows a checkout entry pointing at /checkout while the cart has items", () => {
    render(<CartView initialCart={cart([ITEM_A])} />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/checkout");
  });
});

describe("CartView — AC-STOREFRONT-030 accessibility", () => {
  it("gives every product image alt text carrying the product name", () => {
    render(
      <CartView
        initialCart={cart([{ ...ITEM_B, image: "https://picsum.photos/seed/a/600/600" }])}
      />
    );

    for (const img of screen.getAllByRole("img")) {
      expect(img.getAttribute("alt")).toBe("코스터");
    }
  });

  it("labels the quantity and delete controls with the product name", () => {
    render(<CartView initialCart={cart([ITEM_A])} />);

    expect(screen.getByLabelText("머그컵 수량 감소")).toBeDefined();
    expect(screen.getByLabelText("머그컵 수량 증가")).toBeDefined();
    expect(screen.getByLabelText("머그컵 삭제")).toBeDefined();
  });

  it("moves keyboard focus onto the stepper and delete controls", () => {
    render(<CartView initialCart={cart([ITEM_A])} />);

    const dec = screen.getByRole("button", { name: /머그컵 수량 감소/ });
    dec.focus();
    expect(document.activeElement).toBe(dec);

    const del = screen.getByRole("button", { name: /머그컵 삭제/ });
    del.focus();
    expect(document.activeElement).toBe(del);
  });
});

describe("CartView / cart source — AC-STOREFRONT-023 static boundary", () => {
  it("declares no shipping/payment fields and calls no /api/orders endpoint", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/cart/CartView.tsx", "utf8");

    expect(source).not.toMatch(/postalCode|recipientName|recipientPhone|cardNumber/i);
    expect(source).not.toMatch(/\/api\/orders/);
  });
});
