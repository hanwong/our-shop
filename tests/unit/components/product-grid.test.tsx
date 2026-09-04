// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { ProductListItem } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-003 M2 — the home product grid (REQ-STOREFRONT-033).
 *
 * Props-in / DOM-out isolation, same pattern as product-card.test.tsx: no
 * service mocking, `ProductGrid` receives an already-built
 * `ProductListItem[]` array directly (acceptance.md AC-STOREFRONT-041).
 */

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} className={className} />
  ),
}));

const { ProductGrid } = await import("@/components/product/ProductGrid");

afterEach(cleanup);

function items(): ProductListItem[] {
  return [
    {
      id: "p-1",
      name: "상품 A",
      price: 10000,
      images: ["https://picsum.photos/seed/a/600/600"],
      stock: 5,
      category: { id: "c1", name: "카테고리", slug: "cat" },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "p-2",
      name: "상품 B",
      price: 20000,
      images: [],
      stock: 3,
      category: { id: "c1", name: "카테고리", slug: "cat" },
      createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "p-3",
      name: "상품 C",
      price: 30000,
      images: ["https://picsum.photos/seed/c/600/600"],
      stock: 1,
      category: { id: "c1", name: "카테고리", slug: "cat" },
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  ];
}

describe("ProductGrid — AC-STOREFRONT-039", () => {
  it("renders exactly one card per product, preserving array order", () => {
    render(<ProductGrid products={items()} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/products/p-1",
      "/products/p-2",
      "/products/p-3",
    ]);
  });

  it("gives every card a distinct product-id link", () => {
    render(<ProductGrid products={items()} />);

    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("renders each product's name and formatted price", () => {
    render(<ProductGrid products={items()} />);

    expect(screen.getByText("상품 A")).toBeDefined();
    expect(screen.getByText("10,000원")).toBeDefined();
    expect(screen.getByText("상품 B")).toBeDefined();
    expect(screen.getByText("20,000원")).toBeDefined();
  });
});

describe("ProductGrid — AC-STOREFRONT-041 (pure display layer, no pagination/sort/filter props)", () => {
  it("renders an empty list without throwing when there are no products", () => {
    expect(() => render(<ProductGrid products={[]} />)).not.toThrow();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
