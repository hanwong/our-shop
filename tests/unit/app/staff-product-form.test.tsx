// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * SPEC-ADMIN-002 M4/M5 — ProductForm and the suspend/restore control
 * (REQ-ADMIN-024/025/027/029/030/031/032, AC-ADMIN-027/029/030/031).
 *
 * Mirrors tests/unit/components/*.test.tsx: a Client Component rendered with
 * Testing Library, `fetch` stubbed, `useRouter` mocked. The form is the single
 * component both the create and the edit page render (design.md §5) — the one
 * deliberate departure from SPEC-ADMIN-001's self-contained page style, taken
 * because a create form and an edit form that drift apart start validating the
 * same product differently.
 */

const routerRefresh = vi.fn();
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: routerPush }),
}));

const CATEGORIES = [
  { id: "cat-tops", name: "상의", slug: "tops" },
  { id: "cat-bottoms", name: "하의", slug: "bottoms" },
];

const EXISTING = {
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
  routerRefresh.mockClear();
  routerPush.mockClear();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "csrf_token=tok123";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderForm(props: Record<string, unknown> = {}) {
  const { ProductForm } = await import("@/app/staff/products/ProductForm");
  return render(
    <ProductForm mode="create" categories={CATEGORIES} {...(props as Record<string, never>)} />
  );
}

function body(call: number = 0) {
  return JSON.parse(fetchMock.mock.calls[call]![1].body as string);
}

describe("[AC-ADMIN-029] the category input offers only existing categories", () => {
  it("renders a select listing every category, with no free-text entry", async () => {
    await renderForm();

    const select = screen.getByLabelText("카테고리") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(
      expect.arrayContaining(["cat-tops", "cat-bottoms"])
    );
  });
});

describe("the form carries every editable field, each labelled", () => {
  it.each(["상품명", "카테고리", "가격", "재고", "설명"])("labels %s to its input", async (label) => {
    await renderForm();

    expect(screen.getByLabelText(new RegExp(label))).toBeDefined();
  });

  it("warns that saving overwrites stock, per the accepted concurrency risk", async () => {
    await renderForm();

    // spec.md §4: an admin edit saves an ABSOLUTE stock value while an order
    // cancellation restores stock with a relative increment. The SPEC accepts
    // that race and mitigates it with this notice alone (design.md §6).
    expect(screen.getByText(/덮어씁니다/)).toBeDefined();
  });
});

describe("[AC-ADMIN-024] create mode submits to POST /staff/api/products", () => {
  it("posts the entered values with the CSRF header", async () => {
    await renderForm();

    fireEvent.change(screen.getByLabelText(/상품명/), { target: { value: "새 상품" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "새 설명" } });
    fireEvent.change(screen.getByLabelText(/가격/), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/재고/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/staff/api/products");
    expect(init.method).toBe("POST");
    expect(init.headers["X-CSRF-Token"]).toBe("tok123");
    expect(body()).toMatchObject({
      name: "새 상품",
      description: "새 설명",
      price: 1000,
      stock: 5,
      categoryId: "cat-tops",
    });
  });

  it("sends price and stock as numbers, not the raw input strings", async () => {
    await renderForm();

    fireEvent.change(screen.getByLabelText(/상품명/), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "y" } });
    fireEvent.change(screen.getByLabelText(/가격/), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/재고/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(typeof body().price).toBe("number");
    expect(typeof body().stock).toBe("number");
  });

  it("navigates to the list on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "p_new" }) });
    await renderForm();

    fireEvent.change(screen.getByLabelText(/상품명/), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "y" } });
    fireEvent.change(screen.getByLabelText(/가격/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/재고/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/staff/products"));
  });
});

describe("[AC-ADMIN-025] edit mode pre-fills and PATCHes that product", () => {
  it("shows the product's current values", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    expect((screen.getByLabelText(/상품명/) as HTMLInputElement).value).toBe("린넨 셔츠");
    expect((screen.getByLabelText(/가격/) as HTMLInputElement).value).toBe("39000");
    expect((screen.getByLabelText(/재고/) as HTMLInputElement).value).toBe("12");
    expect((screen.getByLabelText("카테고리") as HTMLSelectElement).value).toBe("cat-tops");
  });

  it("PATCHes the product's own route", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/staff/api/products/p1");
    expect(init.method).toBe("PATCH");
  });

  it("never sends isActive, so saving cannot change sellability", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(body()).not.toHaveProperty("isActive");
  });

  it("refreshes rather than optimistically updating", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
  });
});

describe("[AC-ADMIN-027] the images input takes URLs, adds and removes rows", () => {
  it("starts with no image row, so an empty list is the default", async () => {
    await renderForm();

    expect(screen.queryAllByLabelText(/이미지 URL/)).toHaveLength(0);
  });

  it("submits an empty array when no image was entered", async () => {
    await renderForm();

    fireEvent.change(screen.getByLabelText(/상품명/), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "y" } });
    fireEvent.change(screen.getByLabelText(/가격/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/재고/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body().images).toEqual([]);
  });

  it("adds a row on demand and submits what was typed", async () => {
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "이미지 추가" }));
    fireEvent.change(screen.getByLabelText("이미지 URL 1"), {
      target: { value: "https://cdn.example.com/z.jpg" },
    });
    fireEvent.change(screen.getByLabelText(/상품명/), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "y" } });
    fireEvent.change(screen.getByLabelText(/가격/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/재고/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body().images).toEqual(["https://cdn.example.com/z.jpg"]);
  });

  it("removes a row", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    expect(screen.getByLabelText("이미지 URL 1")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "이미지 1 제거" }));

    expect(screen.queryByLabelText("이미지 URL 1")).toBeNull();
  });

  it("[AC-ADMIN-028] offers no file input — URLs only", async () => {
    const { container } = await renderForm();

    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("[AC-ADMIN-030] server field errors are shown against their fields", () => {
  it("renders each returned error as an alert and does not navigate away", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ errors: { price: "가격은 1원 이상의 정수여야 합니다" } }),
    });
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.getByText("가격은 1원 이상의 정수여야 합니다")).toBeDefined()
    );
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("associates the message with its input via aria-describedby", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ errors: { price: "가격 오류" } }),
    });
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(screen.getByText("가격 오류")).toBeDefined());

    const input = screen.getByLabelText(/가격/);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!.split(" ").at(-1)!)?.textContent).toContain(
      "가격 오류"
    );
  });

  it("shows a generic message when the request itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  });
});

describe("[AC-ADMIN-031/032] the suspend/restore control lives outside the save form", () => {
  it("offers 판매 중단 for a sellable product and PATCHes .../active with false", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    fireEvent.click(screen.getByRole("button", { name: "판매 중단" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/staff/api/products/p1/active");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ isActive: false });
  });

  it("offers 판매 재개 for a suspended product and PATCHes with true", async () => {
    await renderForm({ mode: "edit", product: { ...EXISTING, isActive: false } });

    fireEvent.click(screen.getByRole("button", { name: "판매 재개" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ isActive: true });
  });

  it("shows only one of the two actions at a time", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    expect(screen.queryByRole("button", { name: "판매 재개" })).toBeNull();
  });

  it("is absent in create mode — a product that does not exist cannot be suspended", async () => {
    await renderForm();

    expect(screen.queryByRole("button", { name: "판매 중단" })).toBeNull();
    expect(screen.queryByRole("button", { name: "판매 재개" })).toBeNull();
  });

  it("carries the CSRF header, like every other write", async () => {
    await renderForm({ mode: "edit", product: EXISTING });

    fireEvent.click(screen.getByRole("button", { name: "판매 중단" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0]![1].headers["X-CSRF-Token"]).toBe("tok123");
  });
});
