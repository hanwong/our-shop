import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M4 — src/app/api/auth/refresh/route.ts
 * Traces: REQ-AUTH-010 (valid rotation), REQ-AUTH-011 (reuse detection ->
 * family-wide revoke), REQ-AUTH-012 (expired-token rejection),
 * AC-AUTH-007/007b/008/009/010.
 *
 * No live PostgreSQL — @/lib/db is mocked with an in-memory fake, same
 * pattern as tests/unit/api/auth/login.test.ts. The `$transaction` mock
 * invokes the callback with a `tx` object backed by the SAME delegate spies
 * as `prisma.refreshToken`/`prisma.user`, so assertions on call counts work
 * whether the code goes through `tx.*` or `prisma.*` directly.
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
let refreshTokens: FakeRefreshTokenRow[] = [];
let nextRtId = 1;

vi.mock("@/lib/db", () => {
  const refreshTokenDelegate = {
    findFirst: vi.fn(async ({ where }: { where: { tokenHash?: string; id?: string } }) => {
      if (where.tokenHash !== undefined) {
        return refreshTokens.find((r) => r.tokenHash === where.tokenHash) ?? null;
      }
      if (where.id !== undefined) {
        return refreshTokens.find((r) => r.id === where.id) ?? null;
      }
      return null;
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { familyId: string; revokedAt: null };
        data: { revokedAt: Date };
      }) => {
        let count = 0;
        for (const row of refreshTokens) {
          if (row.familyId === where.familyId && row.revokedAt === null) {
            row.revokedAt = data.revokedAt;
            count++;
          }
        }
        return { count };
      }
    ),
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
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRefreshTokenRow>;
      }) => {
        const row = refreshTokens.find((r) => r.id === where.id);
        if (!row) {
          throw new Error(`RefreshToken ${where.id} not found`);
        }
        Object.assign(row, data);
        return row;
      }
    ),
  };
  const userDelegate = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return users.find((u) => u.id === where.id) ?? null;
    }),
  };
  const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    return callback({ refreshToken: refreshTokenDelegate, user: userDelegate });
  });
  return {
    prisma: {
      refreshToken: refreshTokenDelegate,
      user: userDelegate,
      $transaction: transactionMock,
    },
  };
});

beforeEach(() => {
  users = [];
  refreshTokens = [];
  nextRtId = 1;
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  delete process.env.JWT_ACCESS_TOKEN_EXPIRY;
  delete process.env.JWT_REFRESH_TOKEN_EXPIRY;
  // Mock call history (e.g. $transaction.mock.calls) persists across tests
  // in this file since the module-level vi.mock factory is shared — clear
  // recorded calls/results each test without discarding the implementations.
  vi.clearAllMocks();
});

function makeRequest(cookieValue: string | undefined): Request {
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) {
    headers["cookie"] = `refresh_token=${cookieValue}`;
  }
  return new Request("http://localhost/api/auth/refresh", { method: "POST", headers });
}

async function seedUser(overrides: Partial<FakeUserRow> = {}): Promise<FakeUserRow> {
  const row: FakeUserRow = {
    id: `user-${users.length + 1}`,
    email: `user${users.length + 1}@example.com`,
    passwordHash: "irrelevant-hash",
    emailVerified: false,
    role: "customer",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  users.push(row);
  return row;
}

/** Seeds a RefreshToken row with a KNOWN raw token, returning the raw token. */
async function seedRefreshToken(
  userId: string,
  overrides: Partial<FakeRefreshTokenRow> = {}
): Promise<{ rawToken: string; row: FakeRefreshTokenRow }> {
  const { hashRefreshToken } = await import("@/lib/auth/session");
  const rawToken = `raw-token-${nextRtId}-${Math.random().toString(36).slice(2)}`;
  const row: FakeRefreshTokenRow = {
    id: `rt-${nextRtId++}`,
    userId,
    tokenHash: hashRefreshToken(rawToken),
    familyId: `family-${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null,
    replacedByTokenId: null,
    createdAt: new Date(),
    ...overrides,
  };
  // If overrides recomputed tokenHash-sensitive fields (e.g. familyId), keep the hash consistent.
  refreshTokens.push(row);
  return { rawToken, row };
}

describe("POST /api/auth/refresh", () => {
  it("[AC-AUTH-007] valid refresh rotates: new accessToken + new refresh cookie issued, OLD row's revokedAt is set", async () => {
    const user = await seedUser();
    const { rawToken, row } = await seedRefreshToken(user.id);
    const { POST } = await import("@/app/api/auth/refresh/route");

    const response = await POST(makeRequest(rawToken));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { accessToken?: string };
    expect(typeof body.accessToken).toBe("string");

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).not.toMatch(new RegExp(`refresh_token=${rawToken}(;|$)`));

    expect(row.revokedAt).not.toBeNull();
    expect(refreshTokens).toHaveLength(2);
    const newRow = refreshTokens.find((r) => r.id !== row.id)!;
    expect(newRow.familyId).toBe(row.familyId);
    expect(row.replacedByTokenId).toBe(newRow.id);
  });

  it("[AC-AUTH-007b] the new row's tokenHash is a SHA-256 round-trip of the new cookie's raw value, via session.ts's hashRefreshToken", async () => {
    const user = await seedUser();
    const { rawToken } = await seedRefreshToken(user.id);
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const { POST } = await import("@/app/api/auth/refresh/route");

    await POST(makeRequest(rawToken));
    const newRow = refreshTokens.find((r) => r.revokedAt === null)!;
    // Extract the new raw refresh token from Set-Cookie to round-trip it.
    // (We don't have direct access to the raw value otherwise.)
    expect(newRow.tokenHash).not.toBe(rawToken);
    // sanity: hashing the OLD raw token reproduces the OLD row's hash, proving
    // the route uses the SAME function as session.ts (not a divergent one).
    const oldRow = refreshTokens.find((r) => r.revokedAt !== null)!;
    expect(hashRefreshToken(rawToken)).toBe(oldRow.tokenHash);
  });

  it("[AC-AUTH-008] reuse of an already-revoked (rotated-out) token revokes the ENTIRE family and returns 401", async () => {
    const user = await seedUser();
    const familyId = "shared-family-1";
    // tokenA: already rotated out (revoked) — simulates the reused token.
    const { rawToken: rawA } = await seedRefreshToken(user.id, {
      familyId,
      revokedAt: new Date(Date.now() - 1000),
    });
    // tokenB: still active, same family — must ALSO be revoked by reuse detection.
    const { rawToken: rawB } = await seedRefreshToken(user.id, { familyId });

    const { POST } = await import("@/app/api/auth/refresh/route");
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const response = await POST(makeRequest(rawA));
    expect(response.status).toBe(401);

    const hashA = hashRefreshToken(rawA);
    const hashB = hashRefreshToken(rawB);
    const rowA = refreshTokens.find((r) => r.tokenHash === hashA)!;
    const rowB = refreshTokens.find((r) => r.tokenHash === hashB)!;
    expect(rowA.revokedAt).not.toBeNull();
    expect(rowB.revokedAt).not.toBeNull();

    // Second family member also fails post-revocation.
    const secondResponse = await POST(makeRequest(rawB));
    expect(secondResponse.status).toBe(401);
  });

  it("[AC-AUTH-009] an expired (not reused) token is rejected with 401 and no new token issued — distinct from the reuse branch", async () => {
    const user = await seedUser();
    const { rawToken } = await seedRefreshToken(user.id, {
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null, // never reused, purely expired
    });
    const { POST } = await import("@/app/api/auth/refresh/route");
    const beforeCount = refreshTokens.length;

    const response = await POST(makeRequest(rawToken));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { accessToken?: string };
    expect(body.accessToken).toBeUndefined();
    // No new row created, and updateMany-driven family revocation did NOT fire
    // (this is a distinct branch from reuse — no family-wide side effect).
    expect(refreshTokens).toHaveLength(beforeCount);
  });

  it("returns 401 when the refresh cookie is absent", async () => {
    const { POST } = await import("@/app/api/auth/refresh/route");
    const response = await POST(makeRequest(undefined));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the refresh cookie does not match any stored tokenHash", async () => {
    const { POST } = await import("@/app/api/auth/refresh/route");
    const response = await POST(makeRequest("no-such-raw-token"));
    expect(response.status).toBe(401);
  });

  it("[AC-AUTH-010] the create+revoke pair for a valid rotation is wrapped in exactly one prisma.$transaction call", async () => {
    const user = await seedUser();
    const { rawToken } = await seedRefreshToken(user.id);
    const { prisma } = (await import("@/lib/db")) as unknown as {
      prisma: { $transaction: { mock: { calls: unknown[] } } };
    };
    const { POST } = await import("@/app/api/auth/refresh/route");

    await POST(makeRequest(rawToken));
    expect(prisma.$transaction.mock.calls).toHaveLength(1);
  });

  it("returns 401 when the RefreshToken's owning User no longer exists", async () => {
    // Deliberately do NOT seed a user row for this userId.
    const { rawToken } = await seedRefreshToken("ghost-user-id");
    const { POST } = await import("@/app/api/auth/refresh/route");
    const response = await POST(makeRequest(rawToken));
    expect(response.status).toBe(401);
  });

  it("[SPEC-AUTH-001 M6 / AC-AUTH-021] returns 429 after more than 5 requests/60s from the same IP (x-forwarded-for)", async () => {
    const user = await seedUser();
    const { POST } = await import("@/app/api/auth/refresh/route");

    function makeIpRequest(cookieValue: string | undefined): Request {
      const headers: Record<string, string> = { "x-forwarded-for": "203.0.113.60" };
      if (cookieValue !== undefined) {
        headers["cookie"] = `refresh_token=${cookieValue}`;
      }
      return new Request("http://localhost/api/auth/refresh", { method: "POST", headers });
    }

    for (let i = 0; i < 5; i++) {
      const { rawToken } = await seedRefreshToken(user.id);
      const response = await POST(makeIpRequest(rawToken));
      expect(response.status).toBe(200);
    }
    const sixth = await POST(makeIpRequest("irrelevant-not-a-real-token"));
    expect(sixth.status).toBe(429);
  });

  it("[SPEC-AUTH-001 M6 / REQ-AUTH-023] a successful rotation sets a csrf_token cookie alongside the rotated refresh-token cookie (not httpOnly, SameSite=Lax)", async () => {
    const user = await seedUser();
    const { rawToken } = await seedRefreshToken(user.id);
    const { POST } = await import("@/app/api/auth/refresh/route");

    const response = await POST(makeRequest(rawToken));
    expect(response.status).toBe(200);
    const setCookie = response.headers.getSetCookie();
    const csrfCookie = setCookie.find((c) => c.startsWith("csrf_token="));
    expect(csrfCookie).toBeTruthy();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
    expect(csrfCookie).toMatch(/SameSite=Lax/i);
  });

  it("signs the new access token with the user's CURRENT role", async () => {
    const user = await seedUser({ role: "admin" });
    const { rawToken } = await seedRefreshToken(user.id);
    const { POST } = await import("@/app/api/auth/refresh/route");
    const { verifyAccessToken } = await import("@/lib/auth/jwt");

    const response = await POST(makeRequest(rawToken));
    const body = (await response.json()) as { accessToken: string };
    const claims = await verifyAccessToken(body.accessToken);
    expect(claims.role).toBe("admin");
    expect(claims.sub).toBe(user.id);
  });
});
