// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { OrderLookupForm } from "@/components/orders/OrderLookupForm";

/**
 * SPEC-ORDER-003 M2 — the lookup input screen's client form.
 *
 * Traces: AC-ORDER-046 (two inputs, reachable with nothing to render past
 * them), AC-ORDER-047 (a format failure shows per-field errors, wired
 * straight through from the API response — no validation reimplemented
 * here), AC-ORDER-042 (a matching submission renders the result inline).
 *
 * fetch is the ONLY seam mocked: this component decides nothing about
 * validity itself (Section B #1 of the spawn brief — "wire it through, do
 * not re-implement validation in the UI"), so every scenario below is driven
 * entirely by the fetch response shape, matching
 * tests/unit/components/checkout-form.test.tsx's precedent.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function fillAndSubmit(orderNumber: string, recipientPhone: string) {
  fireEvent.change(screen.getByLabelText("주문 번호"), { target: { value: orderNumber } });
  fireEvent.change(screen.getByLabelText("연락처"), { target: { value: recipientPhone } });
  fireEvent.click(screen.getByRole("button", { name: /조회/ }));
}

afterEach(cleanup);
beforeEach(() => {
  fetchMock.mockReset();
});

describe("SPEC-ORDER-003 M2 — the input screen (AC-ORDER-046)", () => {
  it("renders an order number input and a recipient phone input", () => {
    render(<OrderLookupForm />);

    expect(screen.getByLabelText("주문 번호")).toBeDefined();
    expect(screen.getByLabelText("연락처")).toBeDefined();
  });
});

describe("SPEC-ORDER-003 M2 — a format failure shows per-field errors (AC-ORDER-047)", () => {
  it("names both fields and calls the lookup endpoint exactly once", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: "입력값을 다시 확인해 주세요",
          fieldErrors: {
            orderNumber: "필수 입력값입니다",
            recipientPhone: "연락처 형식이 올바르지 않습니다",
          },
        },
        400
      )
    );

    render(<OrderLookupForm />);
    fillAndSubmit("", "not-a-phone");

    expect(await screen.findByText("필수 입력값입니다")).toBeDefined();
    expect(await screen.findByText("연락처 형식이 올바르지 않습니다")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders/lookup",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("SPEC-ORDER-003 M2 — a not-found/mismatch failure shows ONE generic message (REQ-ORDER-036)", () => {
  it("shows the server's generic error text and no field-specific errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "주문 번호 또는 연락처가 일치하지 않습니다", code: "NOT_FOUND" }, 404)
    );

    render(<OrderLookupForm />);
    fillAndSubmit("ORD-20260903-0AB123", "010-0000-0000");

    expect(await screen.findByText("주문 번호 또는 연락처가 일치하지 않습니다")).toBeDefined();
  });
});

describe("SPEC-ORDER-003 M2 — a matching submission renders the result inline (AC-ORDER-042)", () => {
  it("renders the order's number once the lookup succeeds", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          id: "order-1",
          orderNumber: "ORD-20260903-0AB123",
          status: "pending_payment",
          items: [],
          itemsSubtotal: 20000,
          shippingFee: 0,
          totalAmount: 20000,
          couponCode: null,
          discountAmount: 0,
          shipping: {
            recipientName: "홍길동",
            recipientPhone: "010-1234-5678",
            postalCode: "06236",
            address: "서울시 강남구 테헤란로 1",
            deliveryMemo: null,
          },
          createdAt: "2026-09-03T00:00:00.000Z",
        },
        200
      )
    );

    render(<OrderLookupForm />);
    fillAndSubmit("ORD-20260903-0AB123", "010-1234-5678");

    expect(await screen.findByText(/ORD-20260903-0AB123/)).toBeDefined();
    // The form itself is gone — replaced by the result, not shown alongside it.
    expect(screen.queryByLabelText("주문 번호")).toBeNull();
  });
});
