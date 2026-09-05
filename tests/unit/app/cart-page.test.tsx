// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { CartDTO } from "@/features/cart/types/cart";

/**
 * SPEC-STOREFRONT-002 M1/M3 — src/app/cart/page.tsx.
 *
 * Traces: AC-STOREFRONT-016 (the cart is already in the server-rendered
 * output, no browser-side fetch draws the first screen), AC-STOREFRONT-017
 * (no cookie / empty cart -> guidance screen), AC-STOREFRONT-018 (per-item
 * fields + subtotal), AC-STOREFRONT-023 (M3 — the static scope boundary).
 *
 * "cookies()" is mocked because the render harness has no request — the
 * same pattern tests/unit/app/checkout-page.test.tsx already uses.
 */

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const cartService = { getCart: vi.fn() };
vi.mock("@/features/cart/services/cart-service", () => cartService);

const { cookies } = await import("next/headers");
const { default: CartPage } = await import("@/app/(shop)/cart/page");

const GUEST = "guest-cookie-value";

function jarWith(entries: Record<string, string>) {
  return {
    get: (name: string) => (name in entries ? { name, value: entries[name]! } : undefined),
  };
}

function cart(items: CartDTO["items"]): CartDTO {
  return {
    items,
    subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

const TWO_ITEMS = cart([
  {
    id: "i-1",
    productId: "p-1",
    name: "클래식 데님 재킷",
    price: 89000,
    image: null,
    stock: 5,
    quantity: 2,
    lineTotal: 178000,
  },
  {
    id: "i-2",
    productId: "p-2",
    name: "코튼 볼캡",
    price: 25000,
    image: "https://picsum.photos/seed/a/600/600",
    stock: 9,
    quantity: 1,
    lineTotal: 25000,
  },
]);

/** Every source file under this SPEC's own cart route and components. */
function cartSources(): string[] {
  const roots = ["src/app/(shop)/cart", "src/components/cart"];
  return roots.flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx"))
      .map((entry) => readFileSync(join(root, entry), "utf8"))
  );
}

/**
 * Only the FIRST-RENDER path: the server route component and the pure
 * empty-state screen — matching checkout-page.test.tsx's
 * firstRenderSources() helper. CartView.tsx is deliberately EXCLUDED: it is
 * a client component that legitimately calls fetch() from its quantity/
 * delete handlers (M2/M3), and those are user-triggered, not part of the
 * initial render this check is about.
 */
function firstRenderSources(): string[] {
  return [
    ...readdirSync("src/app/(shop)/cart", { recursive: true, encoding: "utf8" })
      .filter((e) => e.endsWith(".tsx"))
      .map((e) => readFileSync(join("src/app/(shop)/cart", e), "utf8")),
    readFileSync("src/components/cart/EmptyCart.tsx", "utf8"),
  ];
}

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(cookies).mockReset();
  cartService.getCart.mockReset();
});

describe("CartPage — AC-STOREFRONT-016 / 018", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    cartService.getCart.mockResolvedValue(TWO_ITEMS);
  });

  it("puts every line's name, quantity, unit price, and line total in the server output", async () => {
    render(await CartPage());

    expect(screen.getByText("클래식 데님 재킷")).toBeDefined();
    expect(screen.getByText("코튼 볼캡")).toBeDefined();
    expect(document.body.textContent).toContain("89,000");
    expect(document.body.textContent).toContain("178,000");
    expect(document.body.textContent).toContain("25,000");
  });

  it("shows the overall subtotal", async () => {
    render(await CartPage());

    expect(document.body.textContent).toContain("203,000");
  });

  it("looks the cart up under the cookie's guest identity", async () => {
    render(await CartPage());

    expect(cartService.getCart).toHaveBeenCalledWith({ kind: "guest", guestId: GUEST });
  });

  it("shows an alt-text image for a line that has one", async () => {
    render(await CartPage());

    expect(screen.getByAltText("코튼 볼캡")).toBeDefined();
  });

  it("loads no data from the browser on the initial render", () => {
    for (const source of firstRenderSources()) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\buseEffect\b/);
    }
  });

  it("keeps fetch calls confined to CartView's own event handlers", () => {
    const cartView = readFileSync("src/components/cart/CartView.tsx", "utf8");

    // A submit/click-time fetch is the point of CartView's interactions; a
    // render-time one (useEffect) would break AC-STOREFRONT-016(b).
    expect(cartView).not.toMatch(/\buseEffect\b/);
    expect(cartView).toMatch(/\bfetch\s*\(/);
  });
});

describe("CartPage — AC-STOREFRONT-017", () => {
  it("shows guidance instead of the item list when there is no guest cookie", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({}) as unknown as Awaited<ReturnType<typeof cookies>>
    );

    render(await CartPage());

    expect(screen.getByText(/장바구니가 비어 있습니다/)).toBeDefined();
    expect(cartService.getCart).not.toHaveBeenCalled();
  });

  it("shows guidance instead of the item list when the cart has zero items", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    cartService.getCart.mockResolvedValue(cart([]));

    render(await CartPage());

    expect(screen.getByText(/장바구니가 비어 있습니다/)).toBeDefined();
  });
});

describe("CartPage / CartView — AC-STOREFRONT-023 static boundary", () => {
  it("contains no shipping/payment input fields or any /api/orders call", () => {
    for (const source of cartSources()) {
      expect(source).not.toMatch(/postalCode|recipientName|recipientPhone|cardNumber|expiryDate/i);
      expect(source).not.toMatch(/\/api\/orders/);
    }
  });
});
