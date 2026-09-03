// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-ADMIN-002 M6 — accessibility sweep across this SPEC's three product
 * screens (plan.md §5 M6: label association, role="alert" errors, keyboard
 * operability).
 *
 * Same shape and rationale as SPEC-ADMIN-001's accessibility.test.tsx: one
 * cross-screen file, so the sweep's scope is visible in one place rather than
 * scattered across the per-screen suites that already carry their own
 * REQ/AC-scoped assertions.
 */

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const adminSession = { resolveAdminSession: vi.fn() };
vi.mock("@/features/admin/services/admin-session", () => adminSession);

const repo = {
  listProductsForAdmin: vi.fn(),
  findProductByIdForAdmin: vi.fn(),
  listCategoriesForAdmin: vi.fn(),
};
vi.mock("@/features/admin/repositories/admin-product-repository", () => repo);

const { default: StaffProductsPage } = await import("@/app/staff/products/page");
const { default: NewProductPage } = await import("@/app/staff/products/new/page");
const { ProductForm } = await import("@/app/staff/products/ProductForm");

const CATEGORIES = [{ id: "cat-tops", name: "상의", slug: "tops" }];

const PRODUCT = {
  id: "p1",
  name: "린넨 셔츠",
  description: "설명",
  price: 39000,
  stock: 12,
  images: ["https://cdn.example.com/a.jpg"],
  categoryId: "cat-tops",
  isActive: true,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  adminSession.resolveAdminSession.mockReset().mockResolvedValue({ userId: "u1", role: "admin" });
  repo.listProductsForAdmin.mockReset().mockResolvedValue({
    rows: [
      {
        id: "p1",
        name: "린넨 셔츠",
        price: 39000,
        stock: 12,
        isActive: true,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        category: { id: "cat-tops", name: "상의", slug: "tops" },
      },
    ],
    totalCount: 1,
  });
  repo.findProductByIdForAdmin.mockReset().mockResolvedValue(PRODUCT);
  repo.listCategoriesForAdmin.mockReset().mockResolvedValue(CATEGORIES);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "csrf_token=tok123";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the product list is navigable and its table is readable by structure", () => {
  it("gives every column header a scope, so a screen reader can associate cells", async () => {
    render(await StaffProductsPage({ searchParams: Promise.resolve({}) }));

    const headers = screen.getAllByRole("columnheader");
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      expect(header.getAttribute("scope")).toBe("col");
    }
  });

  it("names its landmarks, so the filter and pagination regions are distinguishable", async () => {
    render(await StaffProductsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByLabelText("페이지네이션")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });

  it("labels the filter controls rather than relying on placeholder text", async () => {
    render(await StaffProductsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByLabelText("상품명 검색")).toBeDefined();
    expect(screen.getByLabelText("카테고리")).toBeDefined();
  });
});

describe("every form control is reachable by its label", () => {
  it.each([
    ["상품명", "textbox"],
    ["가격 (원)", "spinbutton"],
    ["재고", "spinbutton"],
    ["설명", "textbox"],
    ["카테고리", "combobox"],
  ])("%s resolves to its control", (label) => {
    render(<ProductForm mode="create" categories={CATEGORIES} />);

    expect(screen.getByLabelText(label)).toBeDefined();
  });

  it("labels each image row individually, so row 2 is distinguishable from row 1", () => {
    render(<ProductForm mode="edit" categories={CATEGORIES} product={PRODUCT} />);

    fireEvent.click(screen.getByRole("button", { name: "이미지 추가" }));

    expect(screen.getByLabelText("이미지 URL 1")).toBeDefined();
    expect(screen.getByLabelText("이미지 URL 2")).toBeDefined();
  });

  it("groups the image inputs under a legend", () => {
    const { container } = render(<ProductForm mode="create" categories={CATEGORIES} />);

    expect(container.querySelector("fieldset > legend")?.textContent).toContain("이미지");
  });
});

describe("validation errors announce themselves and point at their field", () => {
  it("renders each server field error with role=alert", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ errors: { name: "이름 오류", price: "가격 오류" } }),
    });
    render(<ProductForm mode="create" categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  });

  it("links the message to its input via aria-describedby", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ errors: { name: "이름 오류" } }),
    });
    render(<ProductForm mode="create" categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());

    const input = screen.getByLabelText("상품명");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toContain("name-error");
  });

  it("keeps the stock hint associated even when stock has no error", () => {
    render(<ProductForm mode="create" categories={CATEGORIES} />);

    const stock = screen.getByLabelText("재고");
    expect(stock.getAttribute("aria-describedby")).toContain("stock-hint");
  });
});

describe("every action is a real button, operable from the keyboard", () => {
  it.each(["저장", "이미지 추가"])("%s is a button element", (name) => {
    render(<ProductForm mode="create" categories={CATEGORIES} />);

    expect(screen.getByRole("button", { name }).tagName).toBe("BUTTON");
  });

  it("the suspend action is a button, not a div with a click handler", () => {
    render(<ProductForm mode="edit" categories={CATEGORIES} product={PRODUCT} />);

    const button = screen.getByRole("button", { name: "판매 중단" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("disables the submit button while a request is in flight, so it cannot double-fire", async () => {
    let release: (v: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((r) => (release = r)));
    render(<ProductForm mode="create" categories={CATEGORIES} />);

    const submit = screen.getByRole("button", { name: "저장" });
    fireEvent.click(submit);

    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(true));
    release({ ok: true, status: 201, json: async () => ({}) });
  });

  it("the buttons inside the form do not submit it accidentally", () => {
    render(<ProductForm mode="create" categories={CATEGORIES} />);

    // type="button" is what stops "이미지 추가" from submitting the form.
    expect(screen.getByRole("button", { name: "이미지 추가" }).getAttribute("type")).toBe("button");
  });
});

describe("the create screen degrades honestly when it cannot work", () => {
  it("explains the problem via an alert instead of rendering an empty select", async () => {
    repo.listCategoriesForAdmin.mockResolvedValue([]);

    render(await NewProductPage());

    // This SPEC deliberately builds no category management (spec.md §3), so
    // "no categories" is a real reachable state that must not present as a
    // broken form.
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("button", { name: "저장" })).toBeNull();
  });
});
