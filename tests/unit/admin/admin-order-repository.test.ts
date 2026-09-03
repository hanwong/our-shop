import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-ADMIN-001 M3 — src/features/admin/repositories/admin-order-repository.ts
 *
 * Traces: REQ-ADMIN-007 (every order, no guest scoping), REQ-ADMIN-008
 * (optional status filter), REQ-ADMIN-009 (page/pageSize convention reused
 * from product-repository.ts). design.md §3.
 *
 * Mocks @/lib/db at the delegate level, the same seam
 * tests/unit/payments/payment-repository.test.ts already mocks — no live
 * PostgreSQL in this sandbox.
 */

const order = { findMany: vi.fn(), count: vi.fn() };

vi.mock("@/lib/db", () => ({ prisma: { order } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin-order-repository — listOrdersForAdmin (AC-ADMIN-007, no guest scoping)", () => {
  it("queries with an empty where filter when no status is given, and never scopes by guestId", async () => {
    order.findMany.mockResolvedValue([]);
    order.count.mockResolvedValue(0);
    const { listOrdersForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await listOrdersForAdmin({ page: 1, pageSize: 20 });

    const findManyArg = order.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(findManyArg.where).toEqual({});
    expect(findManyArg.where.guestId).toBeUndefined();
    const countArg = order.count.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(countArg.where).toEqual({});
  });

  it("selects exactly the REQ-ADMIN-007 display fields — nothing payment-sensitive or item-related", async () => {
    order.findMany.mockResolvedValue([]);
    order.count.mockResolvedValue(0);
    const { listOrdersForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await listOrdersForAdmin({ page: 1, pageSize: 20 });

    const findManyArg = order.findMany.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(findManyArg.select).toEqual({
      id: true,
      orderNumber: true,
      status: true,
      recipientName: true,
      totalAmount: true,
      createdAt: true,
    });
  });

  it("orders by createdAt desc with id asc as the stable secondary key", async () => {
    order.findMany.mockResolvedValue([]);
    order.count.mockResolvedValue(0);
    const { listOrdersForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await listOrdersForAdmin({ page: 1, pageSize: 20 });

    const findManyArg = order.findMany.mock.calls[0]![0] as { orderBy: unknown };
    expect(findManyArg.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });
});

describe("admin-order-repository — listOrdersForAdmin (AC-ADMIN-008, status filter)", () => {
  it("applies the status filter to BOTH findMany and count when status is provided", async () => {
    order.findMany.mockResolvedValue([]);
    order.count.mockResolvedValue(0);
    const { listOrdersForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await listOrdersForAdmin({ page: 1, pageSize: 20, status: "paid" });

    const findManyArg = order.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(findManyArg.where).toEqual({ status: "paid" });
    const countArg = order.count.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(countArg.where).toEqual({ status: "paid" });
  });
});

describe("admin-order-repository — listOrdersForAdmin (AC-ADMIN-009, pagination convention)", () => {
  it("computes skip/take from page and pageSize with no clamping — trusts the caller", async () => {
    order.findMany.mockResolvedValue([]);
    order.count.mockResolvedValue(0);
    const { listOrdersForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await listOrdersForAdmin({ page: 2, pageSize: 10 });

    const findManyArg = order.findMany.mock.calls[0]![0] as { skip: number; take: number };
    expect(findManyArg.skip).toBe(10);
    expect(findManyArg.take).toBe(10);
  });

  it("returns { rows, totalCount } from the two concurrent queries, matching the ProductsPage shape", async () => {
    const rows = [
      {
        id: "o1",
        orderNumber: "ORD-1",
        status: "pending_payment",
        recipientName: "홍길동",
        totalAmount: 1000,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    order.findMany.mockResolvedValue(rows);
    order.count.mockResolvedValue(1);
    const { listOrdersForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    const result = await listOrdersForAdmin({ page: 1, pageSize: 20 });

    expect(result).toEqual({ rows, totalCount: 1 });
  });
});
