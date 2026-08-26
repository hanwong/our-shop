import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M5 — src/app/api/auth/google/callback/route.ts
 * Traces: REQ-AUTH-015 (state CSRF rejection), REQ-AUTH-016 (ID token
 * verification), REQ-AUTH-017 (Branch A — matched OAuthAccount),
 * REQ-AUTH-018 (Branch B — new user), REQ-AUTH-019 (Branch C — auto-link,
 * confirmed policy per plan.md §5.1 / design.md §5 threat-model row 12).
 * AC-AUTH-014/015/015b/016/017/018.
 *
 * No live network / no real Google credentials in this sandbox —
 * google-auth-library's OAuth2Client is fully mocked. No live PostgreSQL —
 * @/lib/db is mocked with an in-memory fake, extending the refresh.test.ts
 * (M4) pattern with an `oAuthAccount` delegate.
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

interface FakeOAuthAccountRow {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  createdAt: Date;
}

interface FakeRefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

let users: FakeUserRow[] = [];
let oauthAccounts: FakeOAuthAccountRow[] = [];
let refreshTokens: FakeRefreshTokenRow[] = [];
let nextUserId = 1;
let nextOAuthId = 1;
let nextRtId = 1;

const { generateAuthUrlMock, getTokenMock, verifyIdTokenMock } = vi.hoisted(() => ({
  generateAuthUrlMock: vi.fn(),
  getTokenMock: vi.fn(),
  verifyIdTokenMock: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: generateAuthUrlMock,
    getToken: getTokenMock,
    verifyIdToken: verifyIdTokenMock,
  })),
}));

vi.mock("@/lib/db", () => {
  const userDelegate = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id !== undefined) return users.find((u) => u.id === where.id) ?? null;
      if (where.email !== undefined) return users.find((u) => u.email === where.email) ?? null;
      return null;
    }),
    create: vi.fn(
      async ({
        data,
      }: {
        data: { email: string; passwordHash: string | null; emailVerified: boolean; role: "customer" | "admin" };
      }) => {
        const row: FakeUserRow = {
          id: `user-${nextUserId++}`,
          email: data.email,
          passwordHash: data.passwordHash,
          emailVerified: data.emailVerified,
          role: data.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(row);
        return row;
      }
    ),
  };
  const oAuthAccountDelegate = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { provider_providerAccountId?: { provider: string; providerAccountId: string } };
      }) => {
        const key = where.provider_providerAccountId;
        if (!key) return null;
        return (
          oauthAccounts.find((a) => a.provider === key.provider && a.providerAccountId === key.providerAccountId) ??
          null
        );
      }
    ),
    create: vi.fn(
      async ({ data }: { data: { provider: string; providerAccountId: string; userId: string } }) => {
        const row: FakeOAuthAccountRow = {
          id: `oauth-${nextOAuthId++}`,
          userId: data.userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          createdAt: new Date(),
        };
        oauthAccounts.push(row);
        return row;
      }
    ),
  };
  const refreshTokenDelegate = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row: FakeRefreshTokenRow = {
        id: `rt-${nextRtId++}`,
        userId: data.userId as string,
        tokenHash: data.tokenHash as string,
        familyId: data.familyId as string,
        expiresAt: data.expiresAt as Date,
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date(),
      };
      refreshTokens.push(row);
      return row;
    }),
  };
  const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    return callback({
      user: userDelegate,
      oAuthAccount: oAuthAccountDelegate,
      refreshToken: refreshTokenDelegate,
    });
  });
  return {
    prisma: {
      user: userDelegate,
      oAuthAccount: oAuthAccountDelegate,
      refreshToken: refreshTokenDelegate,
      $transaction: transactionMock,
    },
  };
});

beforeEach(() => {
  users = [];
  oauthAccounts = [];
  refreshTokens = [];
  nextUserId = 1;
  nextOAuthId = 1;
  nextRtId = 1;
  generateAuthUrlMock.mockReset();
  getTokenMock.mockReset();
  verifyIdTokenMock.mockReset();
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  delete process.env.JWT_ACCESS_TOKEN_EXPIRY;
  delete process.env.JWT_REFRESH_TOKEN_EXPIRY;
});

function makeRequest(params: { code?: string; state?: string; cookieState?: string }): Request {
  const url = new URL("http://localhost/api/auth/google/callback");
  if (params.code !== undefined) url.searchParams.set("code", params.code);
  if (params.state !== undefined) url.searchParams.set("state", params.state);
  const headers: Record<string, string> = {};
  if (params.cookieState !== undefined) {
    headers["cookie"] = `oauth_state=${params.cookieState}`;
  }
  return new Request(url.toString(), { headers });
}

function mockValidIdentity(sub: string, email: string): void {
  getTokenMock.mockResolvedValue({ tokens: { id_token: `mock-id-token-${sub}` } });
  verifyIdTokenMock.mockResolvedValue({
    getPayload: () => ({ sub, email, email_verified: true }),
  });
}

describe("GET /api/auth/google/callback", () => {
  describe("state CSRF verification (AC-AUTH-014)", () => {
    it("rejects a callback whose state param does not match the oauth_state cookie, with no DB writes and no code exchange attempted", async () => {
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-1", state: "wrong-state", cookieState: "correct-state" }));

      expect([400, 401]).toContain(response.status);
      expect(users).toHaveLength(0);
      expect(oauthAccounts).toHaveLength(0);
      expect(getTokenMock).not.toHaveBeenCalled();
    });

    it("rejects a callback with no oauth_state cookie present", async () => {
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-1", state: "some-state" }));

      expect([400, 401]).toContain(response.status);
      expect(getTokenMock).not.toHaveBeenCalled();
    });

    it("rejects a callback with no code param present", async () => {
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ state: "s1", cookieState: "s1" }));

      expect([400, 401]).toContain(response.status);
      expect(getTokenMock).not.toHaveBeenCalled();
    });
  });

  describe("Google ID token verification (AC-AUTH-015 / AC-AUTH-015b)", () => {
    it("[bad signature] rejects when Google ID token signature verification fails, no DB writes", async () => {
      getTokenMock.mockResolvedValue({ tokens: { id_token: "bad-sig-token" } });
      verifyIdTokenMock.mockRejectedValue(new Error("Invalid token signature"));
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-2", state: "s1", cookieState: "s1" }));

      expect([400, 401]).toContain(response.status);
      expect(users).toHaveLength(0);
      expect(oauthAccounts).toHaveLength(0);
    });

    it("[email_verified=false] rejects, no DB writes", async () => {
      getTokenMock.mockResolvedValue({ tokens: { id_token: "unverified-token" } });
      verifyIdTokenMock.mockResolvedValue({
        getPayload: () => ({ sub: "sub-unverified", email: "x@example.com", email_verified: false }),
      });
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-3", state: "s1", cookieState: "s1" }));

      expect([400, 401]).toContain(response.status);
      expect(users).toHaveLength(0);
      expect(oauthAccounts).toHaveLength(0);
    });

    it("rejects when code exchange (getToken) fails with a network error — independent of state validation, no DB writes", async () => {
      getTokenMock.mockRejectedValue(new Error("network error contacting Google"));
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-4", state: "s1", cookieState: "s1" }));

      expect([400, 401]).toContain(response.status);
      expect(users).toHaveLength(0);
      expect(oauthAccounts).toHaveLength(0);
    });
  });

  describe("account resolution branches", () => {
    it("[AC-AUTH-016 Branch A] matched OAuthAccount issues a session for the linked user; no new User/OAuthAccount created", async () => {
      const existingUser: FakeUserRow = {
        id: "user-existing-a",
        email: "matched@example.com",
        passwordHash: "irrelevant-hash",
        emailVerified: true,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(existingUser);
      oauthAccounts.push({
        id: "oauth-existing-a",
        userId: existingUser.id,
        provider: "google",
        providerAccountId: "sub-a",
        createdAt: new Date(),
      });
      mockValidIdentity("sub-a", existingUser.email);
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-a", state: "s1", cookieState: "s1" }));

      expect(response.status).toBe(302);
      expect(users).toHaveLength(1);
      expect(oauthAccounts).toHaveLength(1);
      expect(refreshTokens).toHaveLength(1);
      expect(refreshTokens[0]!.userId).toBe(existingUser.id);
      const setCookie = response.headers.getSetCookie();
      expect(setCookie.some((c) => c.startsWith("refresh_token=") && /HttpOnly/i.test(c))).toBe(true);
    });

    it("[AC-AUTH-016] returns 400/401 when a matched OAuthAccount's owning User no longer exists", async () => {
      oauthAccounts.push({
        id: "oauth-ghost",
        userId: "ghost-user-id",
        provider: "google",
        providerAccountId: "sub-ghost",
        createdAt: new Date(),
      });
      mockValidIdentity("sub-ghost", "ghost@example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-ghost", state: "s1", cookieState: "s1" }));

      expect([400, 401]).toContain(response.status);
      expect(refreshTokens).toHaveLength(0);
    });

    it("[AC-AUTH-017 Branch B] no matching OAuthAccount and no existing User creates a new User(passwordHash:null, emailVerified:true) + OAuthAccount in ONE transaction, then issues a session", async () => {
      mockValidIdentity("sub-b", "newuser@example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");
      const { prisma } = (await import("@/lib/db")) as unknown as {
        prisma: { $transaction: { mock: { calls: unknown[] } } };
      };

      const response = await GET(makeRequest({ code: "code-b", state: "s1", cookieState: "s1" }));

      expect(response.status).toBe(302);
      expect(users).toHaveLength(1);
      expect(users[0]!.passwordHash).toBeNull();
      expect(users[0]!.emailVerified).toBe(true);
      expect(users[0]!.email).toBe("newuser@example.com");
      expect(users[0]!.role).toBe("customer");
      expect(oauthAccounts).toHaveLength(1);
      expect(oauthAccounts[0]!.providerAccountId).toBe("sub-b");
      expect(oauthAccounts[0]!.userId).toBe(users[0]!.id);
      expect(prisma.$transaction.mock.calls).toHaveLength(1);
      expect(refreshTokens).toHaveLength(1);
    });

    it("normalizes the verified email to lowercase before storage (Branch B, acceptance.md §7 edge case)", async () => {
      mockValidIdentity("sub-normalize", "MixedCase@Example.COM");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      await GET(makeRequest({ code: "code-norm", state: "s1", cookieState: "s1" }));

      expect(users).toHaveLength(1);
      expect(users[0]!.email).toBe("mixedcase@example.com");
    });

    it("[AC-AUTH-018 Branch C — auto-link] an existing email/password User with no linked OAuthAccount is auto-linked on matching (case-normalized) email, WITHOUT a confirmation step, and the existing passwordHash is untouched", async () => {
      const existingUser: FakeUserRow = {
        id: "user-existing-c",
        email: "existing@example.com",
        passwordHash: "some-bcrypt-hash",
        emailVerified: false,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(existingUser);
      // Google email in a DIFFERENT case to prove case-normalized matching.
      mockValidIdentity("sub-c", "Existing@Example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-c", state: "s1", cookieState: "s1" }));

      expect(response.status).toBe(302);
      expect(users).toHaveLength(1); // no new user created
      expect(oauthAccounts).toHaveLength(1);
      expect(oauthAccounts[0]!.userId).toBe(existingUser.id);
      expect(oauthAccounts[0]!.providerAccountId).toBe("sub-c");
      // The existing User row's passwordHash is untouched by the auto-link —
      // the same user can still log in with email/password afterward
      // (AC-AUTH-018's explicit requirement; verified here as a pure
      // data-shape assertion per this milestone's instructions).
      expect(existingUser.passwordHash).toBe("some-bcrypt-hash");
      expect(refreshTokens).toHaveLength(1);
      expect(refreshTokens[0]!.userId).toBe(existingUser.id);
    });
  });

  describe("response shape on success", () => {
    it("302-redirects and clears the oauth_state cookie alongside setting the refresh-token and access-token-handoff cookies", async () => {
      mockValidIdentity("sub-shape", "shape@example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-shape", state: "s1", cookieState: "s1" }));

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBeTruthy();
      const setCookie = response.headers.getSetCookie();
      expect(setCookie.some((c) => c.startsWith("refresh_token="))).toBe(true);
      expect(setCookie.some((c) => c.startsWith("oauth_state=") && /Max-Age=0/i.test(c))).toBe(true);
      expect(setCookie.some((c) => c.startsWith("oauth_access_token_handoff="))).toBe(true);
    });
  });
});
