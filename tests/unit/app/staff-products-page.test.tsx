// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-ADMIN-002 M3 — `/staff/products` (REQ-ADMIN-021/022/023/037/040).
 *
 * Mirrors tests/unit/app/staff-orders-page.test.tsx: the Server Component is
 * awaited directly and its returned element rendered, with resolveAdminSession
 * and the repository mocked at their module seams.
 */

const adminSession = { resolveAdminSession: vi.fn() };
vi.mock("@/features/admin/services/admin-session", () => adminSession);

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (p: string) => redirect(p) }));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const repo = { listProductsForAdmin: vi.fn(), listCategoriesForAdmin: vi.fn() };
vi.mock("@/features/admin/repositories/admin-product-repository", () => repo);

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "p1",
    name: "린넨 셔츠",
    price: 39000,
    stock: 12,
    isActive: true,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    category: { id: "cat-tops", name: "상의", slug: "tops" },
    ...over,
  };
}

beforeEach(() => {
  adminSession.resolveAdminSession.mockReset().mockResolvedValue({ userId: "u1", role: "admin" });
  redirect.mockClear();
  repo.listProductsForAdmin.mockReset().mockResolvedValue({ rows: [], totalCount: 0 });
  repo.listCategoriesForAdmin.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

async function renderPage(sp: Record<string, string> = {}) {
  const { default: Page } = await import("@/app/staff/products/page");
  const element = await Page({ searchParams: Promise.resolve(sp) });
  return render(element);
}

describe("[AC-ADMIN-021b] the session gate runs before any product data is read", () => {
  it("redirects to /staff/login and fetches NOTHING when there is no admin session", async () => {
    adminSession.resolveAdminSession.mockResolvedValue(null);
    const { default: Page } = await import("@/app/staff/products/page");

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirect).toHaveBeenCalledWith("/staff/login");
    // The ordering matters: data must not be read and then discarded.
    expect(repo.listProductsForAdmin).not.toHaveBeenCalled();
  });

  it("[AC-ADMIN-037] reuses resolveAdminSession rather than reading the cookie itself", async () => {
    await renderPage();

    expect(adminSession.resolveAdminSession).toHaveBeenCalledTimes(1);
  });
});

describe("[AC-ADMIN-021a] the list shows suspended products, visibly marked", () => {
  it("renders name, price, stock and category for each row", async () => {
    repo.listProductsForAdmin.mockResolvedValue({ rows: [row()], totalCount: 1 });
    await renderPage();

    expect(screen.getByText("린넨 셔츠")).toBeDefined();
    expect(screen.getByText("39,000원")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("상의")).toBeDefined();
  });

  it("shows all three products — including the suspended one — and distinguishes it", async () => {
    repo.listProductsForAdmin.mockResolvedValue({
      rows: [
        row({ id: "p1", name: "판매중 A" }),
        row({ id: "p2", name: "판매중 B" }),
        row({ id: "p3", name: "중단된 C", isActive: false }),
      ],
      totalCount: 3,
    });
    await renderPage();

    expect(screen.getByText("판매중 A")).toBeDefined();
    expect(screen.getByText("판매중 B")).toBeDefined();
    expect(screen.getByText("중단된 C")).toBeDefined();
    // The suspended row carries a badge the sellable rows do not.
    expect(screen.getAllByText("판매 중")).toHaveLength(2);
    expect(screen.getAllByText("판매 중단")).toHaveLength(1);
  });

  it("links each row to its edit page", async () => {
    repo.listProductsForAdmin.mockResolvedValue({ rows: [row()], totalCount: 1 });
    const { container } = await renderPage();

    expect(container.querySelector('a[href="/staff/products/p1"]')).not.toBeNull();
  });

  it("offers a link to the create form", async () => {
    const { container } = await renderPage();

    expect(container.querySelector('a[href="/staff/products/new"]')).not.toBeNull();
  });
});

describe("[AC-ADMIN-022] category and search filters reach the repository", () => {
  it("passes a search term through", async () => {
    await renderPage({ search: "denim" });

    expect(repo.listProductsForAdmin.mock.calls[0]![0]).toMatchObject({ search: "denim" });
  });

  it("passes a category id through", async () => {
    await renderPage({ category: "cat-tops" });

    expect(repo.listProductsForAdmin.mock.calls[0]![0]).toMatchObject({ categoryId: "cat-tops" });
  });

  it("treats a blank or whitespace-only search as no filter at all", async () => {
    await renderPage({ search: "   " });

    expect(repo.listProductsForAdmin.mock.calls[0]![0].search).toBeUndefined();
  });
});

describe("[AC-ADMIN-023] pagination reuses SPEC-ADMIN-001's constants and clamp rules", () => {
  it("defaults to page 1, size 20 when the parameters are absent", async () => {
    await renderPage();

    expect(repo.listProductsForAdmin.mock.calls[0]![0]).toMatchObject({ page: 1, pageSize: 20 });
  });

  it.each(["0", "-3", "abc", "1.5", ""])(
    "corrects an invalid page=%p to the default rather than rejecting it",
    async (page) => {
      await renderPage({ page });

      expect(repo.listProductsForAdmin.mock.calls[0]![0].page).toBe(1);
    }
  );

  it("clamps pageSize down to MAX_PAGE_SIZE instead of rejecting it", async () => {
    await renderPage({ pageSize: "5000" });

    expect(repo.listProductsForAdmin.mock.calls[0]![0].pageSize).toBe(100);
  });

  it("honours a valid page and pageSize", async () => {
    await renderPage({ page: "3", pageSize: "50" });

    expect(repo.listProductsForAdmin.mock.calls[0]![0]).toMatchObject({ page: 3, pageSize: 50 });
  });
});

/**
 * CodeRabbit review, PR #18 — the 이전/다음 links spread a `filters` object that
 * carried only `category` and `search`, so `pageSize` was dropped from every
 * pagination hop. An admin browsing at `?pageSize=50` landed on a page rendered
 * at the default 20: the page boundaries stopped matching the page number that
 * produced them, and rows were skipped or repeated across the seam.
 */
function paginationLinks(container: HTMLElement) {
  const anchors = Array.from(container.querySelectorAll('nav[aria-label="페이지네이션"] a'));
  const href = (label: string) =>
    anchors.find((a) => a.textContent === label)?.getAttribute("href") ?? null;
  return { prev: href("이전"), next: href("다음") };
}

/** Order-independent: the assertion is about the parameters, not their spelling. */
function linkParams(href: string | null): URLSearchParams {
  expect(href).not.toBeNull();
  return new URL(href!, "http://localhost").searchParams;
}

describe("[CodeRabbit PR#18] pagination links carry the active pageSize", () => {
  it("keeps a non-default pageSize on both the previous and the next link", async () => {
    // 200 rows at 50 per page = 4 pages; sitting on page 2 renders both links.
    repo.listProductsForAdmin.mockResolvedValue({ rows: [row()], totalCount: 200 });
    const { container } = await renderPage({ page: "2", pageSize: "50" });

    const { prev, next } = paginationLinks(container);

    expect(linkParams(prev).get("pageSize")).toBe("50");
    expect(linkParams(prev).get("page")).toBe("1");
    expect(linkParams(next).get("pageSize")).toBe("50");
    expect(linkParams(next).get("page")).toBe("3");
  });

  it("keeps the pageSize alongside the category and search filters", async () => {
    repo.listProductsForAdmin.mockResolvedValue({ rows: [row()], totalCount: 200 });
    const { container } = await renderPage({
      page: "2",
      pageSize: "50",
      category: "cat-tops",
      search: "denim",
    });

    const next = linkParams(paginationLinks(container).next);

    expect(next.get("pageSize")).toBe("50");
    expect(next.get("category")).toBe("cat-tops");
    expect(next.get("search")).toBe("denim");
    expect(next.get("page")).toBe("3");
  });

  it("carries the CLAMPED pageSize, not the raw one, so the link matches the page shown", async () => {
    // 5000 is clamped to MAX_PAGE_SIZE=100 for the query; the link must agree
    // with what was rendered, or the next hop silently changes size.
    repo.listProductsForAdmin.mockResolvedValue({ rows: [row()], totalCount: 1000 });
    const { container } = await renderPage({ page: "2", pageSize: "5000" });

    expect(linkParams(paginationLinks(container).next).get("pageSize")).toBe("100");
  });

  it("omits pageSize when it is the default, matching how empty filters are omitted", async () => {
    // queryString() already drops undefined/empty values, so the default page
    // size stays out of the URL rather than appearing as noise.
    repo.listProductsForAdmin.mockResolvedValue({ rows: [row()], totalCount: 200 });
    const { container } = await renderPage({ page: "2" });

    const next = linkParams(paginationLinks(container).next);

    expect(next.has("pageSize")).toBe(false);
    expect(next.get("page")).toBe("3");
  });
});
