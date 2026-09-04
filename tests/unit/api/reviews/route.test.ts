import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-REVIEW-001 M4 — `POST /api/reviews` (src/app/api/reviews/route.ts).
 *
 * Traces: AC-REVIEW-001 (201), AC-REVIEW-002/016 (409, service-owned), AC-
 * REVIEW-003 (401), AC-REVIEW-004/005 (400, service-owned), AC-REVIEW-006
 * (404), AC-REVIEW-014 (admin succeeds exactly like a customer), AC-REVIEW-015
 * (only POST is exported).
 *
 * Mocked at the SERVICE seam (`resolveSession` + `createReview`) — the same
 * boundary staff/api/products/route.test.ts draws for
 * `resolveAdminSession` + the validation/repository layer, since the ACs here
 * are stated in terms of HTTP status codes, not service-internal decisions
 * (those are review-service.test.ts's job).
 */

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const sessionResolver = { resolveSession: vi.fn() };
vi.mock("@/lib/auth/session-resolver", () => sessionResolver);

const reviewService = { createReview: vi.fn() };
vi.mock("@/features/reviews/services/review-service", () => reviewService);

const routeModule = await import("@/app/api/reviews/route");

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sessionResolver.resolveSession.mockReset().mockResolvedValue({ userId: "user-1", role: "customer" });
  reviewService.createReview.mockReset();
});

describe("POST /api/reviews — AC-REVIEW-001", () => {
  it("returns 201 with the created review on success", async () => {
    reviewService.createReview.mockResolvedValue({
      ok: true,
      data: { id: "rev-1", userId: "user-1", productId: "p-1", rating: 4, body: "좋아요", createdAt: "2026-09-01T00:00:00.000Z" },
    });

    const response = await routeModule.POST(postRequest({ productId: "p-1", rating: 4, body: "좋아요" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "rev-1",
      userId: "user-1",
      productId: "p-1",
      rating: 4,
      body: "좋아요",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    expect(reviewService.createReview).toHaveBeenCalledWith("user-1", {
      productId: "p-1",
      rating: 4,
      body: "좋아요",
    });
  });
});

describe("POST /api/reviews — AC-REVIEW-003", () => {
  it("returns 401 without calling createReview when there is no session", async () => {
    sessionResolver.resolveSession.mockResolvedValue(null);

    const response = await routeModule.POST(postRequest({ productId: "p-1", rating: 4, body: "본문" }));

    expect(response.status).toBe(401);
    expect(reviewService.createReview).not.toHaveBeenCalled();
  });
});

describe("POST /api/reviews — malformed body", () => {
  it("returns 400 for a request body that is not valid JSON", async () => {
    const request = new Request("http://localhost/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    const response = await routeModule.POST(request);

    expect(response.status).toBe(400);
    expect(reviewService.createReview).not.toHaveBeenCalled();
  });
});

describe("POST /api/reviews — status mapping from the service", () => {
  it.each([
    [400, "Invalid 'rating'"],
    [404, "존재하지 않는 상품입니다"],
    [409, "이미 이 상품에 리뷰를 작성했습니다"],
  ])("maps a %i service failure straight through", async (status, error) => {
    reviewService.createReview.mockResolvedValue({ ok: false, status, error });

    const response = await routeModule.POST(postRequest({ productId: "p-1", rating: 4, body: "본문" }));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });
});

describe("POST /api/reviews — AC-REVIEW-014", () => {
  it("succeeds for an admin-role session exactly like a customer session", async () => {
    sessionResolver.resolveSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    reviewService.createReview.mockResolvedValue({
      ok: true,
      data: { id: "rev-2", userId: "admin-1", productId: "p-1", rating: 5, body: "관리자 리뷰", createdAt: "2026-09-01T00:00:00.000Z" },
    });

    const response = await routeModule.POST(postRequest({ productId: "p-1", rating: 5, body: "관리자 리뷰" }));

    expect(response.status).toBe(201);
    expect(reviewService.createReview).toHaveBeenCalledWith("admin-1", expect.anything());
  });
});

describe("POST /api/reviews — AC-REVIEW-015", () => {
  it("exports POST only — no PATCH, DELETE, or PUT handler", () => {
    expect(routeModule.POST).toBeTypeOf("function");
    expect((routeModule as Record<string, unknown>).PATCH).toBeUndefined();
    expect((routeModule as Record<string, unknown>).DELETE).toBeUndefined();
    expect((routeModule as Record<string, unknown>).PUT).toBeUndefined();
  });
});
