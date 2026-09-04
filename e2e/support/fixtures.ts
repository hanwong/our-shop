/**
 * SPEC-E2E-001 — shared Playwright fixtures.
 *
 * `tossHostHits` installs the browser-side Toss-host watch route
 * (plan.md §D "금지 요청 감시") on every test's context: any request whose
 * host matches `*.tosspayments.com` is aborted and recorded rather than
 * silently let through. REQ-E2E-005's negative-direction proof (M1 spike
 * point 4) is that this array stays empty for the whole scenario.
 *
 * @MX:WARN — this route is the only thing turning a silently-bypassed stub
 * into a failing test. Removing it lets REQ-E2E-005 regress to green without
 * anyone noticing (plan.md §H).
 * @MX:REASON a passing suite must not be able to hide a real network call to
 * a Toss host — that is the one property this fixture exists to guarantee.
 */
import { test as base, expect } from "@playwright/test";

export interface TossHostGuardFixtures {
  tossHostHits: string[];
}

export const test = base.extend<TossHostGuardFixtures>({
  tossHostHits: async ({ context }, use) => {
    const hits: string[] = [];
    await context.route("**://*.tosspayments.com/**", async (route) => {
      hits.push(route.request().url());
      await route.abort();
    });
    await use(hits);
  },
});

export { expect };
