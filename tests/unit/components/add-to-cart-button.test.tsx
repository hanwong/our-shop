// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-STOREFRONT-002 M4 — src/components/product/AddToCartButton.tsx.
 *
 * Traces: AC-STOREFRONT-024 (default quantity 1 + button), AC-STOREFRONT-025
 * (success text + /cart link, no navigation), AC-STOREFRONT-026 (rejection
 * reason shown in place), AC-STOREFRONT-027 (disabled while stock is 0, no
 * request issued).
 */

const { AddToCartButton } = await import("@/components/product/AddToCartButton");

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("AddToCartButton — AC-STOREFRONT-024", () => {
  it("renders a quantity input defaulting to 1, with a lower bound of 1, and an add button", () => {
    render(<AddToCartButton productId="p-1" stock={5} />);

    const input = screen.getByLabelText("수량") as HTMLInputElement;
    expect(input.value).toBe("1");
    expect(input.min).toBe("1");
    expect(screen.getByRole("button", { name: /장바구니에 담기/ })).toBeDefined();
  });
});

describe("AddToCartButton — AC-STOREFRONT-025", () => {
  it("shows success text and a /cart link without leaving the page", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], subtotal: 0, itemCount: 2 }));
    render(<AddToCartButton productId="p-1" stock={5} />);

    fireEvent.click(screen.getByRole("button", { name: /장바구니에 담기/ }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/담았습니다/));
    expect(screen.getByRole("link", { name: /장바구니/ }).getAttribute("href")).toBe("/cart");
    // Still the product detail control tree — a real navigation would tear this down.
    expect(screen.getByRole("button", { name: /장바구니에 담기/ })).toBeDefined();
  });

  it("submits the productId and the chosen quantity to POST /api/cart/items", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], subtotal: 0, itemCount: 3 }));
    render(<AddToCartButton productId="p-1" stock={5} />);

    fireEvent.change(screen.getByLabelText("수량"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /장바구니에 담기/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ productId: "p-1", quantity: 3 }),
      })
    );
  });
});

describe("AddToCartButton — AC-STOREFRONT-026", () => {
  it("shows the rejection reason without navigating away", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "재고를 초과했습니다" }));
    render(<AddToCartButton productId="p-1" stock={3} />);

    fireEvent.change(screen.getByLabelText("수량"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /장바구니에 담기/ }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("재고를 초과했습니다"));
    expect(screen.getByRole("button", { name: /장바구니에 담기/ })).toBeDefined();
  });

  it("shows a generic message on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<AddToCartButton productId="p-1" stock={3} />);

    fireEvent.click(screen.getByRole("button", { name: /장바구니에 담기/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });
});

describe("AddToCartButton — AC-STOREFRONT-027", () => {
  it("disables the button and issues no request while stock is 0", () => {
    render(<AddToCartButton productId="p-1" stock={0} />);

    const button = screen.getByRole("button", { name: /장바구니에 담기/ });
    expect(button).toHaveProperty("disabled", true);

    fireEvent.click(button);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
