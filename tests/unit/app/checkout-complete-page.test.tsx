// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { OrderDTO } from "@/features/orders/types/order";

/**
 * SPEC-ORDER-001 M6 — `/checkout/complete/[orderId]`.
 *
 * Traces: AC-ORDER-018 (the order number, the lines at their ORDER-TIME prices,
 * the total, the shipping summary, and an unmistakable notice that payment has
 * not happened) and AC-ORDER-020 (knowing an order id is not enough — the
 * request must present the owning guest cookie, and every other case is a 404
 * rather than a 403).
 */

// notFound() THROWS in the real App Router — that is how it aborts a render and
// never returns. A bare vi.fn() would let the page keep executing past the
// guard and silently diverge from production, so the spy reproduces the throw
// (the precedent tests/unit/app/product-detail-page.test.tsx set).
const NEXT_NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error(NEXT_NOT_FOUND);
  }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const orderService = { getOrderForGuest: vi.fn() };
vi.mock("@/features/orders/services/order-service", () => orderService);

const { notFound } = await import("next/navigation");
const { cookies } = await import("next/headers");
const { default: CheckoutCompletePage } = await import("@/app/(shop)/checkout/complete/[orderId]/page");

const GUEST = "guest-cookie-value";

function jarWith(entries: Record<string, string>) {
  return {
    get: (name: string) => (name in entries ? { name, value: entries[name]! } : undefined),
  };
}

const ORDER: OrderDTO = {
  id: "order-1",
  orderNumber: "ORD-20260831-A1B2C3",
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
  createdAt: "2026-08-31T00:00:00.000Z",
};

function renderPage() {
  return CheckoutCompletePage({ params: Promise.resolve({ orderId: "order-1" }) });
}

function completeSources(): string[] {
  const root = "src/app/(shop)/checkout/complete";
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".tsx") || entry.endsWith(".ts"))
    .map((entry) => readFileSync(join(root, entry), "utf8"));
}

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(notFound).mockClear();
  vi.mocked(cookies).mockReset();
  orderService.getOrderForGuest.mockReset();
});

describe("SPEC-ORDER-001 M6 — the completion screen (AC-ORDER-018)", () => {
  beforeEach(async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    orderService.getOrderForGuest.mockResolvedValue(ORDER);
    render(await renderPage());
  });

  it("shows the order number the shopper can quote in an enquiry", () => {
    expect(screen.getByText(/ORD-20260831-A1B2C3/)).toBeDefined();
  });

  it("lists every line at its ORDER-TIME unit price", () => {
    expect(screen.getByText("클래식 데님 재킷")).toBeDefined();
    expect(screen.getByText("코튼 볼캡")).toBeDefined();
    expect(document.body.textContent).toContain("89,000");
    expect(document.body.textContent).toContain("25,000");
  });

  it("shows the total", () => {
    expect(document.body.textContent).toContain("139,000");
  });

  it("summarises where it is going", () => {
    expect(document.body.textContent).toContain("홍길동");
    expect(document.body.textContent).toContain("서울시 강남구 테헤란로 1");
    expect(document.body.textContent).toContain("06236");
  });

  it("says plainly that payment has NOT happened", () => {
    // The order is pending_payment and this SPEC owns no transition out of it
    // (REQ-ORDER-019). Any wording implying a completed payment would be a
    // false statement to the shopper, not merely imprecise.
    expect(document.body.textContent).toMatch(/결제.*(전|되지 않|대기|미완료)/);
    expect(document.body.textContent).not.toMatch(/결제가 완료|결제 완료되었/);
  });

  it("reads the order under BOTH the id and the presenting guest cookie", () => {
    expect(orderService.getOrderForGuest).toHaveBeenCalledWith("order-1", GUEST);
  });
});

describe("SPEC-ORDER-001 M6 — someone else's order is not readable (AC-ORDER-020)", () => {
  it("404s when a DIFFERENT guest cookie is presented", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: "some-other-guest" }) as unknown as Awaited<
        ReturnType<typeof cookies>
      >
    );
    orderService.getOrderForGuest.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(NEXT_NOT_FOUND);
    expect(notFound).toHaveBeenCalled();
  });

  it("404s when no identity is presented at all", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({}) as unknown as Awaited<ReturnType<typeof cookies>>
    );

    await expect(renderPage()).rejects.toThrow(NEXT_NOT_FOUND);
    // With no cookie there is nothing to match against, so the lookup is not
    // even attempted.
    expect(orderService.getOrderForGuest).not.toHaveBeenCalled();
  });

  it("404s rather than 403s, so the status cannot confirm an id exists", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: "some-other-guest" }) as unknown as Awaited<
        ReturnType<typeof cookies>
      >
    );
    orderService.getOrderForGuest.mockResolvedValue(null);

    // 404 for both "no such order" and "not yours" follows the precedent
    // SPEC-CART-001's findOwnedItem() set (design.md §6.3): a distinguishable
    // status would let a stranger enumerate real order ids.
    await expect(renderPage()).rejects.toThrow(NEXT_NOT_FOUND);
    for (const source of completeSources()) {
      expect(source).not.toMatch(/\b403\b/);
    }
  });

  it("renders none of the order's contents on the refused paths", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: "some-other-guest" }) as unknown as Awaited<
        ReturnType<typeof cookies>
      >
    );
    orderService.getOrderForGuest.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(NEXT_NOT_FOUND);

    expect(document.body.textContent).not.toContain("ORD-20260831-A1B2C3");
    expect(document.body.textContent).not.toContain("클래식 데님 재킷");
    expect(document.body.textContent).not.toContain("홍길동");
  });

  it("has no code path that reads an Authorization header (AC-ORDER-020 (b))", () => {
    // A member presenting a Bearer token gets nothing here — not as a side
    // effect, but because the header is never read. That is the direct
    // consequence of member checkout being out of scope (design.md §6.3), and
    // this static check is the real evidence for it: the render harness has no
    // Request, so the token could not be presented in a behavioural test.
    for (const source of completeSources()) {
      expect(source).not.toMatch(/headers\s*\(/);
      expect(source).not.toMatch(/authorization/i);
    }
  });
});
