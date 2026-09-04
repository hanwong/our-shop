// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { ProductListItem } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-003 M1 — a single product card in the home grid
 * (REQ-STOREFRONT-033/034/035/037/040/041).
 *
 * Props-in / DOM-out isolation, matching ProductGallery's test pattern
 * (acceptance.md AC-STOREFRONT-041): no service mocking, only props.
 */

// next/image is replaced with a plain <img> so assertions stay at the
// role/alt level (matching product-gallery.test.tsx / product-detail-view
// test.tsx precedent) rather than coupling to the optimizer's markup.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} className={className} />
  ),
}));

const { ProductCard } = await import("@/components/product/ProductCard");

afterEach(cleanup);

function product(
  overrides: Partial<Pick<ProductListItem, "id" | "name" | "price" | "images">> = {}
): Pick<ProductListItem, "id" | "name" | "price" | "images"> {
  return {
    id: "p-1",
    name: "Classic Denim Jacket",
    price: 89000,
    images: ["https://picsum.photos/seed/a/600/600"],
    ...overrides,
  };
}

describe("ProductCard — AC-STOREFRONT-033", () => {
  it("shows the representative image, name, and formatted price", () => {
    render(<ProductCard product={product()} />);

    expect(screen.getByAltText("Classic Denim Jacket")).toBeDefined();
    expect(screen.getByText("Classic Denim Jacket")).toBeDefined();
    expect(screen.getByText("89,000원")).toBeDefined();
  });

  it("links to the product detail route", () => {
    render(<ProductCard product={product({ id: "p-42" })} />);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/products/p-42");
  });

  it("uses the first image as the representative one", () => {
    render(
      <ProductCard
        product={product({
          images: [
            "https://picsum.photos/seed/a/600/600",
            "https://picsum.photos/seed/b/600/600",
          ],
        })}
      />
    );

    expect(screen.getByAltText("Classic Denim Jacket").getAttribute("src")).toBe(
      "https://picsum.photos/seed/a/600/600"
    );
  });
});

describe("ProductCard — AC-STOREFRONT-033 (REQ-STOREFRONT-035 link wrap)", () => {
  it("wraps the entire card (image + name + price) in a single link", () => {
    render(<ProductCard product={product()} />);

    const link = screen.getByRole("link");
    expect(link.textContent).toContain("Classic Denim Jacket");
    expect(link.textContent).toContain("89,000원");
  });
});

describe("ProductCard — D1 (plan-audit optional) next/image usage", () => {
  it("uses next/image for the representative image, not a plain <img> tag", () => {
    const source = readFileSync("src/components/product/ProductCard.tsx", "utf8");
    expect(source).toMatch(/from ["']next\/image["']/);
  });
});

describe("ProductCard — AC-STOREFRONT-035 (REQ-STOREFRONT-037 no-image placeholder)", () => {
  it("renders a placeholder instead of throwing when the product has no images", () => {
    expect(() => render(<ProductCard product={product({ images: [] })} />)).not.toThrow();

    expect(screen.getByTestId("product-card-placeholder")).toBeDefined();
    expect(screen.getByText(/이미지 준비 중/)).toBeDefined();
    // name/price still render normally alongside the placeholder
    expect(screen.getByText("Classic Denim Jacket")).toBeDefined();
    expect(screen.getByText("89,000원")).toBeDefined();
  });
});

describe("ProductCard — AC-STOREFRONT-038 (scope: no description/stock/category)", () => {
  it("does not render fields outside name/price/image", () => {
    render(<ProductCard product={product()} />);

    expect(screen.queryByText(/재고/)).toBeNull();
    expect(screen.queryByText(/아우터/)).toBeNull();
  });
});

describe("ProductCard — AC-STOREFRONT-040 (a)/(b) accessibility", () => {
  it("gives the image alt text that includes the product name", () => {
    render(<ProductCard product={product({ name: "코튼 볼캡" })} />);

    const img = screen.getByRole("img");
    const alt = img.getAttribute("alt") ?? "";
    expect(alt.length).toBeGreaterThan(0);
    expect(alt).toContain("코튼 볼캡");
  });

  it("is a focusable native link", () => {
    render(<ProductCard product={product()} />);

    const link = screen.getByRole("link");
    link.focus();
    expect(document.activeElement).toBe(link);
  });
});
