// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-AUTH-003 M1 — src/components/layout/SiteHeader.tsx.
 *
 * Traces: AC-AUTH-037 (guest → single "로그인" link to /login), AC-AUTH-038
 * (member → "내 정보" + "로그아웃" button, no "로그인" link), AC-AUTH-039
 * (every null-session reason collapses to the identical guest render —
 * REQ-AUTH-040 — `resolveSession()` itself already collapses missing /
 * revoked / expired to the same `null`, so this asserts SiteHeader draws no
 * further distinction on top of that).
 *
 * Pattern A (plan.md §B.7): `render(await SiteHeader())` — the same
 * top-level-async-component-await pattern
 * tests/unit/app/product-detail-page.test.tsx:130 already uses.
 */

vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/auth/session-resolver", () => ({ resolveSession: vi.fn() }));
// SiteHeader renders the real LogoutButton when logged in (AC-AUTH-038),
// and LogoutButton calls useRouter() at render time — same reason
// product-detail-page.test.tsx mocks next/navigation for ReviewForm.
vi.mock("next/navigation", () => ({ useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })) }));

const { resolveSession } = await import("@/lib/auth/session-resolver");
const { default: SiteHeader } = await import("@/components/layout/SiteHeader");

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(resolveSession).mockReset();
});

describe("SiteHeader — AC-AUTH-037", () => {
  it("shows exactly one login link pointing at /login for a guest visitor", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);

    render(await SiteHeader());

    const links = screen.getAllByRole("link", { name: "로그인" });
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/login");
  });
});

describe("SiteHeader — AC-AUTH-038", () => {
  it("shows account status and a logout button for a logged-in visitor, and no login link", async () => {
    vi.mocked(resolveSession).mockResolvedValue({ userId: "u1", role: "customer" });

    render(await SiteHeader());

    expect(screen.getByText("내 정보")).toBeDefined();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
  });
});

describe("SiteHeader — AC-AUTH-039", () => {
  it("renders identically for every null-session reason (missing / revoked / expired)", async () => {
    const outputs: string[] = [];

    const nullReasons = ["missing cookie", "revoked token", "expired token"];
    for (let i = 0; i < nullReasons.length; i += 1) {
      vi.mocked(resolveSession).mockReset().mockResolvedValue(null);
      const { container, unmount } = render(await SiteHeader());
      outputs.push(container.innerHTML);
      unmount();
    }

    expect(outputs[0]).toBe(outputs[1]);
    expect(outputs[1]).toBe(outputs[2]);
    expect(outputs[0]).toContain("로그인");
  });
});
