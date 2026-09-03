import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ORDER-003 M2 — POST /api/orders/lookup.
 *
 * Traces: AC-ORDER-042 (a matching submission returns the full snapshot),
 * AC-ORDER-047 (a format failure returns per-field errors and never queries),
 * AC-ORDER-039 (a nonexistent order number and a wrong-phone match answer
 * with the SAME status and body).
 *
 * Mocked at the SERVICE seam, not the repository seam: lookupOrderByNumberAndPhone()
 * already owns validation, the indistinguishable-failure guarantee, and the
 * exactly-once repository call (tests/unit/orders/order-service.test.ts). This
 * route's own job is only to forward the service's result into an HTTP
 * response — the thing worth testing here is that forwarding, not the domain
 * rule underneath it.
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
