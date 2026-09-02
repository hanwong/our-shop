import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * SPEC-PAYMENT-001 M2 — src/lib/payment/toss-server.ts
 *
 * Traces: REQ-PAYMENT-007/008 (confirm API call, Basic auth via
 * PG_SECRET_KEY), REQ-PAYMENT-011/012 (webhook re-verification via Toss's
 * Payment Query API — CodeRabbit PR #9 Finding 1 correction: the general
 * PAYMENT_STATUS_CHANGED webhook carries no verifiable signature header).
 * design.md §5, research.md §3/§4.
 *
 * Server-only module — plan.md M2 requires it to depend on nothing under
 * next/*, so it can be called from a route handler, a test, or (in principle)
 * a script without pulling in the Next.js runtime.
 */

describe("toss-server — confirmTossPayment (Basic auth via PG_SECRET_KEY)", () => {
  const originalSecret = process.env.PG_SECRET_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PG_SECRET_KEY = "test-secret";
  });

  afterEach(() => {
    process.env.PG_SECRET_KEY = originalSecret;
    global.fetch = originalFetch;
  });

  it("calls the Toss confirm endpoint with Basic auth, the request body, and a bounded timeout signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { confirmTossPayment } = await import("@/lib/payment/toss-server");

    const result = await confirmTossPayment({ orderId: "o1", paymentKey: "PK1", amount: 1000 });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/confirm");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("test-secret:").toString("base64")}`);
    expect(JSON.parse(init.body as string)).toEqual({
      orderId: "o1",
      paymentKey: "PK1",
      amount: 1000,
    });
    // Finding 4 — a hung Toss response must not hang the caller forever.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns ok:false with the response status when Toss rejects the request", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;
    const { confirmTossPayment } = await import("@/lib/payment/toss-server");

    expect(await confirmTossPayment({ orderId: "o1", paymentKey: "PK1", amount: 1000 })).toEqual({
      ok: false,
      status: 400,
    });
  });

  it("fails without calling Toss when PG_SECRET_KEY is unset", async () => {
    delete process.env.PG_SECRET_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { confirmTossPayment } = await import("@/lib/payment/toss-server");

    expect(await confirmTossPayment({ orderId: "o1", paymentKey: "PK1", amount: 1000 })).toEqual({
      ok: false,
      status: 500,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a failure result — never a thrown exception — when the request times out or the network fails (Finding 4)", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError")) as unknown as typeof fetch;
    const { confirmTossPayment } = await import("@/lib/payment/toss-server");

    await expect(
      confirmTossPayment({ orderId: "o1", paymentKey: "PK1", amount: 1000 })
    ).resolves.toEqual({ ok: false, status: 504 });
  });
});

describe("toss-server — queryTossPayment (Payment Query API, Basic auth via PG_SECRET_KEY)", () => {
  const originalSecret = process.env.PG_SECRET_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PG_SECRET_KEY = "test-secret";
  });

  afterEach(() => {
    process.env.PG_SECRET_KEY = originalSecret;
    global.fetch = originalFetch;
  });

  it("calls GET /v1/payments/{paymentKey} with Basic auth and a bounded timeout signal, returning the authoritative record", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        paymentKey: "PK1",
        orderId: "o1",
        status: "DONE",
        totalAmount: 30000,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { queryTossPayment } = await import("@/lib/payment/toss-server");

    const result = await queryTossPayment("PK1");

    expect(result).toEqual({
      ok: true,
      payment: { paymentKey: "PK1", orderId: "o1", status: "DONE", totalAmount: 30000 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/PK1");
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("test-secret:").toString("base64")}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("URL-encodes the paymentKey path segment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ paymentKey: "PK/1", orderId: "o1", status: "DONE", totalAmount: 1000 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { queryTossPayment } = await import("@/lib/payment/toss-server");

    await queryTossPayment("PK/1");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/PK%2F1");
  });

  it("returns ok:false with the response status when Toss rejects the query", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    const { queryTossPayment } = await import("@/lib/payment/toss-server");

    expect(await queryTossPayment("unknown-key")).toEqual({ ok: false, status: 404 });
  });

  it("fails without calling Toss when PG_SECRET_KEY is unset", async () => {
    delete process.env.PG_SECRET_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { queryTossPayment } = await import("@/lib/payment/toss-server");

    expect(await queryTossPayment("PK1")).toEqual({ ok: false, status: 500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a failure result — never a thrown exception — when the request times out or the network fails", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError")) as unknown as typeof fetch;
    const { queryTossPayment } = await import("@/lib/payment/toss-server");

    await expect(queryTossPayment("PK1")).resolves.toEqual({ ok: false, status: 504 });
  });

  it("returns a failure result when Toss answers 2xx with an unparseable body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    }) as unknown as typeof fetch;
    const { queryTossPayment } = await import("@/lib/payment/toss-server");

    expect(await queryTossPayment("PK1")).toEqual({ ok: false, status: 502 });
  });
});

describe("toss-server — no HMAC signature verifier is exposed (CodeRabbit PR #9 Finding 1)", () => {
  it("does not export verifyWebhookSignature", async () => {
    const mod = await import("@/lib/payment/toss-server");
    expect((mod as Record<string, unknown>).verifyWebhookSignature).toBeUndefined();
  });
});

describe("toss-server — no next/* dependency (plan.md M2, AC-PAYMENT-019 groundwork)", () => {
  it("does not import anything from next/*", () => {
    const src = readFileSync("src/lib/payment/toss-server.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']next\//);
  });
});
