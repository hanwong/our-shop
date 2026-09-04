/**
 * SPEC-E2E-001 M2 — Toss stub SDK and the payment path (plan.md §F M2).
 *
 * REQ-E2E-006/007, AC-E2E-005a/005b. Exit condition (plan.md §F): the stub
 * causes a REAL browser navigation to the `successUrl` `PayButton` actually
 * constructs — observed here via `page.waitForRequest()` on the exact GET
 * the browser issues when the stub calls `window.location.assign()`, not a
 * value the test invents.
 *
 * Both scenarios reuse the M1 order fixture (a real `pending_payment` order,
 * `order-fixture.ts`) and the M1 Toss-host watch fixture (`tossHostHits`,
 * `fixtures.ts`) — REQ-E2E-005's negative-direction proof applies to every
 * scenario that exercises payment, not only the M1 spike.
 */
import { test, expect } from "./support/fixtures";
import {
  GUEST_COOKIE_NAME,
  createSpikeOrder,
  deleteSpikeOrder,
  disconnectSpikeOrderClient,
} from "./support/order-fixture";

test.describe("M2 — Toss stub SDK payment path", () => {
  test.afterAll(async () => {
    await disconnectSpikeOrderClient();
  });

  test("success mode navigates to the successUrl PayButton constructed, carrying paymentKey/orderId/amount", async ({
    page,
    context,
    baseURL,
    tossHostHits,
    tossPaymentStub,
  }) => {
    const order = await createSpikeOrder();

    try {
      await context.addCookies([
        { name: GUEST_COOKIE_NAME, value: order.guestId, url: baseURL! },
      ]);
      // Explicit, though "success" is also the stub's own default
      // (toss-sdk-stub.js `mode ?? "success"`) — states scenario intent.
      await tossPaymentStub.setMode("success");

      await page.goto(`/checkout/complete/${order.orderId}`);

      const confirmRequest = page.waitForRequest(
        (req) => req.method() === "GET" && req.url().includes("/api/payments/confirm")
      );
      await page.getByRole("button", { name: "결제하기" }).click();
      const request = await confirmRequest;

      const url = new URL(request.url());
      expect(url.pathname).toBe("/api/payments/confirm");
      expect(url.searchParams.get("paymentKey")).toBeTruthy();
      expect(url.searchParams.get("orderId")).toBe(order.orderId);
      expect(url.searchParams.get("amount")).toBe(String(order.totalAmount));

      // Negative-direction proof (REQ-E2E-005) — the stub script load and
      // the payment flow above must not have leaked to a real Toss host.
      expect(tossHostHits).toHaveLength(0);
    } finally {
      await deleteSpikeOrder(order.orderId);
    }
  });

  test("fail mode navigates to the failUrl PayButton constructed", async ({
    page,
    context,
    baseURL,
    tossHostHits,
    tossPaymentStub,
  }) => {
    const order = await createSpikeOrder();

    try {
      await context.addCookies([
        { name: GUEST_COOKIE_NAME, value: order.guestId, url: baseURL! },
      ]);
      await tossPaymentStub.setMode("fail");

      await page.goto(`/checkout/complete/${order.orderId}`);
      await page.getByRole("button", { name: "결제하기" }).click();

      await expect(page).toHaveURL(
        new RegExp(`/checkout/complete/${order.orderId}\\?payment_failed=1$`)
      );

      expect(tossHostHits).toHaveLength(0);
    } finally {
      await deleteSpikeOrder(order.orderId);
    }
  });
});
