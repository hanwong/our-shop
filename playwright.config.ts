import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

import { assertRequiredEnvVars } from "./e2e/support/env-check";
import { clearCallLog } from "./e2e/support/call-log";

/**
 * SPEC-E2E-001 M1 — Playwright harness entry point.
 *
 * REQ-E2E-001/002/003 — a real Chromium browser against a real `next dev`
 * server, isolated from the existing Vitest suite (separate `test:e2e`
 * script, separate `e2e/` directory — REQ-E2E-002).
 *
 * REQ-E2E-004 / AC-E2E-003 — required env vars are asserted BEFORE
 * `defineConfig` is even evaluated, so a missing value fails the whole run
 * before Playwright starts the webServer or any scenario.
 */
assertRequiredEnvVars(
  ["DATABASE_URL", "NEXT_PUBLIC_PG_CLIENT_KEY", "PG_SECRET_KEY"],
  [path.join(__dirname, ".env"), path.join(__dirname, "e2e", "e2e-stub.env")]
);

// Cleared exactly once here, before the webServer (and its possibly-several
// dev-mode worker processes) ever starts — see call-log.ts's clearCallLog()
// doc comment for why this cannot live inside the --import interceptor
// module itself.
clearCallLog();

// A dedicated port, distinct from the ordinary `next dev` port (3000) that
// another concurrent session may already be holding open — the E2E webServer
// must not collide with (or silently attach to) an unrelated dev server.
const E2E_PORT = 3100;
const BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // REQ-E2E-016 — no scenario may depend on the interleaving of concurrent
  // actors; running serially, single worker, keeps that true by construction
  // rather than by discipline alone.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    // Chromium only (plan.md §C) — a first suite does not need cross-browser
    // coverage, and three browsers on day one is signal-to-cost negative.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // @MX:NOTE — the interceptor injection lives in `env.NODE_OPTIONS` below,
  // not in `command`; reading `command` alone does not reveal that this
  // webServer's outbound Toss calls are mocked (plan.md §H).
  webServer: {
    command: `npm run dev -- -p ${E2E_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // plan.md §B — the ONLY place the server-side interceptor is loaded.
      // Never present in a plain `npm run dev` or in production.
      NODE_OPTIONS: "--import ./e2e/support/mock-toss-api.mjs",
      NEXT_PUBLIC_PG_CLIENT_KEY: process.env.NEXT_PUBLIC_PG_CLIENT_KEY ?? "",
      PG_SECRET_KEY: process.env.PG_SECRET_KEY ?? "",
    },
  },
});
