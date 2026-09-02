import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-DISCOUNT-001 M6a — POST /api/discounts/validate.
 *
 * Traces: REQ-DISCOUNT-025 (a stateless, write-free precheck endpoint) and
 * AC-DISCOUNT-025's HTTP-layer half. AC-DISCOUNT-025's write-free OBSERVATION
 * (10 calls leave `redeemedCount`/`updatedAt`/Order-count untouched) is
 * proven separately by a live-DB integration test
 * (tests/integration/discounts/validate-write-free.test.ts) and by the E3
 * static grep — this file exercises only the HTTP-layer behaviour: request
 * parsing and mapping discount-service's result to a response.
 *
 * Mocked at the SERVICE seam (`discount-service.ts`), not the repository
 * seam `orders/route.test.ts` uses, because this route's entire job is
 * translating `validateCoupon`'s result into an HTTP response — the four
 * rejection branches themselves are already covered by
 * `tests/unit/discounts/discount-service.test.ts` (see that file's header:
 * "the route/HTTP layer itself is M6's job").
 */

const discountService = { validateCoupon: vi.fn() };
vi.mock("@/features/discounts/services/discount-service", () => discountService);

const { POST } = await import("@/app/api/discounts/validate/route");

function submit(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/discounts/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SPEC-DISCOUNT-001 M6a — malformed request (400, no call to validateCoupon)", () => {
  it("400s on unparseable JSON", async () => {
    const response = await submit("{not json");
    expect(response.status).toBe(400);
    expect(discountService.validateCoupon).not.toHaveBeenCalled();
  });

  it("400s with a field error when code is missing", async () => {
    const response = await submit({ itemsSubtotal: 30000 });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.code).toBeDefined();
  });

  it("400s with a field error when code is blank", async () => {
    const response = await submit({ code: "   ", itemsSubtotal: 30000 });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.code).toBeDefined();
  });

  it("400s with a field error when itemsSubtotal is not a number", async () => {
    const response = await submit({ code: "SAVE10", itemsSubtotal: "30000" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.itemsSubtotal).toBeDefined();
  });

  it("never calls validateCoupon on a malformed request", async () => {
    await submit({});
    expect(discountService.validateCoupon).not.toHaveBeenCalled();
  });
});

describe("SPEC-DISCOUNT-001 M6a — a well-formed request (REQ-DISCOUNT-025: no transaction client)", () => {
  it("calls validateCoupon with code, itemsSubtotal, a Date, and nothing else", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: true,
      coupon: {},
      discountAmount: 3000,
    });

    await submit({ code: "SAVE10", itemsSubtotal: 30000 });

    expect(discountService.validateCoupon).toHaveBeenCalledTimes(1);
    const args = discountService.validateCoupon.mock.calls[0]!;
    expect(args[0]).toBe("SAVE10");
    expect(args[1]).toBe(30000);
    expect(args[2]).toBeInstanceOf(Date);
    // No 4th argument (transaction client) — the caller-side half of the
    // write-free guarantee. The callee-side half (this endpoint never touches
    // Coupon.redeemedCount) is proven by the E3 grep and the live-DB
    // integration test.
    expect(args.length).toBe(3);
  });

  it("trims the submitted code before calling validateCoupon", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: true,
      coupon: {},
      discountAmount: 0,
    });

    await submit({ code: "  SAVE10  ", itemsSubtotal: 30000 });

    expect(discountService.validateCoupon.mock.calls[0]![0]).toBe("SAVE10");
  });
});

describe("SPEC-DISCOUNT-001 M6a — success (200)", () => {
  it("returns exactly the discount amount", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: true,
      coupon: {},
      discountAmount: 3000,
    });

    const response = await submit({ code: "SAVE10", itemsSubtotal: 30000 });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ discountAmount: 3000 });
  });
});

describe("SPEC-DISCOUNT-001 M6a — rejection (409)", () => {
  it("maps a not-found rejection", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: false,
      status: 409,
      code: "COUPON_NOT_FOUND",
    });

    const response = await submit({ code: "NOPE", itemsSubtotal: 1000 });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "COUPON_NOT_FOUND" });
  });

  it("maps an expired rejection", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: false,
      status: 409,
      code: "COUPON_EXPIRED",
    });

    const response = await submit({ code: "OLD10", itemsSubtotal: 1000 });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "COUPON_EXPIRED" });
  });

  it("maps a minimum-not-met rejection, carrying requiredMinimum", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: false,
      status: 409,
      code: "COUPON_MINIMUM_NOT_MET",
      requiredMinimum: 30000,
    });

    const response = await submit({ code: "SAVE10", itemsSubtotal: 1000 });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "COUPON_MINIMUM_NOT_MET",
      requiredMinimum: 30000,
    });
  });

  it("maps an exhausted rejection", async () => {
    discountService.validateCoupon.mockResolvedValue({
      ok: false,
      status: 409,
      code: "COUPON_EXHAUSTED",
    });

    const response = await submit({ code: "GONE10", itemsSubtotal: 1000 });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "COUPON_EXHAUSTED" });
  });
});
