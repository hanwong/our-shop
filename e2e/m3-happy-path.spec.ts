/**
 * SPEC-E2E-001 M3 — the guest happy-path journey (plan.md §F M3).
 *
 * REQ-E2E-008/009/010, AC-E2E-006/007/008. Exit condition (plan.md §F):
 * AC-E2E-001 — the full `npm run test:e2e` run (this scenario included)
 * launches Chromium against the running server and exits 0.
 *
 * ONE continuous journey, not three independent scenarios (spec.md §1.3's
 * "여정 1개" cap): product detail -> add to cart -> /cart reflects it ->
 * /checkout form submit -> order created -> completion screen -> payment
 * success -> paid completion state. Each step's browser state (the guest
 * cart cookie, the created order) is what the NEXT step depends on, so
 * splitting this into separate tests would mean re-deriving that state
 * with a shortcut instead of the real journey REQ-E2E-008/009/010 exist to
 * prove.
 *
 * GUEST IDENTITY (Section D point 5): unlike M1/M2's order-fixture, which
 * injects the guest cookie directly via `context.addCookies()`, this
 * scenario lets the application mint it itself — `POST /api/cart/items`
 * issues `Set-Cookie: guest_cart_id=...` on the FIRST add-to-cart call
 * (src/app/api/cart/items/route.ts), and the browser carries it on every
 * following navigation exactly as a real shopper's would. Injecting a
 * cookie manually here would test a mechanism this journey does not
 * actually use.
 *
 * Reuses M1's Toss-host watch fixture (`tossHostHits`) and M2's stub SDK
 * fixture (`tossPaymentStub`) — no new mocking mechanism (Section D point
 * 0). `tossPaymentStub` must still be destructured even though this
 * scenario never calls `.setMode()`: destructuring is what triggers the
 * fixture's `page.route()` installation (toss-stub-fixture.ts), and the
 * stub's own default mode is already "success" (toss-sdk-stub.js `mode ??
 * "success"`).
 */
import { test, expect } from "./support/fixtures";
import {
  clearStalePaymentKey,
  deleteSpikeOrder,
  disconnectSpikeOrderClient,
  getSeededProduct,
  STUB_SUCCESS_PAYMENT_KEY,
} from "./support/order-fixture";

test.describe("M3 — guest happy-path journey", () => {
  test.afterAll(async () => {
    await disconnectSpikeOrderClient();
  });

  test("product detail -> cart -> checkout -> payment success reaches the paid completion screen", async ({
    page,
    tossHostHits,
    tossPaymentStub,
  }) => {
    await tossPaymentStub.setMode("success");

    const product = await getSeededProduct();
    let orderId: string | null = null;

    try {
      // --- REQ-E2E-008 / AC-E2E-006: product detail -> add to cart -> /cart reflects it ---
      await page.goto(`/products/${product.productId}`);
      await expect(
        page.getByRole("heading", { name: product.name, level: 1 })
      ).toBeVisible();

      await page.getByRole("button", { name: "장바구니에 담기" }).click();
      await page.getByRole("link", { name: "장바구니로 이동" }).click();

      await expect(page).toHaveURL(/\/cart$/);
      await expect(
        page.getByRole("heading", { name: "장바구니가 비어 있습니다" })
      ).not.toBeVisible();
      await expect(page.getByText(product.name, { exact: true })).toBeVisible();

      // --- REQ-E2E-009 / AC-E2E-007: checkout form submit -> order created -> completion screen ---
      await page.getByRole("link", { name: "결제하기" }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      // Hydration-timing guard (plan.md §G risk table: "하이드레이션 타이밍
      // 플레이크" — no arbitrary waitForTimeout, role/text-based auto-wait
      // only). CheckoutForm's submit button is a real <button type="submit">
      // inside a <form>: a click before React attaches the onSubmit handler
      // (which calls event.preventDefault()) falls through to the browser's
      // OWN native GET submission — observed directly as a navigation to
      // "/checkout?recipientName=...&..." instead of the POST /api/orders
      // flow. waitForLoadState("networkidle") is a Playwright wait
      // primitive, not a sleep, and gives the client bundle time to finish
      // fetching and executing before the first form interaction.
      await page.waitForLoadState("networkidle");

      await page.getByLabel("수령인 이름").fill("김주문");
      await page.getByLabel("연락처").fill("010-1234-5678");
      await page.getByLabel("우편번호").fill("06236");
      await page.getByLabel("주소").fill("서울특별시 강남구 테헤란로 123");
      // deliveryMemo is the one optional field (spec.md §4.3) — left blank.

      await page.getByRole("button", { name: "주문하기" }).click();

      await expect(page).toHaveURL(/\/checkout\/complete\/[^/?]+$/);
      const match = new URL(page.url()).pathname.match(/\/checkout\/complete\/([^/]+)$/);
      orderId = match ? match[1]! : null;
      expect(orderId).toBeTruthy();

      await expect(
        page.getByRole("status").filter({ hasText: "아직 결제 전 단계입니다" })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "결제하기" })).toBeVisible();

      // --- REQ-E2E-010 / AC-E2E-008: payment success -> paid completion state ---
      // Defensive, scenario-scoped only (progress.md §E.2 M2 residual-risk
      // note): toss-sdk-stub.js hardcodes ONE literal success paymentKey for
      // every scenario, and Order.paymentKey carries a DB-level unique
      // constraint. Clearing any stale row holding it immediately before
      // THIS scenario's own confirm write guards against a leftover async
      // write from an earlier scenario colliding here — not the general M5
      // seed/isolation cleanup.
      await clearStalePaymentKey(STUB_SUCCESS_PAYMENT_KEY);

      await page.getByRole("button", { name: "결제하기" }).click();
      await expect(page).toHaveURL(new RegExp(`/checkout/complete/${orderId}$`));
      await expect(page).not.toHaveURL(/payment_failed=1/);

      await expect(
        page.getByRole("status").filter({ hasText: "결제가 완료되었습니다" })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "결제하기" })).not.toBeVisible();

      // Negative-direction proof (REQ-E2E-005), same as every payment
      // scenario in this suite.
      expect(tossHostHits).toHaveLength(0);
    } finally {
      if (orderId) {
        await deleteSpikeOrder(orderId);
      }
    }
  });
});
