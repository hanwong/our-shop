import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-ADMIN-001 M1 — src/features/admin/services/admin-session.ts
 *
 * Traces: REQ-ADMIN-001 (valid admin refresh-token cookie resolves to an
 * admin session), REQ-ADMIN-002 (read-only — no rotation, no new
 * RefreshToken row), REQ-ADMIN-003 (every invalid-session reason resolves
 * to the same `null`, never a distinguishable error). design.md §2 —
 * resolveAdminSession() 7-step algorithm.
 *
 * No live PostgreSQL in this sandbox — @/lib/db is mocked at the delegate
 * level, the same seam tests/unit/payments/payment-repository.test.ts
 * already mocks. hashRefreshToken() (session.ts) is NOT mocked — it is a
 * pure SHA-256 function, so the test calls the real one to compute the
 * expected lookup key, exercising the same "hash then look up" path the
 * implementation uses.
 */

const refreshToken = {
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({ prisma: { refreshToken } }));

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeCookieStore(value: string | undefined) {
  return { get: vi.fn().mockReturnValue(value === undefined ? undefined : { value }) };
}

describe("resolveAdminSession — AC-ADMIN-001 valid admin session", () => {
  it("resolves { userId, role: 'admin' } for a valid, unexpired, unrevoked admin-owned token", async () => {
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const rawToken = "raw-admin-refresh-token";
    const expectedHash = hashRefreshToken(rawToken);
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-1",
      tokenHash: expectedHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-admin", role: "admin" },
    });
    const { resolveAdminSession } = await import("@/features/admin/services/admin-session");

    const result = await resolveAdminSession(fakeCookieStore(rawToken));

    expect(result).toEqual({ userId: "u-admin", role: "admin" });
    expect(refreshToken.findFirst).toHaveBeenCalledWith({
      where: { tokenHash: expectedHash },
      include: { user: true },
    });
  });
});

describe("resolveAdminSession — AC-ADMIN-002 no rotation / no write", () => {
  it("performs a read-only lookup — no RefreshToken row is created, updated, or mutated", async () => {
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const rawToken = "raw-admin-refresh-token";
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-1",
      tokenHash: hashRefreshToken(rawToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-admin", role: "admin" },
    });
    const { resolveAdminSession } = await import("@/features/admin/services/admin-session");

    await resolveAdminSession(fakeCookieStore(rawToken));

    expect(refreshToken.findFirst).toHaveBeenCalledTimes(1);
    expect(refreshToken.create).not.toHaveBeenCalled();
    expect(refreshToken.update).not.toHaveBeenCalled();
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("resolveAdminSession — AC-ADMIN-003 invalid sessions all resolve to the same null", () => {
  it("(a) no refresh-token cookie present — returns null without querying the DB", async () => {
    const { resolveAdminSession } = await import("@/features/admin/services/admin-session");

    const result = await resolveAdminSession(fakeCookieStore(undefined));

    expect(result).toBeNull();
    expect(refreshToken.findFirst).not.toHaveBeenCalled();
  });

  it("(b) expired refresh token — returns null", async () => {
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-2",
      tokenHash: "hash-expired",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      user: { id: "u-admin", role: "admin" },
    });
    const { resolveAdminSession } = await import("@/features/admin/services/admin-session");

    expect(await resolveAdminSession(fakeCookieStore("expired-token"))).toBeNull();
  });

  it("(c) revoked refresh token — returns null", async () => {
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-3",
      tokenHash: "hash-revoked",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-admin", role: "admin" },
    });
    const { resolveAdminSession } = await import("@/features/admin/services/admin-session");

    expect(await resolveAdminSession(fakeCookieStore("revoked-token"))).toBeNull();
  });

  it("(d) valid, unrevoked, unexpired token but role is customer — returns null", async () => {
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-4",
      tokenHash: "hash-customer",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-cust", role: "customer" },
    });
    const { resolveAdminSession } = await import("@/features/admin/services/admin-session");

    expect(await resolveAdminSession(fakeCookieStore("customer-token"))).toBeNull();
  });

  it("no RefreshToken row found for the hash — returns null", async () => {
    refreshToken.findFirst.mockResolvedValue(null);
    const { resolveAdminSession } = await import("@/features/admin/services/admin-session");

    expect(await resolveAdminSession(fakeCookieStore("unknown-token"))).toBeNull();
  });
});
