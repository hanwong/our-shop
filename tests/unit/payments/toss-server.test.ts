import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * SPEC-PAYMENT-001 M2 — src/lib/payment/toss-server.ts
 *
 * Traces: REQ-PAYMENT-007/008 (confirm API call, Basic auth via
 * PG_SECRET_KEY), REQ-PAYMENT-011/012 (webhook HMAC-SHA256 signature
 * verification over the RAW body). design.md §5, research.md §3/§4.
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

  it("calls the Toss confirm endpoint with Basic auth and the request body", async () => {
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
});

describe("toss-server — verifyWebhookSignature (design.md §5, raw-body-first)", () => {
  const originalSecret = process.env.PG_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.PG_WEBHOOK_SECRET = "webhook-secret";
  });

  afterEach(() => {
    process.env.PG_WEBHOOK_SECRET = originalSecret;
  });

  it("accepts a signature computed the same way over the raw body", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payment/toss-server");
    const rawBody = JSON.stringify({ orderId: "o1", amount: 1000 });
    const transmissionTime = "1700000000000";
    const signature = createHmac("sha256", "webhook-secret")
      .update(`${transmissionTime}.${rawBody}`)
      .digest("base64");

    expect(verifyWebhookSignature(rawBody, { transmissionTime, signature })).toBe(true);
  });

  it("rejects a signature computed over a re-serialized (not raw) body", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payment/toss-server");
    const rawBody = '{"orderId":"o1","amount":1000}';
    const reSerialized = JSON.stringify(JSON.parse(rawBody), null, 2);
    const transmissionTime = "1700000000000";
    const signature = createHmac("sha256", "webhook-secret")
      .update(`${transmissionTime}.${reSerialized}`)
      .digest("base64");

    expect(verifyWebhookSignature(rawBody, { transmissionTime, signature })).toBe(false);
  });

  it("rejects when the secret is missing", async () => {
    delete process.env.PG_WEBHOOK_SECRET;
    const { verifyWebhookSignature } = await import("@/lib/payment/toss-server");

    expect(verifyWebhookSignature("{}", { transmissionTime: "1", signature: "x" })).toBe(false);
  });

  it("rejects a garbage signature without throwing", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payment/toss-server");

    expect(
      verifyWebhookSignature("{}", { transmissionTime: "1", signature: "not-a-real-signature" })
    ).toBe(false);
  });
});

describe("toss-server — no next/* dependency (plan.md M2, AC-PAYMENT-019 groundwork)", () => {
  it("does not import anything from next/*", () => {
    const src = readFileSync("src/lib/payment/toss-server.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']next\//);
  });
});
