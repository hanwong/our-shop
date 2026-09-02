// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-PAYMENT-001 M4 — src/components/checkout/PayButton.tsx.
 *
 * Traces: AC-PAYMENT-005 (requestPayment invocation shape), AC-PAYMENT-019
 * (no confirm/webhook logic in a client file). design.md §6 — PayButton is
 * pure UI: it triggers the SDK's payment window and holds no authorization
 * or amount-validation logic of its own (plan.md §3 M4).
 */

const requestPayment = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/payment/toss-client", () => ({
  loadTossPaymentClient: vi.fn().mockResolvedValue({ requestPayment }),
}));

const { PayButton } = await import("@/components/checkout/PayButton");

afterEach(() => {
  cleanup();
  requestPayment.mockClear();
});

describe("PayButton — click triggers the SDK payment window (AC-PAYMENT-005)", () => {
  it("calls requestPayment with orderId, amount, and orderName", async () => {
    render(<PayButton orderId="order-1" amount={139000} orderName="머그컵 외 1건" />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          amount: 139000,
          orderName: "머그컵 외 1건",
        })
      );
    });
  });

  it("does not call requestPayment before the button is clicked", () => {
    render(<PayButton orderId="order-1" amount={139000} orderName="머그컵" />);
    expect(requestPayment).not.toHaveBeenCalled();
  });
});

describe("PayButton — no domain logic in the client file (plan.md §3 M4, AC-PAYMENT-019)", () => {
  it("imports no confirm/webhook processing function and declares \"use client\"", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/checkout/PayButton.tsx", "utf8");
    expect(source).toMatch(/^"use client";/);
    expect(source).not.toMatch(/confirmPayment|processWebhook/);
    expect(source).not.toMatch(/PG_SECRET_KEY|PG_WEBHOOK_SECRET/);
  });
});
