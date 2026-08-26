import { describe, it, expect, beforeEach, vi } from "vitest";
import { CSRF_TEST_TOKEN } from "../../../helpers/csrf";

/**
 * SPEC-AUTH-001 M4 — src/app/api/auth/logout/route.ts
 * Traces: REQ-AUTH-013 (revoke THIS token only, expire the cookie),
 * AC-AUTH-011 (revoke + cookie expiry), AC-AUTH-012 is covered end-to-end in
 * tests/integration/auth/logout-then-refresh.test.ts (exercises the
 * interaction between logout and refresh).
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

let refreshTokens: FakeRefreshTokenRow[] = [];
let nextRtId = 1;

vi.mock("@/lib/db", () => {
  const refreshTokenDelegate = {
    findFirst: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
      return refreshTokens.find((r) => r.tokenHash === where.tokenHash) ?? null;
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
  return {
    prisma: {
      refreshToken: refreshTokenDelegate,
    },
  };
});

beforeEach(() => {
  refreshTokens = [];
  nextRtId = 1;
});

/**
 * `csrfCookie`/`csrfHeader` default to the shared CSRF_TEST_TOKEN fixture so
 * every pre-existing call site (`makeRequest(rawToken)`) passes the M6
 * follow-up CSRF gate unchanged (REQ-AUTH-023). Pass `null` to omit either
 * half, or a distinct string to construct a deliberate mismatch — both used
 * by the CSRF-rejection tests below.
 */
interface MakeRequestOptions {
  csrfCookie?: string | null;
  csrfHeader?: string | null;
}

function makeRequest(
  cookieValue: string | undefined,
  { csrfCookie = CSRF_TEST_TOKEN, csrfHeader = CSRF_TEST_TOKEN }: MakeRequestOptions = {}
): Request {
  const cookieParts: string[] = [];
  if (cookieValue !== undefined) {
    cookieParts.push(`refresh_token=${cookieValue}`);
  }
  if (csrfCookie !== null) {
    cookieParts.push(`csrf_token=${csrfCookie}`);
  }
  const headers: Record<string, string> = {};
  if (cookieParts.length > 0) {
    headers["cookie"] = cookieParts.join("; ");
  }
  if (csrfHeader !== null) {
    headers["x-csrf-token"] = csrfHeader;
  }
  return new Request("http://localhost/api/auth/logout", { method: "POST", headers });
}

async function seedRefreshToken(
  overrides: Partial<FakeRefreshTokenRow> = {}
): Promise<{ rawToken: string; row: FakeRefreshTokenRow }> {
  const { hashRefreshToken } = await import("@/lib/auth/session");
  const rawToken = `raw-token-${nextRtId}-${Math.random().toString(36).slice(2)}`;
  const row: FakeRefreshTokenRow = {
    id: `rt-${nextRtId++}`,
    userId: "user-1",
    tokenHash: hashRefreshToken(rawToken),
    familyId: `family-${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null,
    replacedByTokenId: null,
    createdAt: new Date(),
    ...overrides,
  };
  refreshTokens.push(row);
  return { rawToken, row };
}

describe("POST /api/auth/logout", () => {
  it("[AC-AUTH-011] revokes the token's DB row and expires the refresh-token cookie (Max-Age=0)", async () => {
    const { rawToken, row } = await seedRefreshToken();
    const { POST } = await import("@/app/api/auth/logout/route");

    const response = await POST(makeRequest(rawToken));
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/refresh_token=;/);
    expect(setCookie).toMatch(/Max-Age=0/i);

    expect(row.revokedAt).not.toBeNull();
  });

  it("[REQ-AUTH-013] logout revokes ONLY the presented token, not sibling tokens in the same family", async () => {
    const familyId = "shared-family-logout";
    const { rawToken: rawA } = await seedRefreshToken({ familyId });
    const { row: rowB } = await seedRefreshToken({ familyId });
    const { POST } = await import("@/app/api/auth/logout/route");

    await POST(makeRequest(rawA));
    expect(rowB.revokedAt).toBeNull();
  });

  it("is idempotent: a token not found in the DB (already logged out / invalid) still returns 200 and expires the cookie", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST(makeRequest("never-issued-token"));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  it("is idempotent when no refresh cookie is present at all: still returns 200 and expires the cookie", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST(makeRequest(undefined));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  it("[REQ-AUTH-023/AC-AUTH-023] rejects a request with no csrf_token cookie and no X-CSRF-Token header: 403, no DB write", async () => {
    const { rawToken, row } = await seedRefreshToken();
    const { POST } = await import("@/app/api/auth/logout/route");

    const response = await POST(makeRequest(rawToken, { csrfCookie: null, csrfHeader: null }));
    expect(response.status).toBe(403);

    // No revocation occurred — the CSRF gate rejected before any DB access.
    expect(row.revokedAt).toBeNull();
  });

  it("[REQ-AUTH-023/AC-AUTH-023] rejects a request where the csrf_token cookie and X-CSRF-Token header do not match: 403, no DB write", async () => {
    const { rawToken, row } = await seedRefreshToken();
    const { POST } = await import("@/app/api/auth/logout/route");

    const response = await POST(
      makeRequest(rawToken, { csrfCookie: CSRF_TEST_TOKEN, csrfHeader: "a-different-token" })
    );
    expect(response.status).toBe(403);

    // No revocation occurred — the CSRF gate rejected before any DB access.
    expect(row.revokedAt).toBeNull();
  });
});
