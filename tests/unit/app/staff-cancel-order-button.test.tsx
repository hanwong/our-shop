// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { REQUEST_NOT_DELIVERED } from "@/features/admin/write-failure";

/**
 * SPEC-ADMIN-003 M4 (C layer) — CancelOrderButton reads a redirect as a
 * failure (REQ-ADMIN-046 / REQ-ADMIN-047, AC-ADMIN-046b).
 *
 * staff-order-detail-page.test.tsx renders this button but never exercises its
 * fetch branch, so the cancel path had no behavioural cover for the response
 * shape that produced this SPEC's defect. It does now.
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
    status: 200,
    redirected: false,
    json: async () => ({}),
  });
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "csrf_token=tok123";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderButton(orderId = "o1") {
  const { CancelOrderButton } = await import("@/app/staff/orders/[orderId]/CancelOrderButton");
  return render(<CancelOrderButton orderId={orderId} />);
}

/**
 * A 307 followed by fetch()'s default `redirect: "follow"` lands on `/` and
 * answers 200 — ok is true. `redirected` is the only field that tells the two
 * apart, which is the whole point of the guard being keyed on it.
 */
function redirectedResponse() {
  return {
    ok: true,
    status: 200,
    redirected: true,
    url: "http://localhost/",
    json: async () => ({}),
  };
}

describe("CancelOrderButton — the ordinary paths still work", () => {
  it("PATCHes the status route and refreshes on a real success", async () => {
    await renderButton();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/staff/api/orders/o1/status");
    expect(init.method).toBe("PATCH");
    expect(init.headers["X-CSRF-Token"]).toBe("tok123");
    expect(JSON.parse(init.body as string)).toEqual({ status: "cancelled" });
  });

  it("surfaces the server's own error message on a genuine rejection", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      redirected: false,
      json: async () => ({ error: "이미 취소된 주문입니다" }),
    });
    await renderButton();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toBe("이미 취소된 주문입니다");
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});

describe("[AC-ADMIN-046b] CancelOrderButton reads a redirect as a failure", () => {
  it("shows the dedicated message and never refreshes", async () => {
    fetchMock.mockResolvedValue(redirectedResponse());
    await renderButton();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toBe(REQUEST_NOT_DELIVERED);
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("does not fall back to the generic cancel-failure wording", async () => {
    fetchMock.mockResolvedValue(redirectedResponse());
    await renderButton();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByText("주문을 취소하지 못했습니다")).toBeNull();
  });

  it("re-enables the button, so the operator can retry once the cause is fixed", async () => {
    fetchMock.mockResolvedValue(redirectedResponse());
    await renderButton();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect((screen.getByRole("button", { name: "취소" }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });
});
