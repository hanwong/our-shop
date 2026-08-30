// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import RootLayout, { metadata } from "@/app/layout";
import HomePage from "@/app/page";

/**
 * SPEC-STOREFRONT-001 M1 — the root document shell.
 *
 * Deliberately minimal (plan.md §F): the shell carries no logic, so these
 * tests assert only what the shell declares. Snapshots, exhaustive metadata
 * field checks, and accessibility audits are out of scope here — adding them
 * "while we're writing a test anyway" is the §L anti-pattern.
 */

describe("RootLayout — AC-STOREFRONT-001 / 002", () => {
  it("declares a Korean document with a body and non-empty site metadata", () => {
    // Inspect the returned element tree rather than mounting it: React warns
    // when <html>/<body> are nested inside the jsdom container <div>, and what
    // this AC checks is what the shell DECLARES, not the mount result
    // (plan.md §F).
    const tree = RootLayout({ children: null }) as ReactElement<{
      lang?: string;
      children?: ReactElement<unknown, string>;
    }>;

    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("ko");
    expect(tree.props.children?.type).toBe("body");
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
  });

  it("wires the Tailwind v4 entry point through globals.css", () => {
    // AC-001(a) static half: the pipeline is wired CSS-first (plan.md §C-1).
    expect(readFileSync("src/app/layout.tsx", "utf8")).toContain("globals.css");
    expect(readFileSync("src/app/globals.css", "utf8").trimStart()).toMatch(
      /^@import "tailwindcss";/
    );
  });
});

describe("HomePage stub — §4 minimal exception", () => {
  it("renders an entry link into the product detail route", () => {
    render(<HomePage />);
    const link = screen.getByRole("link");

    expect(link.getAttribute("href")).toMatch(/^\/products\//);
    // AC-001(b): the component emits the Tailwind utility tokens its markup
    // declares. jsdom has no layout engine, so the computed style is out of
    // reach — the class string is what is observable here.
    expect(link.className).toMatch(/\bunderline\b/);
  });
});
