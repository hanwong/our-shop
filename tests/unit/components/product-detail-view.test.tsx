// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { ProductDetail } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-001 M3 — the pure presentation of a ProductDetail.
 *
 * Split out of the page precisely so it can be tested as a plain
 * props-in/JSX-out component (plan.md §F / §K R2).
 *
 * SPEC-STOREFRONT-002 M4 adds the "AC-STOREFRONT-024..027 assembly" block
 * below: AddToCartButton is now embedded here (design.md §5's precise
 * insertion point — after the stock paragraph, before the description),
 * NOT at the page.tsx level. This still leaves ProductDetailView a plain
 * component testable with props alone.
 */

// next/image is replaced with a plain <img>. Assertions stay at the role/alt
// level so they do not couple to the optimizer's markup (plan.md §K R6), and
// the component tree stops depending on next.config's host allow-list.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} className={className} />
  ),
}));

const { ProductDetailView } = await import("@/components/product/ProductDetailView");

// The suite does not enable vitest `globals`, so Testing Library never
// registers its own afterEach cleanup and mounted trees would otherwise
// accumulate in document.body across tests — turning a correct single-price
// render into a "found multiple elements" failure.
afterEach(cleanup);

const IMG_A = "https://picsum.photos/seed/a/600/600";

function makeProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "p-1",
    name: "Classic Denim Jacket",
    price: 89000,
    description: "A hard-wearing denim jacket cut from 14oz selvedge.",
    images: [IMG_A],
    stock: 5,
    category: { id: "cat-internal-1", name: "아우터", slug: "outerwear" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProductDetailView — AC-STOREFRONT-006 / 007", () => {
  it("shows the name, price, full description, category and stock state", () => {
    const product = makeProduct();
    render(<ProductDetailView product={product} />);

    expect(screen.getByText(product.name)).toBeDefined();
    // The description is shown in full, never truncated.
    expect(screen.getByText(product.description)).toBeDefined();
    expect(screen.getByText("아우터")).toBeDefined();
    expect(screen.getByText(/재고/)).toBeDefined();
  });

  it("formats the price as a thousands-separated won amount", () => {
    render(<ProductDetailView product={makeProduct({ price: 89000 })} />);

    expect(screen.getByText("89,000원")).toBeDefined();
  });

  it("formats a zero price as 0원 rather than a blank or negative amount", () => {
    render(<ProductDetailView product={makeProduct({ price: 0 })} />);

    expect(screen.getByText("0원")).toBeDefined();
  });
});

describe("ProductDetailView — AC-STOREFRONT-008", () => {
  it("states the sold-out condition only while stock is zero", () => {
    const { container: soldOut } = render(<ProductDetailView product={makeProduct({ stock: 0 })} />);
    expect(soldOut.textContent).toContain("품절");

    const { container: inStock } = render(<ProductDetailView product={makeProduct({ stock: 10 })} />);
    expect(inStock.textContent).not.toContain("품절");
  });
});

describe("ProductDetailView — AC-STOREFRONT-009", () => {
  it("leaks no internal identifiers, timestamps, or out-of-scope sections", () => {
    const product = makeProduct();
    const { container } = render(<ProductDetailView product={product} />);
    const text = container.textContent ?? "";

    expect(text).not.toContain(product.category.id);
    expect(text).not.toContain(product.createdAt);
    expect(text).not.toContain(product.updatedAt);
    // Related products and stock history remain out of scope (spec.md §3) and
    // are not merely unpopulated — they are absent. The "리뷰" (reviews) token
    // is deliberately DROPPED from this assertion — SPEC-REVIEW-001's
    // REQ-REVIEW-007/008/009 intentionally supersede REQ-STOREFRONT-009 for the
    // review section specifically (spec.md §1); this is not a regression.
    expect(text).not.toMatch(/관련 상품|재고 변동/);
  });
});

describe("ProductDetailView — SPEC-STOREFRONT-002 M4 assembly (AC-STOREFRONT-024)", () => {
  it("embeds the add-to-cart control, passing this product's id and current stock", () => {
    render(<ProductDetailView product={makeProduct({ id: "p-42", stock: 7 })} />);

    const input = screen.getByLabelText("수량") as HTMLInputElement;
    expect(input.value).toBe("1");
    expect(screen.getByRole("button", { name: /장바구니에 담기/ })).not.toHaveProperty(
      "disabled",
      true
    );
  });

  it("disables the add-to-cart button when this product is sold out", () => {
    render(<ProductDetailView product={makeProduct({ stock: 0 })} />);

    expect(screen.getByRole("button", { name: /장바구니에 담기/ })).toHaveProperty("disabled", true);
  });
});
