import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-ADMIN-002 M4/M5 — the three admin product write routes
 * (REQ-ADMIN-024/025/029/030/031/032/038/039, AC-ADMIN-024/025/029/030/031/038/039).
 *
 * Mirrors tests/unit/api/admin/order-status-route.test.ts: plain `new Request`,
 * mocked at the same three seams (verifyCsrfRequest, resolveAdminSession, the
 * repository). This is a route-boundary test — the repository's own invariants
 * are unit-tested directly in admin-product-repository.test.ts.
 *
 * The ordering assertions are the point of this file. "CSRF, then a FRESH
 * session, then validation, then the write" is a sequence where every step
 * gates the next, and a reordering would not fail any single-step test — only
 * the "and touched nothing else" assertions catch it.
 */

const csrf = { verifyCsrfRequest: vi.fn() };
vi.mock("@/lib/auth/csrf", () => csrf);

const adminSession = { resolveAdminSession: vi.fn() };
vi.mock("@/features/admin/services/admin-session", () => adminSession);

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const repo = {
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  setProductActive: vi.fn(),
};
vi.mock("@/features/admin/repositories/admin-product-repository", () => repo);

const VALID_BODY = {
  name: "린넨 셔츠",
  description: "설명",
  price: 39000,
  stock: 12,
  categoryId: "cat-tops",
  images: ["https://cdn.example.com/a.jpg"],
};

function req(url: string, method: string, body: unknown, raw?: string): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

const createReq = (body: unknown = VALID_BODY, raw?: string) =>
  req("http://localhost/staff/api/products", "POST", body, raw);
const editReq = (body: unknown = VALID_BODY, raw?: string) =>
  req("http://localhost/staff/api/products/p1", "PATCH", body, raw);
const activeReq = (body: unknown = { isActive: false }, raw?: string) =>
  req("http://localhost/staff/api/products/p1/active", "PATCH", body, raw);

const ctx = (productId = "p1") => ({ params: Promise.resolve({ productId }) });

const importCreate = async () => (await import("@/app/staff/api/products/route")).POST;
const importEdit = async () => (await import("@/app/staff/api/products/[productId]/route")).PATCH;
const importActive = async () =>
  (await import("@/app/staff/api/products/[productId]/active/route")).PATCH;

beforeEach(() => {
  csrf.verifyCsrfRequest.mockReset().mockReturnValue(true);
  adminSession.resolveAdminSession.mockReset().mockResolvedValue({ userId: "u1", role: "admin" });
  repo.createProduct.mockReset().mockResolvedValue({ id: "prod_new" });
  repo.updateProduct.mockReset().mockResolvedValue({ updated: true });
  repo.setProductActive.mockReset().mockResolvedValue({ updated: true });
});

function noWritesHappened() {
  expect(repo.createProduct).not.toHaveBeenCalled();
  expect(repo.updateProduct).not.toHaveBeenCalled();
  expect(repo.setProductActive).not.toHaveBeenCalled();
}

describe("[AC-ADMIN-039] CSRF is verified FIRST, before the session or the database", () => {
  it.each([
    ["create", async () => (await importCreate())(createReq())],
    ["edit", async () => (await importEdit())(editReq(), ctx())],
    ["suspend/restore", async () => (await importActive())(activeReq(), ctx())],
  ])("%s: rejects and touches nothing else when CSRF fails", async (_label, call) => {
    csrf.verifyCsrfRequest.mockReturnValue(false);

    const response = await call();

    expect(response.status).toBe(403);
    expect(adminSession.resolveAdminSession).not.toHaveBeenCalled();
    noWritesHappened();
  });
});

describe("[AC-ADMIN-038] the admin session is re-verified on EVERY write request", () => {
  it.each([
    ["create", async () => (await importCreate())(createReq())],
    ["edit", async () => (await importEdit())(editReq(), ctx())],
    ["suspend/restore", async () => (await importActive())(activeReq(), ctx())],
  ])("%s: rejects and writes nothing when the session no longer resolves", async (_label, call) => {
    adminSession.resolveAdminSession.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(403);
    noWritesHappened();
  });

  it.each([
    ["create", async () => (await importCreate())(createReq())],
    ["edit", async () => (await importEdit())(editReq(), ctx())],
    ["suspend/restore", async () => (await importActive())(activeReq(), ctx())],
  ])("%s: calls resolveAdminSession freshly rather than trusting page-render time", async (_l, call) => {
    await call();

    expect(adminSession.resolveAdminSession).toHaveBeenCalledTimes(1);
  });
});

describe("[AC-ADMIN-039] a CSRF failure is indistinguishable from a session failure", () => {
  it("answers the same status and the same body for both", async () => {
    csrf.verifyCsrfRequest.mockReturnValue(false);
    const csrfResponse = await (await importCreate())(createReq());
    const csrfBody = await csrfResponse.json();

    csrf.verifyCsrfRequest.mockReturnValue(true);
    adminSession.resolveAdminSession.mockResolvedValue(null);
    const sessionResponse = await (await importCreate())(createReq());
    const sessionBody = await sessionResponse.json();

    // A requester must not be able to learn WHICH check rejected them.
    expect(csrfResponse.status).toBe(sessionResponse.status);
    expect(csrfBody).toEqual(sessionBody);
  });
});

describe("[AC-ADMIN-024] POST /staff/api/products creates a sellable product", () => {
  it("writes the submitted fields and answers 201", async () => {
    const response = await (await importCreate())(createReq());

    expect(response.status).toBe(201);
    expect(repo.createProduct).toHaveBeenCalledTimes(1);
    expect(repo.createProduct.mock.calls[0]![0]).toEqual(VALID_BODY);
  });

  it("returns the new product's id", async () => {
    const response = await (await importCreate())(createReq());

    await expect(response.json()).resolves.toMatchObject({ id: "prod_new" });
  });

  it("stores name and description trimmed, via the shared parser", async () => {
    await (await importCreate())(createReq({ ...VALID_BODY, name: "  린넨 셔츠  " }));

    expect(repo.createProduct.mock.calls[0]![0].name).toBe("린넨 셔츠");
  });
});

describe("[AC-ADMIN-025] PATCH /staff/api/products/[productId] updates a product", () => {
  it("updates that product with the submitted fields and answers 200", async () => {
    const response = await (await importEdit())(editReq(), ctx());

    expect(response.status).toBe(200);
    expect(repo.updateProduct.mock.calls[0]![0]).toBe("p1");
    expect(repo.updateProduct.mock.calls[0]![1]).toEqual(VALID_BODY);
  });

  it("answers 404 when the product does not exist", async () => {
    repo.updateProduct.mockResolvedValue({ updated: false });

    const response = await (await importEdit())(editReq(), ctx("p_nope"));

    expect(response.status).toBe(404);
  });

  it("never forwards isActive, so an edit cannot change sellability", async () => {
    await (await importEdit())(editReq({ ...VALID_BODY, isActive: false }), ctx());

    expect(repo.updateProduct.mock.calls[0]![1]).not.toHaveProperty("isActive");
  });
});

describe("[AC-ADMIN-030] an invalid submission writes nothing and says what to fix", () => {
  const INVALID = [
    ["price 0", { ...VALID_BODY, price: 0 }, "price"],
    ["negative price", { ...VALID_BODY, price: -1 }, "price"],
    ["fractional price", { ...VALID_BODY, price: 1.5 }, "price"],
    // CodeRabbit PR#18: above the Int column ceiling. Unbounded, these reached
    // Prisma and became a 500; they must be a 400 naming the field like any
    // other bad input.
    ["price above the Int ceiling", { ...VALID_BODY, price: 2147483648 }, "price"],
    ["stock above the Int ceiling", { ...VALID_BODY, stock: 2147483648 }, "stock"],
    ["negative stock", { ...VALID_BODY, stock: -1 }, "stock"],
    ["blank name", { ...VALID_BODY, name: "   " }, "name"],
    ["blank description", { ...VALID_BODY, description: "" }, "description"],
    ["non-URL image", { ...VALID_BODY, images: ["nope"] }, "images"],
    ["missing categoryId", { ...VALID_BODY, categoryId: "" }, "categoryId"],
  ] as const;

  it.each(INVALID)("create: rejects %s, names the field, writes nothing", async (_l, body, field) => {
    const response = await (await importCreate())(createReq(body));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors[field]).toBeDefined();
    noWritesHappened();
  });

  it.each(INVALID)("edit: rejects %s, names the field, writes nothing", async (_l, body, field) => {
    const response = await (await importEdit())(editReq(body), ctx());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors[field]).toBeDefined();
    noWritesHappened();
  });

  it.each([
    ["create", async (raw: string) => (await importCreate())(createReq(undefined, raw))],
    ["edit", async (raw: string) => (await importEdit())(editReq(undefined, raw), ctx())],
  ])("%s: rejects an unparseable body without throwing", async (_label, call) => {
    const response = await call("{not json");

    expect(response.status).toBe(400);
    noWritesHappened();
  });
});

describe("[AC-ADMIN-029] a category that does not exist is refused at the FK boundary", () => {
  /** What Prisma raises for a foreign-key constraint violation. */
  class P2003 extends Error {
    code = "P2003";
  }

  it("create: converts the FK violation into a categoryId field error, not a 500", async () => {
    repo.createProduct.mockRejectedValue(new P2003("fk"));

    const response = await (await importCreate())(createReq({ ...VALID_BODY, categoryId: "cat-nope" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      errors: { categoryId: expect.any(String) },
    });
  });

  it("edit: converts the FK violation the same way", async () => {
    repo.updateProduct.mockRejectedValue(new P2003("fk"));

    const response = await (await importEdit())(editReq({ ...VALID_BODY, categoryId: "cat-nope" }), ctx());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      errors: { categoryId: expect.any(String) },
    });
  });
});

describe("[AC-ADMIN-031/032] PATCH .../active suspends and restores", () => {
  it.each([false, true])("forwards isActive=%p for that product", async (isActive) => {
    const response = await (await importActive())(activeReq({ isActive }), ctx());

    expect(response.status).toBe(200);
    expect(repo.setProductActive).toHaveBeenCalledWith("p1", isActive);
  });

  it("answers 404 when the product does not exist", async () => {
    repo.setProductActive.mockResolvedValue({ updated: false });

    const response = await (await importActive())(activeReq(), ctx("p_nope"));

    expect(response.status).toBe(404);
  });

  it.each([{ isActive: "false" }, { isActive: 0 }, { isActive: null }, {}, { active: true }])(
    "rejects a non-boolean body (%p) and writes nothing",
    async (body) => {
      const response = await (await importActive())(activeReq(body), ctx());

      expect(response.status).toBe(400);
      expect(repo.setProductActive).not.toHaveBeenCalled();
    }
  );

  it("never accepts product fields on this route — sellability only", async () => {
    await (await importActive())(activeReq({ isActive: false, price: 1, name: "hacked" }), ctx());

    // The repository takes a bare boolean, so no extra body key can reach a
    // column even if a client sends one.
    expect(repo.setProductActive).toHaveBeenCalledWith("p1", false);
  });
});
