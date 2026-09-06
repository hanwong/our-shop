// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-ADDRESS-001 M4 — `/mypage/addresses` (REQ-ADDRESS-012/013).
 *
 * Mirrors tests/unit/app/staff-products-page.test.tsx: the Server Component
 * is awaited directly and its returned element rendered, with resolveSession
 * and the service mocked at their module seams.
 */

const sessionResolver = { resolveSession: vi.fn() };
vi.mock("@/lib/auth/session-resolver", () => sessionResolver);

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (p: string) => redirect(p),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const addressService = { listAddresses: vi.fn() };
vi.mock("@/features/addresses/services/address-service", () => addressService);

function address(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a1",
    userId: "user-1",
    recipientName: "홍길동",
    recipientPhone: "010-1234-5678",
    postalCode: "06236",
    address: "서울시 강남구 테헤란로 1",
    isDefault: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  sessionResolver.resolveSession.mockReset().mockResolvedValue({ userId: "user-1", role: "customer" });
  redirect.mockClear();
  addressService.listAddresses.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

async function renderPage() {
  const { default: Page } = await import("@/app/(shop)/mypage/addresses/page");
  const element = await Page();
  return render(element);
}

describe("[AC-ADDRESS-013] the session gate runs before any address data is read", () => {
  it("redirects to /login and fetches NOTHING when there is no session", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);
    const { default: Page } = await import("@/app/(shop)/mypage/addresses/page");

    await expect(Page()).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirect).toHaveBeenCalledWith("/login");
    // The ordering matters: data must not be read and then discarded.
    expect(addressService.listAddresses).not.toHaveBeenCalled();
  });

  it("does not redirect with a next/redirect query parameter (REQ-ADDRESS-015)", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);
    const { default: Page } = await import("@/app/(shop)/mypage/addresses/page");

    await expect(Page()).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(redirect.mock.calls[0]![0]).not.toMatch(/[?&](next|redirect|returnUrl)=/);
  });
});

describe("[AC-ADDRESS-013] a logged-in member sees their list and controls", () => {
  it("renders the member's addresses and the default badge", async () => {
    addressService.listAddresses.mockResolvedValue([address()]);
    await renderPage();

    expect(screen.getByText("홍길동")).toBeDefined();
    expect(screen.getByText("기본 배송지")).toBeDefined();
    expect(screen.getByText(/010-1234-5678/)).toBeDefined();
  });

  it("renders the add-address form", async () => {
    await renderPage();

    expect(screen.getByText("새 배송지 추가")).toBeDefined();
    expect(screen.getByText("배송지 추가")).toBeDefined();
  });

  it("renders an empty-state message when the member has no addresses", async () => {
    addressService.listAddresses.mockResolvedValue([]);
    await renderPage();

    expect(screen.getByText("저장된 배송지가 없습니다.")).toBeDefined();
  });
});
