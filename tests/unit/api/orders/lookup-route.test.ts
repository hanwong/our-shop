import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { __resetRateLimitStoreForTests } from "@/lib/auth/rate-limit";

/**
 * SPEC-ORDER-003 M2/M3 — POST /api/orders/lookup.
 *
 * Traces: AC-ORDER-042 (a matching submission returns the full snapshot),
 * AC-ORDER-047 (a format failure returns per-field errors and never queries),
 * AC-ORDER-039 (a nonexistent order number and a wrong-phone match answer
 * with the SAME status and body), AC-ORDER-041 (M3 — repeated failures from
 * one origin are rate-limited and stop reaching the repository), AC-ORDER-043
 * (M3 — the response body never carries an internal identifier or secret).
 *
 * Mocked at the SERVICE seam, not the repository seam: lookupOrderByNumberAndPhone()
 * already owns validation, the indistinguishable-failure guarantee, and the
 * exactly-once repository call (tests/unit/orders/order-service.test.ts). This
 * route's own job is only to forward the service's result into an HTTP
 * response — the thing worth testing here is that forwarding, not the domain
 * rule underneath it. The rate limiter (src/lib/auth/rate-limit.ts) and the
 * redaction the route applies before responding are both this file's own job,
 * so those two AC blocks below exercise the REAL route logic (the service
 * mock only supplies its input).
 */

const service = {
  lookupOrderByNumberAndPhone: vi.fn(),
};
vi.mock("@/features/orders/services/order-service", () => service);

const { POST } = await import("@/app/api/orders/lookup/route");

function submit(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/orders/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

const ORDER = {
  id: "order-1",
  orderNumber: "ORD-20260903-0AB123",
  status: "pending_payment" as const,
  items: [],
  itemsSubtotal: 20000,
  shippingFee: 0,
  totalAmount: 20000,
  couponCode: null,
  discountAmount: 0,
  shipping: {
    recipientName: "홍길동",
    recipientPhone: "010-1234-5678",
    postalCode: "06236",
    address: "서울시 강남구 테헤란로 1",
    deliveryMemo: null,
  },
  createdAt: "2026-09-03T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SPEC-ORDER-003 M2 — a matching submission returns the order (AC-ORDER-042)", () => {
  it("answers 200 with the order body when the service reports success", async () => {
    service.lookupOrderByNumberAndPhone.mockResolvedValue({ ok: true, data: ORDER });

    const response = await submit({
      orderNumber: "ORD-20260903-0AB123",
      recipientPhone: "010-1234-5678",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ orderNumber: "ORD-20260903-0AB123" });
    expect(service.lookupOrderByNumberAndPhone).toHaveBeenCalledWith({
      orderNumber: "ORD-20260903-0AB123",
      recipientPhone: "010-1234-5678",
    });
  });
});

describe("SPEC-ORDER-003 M2 — a format failure answers 400 with per-field errors (AC-ORDER-047)", () => {
  it("forwards the service's fieldErrors verbatim", async () => {
    service.lookupOrderByNumberAndPhone.mockResolvedValue({
      ok: false,
      status: 400,
      error: "입력값을 다시 확인해 주세요",
      fieldErrors: { orderNumber: "필수 입력값입니다", recipientPhone: "연락처 형식이 올바르지 않습니다" },
    });

    const response = await submit({ orderNumber: "", recipientPhone: "not-a-phone" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      fieldErrors: {
        orderNumber: "필수 입력값입니다",
        recipientPhone: "연락처 형식이 올바르지 않습니다",
      },
    });
  });

  it("never sends an `ok` or `status` discriminant field in the response body", async () => {
    // Those two fields exist to route THIS handler's own branching — leaking
    // them into the body would be an internal implementation detail, and the
    // create-order route (src/app/api/orders/route.ts) already sets the
    // precedent of stripping them before responding.
    service.lookupOrderByNumberAndPhone.mockResolvedValue({
      ok: false,
      status: 400,
      error: "입력값을 다시 확인해 주세요",
      fieldErrors: { orderNumber: "필수 입력값입니다" },
    });

    const response = await submit({ orderNumber: "", recipientPhone: "010-1234-5678" });
    const bodyJson = await response.json();

    expect(bodyJson).not.toHaveProperty("ok");
    expect(bodyJson).not.toHaveProperty("status");
  });
});

describe("SPEC-ORDER-003 M2 — not-found and mismatch both answer 404 with the SAME generic body (AC-ORDER-039)", () => {
  it("forwards the service's 404 status and generic error message unchanged", async () => {
    service.lookupOrderByNumberAndPhone.mockResolvedValue({
      ok: false,
      status: 404,
      error: "주문 번호 또는 연락처가 일치하지 않습니다",
      code: "NOT_FOUND",
    });

    const response = await submit({
      orderNumber: "ORD-20260903-999999",
      recipientPhone: "010-1234-5678",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "주문 번호 또는 연락처가 일치하지 않습니다",
      code: "NOT_FOUND",
    });
  });
});

describe("SPEC-ORDER-003 M2 — a malformed request body never reaches the service", () => {
  it("answers 400 on unparseable JSON without calling the service", async () => {
    const response = await submit("not-json{{{");

    expect(response.status).toBe(400);
    expect(service.lookupOrderByNumberAndPhone).not.toHaveBeenCalled();
  });
});

/**
 * SPEC-ORDER-003 M3 — AC-ORDER-041 (REQ-ORDER-037).
 *
 * §0's AC-041-EXCL-RATELIMIT fixes the numbers this test asserts: 5 requests
 * per 60-second window per origin (IP), then 429 with a 15-minute lockout.
 * The limiter itself (checkIpRateLimit / checkRateLimit) is
 * SPEC-AUTH-001/REQ-AUTH-021 infrastructure, already covered by its own
 * baseline suite (tests/unit/lib/auth/rate-limit.test.ts) — this block only
 * asserts that the route WIRES it in, at the top of the handler, before any
 * repository call.
 */
function submitFrom(ip: string, body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/orders/lookup", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

const RATE_LIMIT_LOOKUP_BODY = { orderNumber: "ORD-20260903-0AB123", recipientPhone: "010-0000-0000" };

describe("SPEC-ORDER-003 M3 — repeated failures from one origin are rate-limited (AC-ORDER-041)", () => {
  beforeEach(() => {
    __resetRateLimitStoreForTests();
  });

  afterEach(() => {
    __resetRateLimitStoreForTests();
  });

  it("answers 429 on the 6th request within the window and calls the repository ZERO times on it", async () => {
    service.lookupOrderByNumberAndPhone.mockResolvedValue({
      ok: false,
      status: 404,
      error: "주문 번호 또는 연락처가 일치하지 않습니다",
      code: "NOT_FOUND",
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await submitFrom("203.0.113.50", RATE_LIMIT_LOOKUP_BODY);
      expect(response.status).not.toBe(429);
    }
    expect(service.lookupOrderByNumberAndPhone).toHaveBeenCalledTimes(5);

    service.lookupOrderByNumberAndPhone.mockClear();
    const sixth = await submitFrom("203.0.113.50", RATE_LIMIT_LOOKUP_BODY);

    expect(sixth.status).toBe(429);
    expect(service.lookupOrderByNumberAndPhone).not.toHaveBeenCalled();
  });

  it("keeps a different origin's quota untouched by another origin's lockout", async () => {
    service.lookupOrderByNumberAndPhone.mockResolvedValue({
      ok: false,
      status: 404,
      error: "주문 번호 또는 연락처가 일치하지 않습니다",
      code: "NOT_FOUND",
    });

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await submitFrom("203.0.113.60", RATE_LIMIT_LOOKUP_BODY);
    }
    service.lookupOrderByNumberAndPhone.mockClear();

    const fromAnotherOrigin = await submitFrom("203.0.113.61", RATE_LIMIT_LOOKUP_BODY);

    expect(fromAnotherOrigin.status).not.toBe(429);
    expect(service.lookupOrderByNumberAndPhone).toHaveBeenCalledTimes(1);
  });
});

/**
 * SPEC-ORDER-003 M3 — AC-ORDER-043 (REQ-ORDER-039), the dynamic half.
 *
 * M2 already covers the STATIC half — OrderDTO's declared type carries no
 * paymentKey / idempotencyKey / guestId field, so a well-typed caller cannot
 * reference one. This is the RUNTIME half: an actual string search over the
 * real serialized response body, so a value that leaked past the type system
 * (or a shape the mocked service was never meant to return in the first
 * place) would still be caught. `id` is the one field OrderDTO's type DOES
 * declare (checkout/complete/[orderId]/page.tsx needs it there) that this
 * guest-facing screen must not — the route strips it, and the other three are
 * asserted for defense-in-depth in case the service layer ever regresses.
 */
describe("SPEC-ORDER-003 M3 — the response body never carries an internal identifier or secret (AC-ORDER-043)", () => {
  it("never serializes paymentKey, idempotencyKey, guestId, or a bare internal id", async () => {
    service.lookupOrderByNumberAndPhone.mockResolvedValue({
      ok: true,
      data: {
        id: "order-1",
        orderNumber: "ORD-20260903-0AB123",
        status: "pending_payment",
        items: [],
        itemsSubtotal: 20000,
        shippingFee: 0,
        totalAmount: 20000,
        couponCode: null,
        discountAmount: 0,
        shipping: {
          recipientName: "홍길동",
          recipientPhone: "010-1234-5678",
          postalCode: "06236",
          address: "서울시 강남구 테헤란로 1",
          deliveryMemo: null,
        },
        createdAt: "2026-09-03T00:00:00.000Z",
        // Defense-in-depth: even if the service ever leaked these secrets, the
        // route's own response-shaping must strip them before they serialize.
        paymentKey: "pk_live_super_secret",
        idempotencyKey: "idem-key-super-secret",
        guestId: "guest-super-secret",
      },
    });

    const response = await submit({
      orderNumber: "ORD-20260903-0AB123",
      recipientPhone: "010-1234-5678",
    });
    const bodyJson = await response.json();
    const bodyText = JSON.stringify(bodyJson);

    expect(bodyText).not.toMatch(/paymentKey/);
    expect(bodyText).not.toMatch(/idempotencyKey/);
    expect(bodyText).not.toMatch(/guestId/);
    expect(bodyText).not.toMatch(/"id":/);
    // The forwarding itself must still work — this is a redaction test, not a
    // "drop everything" test.
    expect(bodyJson).toMatchObject({ orderNumber: "ORD-20260903-0AB123" });
  });
});
