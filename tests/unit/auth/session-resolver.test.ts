import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SPEC-AUTH-002 M1 — src/lib/auth/session-resolver.ts
 *
 * Traces: REQ-AUTH-033 (role-agnostic valid-session resolution),
 * REQ-AUTH-034 (read-only — no rotation, no new RefreshToken row),
 * REQ-AUTH-035 (every invalid-session reason resolves to the same `null`).
 * plan.md §B — `resolveAdminSession`(SPEC-ADMIN-001)의 알고리즘을 그대로
 * 일반화하되 `role !== "admin"` 필터만 제거한 버전.
 *
 * 모킹 전략은 tests/unit/admin/admin-session.test.ts를 그대로 재사용한다
 * (plan.md §G) — @/lib/db를 mock하고, hashRefreshToken()은 실제 함수를
 * 호출해 기대 해시를 계산한다.
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

describe("resolveSession — AC-AUTH-032 역할 무관 유효 세션 해석", () => {
  it("(a) customer 케이스 — { userId, role: 'customer' } 반환", async () => {
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const rawToken = "raw-customer-refresh-token";
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-cust",
      tokenHash: hashRefreshToken(rawToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-cust", role: "customer" },
    });
    const { resolveSession } = await import("@/lib/auth/session-resolver");

    expect(await resolveSession(fakeCookieStore(rawToken))).toEqual({
      userId: "u-cust",
      role: "customer",
    });
  });

  it("(b) admin 케이스 — { userId, role: 'admin' } 반환 (admin 전용 필터 없음)", async () => {
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const rawToken = "raw-admin-refresh-token";
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-admin",
      tokenHash: hashRefreshToken(rawToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-admin", role: "admin" },
    });
    const { resolveSession } = await import("@/lib/auth/session-resolver");

    expect(await resolveSession(fakeCookieStore(rawToken))).toEqual({
      userId: "u-admin",
      role: "admin",
    });
  });
});

describe("resolveSession — AC-AUTH-033 읽기 전용, 회전·재발급 없음", () => {
  it("findFirst 정확히 1회, create/update/updateMany 미호출", async () => {
    const { hashRefreshToken } = await import("@/lib/auth/session");
    const rawToken = "raw-token";
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-1",
      tokenHash: hashRefreshToken(rawToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-1", role: "customer" },
    });
    const { resolveSession } = await import("@/lib/auth/session-resolver");

    await resolveSession(fakeCookieStore(rawToken));

    expect(refreshToken.findFirst).toHaveBeenCalledTimes(1);
    expect(refreshToken.create).not.toHaveBeenCalled();
    expect(refreshToken.update).not.toHaveBeenCalled();
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("resolveSession — AC-AUTH-034 모든 실패 경로가 동일한 null", () => {
  it("(a) 쿠키 부재 — null, DB 조회 없음(단락)", async () => {
    const { resolveSession } = await import("@/lib/auth/session-resolver");

    expect(await resolveSession(fakeCookieStore(undefined))).toBeNull();
    expect(refreshToken.findFirst).not.toHaveBeenCalled();
  });

  it("(b) 매칭 레코드 없음 — null", async () => {
    refreshToken.findFirst.mockResolvedValue(null);
    const { resolveSession } = await import("@/lib/auth/session-resolver");

    expect(await resolveSession(fakeCookieStore("unknown-token"))).toBeNull();
  });

  it("(c) revokedAt 설정됨(폐기) — null", async () => {
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-revoked",
      tokenHash: "hash-revoked",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1_000_000),
      user: { id: "u-1", role: "customer" },
    });
    const { resolveSession } = await import("@/lib/auth/session-resolver");

    expect(await resolveSession(fakeCookieStore("revoked-token"))).toBeNull();
  });

  it("(d) expiresAt이 과거(만료) — null", async () => {
    refreshToken.findFirst.mockResolvedValue({
      id: "rt-expired",
      tokenHash: "hash-expired",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      user: { id: "u-1", role: "customer" },
    });
    const { resolveSession } = await import("@/lib/auth/session-resolver");

    expect(await resolveSession(fakeCookieStore("expired-token"))).toBeNull();
  });
});
