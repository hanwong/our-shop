// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * SPEC-DESIGN-001 sync-audit F1 fix (2026-09-05) — regression guard.
 *
 * sync-audit's F1 finding: the Classical typography tokens (`--font-heading`
 * / `--font-body`, declared in the `@theme` block) were never applied to any
 * rendered element. `layout.tsx` set `next/font`'s className tokens on
 * `<html>`, but `globals.css` carries a pre-existing, more specific `body`
 * rule with its own `font-family` declaration — per CSS inheritance
 * mechanics, every element under `<body>` inherits from THAT rule, not from
 * whatever `<html>` declares. No test asserted anything about rendered
 * `font-family` (`grep -rn "font-family|getComputedStyle" tests/` → 0 hits
 * before this file), so the gap was invisible to the suite by construction.
 *
 * jsdom cannot resolve real computed `font-family` from an external CSS file
 * via `getComputedStyle` (sync-audit report, F1 point 6) — a rendered
 * assertion would not discriminate the bug. This is therefore a static scan
 * of `globals.css`'s source text, the same technique `shell.test.tsx` uses
 * for structural CSS-pipeline assertions.
 */

function readGlobalsCss(): string {
  return readFileSync("src/app/globals.css", "utf8");
}

function extractRule(css: string, selectorPattern: RegExp): string | null {
  const match = css.match(selectorPattern);
  return match ? match[0] : null;
}

describe("globals.css typography cascade — sync-audit F1 regression guard", () => {
  it("applies var(--font-body) to the body rule's font-family, ahead of the Korean fallback stack", () => {
    const css = readGlobalsCss();
    const bodyRule = extractRule(css, /\bbody\s*\{[^}]*\}/);

    expect(bodyRule).not.toBeNull();
    // The body rule is what every page element actually inherits from
    // (sync-audit F1 point 4) — it must lead with the Classical body font,
    // not just the pre-existing Korean-fallback stack.
    expect(bodyRule).toMatch(/font-family:\s*\n?\s*var\(--font-body\)/);

    // The Korean fallback chain must survive the fix (sync-audit F1's
    // secondary observation — Cormorant Garamond/Lora carry no Hangul
    // glyphs, so Korean copy must still fall through to the curated stack).
    expect(bodyRule).toMatch(/"Apple SD Gothic Neo"/);
    expect(bodyRule).toMatch(/"Malgun Gothic"/);
    expect(bodyRule).toMatch(/"Noto Sans KR"/);
  });

  it("declares a heading-level rule that applies var(--font-heading), outside the @theme token block", () => {
    const css = readGlobalsCss();
    const themeBlock = extractRule(css, /@theme\s*\{[\s\S]*?\n\}/);
    const cssOutsideTheme = themeBlock ? css.replace(themeBlock, "") : css;

    // AC-DESIGN-001 requires the @theme block's token VALUES to stay
    // byte-identical to plan.md §D.1 — this assertion is scoped to rules
    // OUTSIDE @theme specifically so it cannot be satisfied by the mere
    // token declaration (`--font-heading: "Cormorant Garamond", ...;`)
    // sitting inert inside @theme, which is exactly what sync-audit F1
    // found: the token existed but nothing outside @theme referenced it.
    expect(cssOutsideTheme).toMatch(/font-family:\s*\n?\s*var\(--font-heading\)/);

    // Same Korean-fallback requirement as the body rule.
    const headingRuleFontFamilyIndex = cssOutsideTheme.search(
      /font-family:\s*\n?\s*var\(--font-heading\)/
    );
    expect(headingRuleFontFamilyIndex).toBeGreaterThan(-1);
  });
});
