// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-ADMIN-001 M5 — accessibility verification pass across M2-M4's admin UI.
 *
 * Dedicated cross-page file (chosen over extending each per-page test file):
 * this milestone's job is a SWEEP across four already-implemented surfaces
 * (login form, order list, order detail, cancel button), and one file makes
 * that sweep's scope visible in one place rather than scattering four small
 * a11y assertions across four files that already carry their own REQ/AC-
 * scoped suites (staff-login-page.test.tsx, staff-orders-page.test.tsx,
 * staff-order-detail-page.test.tsx). Every check below VERIFIES an existing
 * implementation — per this milestone's brief, none of them found a genuine
 * gap that motivated a UI change (see progress.md §E.2 M5's explicit note).
 */

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const adminSession = { resolveAdminSession: vi.fn() };
vi.mock("@/features/admin/services/admin-session", () => adminSession);

const adminOrderRepo = { listOrdersForAdmin: vi.fn(), findOrderByIdForAdmin: vi.fn() };
vi.mock("@/features/admin/repositories/admin-order-repository", () => adminOrderRepo);

const { default: StaffLoginPage } = await import("@/app/staff/login/page");
const { default: StaffOrdersPage } = await import("@/app/staff/orders/page");
const { default: StaffOrderDetailPage } = await import("@/app/staff/orders/[orderId]/page");
const { CancelOrderButton } = await import("@/app/staff/orders/[orderId]/CancelOrderButton");

const fetchMock = vi.fn();

/** A DETAIL_SELECT-shaped fixture row (matches admin-order-repository.ts's
 * findOrderByIdForAdmin return shape) with an item, so the cancellable
 * ("pending_payment") branch renders the CancelOrderButton. */
const DETAIL_ROW = {
  id: "o1",
  orderNumber: "ORD-0001",
  status: "pending_payment" as const,
  recipientName: "홍길동",
  recipientPhone: "010-1111-2222",
  postalCode: "12345",
  address: "서울시 어딘가 1길 2",
  deliveryMemo: null,
  itemsSubtotal: 39000,
  shippingFee: 3000,
  totalAmount: 42000,
  items: [
    { productId: "p1", productName: "상품1", unitPrice: 39000, quantity: 1, lineTotal: 39000 },
  ],
};

afterEach(cleanup);

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  adminSession.resolveAdminSession.mockReset();
  adminOrderRepo.listOrdersForAdmin.mockReset();
  adminOrderRepo.findOrderByIdForAdmin.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("login form (M2) — labelled inputs + role=alert error", () => {
  it("every input has an associated <label htmlFor> (getByLabelText resolves both fields)", () => {
    render(<StaffLoginPage />);

    // getByLabelText throws if the label/input association is missing —
    // this is a stronger check than a static htmlFor grep, since it
    // exercises the SAME resolution a screen reader performs.
    expect(screen.getByLabelText(/이메일/)).toBeDefined();
    expect(screen.getByLabelText(/비밀번호/)).toBeDefined();
  });

  it("a submit failure renders its message inside a role=\"alert\" element", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid email or password" }),
    });
    render(<StaffLoginPage />);

    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /로그인/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid email or password");
  });
});

describe("order list (M3) — <th scope=\"col\"> headers + labelled nav landmarks", () => {
  it("every column header is a <th scope=\"col\">", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    const { container } = render(await StaffOrdersPage({ searchParams: Promise.resolve({}) }));

    const headers = container.querySelectorAll("th");
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  it("carries a status-filter nav and a pagination nav, each with a distinct aria-label", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    render(await StaffOrdersPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("navigation", { name: "상태 필터" })).toBeDefined();
    expect(screen.getByRole("navigation", { name: "페이지네이션" })).toBeDefined();
  });
});

describe("order detail (M4) — cancel button accessible name + perceivable loading/error state", () => {
  beforeEach(() => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.findOrderByIdForAdmin.mockResolvedValue(DETAIL_ROW);
  });

  it("the cancel button's accessible name is its visible text (\"취소\")", async () => {
    render(await StaffOrderDetailPage({ params: Promise.resolve({ orderId: "o1" }) }));

    expect(screen.getByRole("button", { name: "취소" })).toBeDefined();
  });

  it("CancelOrderButton — disables the button and swaps its visible text while the request is in flight (the disabled + text-swap pattern M2's login button also uses)", async () => {
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<CancelOrderButton orderId="o1" />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "취소 처리 중…" })).toBeDefined();
    });
    expect(screen.getByRole("button", { name: "취소 처리 중…" }).hasAttribute("disabled")).toBe(
      true
    );

    // Drain the in-flight request so it does not leak into the next test.
    resolveFetch({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("CancelOrderButton — a rejected cancellation renders its message inside a role=\"alert\" element", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "이미 취소된 주문입니다" }),
    });

    render(<CancelOrderButton orderId="o1" />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("이미 취소된 주문입니다");
  });

  // Task 4 coverage-gap closing (M5) — CancelOrderButton.tsx measured at
  // 69.23% branch coverage before these two tests (line 63's catch block
  // was never exercised): neither existing test (staff-order-detail-page,
  // nor the two tests above) drove a genuine network failure or a
  // non-JSON error body, so the outer catch{} and the inline
  // `.catch(() => ({}))` fallback were both dead in the coverage report.
  it("CancelOrderButton — a network failure (fetch() rejects) falls back to the generic retry message inside role=\"alert\"", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    render(<CancelOrderButton orderId="o1" />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("주문을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요");
  });

  it("CancelOrderButton — a non-ok response whose body fails to parse as JSON falls back to the generic Korean message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("not json");
      },
    });

    render(<CancelOrderButton orderId="o1" />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("주문을 취소하지 못했습니다");
  });
});
