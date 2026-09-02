import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-PAYMENT-001 M3 — POST /api/payments/webhook.
 *
 * Traces: REQ-PAYMENT-011/012 (Toss Payment Query re-verification, exercised
 * via the mocked service — CodeRabbit PR #9 Finding 1 correction: this event
 * type carries no signature header, so the route no longer reads or forwards
 * one). plan.md §3 M3, design.md §5 — the raw body is still read via
 * request.text() rather than request.json(), because JSON.parse happens
 * inside processWebhook() (only to extract paymentKey for the Toss query).
 *
 * The service is mocked here — this suite asserts the ROUTE's adapter
 * responsibilities (raw-body-first ordering, header forwarding, status-code
 * mapping), not the query/webhook orchestration itself (covered by
 * payment-service.test.ts).
 */

const paymentService = {
  processWebhook: vi.fn(),
};
vi.mock("@/features/payments/services/payment-service", () => paymentService);

const { POST } = await import("@/app/api/payments/webhook/route");

const HEADERS = {
  "tosspayments-webhook-transmission-id": "tid-1",
};

function webhookRequest(body: string, headers: Record<string, string> = HEADERS): Request {
  return new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SPEC-PAYMENT-001 M3 — POST /api/payments/webhook", () => {
  it("reads the raw body via request.text() and never calls request.json() itself (design.md §5)", async () => {
    const rawBody = JSON.stringify({ orderId: "o1", paymentKey: "pk1", amount: 30000, status: "DONE" });
    const request = webhookRequest(rawBody);

    const textSpy = vi.spyOn(request, "text");
    const jsonSpy = vi.spyOn(request, "json");

    paymentService.processWebhook.mockResolvedValue({ ok: true, outcome: "paid" });

    await POST(request);

    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("forwards the raw body and the transmission-id header to processWebhook() (no signature headers — Finding 1)", async () => {
    const rawBody = JSON.stringify({ orderId: "o1", paymentKey: "pk1", amount: 30000, status: "DONE" });
    paymentService.processWebhook.mockResolvedValue({ ok: true, outcome: "paid" });

    await POST(webhookRequest(rawBody));

    expect(paymentService.processWebhook).toHaveBeenCalledWith(rawBody, {
      transmissionId: "tid-1",
    });
  });

  it("responds 200 when processWebhook succeeds", async () => {
    paymentService.processWebhook.mockResolvedValue({ ok: true, outcome: "paid" });

    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(200);
  });

  it("responds 400 when processWebhook reports a malformed payload", async () => {
    paymentService.processWebhook.mockResolvedValue({ ok: false, reason: "malformed-payload" });

    const response = await POST(webhookRequest("not json"));

    expect(response.status).toBe(400);
  });

  it("responds 400 when processWebhook reports a Toss-query mismatch", async () => {
    paymentService.processWebhook.mockResolvedValue({ ok: false, reason: "query-mismatch" });

    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(400);
  });

  it("responds 502 (transient — PG should retry) when the Toss query call itself fails", async () => {
    paymentService.processWebhook.mockResolvedValue({ ok: false, reason: "toss-query-failed" });

    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(502);
  });
});
