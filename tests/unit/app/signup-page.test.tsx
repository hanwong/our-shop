// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-AUTH-002 M3 — the `/signup` customer signup screen.
 *
 * Traces: AC-AUTH-029 (standard request body), AC-AUTH-030 (201 -> "/login",
 * no auto-login), AC-AUTH-031(a/b/c) (three exact server error messages on
 * failure, no navigation). design-notes.md §3 — structurally identical to
 * LoginPage, new screen with no prior signup UI in this repo.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { default: SignupPage } = await import("@/app/signup/page");

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
  fireEvent.click(screen.getByRole("button", { name: /회원가입/ }));
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  render(<SignupPage />);
});

describe("AC-AUTH-029 -- 표준 요청 바디로 기존 회원가입 API 호출", () => {
  it("POST /api/auth/signup을 { email, password } JSON 바디로 정확히 한 번 호출한다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "u-1", email: "new@example.com" }));
    fill(/이메일/, "new@example.com");
    fill(/비밀번호/, "correct horse battery staple");
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/auth/signup");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "new@example.com",
      password: "correct horse battery staple",
    });
  });
});

describe("AC-AUTH-030 -- 성공 시 자동 로그인 없이 로그인 화면으로 이동", () => {
  it("201 응답에 router.push('/login')이 호출되고 signup 외 다른 fetch가 없다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "u-1", email: "new@example.com" }));
    fill(/이메일/, "new@example.com");
    fill(/비밀번호/, "correct horse battery staple");
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/auth/signup");
  });
});

describe("AC-AUTH-031 -- 회원가입 실패 시 정확한 서버 오류 메시지 3종 표시", () => {
  it("(a) 잘못된 이메일 형식 -- 정확한 메시지, 이동 없음", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "Invalid email format" }));
    fill(/이메일/, "not-an-email");
    fill(/비밀번호/, "correct horse battery staple");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid email format");
    expect(push).not.toHaveBeenCalled();
  });

  it("(b) 짧은 비밀번호 -- 정확한 메시지, 이동 없음", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: "Password must be at least 8 characters" })
    );
    fill(/이메일/, "new@example.com");
    fill(/비밀번호/, "short");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Password must be at least 8 characters");
    expect(push).not.toHaveBeenCalled();
  });

  it("(c) 이미 가입된 이메일 -- 정확한 메시지, 이동 없음", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: "Email already registered" }));
    fill(/이메일/, "existing@example.com");
    fill(/비밀번호/, "correct horse battery staple");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Email already registered");
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
    fill(/이메일/, "new@example.com");
    fill(/비밀번호/, "correct horse battery staple");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
