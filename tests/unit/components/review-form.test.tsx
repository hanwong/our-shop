// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * SPEC-REVIEW-001 M4 — src/components/product/ReviewForm.tsx.
 *
 * Traces: AC-REVIEW-010 (rendered instead of the login prompt when logged
 * in). Modelled on AddToCartButton.tsx's own test (the same client-island
 * fetch/loading/error idiom); success re-reads the server list via
 * `router.refresh()` rather than a local optimistic update, so there is no
 * "success text" state to assert here — that IS the point of plan.md M4.
 */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { ReviewForm } = await import("@/components/product/ReviewForm");

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("ReviewForm", () => {
  it("renders a rating select and a body textarea with a submit button", () => {
    render(<ReviewForm productId="p-1" />);

    expect(screen.getByLabelText("평점")).toBeDefined();
    expect(screen.getByLabelText("리뷰 내용")).toBeDefined();
    expect(screen.getByRole("button", { name: /등록/ })).toBeDefined();
  });

  it("submits productId, rating, and body to POST /api/reviews, then refreshes on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "rev-1" }));
    render(<ReviewForm productId="p-1" />);

    fireEvent.change(screen.getByLabelText("평점"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("리뷰 내용"), { target: { value: "좋아요" } });
    fireEvent.click(screen.getByRole("button", { name: /등록/ }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reviews",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ productId: "p-1", rating: 4, body: "좋아요" }),
      })
    );
  });

  it("shows the rejection reason without refreshing", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: "이미 이 상품에 리뷰를 작성했습니다" }));
    render(<ReviewForm productId="p-1" />);

    fireEvent.change(screen.getByLabelText("리뷰 내용"), { target: { value: "또 씀" } });
    fireEvent.click(screen.getByRole("button", { name: /등록/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("이미 이 상품에 리뷰를 작성했습니다")
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a generic message on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<ReviewForm productId="p-1" />);

    fireEvent.change(screen.getByLabelText("리뷰 내용"), { target: { value: "네트워크 테스트" } });
    fireEvent.click(screen.getByRole("button", { name: /등록/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(refresh).not.toHaveBeenCalled();
  });
});
