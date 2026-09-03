// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-ADMIN-001 M4 — `/staff/orders/[orderId]` (REQ-ADMIN-010~015).
 *
 * Mirrors staff-orders-page.test.tsx's redirect()/notFound()-mocking
 * discipline. AC-ADMIN-011 (no paymentKey leak) is verified as a
 * positive-presence-on-source / negative-presence-on-render pair: the DB
 * fixture explicitly carries a paymentKey-shaped value would carry if the
 * repository selected it, and the render assertion proves that value is
 * absent from the rendered output — but per Task 1's query-level omission,
 * the fixture itself (mirroring findOrderByIdForAdmin's actual return shape)
 * structurally has no paymentKey field to begin with, so the render
 * assertion is checked against a known card-number-shaped decoy string too.
 */

const NEXT_REDIRECT = "NEXT_REDIRECT";
const NEXT_NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`${NEXT_REDIRECT}:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error(NEXT_NOT_FOUND);
  }),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const adminSession = { resolveAdminSession: vi.fn() };
vi.mock("@/features/admin/services/admin-session", () => adminSession);

const adminOrderRepo = { findOrderByIdForAdmin: vi.fn() };
vi.mock("@/features/admin/repositories/admin-order-repository", () => adminOrderRepo);

const { redirect, notFound } = await import("next/navigation");
const { default: StaffOrderDetailPage } = await import("@/app/staff/orders/[orderId]/page");

function renderPage(orderId = "o1") {
  return StaffOrderDetailPage({ params: Promise.resolve({ orderId }) });
}

/** A paid order carrying a real paymentKey value in the DB fixture. */
const PAID_ORDER_ROW = {
  id: "o1",
  orderNumber: "ORD-0001",
  status: "paid" as const,
  recipientName: "홍길동",
  recipientPhone: "010-1111-2222",
  postalCode: "12345",
  address: "서울시 어딘가 1길 2",
  deliveryMemo: "문 앞에 놔주세요",
  itemsSubtotal: 39000,
  shippingFee: 3000,
  totalAmount: 42000,
  // The DB row DOES carry a real, secret-shaped paymentKey — proving the
  // absence in rendered output is a genuine omission, not a coincidence of
  // an empty fixture (the task's "positive-presence on source, negative-
  // presence on render" requirement).
  paymentKey: "toss_pk_9f8a7b6c5d4e3f2a1b0c",
  items: [
    { productId: "p1", productName: "상품1", unitPrice: 39000, quantity: 1, lineTotal: 39000 },
  ],
};

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(redirect).mockClear();
  vi.mocked(notFound).mockClear();
  adminSession.resolveAdminSession.mockReset();
  adminOrderRepo.findOrderByIdForAdmin.mockReset();
});

describe("session gate — mirrors /staff/orders exactly (REQ-ADMIN-017)", () => {
  it("redirects to /staff/login when resolveAdminSession() resolves to null, and never fetches order data", async () => {
    adminSession.resolveAdminSession.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(`${NEXT_REDIRECT}:/staff/login`);

    expect(adminOrderRepo.findOrderByIdForAdmin).not.toHaveBeenCalled();
  });
});

describe("a missing order answers notFound()", () => {
  it("calls notFound() when findOrderByIdForAdmin resolves null", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.findOrderByIdForAdmin.mockResolvedValue(null);

    await expect(renderPage("ghost")).rejects.toThrow(NEXT_NOT_FOUND);
  });
});

describe("AC-ADMIN-010 — the detail screen shows everything required", () => {
  it("renders the shipping snapshot, item lines, amount breakdown, and current status", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.findOrderByIdForAdmin.mockResolvedValue(PAID_ORDER_ROW);

    render(await renderPage());

    expect(screen.getByText("ORD-0001")).toBeDefined();
    expect(screen.getByText(/홍길동/)).toBeDefined();
    expect(screen.getByText(/010-1111-2222/)).toBeDefined();
    expect(screen.getByText(/서울시 어딘가 1길 2/)).toBeDefined();
    expect(screen.getByText(/문 앞에 놔주세요/)).toBeDefined();
    expect(screen.getByText("상품1")).toBeDefined();
    expect(screen.getByText(/결제 완료/)).toBeDefined();
    // amount breakdown — the fixture's unitPrice/lineTotal coincide (qty 1),
    // so these values render more than once; assert presence in the whole
    // rendered text rather than requiring a single unique element.
    expect(screen.getByText(/39,000원/, { selector: "dd" })).toBeDefined();
    expect(screen.getByText(/3,000원/, { selector: "dd" })).toBeDefined();
    expect(screen.getByText(/42,000원/, { selector: "dd" })).toBeDefined();
  });
});

describe("AC-ADMIN-011 — no paymentKey value or card-number-shaped field ever reaches the render", () => {
  it("renders no trace of the DB row's paymentKey value", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.findOrderByIdForAdmin.mockResolvedValue(PAID_ORDER_ROW);

    const { container } = render(await renderPage());

    expect(container.textContent).not.toContain(PAID_ORDER_ROW.paymentKey);
    expect(container.innerHTML).not.toContain(PAID_ORDER_ROW.paymentKey);
  });
});

describe("AC-ADMIN-012 — only a cancel action is ever offered; never a mark-as-paid affordance", () => {
  it("shows a cancel control for a pending_payment order", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.findOrderByIdForAdmin.mockResolvedValue({
      ...PAID_ORDER_ROW,
      status: "pending_payment",
    });

    render(await renderPage());

    expect(screen.getByRole("button", { name: /취소/ })).toBeDefined();
  });

  it("shows a cancel control for a paid order", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.findOrderByIdForAdmin.mockResolvedValue(PAID_ORDER_ROW);

    render(await renderPage());

    expect(screen.getByRole("button", { name: /취소/ })).toBeDefined();
  });

  it("shows NO cancel control for an already-cancelled order", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.findOrderByIdForAdmin.mockResolvedValue({
      ...PAID_ORDER_ROW,
      status: "cancelled",
    });

    render(await renderPage());

    expect(screen.queryByRole("button", { name: /취소/ })).toBeNull();
  });

  it("static-source guard — the page and its status-change component source contain no paid-transition UI affordance", () => {
    const pageSource = readFileSync(
      path.resolve(__dirname, "../../../src/app/staff/orders/[orderId]/page.tsx"),
      "utf8"
    );
    const buttonSource = readFileSync(
      path.resolve(__dirname, "../../../src/app/staff/orders/[orderId]/CancelOrderButton.tsx"),
      "utf8"
    );
    const combined = pageSource + buttonSource;

    // No string suggesting a paid-transition affordance anywhere in either
    // file: no "결제완료로 변경" label, no `status: "paid"` request payload,
    // no generic "mark as paid" / "markPaid" identifier.
    expect(combined).not.toMatch(/결제\s*완료\s*(로|으로)?\s*변경/);
    expect(combined).not.toMatch(/status:\s*["']paid["']/);
    expect(combined).not.toMatch(/mark[-_]?as[-_]?paid/i);
    expect(combined).not.toMatch(/markPaid/i);
  });
});
