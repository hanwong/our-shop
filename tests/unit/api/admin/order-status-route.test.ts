import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-ADMIN-001 M4 — PATCH /admin/api/orders/[orderId]/status
 * (REQ-ADMIN-012~017, AC-ADMIN-013/016/017).
 *
 * Mirrors tests/unit/api/cart/route.test.ts's Request-construction pattern
 * (plain `new Request(...)`, no NextRequest). Mocked at the same seams
 * logout/route.ts's own test would use: verifyCsrfRequest, resolveAdminSession,
 * and cancelOrderAsAdmin — this is a route-boundary test, not a repository
 * test (that invariant — no side effects on an invalid transition — is
 * already unit-tested directly against cancelOrderAsAdmin in
 * admin-order-repository.test.ts; this file observes the ROUTE's behavior
 * given cancelOrderAsAdmin's two possible outcomes).
 */

const csrf = { verifyCsrfRequest: vi.fn() };
vi.mock("@/lib/auth/csrf", () => csrf);

const adminSession = { resolveAdminSession: vi.fn() };
vi.mock("@/features/admin/services/admin-session", () => adminSession);

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const adminOrderRepo = { cancelOrderAsAdmin: vi.fn() };
vi.mock("@/features/admin/repositories/admin-order-repository", () => adminOrderRepo);

const transactionMock = vi.fn(async (callback: (tx: unknown) => unknown) => callback({}));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: transactionMock } }));

function patchReq(body: unknown, raw?: string): Request {
  return new Request("http://localhost/admin/api/orders/o1/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

function ctx(orderId = "o1") {
  return { params: Promise.resolve({ orderId }) };
}

beforeEach(() => {
  csrf.verifyCsrfRequest.mockReset();
  adminSession.resolveAdminSession.mockReset();
  adminOrderRepo.cancelOrderAsAdmin.mockReset();
  transactionMock.mockClear();
});

describe("REQ-ADMIN-016 — CSRF is verified FIRST, before any other check", () => {
  it("answers 403 and touches NOTHING else when CSRF verification fails", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(false);
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    const response = await PATCH(patchReq({ status: "cancelled" }), ctx());

    expect(response.status).toBe(403);
    expect(adminSession.resolveAdminSession).not.toHaveBeenCalled();
    expect(adminOrderRepo.cancelOrderAsAdmin).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe("REQ-ADMIN-017 — the session is re-verified on every write, never reused from page-render time", () => {
  it("answers a rejection when resolveAdminSession() resolves to null, and never calls cancelOrderAsAdmin", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(true);
    adminSession.resolveAdminSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    const response = await PATCH(patchReq({ status: "cancelled" }), ctx());

    expect([401, 403]).toContain(response.status);
    expect(adminOrderRepo.cancelOrderAsAdmin).not.toHaveBeenCalled();
  });

  it("AC-ADMIN-003 spirit — the session-rejection response is indistinguishable in shape from the CSRF-rejection response", async () => {
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    csrf.verifyCsrfRequest.mockReturnValue(false);
    const csrfFailure = await PATCH(patchReq({ status: "cancelled" }), ctx());
    const csrfBody = await csrfFailure.json();

    csrf.verifyCsrfRequest.mockReturnValue(true);
    adminSession.resolveAdminSession.mockResolvedValue(null);
    const sessionFailure = await PATCH(patchReq({ status: "cancelled" }), ctx());
    const sessionBody = await sessionFailure.json();

    expect(sessionFailure.status).toBe(csrfFailure.status);
    expect(Object.keys(sessionBody)).toEqual(Object.keys(csrfBody));
  });
});

describe("REQ-ADMIN-012/013 — only { status: \"cancelled\" } is accepted; NO path reaches \"paid\"", () => {
  beforeEach(() => {
    csrf.verifyCsrfRequest.mockReturnValue(true);
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
  });

  it("rejects a { status: \"paid\" } request with 400 and makes NO database call at all", async () => {
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    const response = await PATCH(patchReq({ status: "paid" }), ctx());

    expect(response.status).toBe(400);
    expect(adminOrderRepo.cancelOrderAsAdmin).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects any other unrecognized status value with 400 and calls no repository function", async () => {
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    const response = await PATCH(patchReq({ status: "shipped" }), ctx());

    expect(response.status).toBe(400);
    expect(adminOrderRepo.cancelOrderAsAdmin).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON body with 400", async () => {
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    const response = await PATCH(patchReq(undefined, "not-json"), ctx());

    expect(response.status).toBe(400);
    expect(adminOrderRepo.cancelOrderAsAdmin).not.toHaveBeenCalled();
  });
});

describe("AC-ADMIN-013 — an invalid transition (already cancelled / missing order) is rejected end-to-end", () => {
  beforeEach(() => {
    csrf.verifyCsrfRequest.mockReturnValue(true);
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
  });

  it("answers 404/409 when cancelOrderAsAdmin resolves { transitioned: false }", async () => {
    adminOrderRepo.cancelOrderAsAdmin.mockResolvedValue({ transitioned: false });
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    const response = await PATCH(patchReq({ status: "cancelled" }), ctx());

    expect([404, 409]).toContain(response.status);
  });

  it("calls cancelOrderAsAdmin inside prisma.$transaction with the route's orderId", async () => {
    adminOrderRepo.cancelOrderAsAdmin.mockResolvedValue({ transitioned: false });
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    await PATCH(patchReq({ status: "cancelled" }), ctx("o-target"));

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(adminOrderRepo.cancelOrderAsAdmin).toHaveBeenCalledWith(expect.anything(), "o-target");
  });
});

describe("REQ-ADMIN-014/015 — a valid cancellation succeeds", () => {
  it("answers 200 when cancelOrderAsAdmin resolves { transitioned: true }", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(true);
    adminSession.resolveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    adminOrderRepo.cancelOrderAsAdmin.mockResolvedValue({ transitioned: true });
    const { PATCH } = await import("@/app/admin/api/orders/[orderId]/status/route");

    const response = await PATCH(patchReq({ status: "cancelled" }), ctx());

    expect(response.status).toBe(200);
  });
});
