// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import RootLayout, { metadata } from "@/app/layout";
import ShopLayout from "@/app/(shop)/layout";
import HomePage from "@/app/(shop)/page";
import SiteHeader from "@/components/layout/SiteHeader";
import { listProducts } from "@/features/catalog/services/product-service";
import type { PaginatedProducts, ProductListItem } from "@/features/catalog/types/product";

// SPEC-STOREFRONT-003 M3 — HomePage now calls listProducts, so the
// "HomePage stub" describe block below mocks the service. This does not
// affect the sibling RootLayout describe block, which renders neither
// component through the service layer.
vi.mock("@/features/catalog/services/product-service", () => ({
  listProducts: vi.fn(),
}));

afterEach(cleanup);

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

  it("does not render SiteHeader inside the root layout body — AC-AUTH-049 (plan.md §B.7 pattern B)", () => {
    // SPEC-AUTH-004 M3 — this assertion replaces the removed AC-AUTH-040
    // check, which asserted SiteHeader WAS the first child of the root
    // layout's body. SPEC-AUTH-004 moved the header out of this file
    // entirely into `src/app/(shop)/layout.tsx` — the sibling ShopLayout
    // describe block below now owns the "renders it" half of this pair
    // (AC-AUTH-050). Call-only, no mount (same reasoning the removed test
    // used): mounting RootLayout would trigger the <html>/<body> nesting
    // warning the earlier test in this block avoids.
    const MARKER = null;
    const tree = RootLayout({ children: MARKER }) as ReactElement<{
      lang?: string;
      children?: ReactElement<{ children?: unknown }>;
    }>;

    const body = tree.props.children;
    expect(body?.type).toBe("body");
    const bodyChildren = body?.props.children;

    if (Array.isArray(bodyChildren)) {
      expect(
        bodyChildren.some((child) => (child as ReactElement | null)?.type === SiteHeader)
      ).toBe(false);
    } else {
      expect(bodyChildren).toBe(MARKER);
    }
  });
});

describe("ShopLayout — AC-AUTH-050", () => {
  it("places SiteHeader above children in its returned element tree", () => {
    // Same call-only technique as the RootLayout tests above (plan.md §B.7
    // pattern B) — SiteHeader is an async server component nested inside
    // this synchronous layout, so it cannot be reached via
    // render(await Component()) (pattern A).
    const MARKER = null;
    const tree = ShopLayout({ children: MARKER }) as ReactElement<{
      children?: unknown[];
    }>;

    const children = tree.props.children;
    expect(Array.isArray(children)).toBe(true);
    const [first, second] = children as [ReactElement, unknown];
    expect(first.type).toBe(SiteHeader);
    expect(second).toBe(MARKER);
  });
});

describe("HomePage stub — §4 minimal exception", () => {
  // SPEC-STOREFRONT-003 M3 replaces the SPEC-STOREFRONT-001 §4 static-link
  // stub with the real product grid (REQ-STOREFRONT-031/032/036). The
  // describe block name is kept for the sibling RootLayout PRESERVE
  // boundary (plan.md §I R2) even though its content now verifies grid
  // behavior rather than the old stub link.

  const PRODUCT: ProductListItem = {
    id: "p-1",
    name: "Classic Denim Jacket",
    price: 89000,
    images: ["https://picsum.photos/seed/a/600/600"],
    stock: 5,
    category: { id: "cat-internal-1", name: "아우터", slug: "outerwear" },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  function page(items: ProductListItem[]): PaginatedProducts {
    return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1 };
  }

  beforeEach(() => {
    vi.mocked(listProducts).mockReset();
  });

  it("renders a link into the product detail route for each product", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([PRODUCT]) });

    render(await HomePage());
    const link = screen.getByRole("link");

    expect(link.getAttribute("href")).toBe("/products/p-1");
  });

  it("shows the empty-state guidance when there are no products", async () => {
    vi.mocked(listProducts).mockResolvedValue({ ok: true, data: page([]) });

    render(await HomePage());

    expect(screen.getByText(/아직 등록된 상품이 없습니다/)).toBeDefined();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
