/**
 * SPEC-E2E-001 M1 — REQ-E2E-004 / AC-E2E-003.
 *
 * "When a required E2E environment variable is absent at suite start, the
 * harness shall fail with a message naming the missing variable, rather than
 * starting a run that would silently reach an external host."
 *
 * Called from playwright.config.ts at module-load time — i.e. before
 * Playwright starts the webServer or any scenario. Best-effort loads each of
 * the given env files (root .env for DATABASE_URL, e2e/e2e-stub.env for the
 * stub Toss credentials — spec.md §4.1) into process.env, then asserts every
 * required name resolves to a non-empty string.
 */
import { existsSync } from "node:fs";

/**
 * Loads a dotenv-style file into process.env using Node's own env-file
 * parser (stable since Node 20.6, no external dependency needed — same
 * "use what the runtime already provides" convention prisma/seed-coupons.ts
 * documents for TypeScript stripping). A missing file is not itself a
 * failure here: assertRequiredEnvVars() below is what decides that, so the
 * two failure modes (file absent vs. key absent) report through the same
 * one clear message.
 */
function tryLoadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  process.loadEnvFile(path);
}

export function assertRequiredEnvVars(names: readonly string[], envFilePaths: readonly string[]): void {
  // The Playwright CLI process does NOT go through Next.js's own .env
  // loading (that only happens inside the `next dev` child process this
  // config's webServer spawns) — so DATABASE_URL from the root .env must be
  // loaded here too, read-only, or this process-level check (and any direct
  // Prisma use from a test file, which inherits this process's env) would
  // never see it. Root .env itself is never written to (B10 PRESERVE).
  for (const path of envFilePaths) tryLoadEnvFile(path);

  const missing = names.filter((name) => {
    const value = process.env[name];
    return value === undefined || value === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `[e2e] required environment variable(s) missing before suite start: ${missing.join(", ")}. ` +
        `Set them directly or add them to one of: ${envFilePaths.join(", ")} (REQ-E2E-004).`
    );
  }
}
