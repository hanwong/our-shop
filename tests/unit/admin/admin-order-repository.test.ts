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

const order = { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() };

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

/**
 * SPEC-ADMIN-001 M4 — findOrderByIdForAdmin (REQ-ADMIN-010/011, AC-ADMIN-010/011).
 */
describe("admin-order-repository — findOrderByIdForAdmin (AC-ADMIN-010, detail fields)", () => {
  it("selects exactly the detail fields (shipping snapshot, item lines, amount breakdown, status) — and NEVER paymentKey", async () => {
    order.findUnique.mockResolvedValue(null);
    const { findOrderByIdForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await findOrderByIdForAdmin("o1");

    const arg = order.findUnique.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "o1" });
    expect(arg.select).toEqual({
      id: true,
      orderNumber: true,
      status: true,
      recipientName: true,
      recipientPhone: true,
      postalCode: true,
      address: true,
      deliveryMemo: true,
      itemsSubtotal: true,
      shippingFee: true,
      totalAmount: true,
      items: {
        select: {
          productId: true,
          productName: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    });
  });

  it("AC-ADMIN-011 — the select object carries no paymentKey key at all (query-level omission, not just DTO-level)", async () => {
    order.findUnique.mockResolvedValue(null);
    const { findOrderByIdForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await findOrderByIdForAdmin("o1");

    const arg = order.findUnique.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(Object.prototype.hasOwnProperty.call(arg.select, "paymentKey")).toBe(false);
  });

  it("returns null when no order matches the id", async () => {
    order.findUnique.mockResolvedValue(null);
    const { findOrderByIdForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    expect(await findOrderByIdForAdmin("missing")).toBeNull();
  });

  it("returns the row as-is when a match exists", async () => {
    const row = {
      id: "o1",
      orderNumber: "ORD-1",
      status: "paid",
      recipientName: "홍길동",
      recipientPhone: "010-1111-2222",
      postalCode: "12345",
      address: "서울시 어딘가",
      deliveryMemo: null,
      itemsSubtotal: 10000,
      shippingFee: 3000,
      totalAmount: 13000,
      items: [
        { productId: "p1", productName: "상품1", unitPrice: 10000, quantity: 1, lineTotal: 10000 },
      ],
    };
    order.findUnique.mockResolvedValue(row);
    const { findOrderByIdForAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    expect(await findOrderByIdForAdmin("o1")).toEqual(row);
  });
});

/**
 * SPEC-ADMIN-001 M4 — cancelOrderAsAdmin (REQ-ADMIN-012~015,
 * AC-ADMIN-012/013/014a/014b/015). Mirrors payment-repository.test.ts's
 * markOrderCancelledAndRestoreStock fake-tx pattern exactly — this function
 * takes an explicit transaction client, never the module singleton, so a
 * fake tx object is passed directly rather than mocking @/lib/db further.
 */
describe("admin-order-repository — cancelOrderAsAdmin (AC-ADMIN-012/013, conditional transition)", () => {
  function fakeTx(overrides: {
    currentStatus?: "pending_payment" | "paid" | "cancelled" | null;
    updateCount: number;
    couponCode?: string | null;
    couponRow?: { id: string } | null;
    decrementCount?: number;
    items?: Array<{ productId: string; quantity: number }>;
  }) {
    const txOrder = {
      findUnique: vi
        .fn()
        // First call: pre-image status read. Second call (only reached when
        // updateCount === 1): the couponCode snapshot read.
        .mockResolvedValueOnce(
          overrides.currentStatus === undefined || overrides.currentStatus === null
            ? null
            : { status: overrides.currentStatus }
        )
        .mockResolvedValue({ couponCode: overrides.couponCode ?? null }),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.updateCount }),
    };
    const txOrderItem = { findMany: vi.fn().mockResolvedValue(overrides.items ?? []) };
    const txProduct = { update: vi.fn().mockResolvedValue({}) };
    const txCoupon = {
      findUnique: vi.fn().mockResolvedValue(overrides.couponRow ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.decrementCount ?? 0 }),
    };
    const txPaymentAuditLog = { create: vi.fn().mockResolvedValue({ id: "log-1" }) };
    return {
      tx: {
        order: txOrder,
        orderItem: txOrderItem,
        product: txProduct,
        coupon: txCoupon,
        paymentAuditLog: txPaymentAuditLog,
      } as never,
      txOrder,
      txOrderItem,
      txProduct,
      txCoupon,
      txPaymentAuditLog,
    };
  }

  it("issues the conditional updateMany with source status IN [pending_payment, paid] — never a plain update", async () => {
    const { tx, txOrder } = fakeTx({ currentStatus: "pending_payment", updateCount: 1 });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await cancelOrderAsAdmin(tx, "o1");

    expect(txOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: { in: ["pending_payment", "paid"] } },
      data: { status: "cancelled" },
    });
  });

  it("AC-ADMIN-013 — returns { transitioned: false } and touches nothing further when count !== 1 (already cancelled)", async () => {
    const { tx, txOrderItem, txProduct, txCoupon, txPaymentAuditLog } = fakeTx({
      currentStatus: "cancelled",
      updateCount: 0,
    });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    const result = await cancelOrderAsAdmin(tx, "o1");

    expect(result).toEqual({ transitioned: false });
    expect(txOrderItem.findMany).not.toHaveBeenCalled();
    expect(txProduct.update).not.toHaveBeenCalled();
    expect(txCoupon.findUnique).not.toHaveBeenCalled();
    expect(txCoupon.updateMany).not.toHaveBeenCalled();
    expect(txPaymentAuditLog.create).not.toHaveBeenCalled();
  });

  it("AC-ADMIN-013 — returns { transitioned: false } when the order does not exist at all", async () => {
    const { tx, txProduct, txPaymentAuditLog } = fakeTx({ currentStatus: null, updateCount: 0 });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    const result = await cancelOrderAsAdmin(tx, "missing");

    expect(result).toEqual({ transitioned: false });
    expect(txProduct.update).not.toHaveBeenCalled();
    expect(txPaymentAuditLog.create).not.toHaveBeenCalled();
  });

  it("AC-ADMIN-014a — pending_payment -> cancelled restores stock for every item quantity", async () => {
    const { tx, txProduct } = fakeTx({
      currentStatus: "pending_payment",
      updateCount: 1,
      items: [{ productId: "p1", quantity: 2 }],
    });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    const result = await cancelOrderAsAdmin(tx, "o1");

    expect(result).toEqual({ transitioned: true });
    expect(txProduct.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { stock: { increment: 2 } },
    });
  });

  it("AC-ADMIN-014b — paid -> cancelled restores stock AND releases the coupon redemption when a coupon was applied", async () => {
    const { tx, txProduct, txCoupon } = fakeTx({
      currentStatus: "paid",
      updateCount: 1,
      couponCode: "SAVE10",
      couponRow: { id: "c-1" },
      decrementCount: 1,
      items: [{ productId: "p1", quantity: 1 }],
    });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    const result = await cancelOrderAsAdmin(tx, "o1");

    expect(result).toEqual({ transitioned: true });
    expect(txProduct.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { stock: { increment: 1 } },
    });
    expect(txCoupon.findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } });
    expect(txCoupon.updateMany).toHaveBeenCalledWith({
      where: { id: "c-1", redeemedCount: { gt: 0 } },
      data: { redeemedCount: { decrement: 1 } },
    });
  });

  it("silently skips coupon release when couponCode is set but the coupon row was deleted (findCouponByCode returns null)", async () => {
    const { tx, txCoupon } = fakeTx({
      currentStatus: "paid",
      updateCount: 1,
      couponCode: "GONE",
      couponRow: null,
    });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    const result = await cancelOrderAsAdmin(tx, "o1");

    expect(result).toEqual({ transitioned: true });
    expect(txCoupon.findUnique).toHaveBeenCalled();
    expect(txCoupon.updateMany).not.toHaveBeenCalled();
  });

  it("skips coupon lookup entirely when couponCode is null", async () => {
    const { tx, txCoupon } = fakeTx({
      currentStatus: "pending_payment",
      updateCount: 1,
      couponCode: null,
    });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await cancelOrderAsAdmin(tx, "o1");

    expect(txCoupon.findUnique).not.toHaveBeenCalled();
  });

  it("AC-ADMIN-015 — writes exactly one PaymentAuditLog row: source ADMIN_ACTION, previousStatus captured before the update, newStatus cancelled, paymentKey null", async () => {
    const { tx, txPaymentAuditLog } = fakeTx({ currentStatus: "paid", updateCount: 1 });
    const { cancelOrderAsAdmin } = await import(
      "@/features/admin/repositories/admin-order-repository"
    );

    await cancelOrderAsAdmin(tx, "o1");

    expect(txPaymentAuditLog.create).toHaveBeenCalledTimes(1);
    expect(txPaymentAuditLog.create).toHaveBeenCalledWith({
      data: {
        orderId: "o1",
        source: "ADMIN_ACTION",
        previousStatus: "paid",
        newStatus: "cancelled",
        paymentKey: null,
      },
    });
  });
});
