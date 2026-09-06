import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ADDRESS-001 M2 — PATCH /api/addresses/[addressId]/default
 * (src/app/api/addresses/[addressId]/default/route.ts).
 *
 * Traces: AC-ADDRESS-006 (200 success), AC-ADDRESS-007 (not-owned → 404),
 * AC-ADDRESS-010 (403 CSRF-first), AC-ADDRESS-011 (401).
 */

const csrf = { verifyCsrfRequest: vi.fn() };
vi.mock("@/lib/auth/csrf", () => csrf);

const sessionResolver = { resolveSession: vi.fn() };
vi.mock("@/lib/auth/session-resolver", () => sessionResolver);

const addressService = { setDefaultAddress: vi.fn() };
vi.mock("@/features/addresses/services/address-service", () => addressService);

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const routeModule = await import("@/app/api/addresses/[addressId]/default/route");

function patchReq(): Request {
  return new Request("http://localhost/api/addresses/a1/default", { method: "PATCH" });
}

function ctx(addressId = "a1") {
  return { params: Promise.resolve({ addressId }) };
}

beforeEach(() => {
  csrf.verifyCsrfRequest.mockReset().mockReturnValue(true);
  sessionResolver.resolveSession.mockReset().mockResolvedValue({ userId: "user-1", role: "customer" });
  addressService.setDefaultAddress.mockReset();
});

describe("PATCH .../default — AC-ADDRESS-010 (CSRF first)", () => {
  it("returns 403 and calls neither resolveSession nor setDefaultAddress on CSRF failure", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(false);

    const response = await routeModule.PATCH(patchReq(), ctx());

    expect(response.status).toBe(403);
    expect(sessionResolver.resolveSession).not.toHaveBeenCalled();
    expect(addressService.setDefaultAddress).not.toHaveBeenCalled();
  });
});

describe("PATCH .../default — AC-ADDRESS-011", () => {
  it("returns 401 without calling setDefaultAddress when there is no session", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);

    const response = await routeModule.PATCH(patchReq(), ctx());

    expect(response.status).toBe(401);
    expect(addressService.setDefaultAddress).not.toHaveBeenCalled();
  });
});

describe("PATCH .../default — AC-ADDRESS-006", () => {
  it("returns 200 on success and forwards session userId + addressId", async () => {
    addressService.setDefaultAddress.mockResolvedValue({ ok: true, data: { id: "a1" } });

    const response = await routeModule.PATCH(patchReq(), ctx());

    expect(response.status).toBe(200);
    expect(addressService.setDefaultAddress).toHaveBeenCalledWith("user-1", "a1");
  });
});

describe("PATCH .../default — AC-ADDRESS-007 (not owned → 404)", () => {
  it("maps a 404 service failure straight through", async () => {
    addressService.setDefaultAddress.mockResolvedValue({
      ok: false,
      status: 404,
      error: "존재하지 않는 배송지입니다",
    });

    const response = await routeModule.PATCH(patchReq(), ctx());

    expect(response.status).toBe(404);
  });
});
