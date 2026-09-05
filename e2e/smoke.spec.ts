/**
 * SPEC-E2E-001 M1 exit condition (plan.md §F M1): "빈 시나리오 하나가 홈
 * 화면을 열고, 감시 라우트가 설치된 상태로 통과" — an otherwise-empty
 * scenario that opens the home screen with the Toss-host watch route
 * installed, and passes.
 */
import { test, expect } from "./support/fixtures";

test.describe("M1 smoke", () => {
  test("home screen loads with the Toss-host watch route installed", async ({
    page,
    tossHostHits,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    expect(tossHostHits).toHaveLength(0);
  });
});
