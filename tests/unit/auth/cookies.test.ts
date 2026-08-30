import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M2 — src/lib/auth/cookies.ts
 * Traces: REQ-AUTH-008 (httpOnly + Secure + SameSite refresh-token cookie),
 * REQ-AUTH-023 (SameSite=Lax baseline). AC-AUTH-004 (cookie attributes).
 *
 * Design choice: builders return a Next.js `response.cookies.set(name, value,
 * options)`-shaped object ({ name, value, options }) rather than a raw
 * Set-Cookie header string, so M3/M4 route handlers can spread it directly:
 * `response.cookies.set(cookie.name, cookie.value, cookie.options)`.
 */

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

beforeEach(() => {
  delete process.env.COOKIE_DOMAIN;
});

afterEach(() => {
  // NODE_ENV is written via vi.stubEnv (Next.js declares it `readonly` on
  // NodeJS.ProcessEnv, so a direct assignment is a TS2540 compile error).
  // Unstub before restoreEnv so the stub registry is drained first.
  vi.unstubAllEnvs();
  restoreEnv();
});

describe("buildRefreshTokenCookie (REQ-AUTH-008)", () => {
  it("sets httpOnly: true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    expect(cookie.options.httpOnly).toBe(true);
  });

  it("sets sameSite: lax (REQ-AUTH-023 baseline)", async () => {
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    expect(cookie.options.sameSite).toBe("lax");
  });

  it("sets path: /", async () => {
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    expect(cookie.options.path).toBe("/");
  });

  it("derives secure: true when NODE_ENV is not development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    expect(cookie.options.secure).toBe(true);
  });

  it("derives secure: false when NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    expect(cookie.options.secure).toBe(false);
  });

  it("derives maxAge (seconds) from the given expiresAt Date", async () => {
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const expiresAt = new Date(Date.now() + 3600_000); // +1 hour
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", expiresAt);
    expect(cookie.options.maxAge).toBeGreaterThan(3500);
    expect(cookie.options.maxAge).toBeLessThanOrEqual(3600);
  });

  it("carries the raw refresh token as the cookie value", async () => {
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    expect(cookie.value).toBe("raw-refresh-token-value");
  });

  it("includes domain when COOKIE_DOMAIN is set", async () => {
    process.env.COOKIE_DOMAIN = "example.com";
    const { buildRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    expect(cookie.options.domain).toBe("example.com");
  });
});

describe("buildExpiredRefreshTokenCookie (logout — M4 will consume this)", () => {
  it("sets maxAge: 0 to expire the cookie immediately", async () => {
    const { buildExpiredRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildExpiredRefreshTokenCookie();
    expect(cookie.options.maxAge).toBe(0);
  });

  it("still carries httpOnly/sameSite/path attributes consistent with the live cookie", async () => {
    const { buildExpiredRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const cookie = buildExpiredRefreshTokenCookie();
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.path).toBe("/");
  });

  it("uses the same cookie name as the live refresh-token cookie", async () => {
    const { buildRefreshTokenCookie, buildExpiredRefreshTokenCookie } = await import("@/lib/auth/cookies");
    const live = buildRefreshTokenCookie("raw-refresh-token-value", new Date(Date.now() + 60_000));
    const expired = buildExpiredRefreshTokenCookie();
    expect(expired.name).toBe(live.name);
  });
});
