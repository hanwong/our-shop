import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * SPEC-BRAND-001 M2 — the grayscale design-token rebalance in globals.css.
 *
 * Static source scan (same pattern as typography-cascade.test.tsx): the
 * @theme block's color VALUES change, but no property name is added,
 * renamed, or removed, and the font/space/radius geometry tokens stay
 * byte-identical.
 */

function globalsCss(): string {
  return readFileSync("src/app/globals.css", "utf8");
}

describe("globals.css — SPEC-BRAND-001 M2 grayscale rebalance", () => {
  it("adopts the new grayscale color values for the core tokens", () => {
    const css = globalsCss();

    expect(css).toContain("--color-bg: #f2f2f2;");
    expect(css).toContain("--color-surface: #e9e9e9;");
    expect(css).toContain("--color-text: #1f1f1f;");
    expect(css).toContain("--color-accent: #2b2b2b;");
    expect(css).toContain("--color-accent-2: #2b2b2b;");
    expect(css).toContain("--color-divider: color-mix(in srgb, #1f1f1f 16%, transparent);");
  });

  it("rebalances the neutral and accent numeric scales to grayscale", () => {
    const css = globalsCss();

    expect(css).toContain("--color-neutral-100: #f5f5f5;");
    expect(css).toContain("--color-neutral-900: #2b2b2b;");
    expect(css).toContain("--color-accent-100: #f5f5f5;");
    expect(css).toContain("--color-accent-900: #1a1a1a;");
  });

  it("rebases the shadow tokens onto the new text color, geometry unchanged", () => {
    const css = globalsCss();

    expect(css).toContain("--shadow-sm: 0 1px 2px color-mix(in srgb, #1f1f1f 14%, transparent);");
    expect(css).toContain(
      "--shadow-md: 0 3px 10px color-mix(in srgb, #1f1f1f 16%, transparent);"
    );
    expect(css).toContain(
      "--shadow-lg: 0 12px 32px color-mix(in srgb, #1f1f1f 22%, transparent);"
    );
  });

  it("never introduces the --color-accent-2-* numeric lamp", () => {
    const css = globalsCss();

    const lampMatches = css.match(/accent-2-/g) ?? [];
    expect(lampMatches).toHaveLength(0);
  });

  it("leaves font, space, and radius tokens untouched", () => {
    const css = globalsCss();

    expect(css).toContain("--font-heading: var(--font-heading-nf), system-ui, sans-serif;");
    expect(css).toContain("--font-heading-weight: 600;");
    expect(css).toContain("--font-body: var(--font-body-nf), system-ui, sans-serif;");
    expect(css).toContain(
      "--space-1: 4.6px; --space-2: 9.2px; --space-3: 13.8px; --space-4: 18.4px; --space-6: 27.6px; --space-8: 36.8px;"
    );
    expect(css).toContain("--radius-sm: 2px; --radius-md: 4px; --radius-lg: 7px;");
  });

  it("declares a .plate grayscale-forcing utility rule", () => {
    const css = globalsCss();

    expect(css).toMatch(/\.plate\s*{\s*filter:\s*grayscale\(1\)\s*contrast\(1\.05\);\s*}/);
  });
});
