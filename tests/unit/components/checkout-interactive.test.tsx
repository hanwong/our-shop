// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CartDTO } from "@/features/cart/types/cart";

/**
 * SPEC-DISCOUNT-001 M6b — CheckoutInteractive.
 *
 * The client component that owns coupon-application state and composes it
 * with the coupon input + result area, `OrderSummary`, and `CheckoutForm`
 * (design.md §5, plan.md §4 M6(b), AC-DISCOUNT-023/024).
 *
 * `OrderSummary` and `CheckoutForm` are rendered for real here (not mocked) —
 * this file is exactly the seam where the state-lifting problem the SPEC
 * prompt names actually gets exercised: does applying a coupon change what
 * BOTH children receive, in the same render.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { CheckoutInteractive } = await import("@/components/checkout/CheckoutInteractive");

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

const CART = cart([
  {
    id: "i-1",
    productId: "p-1",
    name: "머그컵",
    price: 30000,
    image: null,
    stock: 5,
    quantity: 1,
    lineTotal: 30000,
  },
]);

function renderInteractive() {
  render(
    <CheckoutInteractive cart={CART} itemsSubtotal={30000} shippingFee={0} idempotencyKey="key-1" />
  );
}

function applyCoupon(code: string) {
  fireEvent.change(screen.getByLabelText(/쿠폰 코드/), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: /적용/ }));
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("SPEC-DISCOUNT-001 M6b — AC-DISCOUNT-023 (screen structure)", () => {
  it("renders exactly one coupon code input", () => {
    renderInteractive();

    expect(screen.getAllByLabelText(/쿠폰 코드/)).toHaveLength(1);
  });

  it("renders a result area before any attempt", () => {
    renderInteractive();

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows a discount row once a coupon is successfully applied", async () => {
    renderInteractive();
    fetchMock.mockResolvedValue(jsonResponse(200, { discountAmount: 5000 }));

    applyCoupon("SAVE5000");

    await waitFor(() => expect(document.body.textContent).toMatch(/할인/));
    expect(document.body.textContent).toContain("5,000");
  });

  it("shows no discount row before any coupon is applied", () => {
    renderInteractive();

    expect(document.body.textContent).not.toMatch(/할인/);
  });

  it("disables the Apply button while the input is empty", () => {
    renderInteractive();

    expect(screen.getByRole("button", { name: /적용/ })).toHaveProperty("disabled", true);
  });

  it("disables the Apply button while a validation request is in flight", () => {
    renderInteractive();
    let release: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );

    fireEvent.change(screen.getByLabelText(/쿠폰 코드/), { target: { value: "SAVE10" } });
    fireEvent.click(screen.getByRole("button", { name: /적용/ }));

    expect(screen.getByRole("button", { name: /적용/ })).toHaveProperty("disabled", true);
    release(jsonResponse(200, { discountAmount: 0 }));
  });
});

describe("SPEC-DISCOUNT-001 M6b — AC-DISCOUNT-024 (four distinct rejection messages)", () => {
  const CASES: Array<Record<string, unknown>> = [
    { code: "COUPON_NOT_FOUND" },
    { code: "COUPON_EXPIRED" },
    { code: "COUPON_MINIMUM_NOT_MET", requiredMinimum: 30000 },
    { code: "COUPON_EXHAUSTED" },
  ];

  it("shows four distinct, non-empty, non-raw-code messages", async () => {
    const messages: string[] = [];

    for (const body of CASES) {
      renderInteractive();
      fetchMock.mockResolvedValue(jsonResponse(409, body));
      applyCoupon("SOME-CODE");

      await waitFor(() => expect(screen.getByRole("status").textContent).not.toBe(""));
      messages.push(screen.getByRole("status").textContent ?? "");
      cleanup();
    }

    expect(new Set(messages).size).toBe(4);
    const rawCodes = CASES.map((c) => c.code as string);
    for (const message of messages) {
      expect(message).not.toBe("");
      expect(rawCodes).not.toContain(message);
    }
  });

  it("embeds the required minimum in the COUPON_MINIMUM_NOT_MET message", async () => {
    renderInteractive();
    fetchMock.mockResolvedValue(
      jsonResponse(409, { code: "COUPON_MINIMUM_NOT_MET", requiredMinimum: 30000 })
    );

    applyCoupon("SAVE10");

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/30,000/));
  });
});

describe("SPEC-DISCOUNT-001 M6b — state lifting into CheckoutForm + OrderSummary", () => {
  it("clears a previously-applied discount when a new code is rejected", async () => {
    renderInteractive();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { discountAmount: 5000 }));
    applyCoupon("GOOD");
    await waitFor(() => expect(document.body.textContent).toMatch(/할인/));

    fetchMock.mockResolvedValue(jsonResponse(409, { code: "COUPON_EXHAUSTED" }));
    applyCoupon("BAD");

    await waitFor(() => expect(document.body.textContent).not.toMatch(/할인/));
  });

  it("sends the discounted total and the applied coupon code to /api/orders on submit", async () => {
    renderInteractive();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { discountAmount: 5000 }));
    applyCoupon("SAVE5000");
    await waitFor(() => expect(document.body.textContent).toMatch(/할인/));

    fetchMock.mockResolvedValue(jsonResponse(201, { id: "order-1" }));
    fireEvent.change(screen.getByLabelText(/수령인/), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText(/연락처/), { target: { value: "010-1234-5678" } });
    fireEvent.change(screen.getByLabelText(/우편번호/), { target: { value: "06236" } });
    fireEvent.change(screen.getByLabelText(/^주소/), { target: { value: "서울시" } });
    fireEvent.click(screen.getByRole("button", { name: /주문하기/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/orders", expect.anything()));
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/orders")!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.couponCode).toBe("SAVE5000");
    // 30000 (itemsSubtotal) - 5000 (discountAmount) + 0 (shippingFee)
    expect(body.confirmedTotal).toBe(25000);
  });

  it("submits confirmedTotal === itemsSubtotal when no coupon was ever applied (REQ-DISCOUNT-019)", async () => {
    renderInteractive();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "order-1" }));
    fireEvent.change(screen.getByLabelText(/수령인/), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText(/연락처/), { target: { value: "010-1234-5678" } });
    fireEvent.change(screen.getByLabelText(/우편번호/), { target: { value: "06236" } });
    fireEvent.change(screen.getByLabelText(/^주소/), { target: { value: "서울시" } });
    fireEvent.click(screen.getByRole("button", { name: /주문하기/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/orders", expect.anything()));
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/orders")!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.couponCode).toBeNull();
    expect(body.confirmedTotal).toBe(30000);
  });
});
