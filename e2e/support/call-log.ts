/**
 * SPEC-E2E-001 M1 — reads the call log e2e/support/mock-toss-api.mjs writes
 * from inside the Next.js server process. The two processes (webServer and
 * this Playwright test runner) share nothing but the filesystem, so the log
 * file is the cross-process observability channel for the M1 spike's PASS
 * points 2 and 3 (plan.md §B step 2/3 — "MockAgent가 그것을 가로챘음을
 * 인터셉터 측 기록으로 확인한다").
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface TossMockCallRecord {
  endpoint: "confirm" | "query";
  method: string;
  path: string;
  body: string | null;
  at: string;
}

// Playwright transpiles test-support .ts files to CommonJS by default (no
// "type": "module" at the repo root), so `__dirname` is available directly —
// unlike e2e/support/mock-toss-api.mjs, which is loaded as raw ESM via
// NODE_OPTIONS --import and uses import.meta.url instead.
const CALL_LOG_PATH = path.join(__dirname, "../.tmp/toss-mock-calls.jsonl");

/** Reads every call the interceptor has recorded so far, oldest first. */
export function readCallLog(): TossMockCallRecord[] {
  if (!existsSync(CALL_LOG_PATH)) return [];
  const raw = readFileSync(CALL_LOG_PATH, "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TossMockCallRecord);
}

/**
 * Clears the call log. MUST be called exactly once, from the Playwright
 * CONFIG process, strictly before the webServer starts (playwright.config.ts)
 * — never from inside e2e/support/mock-toss-api.mjs, which loads once per
 * Next.js dev worker process (observed: more than one) and would otherwise
 * race a later worker's load against an earlier worker's already-recorded
 * call.
 */
export function clearCallLog(): void {
  mkdirSync(path.dirname(CALL_LOG_PATH), { recursive: true });
  writeFileSync(CALL_LOG_PATH, "");
}
