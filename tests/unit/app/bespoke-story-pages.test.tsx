// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-BRAND-001 M6 — `/bespoke` and `/story` (REQ-BRAND-017/018/019,
 * AC-BRAND-018/019/020).
 *
 * Both routes are plain server components with no props and no data
 * fetching, so each is rendered directly (no page-adapter mocking needed —
 * matches the shell.test.tsx precedent for other zero-dependency static
 * pages in this app).
 */

const { default: BespokePage } = await import("@/app/(shop)/bespoke/page");
const { default: StoryPage } = await import("@/app/(shop)/story/page");

afterEach(cleanup);

describe("BespokePage — AC-BRAND-018", () => {
  it("includes all four landmark facts", () => {
    render(<BespokePage />);

    expect(screen.getByText(/285mm/)).toBeDefined();
    expect(screen.getByText(/330mm/)).toBeDefined();
    expect(screen.getByText(/손으로 꿰맵니다/)).toBeDefined();
    expect(screen.getByText(/약 4주/)).toBeDefined();
    expect(screen.getByText(/15만원/)).toBeDefined();
    expect(screen.getByText(/30만원/)).toBeDefined();
  });
});

describe("StoryPage — AC-BRAND-019", () => {
  it("includes the brand-story copy landmark", () => {
    render(<StoryPage />);

    expect(screen.getByText("한 켤레에 나흘")).toBeDefined();
    expect(screen.getByText(/손으로 꿰맵니다/)).toBeDefined();
  });
});

describe("BespokePage / StoryPage — AC-BRAND-020 (no interactive scope erosion)", () => {
  const SOURCE_FILES = ["src/app/(shop)/bespoke/page.tsx", "src/app/(shop)/story/page.tsx"];

  // Forbidden at the SOURCE level: a <form>, any submit control, cart
  // mutation, or client-side state/interactivity. Both pages should contain
  // ZERO occurrences of any of these.
  const FORBIDDEN_SOURCE_PATTERNS = [
    /<form/i,
    /type=["']submit["']/i,
    /장바구니에\s*담기/,
    /"use client"/,
    /\buseState\b/,
    /\bonClick\b/,
  ];

  it("contains no form, submit, cart, or client-interactivity tokens in source", () => {
    for (const path of SOURCE_FILES) {
      const source = readFileSync(path, "utf8");
      for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it("renders no <button> or <form> elements on either page", () => {
    const { container: bespoke } = render(<BespokePage />);
    expect(bespoke.querySelectorAll("form, button, input, textarea, select")).toHaveLength(0);

    const { container: story } = render(<StoryPage />);
    expect(story.querySelectorAll("form, button, input, textarea, select")).toHaveLength(0);
  });
});
