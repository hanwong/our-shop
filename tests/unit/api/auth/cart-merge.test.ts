import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * SPEC-CART-001 M5 — the guest->member cart merge hook on the two login
 * success paths.
 *
 * Traces: REQ-CART-011 (a successful login merges the guest cart, by either
 * credential path), REQ-CART-013 / plan.md §6 step 3 (the spent guest cookie
 * is expired on the response).
 *
 * This file is NEW rather than an edit to login.test.ts / google-callback.test.ts:
 * those suites are SPEC-AUTH-001's regression evidence, and leaving them
 * untouched is what lets "132 auth tests still pass, unmodified" mean
 * something. The mocking here deliberately mirrors theirs.
 *
 * The merge itself is mocked at the SERVICE seam: what M5 must prove is that
 * the hook is invoked with the right arguments at the right moment and that
 * the login response is otherwise unchanged. Merge BEHAVIOUR is already
 * covered by tests/unit/cart/cart-service.test.ts.
 */

const mergeGuestCartIntoUserCart = vi.fn();

vi.mock("@/features/cart/services/cart-service", () => ({
  mergeGuestCartIntoUserCart: (...args: unknown[]) => mergeGuestCartIntoUserCart(...args),
}));

interface FakeUserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  role: "customer" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

let users: FakeUserRow[] = [];
let oauthAccounts: Array<{ id: string; userId: string; provider: string; providerAccountId: string }> = [];

const { verifyIdTokenMock, getTokenMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
  getTokenMock: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: vi.fn(),
    getToken: getTokenMock,
    verifyIdToken: verifyIdTokenMock,
  })),
}));

vi.mock("@/lib/auth/password", () => ({
  comparePassword: vi.fn(async () => true),
  dummyCompare: vi.fn(async () => undefined),
  hashPassword: vi.fn(async () => "hashed"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id !== undefined) return users.find((u) => u.id === where.id) ?? null;
        if (where.email !== undefined) return users.find((u) => u.email === where.email) ?? null;
        return null;
      }),
      create: vi.fn(async () => users[0]!),
      update: vi.fn(async () => users[0]!),
    },
    oAuthAccount: {
      findUnique: vi.fn(async ({ where }: { where: { provider_providerAccountId: { provider: string; providerAccountId: string } } }) => {
        const key = where.provider_providerAccountId;
        return (
          oauthAccounts.find(
            (a) => a.provider === key.provider && a.providerAccountId === key.providerAccountId
          ) ?? null
        );
      }),
      create: vi.fn(async () => oauthAccounts[0]!),
    },
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "rt-1", ...data })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: unknown) => {
      if (typeof fn === "function") {
        return (fn as (tx: unknown) => unknown)({
          user: { create: vi.fn(), update: vi.fn() },
          oAuthAccount: { create: vi.fn() },
          refreshToken: { updateMany: vi.fn() },
        });
      }
      return undefined;
    }),
  },
}));

beforeEach(async () => {
  mergeGuestCartIntoUserCart.mockReset().mockResolvedValue(undefined);
  users = [
    {
      id: "user-1",
      email: "shopper@example.com",
      passwordHash: "hashed",
      emailVerified: true,
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  oauthAccounts = [
    { id: "oa-1", userId: "user-1", provider: "google", providerAccountId: "google-sub-1" },
  ];
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost/api/auth/google/callback";
  process.env.NODE_ENV = "test";
  getTokenMock.mockResolvedValue({ tokens: { id_token: "id-token" } });
  verifyIdTokenMock.mockResolvedValue({
    getPayload: () => ({
      sub: "google-sub-1",
      email: "shopper@example.com",
      email_verified: true,
      aud: "client-id",
      iss: "https://accounts.google.com",
    }),
  });
  const { __resetRateLimitStoreForTests } = await import("@/lib/auth/rate-limit");
  __resetRateLimitStoreForTests();
});

function loginRequest(cookie?: string): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ email: "shopper@example.com", password: "correct-horse" }),
  });
}

function callbackRequest(extraCookie?: string): Request {
  const cookie = ["oauth_state=state-1", extraCookie].filter(Boolean).join("; ");
  return new Request("http://localhost/api/auth/google/callback?code=abc&state=state-1", {
    method: "GET",
    headers: {
      cookie,
      "x-forwarded-for": `10.0.1.${Math.floor(Math.random() * 250) + 1}`,
    },
  });
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M5 — login merges the guest cart (REQ-CART-011)", () => {
  it("calls the merge with the authenticated user id and the cookie's guest id", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(loginRequest("guest_cart_id=g-42"));

    expect(response.status).toBe(200);
    expect(mergeGuestCartIntoUserCart).toHaveBeenCalledTimes(1);
    expect(mergeGuestCartIntoUserCart).toHaveBeenCalledWith("user-1", "g-42");
  });

  it("expires the spent guest cookie on the response (plan.md §6 step 3)", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(loginRequest("guest_cart_id=g-42"));
    const guestCookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("guest_cart_id="));

    // Left in place, the browser would keep presenting an id that no longer
    // resolves to any cart (REQ-CART-013).
    expect(guestCookie).toBeDefined();
    expect(guestCookie).toContain("Max-Age=0");
  });

  it("does not merge, and sets no guest cookie, when the request carries none", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(loginRequest());

    expect(mergeGuestCartIntoUserCart).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie().filter((c) => c.startsWith("guest_cart_id="))).toEqual(
      []
    );
  });

  it("still issues the refresh and csrf cookies exactly as before (REQ-AUTH-004/023)", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(loginRequest("guest_cart_id=g-42"));
    const cookies = response.headers.getSetCookie();

    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("csrf_token="))).toBe(true);
    expect(await response.json()).toHaveProperty("accessToken");
  });

  it("never merges on a failed login", async () => {
    users = [];
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(loginRequest("guest_cart_id=g-42"));

    expect(response.status).toBe(401);
    expect(mergeGuestCartIntoUserCart).not.toHaveBeenCalled();
  });

  it("still answers 200 when the merge throws — a cart problem must not cost the login", async () => {
    mergeGuestCartIntoUserCart.mockRejectedValue(new Error("database is on fire"));
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(loginRequest("guest_cart_id=g-42"));

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("accessToken");
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M5 — Google callback merges the guest cart (REQ-CART-011)", () => {
  it("calls the merge with the resolved user id and the cookie's guest id", async () => {
    const { GET } = await import("@/app/api/auth/google/callback/route");

    const response = await GET(callbackRequest("guest_cart_id=g-77"));

    expect(response.status).toBe(302);
    expect(mergeGuestCartIntoUserCart).toHaveBeenCalledWith("user-1", "g-77");
  });

  it("expires the spent guest cookie on the redirect response", async () => {
    const { GET } = await import("@/app/api/auth/google/callback/route");

    const response = await GET(callbackRequest("guest_cart_id=g-77"));
    const guestCookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("guest_cart_id="));

    expect(guestCookie).toBeDefined();
    expect(guestCookie).toContain("Max-Age=0");
  });

  it("does not merge when the callback carries no guest cookie", async () => {
    const { GET } = await import("@/app/api/auth/google/callback/route");

    await GET(callbackRequest());

    expect(mergeGuestCartIntoUserCart).not.toHaveBeenCalled();
  });

  it("leaves the existing OAuth cookie set intact (REQ-AUTH-017/019/023)", async () => {
    const { GET } = await import("@/app/api/auth/google/callback/route");

    const cookies = (await GET(callbackRequest("guest_cart_id=g-77"))).headers.getSetCookie();

    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("csrf_token="))).toBe(true);
    // The state cookie is still cleared, exactly as before M5.
    expect(cookies.some((c) => c.startsWith("oauth_state=") && c.includes("Max-Age=0"))).toBe(true);
  });

  it("never merges when the state check rejects the callback (AC-AUTH-014 unchanged)", async () => {
    const { GET } = await import("@/app/api/auth/google/callback/route");

    const response = await GET(
      new Request("http://localhost/api/auth/google/callback?code=abc&state=WRONG", {
        headers: { cookie: "oauth_state=state-1; guest_cart_id=g-77", "x-forwarded-for": "10.0.2.9" },
      })
    );

    expect(response.status).toBe(400);
    expect(mergeGuestCartIntoUserCart).not.toHaveBeenCalled();
  });

  it("still redirects when the merge throws", async () => {
    mergeGuestCartIntoUserCart.mockRejectedValue(new Error("database is on fire"));
    const { GET } = await import("@/app/api/auth/google/callback/route");

    expect((await GET(callbackRequest("guest_cart_id=g-77"))).status).toBe(302);
  });
});

// ---------------------------------------------------------------------------
// The relocated cookie parser (plan.md §6 step 1)
// ---------------------------------------------------------------------------

describe("SPEC-CART-001 M5 — getCookieValue has ONE definition (plan.md §6 step 1)", () => {
  const routeSource = (rel: string): string =>
    readFileSync(path.resolve(__dirname, "../../../../src/app/api/auth", rel), "utf8");

  it("no longer declares a private copy inside the Google callback route", () => {
    const source = routeSource("google/callback/route.ts");

    expect(source).not.toMatch(/function\s+getCookieValue/);
    expect(source).toContain("@/lib/auth/guest-identity");
  });

  it("has the login route read cookies through the same shared parser", () => {
    expect(routeSource("login/route.ts")).toContain("@/lib/auth/guest-identity");
  });
});
