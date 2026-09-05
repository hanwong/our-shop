// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { CartDTO } from "@/features/cart/types/cart";

/**
 * SPEC-ORDER-001 M5 — the `/checkout` order form.
 *
 * Traces: AC-ORDER-005 (the cart is already in the server-rendered output, with
 * no browser-side fetch to draw the first screen), AC-ORDER-006 (no cart ->
 * guidance that does not assert something the server cannot know),
 * AC-ORDER-007 (no authentication), AC-ORDER-008 (exactly five inputs),
 * AC-ORDER-021 (the read path reads ONE cookie and makes no identity judgement
 * of its own).
 *
 * `cookies()` is mocked because the render harness has no request. Everything
 * else is real: the page's own branching, the summary's arithmetic, and the
 * form's markup.
 */

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

// The form navigates to the completion screen after a successful submit, and
// `useRouter` throws outside a mounted App Router. Only `push` is exercised
// here; the navigation itself is the completion screen's own test.
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const cartService = { getCart: vi.fn() };
vi.mock("@/features/cart/services/cart-service", () => cartService);

const { cookies } = await import("next/headers");
const { default: CheckoutPage } = await import("@/app/(shop)/checkout/page");

const GUEST = "guest-cookie-value";

/** A cookie jar presenting exactly the named cookies. */
function jarWith(entries: Record<string, string>) {
  return {
    get: (name: string) =>
      name in entries ? { name, value: entries[name]! } : undefined,
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
    quantity: 1,
    lineTotal: 89000,
  },
  {
    id: "i-2",
    productId: "p-2",
    name: "코튼 볼캡",
    price: 25000,
    image: null,
    stock: 9,
    quantity: 2,
    lineTotal: 50000,
  },
]);

/** Every source file on the checkout screens and their components. */
function checkoutSources(roots = ["src/app/(shop)/checkout", "src/components/checkout"]): string[] {
  return roots.flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx") || entry.endsWith(".ts"))
      .map((entry) => readFileSync(join(root, entry), "utf8"))
  );
}

/** Only the FIRST-RENDER path: the server components and the pure summary. */
function firstRenderSources(): string[] {
  return [
    ...readdirSync("src/app/(shop)/checkout", { recursive: true, encoding: "utf8" })
      .filter((e) => e.endsWith(".tsx"))
      .map((e) => readFileSync(join("src/app/(shop)/checkout", e), "utf8")),
    readFileSync("src/components/checkout/OrderSummary.tsx", "utf8"),
  ];
}

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(cookies).mockReset();
  cartService.getCart.mockReset();
});

describe("SPEC-ORDER-001 M5 — the cart arrives already rendered (AC-ORDER-005)", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    cartService.getCart.mockResolvedValue(TWO_ITEMS);
  });

  it("puts every line's name, quantity and unit price in the server output", async () => {
    render(await CheckoutPage());

    expect(screen.getByText("클래식 데님 재킷")).toBeDefined();
    expect(screen.getByText("코튼 볼캡")).toBeDefined();
    // Nothing here waited on a client request — the text is in the tree the
    // server component returned.
    expect(document.body.textContent).toContain("89,000");
    expect(document.body.textContent).toContain("25,000");
  });

  it("shows the items subtotal", async () => {
    render(await CheckoutPage());

    expect(document.body.textContent).toContain("139,000");
  });

  it("looks the cart up under the cookie's guest identity", async () => {
    render(await CheckoutPage());

    expect(cartService.getCart).toHaveBeenCalledWith({ kind: "guest", guestId: GUEST });
  });

  it("loads no data from the browser on the first render (AC-ORDER-005 (b))", () => {
    for (const source of firstRenderSources()) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\buseEffect\b/);
    }
  });

  it("keeps the only fetch inside the form's submit handler", () => {
    const form = readFileSync("src/components/checkout/CheckoutForm.tsx", "utf8");

    // A submit-time fetch is the point of the form; a render-time one would
    // break AC-ORDER-005 (b). useEffect is the shape that would smuggle one in.
    expect(form).not.toMatch(/\buseEffect\b/);
    expect(form).toMatch(/\bfetch\s*\(/);
  });
});

describe("SPEC-ORDER-001 M5 — no cart to show (AC-ORDER-006)", () => {
  const noCartCases: Array<[string, () => void]> = [
    [
      "no guest cookie at all",
      () => {
        vi.mocked(cookies).mockResolvedValue(
          jarWith({}) as unknown as Awaited<ReturnType<typeof cookies>>
        );
      },
    ],
    [
      "a guest cookie whose cart is empty",
      () => {
        vi.mocked(cookies).mockResolvedValue(
          jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
        );
        cartService.getCart.mockResolvedValue(cart([]));
      },
    ],
  ];

  for (const [label, arrange] of noCartCases) {
    it(`renders guidance instead of the form when there is ${label}`, async () => {
      arrange();
      render(await CheckoutPage());

      expect(screen.queryByLabelText(/수령인/)).toBeNull();
      expect(screen.queryByRole("button", { name: /주문/ })).toBeNull();
    });

    it(`does not claim the visitor's cart is empty when there is ${label}`, async () => {
      arrange();
      render(await CheckoutPage());

      // The server cannot tell a first-time visitor from a member whose guest
      // cookie was expired at login (design.md §7.1), so asserting emptiness
      // would be a statement it has no basis for — and false for the member.
      expect(document.body.textContent).not.toMatch(/장바구니가 (비어|비었)/);
    });

    it(`says member checkout is out of scope when there is ${label}`, async () => {
      arrange();
      render(await CheckoutPage());

      // The only way a logged-in member can find out why this screen has
      // nothing for them.
      expect(document.body.textContent).toMatch(/회원/);
    });
  }

  it("does not call the cart service at all when no cookie is presented", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({}) as unknown as Awaited<ReturnType<typeof cookies>>
    );

    render(await CheckoutPage());

    // With no cookie there is no guest id, so there is nothing to look up —
    // this is a tautology, not an inference (design.md §6.1).
    expect(cartService.getCart).not.toHaveBeenCalled();
  });

  it("never tries to issue a guest cookie (AC-ORDER-006 (d))", () => {
    for (const source of checkoutSources()) {
      expect(source).not.toMatch(/buildGuestCartCookie|cookies\(\)\.set|\.cookies\.set/);
    }
  });
});

describe("SPEC-ORDER-001 M5 — the form collects five fields and nothing more (AC-ORDER-008)", () => {
  beforeEach(async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    cartService.getCart.mockResolvedValue(TWO_ITEMS);
    render(await CheckoutPage());
  });

  it("renders exactly the five permitted inputs in the shipping form (AC-ORDER-008)", () => {
    // Scoped to the shipping <form> — SPEC-DISCOUNT-001 M6b added a coupon
    // code input to the page (outside this form, applied via its own button
    // rather than form submission), so a page-wide count would no longer
    // isolate what THIS criterion is actually about: what CheckoutForm
    // collects.
    const form = document.querySelector("form")!;
    const inputs = [
      ...within(form).getAllByRole("textbox"),
      ...form.querySelectorAll("input:not([type='hidden']):not([type='text'])"),
    ];

    expect(inputs).toHaveLength(5);
  });

  it("labels every input, so each is reachable by its name", () => {
    for (const label of [/수령인/, /연락처/, /우편번호/, /주소/, /요청/]) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }
  });

  it("asks for no payment instrument and no email (REQ-ORDER-009)", () => {
    expect(document.body.innerHTML).not.toMatch(/card|cvc|expiry|email|birth/i);
  });
});

describe("SPEC-ORDER-001 M5 — no authentication anywhere (AC-ORDER-007)", () => {
  it("renders the form without redirecting or 404ing", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    cartService.getCart.mockResolvedValue(TWO_ITEMS);

    render(await CheckoutPage());

    expect(screen.getByLabelText(/수령인/)).toBeDefined();
  });

  it("keeps /checkout out of the middleware matcher", () => {
    // src/middleware.ts is a PRESERVE file (plan.md §4). This assertion guards
    // it — a failure here means the invariant was broken, not that the file
    // needs editing.
    expect(readFileSync("src/middleware.ts", "utf8")).not.toContain("/checkout");
  });
});

describe("SPEC-ORDER-001 M5 — the read path makes no identity judgement (AC-ORDER-021)", () => {
  const FORBIDDEN = [
    "verifyAccessToken",
    "resolveCartIdentity",
    "readGuestCartId",
    "getCookieValue",
    "generateGuestCartId",
    "new Request(",
  ];

  it("contains none of the identity-resolution tokens", () => {
    // What the read path does is read one cookie. Token verification, the
    // member/guest precedence rule and id minting are all absent — so there is
    // no second authorization surface to drift from the first (design.md §6.1).
    for (const source of checkoutSources(["src/app/(shop)/checkout"])) {
      for (const token of FORBIDDEN) {
        expect(source).not.toContain(token);
      }
    }
  });

  it("imports the cookie NAME rather than repeating the literal", () => {
    const sources = checkoutSources(["src/app/(shop)/checkout"]);

    // A second copy of the name is a second place for the identity to diverge.
    for (const source of sources) {
      expect(source).not.toContain('"guest_cart_id"');
      expect(source).not.toContain("'guest_cart_id'");
    }
    expect(sources.some((s) => s.includes("GUEST_CART_COOKIE_NAME"))).toBe(true);
  });

  it("has no server-identity adapter file (AC-ORDER-021 (e))", () => {
    // An earlier draft carried one to resolve MEMBER identity in a server
    // component. Member checkout left the scope and the adapter went with it;
    // this assertion is what stops it coming back with the member branch
    // attached (progress.md, iteration 2).
    expect(existsSync("src/features/orders/lib/server-identity.ts")).toBe(false);
  });
});

describe("SPEC-ORDER-002 M3 — the screen informs but never blocks (AC-ORDER-031)", () => {
  /** Every line sold out — the strongest case for the screen to overreach. */
  const ALL_SOLD_OUT = cart([
    {
      id: "i-1",
      productId: "p-1",
      name: "클래식 데님 재킷",
      price: 89000,
      image: null,
      stock: 0,
      quantity: 1,
      lineTotal: 89000,
    },
    {
      id: "i-2",
      productId: "p-2",
      name: "코튼 볼캡",
      price: 25000,
      image: null,
      stock: 0,
      quantity: 2,
      lineTotal: 50000,
    },
  ]);

  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue(
      jarWith({ guest_cart_id: GUEST }) as unknown as Awaited<ReturnType<typeof cookies>>
    );
    cartService.getCart.mockResolvedValue(ALL_SOLD_OUT);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "order-1" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);
  });

  it("marks both lines sold out", async () => {
    render(await CheckoutPage());

    // The premise of the two assertions below: the screen KNOWS the stock is
    // gone. Without this they would pass on a screen that simply never looked.
    expect(screen.getAllByText(/품절/).length).toBeGreaterThanOrEqual(2);
  });

  it("leaves the submit button enabled anyway", async () => {
    render(await CheckoutPage());

    // The stock the screen read is a render-time figure; a restock between
    // render and submit would leave a shopper blocked from an order that would
    // now succeed. The transaction is the only authority on availability
    // (REQ-ORDER-029) — the screen advises, it does not adjudicate.
    expect(screen.getByRole("button", { name: /주문하기/ })).not.toHaveProperty("disabled", true);
  });

  it("actually issues the order request when submitted", async () => {
    render(await CheckoutPage());

    fireEvent.change(screen.getByLabelText(/수령인/), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText(/연락처/), { target: { value: "010-1234-5678" } });
    fireEvent.change(screen.getByLabelText(/우편번호/), { target: { value: "06236" } });
    fireEvent.change(screen.getByLabelText(/^주소/), { target: { value: "서울시 강남구" } });
    fireEvent.click(screen.getByRole("button", { name: /주문하기/ }));

    // Not merely "the button was clickable" — the request left the screen. A
    // guard that silently swallowed the submit would satisfy the assertion
    // above while still blocking the shopper.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/orders", expect.anything()));
  });
});
