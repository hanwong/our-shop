import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ADDRESS-001 M2 — GET|POST /api/addresses (src/app/api/addresses/route.ts).
 *
 * Traces: AC-ADDRESS-003 (201), AC-ADDRESS-009 (400, service-owned),
 * AC-ADDRESS-010 (403 CSRF, no session/service call), AC-ADDRESS-011 (401,
 * no service call — GET included).
 *
 * Mocked at the SERVICE seam (verifyCsrfRequest, resolveSession,
 * createAddress/listAddresses) — the same boundary reviews/route.test.ts and
 * admin/order-status-route.test.ts draw.
 */

const csrf = { verifyCsrfRequest: vi.fn() };
vi.mock("@/lib/auth/csrf", () => csrf);

const sessionResolver = { resolveSession: vi.fn() };
vi.mock("@/lib/auth/session-resolver", () => sessionResolver);

const addressService = { createAddress: vi.fn(), listAddresses: vi.fn() };
vi.mock("@/features/addresses/services/address-service", () => addressService);

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const routeModule = await import("@/app/api/addresses/route");

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/addresses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  csrf.verifyCsrfRequest.mockReset().mockReturnValue(true);
  sessionResolver.resolveSession.mockReset().mockResolvedValue({ userId: "user-1", role: "customer" });
  addressService.createAddress.mockReset();
  addressService.listAddresses.mockReset().mockResolvedValue([]);
});

const VALID_BODY = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구",
};

describe("GET /api/addresses — AC-ADDRESS-011", () => {
  it("returns 401 without calling listAddresses when there is no session", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);

    const response = await routeModule.GET();

    expect(response.status).toBe(401);
    expect(addressService.listAddresses).not.toHaveBeenCalled();
  });

  it("returns 200 with the member's own list on success", async () => {
    addressService.listAddresses.mockResolvedValue([{ id: "a1" }]);

    const response = await routeModule.GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "a1" }]);
    expect(addressService.listAddresses).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/addresses — AC-ADDRESS-010 (CSRF is verified FIRST)", () => {
  it("returns 403 and touches NOTHING else when CSRF verification fails", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(false);

    const response = await routeModule.POST(postRequest(VALID_BODY));

    expect(response.status).toBe(403);
    expect(sessionResolver.resolveSession).not.toHaveBeenCalled();
    expect(addressService.createAddress).not.toHaveBeenCalled();
  });
});

describe("POST /api/addresses — AC-ADDRESS-011", () => {
  it("returns 401 without calling createAddress when there is no session", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);

    const response = await routeModule.POST(postRequest(VALID_BODY));

    expect(response.status).toBe(401);
    expect(addressService.createAddress).not.toHaveBeenCalled();
  });
});

describe("POST /api/addresses — malformed body", () => {
  it("returns 400 for a request body that is not valid JSON", async () => {
    const request = new Request("http://localhost/api/addresses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    const response = await routeModule.POST(request);

    expect(response.status).toBe(400);
    expect(addressService.createAddress).not.toHaveBeenCalled();
  });
});

describe("POST /api/addresses — AC-ADDRESS-003", () => {
  it("returns 201 with the created address on success", async () => {
    addressService.createAddress.mockResolvedValue({
      ok: true,
      data: { id: "a1", userId: "user-1", ...VALID_BODY, isDefault: true },
    });

    const response = await routeModule.POST(postRequest(VALID_BODY));

    expect(response.status).toBe(201);
    expect(addressService.createAddress).toHaveBeenCalledWith("user-1", VALID_BODY);
  });
});

describe("POST /api/addresses — AC-ADDRESS-009 status mapping from the service", () => {
  it("maps a 400 service failure straight through", async () => {
    addressService.createAddress.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Invalid 'recipientName'",
    });

    const response = await routeModule.POST(postRequest(VALID_BODY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid 'recipientName'" });
  });
});
