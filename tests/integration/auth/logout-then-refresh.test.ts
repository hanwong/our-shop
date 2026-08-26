import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M4 — AC-AUTH-012 integration test.
 * Traces: REQ-AUTH-013 ("로그아웃 후 재사용 불가").
 *
 * Exercises the interaction between the logout route and the refresh route:
 * a single shared in-memory fake `@/lib/db` store is used by BOTH route
 * handlers (one module-level mock, imported by both), so a token revoked by
 * POST /api/auth/logout is observed as revoked by POST /api/auth/refresh —
 * proving the two handlers actually share persisted state, not just that
 * each independently believes it revoked something.
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
});

function makeRequest(path: string, cookieValue: string | undefined): Request {
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) {
    headers["cookie"] = `refresh_token=${cookieValue}`;
  }
  return new Request(`http://localhost${path}`, { method: "POST", headers });
}

describe("AC-AUTH-012 — logout then refresh fails", () => {
  it("a refresh token revoked by /logout can no longer succeed against /refresh", async () => {
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const rawToken = "shared-session-raw-token";
    users.push({
      id: "user-1",
      email: "logout-user@example.com",
      passwordHash: "irrelevant",
      emailVerified: false,
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    refreshTokens.push({
      id: "rt-1",
      userId: "user-1",
      tokenHash: hashRefreshToken(rawToken),
      familyId: "family-logout-1",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
    });

    const { POST: logoutPOST } = await import("@/app/api/auth/logout/route");
    const logoutResponse = await logoutPOST(makeRequest("/api/auth/logout", rawToken));
    expect(logoutResponse.status).toBe(200);

    const { POST: refreshPOST } = await import("@/app/api/auth/refresh/route");
    const refreshResponse = await refreshPOST(makeRequest("/api/auth/refresh", rawToken));
    expect(refreshResponse.status).toBe(401);
    const body = (await refreshResponse.json()) as { accessToken?: string };
    expect(body.accessToken).toBeUndefined();
  });
});
