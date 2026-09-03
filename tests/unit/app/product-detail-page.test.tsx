// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { ProductDetail } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-001 M3 — the detail route's data adapter and its 404 path.
 *
 * The page is a thin adapter (plan.md §F): it unwraps `params`, calls the
 * catalog service, branches on failure, and hands the payload to a pure view.
 * These tests assert exactly that boundary — the rendering of the payload is
 * ProductDetailView's own test.
 *
 * SPEC-STOREFRONT-002 M4 note: `firstRenderSources()` below excludes
 * AddToCartButton.tsx from the no-fetch/no-useEffect scan. That control is a
 * separate client-component "island" (matching ProductGallery's existing
 * pattern) whose fetch() call is click-triggered, not render-triggered — the
 * same "first render vs later interaction" distinction
 * tests/unit/app/checkout-page.test.tsx already draws for CheckoutForm.tsx.
 * `storefrontSources()` (unfiltered) still backs every other assertion in
 * this file unchanged.
 */

// `notFound()` THROWS in the real App Router — that is how it aborts rendering
// and never returns. A bare vi.fn() would let the page keep executing past the
// guard and silently diverge from production behaviour, so the spy reproduces
// the throw (plan.md run-phase note).
const NEXT_NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error(NEXT_NOT_FOUND);
  }),
}));

vi.mock("@/features/catalog/services/product-service", () => ({
  getProductDetail: vi.fn(),
}));

const { notFound } = await import("next/navigation");
const { getProductDetail } = await import("@/features/catalog/services/product-service");
const { default: ProductDetailPage } = await import("@/app/products/[productId]/page");
const { default: ProductNotFound } = await import("@/app/products/[productId]/not-found");

const product: ProductDetail = {
  id: "p-1",
  name: "Classic Denim Jacket",
  price: 89000,
  description: "A hard-wearing denim jacket.",
  images: ["https://picsum.photos/seed/a/600/600"],
  stock: 5,
  category: { id: "cat-internal-1", name: "아우터", slug: "outerwear" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

/** Every .tsx source this SPEC adds under the detail route and product UI. */
function storefrontSources(): string[] {
  const roots = ["src/app/products", "src/components/product"];
  return roots.flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx"))
      .map((entry) => readFileSync(join(root, entry), "utf8"))
  );
}

/**
 * Only the FIRST-RENDER path. AddToCartButton.tsx (SPEC-STOREFRONT-002 M4)
 * is deliberately excluded — it is a client "island" whose fetch() call
 * fires from a click handler, not from render, the same distinction
 * checkout-page.test.tsx draws for CheckoutForm.tsx.
 */
function firstRenderSources(): string[] {
  const roots = ["src/app/products", "src/components/product"];
  return roots.flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx"))
      .filter((entry) => !entry.endsWith("AddToCartButton.tsx"))
      .map((entry) => readFileSync(join(root, entry), "utf8"))
  );
}

// Testing Library's auto-cleanup is not registered without vitest `globals`,
// so mounted trees are torn down explicitly between tests.
afterEach(cleanup);

beforeEach(() => {
  vi.mocked(notFound).mockClear();
  vi.mocked(getProductDetail).mockReset();
});

describe("ProductDetailPage — AC-STOREFRONT-003 / 005", () => {
  it("renders the product name from the server component output without calling notFound", async () => {
    vi.mocked(getProductDetail).mockResolvedValue({ ok: true, data: product });

    render(await ProductDetailPage({ params: Promise.resolve({ productId: "p-1" }) }));

    // The name is already present in the tree the server component assembled —
    // nothing waits on a client fetch (AC-003a).
    expect(screen.getByText("Classic Denim Jacket")).toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
    expect(getProductDetail).toHaveBeenCalledWith("p-1");
  });

  it("does not fetch product data from the browser on the initial render", () => {
    // AC-003(b): no client-side data loading anywhere in the FIRST-RENDER
    // detail UI. AddToCartButton's click-triggered fetch is excluded — see
    // the file-level note above.
    for (const source of firstRenderSources()) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\buseEffect\b/);
    }
  });

  it("keeps AddToCartButton's fetch confined to its own click handler", () => {
    const source = readFileSync("src/components/product/AddToCartButton.tsx", "utf8");

    expect(source).not.toMatch(/\buseEffect\b/);
    expect(source).toMatch(/\bfetch\s*\(/);
  });

  it("requires no authentication and never redirects", () => {
    // AC-005(b): no session lookup or redirect in the detail code path.
    for (const source of storefrontSources()) {
      expect(source).not.toMatch(/\bredirect\s*\(/);
      expect(source).not.toMatch(/getSession|requireAuth|verifyAccessToken/);
    }
    // AC-005(c): the route is not behind the middleware matcher. This file is
    // a PRESERVE item (acceptance.md §4) — the assertion guards it, and any
    // failure here means the invariant was violated, not that it needs editing.
    expect(readFileSync("src/middleware.ts", "utf8")).not.toContain("/products");
  });
});

describe("ProductDetailPage — AC-STOREFRONT-004", () => {
  it("enters the notFound path for an unknown product id", async () => {
    vi.mocked(getProductDetail).mockResolvedValue({
      ok: false,
      status: 404,
      error: "Product not found",
    });

    await expect(
      ProductDetailPage({ params: Promise.resolve({ productId: "no-such-product" }) })
    ).rejects.toThrow(NEXT_NOT_FOUND);

    expect(notFound).toHaveBeenCalled();
  });

  it("shows a plain-language 404 screen that leaks no internal error text", () => {
    const { container } = render(<ProductNotFound />);

    expect(screen.getByText(/상품을 찾을 수 없/)).toBeDefined();
    // AC-004(c): the service's internal message never reaches the screen.
    expect(container.textContent).not.toContain("Product not found");
    expect(container.textContent).not.toMatch(/prisma|stack|SQL/i);
  });
});
