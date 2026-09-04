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
 *
 * SPEC-REVIEW-001 M5 note: `firstRenderSources()` now ALSO excludes
 * ReviewForm.tsx for the identical reason as AddToCartButton.tsx — its
 * fetch() fires from a submit handler, never from render. `resolveSession()`
 * and `getProductReviewSummary()` are mocked here the same way
 * `getProductDetail()` already is, per plan.md M5 (login/anon branching,
 * average/count display, and the source scan below, AC-REVIEW-007/008/009/
 * 010/011/013).
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
  // ReviewForm.tsx (rendered inside ProductDetailView for a logged-in
  // visitor) calls useRouter() at render time — a no-op refresh is enough
  // since no test here exercises ReviewForm's submit path.
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock("@/features/catalog/services/product-service", () => ({
  getProductDetail: vi.fn(),
}));

// `page.tsx` awaits `cookies()` before handing the jar to `resolveSession()` —
// the mock's return value only needs to be duck-type compatible (§File
// header), so a bare empty object is enough; `resolveSession` itself is
// mocked separately below and never reads it.
vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({}) }));

vi.mock("@/lib/auth/session-resolver", () => ({ resolveSession: vi.fn() }));

vi.mock("@/features/reviews/services/review-service", () => ({
  getProductReviewSummary: vi.fn(),
}));

const { notFound } = await import("next/navigation");
const { getProductDetail } = await import("@/features/catalog/services/product-service");
const { resolveSession } = await import("@/lib/auth/session-resolver");
const { getProductReviewSummary } = await import("@/features/reviews/services/review-service");
const { default: ProductDetailPage } = await import("@/app/products/[productId]/page");
const { default: ProductNotFound } = await import("@/app/products/[productId]/not-found");

const EMPTY_REVIEW_SUMMARY = { aggregate: { averageRating: null, count: 0 }, reviews: [] };

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
 * and ReviewForm.tsx (SPEC-REVIEW-001 M4) are deliberately excluded — both
 * are client "islands" whose fetch() call fires from an event handler, not
 * from render, the same distinction checkout-page.test.tsx draws for
 * CheckoutForm.tsx.
 */
function firstRenderSources(): string[] {
  const roots = ["src/app/products", "src/components/product"];
  const excluded = ["AddToCartButton.tsx", "ReviewForm.tsx"];
  return roots.flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx"))
      .filter((entry) => !excluded.some((name) => entry.endsWith(name)))
      .map((entry) => readFileSync(join(root, entry), "utf8"))
  );
}

// Testing Library's auto-cleanup is not registered without vitest `globals`,
// so mounted trees are torn down explicitly between tests.
afterEach(cleanup);

beforeEach(() => {
  vi.mocked(notFound).mockClear();
  vi.mocked(getProductDetail).mockReset();
  vi.mocked(resolveSession).mockReset().mockResolvedValue(null);
  vi.mocked(getProductReviewSummary).mockReset().mockResolvedValue(EMPTY_REVIEW_SUMMARY);
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
    // AC-005(b): the page never redirects or gates on being logged in. Since
    // SPEC-REVIEW-001, `page.tsx` DOES read `resolveSession()` — but only to
    // steer the review section's write-vs-login-prompt branch (REQ-REVIEW-008),
    // never to redirect or to require it, so this stays a redirect/gate scan
    // rather than a "no session lookup at all" scan.
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

describe("ProductDetailPage — AC-REVIEW-007 / 008", () => {
  it("shows the rounded average rating and the review count", async () => {
    vi.mocked(getProductDetail).mockResolvedValue({ ok: true, data: product });
    vi.mocked(getProductReviewSummary).mockResolvedValue({
      aggregate: { averageRating: 4, count: 3 },
      reviews: [],
    });

    render(await ProductDetailPage({ params: Promise.resolve({ productId: "p-1" }) }));

    expect(screen.getByText(/평균 평점 4\.0/)).toBeDefined();
    expect(screen.getByText(/리뷰 3개/)).toBeDefined();
  });

  it("shows no average figure and an explicit zero count for a product with no reviews yet", async () => {
    vi.mocked(getProductDetail).mockResolvedValue({ ok: true, data: product });
    // The beforeEach default (EMPTY_REVIEW_SUMMARY) already covers this case;
    // restated explicitly here so the AC has its own named test.
    vi.mocked(getProductReviewSummary).mockResolvedValue(EMPTY_REVIEW_SUMMARY);

    render(await ProductDetailPage({ params: Promise.resolve({ productId: "p-1" }) }));

    expect(screen.queryByText(/평균 평점/)).toBeNull();
    expect(screen.getByText(/리뷰 0개/)).toBeDefined();
  });
});

describe("ProductDetailPage — AC-REVIEW-009 / 010", () => {
  it("shows a login-prompt link to /login instead of the write form for an anonymous visitor", async () => {
    vi.mocked(getProductDetail).mockResolvedValue({ ok: true, data: product });
    vi.mocked(resolveSession).mockResolvedValue(null);

    render(await ProductDetailPage({ params: Promise.resolve({ productId: "p-1" }) }));

    const link = screen.getByRole("link", { name: "로그인하고 리뷰 남기기" });
    expect(link.getAttribute("href")).toBe("/login");
    expect(screen.queryByLabelText("리뷰 내용")).toBeNull();
  });

  it("shows the ReviewForm write control instead of the login prompt for a logged-in visitor", async () => {
    vi.mocked(getProductDetail).mockResolvedValue({ ok: true, data: product });
    vi.mocked(resolveSession).mockResolvedValue({ userId: "user-1", role: "customer" });

    render(await ProductDetailPage({ params: Promise.resolve({ productId: "p-1" }) }));

    expect(screen.getByLabelText("리뷰 내용")).toBeDefined();
    expect(screen.queryByText("로그인하고 리뷰 남기기")).toBeNull();
  });
});

describe("ProductDetailPage — AC-REVIEW-011", () => {
  it("renders the review list in the order the service already returned (newest first)", async () => {
    vi.mocked(getProductDetail).mockResolvedValue({ ok: true, data: product });
    vi.mocked(getProductReviewSummary).mockResolvedValue({
      aggregate: { averageRating: 4.5, count: 2 },
      reviews: [
        { id: "r-newest", userId: "u1", productId: "p-1", rating: 5, body: "최신 리뷰", createdAt: "2026-09-02T00:00:00.000Z" },
        { id: "r-older", userId: "u2", productId: "p-1", rating: 4, body: "이전 리뷰", createdAt: "2026-09-01T00:00:00.000Z" },
      ],
    });

    render(await ProductDetailPage({ params: Promise.resolve({ productId: "p-1" }) }));

    const bodies = screen.getAllByText(/리뷰$/).map((node) => node.textContent);
    expect(bodies.indexOf("최신 리뷰")).toBeLessThan(bodies.indexOf("이전 리뷰"));
  });
});

describe("ProductDetailPage — AC-REVIEW-013 (server-rendering source scan)", () => {
  it("keeps ReviewForm's fetch confined to its own submit handler", () => {
    const source = readFileSync("src/components/product/ReviewForm.tsx", "utf8");

    expect(source).not.toMatch(/\buseEffect\b/);
    expect(source).toMatch(/\bfetch\s*\(/);
  });
});
