import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * SPEC-ORDER-002 M2 — AC-ORDER-024: every stock write in the order domain is a
 * conditional atomic update (REQ-ORDER-022).
 *
 * This SPEC does not invent the concurrency strategy — it adopts the one
 * already in order-repository.ts and FIXES it as a contract (plan.md §1). A
 * contract nobody checks is a comment, so this file enumerates the stock-write
 * call sites mechanically and fails if a second one appears.
 *
 * What this establishes, exactly: there is ONE statement in
 * src/features/orders/** that writes Product.stock, and that statement carries
 * its own `stock: { gte }` guard in the WHERE. That is the property the
 * strategy rests on — the database re-evaluates the condition under the row
 * lock, so no application-side window exists between deciding and writing.
 *
 * What it does NOT establish: that no read-compare-write path could ever be
 * written. A static scan cannot prove the absence of a semantic pattern. It can
 * prove that the only write is guarded and that adding a second one breaks a
 * test — which is what makes the strategy hard to erode by accident.
 */

const FEATURE_DIR = "src/features/orders";

/** Every .ts file under the order feature, as [path, source] pairs. */
function orderSources(dir = FEATURE_DIR): Array<[string, string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return orderSources(path);
    if (!entry.name.endsWith(".ts")) return [];
    return [[path, readFileSync(path, "utf8")] as [string, string]];
  });
}

const sources = orderSources();

/** Files whose source contains at least one match of `pattern`. */
function filesMatching(pattern: RegExp): string[] {
  return sources.filter(([, source]) => pattern.test(source)).map(([path]) => path);
}

/** Total occurrences of `pattern` across the whole feature. */
function countMatches(pattern: RegExp): number {
  return sources.reduce((total, [, source]) => total + [...source.matchAll(pattern)].length, 0);
}

describe("SPEC-ORDER-002 M2 — the stock write path (AC-ORDER-024, REQ-ORDER-022)", () => {
  it("finds sources to scan at all", () => {
    // Without this the assertions below would pass vacuously on an empty list —
    // a green that means "nothing was checked".
    expect(sources.length).toBeGreaterThan(0);
  });

  it("decrements stock in exactly ONE place", () => {
    const writes = countMatches(/stock:\s*\{\s*decrement/g);

    // A second decrement site is the shape this SPEC exists to prevent: two
    // places writing the same counter drift apart, and only one of them is
    // guaranteed to carry the guard below.
    expect(writes).toBe(1);
    expect(filesMatching(/stock:\s*\{\s*decrement/)).toEqual([
      "src/features/orders/repositories/order-repository.ts",
    ]);
  });

  it("guards that decrement with a stock condition inside the UPDATE's own WHERE", () => {
    const [, repository] = sources.find(([path]) => path.endsWith("order-repository.ts"))!;

    // `gte` in the WHERE is the entire strategy: PostgreSQL takes the row lock,
    // then RE-EVALUATES the condition, so the loser of a race sees the winner's
    // committed stock and gets count 0 (plan.md §1).
    expect(repository).toMatch(
      /updateMany\(\{\s*where:\s*\{[^}]*stock:\s*\{\s*gte:[^}]*\}[^}]*\}/
    );
  });

  it("restores stock nowhere in this domain — the cancel path belongs to SPEC-PAYMENT-001", () => {
    // plan.md §5 PRESERVE: this SPEC touches the DEDUCTION path only.
    expect(filesMatching(/stock:\s*\{\s*increment/)).toEqual([]);
  });

  it("writes the product model from the repository alone", () => {
    // The service reaches the product table only through the repository
    // function above, so there is no second, unguarded route to the counter.
    expect(filesMatching(/\bproduct\.(update|updateMany|upsert)\b/)).toEqual([
      "src/features/orders/repositories/order-repository.ts",
    ]);
  });
});
