// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { PaginatedProducts, ProductListItem } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-003 M3/M4 — the home route's data adapter and its static
 * scope boundary (REQ-STOREFRONT-031/032/034/036/037/038/039/040).
 *
 * Follows the `product-detail-page.test.tsx` / `cart-page.test.tsx` precedent:
 * a thin server-component adapter test (mocked service, dynamic behavior)
 * plus a static `firstRenderSources()` scope scan (M4).
 */

vi.mock("@/features/catalog/services/product-service", () => ({
  listProducts: vi.fn(),
}));

const { listProducts } = await import("@/features/catalog/services/product-service");
const { default: HomePage } = await import("@/app/page");

function page(items: ProductListItem[]): PaginatedProducts {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1 };
}

const PRODUCT_A: ProductListItem = {
  id: "p-1",
  name: "Classic Denim Jacket",
  price: 89000,
  images: ["https://picsum.photos/seed/a/600/600"],
  stock: 5,
  category: { id: "cat-internal-1", name: "아우터", slug: "outerwear" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(listProducts).mockReset();
});

describe("HomePage — AC-STOREFRONT-031", () => {
  it("calls listProducts with the default (empty) query", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([PRODUCT_A]) });

    render(await HomePage());

    expect(listProducts).toHaveBeenCalledTimes(1);
    const [calledWith] = vi.mocked(listProducts).mock.calls[0]!;
    expect(calledWith).toBeInstanceOf(URLSearchParams);
    expect(Array.from((calledWith as URLSearchParams).entries())).toHaveLength(0);
  });

  it("has the product already in the server-rendered output", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([PRODUCT_A]) });

    render(await HomePage());

    expect(screen.getByText("Classic Denim Jacket")).toBeDefined();
    expect(screen.getByText("89,000원")).toBeDefined();
  });
});

describe("HomePage — AC-STOREFRONT-032 static source scan", () => {
  it("imports listProducts directly and never calls the /api/products route", () => {
    const source = readFileSync("src/app/page.tsx", "utf8");

    expect(source).toMatch(/from ["']@\/features\/catalog\/services\/product-service["']/);
    expect(source).not.toMatch(/\/api\/products/);
  });
});

describe("HomePage — AC-STOREFRONT-034", () => {
  it("shows the empty-state message instead of a grid when there are no products", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });

    render(await HomePage());

    expect(screen.getByText(/아직 등록된 상품이 없습니다/)).toBeDefined();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the grid instead of the empty state for exactly one product", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([PRODUCT_A]) });

    render(await HomePage());

    expect(screen.queryByText(/아직 등록된 상품이 없습니다/)).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

/** The three first-render source files this SPEC touches (REQ-037/039). */
function firstRenderSources(): string[] {
  const files = [
    "src/app/page.tsx",
    "src/components/product/ProductGrid.tsx",
    "src/components/product/ProductCard.tsx",
  ];
  return files.map((f) => readFileSync(f, "utf8"));
}

describe("HomePage — AC-STOREFRONT-036 / 037 static scope (M4)", () => {
  it("declares no client boundary and performs no client-side data loading", () => {
    for (const source of firstRenderSources()) {
      expect(source).not.toMatch(/^\s*["']use client["']/m);
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\buseEffect\b/);
    }
  });

  it("contains no pagination, sort, filter, or search UI", () => {
    for (const source of firstRenderSources()) {
      expect(source).not.toMatch(/page=|pageSize=|sort=|category=|search=/);
      expect(source).not.toMatch(/newest|price_asc|price_desc/);
      expect(source).not.toMatch(/다음\s*페이지|이전\s*페이지|더\s*보기/);
    }
  });
});

describe("HomePage — AC-STOREFRONT-040 accessibility", () => {
  it("lets keyboard focus reach the first product card link", async () => {
    vi.mocked(listProducts).mockResolvedValue({
      ok: true,
      data: page([PRODUCT_A, { ...PRODUCT_A, id: "p-2", name: "Second Item" }]),
    });

    render(await HomePage());

    const links = screen.getAllByRole("link");
    links[0]!.focus();
    expect(document.activeElement).toBe(links[0]);
  });
});
