// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-AUTH-002 M2 — the `/login` customer login screen.
 *
 * Traces: AC-AUTH-025 (standard request body), AC-AUTH-026 (200 -> "/"),
 * AC-AUTH-027 (failure shows the server's error message, no navigation),
 * AC-AUTH-028 (no redirect/next query-parameter handling — static scan).
 * design-notes.md §2 — reuses staff/login/page.tsx's visual conventions
 * verbatim; the only behavioral differences are the redirect target and
 * an optional login<->signup cross-navigation link.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { default: LoginPage } = await import("@/app/(shop)/login/page");

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
  render(<LoginPage />);
});

describe("AC-AUTH-025 — 표준 요청 바디로 기존 로그인 API 호출", () => {
  it("POST /api/auth/login을 { email, password } JSON 바디로 정확히 한 번 호출한다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: "tok" }));
    fill(/이메일/, "customer@example.com");
    fill(/비밀번호/, "correct horse battery staple");
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "customer@example.com",
      password: "correct horse battery staple",
    });
  });
});

describe("AC-AUTH-026 — 로그인 성공 시 홈으로 이동", () => {
  it("200 응답에 router.push('/')가 호출된다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: "tok" }));
    fill(/이메일/, "customer@example.com");
    fill(/비밀번호/, "pw");
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});

describe("AC-AUTH-027 — 로그인 실패 시 서버 오류 메시지 표시, 이동 없음", () => {
  it("401 응답의 error 필드를 role=alert에 정확히 표시하고 이동하지 않는다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Invalid email or password" }));
    fill(/이메일/, "customer@example.com");
    fill(/비밀번호/, "wrong");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid email or password");
    expect(push).not.toHaveBeenCalled();
  });

  it("응답 바디를 파싱할 수 없으면 일반 안내 메시지로 대체한다 (staff/login 선례)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    fill(/이메일/, "customer@example.com");
    fill(/비밀번호/, "wrong");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("AC-AUTH-028 — redirect/next 쿼리 파라미터 처리 부재 (정적 검사)", () => {
  it("useSearchParams/redirect/next 쿼리 조작 패턴이 소스에 없다 — 이동 대상은 리터럴 '/' 하나뿐", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../src/app/(shop)/login/page.tsx"), "utf8");
    expect(source).not.toMatch(/useSearchParams/);
    expect(source).not.toMatch(/[?&]next=/);
    expect(source).toMatch(/router\.push\(["']\/["']\)/);
  });
});
