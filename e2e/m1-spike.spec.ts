/**
 * SPEC-E2E-001 M1 spike — plan.md §B "M1 스파이크가 먼저 증명해야 하는 것".
 *
 * Proves, before anything else in this suite depends on it, that the
 * undici global-dispatcher mock (e2e/support/mock-toss-api.mjs) actually
 * reaches Next.js's route-handler execution context — an ASSUMPTION per
 * plan.md §B, not a fact, because a dev server that runs handlers in a
 * separate worker/runtime could leave the global dispatcher uninstalled
 * there. Four points, all required:
 *
 *   1. /api/payments/confirm actually executes confirmTossPayment().
 *   2. That call hit exactly TOSS_CONFIRM_URL and was intercepted (recorded
 *      by the interceptor itself, not inferred).
 *   3. queryTossPayment()'s query endpoint is intercepted the same way.
 *   4. The Toss-host browser-side watch route never fires (negative-
 *      direction proof — nothing leaked to the real network).
 *
 * If any point fails, this is a run-phase blocker (plan.md §B) — not a
 * signal to fall back to a different mechanism.
 */
import { test, expect } from "./support/fixtures";
import { readCallLog } from "./support/call-log";
import {
  GUEST_COOKIE_NAME,
  createSpikeOrder,
  deleteSpikeOrder,
  disconnectSpikeOrderClient,
} from "./support/order-fixture";

test.describe("M1 spike — server-side Toss interception", () => {
  test.afterAll(async () => {
    await disconnectSpikeOrderClient();
  });

  test("global-dispatcher mock intercepts both server-side Toss calls, and no request reaches a real Toss host", async ({
    page,
    context,
    baseURL,
    tossHostHits,
  }) => {
    const order = await createSpikeOrder();

    try {
      await context.addCookies([
        { name: GUEST_COOKIE_NAME, value: order.guestId, url: baseURL! },
      ]);

      // --- Points 1 & 2: fire confirmTossPayment() and check it was intercepted. ---
      const paymentKey = `e2e_spike_${order.orderId}`;
      await page.goto(
        `/api/payments/confirm?paymentKey=${encodeURIComponent(paymentKey)}` +
          `&orderId=${order.orderId}&amount=${order.totalAmount}`
      );

      // The SUCCESS destination carries no ?payment_failed=1 — only reachable
      // when confirmTossPayment() received a 2xx from the (mocked) Toss API.
      await expect(page).toHaveURL(new RegExp(`/checkout/complete/${order.orderId}$`));

      const confirmCalls = readCallLog().filter((c) => c.endpoint === "confirm");
      expect(confirmCalls.length).toBeGreaterThanOrEqual(1);
      const lastConfirmCall = confirmCalls.at(-1);
      expect(lastConfirmCall?.method).toBe("POST");
      expect(lastConfirmCall?.path).toBe("/v1/payments/confirm");

      // --- Point 3: fire queryTossPayment() via the webhook route. ---
      const webhookRes = await page.request.post("/api/payments/webhook", {
        headers: { "tosspayments-webhook-transmission-id": `e2e-spike-${order.orderId}` },
        data: JSON.stringify({
          eventType: "PAYMENT_STATUS_CHANGED",
          paymentKey,
          orderId: order.orderId,
        }),
      });
      // Whatever the domain classification, a 5xx here would mean the call
      // never got past queryTossPayment() cleanly — the call-log assertion
      // right below is the actual proof point, this is just a smoke check.
      expect(webhookRes.status()).toBeLessThan(500);

      const queryCalls = readCallLog().filter((c) => c.endpoint === "query");
      expect(queryCalls.length).toBeGreaterThanOrEqual(1);
      const lastQueryCall = queryCalls.at(-1);
      expect(lastQueryCall?.method).toBe("GET");
      expect(lastQueryCall?.path).toBe(`/v1/payments/${encodeURIComponent(paymentKey)}`);

      // --- Point 4: the browser-side Toss-host watch route never fired. ---
      expect(tossHostHits).toHaveLength(0);
    } finally {
      await deleteSpikeOrder(order.orderId);
    }
  });
});
