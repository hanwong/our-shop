import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-PAYMENT-001 M3 — GET /api/payments/confirm.
 *
 * Traces: REQ-PAYMENT-006/007/008 (confirm orchestration, exercised via the
 * mocked service). plan.md §3 M3, design.md §6/§8 (successUrl is a server
 * route; failure redirects carry `?payment_failed=1`).
 *
 * The service is mocked here — this suite asserts the ROUTE's adapter
 * responsibilities (query parsing, call forwarding, redirect shape), not the
 * confirm orchestration itself (covered by payment-service.test.ts).
 */

const paymentService = {
  confirmPayment: vi.fn(),
};
vi.mock("@/features/payments/services/payment-service", () => paymentService);

const { GET } = await import("@/app/api/payments/confirm/route");

function confirmRequest(query: string): Request {
  return new Request(`http://localhost/api/payments/confirm${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SPEC-PAYMENT-001 M3 — GET /api/payments/confirm", () => {
  it("parses paymentKey/orderId/amount and forwards them to confirmPayment()", async () => {
    paymentService.confirmPayment.mockResolvedValue({ ok: true });

    await GET(confirmRequest("?paymentKey=pk_1&orderId=order-1&amount=30000"));

    expect(paymentService.confirmPayment).toHaveBeenCalledWith("order-1", "pk_1", 30000);
  });

  it("redirects to the completion screen with no payment_failed marker on success", async () => {
    paymentService.confirmPayment.mockResolvedValue({ ok: true });

    const response = await GET(confirmRequest("?paymentKey=pk_1&orderId=order-1&amount=30000"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/checkout/complete/order-1");
    expect(location).not.toContain("payment_failed");
  });

  it("redirects with ?payment_failed=1 when confirmPayment fails (design.md §8)", async () => {
    paymentService.confirmPayment.mockResolvedValue({ ok: false, code: "AMOUNT_MISMATCH" });

    const response = await GET(confirmRequest("?paymentKey=pk_1&orderId=order-1&amount=25000"));

    const location = response.headers.get("location");
    expect(location).toContain("/checkout/complete/order-1");
    expect(location).toContain("payment_failed=1");
  });
});
