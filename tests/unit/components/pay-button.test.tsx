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
 *
 * SPEC-STOREFRONT-002 M5 adds the "style cleanup" block below
 * (REQ-STOREFRONT-028/029, design.md §6 findings C1/C2): both are
 * className-literal-only token swaps, verified here by exact string.
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

describe("PayButton — SPEC-STOREFRONT-002 M5 style cleanup (REQ-STOREFRONT-028/029)", () => {
  it("uses the checkout-wide error color text-red-600 rather than text-red-700", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/checkout/PayButton.tsx", "utf8");

    expect(source).not.toMatch(/text-red-700/);
    expect(source).toMatch(/text-red-600/);
  });

  it("uses the checkout-wide button vertical padding via the shared Button primitive (SPEC-DESIGN-001 M3)", async () => {
    // SPEC-DESIGN-001 M3 (spec.md §1.1) supersedes this literal-className
    // assertion: the padding this test guarded is no longer a
    // per-file string in PayButton.tsx — it now lives in the single shared
    // definition point, src/components/ui/Button.tsx (plan.md §D.1b), so
    // the consistency this test originally protected is now structural
    // (one definition, not a repeated literal) rather than a repeated
    // string to grep for.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/checkout/PayButton.tsx", "utf8");

    expect(source).not.toMatch(/py-3\b/);
    expect(source).toMatch(/from "@\/components\/ui\/Button"/);
  });

  it("renders the error text in the checkout-wide red-600 class", async () => {
    render(<PayButton orderId="order-1" amount={100} orderName="x" />);
    const { loadTossPaymentClient } = await import("@/lib/payment/toss-client");
    vi.mocked(loadTossPaymentClient).mockRejectedValueOnce(new Error("boom"));

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").className).toContain("text-red-600");
    expect(screen.getByRole("alert").className).not.toContain("text-red-700");
  });

  it("changes no line other than the two className token swaps (structural check)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/checkout/PayButton.tsx", "utf8");

    // Logic, state, and imports are unchanged — only className literals moved.
    expect(source).toMatch(/const \[isSubmitting, setIsSubmitting\] = useState\(false\);/);
    expect(source).toMatch(/const \[error, setError\] = useState<string \| null>\(null\);/);
    expect(source).toMatch(/await loadTossPaymentClient\(\);/);
  });
});
