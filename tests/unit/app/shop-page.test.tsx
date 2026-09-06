// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { PaginatedProducts, ProductListItem } from "@/features/catalog/types/product";

/**
 * SPEC-BRAND-001 M5 — `/shop` (REQ-BRAND-014/015/016, AC-BRAND-014/015/016).
 *
 * Follows the home-page.test.tsx precedent: a mocked-service adapter test.
 * `findAllCategories` is mocked with an ARBITRARY category set (not the real
 * derby/loafer/boots/monk seed) — this is what proves the filter button list
 * is genuinely derived from the repository call rather than hardcoded
 * (AC-BRAND-016): if the page's own source listed a fixed category array,
 * these tests would see that fixed array instead of the mocked one.
 */

vi.mock("@/features/catalog/services/product-service", () => ({ listProducts: vi.fn() }));
vi.mock("@/features/catalog/repositories/category-repository", () => ({
  findAllCategories: vi.fn(),
}));

const { listProducts } = await import("@/features/catalog/services/product-service");
const { findAllCategories } = await import("@/features/catalog/repositories/category-repository");
const { default: ShopPage } = await import("@/app/(shop)/shop/page");

function page(items: ProductListItem[]): PaginatedProducts {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1 };
}

const PRODUCT_A: ProductListItem = {
  id: "p-1",
  name: "더비 슈즈 A",
  price: 198000,
  images: ["https://picsum.photos/seed/a/800/800"],
  stock: 5,
  category: { id: "cat-1", name: "더비", slug: "derby" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const ARBITRARY_CATEGORIES = [
  { id: "cat-x", name: "가나다", slug: "ganada" },
  { id: "cat-y", name: "라마바", slug: "ramaba" },
];

function searchParams(query: Record<string, string> = {}): Promise<{ category?: string; sort?: string }> {
  return Promise.resolve(query);
}

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(listProducts).mockReset();
  vi.mocked(findAllCategories).mockReset();
});

describe("ShopPage — AC-BRAND-014", () => {
  it("renders the product grid plus category-filter and sort controls", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([PRODUCT_A]) });
    vi.mocked(findAllCategories).mockResolvedValue(ARBITRARY_CATEGORIES);

    render(await ShopPage({ searchParams: searchParams() }));

    expect(screen.getByText(PRODUCT_A.name)).toBeDefined();
    expect(screen.getByRole("group", { name: "카테고리 필터" })).toBeDefined();
    expect(screen.getByRole("group", { name: "정렬" })).toBeDefined();
  });
});

describe("ShopPage — AC-BRAND-016 (filter list is derived, never hardcoded)", () => {
  it("renders exactly the categories findAllCategories returns, plus '전체'", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });
    vi.mocked(findAllCategories).mockResolvedValue(ARBITRARY_CATEGORIES);

    render(await ShopPage({ searchParams: searchParams() }));

    const filterGroup = screen.getByRole("group", { name: "카테고리 필터" });
    const labels = Array.from(filterGroup.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual(["전체", "가나다", "라마바"]);
  });

  it("reflects an added category with zero code change (a 3rd mocked category appears)", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });
    vi.mocked(findAllCategories).mockResolvedValue([
      ...ARBITRARY_CATEGORIES,
      { id: "cat-z", name: "사아자", slug: "saaja" },
    ]);

    render(await ShopPage({ searchParams: searchParams() }));

    expect(screen.getByRole("link", { name: "사아자" })).toBeDefined();
  });

  it("reflects a removed category with zero code change", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });
    vi.mocked(findAllCategories).mockResolvedValue([ARBITRARY_CATEGORIES[0]!]);

    render(await ShopPage({ searchParams: searchParams() }));

    expect(screen.queryByRole("link", { name: "라마바" })).toBeNull();
  });
});

describe("ShopPage — AC-BRAND-015 (category filter narrows the set)", () => {
  it("passes the resolved ?category= slug straight through to listProducts", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([PRODUCT_A]) });
    vi.mocked(findAllCategories).mockResolvedValue(ARBITRARY_CATEGORIES);

    render(await ShopPage({ searchParams: searchParams({ category: "ganada" }) }));

    const [calledWith] = vi.mocked(listProducts).mock.calls[0]!;
    expect((calledWith as URLSearchParams).get("category")).toBe("ganada");
  });

  it("marks the selected category link, not the others", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });
    vi.mocked(findAllCategories).mockResolvedValue(ARBITRARY_CATEGORIES);

    render(await ShopPage({ searchParams: searchParams({ category: "ganada" }) }));

    const selected = screen.getByRole("link", { name: "가나다" });
    const unselected = screen.getByRole("link", { name: "라마바" });
    expect(selected.className).toContain("bg-accent");
    expect(unselected.className).not.toContain("bg-accent");
  });
});

describe("ShopPage — sort control", () => {
  it("passes ?sort= straight through to listProducts", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });
    vi.mocked(findAllCategories).mockResolvedValue([]);

    render(await ShopPage({ searchParams: searchParams({ sort: "price_asc" }) }));

    const [calledWith] = vi.mocked(listProducts).mock.calls[0]!;
    expect((calledWith as URLSearchParams).get("sort")).toBe("price_asc");
  });
});

describe("ShopPage — REQ-BRAND-016 (no new product query path)", () => {
  it("calls the existing listProducts service, never a new fetch/API route", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });
    vi.mocked(findAllCategories).mockResolvedValue([]);

    render(await ShopPage({ searchParams: searchParams() }));

    expect(listProducts).toHaveBeenCalledTimes(1);
  });
});

describe("ShopPage — graceful handling of an invalid ?sort=", () => {
  it("shows the empty state instead of throwing when listProducts rejects the query", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: false, status: 400, error: "Invalid 'sort'" });
    vi.mocked(findAllCategories).mockResolvedValue(ARBITRARY_CATEGORIES);

    render(await ShopPage({ searchParams: searchParams({ sort: "bogus" }) }));

    expect(screen.getByText(/해당 조건의 상품이 없습니다/)).toBeDefined();
  });
});
