// SPEC-E2E-001 — server-side Toss API interceptor ("다리 2" in plan.md §A).
//
// Loaded ONLY via `NODE_OPTIONS='--import ./e2e/support/mock-toss-api.mjs'`
// when Playwright's webServer starts `next dev` (playwright.config.ts). It
// is never loaded in any other run of this application, so it never reaches
// a production or a plain `npm run dev` process.
//
// @MX:WARN — replaces the process-global undici dispatcher for the whole
// Next.js server process. Sensitive to Node/undici version drift: if a
// future Node version stops sharing undici's global-dispatcher symbol
// between the bundled internal undici and this npm-installed one, global
// `fetch()` inside route handlers stops being intercepted and this module
// silently does nothing (the M1 spike test is what catches that).
// @MX:REASON plan.md §B's confirmed decision is that this is the ONLY
// mechanism intercepting src/lib/payment/toss-server.ts's outbound calls —
// that file's diff is 0 lines, so this module is the entire safety net for
// REQ-E2E-005 on the server side.
//
// Interception targets exactly the two module-constant URLs toss-server.ts
// calls (plan.md §B table) — nothing else is touched. Any other outbound
// fetch (Next.js's own telemetry, etc.) is left on the real dispatcher by
// not calling `mockAgent.disableNetConnect()` — undici's MockAgent passes
// non-matching requests through unless net-connect is explicitly disabled.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MockAgent, setGlobalDispatcher } from "undici";

// Next.js dev mode runs this --import hook in MORE THAN ONE OS process —
// observed: the `next dev` CLI process itself, plus a router-server process,
// plus (on the first hit to a not-yet-compiled route) a fresh render-worker
// process spawned mid-run. Each one independently re-executes this module.
// That rules out truncating the log file HERE at module-load time: a later
// worker's load would wipe a call an earlier worker already recorded — which
// is exactly what a first debugging run of this module surfaced (the
// confirm call WAS intercepted and recorded, then a subsequently-spawned
// worker's own module load truncated the file before the test read it).
// Clearing happens exactly once instead, from the Playwright CONFIG process,
// strictly before the webServer is even started (e2e/support/call-log.ts
// clearCallLog(), called from playwright.config.ts) — a point in time no
// Next.js worker can race.
const CALL_LOG_PATH = fileURLToPath(new URL("../.tmp/toss-mock-calls.jsonl", import.meta.url));
mkdirSync(dirname(CALL_LOG_PATH), { recursive: true });

/**
 * @param {"confirm"|"query"} endpoint
 * @param {string} method
 * @param {string} path
 * @param {string} [body]
 */
function recordCall(endpoint, method, path, body) {
  appendFileSync(
    CALL_LOG_PATH,
    `${JSON.stringify({ endpoint, method, path, body: body ?? null, at: new Date().toISOString() })}\n`
  );
}

const mockAgent = new MockAgent();
setGlobalDispatcher(mockAgent);

const tossPool = mockAgent.get("https://api.tosspayments.com");

// confirmTossPayment() → POST https://api.tosspayments.com/v1/payments/confirm
tossPool
  .intercept({ path: "/v1/payments/confirm", method: "POST" })
  .reply(200, (opts) => {
    recordCall("confirm", opts.method, opts.path, typeof opts.body === "string" ? opts.body : undefined);
    return { status: "DONE", e2e: "stub-confirm-response" };
  })
  .persist();

// queryTossPayment() → GET https://api.tosspayments.com/v1/payments/{paymentKey}
// (base URL has no trailing segment in the module constant — the paymentKey
// is appended at the call site, toss-server.ts:121 per plan.md §B table).
tossPool
  .intercept({ path: /^\/v1\/payments\/.+$/, method: "GET" })
  .reply(200, (opts) => {
    recordCall("query", opts.method, opts.path);
    const paymentKey = decodeURIComponent(opts.path.split("/").pop() ?? "");
    return {
      paymentKey,
      orderId: "e2e-stub-order-id",
      status: "DONE",
      totalAmount: 0,
      e2e: "stub-query-response",
    };
  })
  .persist();
