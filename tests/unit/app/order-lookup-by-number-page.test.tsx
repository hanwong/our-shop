// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { OrderDTO } from "@/features/orders/types/order";

/**
 * SPEC-ORDER-003 M2 — `/orders/lookup/[orderNumber]` (REQ-ORDER-044, AC-ORDER-048).
 *
 * The cookie-bypass path: a request whose guest cookie already owns this
 * order opens it WITHOUT presenting the contrast phone value. Follows the
 * same notFound()-only-refusal discipline as
 * `/checkout/complete/[orderId]/page.tsx` (tests/unit/app/checkout-complete-page.test.tsx),
 * so this file mirrors that one's structure closely.
 */

const NEXT_NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error(NEXT_NOT_FOUND);
  }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const orderService = { getOrderByNumberForGuest: vi.fn() };
vi.mock("@/features/orders/services/order-service", () => orderService);

const { notFound } = await import("next/navigation");
const { cookies } = await import("next/headers");
const { default: OrderLookupByNumberPage } = await import("@/app/(shop)/orders/lookup/[orderNumber]/page");

const OWNER_GUEST = "guest-cookie-owner";
const OTHER_GUEST = "guest-cookie-someone-else";

function jarWith(entries: Record<string, string>) {
  return {
    get: (name: string) => (name in entries ? { name, value: entries[name]! } : undefined),
  };
}

const ORDER: OrderDTO = {
  id: "order-1",
  orderNumber: "ORD-20260903-0AB123",
  status: "pending_payment",
  items: [
    { productId: "p-1", productName: "클래식 데님 재킷", unitPrice: 89000, quantity: 1, lineTotal: 89000 },
  ],
  itemsSubtotal: 89000,
  shippingFee: 0,
  totalAmount: 89000,
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
};

function renderPage() {
  return OrderLookupByNumberPage({
    params: Promise.resolve({ orderNumber: "ORD-20260903-0AB123" }),
  });
}

function pageSources(): string[] {
  const root = "src/app/(shop)/orders/lookup/[orderNumber]";
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".tsx") || entry.endsWith(".ts"))
    .map((entry) => readFileSync(join(root, entry), "utf8"));
}

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(notFound).mockClear();
  vi.mocked(cookies).mockReset();
  orderService.getOrderByNumberForGuest.mockReset();
});

describe("SPEC-ORDER-003 M2 — a matching guest cookie opens the order, no phone needed (AC-ORDER-048)", () => {
  it("renders the order snapshot when the presenting cookie owns it", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: OWNER_GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    orderService.getOrderByNumberForGuest.mockResolvedValue(ORDER);

    render(await renderPage());

    expect(screen.getByText(/ORD-20260903-0AB123/)).toBeDefined();
    expect(orderService.getOrderByNumberForGuest).toHaveBeenCalledWith(
      "ORD-20260903-0AB123",
      OWNER_GUEST
    );
  });

  it("never calls the service with a recipient phone — the cookie alone decides ownership", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: OWNER_GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    orderService.getOrderByNumberForGuest.mockResolvedValue(ORDER);

    render(await renderPage());

    const [, secondArg] = orderService.getOrderByNumberForGuest.mock.calls[0]!;
    expect(secondArg).toBe(OWNER_GUEST);
    expect(orderService.getOrderByNumberForGuest.mock.calls[0]).toHaveLength(2);
  });
});

describe("SPEC-ORDER-003 M2 — a DIFFERENT guest's cookie is refused, not shown (AC-ORDER-048)", () => {
  it("404s when the presenting cookie belongs to a different guest", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: OTHER_GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    orderService.getOrderByNumberForGuest.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(NEXT_NOT_FOUND);
    expect(notFound).toHaveBeenCalled();
  });

  it("404s when no guest cookie is presented at all", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({}) as unknown as Awaited<ReturnType<typeof cookies>>
    );

    await expect(renderPage()).rejects.toThrow(NEXT_NOT_FOUND);
    // With no cookie there is no identity to match against, so the lookup is
    // not even attempted — same discipline as the completion page.
    expect(orderService.getOrderByNumberForGuest).not.toHaveBeenCalled();
  });

  it("renders none of the order's contents on the refused path", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: OTHER_GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    orderService.getOrderByNumberForGuest.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(NEXT_NOT_FOUND);

    expect(document.body.textContent).not.toContain("ORD-20260903-0AB123");
    expect(document.body.textContent).not.toContain("클래식 데님 재킷");
    expect(document.body.textContent).not.toContain("홍길동");
  });

  it("has no code path that reads an Authorization header", () => {
    for (const source of pageSources()) {
      expect(source).not.toMatch(/headers\s*\(/);
      expect(source).not.toMatch(/authorization/i);
    }
  });
});
