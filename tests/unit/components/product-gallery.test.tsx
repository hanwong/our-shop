// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * SPEC-STOREFRONT-001 M4 — the image gallery (REQ-STOREFRONT-010..014, 015a/b).
 *
 * The interaction surface is deliberately small: one hero image and a thumbnail
 * strip that swaps it. REQ-STOREFRONT-014 forbids zoom, lightbox, swipe, and
 * autoplay, so what remains is the whole feature (plan.md §E).
 */

// next/image is replaced with a plain <img> so assertions stay at the role/alt
// level (plan.md §K R6). Only the attributes the tests read are forwarded:
// spreading the rest would push next-only props (`fill`, `priority`) onto the
// DOM and make React warn about non-boolean attributes on every render.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} className={className} />
  ),
}));

const { ProductGallery } = await import("@/components/product/ProductGallery");

afterEach(cleanup);

const IMG_A = "https://picsum.photos/seed/a/600/600";
const IMG_B = "https://picsum.photos/seed/b/600/600";
const IMG_C = "https://picsum.photos/seed/c/600/600";
const NAME = "Classic Denim Jacket";

/** The hero is addressed by its alt text so the assertion does not couple to markup shape. */
const hero = () => screen.getByAltText(`${NAME} 대표 이미지`);

describe("ProductGallery — AC-STOREFRONT-010 / 011", () => {
  it("shows the first image as the initial hero", () => {
    render(<ProductGallery images={[IMG_A, IMG_B, IMG_C]} productName={NAME} />);

    expect(hero().getAttribute("src")).toBe(IMG_A);
  });

  it("renders one thumbnail per image when there are several", () => {
    render(<ProductGallery images={[IMG_A, IMG_B, IMG_C]} productName={NAME} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("renders no thumbnail strip at all for a single image", () => {
    render(<ProductGallery images={[IMG_A]} productName={NAME} />);

    expect(hero().getAttribute("src")).toBe(IMG_A);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("ProductGallery — AC-STOREFRONT-012", () => {
  it("swaps the hero and marks the chosen thumbnail as current", () => {
    render(<ProductGallery images={[IMG_A, IMG_B, IMG_C]} productName={NAME} />);
    const thumbs = screen.getAllByRole("button");

    fireEvent.click(thumbs[2]!);

    expect(hero().getAttribute("src")).toBe(IMG_C);
    expect(thumbs[2]!.getAttribute("aria-current")).toBe("true");
    expect(thumbs[0]!.getAttribute("aria-current")).not.toBe("true");
    expect(thumbs[1]!.getAttribute("aria-current")).not.toBe("true");
  });
});

describe("ProductGallery — AC-STOREFRONT-013", () => {
  it("renders a placeholder instead of throwing when the product has no images", () => {
    expect(() => render(<ProductGallery images={[]} productName={NAME} />)).not.toThrow();

    expect(screen.getByText(/이미지 준비 중/)).toBeDefined();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("ProductGallery — AC-STOREFRONT-014", () => {
  it("implements none of the forbidden gallery interactions", () => {
    const source = readFileSync("src/components/product/ProductGallery.tsx", "utf8");

    expect(source).not.toMatch(/zoom|magnif/i);
    expect(source).not.toMatch(/lightbox|modal|dialog/i);
    expect(source).not.toMatch(/swipe|touchstart|touchmove|onPan/i);
    expect(source).not.toMatch(/setInterval|autoplay|autoPlay/i);
  });

  it("adds no carousel or lightbox runtime dependency", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies: Record<string, string>;
    };

    for (const name of Object.keys(pkg.dependencies)) {
      expect(name).not.toMatch(/swiper|slick|lightbox|fancybox|embla|keen-slider|carousel/i);
    }
  });
});

describe("ProductGallery — AC-STOREFRONT-015 (a) / (b)", () => {
  it("exposes thumbnails as focusable native buttons that activate by keyboard", () => {
    render(<ProductGallery images={[IMG_A, IMG_B, IMG_C]} productName={NAME} />);
    const thumbs = screen.getAllByRole("button");

    thumbs[1]!.focus();
    expect(document.activeElement).toBe(thumbs[1]);

    // Native <button> converts Enter/Space into a click; that translation is a
    // platform guarantee this SPEC does not re-verify (acceptance.md §5). What
    // is verified here is that activating the focused control swaps the hero.
    fireEvent.click(document.activeElement!);
    expect(hero().getAttribute("src")).toBe(IMG_B);
  });

  it("gives every rendered image alt text carrying the product name", () => {
    render(<ProductGallery images={[IMG_A, IMG_B, IMG_C]} productName={NAME} />);

    for (const img of screen.getAllByRole("img")) {
      const alt = img.getAttribute("alt") ?? "";
      expect(alt.length).toBeGreaterThan(0);
      expect(alt).toContain(NAME);
    }
  });
});
