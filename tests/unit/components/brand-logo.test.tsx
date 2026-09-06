// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-BRAND-001 M1 — src/components/layout/BrandLogo.tsx.
 *
 * next/image is replaced with a plain <img> so assertions stay at the
 * role/alt level (matching product-card.test.tsx precedent) rather than
 * coupling to the optimizer's markup.
 */
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

const { BrandLogo } = await import("@/components/layout/BrandLogo");

afterEach(cleanup);

describe("BrandLogo — SPEC-BRAND-001 M1", () => {
  it("renders an image with non-empty alt text and explicit width/height", () => {
    render(<BrandLogo />);

    const img = screen.getByRole("img");
    const alt = img.getAttribute("alt") ?? "";
    expect(alt.length).toBeGreaterThan(0);
    expect(img.getAttribute("width")).not.toBeNull();
    expect(img.getAttribute("height")).not.toBeNull();
  });

  it("wraps the image in a link to the home route", () => {
    render(<BrandLogo />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/");
  });
});
