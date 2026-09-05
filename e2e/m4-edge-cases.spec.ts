/**
 * SPEC-E2E-001 M4 — failure/retry and edge paths (plan.md §F M4).
 *
 * Four independent scenarios, each its own REQ/AC (REQ-E2E-015 — each
 * scenario establishes its own state, no scenario depends on another):
 *
 *   1. REQ-E2E-011 / AC-E2E-009 — payment failure -> retry -> success.
 *   2. REQ-E2E-012 / AC-E2E-010 — empty cart -> /checkout entry.
 *   3. REQ-E2E-013 / AC-E2E-011 — required-field omission rejected.
 *   4. REQ-E2E-014 / AC-E2E-012 — coupon applied -> summary updates.
 *
 * Scenarios 1 and 4 reuse M1/M2's Toss-host watch fixture (`tossHostHits`)
 * where they touch payment or need the negative-direction REQ-E2E-005 proof
 * (Section A point 5 of the delegation prompt — scenario 1 touches payment
 * directly; scenarios 2/3 never reach PayButton, so the fixture is still
 * destructured for the same negative-direction discipline the rest of this
 * suite applies uniformly).
 */
import { test, expect } from "./support/fixtures";
import {
  GUEST_COOKIE_NAME,
  clearStalePaymentKey,
  createDiscountCoupon,
  createSpikeOrder,
  deleteDiscountCoupon,
  deleteSpikeOrder,
  disconnectSpikeOrderClient,
  getSeededProduct,
  STUB_SUCCESS_PAYMENT_KEY,
} from "./support/order-fixture";

test.describe("M4 — failure/retry and edge paths", () => {
  test.afterAll(async () => {
    await disconnectSpikeOrderClient();
  });

  // --- REQ-E2E-011 / AC-E2E-009 ---------------------------------------------
  test("payment failure shows the retry banner, and a retry with success reaches the paid state", async ({
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
      await expect(
        page.getByRole("alert").filter({ hasText: "결제가 완료되지 않았습니다" })
      ).toBeVisible();
      // design.md §6 "상태 우선 원칙" (progress.md §E.2 M4 note): the retry
      // banner appears ALONGSIDE the pending-payment status notice, not
      // instead of it — the order is still pending_payment at this point.
      await expect(
        page.getByRole("status").filter({ hasText: "아직 결제 전 단계입니다" })
      ).toBeVisible();
      const retryButton = page.getByRole("button", { name: "결제하기" });
      await expect(retryButton).toBeVisible();
      // Hydration-timing guard (plan.md §G risk table, same reasoning M3
      // applied to CheckoutForm's submit button): the failUrl navigation is a
      // full page load (`window.location.assign`), so the retry button's
      // onClick listener is not guaranteed attached the instant its HTML is
      // visible. No arbitrary waitForTimeout — this Playwright wait
      // primitive only.
      await page.waitForLoadState("networkidle");

      // plan.md §D: "실패 -> 재시도 시나리오는 같은 페이지에서 모드를 성공으로
      // 바꾼 뒤 결제를 다시 누른다" -- switch mode on the SAME page (no
      // reload), because `setMode()`'s `addInitScript()` only takes effect on
      // a FUTURE navigation and the failed page is already loaded.
      await clearStalePaymentKey(STUB_SUCCESS_PAYMENT_KEY);
      await tossPaymentStub.setModeOnCurrentPage("success");
      await retryButton.click();

      await expect(page).toHaveURL(new RegExp(`/checkout/complete/${order.orderId}$`));
      await expect(page).not.toHaveURL(/payment_failed=1/);
      await expect(
        page.getByRole("status").filter({ hasText: "결제가 완료되었습니다" })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "결제하기" })).not.toBeVisible();

      expect(tossHostHits).toHaveLength(0);
    } finally {
      await deleteSpikeOrder(order.orderId);
    }
  });

  // --- REQ-E2E-012 / AC-E2E-010 ---------------------------------------------
  test("an empty guest cart entering /checkout shows the checkout-unavailable screen, not the order form", async ({
    page,
    tossHostHits,
  }) => {
    // Fresh, isolated browser context (Playwright's default per test) — no
    // guest cart cookie has ever been minted here, so CheckoutPage's
    // `guestId === null` branch is the one under test (src/app/checkout/page.tsx).
    await page.goto("/checkout");

    await expect(
      page.getByRole("heading", { name: "주문서를 열 수 없습니다" })
    ).toBeVisible();
    await expect(page.getByLabel("수령인 이름")).toHaveCount(0);

    expect(tossHostHits).toHaveLength(0);
  });

  // --- REQ-E2E-013 / AC-E2E-011 ---------------------------------------------
  test("submitting the checkout form with a required field left empty is refused and stays on /checkout", async ({
    page,
    tossHostHits,
  }) => {
    const product = await getSeededProduct();

    await page.goto(`/products/${product.productId}`);
    await page.getByRole("button", { name: "장바구니에 담기" }).click();
    await page.getByRole("link", { name: "장바구니로 이동" }).click();
    await expect(page).toHaveURL(/\/cart$/);

    await page.getByRole("link", { name: "결제하기" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    // Hydration-timing guard (same reasoning as M3 — plan.md §G risk table):
    // no arbitrary waitForTimeout, role/text-based auto-wait plus this
    // Playwright wait primitive only.
    await page.waitForLoadState("networkidle");

    // 수령인 이름 (recipientName) deliberately left empty — required per
    // spec.md §4.3. `CheckoutForm` renders `noValidate` on its <form>
    // (src/components/checkout/CheckoutForm.tsx), so the browser's native
    // constraint validation never blocks this submission; the refusal under
    // test is the SERVER's (order-service.ts's `validate()`), not the
    // browser's.
    await page.getByLabel("연락처").fill("010-1234-5678");
    await page.getByLabel("우편번호").fill("06236");
    await page.getByLabel("주소").fill("서울특별시 강남구 테헤란로 123");

    await page.getByRole("button", { name: "주문하기" }).click();

    // CheckoutForm's handleSubmit only calls router.push() on response.ok
    // (src/components/checkout/CheckoutForm.tsx) -- a 400 leaves the browser
    // exactly where it was.
    await expect(
      page.getByRole("alert").filter({ hasText: "배송 정보를 다시 확인해 주세요" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page).not.toHaveURL(/\/checkout\/complete\//);

    expect(tossHostHits).toHaveLength(0);
  });

  // --- REQ-E2E-014 / AC-E2E-012 ---------------------------------------------
  test("applying a valid coupon updates the order summary before any order is submitted", async ({
    page,
  }) => {
    const product = await getSeededProduct();
    const coupon = await createDiscountCoupon();

    try {
      await page.goto(`/products/${product.productId}`);
      await page.getByRole("button", { name: "장바구니에 담기" }).click();
      await page.getByRole("link", { name: "장바구니로 이동" }).click();
      await expect(page).toHaveURL(/\/cart$/);

      await page.getByRole("link", { name: "결제하기" }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await page.waitForLoadState("networkidle");

      const summary = page.getByRole("region", { name: "주문 상품" });
      const totalRow = summary.locator('dt:has-text("결제 예정 금액") + dd');
      const totalBefore = await totalRow.innerText();

      await page.getByLabel("쿠폰 코드").fill(coupon.code);
      await page.getByRole("button", { name: "적용" }).click();

      await expect(
        page.getByRole("status").filter({ hasText: "쿠폰이 적용되었습니다" })
      ).toBeVisible();

      // REQ-DISCOUNT-023 rendering rule reused unmodified here: the discount
      // row exists in the DOM ONLY once discountAmount > 0
      // (src/components/checkout/OrderSummary.tsx).
      await expect(summary.locator('dt:has-text("할인 금액")')).toBeVisible();

      await expect(totalRow).not.toHaveText(totalBefore);

      // AC-E2E-012's second clause: applying a coupon must not itself create
      // an order. This scenario never clicks 주문하기 at all, so there is no
      // navigation to assert against -- the absence of that action IS the
      // proof, not a separate check.
      await expect(page).toHaveURL(/\/checkout$/);
    } finally {
      await deleteDiscountCoupon(coupon.code);
    }
  });
});
