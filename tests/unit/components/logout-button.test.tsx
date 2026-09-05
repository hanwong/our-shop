// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-AUTH-003 M2 — src/components/layout/LogoutButton.tsx.
 *
 * Traces: AC-AUTH-041 (CSRF double-submit request shape), AC-AUTH-042
 * (200 → router.refresh(), never router.push()), AC-AUTH-043 (non-200 →
 * neither navigation call fires, the button stays in the document).
 *
 * CSRF cookie reads use the SAME inline document.cookie parse precedent as
 * CancelOrderButton.tsx / ProductForm.tsx (plan.md §B.3) — this file sets
 * `document.cookie` directly rather than mocking a shared util, because no
 * shared util exists (deliberately, per plan.md §G anti-pattern #1).
 */

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

const { LogoutButton } = await import("@/components/layout/LogoutButton");

const fetchMock = vi.fn();

function jsonResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) } as Response;
}

/** Clears any previously-set csrf_token cookie, then sets a new value (or none). */
function setCsrfCookie(value: string | null) {
  document.cookie = "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  if (value !== null) {
    document.cookie = `csrf_token=${value}`;
  }
}

afterEach(cleanup);

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setCsrfCookie(null);
});

describe("LogoutButton — AC-AUTH-041", () => {
  it("sends the csrf_token cookie value as the X-CSRF-Token header on a single POST", async () => {
    setCsrfCookie("abc123");
    fetchMock.mockResolvedValue(jsonResponse(200));

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.objectContaining({ "X-CSRF-Token": "abc123" }),
      })
    );
  });
});

describe("LogoutButton — AC-AUTH-042", () => {
  it("refreshes the screen exactly once on a 200 response, without pushing", async () => {
    setCsrfCookie("abc123");
    fetchMock.mockResolvedValue(jsonResponse(200));

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
  });
});

describe("LogoutButton — AC-AUTH-043", () => {
  it("(a) does not navigate and keeps the button on a 403 CSRF failure", async () => {
    setCsrfCookie(null); // missing cookie -> empty header value -> server would 403
    fetchMock.mockResolvedValue(jsonResponse(403));

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(refresh).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeDefined();
  });

  it("(b) does not navigate and keeps the button on a 500 server error", async () => {
    setCsrfCookie("abc123");
    fetchMock.mockResolvedValue(jsonResponse(500));

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(refresh).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeDefined();
  });
});
