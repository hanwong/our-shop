// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-ORDER-001 M5 — CheckoutForm's submit behaviour.
 *
 * The page test covers what the form RENDERS (AC-ORDER-008's five inputs, the
 * absence of any payment field). This file covers what it DOES on submit: the
 * request body it builds, and how each of design.md §8's refusals reaches the
 * shopper.
 *
 * That second half matters beyond coverage. The form is where a refusal becomes
 * something a person can act on, and a 409 that produced a blank screen would
 * satisfy every server-side criterion while leaving the shopper stuck.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { CheckoutForm } = await import("@/components/checkout/CheckoutForm");

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRequired() {
  fill(/수령인/, "홍길동");
  fill(/연락처/, "010-1234-5678");
  fill(/우편번호/, "06236");
  fill(/^주소/, "서울시 강남구 테헤란로 1");
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /주문하기/ }));
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  render(<CheckoutForm idempotencyKey="key-1" confirmedTotal={139000} />);
});

describe("SPEC-ORDER-001 — what the form submits", () => {
  it("sends the five fields, the server's key, and the total the shopper saw", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "order-1" }));
    fillRequired();
    fill(/요청/, "부재 시 경비실");
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/orders");
    expect(JSON.parse(init.body as string)).toEqual({
      shipping: {
        recipientName: "홍길동",
        recipientPhone: "010-1234-5678",
        postalCode: "06236",
        address: "서울시 강남구 테헤란로 1",
        deliveryMemo: "부재 시 경비실",
      },
      // Server-minted, echoed back untouched (design.md §5).
      idempotencyKey: "key-1",
      // The figure the summary displayed, for the server to check its own
      // recomputation against (design.md §4).
      confirmedTotal: 139000,
    });
  });

  it("sends null rather than an empty string for an omitted memo", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "order-1" }));
    fillRequired();
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    // "" and null both mean "no memo", but only one of them is what the column
    // stores; normalising here keeps the distinction out of the domain.
    expect(body.shipping.deliveryMemo).toBeNull();
  });

  it("navigates to the completion screen for the created order", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "order-42" }));
    fillRequired();
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout/complete/order-42"));
  });
});

describe("SPEC-ORDER-001 — how a refusal reaches the shopper (design.md §8)", () => {
  it("attaches a field error to the input it belongs to", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: "배송 정보를 다시 확인해 주세요",
        fieldErrors: { recipientName: "필수 항목입니다" },
      })
    );
    fillRequired();
    submit();

    const message = await screen.findByText("필수 항목입니다");
    const input = screen.getByLabelText(/수령인/);

    // Tied programmatically, not merely placed nearby, so a screen reader
    // announces the two together (design.md §7 accessibility).
    expect(input.getAttribute("aria-describedby")).toBe(message.id);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("surfaces the NEW total when the price changed under the shopper", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: "가격이 변경되었습니다",
        code: "PRICE_CHANGED",
        totalAmount: 158000,
      })
    );
    fillRequired();
    submit();

    // The one refusal the shopper can act on immediately, so the figure is put
    // on screen rather than left in the response body.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("158,000");
  });

  it("shows the server's message for a refusal it has no special handling for", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { error: "재고가 부족한 상품이 있습니다", code: "INSUFFICIENT_STOCK" })
    );
    fillRequired();
    submit();

    await expect(screen.findByRole("alert")).resolves.toHaveProperty(
      "textContent",
      "재고가 부족한 상품이 있습니다"
    );
  });

  it("says something useful when the request never reaches the server", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    fillRequired();
    submit();

    // A rejected fetch must not leave the button spinning with no explanation.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/다시 시도/);
  });

  it("re-enables the button after a refusal so the shopper can retry", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: "장바구니가 비어 있습니다" }));
    fillRequired();
    submit();

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /주문하기/ })).not.toHaveProperty("disabled", true);
  });

  it("issues nothing on a second click while the first submission is in flight", async () => {
    let release: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );
    fillRequired();

    const button = screen.getByRole("button");
    fireEvent.click(button);
    // The button is disabled and relabelled while in flight, and the handler
    // also returns early — either alone would do; both is cheap.
    expect(button).toHaveProperty("disabled", true);
    expect(button.textContent).toMatch(/처리 중/);

    fireEvent.click(button);

    // The idempotency key would make a duplicate DELIVERY harmless, but not
    // issuing one at all is better than relying on that.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    release(jsonResponse(201, { id: "order-1" }));
  });
});
