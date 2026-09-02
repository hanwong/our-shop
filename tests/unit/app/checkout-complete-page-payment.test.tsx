// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-PAYMENT-001 M4 — the narrow EXTEND of
 * `/checkout/complete/[orderId]` (plan.md §4.1, design.md §6).
 *
 * Traces: AC-PAYMENT-009 (i) a pending_payment order returning with
 * `?payment_failed=1` shows the retry banner and the pay button; AC-PAYMENT-
 * 009 (ii) an already-`paid` or already-`cancelled` order overrides a stale
 * `?payment_failed=1` — the real stored status always wins over the query
 * param (design.md §6's "상태 우선 원칙"). Also covers the 3-way status
 * message branch (pending_payment / paid / cancelled) design.md §6 requires.
 *
 * This file is SPEC-PAYMENT-001's OWN test for its narrow EXTEND of a
 * SPEC-ORDER-001-owned file. It does not replace, and is not replaced by,
 * tests/unit/app/checkout-complete-page.test.tsx — that file stays
 * SPEC-ORDER-001's and is left untouched by this SPEC. plan.md §4.1's
 * diff-0 guarantee covers only the authorization code block (cookie read →
 * getOrderForGuest() → notFound()), not the addition of this new test file.
 */

const NEXT_NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error(NEXT_NOT_FOUND);
  }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const orderService = { getOrderForGuest: vi.fn() };
vi.mock("@/features/orders/services/order-service", () => orderService);

const payButtonSpy = vi.fn();
vi.mock("@/components/checkout/PayButton", () => ({
  PayButton: (props: Record<string, unknown>) => {
    payButtonSpy(props);
    return <button type="button">결제하기(stub)</button>;
  },
}));

const { cookies } = await import("next/headers");
const { default: CheckoutCompletePage } = await import("@/app/checkout/complete/[orderId]/page");

const GUEST = "guest-cookie-value";

function jarWith(entries: Record<string, string>) {
  return {
    get: (name: string) => (name in entries ? { name, value: entries[name]! } : undefined),
  };
}

function baseOrder(status: "pending_payment" | "paid" | "cancelled") {
  return {
    id: "order-1",
    orderNumber: "ORD-20260901-Z9Y8X7",
    status,
    items: [
      { productId: "p-1", productName: "머그컵", unitPrice: 15000, quantity: 1, lineTotal: 15000 },
      { productId: "p-2", productName: "텀블러", unitPrice: 20000, quantity: 1, lineTotal: 20000 },
    ],
    itemsSubtotal: 35000,
    shippingFee: 0,
    totalAmount: 35000,
    shipping: {
      recipientName: "홍길동",
      recipientPhone: "010-1234-5678",
      postalCode: "06236",
      address: "서울시 강남구 테헤란로 1",
      deliveryMemo: null,
    },
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

function renderPage(
  orderId = "order-1",
  searchParams?: Record<string, string | string[] | undefined>
) {
  return CheckoutCompletePage({
    params: Promise.resolve({ orderId }),
    searchParams: searchParams === undefined ? undefined : Promise.resolve(searchParams),
  });
}

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(cookies).mockReset();
  orderService.getOrderForGuest.mockReset();
  payButtonSpy.mockClear();
  vi.mocked(cookies).mockResolvedValue(
    jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
  );
});

describe("status branch — pending_payment (design.md §6)", () => {
  it("shows the pending notice and renders <PayButton> with orderId/amount/orderName", async () => {
    orderService.getOrderForGuest.mockResolvedValue(baseOrder("pending_payment"));
    render(await renderPage());

    expect(document.body.textContent).toMatch(/결제.*(전|되지 않|대기|미완료)/);
    expect(payButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        amount: 35000,
        orderName: "머그컵 외 1건",
      })
    );
  });
});

describe("status branch — paid (design.md §6)", () => {
  it("shows the paid notice and renders no <PayButton>", async () => {
    orderService.getOrderForGuest.mockResolvedValue(baseOrder("paid"));
    render(await renderPage());

    expect(document.body.textContent).toContain("결제가 완료되었습니다");
    expect(payButtonSpy).not.toHaveBeenCalled();
  });
});

describe("status branch — cancelled (design.md §6)", () => {
  it("shows the cancelled notice and renders no <PayButton>", async () => {
    orderService.getOrderForGuest.mockResolvedValue(baseOrder("cancelled"));
    render(await renderPage());

    expect(document.body.textContent).toContain("이 주문은 취소되었습니다");
    expect(payButtonSpy).not.toHaveBeenCalled();
  });
});

describe("retry banner — AC-PAYMENT-009 (i)", () => {
  it("shows the retry banner when pending_payment AND ?payment_failed=1", async () => {
    orderService.getOrderForGuest.mockResolvedValue(baseOrder("pending_payment"));
    render(await renderPage("order-1", { payment_failed: "1" }));

    expect(screen.getByRole("alert")).toBeDefined();
    expect(payButtonSpy).toHaveBeenCalled();
  });

  it("shows no retry banner when ?payment_failed=1 is absent", async () => {
    orderService.getOrderForGuest.mockResolvedValue(baseOrder("pending_payment"));
    render(await renderPage("order-1", {}));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("retry banner — AC-PAYMENT-009 (ii), stored status overrides a stale query param", () => {
  it("does NOT show the retry banner when the order is already paid", async () => {
    orderService.getOrderForGuest.mockResolvedValue(baseOrder("paid"));
    render(await renderPage("order-1", { payment_failed: "1" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.body.textContent).toContain("결제가 완료되었습니다");
  });

  it("does NOT show the retry banner when the order is already cancelled", async () => {
    orderService.getOrderForGuest.mockResolvedValue(baseOrder("cancelled"));
    render(await renderPage("order-1", { payment_failed: "1" }));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
