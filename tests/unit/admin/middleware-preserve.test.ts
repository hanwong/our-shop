import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-ADMIN-001 M5 — src/middleware.ts PRESERVE non-regression guard.
 *
 * Traces: REQ-ADMIN-018 / AC-ADMIN-018 ("기존 파일이 변경되지 않는다"), plan.md
 * §5 M5's explicit "src/middleware.ts 무변경 회귀 가드 테스트(정적 파일 diff 0줄
 * 확인)" requirement.
 *
 * This is a structural regression guard, not a one-time check — it reads the
 * FILE CONTENT directly via readFileSync (no git plumbing; a vitest test must
 * not shell out to git for this) and asserts on properties that stay true
 * forever, so it keeps failing loudly if this file is ever edited again —
 * deliberately or by accident — even long after this SPEC closes and nobody
 * remembers to check.
 *
 * This SPEC never edits src/middleware.ts (plan.md §3 PRESERVE list); this
 * file is verify-only, matching this test's own read-only discipline.
 */

const MIDDLEWARE_PATH = path.resolve(__dirname, "../../../src/middleware.ts");

/** SPEC-AUTH-001 M6's matcher — the sole route-gating surface REQ-ADMIN-017
 * deliberately does NOT extend or rely on (this SPEC re-verifies admin
 * sessions in each route handler instead). */
const EXPECTED_MATCHER = ["/admin/:path*"];

/**
 * Byte-length + SHA-256 content snapshot captured against the file as
 * committed by SPEC-AUTH-001 M6 (unchanged through SPEC-ADMIN-001 M1-M4).
 * If either assertion below fails, the file has changed since this
 * snapshot was taken — read the diff before touching these constants; this
 * file is PRESERVE-listed (plan.md §3 / acceptance.md AC-ADMIN-018) and is
 * not expected to legitimately change within this SPEC's lifetime.
 */
const EXPECTED_BYTE_LENGTH = 2485;
const EXPECTED_SHA256 = "8d82d3c13a3d00131be8e22ff088384f378bc4183d9c772f97e6591153d332e0";

function readMiddlewareSource(): string {
  return readFileSync(MIDDLEWARE_PATH, "utf8");
}

/** Parses the literal `matcher: [...]` array without eval — a plain
 * comma-split of quoted string literals inside the brackets. */
function extractMatcher(source: string): string[] {
  const match = source.match(/matcher:\s*\[([^\]]*)\]/);
  if (match === null) return [];
  return match[1]!
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter((entry) => entry.length > 0);
}

describe("src/middleware.ts — PRESERVE regression guard (REQ-ADMIN-018 / AC-ADMIN-018)", () => {
  it('exports export const config = { matcher: [...] } equal to exactly ["/admin/:path*"]', () => {
    const source = readMiddlewareSource();
    const matcher = extractMatcher(source);
    expect(matcher).toEqual(EXPECTED_MATCHER);
  });

  it("contains no reference to /staff anywhere — proves /staff/* was never added to this file's scope", () => {
    const source = readMiddlewareSource();
    expect(source).not.toMatch(/\/staff/);
  });

  it("byte-length + SHA-256 content snapshot — ANY future edit to this file, not just a /staff reference, fails this test loudly", () => {
    const source = readMiddlewareSource();
    const byteLength = Buffer.byteLength(source, "utf8");
    const sha256 = createHash("sha256").update(source, "utf8").digest("hex");

    expect(byteLength).toBe(EXPECTED_BYTE_LENGTH);
    expect(sha256).toBe(EXPECTED_SHA256);
  });
});
