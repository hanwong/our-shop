import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-PAYMENT-001 M3 — POST /api/payments/webhook.
 *
 * Traces: REQ-PAYMENT-011/012 (signature gate, exercised via the mocked
 * service). plan.md §3 M3, design.md §5 — the raw body MUST be read via
 * request.text() BEFORE any JSON.parse, because the HMAC signature is
 * computed over the exact bytes Toss sent; a request.json() round-trip can
 * reorder keys/whitespace and silently break the signature.
 *
 * The service is mocked here — this suite asserts the ROUTE's adapter
 * responsibilities (raw-body-first ordering, header forwarding, status-code
 * mapping), not the signature/webhook orchestration itself (covered by
 * payment-service.test.ts).
 */

const paymentService = {
  processWebhook: vi.fn(),
};
vi.mock("@/features/payments/services/payment-service", () => paymentService);

const { POST } = await import("@/app/api/payments/webhook/route");

const HEADERS = {
  "tosspayments-webhook-transmission-time": "2026-09-02T00:00:00Z",
  "tosspayments-webhook-signature": "sig-value",
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

  it("forwards the raw body and the three Toss headers to processWebhook()", async () => {
    const rawBody = JSON.stringify({ orderId: "o1", paymentKey: "pk1", amount: 30000, status: "DONE" });
    paymentService.processWebhook.mockResolvedValue({ ok: true, outcome: "paid" });

    await POST(webhookRequest(rawBody));

    expect(paymentService.processWebhook).toHaveBeenCalledWith(rawBody, {
      transmissionTime: "2026-09-02T00:00:00Z",
      signature: "sig-value",
      transmissionId: "tid-1",
    });
  });

  it("responds 200 when processWebhook succeeds", async () => {
    paymentService.processWebhook.mockResolvedValue({ ok: true, outcome: "paid" });

    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(200);
  });

  it("responds 401 when processWebhook reports an invalid signature", async () => {
    paymentService.processWebhook.mockResolvedValue({ ok: false, reason: "invalid-signature" });

    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(401);
  });

  it("responds 401 when processWebhook reports a malformed payload (post-signature verification failure)", async () => {
    paymentService.processWebhook.mockResolvedValue({ ok: false, reason: "malformed-payload" });

    const response = await POST(webhookRequest("not json"));

    expect(response.status).toBe(401);
  });
});
