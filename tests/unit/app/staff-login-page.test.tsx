// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-ADMIN-001 M2 — the `/staff/login` admin login screen.
 *
 * Traces: AC-ADMIN-004 (submits the existing POST /api/auth/login with the
 * standard JSON body — no new endpoint, no new request shape), AC-ADMIN-005
 * (a 200 response navigates to /staff/orders), AC-ADMIN-006 PARTIAL — this
 * file covers only the client half: the form makes no role-based branching
 * decision, navigating to the SAME target regardless of response content.
 * The server-side rejection half (a non-admin session actually being denied
 * admin data) is /staff/orders's own Server Component gate, built in M3 —
 * see progress.md §E.2 M2 for the explicit PARTIAL scope note.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { default: StaffLoginPage } = await import("@/app/staff/login/page");

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /로그인/ }));
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  render(<StaffLoginPage />);
});

describe("AC-ADMIN-004 — submits the existing login API unchanged", () => {
  it("POSTs /api/auth/login with the standard { email, password } JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: "tok" }));
    fill(/이메일/, "admin@example.com");
    fill(/비밀번호/, "correct horse battery staple");
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "admin@example.com",
      password: "correct horse battery staple",
    });
  });

  it("falls back to a generic Korean message when the failure body cannot be parsed", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    fill(/이메일/, "admin@example.com");
    fill(/비밀번호/, "wrong");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the server's error message in a role=alert element on 401 and does not navigate", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Invalid email or password" }));
    fill(/이메일/, "admin@example.com");
    fill(/비밀번호/, "wrong");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid email or password");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("AC-ADMIN-005 — a successful login navigates to the admin order list", () => {
  it("pushes /staff/orders on a 200 response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: "tok" }));
    fill(/이메일/, "admin@example.com");
    fill(/비밀번호/, "pw");
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/orders"));
  });
});

describe("AC-ADMIN-006 PARTIAL — no client-side role branching (server half deferred to M3)", () => {
  it("navigates to the SAME target on every 200, regardless of response body content", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: "tok-a" }));
    fill(/이메일/, "a@example.com");
    fill(/비밀번호/, "pw");
    submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/orders"));

    push.mockClear();
    // The real /api/auth/login response never carries a role field
    // (design.md §1/§2) — this simulates a hypothetical one anyway, to
    // prove the form does not branch on it even if it appeared.
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: "tok-b", role: "customer" }));
    fill(/이메일/, "b@example.com");
    fill(/비밀번호/, "pw");
    submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/orders"));

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("the page source never reads a role field off the login response (static regression guard)", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../../src/app/staff/login/page.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/\.role\b/);
    expect(source).not.toMatch(/jwt[-_]?decode/i);
  });
});
