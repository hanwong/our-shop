// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-ORDER-003 M2 — `/orders/lookup` (REQ-ORDER-042, AC-ORDER-046).
 *
 * This page reads no cookie and no auth state at all — the whole reason it is
 * reachable without login is that there is no gate to bypass, not that a gate
 * is bypassed. The test below renders the page with nothing injected (no
 * cookies mock, no auth mock) precisely to demonstrate that.
 */

const { default: OrderLookupPage } = await import("@/app/(shop)/orders/lookup/page");

afterEach(cleanup);

describe("SPEC-ORDER-003 M2 — the lookup input screen opens with no auth (AC-ORDER-046)", () => {
  it("renders an order number input and a recipient phone input with nothing injected", () => {
    render(<OrderLookupPage />);

    expect(screen.getByLabelText("주문 번호")).toBeDefined();
    expect(screen.getByLabelText("연락처")).toBeDefined();
  });
});
