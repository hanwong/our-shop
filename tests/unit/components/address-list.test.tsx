// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-ADDRESS-001 M5 — AddressList.tsx (REQ-ADDRESS-013).
 */

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

let fetchMock: ReturnType<typeof vi.fn>;

function address(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a1",
    userId: "user-1",
    recipientName: "홍길동",
    recipientPhone: "010-1234-5678",
    postalCode: "06236",
    address: "서울시 강남구 테헤란로 1",
    isDefault: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  routerRefresh.mockClear();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "csrf_token=tok123";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderList(addresses: ReturnType<typeof address>[]) {
  const { AddressList } = await import("@/components/address/AddressList");
  return render(<AddressList addresses={addresses} />);
}

describe("AddressList — empty state", () => {
  it("renders a message when there are no addresses", async () => {
    await renderList([]);

    expect(screen.getByText("저장된 배송지가 없습니다.")).toBeDefined();
  });
});

describe("AddressList — default badge", () => {
  it("shows the badge only on the default row, and the 기본으로 설정 button only on the others", async () => {
    await renderList([address({ id: "a1", isDefault: true }), address({ id: "a2", isDefault: false })]);

    expect(screen.getByText("기본 배송지")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "기본으로 설정" })).toHaveLength(1);
  });
});

describe("AddressList — delete action", () => {
  it("DELETEs the target address with the CSRF header and refreshes on success", async () => {
    await renderList([address({ id: "a1" })]);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/addresses/a1");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-CSRF-Token"]).toBe("tok123");
  });

  it("shows an error and does not refresh on failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "존재하지 않는 배송지입니다" }) });
    await renderList([address({ id: "a1" })]);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect((await screen.findByRole("alert")).textContent).toContain("존재하지 않는 배송지입니다");
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});

describe("AddressList — set-default action", () => {
  it("PATCHes the default sub-route with the CSRF header and refreshes on success", async () => {
    await renderList([address({ id: "a1", isDefault: false })]);

    fireEvent.click(screen.getByRole("button", { name: "기본으로 설정" }));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/addresses/a1/default");
    expect(init.method).toBe("PATCH");
    expect(init.headers["X-CSRF-Token"]).toBe("tok123");
  });
});

describe("AddressList — inline edit toggle", () => {
  it("swaps the row for an AddressForm in edit mode when 수정 is clicked", async () => {
    await renderList([address({ id: "a1", recipientName: "홍길동" })]);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDefined();
    expect((screen.getByLabelText("받는 사람") as HTMLInputElement).value).toBe("홍길동");
  });

  it("returns to the read view when the inline form's 취소 is clicked", async () => {
    await renderList([address({ id: "a1" })]);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.getByRole("button", { name: "수정" })).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
