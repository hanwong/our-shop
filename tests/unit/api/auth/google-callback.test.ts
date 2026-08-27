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
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { passwordHash?: string | null; emailVerified?: boolean };
      }) => {
        const row = users.find((u) => u.id === where.id);
        if (!row) throw new Error(`update: no User with id ${where.id}`);
        if (data.passwordHash !== undefined) row.passwordHash = data.passwordHash;
        if (data.emailVerified !== undefined) row.emailVerified = data.emailVerified;
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
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { userId: string; revokedAt: null };
        data: { revokedAt: Date };
      }) => {
        let count = 0;
        for (const row of refreshTokens) {
          if (row.userId === where.userId && row.revokedAt === null) {
            row.revokedAt = data.revokedAt;
            count++;
          }
        }
        return { count };
      }
    ),
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

beforeEach(async () => {
  users = [];
  oauthAccounts = [];
  refreshTokens = [];
  nextUserId = 1;
  nextOAuthId = 1;
  nextRtId = 1;
  // [AUTO] 2026-08-27 F2/H1 fix — see tests/unit/api/auth/refresh.test.ts's
  // beforeEach comment: checkIpRateLimit now rate-limits (rather than
  // always-allows) requests with no x-forwarded-for, so this file needs a
  // per-test reset too.
  const { __resetRateLimitStoreForTests } = await import("@/lib/auth/rate-limit");
  __resetRateLimitStoreForTests();
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

    it("[AC-AUTH-018 Branch C — auto-link, email-verified existing account] an existing email/password User (emailVerified:true) with no linked OAuthAccount is auto-linked on matching (case-normalized) email, WITHOUT a confirmation step, and the existing passwordHash is untouched", async () => {
      const existingUser: FakeUserRow = {
        id: "user-existing-c",
        email: "existing@example.com",
        passwordHash: "some-bcrypt-hash",
        emailVerified: true,
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
      // (AC-AUTH-018's explicit requirement, scoped to already-verified
      // accounts after the 2026-08-27 C1 security fix).
      expect(existingUser.passwordHash).toBe("some-bcrypt-hash");
      expect(refreshTokens).toHaveLength(1);
      expect(refreshTokens[0]!.userId).toBe(existingUser.id);
    });

    it("[AC-AUTH-018b — auto-link, UNVERIFIED existing account — C1 fix] an attacker-registered account (emailVerified:false) auto-links but has its passwordHash invalidated, closing the account pre-hijacking exploit", async () => {
      // Simulates: attacker POSTs /api/auth/signup with the victim's email
      // and an attacker-chosen password (signup never sets emailVerified —
      // this is the realistic state of EVERY account created by this SPEC's
      // signup route). The real victim later signs in with their own Google
      // account on the SAME email.
      const attackerCreatedUser: FakeUserRow = {
        id: "user-victim-email",
        email: "victim@example.com",
        passwordHash: "attacker-chosen-bcrypt-hash",
        emailVerified: false,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(attackerCreatedUser);
      mockValidIdentity("sub-victim-google", "victim@example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-victim", state: "s1", cookieState: "s1" }));

      expect(response.status).toBe(302);
      expect(users).toHaveLength(1); // still auto-links, no new row
      expect(oauthAccounts).toHaveLength(1);
      expect(oauthAccounts[0]!.userId).toBe(attackerCreatedUser.id);
      // The exploit check: the attacker's password must no longer work.
      expect(attackerCreatedUser.passwordHash).toBeNull();
      // Google's email_verified confirmation is now recorded on the account.
      expect(attackerCreatedUser.emailVerified).toBe(true);
      expect(refreshTokens).toHaveLength(1);
      expect(refreshTokens[0]!.userId).toBe(attackerCreatedUser.id);
    });

    it("[C1 re-audit fix, 2026-08-27] a refresh token the ATTACKER already obtained before the victim's Google login (e.g. by logging in with the password they set at signup) is revoked in the SAME auto-link transaction — closing the surviving-session arm of the account-takeover exploit", async () => {
      const attackerCreatedUser: FakeUserRow = {
        id: "user-victim-email-2",
        email: "victim2@example.com",
        passwordHash: "attacker-chosen-bcrypt-hash-2",
        emailVerified: false,
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(attackerCreatedUser);
      // The attacker's own pre-existing session, obtained via their password
      // BEFORE the victim ever authenticates. Nulling passwordHash alone
      // (the prior fix) does nothing to a session token already issued.
      const attackerRefreshToken: FakeRefreshTokenRow = {
        id: "rt-attacker-session",
        userId: attackerCreatedUser.id,
        tokenHash: "attacker-session-hash",
        familyId: "attacker-family",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date(),
      };
      refreshTokens.push(attackerRefreshToken);

      mockValidIdentity("sub-victim2-google", "victim2@example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-victim2", state: "s1", cookieState: "s1" }));

      expect(response.status).toBe(302);
      // The attacker's pre-existing session must be revoked, not merely left
      // alone — a live refresh token survives a password nulling untouched.
      expect(attackerRefreshToken.revokedAt).not.toBeNull();
      // The victim's NEW session (issued by this callback) must still work —
      // exactly one non-revoked token remains, and it is the new one.
      const liveTokens = refreshTokens.filter((t) => t.revokedAt === null);
      expect(liveTokens).toHaveLength(1);
      expect(liveTokens[0]!.id).not.toBe(attackerRefreshToken.id);
      expect(liveTokens[0]!.userId).toBe(attackerCreatedUser.id);
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

    it("[SPEC-AUTH-001 M6 / REQ-AUTH-023] also sets a csrf_token cookie (not httpOnly, SameSite=Lax)", async () => {
      mockValidIdentity("sub-csrf", "csrf-callback@example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      const response = await GET(makeRequest({ code: "code-csrf", state: "s1", cookieState: "s1" }));

      const setCookie = response.headers.getSetCookie();
      const csrfCookie = setCookie.find((c) => c.startsWith("csrf_token="));
      expect(csrfCookie).toBeTruthy();
      expect(csrfCookie).not.toMatch(/HttpOnly/i);
      expect(csrfCookie).toMatch(/SameSite=Lax/i);
    });
  });

  describe("[SPEC-AUTH-001 M6 / AC-AUTH-021] rate limiting", () => {
    it("returns 429 after more than 5 requests/60s from the same IP (x-forwarded-for), before any code exchange is attempted on the 6th", async () => {
      mockValidIdentity("sub-rl", "rl-callback@example.com");
      const { GET } = await import("@/app/api/auth/google/callback/route");

      function makeIpRequest(state: string, cookieState: string): Request {
        const url = new URL("http://localhost/api/auth/google/callback");
        url.searchParams.set("code", "code-rl");
        url.searchParams.set("state", state);
        return new Request(url.toString(), {
          headers: { cookie: `oauth_state=${cookieState}`, "x-forwarded-for": "203.0.113.70" },
        });
      }

      for (let i = 0; i < 5; i++) {
        const response = await GET(makeIpRequest("s1", "s1"));
        expect(response.status).toBe(302);
      }
      getTokenMock.mockClear();
      const sixth = await GET(makeIpRequest("s1", "s1"));
      expect(sixth.status).toBe(429);
      expect(getTokenMock).not.toHaveBeenCalled();
    });
  });
});
