import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

/**
 * SPEC-PAYMENT-001 M5 — the confirm/webhook path driven end to end through the
 * real route handlers against an in-memory database.
 *
 * Traces: AC-PAYMENT-001 (one audit-log row per transition), AC-PAYMENT-007
 * (confirm success -> paid), AC-PAYMENT-011/012 (signature gate, exercised for
 * real — this suite does NOT mock verifyWebhookSignature), AC-PAYMENT-013
 * (DONE webhook -> paid), AC-PAYMENT-014 (CANCELED webhook restores stock,
 * same transaction), AC-PAYMENT-016 (webhook resend is a no-op).
 *
 * Nothing is mocked at the repository or service seam: the fake below stands
 * in for PostgreSQL only, and `toss-server.ts`'s `verifyWebhookSignature` runs
 * for real (the test computes a genuine HMAC-SHA256 signature). Only the
 * OUTBOUND network call — `confirmTossPayment` — is replaced, because this
 * suite has no live Toss endpoint to call.
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

// Only the OUTBOUND HTTP call is replaced. verifyWebhookSignature runs for
// real (design.md §5) — this suite proves the signature gate actually gates,
// rather than assuming the mocked service would have called it correctly.
vi.mock("@/lib/payment/toss-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment/toss-server")>();
  return { ...actual, confirmTossPayment: vi.fn() };
});

const WEBHOOK_SECRET = "test-webhook-secret-shhh";
const ORIGINAL_WEBHOOK_SECRET = process.env.PG_WEBHOOK_SECRET;

function signBody(rawBody: string, transmissionTime: string): string {
  // Mirrors toss-server.ts verifyWebhookSignature's message construction
  // exactly: `${transmissionTime}.${rawBody}`, HMAC-SHA256, base64 digest.
  return createHmac("sha256", WEBHOOK_SECRET).update(`${transmissionTime}.${rawBody}`).digest("base64");
}

async function postWebhook(
  payload: Record<string, unknown>,
  transmissionId: string,
  signatureOverride?: string
) {
  const rawBody = JSON.stringify(payload);
  const transmissionTime = "2026-09-02T00:00:00.000Z";
  const { POST } = await import("@/app/api/payments/webhook/route");
  return POST(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: {
        "tosspayments-webhook-transmission-time": transmissionTime,
        "tosspayments-webhook-signature": signatureOverride ?? signBody(rawBody, transmissionTime),
        "tosspayments-webhook-transmission-id": transmissionId,
      },
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

beforeEach(async () => {
  process.env.PG_WEBHOOK_SECRET = WEBHOOK_SECRET;
  store = {
    orders: [{ id: "o1", status: "pending_payment", totalAmount: 30000, paymentKey: null }],
    orderItems: [{ orderId: "o1", productId: "A", quantity: 3 }],
    products: [{ id: "A", stock: 7 }],
    auditLogs: [],
    seq: 0,
  };

  const tossServer = await import("@/lib/payment/toss-server");
  vi.mocked(tossServer.confirmTossPayment).mockReset();
});

afterAll(() => {
  process.env.PG_WEBHOOK_SECRET = ORIGINAL_WEBHOOK_SECRET;
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

describe("SPEC-PAYMENT-001 M5 — webhook signature gate (AC-PAYMENT-011/012)", () => {
  it("rejects a webhook with an invalid signature and changes nothing", async () => {
    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "DONE" },
      "T-bad",
      "not-the-real-signature"
    );

    expect(response.status).toBe(401);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("pending_payment");
    expect(store.auditLogs).toHaveLength(0);
  });

  it("accepts a genuinely-signed webhook (the same HMAC toss-server.ts computes)", async () => {
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
    // Never confirmed — status stays pending_payment (beforeEach default).
    const response = await postWebhook(
      { orderId: "o1", paymentKey: "PK1", amount: 30000, status: "CANCELED" },
      "T-cancel-early"
    );

    expect(response.status).toBe(200);
    expect(store.orders.find((o) => o.id === "o1")!.status).toBe("pending_payment");
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(7);
    expect(store.auditLogs).toHaveLength(0);
  });
});
