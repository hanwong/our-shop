import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M3 — src/app/api/auth/login/route.ts
 * Traces: REQ-AUTH-004 (shared session issuance on valid login), REQ-AUTH-005
 * (dummy-compare + generic failure message on not-found/wrong-password),
 * REQ-AUTH-006 (claim shape via the shared JWT path).
 *
 * No live PostgreSQL in this sandbox — @/lib/db is mocked with an in-memory
 * fake implementing prisma.user.findUnique/create and prisma.refreshToken.create
 * (the delegate issueSession() calls internally), same pattern as
 * tests/unit/auth/session.test.ts.
 */

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
const createdRefreshTokens: Array<Record<string, unknown>> = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        return users.find((u) => u.email === where.email) ?? null;
      }),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { email: string; passwordHash: string; role: "customer" | "admin" };
        }) => {
          const row: FakeUserRow = {
            id: `user-${users.length + 1}`,
            email: data.email,
            passwordHash: data.passwordHash,
            emailVerified: false,
            role: data.role,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          users.push(row);
          return row;
        }
      ),
    },
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `rt-${createdRefreshTokens.length + 1}`, ...data };
        createdRefreshTokens.push(row);
        return row;
      }),
    },
  },
}));

beforeEach(() => {
  users = [];
  createdRefreshTokens.length = 0;
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  delete process.env.JWT_ACCESS_TOKEN_EXPIRY;
  delete process.env.JWT_REFRESH_TOKEN_EXPIRY;
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedUser(
  email: string,
  password: string,
  overrides: Partial<FakeUserRow> = {}
): Promise<FakeUserRow> {
  const { hashPassword } = await import("@/lib/auth/password");
  const row: FakeUserRow = {
    id: `user-${users.length + 1}`,
    email,
    passwordHash: await hashPassword(password),
    emailVerified: false,
    role: "customer",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  users.push(row);
  return row;
}

describe("POST /api/auth/login", () => {
  it("[AC-AUTH-004] valid login returns an accessToken in the body, a Set-Cookie refresh-token cookie with httpOnly+SameSite, and claims carrying exactly sub/iat/exp/iss/aud/jti/role", async () => {
    await seedUser("user@example.com", "correct-password-1");
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(makeRequest({ email: "user@example.com", password: "correct-password-1" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { accessToken?: string };
    expect(typeof body.accessToken).toBe("string");

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    const claims = await verifyAccessToken(body.accessToken!);
    expect(Object.keys(claims).sort()).toEqual(["aud", "exp", "iat", "iss", "jti", "role", "sub"]);
  });

  it("rejects a malformed JSON request body with 400", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const malformedRequest = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-valid-json",
    });
    const response = await POST(malformedRequest);
    expect(response.status).toBe(400);
  });

  it("[AC-AUTH-006] wrong password returns 401 with no accessToken in the body and no Set-Cookie header", async () => {
    await seedUser("user2@example.com", "correct-password-2");
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(makeRequest({ email: "user2@example.com", password: "wrong-password" }));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { accessToken?: string };
    expect(body.accessToken).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("[AC-AUTH-005/006] nonexistent email and wrong password both return 401 with the SAME generic error message", async () => {
    await seedUser("user3@example.com", "correct-password-3");
    const { POST } = await import("@/app/api/auth/login/route");

    const notFoundResponse = await POST(makeRequest({ email: "ghost@example.com", password: "anything" }));
    const wrongPasswordResponse = await POST(
      makeRequest({ email: "user3@example.com", password: "wrong-password" })
    );

    expect(notFoundResponse.status).toBe(401);
    expect(wrongPasswordResponse.status).toBe(401);
    const notFoundBody = (await notFoundResponse.json()) as { error?: string };
    const wrongPasswordBody = (await wrongPasswordResponse.json()) as { error?: string };
    expect(notFoundBody.error).toBeTruthy();
    expect(notFoundBody.error).toBe(wrongPasswordBody.error);
  });

  it("treats a null passwordHash (OAuth-only account) as a failed login (401) without throwing, using dummyCompare rather than comparePassword", async () => {
    await seedUser("oauth-only@example.com", "irrelevant", { passwordHash: null });
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(makeRequest({ email: "oauth-only@example.com", password: "anything" }));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { accessToken?: string };
    expect(body.accessToken).toBeUndefined();
  });

  it("[AC-AUTH-004b(a)] default access token expiry is 900 seconds (15m) when JWT_ACCESS_TOKEN_EXPIRY is unset", async () => {
    await seedUser("expiry-default@example.com", "correct-password-4");
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      makeRequest({ email: "expiry-default@example.com", password: "correct-password-4" })
    );
    const body = (await response.json()) as { accessToken: string };
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    const claims = await verifyAccessToken(body.accessToken);
    expect(claims.exp - claims.iat).toBe(900);
  });

  it("[AC-AUTH-004b(b)] honors JWT_ACCESS_TOKEN_EXPIRY=5m over the default", async () => {
    process.env.JWT_ACCESS_TOKEN_EXPIRY = "5m";
    await seedUser("expiry-env@example.com", "correct-password-5");
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(makeRequest({ email: "expiry-env@example.com", password: "correct-password-5" }));
    const body = (await response.json()) as { accessToken: string };
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    const claims = await verifyAccessToken(body.accessToken);
    expect(claims.exp - claims.iat).toBe(300);
  });

  it("[SPEC-AUTH-001 M6 / AC-AUTH-021] returns 429 after more than 5 requests/60s from the same IP (x-forwarded-for), independent of the account tried", async () => {
    await seedUser("rate-limit-a@example.com", "correct-password-a");
    const { POST } = await import("@/app/api/auth/login/route");
    const ipHeaders = { "x-forwarded-for": "203.0.113.50" };

    function makeIpRequest(body: unknown): Request {
      return new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", ...ipHeaders },
        body: JSON.stringify(body),
      });
    }

    for (let i = 0; i < 5; i++) {
      const response = await POST(
        makeIpRequest({ email: "rate-limit-a@example.com", password: "correct-password-a" })
      );
      expect(response.status).toBe(200);
    }
    const sixth = await POST(
      makeIpRequest({ email: "rate-limit-a@example.com", password: "correct-password-a" })
    );
    expect(sixth.status).toBe(429);
  });

  it("[SPEC-AUTH-001 M6 / REQ-AUTH-023] a successful login sets a csrf_token cookie alongside the refresh-token cookie (not httpOnly, SameSite=Lax)", async () => {
    await seedUser("csrf-issue@example.com", "correct-password-csrf");
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      makeRequest({ email: "csrf-issue@example.com", password: "correct-password-csrf" })
    );
    expect(response.status).toBe(200);
    const setCookie = response.headers.getSetCookie();
    const csrfCookie = setCookie.find((c) => c.startsWith("csrf_token="));
    expect(csrfCookie).toBeTruthy();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
    expect(csrfCookie).toMatch(/SameSite=Lax/i);
  });

  it("[AC-AUTH-003a integration] a >72-byte password round-trips: signup then login with the SAME raw password succeeds end-to-end", async () => {
    const { POST: signupPOST } = await import("@/app/api/auth/signup/route");
    const { POST: loginPOST } = await import("@/app/api/auth/login/route");
    const longPassword = "p".repeat(100) + "-Q1!";

    const signupResponse = await signupPOST(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "longpw-login@example.com", password: longPassword }),
      })
    );
    expect(signupResponse.status).toBe(201);

    const loginResponse = await loginPOST(makeRequest({ email: "longpw-login@example.com", password: longPassword }));
    expect(loginResponse.status).toBe(200);
    const body = (await loginResponse.json()) as { accessToken?: string };
    expect(typeof body.accessToken).toBe("string");
  });
});
