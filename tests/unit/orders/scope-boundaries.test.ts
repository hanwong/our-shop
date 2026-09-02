import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/**
 * SPEC-ORDER-001 M7 — the SPEC-wide boundaries, checked mechanically.
 *
 * Traces: AC-ORDER-012's static half (every write of the order transaction goes
 * through the transaction client), AC-ORDER-019 (no payment integration exists
 * anywhere), AC-ORDER-001 (c) and plan.md §4 (the PRESERVE list is intact).
 *
 * These criteria are about what the codebase does NOT contain, which no
 * behavioural test can establish: a feature that was never built cannot be
 * exercised. Reading the sources and the diff is the only available evidence,
 * so that is what this file does.
 *
 * The diff assertions run against the plan-phase commit, the last point before
 * any implementation existed.
 */

const PLAN_PHASE_HEAD = "c19ab47";

/** `git diff --numstat` restricted to the given paths, against plan-phase. */
function diffStat(...paths: string[]): string {
  return execFileSync("git", ["diff", "--numstat", PLAN_PHASE_HEAD, "--", ...paths], {
    encoding: "utf8",
  }).trim();
}

/**
 * `git grep -l`, returning the matching files or "" when there are none.
 *
 * `git grep` exits 1 on no match, which execFileSync raises as an error — and
 * "no match" is precisely the passing outcome for every use below, so that exit
 * code has to be read as a result rather than a failure.
 */
function grepFiles(pattern: string, flags: string): string {
  try {
    return execFileSync("git", ["grep", flags, pattern, "--", "src/"], {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return "";
    throw error;
  }
}

const orderService = readFileSync("src/features/orders/services/order-service.ts", "utf8");

describe("SPEC-ORDER-001 — every order write runs inside the transaction (AC-ORDER-012)", () => {
  it("opens exactly one transaction and touches no model on the singleton", () => {
    // `prisma` appears in this module for ONE purpose: opening the transaction.
    // Any other use of it would be a statement running outside the transaction
    // and therefore surviving a rollback.
    // `[$\w]+` because the one permitted member is `$transaction`, and `$` is
    // not a word character.
    const prismaUses = [...orderService.matchAll(/\bprisma\.([$\w]+)/g)].map((m) => m[1]!);

    expect(prismaUses).toEqual(["$transaction"]);
  });

  it("passes the transaction client to both cart-repository calls", () => {
    // design.md §2.1's whole reason for opening those two functions. A call
    // that omitted the client would silently use the singleton and read or
    // delete the cart outside the transaction.
    expect(orderService).toMatch(/findCartByGuestId\(\s*guestId,\s*tx\s*\)/);
    expect(orderService).toMatch(/deleteCart\(\s*cart\.id,\s*tx\s*\)/);
  });

  it("passes the transaction client to both order-repository writes", () => {
    expect(orderService).toMatch(/decrementStockIfAvailable\(\s*tx,/);
    expect(orderService).toMatch(/createOrderWithItems\(\s*tx,/);
  });

  it("aborts by throwing, never by returning a value from the callback", () => {
    // Prisma rolls back on a thrown error and COMMITS on a returned one, so a
    // refusal returned from inside the callback would persist a partial order.
    expect(orderService).toMatch(/throw new OrderAbort/);
  });
});

describe("SPEC-ORDER-001 — no payment integration exists (AC-ORDER-019)", () => {
  it("adds no dependency to package.json", () => {
    expect(diffStat("package.json")).toBe("");
  });

  it("adds no environment variable", () => {
    // .env.example may not exist in this checkout; either way, unchanged.
    expect(diffStat(".env.example")).toBe("");
  });

  it("calls no external payment endpoint anywhere in src/", () => {
    expect(grepFiles("toss|iamport|inicis|stripe|payment_gateway|pg_api", "-lIiE")).toBe("");
  });

  it("has no code path that writes an order's status to paid", () => {
    // The enum reserves `paid` and `cancelled` for later SPECs, but nothing in
    // this one writes them — the status column is a seat for the payment SPEC
    // to take, not a lifecycle this SPEC operates (REQ-ORDER-019).
    //
    // Scoped to the write shape (`status: "paid"`, the same shape as the
    // create-path's own `status: "pending_payment" as const`) rather than any
    // mention of the word: `OrderStatusDTO` (order.ts) is a string union of
    // all three enum values, and it has to be — it types every order this SPEC
    // reads back, including ones a future payment SPEC has already moved to
    // `paid`. A bare word scan can't tell that apart from a write and flags
    // the type declaration as if it were one.
    //
    // `-P` (PCRE), not `-E` (POSIX ERE): `\b` was the original pattern's
    // approach, but ERE's `\b` support is git-build-dependent — this pattern
    // no longer needs it, and the prior one silently matched nothing on a
    // build where `-E` didn't support `\b`, passing locally while the actual
    // check only ran in CI.
    expect(grepFiles("status\\s*:\\s*[\"']paid[\"']", "-lIP")).toBe("");
  });
});

describe("SPEC-ORDER-001 — the PRESERVE list held (plan.md §4)", () => {
  it("changed nothing under src/lib/auth/ — this SPEC only imports and calls", () => {
    expect(diffStat("src/lib/auth")).toBe("");
  });

  it("left src/middleware.ts untouched — /checkout is not a protected route", () => {
    expect(diffStat("src/middleware.ts")).toBe("");
  });

  it("left the catalog domain and the product endpoints untouched", () => {
    expect(diffStat("src/features/catalog", "src/app/api/products")).toBe("");
  });

  it("changed exactly one file under src/features/cart/ (the §4.1 exception)", () => {
    const changed = diffStat("src/features/cart")
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t")[2]!);

    expect(changed).toEqual(["src/features/cart/repositories/cart-repository.ts"]);
  });

  it("left every pre-existing cart call site at zero changed lines", () => {
    // The §4.1 parameter is optional precisely so this is TRUE rather than
    // merely intended (plan.md §4.1's mechanical DoD item).
    expect(
      diffStat(
        "src/features/cart/services",
        "src/features/cart/types",
        "src/app/api/cart",
        "src/app/api/auth"
      )
    ).toBe("");
  });

  it("added no member attribution to the User model (AC-ORDER-001 (c))", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const user = schema.match(/model\s+User\s*\{([\s\S]*?)\n\}/)![1]!;

    expect(user).not.toMatch(/orders?\s+Order/i);
  });

  it("has no server-identity adapter (AC-ORDER-021 (e))", () => {
    expect(existsSync("src/features/orders/lib/server-identity.ts")).toBe(false);
  });
});
