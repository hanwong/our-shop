// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * SPEC-AUTH-004 M4 — new regression guards for the `(shop)` route-group
 * boundary (plan.md §F M4, acceptance.md §0). Kept in this file rather than
 * a new one: AC-AUTH-054 seals the test-file change set at exactly 12
 * ("No other test file is touched"), and shell.test.tsx is already one of
 * the 12 — it already houses the sibling RootLayout/ShopLayout structural
 * checks these three tests complete the composition proof with.
 *
 * Why these are static structural checks rather than rendered-output
 * checks: acceptance.md §0 explains that rendering a staff PAGE component
 * directly proves nothing — the layout never gets a chance to run in that
 * harness, so the header's absence would be true even with the
 * SPEC-AUTH-004 defect still present (zero discriminating power). The
 * structural composition proof instead pins three independent facts that
 * together entail "staff never meets SiteHeader":
 *
 *   1. staff routes sit outside the `(shop)` group and have no layout of
 *      their own (AC-AUTH-048, below).
 *   2. the root layout — the only layout staff DOES inherit — renders no
 *      SiteHeader, by Pattern B element-tree check (AC-AUTH-049 Pattern B
 *      half, the "does not render SiteHeader..." test above) and by static
 *      source scan (AC-AUTH-049 static half, below).
 *   3. `(shop)/layout.tsx` is the ONLY layout under src/app that renders
 *      SiteHeader (AC-AUTH-051, below) — so even if a future layout is
 *      added between the root and a customer route, this test fails the
 *      moment a second SiteHeader-rendering layout appears.
 *
 * AC-AUTH-050 (the "(shop) layout renders SiteHeader exactly once, above
 * children" Pattern B check) is not repeated here — the ShopLayout describe
 * block above already implements its exact Given-When-Then.
 */

describe("(shop) route-group boundary — AC-AUTH-048", () => {
  it("keeps staff pages under src/app/staff/, outside (shop), with no staff layout.tsx", () => {
    const staffFiles = readdirSync("src/app/staff", { recursive: true, encoding: "utf8" }).map(
      (entry) => join("src/app/staff", entry)
    );

    // At least the two staff pages acceptance.md names must still exist.
    expect(existsSync("src/app/staff/products/page.tsx")).toBe(true);
    expect(existsSync("src/app/staff/orders/page.tsx")).toBe(true);

    // None of the staff route files live under the (shop) group.
    for (const file of staffFiles) {
      expect(file.startsWith("src/app/(shop)/")).toBe(false);
    }

    // staff owns no layout.tsx of its own — it inherits only the root layout.
    const staffLayouts = staffFiles.filter((file) => file.endsWith("layout.tsx"));
    expect(staffLayouts).toHaveLength(0);
  });
});

describe("(shop) route-group boundary — AC-AUTH-049 (static scan half)", () => {
  it("contains zero SiteHeader references in src/app/layout.tsx, not even an import", () => {
    const source = readFileSync("src/app/layout.tsx", "utf8");
    const matches = source.match(/SiteHeader/g) ?? [];

    expect(matches).toHaveLength(0);
  });
});

describe("(shop) route-group boundary — AC-AUTH-051", () => {
  it("has exactly one layout.tsx under src/app that renders SiteHeader — (shop)/layout.tsx", () => {
    const allLayouts = readdirSync("src/app", { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith("layout.tsx"))
      .map((entry) => join("src/app", entry));

    const layoutsRenderingSiteHeader = allLayouts.filter((file) =>
      readFileSync(file, "utf8").includes("SiteHeader")
    );

    expect(layoutsRenderingSiteHeader).toEqual(["src/app/(shop)/layout.tsx"]);
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
