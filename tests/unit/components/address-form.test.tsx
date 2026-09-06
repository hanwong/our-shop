// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-ADDRESS-001 M5 — AddressForm.tsx (REQ-ADDRESS-004/005, REQ-ADDRESS-013).
 *
 * Mirrors staff-cancel-order-button.test.tsx's fetch-mocking shape: a stubbed
 * global fetch, an inline csrf_token cookie, and router.refresh() as the
 * success signal — no optimistic list state to assert against.
 */

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  routerRefresh.mockClear();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: "a1" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "csrf_token=tok123";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderForm(props: Record<string, unknown> = {}) {
  const { AddressForm } = await import("@/components/address/AddressForm");
  return render(<AddressForm {...props} />);
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("받는 사람"), { target: { value: "홍길동" } });
  fireEvent.change(screen.getByLabelText("연락처"), { target: { value: "010-1234-5678" } });
  fireEvent.change(screen.getByLabelText("우편번호"), { target: { value: "06236" } });
  fireEvent.change(screen.getByLabelText("주소"), { target: { value: "서울시 강남구" } });
}

describe("AddressForm — create mode (no `address` prop)", () => {
  it("POSTs to /api/addresses with the CSRF header and the four fields", async () => {
    await renderForm();
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "배송지 추가" }));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/addresses");
    expect(init.method).toBe("POST");
    expect(init.headers["X-CSRF-Token"]).toBe("tok123");
    expect(JSON.parse(init.body as string)).toEqual({
      recipientName: "홍길동",
      recipientPhone: "010-1234-5678",
      postalCode: "06236",
      address: "서울시 강남구",
    });
  });

  it("shows the server error and does NOT refresh on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid 'recipientName'" }),
    });
    await renderForm();
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "배송지 추가" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Invalid 'recipientName'");
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});

describe("AddressForm — edit mode (`address` prop present)", () => {
  const EXISTING = {
    id: "a1",
    userId: "user-1",
    recipientName: "김철수",
    recipientPhone: "010-9999-0000",
    postalCode: "12345",
    address: "부산시 해운대구",
    isDefault: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };

  it("pre-fills the fields from the given address", async () => {
    await renderForm({ address: EXISTING });

    expect((screen.getByLabelText("받는 사람") as HTMLInputElement).value).toBe("김철수");
    expect((screen.getByLabelText("연락처") as HTMLInputElement).value).toBe("010-9999-0000");
  });

  it("PATCHes /api/addresses/[id] and calls onCancel on success", async () => {
    const onCancel = vi.fn();
    await renderForm({ address: EXISTING, onCancel });

    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/addresses/a1");
    expect(init.method).toBe("PATCH");
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders a 취소 button that calls onCancel without submitting", async () => {
    const onCancel = vi.fn();
    await renderForm({ address: EXISTING, onCancel });

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onCancel).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
