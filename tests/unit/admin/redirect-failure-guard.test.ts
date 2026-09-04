import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-ADMIN-003 M4 (C layer) — source-order guard for the redirect check
 * (REQ-ADMIN-047, AC-ADMIN-047 second block).
 *
 * The behavioural tests next door prove that a redirect surfaces as an error
 * today. They cannot prove WHERE the check sits, and position is the whole
 * substance of the requirement: a `response.redirected` branch placed AFTER
 * the `response.ok` branch never runs, because the followed 307 answers 200
 * and `ok` claims the response first. The defect would survive a green test
 * suite, which is precisely the failure shape this SPEC exists to close.
 *
 * The second assertion is about the message, not the mechanism. A rejected
 * alternative (`redirect: "manual"`) also makes the screen show an error —
 * but a GENERIC one, because the empty body falls through to the existing
 * fallback wording. What was actually chosen is a dedicated sentence naming
 * what happened, defined once and shared, so all three call sites cannot
 * drift apart (plan.md §0 decision 2).
 *
 * @MX:NOTE the three call sites are discovered by reading the shared
 * constant's importers rather than by listing paths, so a fourth admin write
 * surface added later is judged by this guard without anybody editing it.
 */

const ROOT = path.resolve(__dirname, "../../..");
const CONSTANT_MODULE = "src/features/admin/write-failure.ts";
const CONSTANT_NAME = "REQUEST_NOT_DELIVERED";
const EXPECTED_MESSAGE = "요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.";

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

/**
 * Source with comments blanked out, length-preserving so byte offsets stay
 * comparable. This guard reasons about the ORDER of two statements, and the
 * comment explaining why that order matters naturally mentions both of them —
 * a guard that counted those mentions would fail on the very code it is meant
 * to bless, and the obvious way to make it pass again is to delete the
 * explanation. Judge code; ignore prose.
 */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

function walk(relative: string): string[] {
  const absolute = path.join(ROOT, relative);
  const out: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const child = path.join(absolute, entry);
    if (statSync(child).isDirectory()) {
      out.push(...walk(path.relative(ROOT, child)));
    } else {
      out.push(path.relative(ROOT, child));
    }
  }
  return out;
}

/**
 * Every source file that performs an admin write, found by enumeration rather
 * than by a hardcoded list: a file that calls fetch() AND imports the shared
 * failure constant is a call site, whatever it is named.
 */
function writeCallSites(): string[] {
  return walk("src/app/staff")
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .filter((f) => {
      const source = read(f);
      return /\bfetch\(/.test(source) && source.includes(CONSTANT_NAME);
    })
    .sort();
}

describe("[AC-ADMIN-047] the redirect check precedes the response.ok branch", () => {
  it("finds the admin write call sites by enumeration, and there are three writes across them", () => {
    const sites = writeCallSites();

    // Two files, three fetch() calls: ProductForm saves and toggles, the
    // cancel button cancels.
    expect(sites).toEqual([
      "src/app/staff/orders/[orderId]/CancelOrderButton.tsx",
      "src/app/staff/products/ProductForm.tsx",
    ]);
    expect(
      sites.reduce((n, f) => n + (code(f).match(/await fetch\(/g) ?? []).length, 0)
    ).toBe(3);
  });

  it.each(writeCallSites())(
    "%s checks response.redirected before it reads response.ok, at every fetch",
    (file) => {
      const source = code(file);

      const redirectedAt = [...source.matchAll(/response\.redirected/g)].map((m) => m.index!);
      const okAt = [...source.matchAll(/response\.ok/g)].map((m) => m.index!);

      // One guarded branch per fetch() in the file — not one for the file.
      expect(redirectedAt.length).toBe((source.match(/await fetch\(/g) ?? []).length);
      expect(okAt.length).toBe(redirectedAt.length);

      // Pairwise, in source order: guard i precedes ok-branch i.
      redirectedAt.forEach((position, i) => {
        expect(position).toBeLessThan(okAt[i]!);
      });
    }
  );

  it.each(writeCallSites())("%s imports the message and never re-declares it", (file) => {
    const source = code(file);

    expect(source).toMatch(/import\s*\{[^}]*REQUEST_NOT_DELIVERED[^}]*\}\s*from/);
    // A second literal copy is how three call sites drift into three messages.
    expect(source).not.toContain(EXPECTED_MESSAGE);
  });
});

describe("[AC-ADMIN-046] the message names what actually happened", () => {
  it("defines the constant in exactly one module, with the agreed wording", () => {
    const source = read(CONSTANT_MODULE);

    expect(source).toContain(EXPECTED_MESSAGE);
    expect(source).toMatch(new RegExp(`export const ${CONSTANT_NAME}`));
  });

  it("declares that wording nowhere else under src/", () => {
    const holders = walk("src")
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .filter((f) => read(f).includes(EXPECTED_MESSAGE));

    expect(holders).toEqual([CONSTANT_MODULE]);
  });

  it("is not one of the pre-existing generic failure messages", () => {
    // `redirect: "manual"` was rejected because it lands the caller in these
    // wordings instead — an error that erases its own cause (design.md §3.3).
    for (const generic of [
      "저장에 실패했습니다",
      "판매 상태를 변경하지 못했습니다",
      "주문을 취소하지 못했습니다",
    ]) {
      expect(EXPECTED_MESSAGE).not.toContain(generic);
    }
  });
});
