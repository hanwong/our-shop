// SPEC-E2E-001 M2 — browser-side Toss Payments SDK stub ("다리 1" in plan.md
// §A). Served in place of the real https://js.tosspayments.com/v2/standard
// script via `page.route()` (e2e/support/toss-stub-fixture.ts).
//
// Loaded as a plain <script src> — not a module, no imports available.
// Must define `window.TossPayments` with EXACTLY the call shape
// src/lib/payment/toss-client.ts expects (plan.md §D):
//
//   window.TossPayments(clientKey) -> payment({customerKey}) -> requestPayment(options)
//
// `options` carries orderId, amount:{currency,value}, orderName, successUrl,
// failUrl — all constructed by the application (PayButton.tsx +
// toss-client.ts), never by this stub. The stub uses successUrl/failUrl
// VERBATIM (plan.md §D) — inventing a URL here would stop this suite from
// verifying what PayButton actually builds.
//
// @MX:ANCHOR fan-in target — every payment scenario in this suite depends on
// this one stub. A call-shape mismatch against toss-client.ts's contract
// silently breaks every scenario that exercises payment (plan.md §H).
// @MX:REASON toss-client.ts's TossPaymentsSDK/TossPaymentInstance interfaces
// are the load-bearing contract this stub must mirror exactly — any drift
// there is drift here too.
//
// Mode switching: `window.__E2E_PAYMENT_MODE__`, set via `page.addInitScript()`
// per-scenario (e2e/support/toss-stub-fixture.ts). Defaults to "success" when
// unset, matching plan.md §D's stub sketch.
window.TossPayments = function (clientKey) {
  return {
    payment: function (_paymentOptions) {
      return {
        requestPayment: function (options) {
          return new Promise(function (resolve) {
            var mode = window.__E2E_PAYMENT_MODE__ || "success";
            if (mode === "fail") {
              window.location.assign(options.failUrl);
              resolve();
              return;
            }
            var u = new URL(options.successUrl);
            u.searchParams.set("paymentKey", "e2e_stub_payment_key");
            u.searchParams.set("orderId", options.orderId);
            u.searchParams.set("amount", String(options.amount.value));
            window.location.assign(u.toString());
            resolve();
          });
        },
      };
    },
  };
};
