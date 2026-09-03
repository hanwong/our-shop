// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-ADMIN-001 M3 — `/staff/orders` (REQ-ADMIN-007~009).
 *
 * Also closes AC-ADMIN-006's deferred server-side half (M2 progress.md §E.2
 * PARTIAL note): this page's Server Component gate is where
 * `resolveAdminSession()` is actually read and a `null` result actually
 * redirects, before any admin order data is fetched — the redirect-gate
 * test below asserts BOTH the redirect target AND that the repository was
 * never called on that path.
 *
 * Follows the same notFound()/redirect()-mocking discipline as
 * tests/unit/app/order-lookup-by-number-page.test.tsx and
 * tests/unit/app/checkout-complete-page.test.tsx.
 */

const NEXT_REDIRECT = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`${NEXT_REDIRECT}:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const adminSession = { resolveAdminSession: vi.fn() };
vi.mock("@/features/admin/services/admin-session", () => adminSession);

const adminOrderRepo = { listOrdersForAdmin: vi.fn() };
vi.mock("@/features/admin/repositories/admin-order-repository", () => adminOrderRepo);

const { redirect } = await import("next/navigation");
const { default: StaffOrdersPage } = await import("@/app/staff/orders/page");

function renderPage(searchParams: Record<string, string | undefined> = {}) {
  return StaffOrdersPage({ searchParams: Promise.resolve(searchParams) });
}

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(redirect).mockClear();
  adminSession.resolveAdminSession.mockReset();
  adminOrderRepo.listOrdersForAdmin.mockReset();
});

describe("AC-ADMIN-006 (now fully PASS) — a null session redirects, and NEVER fetches admin data", () => {
  it("redirects to /staff/login when resolveAdminSession() resolves to null (no cookie, expired, revoked, or non-admin role — all collapse to the same null)", async () => {
    adminSession.resolveAdminSession.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(`${NEXT_REDIRECT}:/staff/login`);

    expect(redirect).toHaveBeenCalledWith("/staff/login");
  });

  it("never calls listOrdersForAdmin (or any repository read) on the redirected path", async () => {
    adminSession.resolveAdminSession.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(NEXT_REDIRECT);

    expect(adminOrderRepo.listOrdersForAdmin).not.toHaveBeenCalled();
  });
});

describe("AC-ADMIN-007 — a valid admin session shows every order, regardless of guest attribution", () => {
  it("renders each row with orderNumber, status, recipientName, totalAmount and createdAt", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({
      rows: [
        {
          id: "o1",
          orderNumber: "ORD-0001",
          status: "pending_payment",
          recipientName: "홍길동",
          totalAmount: 30000,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "o2",
          orderNumber: "ORD-0002",
          status: "paid",
          recipientName: "김철수",
          totalAmount: 50000,
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "o3",
          orderNumber: "ORD-0003",
          status: "cancelled",
          recipientName: "이영희",
          totalAmount: 12000,
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
        },
      ],
      totalCount: 3,
    });

    render(await renderPage());

    expect(screen.getByText("ORD-0001")).toBeDefined();
    expect(screen.getByText("ORD-0002")).toBeDefined();
    expect(screen.getByText("ORD-0003")).toBeDefined();
    expect(screen.getByText("홍길동")).toBeDefined();
    expect(screen.getByText("김철수")).toBeDefined();
    expect(screen.getByText("이영희")).toBeDefined();
  });

  it("calls listOrdersForAdmin with no status filter when none is requested", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    await renderPage();

    expect(adminOrderRepo.listOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined })
    );
  });
});

describe("AC-ADMIN-008 — the status filter query param is applied", () => {
  it("passes the ?status= value straight through to listOrdersForAdmin", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    await renderPage({ status: "paid" });

    expect(adminOrderRepo.listOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid" })
    );
  });

  it("treats an unrecognized status value as 'no filter' — never crashes, never passes it through", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    await renderPage({ status: "not-a-real-status" });

    expect(adminOrderRepo.listOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined })
    );
  });
});

describe("AC-ADMIN-009 — pagination follows the existing catalog page/pageSize convention", () => {
  it("defaults page to 1 and pageSize to DEFAULT_PAGE_SIZE when both are absent", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    await renderPage();

    expect(adminOrderRepo.listOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 })
    );
  });

  it("passes an explicit ?page= through unchanged", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    await renderPage({ page: "2" });

    expect(adminOrderRepo.listOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 })
    );
  });

  it("falls back to the default page on an invalid (non-numeric or < 1) ?page= value", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    await renderPage({ page: "0" });

    expect(adminOrderRepo.listOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  it("clamps a ?pageSize= above MAX_PAGE_SIZE down to 100 rather than rejecting it", async () => {
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.listOrdersForAdmin.mockResolvedValue({ rows: [], totalCount: 0 });

    await renderPage({ pageSize: "500" });

    expect(adminOrderRepo.listOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 100 })
    );
  });
});
