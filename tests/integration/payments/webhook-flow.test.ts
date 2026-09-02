import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-PAYMENT-001 M5 — the confirm/webhook path driven end to end through the
 * real route handlers against an in-memory database.
 *
 * Traces: AC-PAYMENT-001 (one audit-log row per transition), AC-PAYMENT-007
 * (confirm success -> paid), AC-PAYMENT-011/012 (Toss Payment Query
 * re-verification gate — CodeRabbit PR #9 Finding 1 correction), AC-PAYMENT-
 * 013 (DONE webhook -> paid), AC-PAYMENT-014 (CANCELED webhook restores
 * stock, same transaction), AC-PAYMENT-016 (webhook resend is a no-op).
 *
 * Nothing is mocked at the repository or service seam: the fake below stands
 * in for PostgreSQL only. Only the OUTBOUND network calls — `confirmTossPayment`
 * AND `queryTossPayment` — are replaced, because this suite has no live Toss
 * endpoint to call (the same reasoning that already applied to
 * `confirmTossPayment` before this correction; `queryTossPayment` is the same
 * kind of outbound call, just for the webhook path instead of the confirm
 * path).
 *
 * THE FAKE IMPLEMENTS ROLLBACK (matching SPEC-ORDER-001's own integration
 * fake, tests/integration/orders/create-order.test.ts) — `$transaction`
 * snapshots the whole store and restores it if the callback throws. This is
 * what makes "the cancel path restores stock and writes its audit log in one
 * transaction" (design.md §0#4 / AC-PAYMENT-014) a property the fake can
 * actually falsify rather than assume.
 *
 * WHAT THIS STILL CANNOT PROVE (acceptance.md §0 / AC-004-EXCL-CONCURRENCY):
 * with no live PostgreSQL there is no evidence about a confirm-redirect and a
 * webhook genuinely racing at the database's row-lock level. A green run here
 * is evidence that both paths write through the same conditional
 * `updateMany` and that a losing `count !== 1` never mutates state — never
 * that concurrent arrival is serialized by a real lock.
 */

interface FakeOrder {
  id: string;
  status: "pending_payment" | "paid" | "cancelled";
  totalAmount: number;
  paymentKey: string | null;
}
interface FakeOrderItem {
  orderId: string;
  productId: string;
  quantity: number;
}
interface FakeProduct {
  id: string;
  stock: number;
}
interface FakeAuditLog {
  id: string;
  orderId: string;
  source: "CONFIRM_API" | "WEBHOOK";
  previousStatus: string;
  newStatus: string;
  paymentKey: string | null;
  transmissionId: string | null;
}

interface Store {
  orders: FakeOrder[];
  orderItems: FakeOrderItem[];
  products: FakeProduct[];
  auditLogs: FakeAuditLog[];
  seq: number;
}

let store: Store;

/**
 * One client surface, shared between the module singleton and the object
 * `$transaction` hands its callback — same pattern as
 * tests/integration/orders/create-order.test.ts.
 */
const client = {
  order: {
    findUnique: ({ where }: { where: { id: string } }) => {
      const order = store.orders.find((o) => o.id === where.id);
      return order
        ? {
            id: order.id,
            status: order.status,
            totalAmount: order.totalAmount,
            paymentKey: order.paymentKey,
          }
        : null;
    },
    // The conditional transition payment-repository.ts relies on
    // (REQ-PAYMENT-017): a status precondition that must match or nothing
    // changes.
    updateMany: ({
      where,
      data,
    }: {
      where: { id: string; status: string };
      data: { status: string; paymentKey?: string };
    }) => {
      const order = store.orders.find((o) => o.id === where.id);
      if (!order || order.status !== where.status) return { count: 0 };
      order.status = data.status as FakeOrder["status"];
      if (data.paymentKey !== undefined) order.paymentKey = data.paymentKey;
      return { count: 1 };
    },
  },
  orderItem: {
    findMany: ({ where }: { where: { orderId: string } }) =>
      store.orderItems
        .filter((i) => i.orderId === where.orderId)
        .map((i) => ({ productId: i.productId, quantity: i.quantity })),
  },
  product: {
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: { stock: { increment: number } };
    }) => {
      const product = store.products.find((p) => p.id === where.id)!;
      product.stock += data.stock.increment;
      return product;
    },
  },
  paymentAuditLog: {
    findUnique: ({ where }: { where: { transmissionId: string } }) => {
      const row = store.auditLogs.find((l) => l.transmissionId === where.transmissionId);
      return row ? { id: row.id } : null;
    },
    create: ({ data }: { data: Omit<FakeAuditLog, "id"> }) => {
      const row: FakeAuditLog = { id: `audit-${++store.seq}`, ...data };
      store.auditLogs.push(row);
      return { id: row.id };
    },
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    ...client,
    /**
     * Snapshot, run, and restore on throw — the same rollback property
     * SPEC-ORDER-001's integration fake asserts. Without it, "the cancel
     * effects land atomically" (AC-PAYMENT-014) would be assumed rather than
     * verified.
     */
    $transaction: async <T>(callback: (tx: typeof client) => Promise<T>): Promise<T> => {
      const snapshot = structuredClone(store);
      try {
        return await callback(client);
      } catch (error) {
        store = snapshot;
        throw error;
      }
    },
  },
}));

// Only the OUTBOUND HTTP calls are replaced. Everything else (idempotency
// lookup, order lookup, amount comparison, conditional transition) runs for
// real against the fake store above.
vi.mock("@/lib/payment/toss-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment/toss-server")>();
  return { ...actual, confirmTossPayment: vi.fn(), queryTossPayment: vi.fn() };
});

async function postWebhook(payload: Record<string, unknown>, transmissionId: string) {
  const rawBody = JSON.stringify(payload);
  const { POST } = await import("@/app/api/payments/webhook/route");
  return POST(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: { "tosspayments-webhook-transmission-id": transmissionId },
      body: rawBody,
    })
  );
}

async function getConfirm(orderId: string, paymentKey: string, amount: number) {
  const { GET } = await import("@/app/api/payments/confirm/route");
  return GET(
    new Request(
      `http://localhost/api/payments/confirm?paymentKey=${paymentKey}&orderId=${orderId}&amount=${amount}`
    )
  );
}

/** Configures the mocked Payment Query API to answer with a given record. */
async function mockTossQuery(record: {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
}) {
  const tossServer = await import("@/lib/payment/toss-server");
  vi.mocked(tossServer.queryTossPayment).mockResolvedValue({ ok: true, payment: record });
}

beforeEach(async () => {
  store = {
    orders: [{ id: "o1", status: "pending_payment", totalAmount: 30000, paymentKey: null }],
    orderItems: [{ orderId: "o1", productId: "A", quantity: 3 }],
    products: [{ id: "A", stock: 7 }],
    auditLogs: [],
    seq: 0,
  };

  const tossServer = await import("@/lib/payment/toss-server");
  vi.mocked(tossServer.confirmTossPayment).mockReset();
  vi.mocked(tossServer.queryTossPayment).mockReset();

  // The webhook route now rate-limits by IP (CodeRabbit PR #9 round-2
  // Finding B) — reset the shared in-memory store so this file's 11
  // postWebhook() calls (none set x-forwarded-for, so all share the
  // "unknown" bucket) don't accumulate a request count across tests and
  // spuriously 429.
  const { __resetRateLimitStoreForTests } = await import("@/lib/auth/rate-limit");
  __resetRateLimitStoreForTests();
});

describe("SPEC-PAYMENT-001 M5 — confirm route (AC-PAYMENT-007)", () => {
  it("confirms and transitions pending_payment -> paid with one audit log", async () => {
    const tossServer = await import("@/lib/payment/toss-server");
    vi.mocked(tossServer.confirmTossPayment).mockResolvedValue({ ok: true });

    const response = await getConfirm("o1", "PK1", 30000);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/checkout/complete/o1");
    expect(response.headers.get("location")).not.toContain("payment_failed");

    const order = store.orders.find((o) => o.id === "o1")!;
    expect(order.status).toBe("paid");
    expect(order.paymentKey).toBe("PK1");
    expect(store.auditLogs).toHaveLength(1);
    expect(store.auditLogs[0]).toMatchObject({
      orderId: "o1",
      source: "CONFIRM_API",
      previousStatus: "pending_payment",
      newStatus: "paid",
      paymentKey: "PK1",
    });
  });
});

describe("SPEC-PAYMENT-001 M5 — webhook Toss-query re-verification gate (AC-PAYMENT-011/012, Finding 1)", () => {
  it("rejects a webhook whose Toss query itself fails, and changes nothing", async () => {
    const tossServer = await import("@/lib/payment/toss-server");
    vi.mocked(tossServer.queryTossPayment).mockResolvedValue({ ok: false, status: 502 });

    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "DONE" },
      "T-query-fail"
    );

    expect(response.status).toBe(502);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("pending_payment");
    expect(store.auditLogs).toHaveLength(0);
  });

  it("rejects a webhook whose claimed orderId contradicts Toss's own queried record, and changes nothing", async () => {
    await mockTossQuery({ paymentKey: "PK1", orderId: "SOMEONE-ELSES-ORDER", status: "DONE", totalAmount: 30000 });

    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "DONE" },
      "T-mismatch"
    );

    expect(response.status).toBe(400);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("pending_payment");
    expect(store.auditLogs).toHaveLength(0);
  });

  it("accepts and applies a webhook once Toss's own queried record confirms it", async () => {
    await mockTossQuery({ paymentKey: "PK1", orderId: "o1", status: "DONE", totalAmount: 30000 });

    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "DONE" },
      "T1"
    );

    expect(response.status).toBe(200);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("paid");
  });
});

describe("SPEC-PAYMENT-001 M5 — webhook resend is idempotent (AC-PAYMENT-016)", () => {
  it("processes the DONE webhook once, and a resend under the same transmissionId is a no-op", async () => {
    await mockTossQuery({ paymentKey: "PK1", orderId: "o1", status: "DONE", totalAmount: 30000 });
    const payload = { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "DONE" };

    const first = await postWebhook(payload, "T1");
    expect(first.status).toBe(200);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("paid");
    expect(store.auditLogs).toHaveLength(1);

    // Same transmissionId, same payload — Toss's own resend behaviour.
    const second = await postWebhook(payload, "T1");
    expect(second.status).toBe(200);

    // Nothing changed the second time: no new audit log, order unchanged.
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("paid");
    expect(store.auditLogs).toHaveLength(1);
  });
});

describe("SPEC-PAYMENT-001 M5 — cancel webhook restores stock atomically (AC-PAYMENT-014)", () => {
  it("marks the order cancelled, restores stock, and logs — all inside the confirm-then-cancel path", async () => {
    // Reach `paid` via the confirm route first, exactly as a real checkout
    // would (design.md §0#4's premise: cancellation only ever follows a paid
    // order).
    const tossServer = await import("@/lib/payment/toss-server");
    vi.mocked(tossServer.confirmTossPayment).mockResolvedValue({ ok: true });
    await getConfirm("o1", "PK1", 30000);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("paid");

    await mockTossQuery({ paymentKey: "PK1", orderId: "o1", status: "CANCELED", totalAmount: 30000 });
    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" },
      "T-cancel"
    );

    expect(response.status).toBe(200);
    const order = store.orders.find((o) => o.id === "o1")!;
    expect(order.status).toBe("cancelled");
    // 7 + 3 = 10 — the exact quantity the single order item held.
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
    expect(store.auditLogs).toHaveLength(2);
    expect(store.auditLogs[1]).toMatchObject({
      orderId: "o1",
      source: "WEBHOOK",
      previousStatus: "paid",
      newStatus: "cancelled",
      paymentKey: "PK1",
      transmissionId: "T-cancel",
    });
  });

  it("does not restore stock twice when the cancel webhook is resent", async () => {
    const tossServer = await import("@/lib/payment/toss-server");
    vi.mocked(tossServer.confirmTossPayment).mockResolvedValue({ ok: true });
    await getConfirm("o1", "PK1", 30000);

    await mockTossQuery({ paymentKey: "PK1", orderId: "o1", status: "CANCELED", totalAmount: 30000 });
    const cancelPayload = { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" };
    await postWebhook(cancelPayload, "T-cancel");
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);

    // Same transmissionId resent — the second delivery must not increment
    // stock again.
    const resend = await postWebhook(cancelPayload, "T-cancel");

    expect(resend.status).toBe(200);
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
    expect(store.auditLogs).toHaveLength(2);
  });

  it("does not restore stock when the cancel arrives for a still-pending order", async () => {
    // Never confirmed — status stays pending_payment, paymentKey stays null
    // (beforeEach default). The queried record still names paymentKey "PK1"
    // (Toss's own record), which now disagrees with the order's own (null)
    // paymentKey — Finding 2's guard rejects this before ever attempting the
    // conditional transition.
    await mockTossQuery({ paymentKey: "PK1", orderId: "o1", status: "CANCELED", totalAmount: 30000 });

    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" },
      "T-cancel-early"
    );

    expect(response.status).toBe(200);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("pending_payment");
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(7);
    expect(store.auditLogs).toHaveLength(0);
  });

  it("does not cancel when the queried paymentKey disagrees with the order's stored paymentKey (Finding 2 regression)", async () => {
    const tossServer = await import("@/lib/payment/toss-server");
    vi.mocked(tossServer.confirmTossPayment).mockResolvedValue({ ok: true });
    await getConfirm("o1", "PK1", 30000);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("paid");
    expect(store.auditLogs).toHaveLength(1);

    // Toss's queried record names a DIFFERENT paymentKey than the order's
    // own stored one — must not cancel.
    await mockTossQuery({ paymentKey: "PK-ATTACKER", orderId: "o1", status: "CANCELED", totalAmount: 30000 });

    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK-ATTACKER", amount: 30000, status: "CANCELED" },
      "T-attacker-cancel"
    );

    expect(response.status).toBe(200);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("paid");
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(7);
    expect(store.auditLogs).toHaveLength(1);
  });
});

describe("SPEC-PAYMENT-001 M5 — PARTIAL_CANCELED webhook (Finding 3 regression)", () => {
  it("does not cancel the order or restore stock — recorded as unhandled instead", async () => {
    const tossServer = await import("@/lib/payment/toss-server");
    vi.mocked(tossServer.confirmTossPayment).mockResolvedValue({ ok: true });
    await getConfirm("o1", "PK1", 30000);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("paid");

    await mockTossQuery({ paymentKey: "PK1", orderId: "o1", status: "PARTIAL_CANCELED", totalAmount: 30000 });
    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "PARTIAL_CANCELED" },
      "T-partial"
    );

    expect(response.status).toBe(200);
    const order = store.orders.find((o) => o.id === "o1")!;
    expect(order.status).toBe("paid");
    // No over-restoration of stock.
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(7);
    expect(store.auditLogs).toHaveLength(2);
    expect(store.auditLogs[1]).toMatchObject({
      orderId: "o1",
      source: "WEBHOOK",
      previousStatus: "paid",
      newStatus: "paid",
      paymentKey: "PK1",
      transmissionId: "T-partial",
    });
  });
});
