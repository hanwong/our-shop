// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-BRAND-001 M3 — src/components/layout/SiteHeader.tsx +
 * src/components/layout/SiteHeaderNav.tsx.
 *
 * Traces:
 * - AC-BRAND-011: the logo link and the SHOP/BESPOKE/STORY/CART nav links
 *   are all present in SiteHeader's rendered output, for either session
 *   state (nav is session-independent).
 * - AC-BRAND-012 regression: the SPEC-AUTH-003 session branch (login link
 *   OR account info + logout) still renders correctly in both directions,
 *   exactly once — no double-render across the desktop/mobile responsive
 *   variants that share the single <nav> element (design.md §3.2).
 *
 * Pattern A (plan.md §B.7, reused from site-header.test.tsx):
 * `render(await SiteHeader())`.
 */

vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/auth/session-resolver", () => ({ resolveSession: vi.fn() }));
// SiteHeader renders the real LogoutButton when logged in, and LogoutButton
// calls useRouter() at render time — same reason site-header.test.tsx mocks
// next/navigation for this scenario.
vi.mock("next/navigation", () => ({ useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })) }));

const { resolveSession } = await import("@/lib/auth/session-resolver");
const { default: SiteHeader } = await import("@/components/layout/SiteHeader");

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(resolveSession).mockReset();
});

describe("SiteHeader + SiteHeaderNav — AC-BRAND-011", () => {
  it("renders the logo link and all four nav links for a guest visitor", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);

    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "OUR" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "SHOP" }).getAttribute("href")).toBe("/shop");
    expect(screen.getByRole("link", { name: "BESPOKE" }).getAttribute("href")).toBe("/bespoke");
    expect(screen.getByRole("link", { name: "STORY" }).getAttribute("href")).toBe("/story");
    expect(screen.getByRole("link", { name: "CART" }).getAttribute("href")).toBe("/cart");
  });

  it("renders the logo link and all four nav links for a logged-in visitor", async () => {
    vi.mocked(resolveSession).mockResolvedValue({ userId: "u1", role: "customer" });

    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "OUR" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "SHOP" }).getAttribute("href")).toBe("/shop");
    expect(screen.getByRole("link", { name: "BESPOKE" }).getAttribute("href")).toBe("/bespoke");
    expect(screen.getByRole("link", { name: "STORY" }).getAttribute("href")).toBe("/story");
    expect(screen.getByRole("link", { name: "CART" }).getAttribute("href")).toBe("/cart");
  });
});

describe("SiteHeader + SiteHeaderNav — AC-BRAND-012 regression", () => {
  it("shows only the login link for a guest, exactly once", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);

    render(await SiteHeader());

    expect(screen.getAllByRole("link", { name: "로그인" })).toHaveLength(1);
    expect(screen.queryByText("내 정보")).toBeNull();
    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
  });

  it("shows account info and a logout button exactly once for a logged-in visitor, with no login link", async () => {
    vi.mocked(resolveSession).mockResolvedValue({ userId: "u1", role: "customer" });

    render(await SiteHeader());

    expect(screen.getAllByText("내 정보")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "로그아웃" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
  });
});
