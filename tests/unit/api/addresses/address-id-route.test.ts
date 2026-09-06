import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ADDRESS-001 M2 — PATCH|DELETE /api/addresses/[addressId]
 * (src/app/api/addresses/[addressId]/route.ts).
 *
 * Traces: AC-ADDRESS-004 (200 update), AC-ADDRESS-005 (delete),
 * AC-ADDRESS-010 (403 CSRF-first, no session/service call), AC-ADDRESS-011
 * (401, no service call), AC-ADDRESS-012 (not-owned → 404, no field
 * changed).
 */

const csrf = { verifyCsrfRequest: vi.fn() };
vi.mock("@/lib/auth/csrf", () => csrf);

const sessionResolver = { resolveSession: vi.fn() };
vi.mock("@/lib/auth/session-resolver", () => sessionResolver);

const addressService = { updateAddress: vi.fn(), removeAddress: vi.fn() };
vi.mock("@/features/addresses/services/address-service", () => addressService);

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const routeModule = await import("@/app/api/addresses/[addressId]/route");

function patchReq(body: unknown, raw?: string): Request {
  return new Request("http://localhost/api/addresses/a1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

function deleteReq(): Request {
  return new Request("http://localhost/api/addresses/a1", { method: "DELETE" });
}

function ctx(addressId = "a1") {
  return { params: Promise.resolve({ addressId }) };
}

beforeEach(() => {
  csrf.verifyCsrfRequest.mockReset().mockReturnValue(true);
  sessionResolver.resolveSession.mockReset().mockResolvedValue({ userId: "user-1", role: "customer" });
  addressService.updateAddress.mockReset();
  addressService.removeAddress.mockReset();
});

const VALID_BODY = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구",
};

describe("PATCH /api/addresses/[addressId] — AC-ADDRESS-010 (CSRF first)", () => {
  it("returns 403 and calls neither resolveSession nor updateAddress on CSRF failure", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(false);

    const response = await routeModule.PATCH(patchReq(VALID_BODY), ctx());

    expect(response.status).toBe(403);
    expect(sessionResolver.resolveSession).not.toHaveBeenCalled();
    expect(addressService.updateAddress).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/addresses/[addressId] — AC-ADDRESS-010 (CSRF first)", () => {
  it("returns 403 and calls neither resolveSession nor removeAddress on CSRF failure", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(false);

    const response = await routeModule.DELETE(deleteReq(), ctx());

    expect(response.status).toBe(403);
    expect(sessionResolver.resolveSession).not.toHaveBeenCalled();
    expect(addressService.removeAddress).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/addresses/[addressId] — AC-ADDRESS-011", () => {
  it("returns 401 without calling updateAddress when there is no session", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);

    const response = await routeModule.PATCH(patchReq(VALID_BODY), ctx());

    expect(response.status).toBe(401);
    expect(addressService.updateAddress).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/addresses/[addressId] — AC-ADDRESS-011", () => {
  it("returns 401 without calling removeAddress when there is no session", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);

    const response = await routeModule.DELETE(deleteReq(), ctx());

    expect(response.status).toBe(401);
    expect(addressService.removeAddress).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/addresses/[addressId] — malformed body", () => {
  it("returns 400 for a request body that is not valid JSON", async () => {
    const response = await routeModule.PATCH(patchReq(undefined, "not-json"), ctx());

    expect(response.status).toBe(400);
    expect(addressService.updateAddress).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/addresses/[addressId] — AC-ADDRESS-004", () => {
  it("returns 200 with the updated address on success", async () => {
    addressService.updateAddress.mockResolvedValue({
      ok: true,
      data: { id: "a1", userId: "user-1", ...VALID_BODY, isDefault: false },
    });

    const response = await routeModule.PATCH(patchReq(VALID_BODY), ctx());

    expect(response.status).toBe(200);
    expect(addressService.updateAddress).toHaveBeenCalledWith("user-1", "a1", VALID_BODY);
  });
});

describe("PATCH /api/addresses/[addressId] — AC-ADDRESS-012 (not owned → 404)", () => {
  it("maps a 404 service failure straight through", async () => {
    addressService.updateAddress.mockResolvedValue({ ok: false, status: 404, error: "존재하지 않는 배송지입니다" });

    const response = await routeModule.PATCH(patchReq(VALID_BODY), ctx());

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/addresses/[addressId] — AC-ADDRESS-005", () => {
  it("returns 200 on success", async () => {
    addressService.removeAddress.mockResolvedValue({ ok: true, data: { id: "a1" } });

    const response = await routeModule.DELETE(deleteReq(), ctx());

    expect(response.status).toBe(200);
    expect(addressService.removeAddress).toHaveBeenCalledWith("user-1", "a1");
  });
});

describe("DELETE /api/addresses/[addressId] — AC-ADDRESS-012 (not owned → 404)", () => {
  it("maps a 404 service failure straight through", async () => {
    addressService.removeAddress.mockResolvedValue({ ok: false, status: 404, error: "존재하지 않는 배송지입니다" });

    const response = await routeModule.DELETE(deleteReq(), ctx());

    expect(response.status).toBe(404);
  });
});
