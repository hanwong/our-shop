// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-STOREFRONT-002 M1 — src/components/cart/EmptyCart.tsx.
 *
 * Traces: REQ-STOREFRONT-017 (guidance screen + a link back to browsing),
 * AC-STOREFRONT-017.
 *
 * The link target is "/" rather than a literal "/products" listing route:
 * this repository has no product-list page (only "/" and the dynamic
 * "/products/[productId]" detail route exist — confirmed by reading
 * src/app at run-phase start), so "/" is the actual browsing entry point
 * SPEC-STOREFRONT-001 built for this purpose.
 */

const { EmptyCart } = await import("@/components/cart/EmptyCart");

afterEach(cleanup);

describe("EmptyCart — AC-STOREFRONT-017", () => {
  it("shows guidance text and a link back to browsing products", () => {
    render(<EmptyCart />);

    expect(screen.getByText(/장바구니가 비어 있습니다/)).toBeDefined();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders no quantity-manipulation control", () => {
    render(<EmptyCart />);

    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
