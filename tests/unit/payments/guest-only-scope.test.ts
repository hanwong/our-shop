import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * SPEC-PAYMENT-001 — the payment domain has no member/customer payment path
 * (AC-PAYMENT-020, REQ-PAYMENT-020).
 *
 * acceptance.md §AC-PAYMENT-020 names three surfaces to check: the payment
 * domain source trees, and the `Order` / `PaymentAuditLog` models in
 * prisma/schema.prisma. The verification means is "static source inspection
 * (zero token matches)" — this file is that inspection as a real, committed
 * regression test rather than an ad hoc one-off grep. Previously this AC was
 * verified only by hand (`grep -rn "userId" src/features/payments
 * src/app/api/payments`, 0 matches) and never landed as a test; this file
 * closes that gap.
 */

const PAYMENT_SRC_PATHS = ["src/features/payments", "src/app/api/payments"];

/** `git grep -l`, returning the matching files or "" when there are none. */
function grepFiles(pattern: string, ...paths: string[]): string {
  try {
    return execFileSync("git", ["grep", "-lIE", pattern, "--", ...paths], {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return "";
    throw error;
  }
}

const SCHEMA_PATH = path.resolve(__dirname, "../../../prisma/schema.prisma");
const schema = readFileSync(SCHEMA_PATH, "utf8");

/** Extracts the body of `model <name> { ... }` from the schema text. */
function modelBody(name: string): string {
  const match = schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`model ${name} not found in prisma/schema.prisma`);
  return match[1]!;
}

describe("SPEC-PAYMENT-001 — no member/customer payment path exists (AC-PAYMENT-020)", () => {
  it("has no `userId` reference anywhere under the payment domain source trees", () => {
    expect(grepFiles("userId", ...PAYMENT_SRC_PATHS)).toBe("");
  });

  it("handles no `resolveCartIdentity` `kind: \"user\"` branch in the payment domain", () => {
    expect(grepFiles('kind\\s*:\\s*"user"', ...PAYMENT_SRC_PATHS)).toBe("");
    expect(grepFiles("resolveCartIdentity", ...PAYMENT_SRC_PATHS)).toBe("");
  });

  it("adds no userId column to the Order model", () => {
    expect(modelBody("Order")).not.toMatch(/\buserId\b/);
  });

  it("adds no userId column to the PaymentAuditLog model", () => {
    expect(modelBody("PaymentAuditLog")).not.toMatch(/\buserId\b/);
  });
});
