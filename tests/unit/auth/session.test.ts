import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";

/**
 * SPEC-AUTH-001 M2 — src/lib/auth/session.ts
 * Traces: REQ-AUTH-006/007/008/009/020 (via the shared claim/expiry path),
 * plan.md §3.2 (shared issueSession() design).
 *
 * No live PostgreSQL in this sandbox — @/lib/db is mocked with an in-memory
 * fake implementing only the prisma.refreshToken.create delegate this code
 * actually calls, tracking calls in a local array (standard TDD approach for
 * this milestone per the M2 task brief).
 */

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

const createdRows: FakeRefreshTokenRow[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row: FakeRefreshTokenRow = {
          id: `rt-${createdRows.length + 1}`,
          userId: data.userId as string,
          tokenHash: data.tokenHash as string,
          familyId: data.familyId as string,
          expiresAt: data.expiresAt as Date,
          revokedAt: null,
          replacedByTokenId: null,
          createdAt: new Date(),
        };
        createdRows.push(row);
        return row;
      }),
    },
  },
}));

beforeEach(() => {
  createdRows.length = 0;
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  delete process.env.JWT_ACCESS_TOKEN_EXPIRY;
  delete process.env.JWT_REFRESH_TOKEN_EXPIRY;
});

describe("issueSession (plan.md §3.2 shared session-issuance path)", () => {
  it("returns an accessToken, a raw refreshToken, and a refreshTokenExpiresAt Date", async () => {
    const { issueSession } = await import("@/lib/auth/session");
    const result = await issueSession("user-1", "customer");
    expect(typeof result.accessToken).toBe("string");
    expect(typeof result.refreshToken).toBe("string");
    expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
  });

  it("persists exactly one RefreshToken row via prisma.refreshToken.create", async () => {
    const { issueSession } = await import("@/lib/auth/session");
    await issueSession("user-42", "customer");
    expect(createdRows).toHaveLength(1);
    expect(createdRows[0]?.userId).toBe("user-42");
  });

  it("assigns a fresh familyId to the persisted row", async () => {
    const { issueSession } = await import("@/lib/auth/session");
    await issueSession("user-1", "customer");
    await issueSession("user-1", "customer");
    expect(createdRows).toHaveLength(2);
    expect(createdRows[0]?.familyId).not.toBe(createdRows[1]?.familyId);
    expect(createdRows[0]?.familyId).toBeTruthy();
    expect(createdRows[1]?.familyId).toBeTruthy();
  });

  it("generates a cryptographically random raw refresh token, distinct per call", async () => {
    const { issueSession } = await import("@/lib/auth/session");
    const resultA = await issueSession("user-1", "customer");
    const resultB = await issueSession("user-1", "customer");
    expect(resultA.refreshToken).not.toBe(resultB.refreshToken);
    expect(resultA.refreshToken.length).toBeGreaterThanOrEqual(32);
  });

  it("defaults refreshTokenExpiresAt to +30 days when JWT_REFRESH_TOKEN_EXPIRY is unset", async () => {
    const { issueSession } = await import("@/lib/auth/session");
    const before = Date.now();
    const result = await issueSession("user-1", "customer");
    const expectedMs = before + 30 * 24 * 60 * 60 * 1000;
    // Allow a small tolerance window for test execution time.
    expect(result.refreshTokenExpiresAt.getTime()).toBeGreaterThan(expectedMs - 5000);
    expect(result.refreshTokenExpiresAt.getTime()).toBeLessThan(expectedMs + 5000);
  });

  it("honors JWT_REFRESH_TOKEN_EXPIRY=7d to produce a +7 day expiry", async () => {
    process.env.JWT_REFRESH_TOKEN_EXPIRY = "7d";
    const { issueSession } = await import("@/lib/auth/session");
    const before = Date.now();
    const result = await issueSession("user-1", "customer");
    const expectedMs = before + 7 * 24 * 60 * 60 * 1000;
    expect(result.refreshTokenExpiresAt.getTime()).toBeGreaterThan(expectedMs - 5000);
    expect(result.refreshTokenExpiresAt.getTime()).toBeLessThan(expectedMs + 5000);
  });

  it("signs an accessToken carrying the caller-supplied role", async () => {
    const { issueSession } = await import("@/lib/auth/session");
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    const result = await issueSession("admin-user-1", "admin");
    const claims = await verifyAccessToken(result.accessToken);
    expect(claims.sub).toBe("admin-user-1");
    expect(claims.role).toBe("admin");
  });

  it("[AC-AUTH-007b] the persisted tokenHash does NOT equal the raw refreshToken, and hashing the raw token reproduces tokenHash (round-trip)", async () => {
    const { issueSession } = await import("@/lib/auth/session");
    const result = await issueSession("user-1", "customer");
    const persistedHash = createdRows[0]?.tokenHash;
    expect(persistedHash).toBeDefined();
    expect(persistedHash).not.toBe(result.refreshToken);
    const recomputedHash = createHash("sha256").update(result.refreshToken, "utf8").digest("hex");
    expect(persistedHash).toBe(recomputedHash);
  });
});
