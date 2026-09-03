// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { OrderDTO } from "@/features/orders/types/order";
import { OrderLookupResultView } from "@/components/orders/OrderLookupResultView";

/**
 * SPEC-ORDER-003 M2 — the shared read-only result view (REQ-ORDER-038 ~ 041).
 *
 * Reuses the completion screen's display pattern (plan.md M2 — "결과 화면은
 * 완료 화면의 표시 항목을 재사용"): the same formatWon shape, the same
 * <dl>/<ul>/<address> structure. Adds order date and a discount line the
 * completion screen does not render; omits <PayButton> and the retry banner,
 * since this screen is read-only (REQ-ORDER-039).
 */

const source = readFileSync("src/components/orders/OrderLookupResultView.tsx", "utf8");

function orderFixture(overrides: Partial<OrderDTO> = {}): OrderDTO {
  return {
    id: "order-1",
    orderNumber: "ORD-20260903-0AB123",
    status: "pending_payment",
    items: [
      {
        productId: "p-1",
        productName: "클래식 데님 재킷",
        unitPrice: 89000,
        quantity: 1,
        lineTotal: 89000,
      },
      { productId: "p-2", productName: "코튼 볼캡", unitPrice: 25000, quantity: 2, lineTotal: 50000 },
    ],
    itemsSubtotal: 139000,
    shippingFee: 0,
    totalAmount: 139000,
    couponCode: null,
    discountAmount: 0,
    shipping: {
      recipientName: "홍길동",
      recipientPhone: "010-1234-5678",
      postalCode: "06236",
      address: "서울시 강남구 테헤란로 1",
      deliveryMemo: "부재 시 경비실",
    },
    createdAt: "2026-09-03T10:30:00.000Z",
    ...overrides,
  };
}

afterEach(cleanup);

describe("SPEC-ORDER-003 M2 — the full snapshot renders (AC-ORDER-042)", () => {
  it("shows the order number, order date, items, totals, and shipping address", () => {
    render(<OrderLookupResultView order={orderFixture()} />);

    expect(screen.getByText(/ORD-20260903-0AB123/)).toBeDefined();
    expect(screen.getByText("클래식 데님 재킷")).toBeDefined();
    expect(screen.getByText("코튼 볼캡")).toBeDefined();
    expect(document.body.textContent).toContain("89,000");
    expect(document.body.textContent).toContain("25,000");
    expect(document.body.textContent).toContain("139,000");
    expect(document.body.textContent).toContain("홍길동");
    expect(document.body.textContent).toContain("서울시 강남구 테헤란로 1");
    expect(document.body.textContent).toContain("06236");
    // Order date — REQ-ORDER-038, absent from the completion screen.
    expect(document.body.textContent).toContain("2026");
  });
});

describe("SPEC-ORDER-003 M2 — sensitive fields never appear (REQ-ORDER-039, AC-ORDER-043)", () => {
  it("has no code path referencing paymentKey, idempotencyKey, guestId, or an internal id field", () => {
    // OrderDTO structurally omits these fields (M1's boundary), so a runtime
    // fixture cannot even carry them — the real guarantee is that this
    // component's source never references the identifiers at all, the same
    // static-scan pattern tests/unit/app/checkout-complete-page.test.tsx uses.
    expect(source).not.toMatch(/paymentKey/i);
    expect(source).not.toMatch(/idempotencyKey/i);
    expect(source).not.toMatch(/guestId/i);
    expect(source).not.toMatch(/\border\.id\b/);
  });
});

describe("SPEC-ORDER-003 M2 — status wording reflects only the stored value (REQ-ORDER-040, AC-ORDER-044)", () => {
  const FORBIDDEN = [
    "배송 준비",
    "상품 준비",
    "준비 중",
    "준비중",
    "발송",
    "출고",
    "배송 중",
    "배송중",
    "배송 완료",
    "배송완료",
    "운송장",
    "송장",
  ];

  it.each(["pending_payment", "paid", "cancelled"] as const)(
    "renders a status notice with none of the forbidden fulfillment phrases for status=%s",
    (status) => {
      const { unmount } = render(<OrderLookupResultView order={orderFixture({ status })} />);

      expect(screen.getByRole("status")).toBeDefined();
      for (const phrase of FORBIDDEN) {
        expect(document.body.textContent).not.toContain(phrase);
      }
      unmount();
    }
  );

  it("shows three DIFFERENT status notices across the three stored values", () => {
    const { unmount: u1, container: c1 } = render(
      <OrderLookupResultView order={orderFixture({ status: "pending_payment" })} />
    );
    const pending = c1.textContent;
    u1();

    const { unmount: u2, container: c2 } = render(
      <OrderLookupResultView order={orderFixture({ status: "paid" })} />
    );
    const paid = c2.textContent;
    u2();

    const { unmount: u3, container: c3 } = render(
      <OrderLookupResultView order={orderFixture({ status: "cancelled" })} />
    );
    const cancelled = c3.textContent;
    u3();

    expect(pending).not.toBe(paid);
    expect(paid).not.toBe(cancelled);
    expect(pending).not.toBe(cancelled);
  });
});

describe("SPEC-ORDER-003 M2 — an unpaid order says so plainly, with no payment action (REQ-ORDER-041, AC-ORDER-045)", () => {
  it("shows an unpaid notice and no completed-payment wording", () => {
    render(<OrderLookupResultView order={orderFixture({ status: "pending_payment" })} />);

    expect(document.body.textContent).toMatch(/결제.*(전|되지 않|대기|미완료)/);
    expect(document.body.textContent).not.toMatch(/결제가 완료|결제 완료되었/);
  });

  it("renders no <PayButton> and no payment-failed retry banner — this screen is read-only", () => {
    render(<OrderLookupResultView order={orderFixture({ status: "pending_payment" })} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(source).not.toMatch(/PayButton/);
    expect(source).not.toMatch(/payment_failed/);
  });
});

describe("SPEC-ORDER-003 M2 — the discount line (plan.md M2 — an addition beyond the completion screen)", () => {
  it("shows the discount amount and coupon code when a discount was applied", () => {
    render(
      <OrderLookupResultView
        order={orderFixture({ couponCode: "SAVE10", discountAmount: 13900, totalAmount: 125100 })}
      />
    );

    expect(document.body.textContent).toContain("13,900");
    expect(document.body.textContent).toContain("SAVE10");
  });

  it("shows no discount line at all when discountAmount is 0", () => {
    render(<OrderLookupResultView order={orderFixture({ couponCode: null, discountAmount: 0 })} />);

    expect(document.body.textContent).not.toContain("할인");
  });
});
