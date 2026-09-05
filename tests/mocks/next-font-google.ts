/**
 * SPEC-DESIGN-001 M0 — vitest stub for `next/font/google`.
 *
 * `next/font/google` requires the Next.js SWC font loader, which vitest does
 * not run, so importing the real module under test makes any file that
 * imports it untestable (`<FontName> is not a function` — reproduced and
 * captured as this SPEC's M0 RED evidence, matching the failure
 * SPEC-STOREFRONT-001 hit and reverted from). This stub is aliased in place
 * of the real module (`vitest.config.ts` `resolve.alias`) so any named
 * Google-font loader (`Cormorant_Garamond`, `Lora`, ...) returns a callable
 * function whose result shape mirrors the real module closely enough for
 * component code to consume: a `className` string and a `style` object
 * carrying a `fontFamily`.
 *
 * Only the shape consumed by this repository is stubbed — no attempt is
 * made to reproduce next/font's variable-name derivation, subsetting, or
 * preload behavior.
 */
function createMockFontLoader(mockFontFamilyName: string) {
  return function mockFontLoader() {
    return {
      className: `mock-font-${mockFontFamilyName.toLowerCase().replace(/\s+/g, "-")}`,
      style: { fontFamily: mockFontFamilyName },
      variable: `--font-${mockFontFamilyName.toLowerCase().replace(/\s+/g, "-")}`,
    };
  };
}

export const Cormorant_Garamond = createMockFontLoader("Cormorant Garamond");
export const Lora = createMockFontLoader("Lora");
