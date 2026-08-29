import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * SPEC-CART-001 M2 — src/lib/auth/guest-identity.ts
 *
 * Traces: REQ-CART-004 / AC-CART-004 (the guest cookie is httpOnly, carries a
 * cryptographically random opaque value, and has a name and lifetime distinct
 * from every SPEC-AUTH-001 cookie), plan.md §2.2.
 *
 * Also covers getCookieValue(), the request-cookie reader relocated here from
 * google/callback/route.ts so both auth success routes can share one parser
 * (plan.md §6 step 1).
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.GUEST_CART_COOKIE_EXPIRY;
  delete process.env.COOKIE_DOMAIN;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function requestWithCookies(cookieHeader: string | null): Request {
  return new Request("http://localhost/api/cart", {
    method: "GET",
    ...(cookieHeader === null ? {} : { headers: { cookie: cookieHeader } }),
  });
}

describe("SPEC-CART-001 M2 — guest cookie name (REQ-CART-004 / AC-CART-004)", () => {
  it("is 'guest_cart_id' and collides with no SPEC-AUTH-001 cookie name", async () => {
    const { GUEST_CART_COOKIE_NAME } = await import("@/lib/auth/guest-identity");

    expect(GUEST_CART_COOKIE_NAME).toBe("guest_cart_id");
    expect(["refresh_token", "csrf_token", "oauth_state"]).not.toContain(GUEST_CART_COOKIE_NAME);
  });
});

describe("SPEC-CART-001 M2 — guest id generation (REQ-CART-004)", () => {
  it("returns a base64url string carrying 32 bytes of entropy", async () => {
    const { generateGuestCartId } = await import("@/lib/auth/guest-identity");

    const id = generateGuestCartId();

    // 32 raw bytes -> 43 base64url characters (no padding).
    expect(id).toHaveLength(43);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats a value across calls", async () => {
    const { generateGuestCartId } = await import("@/lib/auth/guest-identity");

    const ids = new Set(Array.from({ length: 200 }, () => generateGuestCartId()));

    expect(ids.size).toBe(200);
  });
});

describe("SPEC-CART-001 M2 — guest cookie attributes (AC-CART-004)", () => {
  it("is httpOnly with a 14-day default lifetime, distinct from the 30-day refresh token", async () => {
    const { buildGuestCartCookie } = await import("@/lib/auth/guest-identity");

    const cookie = buildGuestCartCookie("guest-abc");

    expect(cookie.name).toBe("guest_cart_id");
    expect(cookie.value).toBe("guest-abc");
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.path).toBe("/");
    expect(cookie.options.maxAge).toBe(14 * 24 * 60 * 60);
    // The independence AC-CART-004 asks about: not the refresh token's 30 days.
    expect(cookie.options.maxAge).not.toBe(30 * 24 * 60 * 60);
  });

  it("honours GUEST_CART_COOKIE_EXPIRY in the same <N>d/h/m form the JWT vars use", async () => {
    process.env.GUEST_CART_COOKIE_EXPIRY = "3d";
    const { buildGuestCartCookie } = await import("@/lib/auth/guest-identity");

    expect(buildGuestCartCookie("g").options.maxAge).toBe(3 * 24 * 60 * 60);
  });

  it("accepts hours and minutes as well as days", async () => {
    process.env.GUEST_CART_COOKIE_EXPIRY = "6h";
    const mod = await import("@/lib/auth/guest-identity");
    expect(mod.buildGuestCartCookie("g").options.maxAge).toBe(6 * 60 * 60);

    process.env.GUEST_CART_COOKIE_EXPIRY = "90m";
    expect(mod.buildGuestCartCookie("g").options.maxAge).toBe(90 * 60);
  });

  it("falls back to the default rather than throwing on an unparseable expiry", async () => {
    process.env.GUEST_CART_COOKIE_EXPIRY = "not-a-duration";
    const { buildGuestCartCookie } = await import("@/lib/auth/guest-identity");

    // A misconfigured env var must not turn every cart request into a 500 —
    // the cookie is not a security boundary, so degrading to the default is
    // strictly better than failing the request.
    expect(buildGuestCartCookie("g").options.maxAge).toBe(14 * 24 * 60 * 60);
  });

  it("sets Secure outside development and clears it in development", async () => {
    process.env.NODE_ENV = "production";
    const prod = await import("@/lib/auth/guest-identity");
    expect(prod.buildGuestCartCookie("g").options.secure).toBe(true);

    process.env.NODE_ENV = "development";
    expect(prod.buildGuestCartCookie("g").options.secure).toBe(false);
  });
});

describe("SPEC-CART-001 M2 — expiring the guest cookie (plan.md §6 step 3)", () => {
  it("builds a same-named, empty, immediately-expired cookie", async () => {
    const { buildExpiredGuestCartCookie } = await import("@/lib/auth/guest-identity");

    const cookie = buildExpiredGuestCartCookie();

    expect(cookie.name).toBe("guest_cart_id");
    expect(cookie.value).toBe("");
    expect(cookie.options.maxAge).toBe(0);
    expect(cookie.options.httpOnly).toBe(true);
  });
});

describe("SPEC-CART-001 M2 — getCookieValue (relocated from google/callback/route.ts)", () => {
  it("returns null when the request carries no Cookie header at all", async () => {
    const { getCookieValue } = await import("@/lib/auth/guest-identity");

    expect(getCookieValue(requestWithCookies(null), "guest_cart_id")).toBeNull();
  });

  it("reads a named cookie from a multi-cookie header regardless of position", async () => {
    const { getCookieValue } = await import("@/lib/auth/guest-identity");
    const request = requestWithCookies("oauth_state=abc; guest_cart_id=xyz; csrf_token=def");

    expect(getCookieValue(request, "oauth_state")).toBe("abc");
    expect(getCookieValue(request, "guest_cart_id")).toBe("xyz");
    expect(getCookieValue(request, "csrf_token")).toBe("def");
  });

  it("returns null for a name the header does not carry", async () => {
    const { getCookieValue } = await import("@/lib/auth/guest-identity");

    expect(getCookieValue(requestWithCookies("a=1; b=2"), "guest_cart_id")).toBeNull();
  });

  it("percent-decodes the value and tolerates a malformed segment", async () => {
    const { getCookieValue } = await import("@/lib/auth/guest-identity");

    expect(getCookieValue(requestWithCookies("x=a%20b"), "x")).toBe("a b");
    // A segment with no '=' is skipped rather than throwing.
    expect(getCookieValue(requestWithCookies("bare; x=1"), "x")).toBe("1");
  });

  it("matches the exact name, not a prefix of a longer cookie name", async () => {
    const { getCookieValue } = await import("@/lib/auth/guest-identity");

    expect(getCookieValue(requestWithCookies("guest_cart_id_old=stale"), "guest_cart_id")).toBeNull();
  });
});

describe("SPEC-CART-001 M2 — readGuestCartId", () => {
  it("reads the guest id straight off the request, or null when absent", async () => {
    const { readGuestCartId } = await import("@/lib/auth/guest-identity");

    expect(readGuestCartId(requestWithCookies("guest_cart_id=g-1"))).toBe("g-1");
    expect(readGuestCartId(requestWithCookies("csrf_token=t"))).toBeNull();
    expect(readGuestCartId(requestWithCookies(null))).toBeNull();
  });
});
