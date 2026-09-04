import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-REVIEW-001 M2 — review-service.ts.
 *
 * Traces: AC-REVIEW-001 (success), AC-REVIEW-002/016 (duplicate — pre-check
 * and the P2002 race fallback), AC-REVIEW-004/005 (rating/body validation),
 * AC-REVIEW-006 (unknown product), AC-REVIEW-007/008 (aggregate rounding and
 * the no-reviews-yet shape).
 *
 * The repository is mocked here so this suite asserts the SERVICE's own
 * decisions — validation order, failure-status mapping, and the P2002 catch —
 * the same boundary order-service.test.ts and cart-service tests already draw.
 */

const repo = {
  create: vi.fn(),
  findByUserAndProduct: vi.fn(),
  listByProduct: vi.fn(),
  aggregateByProduct: vi.fn(),
  productExists: vi.fn(),
};
vi.mock("@/features/reviews/repositories/review-repository", () => repo);

const { createReview, getProductReviewSummary } = await import(
  "@/features/reviews/services/review-service"
);

beforeEach(() => {
  repo.create.mockReset();
  repo.findByUserAndProduct.mockReset().mockResolvedValue(null);
  repo.listByProduct.mockReset().mockResolvedValue([]);
  repo.aggregateByProduct.mockReset().mockResolvedValue({ averageRating: null, count: 0 });
  repo.productExists.mockReset().mockResolvedValue(true);
});

const USER_ID = "user-1";
const PRODUCT_ID = "prod-1";

describe("createReview — AC-REVIEW-001", () => {
  it("creates a review and returns 201-shaped success", async () => {
    repo.create.mockResolvedValue({
      id: "rev-1",
      userId: USER_ID,
      productId: PRODUCT_ID,
      rating: 4,
      body: "좋아요",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    const result = await createReview(USER_ID, { productId: PRODUCT_ID, rating: 4, body: "좋아요" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: "rev-1",
        userId: USER_ID,
        productId: PRODUCT_ID,
        rating: 4,
        body: "좋아요",
        createdAt: "2026-09-01T00:00:00.000Z",
      });
    }
    expect(repo.create).toHaveBeenCalledWith(USER_ID, PRODUCT_ID, 4, "좋아요");
  });

  it("trims the body before persisting it", async () => {
    repo.create.mockResolvedValue({
      id: "rev-1",
      userId: USER_ID,
      productId: PRODUCT_ID,
      rating: 3,
      body: "괜찮아요",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    await createReview(USER_ID, { productId: PRODUCT_ID, rating: 3, body: "  괜찮아요  " });

    expect(repo.create).toHaveBeenCalledWith(USER_ID, PRODUCT_ID, 3, "괜찮아요");
  });
});

describe("createReview — AC-REVIEW-002 (duplicate pre-check)", () => {
  it("returns 409 without calling create() when a review already exists", async () => {
    repo.findByUserAndProduct.mockResolvedValue({ id: "existing" });

    const result = await createReview(USER_ID, { productId: PRODUCT_ID, rating: 4, body: "또 씀" });

    expect(result).toEqual({ ok: false, status: 409, error: expect.any(String) });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("createReview — AC-REVIEW-016 (P2002 race fallback)", () => {
  it("maps a create()-time unique-constraint violation to a structured 409, not a thrown exception", async () => {
    // The pre-check passes (no existing row seen), but the write itself races
    // with a concurrent request and hits the DB constraint — spec.md §1's
    // documented edge case.
    repo.create.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

    const result = await createReview(USER_ID, { productId: PRODUCT_ID, rating: 5, body: "레이스" });

    expect(result).toEqual({ ok: false, status: 409, error: expect.any(String) });
  });

  it("re-throws a create() error that is not a P2002 violation", async () => {
    repo.create.mockRejectedValue(new Error("connection reset"));

    await expect(
      createReview(USER_ID, { productId: PRODUCT_ID, rating: 5, body: "다른 에러" })
    ).rejects.toThrow("connection reset");
  });
});

describe("createReview — AC-REVIEW-004 (rating validation)", () => {
  it.each([0, 6, -1, 3.5])("rejects rating %s with 400, persisting nothing", async (rating) => {
    const result = await createReview(USER_ID, { productId: PRODUCT_ID, rating, body: "본문" });

    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("rating") });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric rating with 400", async () => {
    const result = await createReview(USER_ID, { productId: PRODUCT_ID, rating: "4", body: "본문" });

    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("rating") });
  });
});

describe("createReview — AC-REVIEW-005 (body validation)", () => {
  it.each(["", "   "])("rejects an empty-or-blank body %j with 400, persisting nothing", async (body) => {
    const result = await createReview(USER_ID, { productId: PRODUCT_ID, rating: 4, body });

    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("body") });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejects a body over the 2000-character cap (plan.md M2)", async () => {
    const result = await createReview(USER_ID, {
      productId: PRODUCT_ID,
      rating: 4,
      body: "a".repeat(2001),
    });

    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining("body") });
  });

  it("accepts a body at exactly the 2000-character cap", async () => {
    repo.create.mockResolvedValue({
      id: "rev-1",
      userId: USER_ID,
      productId: PRODUCT_ID,
      rating: 4,
      body: "a".repeat(2000),
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    const result = await createReview(USER_ID, { productId: PRODUCT_ID, rating: 4, body: "a".repeat(2000) });

    expect(result.ok).toBe(true);
  });
});

describe("createReview — AC-REVIEW-006 (unknown product)", () => {
  it("returns 404 without calling create() for an unknown productId", async () => {
    repo.productExists.mockResolvedValue(false);

    const result = await createReview(USER_ID, { productId: "no-such-product", rating: 4, body: "본문" });

    expect(result).toEqual({ ok: false, status: 404, error: expect.any(String) });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("createReview — malformed productId", () => {
  it("rejects a missing/non-string productId with 400 before touching the database", async () => {
    const result = await createReview(USER_ID, { rating: 4, body: "본문" });

    expect(result).toEqual({ ok: false, status: 400, error: expect.any(String) });
    expect(repo.productExists).not.toHaveBeenCalled();
  });
});

describe("getProductReviewSummary — AC-REVIEW-007", () => {
  it("rounds the average to one decimal place and returns the review list", async () => {
    repo.aggregateByProduct.mockResolvedValue({ averageRating: 4.333333, count: 3 });
    repo.listByProduct.mockResolvedValue([
      {
        id: "r1",
        userId: "u1",
        productId: PRODUCT_ID,
        rating: 5,
        body: "최고",
        createdAt: new Date("2026-09-02T00:00:00.000Z"),
        updatedAt: new Date("2026-09-02T00:00:00.000Z"),
      },
    ]);

    const summary = await getProductReviewSummary(PRODUCT_ID);

    expect(summary.aggregate).toEqual({ averageRating: 4.3, count: 3 });
    expect(summary.reviews).toEqual([
      { id: "r1", userId: "u1", productId: PRODUCT_ID, rating: 5, body: "최고", createdAt: "2026-09-02T00:00:00.000Z" },
    ]);
  });
});

describe("getProductReviewSummary — AC-REVIEW-008", () => {
  it("returns a null average and a zero count for a product with no reviews", async () => {
    const summary = await getProductReviewSummary("prod-no-reviews");

    expect(summary.aggregate).toEqual({ averageRating: null, count: 0 });
    expect(summary.reviews).toEqual([]);
  });
});
