import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-PAYMENT-001 M2 — src/features/payments/repositories/payment-repository.ts
 *
 * Traces: REQ-PAYMENT-001 (one audit-log row per transition), REQ-PAYMENT-002
 * (append-only — no update/delete export), REQ-PAYMENT-004 (paymentKey
 * attribution lookup), REQ-PAYMENT-014 (cancel restores stock), REQ-PAYMENT-
 * 016/017 (idempotency + conditional-transition shape). design.md §2/§2.1/§3.
 *
 * No live PostgreSQL in this sandbox (research.md §7) — @/lib/db is mocked at
 * the delegate level, the same seam tests/unit/cart/cart-repository.test.ts
 * already mocks. markOrderPaid / markOrderCancelledAndRestoreStock take an
 * explicit transaction client (design.md §2.1), so those tests pass a fake tx
 * object directly rather than mocking the module singleton.
 */

const order = { findUnique: vi.fn() };
const paymentAuditLog = { create: vi.fn(), findUnique: vi.fn() };

vi.mock("@/lib/db", () => ({ prisma: { order, paymentAuditLog } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("payment-repository — findOrderById", () => {
  it("queries by id and selects the payment-relevant fields", async () => {
    order.findUnique.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 1000,
      paymentKey: null,
    });
    const { findOrderById } = await import("@/features/payments/repositories/payment-repository");

    const result = await findOrderById("o1");

    const arg = order.findUnique.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ id: "o1" });
    expect(result).toEqual({ id: "o1", status: "pending_payment", totalAmount: 1000, paymentKey: null });
  });

  it("returns null when no order matches", async () => {
    order.findUnique.mockResolvedValue(null);
    const { findOrderById } = await import("@/features/payments/repositories/payment-repository");

    expect(await findOrderById("missing")).toBeNull();
  });

  it("queries the given transaction client instead of the singleton when provided", async () => {
    const txOrder = {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "o2", status: "paid", totalAmount: 500, paymentKey: "PK" }),
    };
    const tx = { order: txOrder } as never;
    const { findOrderById } = await import("@/features/payments/repositories/payment-repository");

    await findOrderById("o2", tx);

    expect(txOrder.findUnique).toHaveBeenCalledTimes(1);
    expect(order.findUnique).not.toHaveBeenCalled();
  });
});

describe("payment-repository — markOrderPaid (REQ-PAYMENT-017 conditional transition)", () => {
  it("writes status+paymentKey conditioned on status=pending_payment", async () => {
    const txOrder = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const tx = { order: txOrder } as never;
    const { markOrderPaid } = await import("@/features/payments/repositories/payment-repository");

    const count = await markOrderPaid(tx, { orderId: "o1", paymentKey: "PK1" });

    expect(count).toBe(1);
    expect(txOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "pending_payment" },
      data: { status: "paid", paymentKey: "PK1" },
    });
  });

  it("returns count 0 without throwing when the condition does not match (idempotent signal)", async () => {
    const txOrder = { updateMany: vi.fn().mockResolvedValue({ count: 0 }) };
    const tx = { order: txOrder } as never;
    const { markOrderPaid } = await import("@/features/payments/repositories/payment-repository");

    expect(await markOrderPaid(tx, { orderId: "o1", paymentKey: "PK1" })).toBe(0);
  });
});

describe("payment-repository — markOrderCancelledAndRestoreStock (REQ-PAYMENT-014, same-transaction)", () => {
  it("restores stock for every item only when the conditional transition applied", async () => {
    const txOrder = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const txOrderItem = {
      findMany: vi.fn().mockResolvedValue([
        { productId: "p1", quantity: 3 },
        { productId: "p2", quantity: 1 },
      ]),
    };
    const txProduct = { update: vi.fn().mockResolvedValue({}) };
    const tx = { order: txOrder, orderItem: txOrderItem, product: txProduct } as never;
    const { markOrderCancelledAndRestoreStock } = await import(
      "@/features/payments/repositories/payment-repository"
    );

    const count = await markOrderCancelledAndRestoreStock(tx, "o1");

    expect(count).toBe(1);
    expect(txOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "paid" },
      data: { status: "cancelled" },
    });
    expect(txProduct.update).toHaveBeenCalledTimes(2);
    expect(txProduct.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { stock: { increment: 3 } },
    });
    expect(txProduct.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { stock: { increment: 1 } },
    });
  });

  it("does not touch items or stock when the order was not paid (count 0)", async () => {
    const txOrder = { updateMany: vi.fn().mockResolvedValue({ count: 0 }) };
    const txOrderItem = { findMany: vi.fn() };
    const txProduct = { update: vi.fn() };
    const tx = { order: txOrder, orderItem: txOrderItem, product: txProduct } as never;
    const { markOrderCancelledAndRestoreStock } = await import(
      "@/features/payments/repositories/payment-repository"
    );

    const count = await markOrderCancelledAndRestoreStock(tx, "o1");

    expect(count).toBe(0);
    expect(txOrderItem.findMany).not.toHaveBeenCalled();
    expect(txProduct.update).not.toHaveBeenCalled();
  });
});

describe("payment-repository — createAuditLog (append-only, REQ-PAYMENT-001)", () => {
  it("creates exactly one row with the transition fields", async () => {
    const txLog = { create: vi.fn().mockResolvedValue({ id: "log-1" }) };
    const tx = { paymentAuditLog: txLog } as never;
    const { createAuditLog } = await import("@/features/payments/repositories/payment-repository");

    await createAuditLog(tx, {
      orderId: "o1",
      source: "CONFIRM_API",
      previousStatus: "pending_payment",
      newStatus: "paid",
      paymentKey: "PK1",
    });

    expect(txLog.create).toHaveBeenCalledTimes(1);
    const { data } = txLog.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).toMatchObject({
      orderId: "o1",
      source: "CONFIRM_API",
      previousStatus: "pending_payment",
      newStatus: "paid",
      paymentKey: "PK1",
    });
  });

  it("defaults transmissionId to null for confirm-path events (design.md §1)", async () => {
    const txLog = { create: vi.fn().mockResolvedValue({ id: "log-1" }) };
    const tx = { paymentAuditLog: txLog } as never;
    const { createAuditLog } = await import("@/features/payments/repositories/payment-repository");

    await createAuditLog(tx, {
      orderId: "o1",
      source: "CONFIRM_API",
      previousStatus: "pending_payment",
      newStatus: "paid",
      paymentKey: "PK1",
    });

    const { data } = txLog.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.transmissionId).toBeNull();
  });
});

describe("payment-repository — findAuditLogByTransmissionId (idempotency lookup)", () => {
  it("looks up by the unique transmissionId", async () => {
    paymentAuditLog.findUnique.mockResolvedValue({ id: "log-1" });
    const { findAuditLogByTransmissionId } = await import(
      "@/features/payments/repositories/payment-repository"
    );

    const result = await findAuditLogByTransmissionId("T1");

    expect(paymentAuditLog.findUnique).toHaveBeenCalledWith({
      where: { transmissionId: "T1" },
      select: { id: true },
    });
    expect(result).toEqual({ id: "log-1" });
  });

  it("returns null when no log carries that transmissionId", async () => {
    paymentAuditLog.findUnique.mockResolvedValue(null);
    const { findAuditLogByTransmissionId } = await import(
      "@/features/payments/repositories/payment-repository"
    );

    expect(await findAuditLogByTransmissionId("unknown")).toBeNull();
  });
});

describe("payment-repository — append-only export surface (AC-PAYMENT-002)", () => {
  it("exports no update/delete/upsert function name for PaymentAuditLog", async () => {
    const repo = await import("@/features/payments/repositories/payment-repository");
    const names = Object.keys(repo);
    const auditLogMutators = names.filter(
      (n) => /audit/i.test(n) && /(update|delete|upsert)/i.test(n)
    );
    expect(auditLogMutators).toEqual([]);
  });
});
