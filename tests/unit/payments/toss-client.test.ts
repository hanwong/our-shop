// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SPEC-PAYMENT-001 M4 — src/lib/payment/toss-client.ts (browser-side Toss
 * Payments SDK loader/initializer).
 *
 * Traces: REQ-PAYMENT-005 (requestPayment() invocation shape, design.md §6),
 * REQ-PAYMENT-018 (NEXT_PUBLIC_PG_CLIENT_KEY is the only credential this
 * module may read — never PG_SECRET_KEY / PG_WEBHOOK_SECRET, which stay
 * server-only per toss-server.ts, M2).
 *
 * design.md §9 leaves the exact Toss SDK npm package name unconfirmed at
 * plan-phase and defers confirmation to this milestone; plan.md §4 forbids
 * modifying package.json during M4 (that dependency addition is M5's job).
 * This module therefore loads the SDK from Toss's own CDN script rather than
 * importing an npm package, sidestepping both constraints at once.
 */

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_PG_CLIENT_KEY;

function findInjectedScript(): HTMLScriptElement | null {
  return document.querySelector('script[src^="https://js.tosspayments.com"]');
}

beforeEach(() => {
  document.head.innerHTML = "";
  vi.resetModules();
  Reflect.deleteProperty(window, "TossPayments");
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.NEXT_PUBLIC_PG_CLIENT_KEY;
  } else {
    process.env.NEXT_PUBLIC_PG_CLIENT_KEY = ORIGINAL_ENV;
  }
});

describe("loadTossPaymentClient — credential guard (REQ-PAYMENT-018)", () => {
  it("rejects when NEXT_PUBLIC_PG_CLIENT_KEY is not set", async () => {
    delete process.env.NEXT_PUBLIC_PG_CLIENT_KEY;
    const { loadTossPaymentClient } = await import("@/lib/payment/toss-client");

    await expect(loadTossPaymentClient()).rejects.toThrow(/NEXT_PUBLIC_PG_CLIENT_KEY/);
    // No env var means no reason to have touched the DOM at all.
    expect(findInjectedScript()).toBeNull();
  });
});

describe("loadTossPaymentClient — SDK script loading", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_PG_CLIENT_KEY = "test_ck_123";
  });

  it("injects the Toss SDK script exactly once and initializes with the client key", async () => {
    const { loadTossPaymentClient } = await import("@/lib/payment/toss-client");

    const paymentFactory = vi.fn().mockReturnValue({ requestPayment: vi.fn() });
    const tossFactory = vi.fn().mockReturnValue({ payment: paymentFactory });

    const pending = loadTossPaymentClient();
    const script = findInjectedScript();
    expect(script).not.toBeNull();

    Reflect.set(window, "TossPayments", tossFactory);
    script?.dispatchEvent(new Event("load"));

    await pending;
    expect(tossFactory).toHaveBeenCalledWith("test_ck_123");
    expect(
      document.head.querySelectorAll('script[src^="https://js.tosspayments.com"]').length
    ).toBe(1);
  });

  it("rejects when the script fails to load", async () => {
    const { loadTossPaymentClient } = await import("@/lib/payment/toss-client");

    const pending = loadTossPaymentClient();
    const script = findInjectedScript();
    script?.dispatchEvent(new Event("error"));

    await expect(pending).rejects.toThrow(/Toss/);
  });
});

describe("PaymentClient.requestPayment — parameter mapping (AC-PAYMENT-005)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_PG_CLIENT_KEY = "test_ck_123";
  });

  it("forwards orderId, amount, orderName, successUrl, failUrl to the SDK", async () => {
    const { loadTossPaymentClient } = await import("@/lib/payment/toss-client");

    const sdkRequestPayment = vi.fn().mockResolvedValue(undefined);
    const paymentFactory = vi.fn().mockReturnValue({ requestPayment: sdkRequestPayment });
    Reflect.set(
      window,
      "TossPayments",
      vi.fn().mockReturnValue({ payment: paymentFactory })
    );

    const pending = loadTossPaymentClient();
    findInjectedScript()?.dispatchEvent(new Event("load"));
    const client = await pending;

    await client.requestPayment({
      orderId: "order-1",
      amount: 139000,
      orderName: "머그컵 외 1건",
      successUrl: "/api/payments/confirm",
      failUrl: "/checkout/complete/order-1?payment_failed=1",
    });

    expect(sdkRequestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        orderName: "머그컵 외 1건",
        successUrl: "/api/payments/confirm",
        failUrl: "/checkout/complete/order-1?payment_failed=1",
        amount: expect.objectContaining({ value: 139000 }),
      })
    );
  });

  it("scopes the payment to a guest payer (no member/customer id in this SPEC, REQ-PAYMENT-020)", async () => {
    const { loadTossPaymentClient } = await import("@/lib/payment/toss-client");

    const paymentFactory = vi.fn().mockReturnValue({ requestPayment: vi.fn() });
    const tossFactory = vi.fn().mockReturnValue({ payment: paymentFactory });
    Reflect.set(window, "TossPayments", tossFactory);

    const pending = loadTossPaymentClient();
    findInjectedScript()?.dispatchEvent(new Event("load"));
    await pending;

    expect(paymentFactory).toHaveBeenCalledWith(
      expect.objectContaining({ customerKey: expect.any(String) })
    );
    const { customerKey } = paymentFactory.mock.calls[0]![0] as { customerKey: string };
    // Not asserting the exact literal (an implementation detail) — only that
    // no real customer/member id is ever synthesized here.
    expect(customerKey).not.toMatch(/order-1|user-|member-/);
  });
});

describe("toss-client — no server-only secrets (AC-PAYMENT-018)", () => {
  it("never references PG_SECRET_KEY or PG_WEBHOOK_SECRET", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/payment/toss-client.ts", "utf8");
    expect(source).not.toMatch(/PG_SECRET_KEY/);
    expect(source).not.toMatch(/PG_WEBHOOK_SECRET/);
  });
});
