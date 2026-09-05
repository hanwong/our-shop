/**
 * SPEC-E2E-001 M2 — installs the browser-side Toss SDK stub (plan.md §D)
 * on a Playwright `page` and exposes a mode switch.
 *
 * `page.route()` intercepts the exact CDN script URL toss-client.ts's
 * `loadScript()` requests and fulfils it with the raw stub source
 * (toss-sdk-stub.js) instead of letting the request reach a real host —
 * REQ-E2E-006. Playwright resolves a page-level route ahead of the
 * context-level Toss-host watch route installed by `tossHostHits`
 * (e2e/support/fixtures.ts), so a successfully-stubbed script load is never
 * counted as a forbidden-host hit; an UNstubbed request to any other
 * `*.tosspayments.com` path still is (REQ-E2E-005).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

const TOSS_SDK_SCRIPT_URL = "https://js.tosspayments.com/v2/standard";
const STUB_SCRIPT_PATH = path.join(__dirname, "toss-sdk-stub.js");
const STUB_SCRIPT_SOURCE = readFileSync(STUB_SCRIPT_PATH, "utf8");

export type TossPaymentMode = "success" | "fail";

export interface TossPaymentStub {
  /**
   * Sets `window.__E2E_PAYMENT_MODE__` for every subsequent navigation in
   * this page (`page.addInitScript()` runs on each new document). Must be
   * called BEFORE the `page.goto()` that renders the payment trigger —
   * calling it after the document has already loaded has no effect on the
   * current document.
   */
  setMode(mode: TossPaymentMode): Promise<void>;
  /**
   * SPEC-E2E-001 M4 (REQ-E2E-011, plan.md §D: "실패 -> 재시도 시나리오는
   * 같은 페이지에서 모드를 성공으로 바꾼 뒤 결제를 다시 누른다" — switch
   * mode on the SAME page, then retry).
   *
   * `setMode()` above only takes effect on a FUTURE navigation
   * (`addInitScript` re-runs on document creation, never retroactively on an
   * already-loaded document). The retry flow needs the opposite: change the
   * mode on the page the browser is ALREADY on, with no reload, so the next
   * `requestPayment()` call the retry click triggers reads the new value.
   * `page.evaluate()` writes the same global the stub script already reads
   * (toss-sdk-stub.js `window.__E2E_PAYMENT_MODE__`) — this is stub control,
   * not an assertion on application state (REQ-E2E-015 binds assertions,
   * not test setup).
   */
  setModeOnCurrentPage(mode: TossPaymentMode): Promise<void>;
}

/** Installs the CDN-script route on `page` and returns the mode-switch handle. */
export async function installTossPaymentStub(page: Page): Promise<TossPaymentStub> {
  await page.route(TOSS_SDK_SCRIPT_URL, async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: STUB_SCRIPT_SOURCE });
  });

  return {
    setMode: async (mode) => {
      await page.addInitScript((m) => {
        (window as unknown as Record<string, unknown>).__E2E_PAYMENT_MODE__ = m;
      }, mode);
    },
    setModeOnCurrentPage: async (mode) => {
      await page.evaluate((m) => {
        (window as unknown as Record<string, unknown>).__E2E_PAYMENT_MODE__ = m;
      }, mode);
    },
  };
}
