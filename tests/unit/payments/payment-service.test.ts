import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-PAYMENT-001 M2 — src/features/payments/services/payment-service.ts
 *
 * Traces: REQ-PAYMENT-004 (paymentKey attribution + mismatch), REQ-PAYMENT-006
 * (amount check gates the confirm API call), REQ-PAYMENT-007/008 (confirm
 * success/failure/idempotent-replay), REQ-PAYMENT-011/012 (signature gate),
 * REQ-PAYMENT-013/014 (webhook DONE/CANCELED), REQ-PAYMENT-015 (webhook amount
 * mismatch), REQ-PAYMENT-016/017 (idempotency + conditional transition).
 * design.md §2/§3/§3.1/§4/§5.
 *
 * The repository and the Toss adapter are mocked here — this suite asserts
 * the SERVICE's orchestration decisions (call ordering, transaction usage,
 * failure-code mapping), not the database or the HTTP call themselves.
 */

const fakeTx = { __fakeTx: true } as const;

const db = {
  prisma: {
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(fakeTx)),
  },
};
vi.mock("@/lib/db", () => db);

const repo = {
  findOrderById: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderCancelledAndRestoreStock: vi.fn(),
  createAuditLog: vi.fn(),
  findAuditLogByTransmissionId: vi.fn(),
};
vi.mock("@/features/payments/repositories/payment-repository", () => repo);

const tossServer = {
  confirmTossPayment: vi.fn(),
  verifyWebhookSignature: vi.fn(),
};
vi.mock("@/lib/payment/toss-server", () => tossServer);

const { confirmPayment, processWebhook } = await import("@/features/payments/services/payment-service");

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(fakeTx));
  repo.findAuditLogByTransmissionId.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// confirmPayment
// ---------------------------------------------------------------------------

describe("confirmPayment — normal confirm (AC-PAYMENT-007)", () => {
  it("marks the order paid and writes exactly one CONFIRM_API audit log", async () => {
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });
    tossServer.confirmTossPayment.mockResolvedValue({ ok: true });
    repo.markOrderPaid.mockResolvedValue(1);

    const result = await confirmPayment("o1", "PK1", 30000);

    expect(result).toEqual({ ok: true });
    expect(tossServer.confirmTossPayment).toHaveBeenCalledWith({
      orderId: "o1",
      paymentKey: "PK1",
      amount: 30000,
    });
    expect(repo.markOrderPaid).toHaveBeenCalledWith(fakeTx, { orderId: "o1", paymentKey: "PK1" });
    expect(repo.createAuditLog).toHaveBeenCalledTimes(1);
    expect(repo.createAuditLog).toHaveBeenCalledWith(fakeTx, {
      orderId: "o1",
      source: "CONFIRM_API",
      previousStatus: "pending_payment",
      newStatus: "paid",
      paymentKey: "PK1",
    });
  });
});

describe("confirmPayment — amount mismatch (AC-PAYMENT-006)", () => {
  it("never calls the confirm API and never opens a transaction", async () => {
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });

    const result = await confirmPayment("o1", "PK1", 25000);

    expect(result).toEqual({ ok: false, code: "AMOUNT_MISMATCH" });
    expect(tossServer.confirmTossPayment).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});

describe("confirmPayment — confirm API failure leaves the order pending (AC-PAYMENT-008 i)", () => {
  it("returns CONFIRM_API_FAILED without opening a transaction", async () => {
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });
    tossServer.confirmTossPayment.mockResolvedValue({ ok: false, status: 502 });

    const result = await confirmPayment("o1", "PK1", 30000);

    expect(result).toEqual({ ok: false, code: "CONFIRM_API_FAILED" });
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
  });
});

describe("confirmPayment — idempotent replay for an already-paid order (AC-PAYMENT-008 ii)", () => {
  it("returns ok without re-calling the confirm API or writing another audit log", async () => {
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "paid",
      totalAmount: 30000,
      paymentKey: "PK1",
    });

    const result = await confirmPayment("o1", "PK1", 30000);

    expect(result).toEqual({ ok: true });
    expect(tossServer.confirmTossPayment).not.toHaveBeenCalled();
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});

describe("confirmPayment — genuine paymentKey mismatch (REQ-PAYMENT-004)", () => {
  it("logs the mismatch and rejects when the conditional update loses the race", async () => {
    repo.findOrderById
      .mockResolvedValueOnce({
        id: "o1",
        status: "pending_payment",
        totalAmount: 30000,
        paymentKey: null,
      })
      .mockResolvedValueOnce({
        id: "o1",
        status: "paid",
        totalAmount: 30000,
        paymentKey: "OTHER-PK",
      });
    tossServer.confirmTossPayment.mockResolvedValue({ ok: true });
    repo.markOrderPaid.mockResolvedValue(0);

    const result = await confirmPayment("o1", "PK1", 30000);

    expect(result).toEqual({ ok: false, code: "PAYMENT_KEY_MISMATCH" });
    expect(repo.createAuditLog).toHaveBeenCalledTimes(1);
    expect(repo.createAuditLog).toHaveBeenCalledWith(fakeTx, {
      orderId: "o1",
      source: "CONFIRM_API",
      previousStatus: "paid",
      newStatus: "paid",
      paymentKey: "PK1",
    });
  });
});

// ---------------------------------------------------------------------------
// processWebhook
// ---------------------------------------------------------------------------

describe("processWebhook — signature verification gate (AC-PAYMENT-011/012)", () => {
  it("returns invalid-signature and never reaches order lookup when the signature fails", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(false);

    const result = await processWebhook("{}", {
      transmissionTime: "1",
      signature: "bad",
      transmissionId: "T1",
    });

    expect(result).toEqual({ ok: false, reason: "invalid-signature" });
    expect(repo.findAuditLogByTransmissionId).not.toHaveBeenCalled();
    expect(repo.findOrderById).not.toHaveBeenCalled();
  });

  it("proceeds to idempotency + order lookup when the signature is valid", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(true);
    repo.findOrderById.mockResolvedValue(null);

    await processWebhook(
      JSON.stringify({ orderId: "missing", paymentKey: "PK1", amount: 1000, status: "DONE" }),
      { transmissionTime: "1", signature: "good", transmissionId: "T1" }
    );

    expect(repo.findAuditLogByTransmissionId).toHaveBeenCalledWith("T1");
    expect(repo.findOrderById).toHaveBeenCalledWith("missing");
  });
});

describe("processWebhook — DONE transitions a pending order to paid (AC-PAYMENT-013)", () => {
  it("writes one audit log with source WEBHOOK inside the transaction", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(true);
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });
    repo.markOrderPaid.mockResolvedValue(1);

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "DONE" }),
      { transmissionTime: "1", signature: "good", transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: true, outcome: "paid" });
    expect(repo.markOrderPaid).toHaveBeenCalledWith(fakeTx, { orderId: "o1", paymentKey: "PK1" });
    expect(repo.createAuditLog).toHaveBeenCalledWith(fakeTx, {
      orderId: "o1",
      source: "WEBHOOK",
      previousStatus: "pending_payment",
      newStatus: "paid",
      paymentKey: "PK1",
      transmissionId: "T1",
    });
  });
});

describe("processWebhook — CANCELED restores stock and cancels in the same transaction (AC-PAYMENT-014)", () => {
  it("marks cancelled, restores stock, and logs — all inside one prisma.$transaction call", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(true);
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "paid",
      totalAmount: 30000,
      paymentKey: "PK1",
    });
    repo.markOrderCancelledAndRestoreStock.mockResolvedValue(1);

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" }),
      { transmissionTime: "1", signature: "good", transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: true, outcome: "cancelled" });
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(repo.markOrderCancelledAndRestoreStock).toHaveBeenCalledWith(fakeTx, "o1");
    expect(repo.createAuditLog).toHaveBeenCalledWith(fakeTx, {
      orderId: "o1",
      source: "WEBHOOK",
      previousStatus: "paid",
      newStatus: "cancelled",
      paymentKey: "PK1",
      transmissionId: "T1",
    });
  });

  it("is a no-op when the order was not paid (edge case: cancel before pending resolves)", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(true);
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });
    repo.markOrderCancelledAndRestoreStock.mockResolvedValue(0);

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" }),
      { transmissionTime: "1", signature: "good", transmissionId: "T1" }
    );

    expect(result.ok).toBe(true);
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});

describe("processWebhook — amount mismatch logs without transitioning (AC-PAYMENT-015)", () => {
  it("returns ok with outcome amount-mismatch and does not open a transaction", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(true);
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 20000, status: "DONE" }),
      { transmissionTime: "1", signature: "good", transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: true, outcome: "amount-mismatch" });
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(repo.createAuditLog).toHaveBeenCalledTimes(1);
    expect(repo.createAuditLog).toHaveBeenCalledWith(expect.anything(), {
      orderId: "o1",
      source: "WEBHOOK",
      previousStatus: "pending_payment",
      newStatus: "pending_payment",
      paymentKey: "PK1",
      transmissionId: "T1",
    });
  });
});

describe("processWebhook — duplicate resend is a no-op (AC-PAYMENT-016)", () => {
  it("short-circuits on a known transmissionId without touching the order or logging again", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(true);
    repo.findAuditLogByTransmissionId.mockResolvedValue({ id: "log-1" });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" }),
      { transmissionTime: "1", signature: "good", transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: true, outcome: "already-applied" });
    expect(repo.findOrderById).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});

describe("processWebhook — payment-key mismatch on webhook (AC-PAYMENT-004)", () => {
  it("logs the mismatch, does not transition, and still answers ok (200 to PG)", async () => {
    tossServer.verifyWebhookSignature.mockReturnValue(true);
    repo.findOrderById
      .mockResolvedValueOnce({ id: "o1", status: "paid", totalAmount: 30000, paymentKey: "PK1" })
      .mockResolvedValueOnce({ id: "o1", status: "paid", totalAmount: 30000, paymentKey: "PK1" });
    repo.markOrderPaid.mockResolvedValue(0);

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK2", amount: 30000, status: "DONE" }),
      { transmissionTime: "1", signature: "good", transmissionId: "T2" }
    );

    expect(result).toEqual({ ok: true, outcome: "payment-key-mismatch" });
    expect(repo.createAuditLog).toHaveBeenCalledWith(fakeTx, {
      orderId: "o1",
      source: "WEBHOOK",
      previousStatus: "paid",
      newStatus: "paid",
      paymentKey: "PK2",
      transmissionId: "T2",
    });
  });
});
