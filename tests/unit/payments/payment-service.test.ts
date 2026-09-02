import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-PAYMENT-001 M2 — src/features/payments/services/payment-service.ts
 *
 * Traces: REQ-PAYMENT-004 (paymentKey attribution + mismatch), REQ-PAYMENT-006
 * (amount check gates the confirm API call), REQ-PAYMENT-007/008 (confirm
 * success/failure/idempotent-replay), REQ-PAYMENT-011/012 (Toss Payment Query
 * re-verification — CodeRabbit PR #9 Finding 1 correction), REQ-PAYMENT-
 * 013/014 (webhook DONE/CANCELED), REQ-PAYMENT-015 (webhook amount mismatch),
 * REQ-PAYMENT-016/017 (idempotency + conditional transition).
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
  queryTossPayment: vi.fn(),
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

  it("returns CONFIRM_API_FAILED when the confirm call itself times out (Finding 4 — status 504)", async () => {
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });
    tossServer.confirmTossPayment.mockResolvedValue({ ok: false, status: 504 });

    const result = await confirmPayment("o1", "PK1", 30000);

    expect(result).toEqual({ ok: false, code: "CONFIRM_API_FAILED" });
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
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

describe("processWebhook — duplicate resend short-circuits before any Toss query (AC-PAYMENT-016)", () => {
  it("returns already-applied on a known transmissionId without ever calling queryTossPayment", async () => {
    repo.findAuditLogByTransmissionId.mockResolvedValue({ id: "log-1" });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" }),
      { transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: true, outcome: "already-applied" });
    expect(tossServer.queryTossPayment).not.toHaveBeenCalled();
    expect(repo.findOrderById).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});

describe("processWebhook — malformed payload (post-idempotency-check)", () => {
  it("returns malformed-payload without ever calling queryTossPayment", async () => {
    const result = await processWebhook("not json", { transmissionId: "T1" });

    expect(result).toEqual({ ok: false, reason: "malformed-payload" });
    expect(tossServer.queryTossPayment).not.toHaveBeenCalled();
  });
});

describe("processWebhook — Toss Payment Query re-verification gate (AC-PAYMENT-011/012, Finding 1)", () => {
  it("returns toss-query-failed and never reaches order lookup when the Toss query itself fails", async () => {
    tossServer.queryTossPayment.mockResolvedValue({ ok: false, status: 502 });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 1000, status: "DONE" }),
      { transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: false, reason: "toss-query-failed" });
    expect(tossServer.queryTossPayment).toHaveBeenCalledWith("PK1");
    expect(repo.findOrderById).not.toHaveBeenCalled();
  });

  it("returns query-mismatch and never reaches order lookup when Toss's own record disagrees with the payload's orderId", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "SOMEONE-ELSES-ORDER", status: "DONE", totalAmount: 30000 },
    });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "DONE" }),
      { transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: false, reason: "query-mismatch" });
    expect(repo.findOrderById).not.toHaveBeenCalled();
  });

  it("proceeds to order lookup once Toss's queried record confirms the orderId", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "DONE", totalAmount: 1000 },
    });
    repo.findOrderById.mockResolvedValue(null);

    await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 1000, status: "DONE" }),
      { transmissionId: "T1" }
    );

    expect(repo.findOrderById).toHaveBeenCalledWith("o1");
  });
});

describe("processWebhook — DONE transitions a pending order to paid, driven by the QUERIED record (AC-PAYMENT-013)", () => {
  it("writes one audit log with source WEBHOOK inside the transaction", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "DONE", totalAmount: 30000 },
    });
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });
    repo.markOrderPaid.mockResolvedValue(1);

    // The payload itself claims a DIFFERENT (wrong) amount/status — proof
    // that the transition is driven by the QUERIED record, not the payload.
    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 1, status: "CANCELED" }),
      { transmissionId: "T1" }
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
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "CANCELED", totalAmount: 30000 },
    });
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "paid",
      totalAmount: 30000,
      paymentKey: "PK1",
    });
    repo.markOrderCancelledAndRestoreStock.mockResolvedValue(1);

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" }),
      { transmissionId: "T1" }
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

  it("is a no-op when the order was not actually paid, even with a matching paymentKey (edge case: cancel before pending resolves)", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "CANCELED", totalAmount: 30000 },
    });
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: "PK1",
    });
    repo.markOrderCancelledAndRestoreStock.mockResolvedValue(0);

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" }),
      { transmissionId: "T1" }
    );

    expect(result.ok).toBe(true);
    expect(repo.markOrderCancelledAndRestoreStock).toHaveBeenCalledWith(fakeTx, "o1");
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});

describe("processWebhook — cancel webhook with a paymentKey mismatch does not cancel (Finding 2 regression)", () => {
  it("does not call markOrderCancelledAndRestoreStock, and does not open a transaction, when the queried paymentKey disagrees with the order's stored paymentKey", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK-ATTACKER", orderId: "o1", status: "CANCELED", totalAmount: 30000 },
    });
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "paid",
      totalAmount: 30000,
      paymentKey: "PK-REAL",
    });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK-ATTACKER", amount: 30000, status: "CANCELED" }),
      { transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: true, outcome: "payment-key-mismatch" });
    expect(repo.markOrderCancelledAndRestoreStock).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("also guards a still-unattributed order (order.paymentKey is null)", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "CANCELED", totalAmount: 30000 },
    });
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" }),
      { transmissionId: "T-cancel-early" }
    );

    expect(result).toEqual({ ok: true, outcome: "payment-key-mismatch" });
    expect(repo.markOrderCancelledAndRestoreStock).not.toHaveBeenCalled();
  });
});

describe("processWebhook — PARTIAL_CANCELED is routed to a distinct unhandled branch, never the full-cancel path (Finding 3 regression)", () => {
  it("records an audit log with no actual transition and does not call markOrderCancelledAndRestoreStock or markOrderPaid", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "PARTIAL_CANCELED", totalAmount: 30000 },
    });
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "paid",
      totalAmount: 30000,
      paymentKey: "PK1",
    });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 30000, status: "PARTIAL_CANCELED" }),
      { transmissionId: "T1" }
    );

    expect(result).toEqual({ ok: true, outcome: "unhandled" });
    expect(repo.markOrderCancelledAndRestoreStock).not.toHaveBeenCalled();
    expect(repo.markOrderPaid).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(repo.createAuditLog).toHaveBeenCalledWith(expect.anything(), {
      orderId: "o1",
      source: "WEBHOOK",
      previousStatus: "paid",
      newStatus: "paid",
      paymentKey: "PK1",
      transmissionId: "T1",
    });
  });
});

describe("processWebhook — amount mismatch logs without transitioning, comparing against the QUERIED amount (AC-PAYMENT-015)", () => {
  it("returns ok with outcome amount-mismatch and does not open a transaction", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "DONE", totalAmount: 20000 },
    });
    repo.findOrderById.mockResolvedValue({
      id: "o1",
      status: "pending_payment",
      totalAmount: 30000,
      paymentKey: null,
    });

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK1", amount: 20000, status: "DONE" }),
      { transmissionId: "T1" }
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

describe("processWebhook — payment-key mismatch on the DONE path (AC-PAYMENT-004)", () => {
  it("logs the mismatch, does not transition, and still answers ok (200 to PG)", async () => {
    tossServer.queryTossPayment.mockResolvedValue({
      ok: true,
      payment: { paymentKey: "PK2", orderId: "o1", status: "DONE", totalAmount: 30000 },
    });
    repo.findOrderById
      .mockResolvedValueOnce({ id: "o1", status: "paid", totalAmount: 30000, paymentKey: "PK1" })
      .mockResolvedValueOnce({ id: "o1", status: "paid", totalAmount: 30000, paymentKey: "PK1" });
    repo.markOrderPaid.mockResolvedValue(0);

    const result = await processWebhook(
      JSON.stringify({ orderId: "o1", paymentKey: "PK2", amount: 30000, status: "DONE" }),
      { transmissionId: "T2" }
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
