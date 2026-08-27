import { describe, it, expect } from "vitest";

/**
 * SPEC-AUTH-001 M6 — src/lib/auth/csrf.ts
 * Traces: REQ-AUTH-023 (double-submit-cookie CSRF defense on cookie-based
 * /auth/refresh and /auth/logout), AC-AUTH-023.
 */

describe("generateCsrfToken", () => {
  it("produces a non-empty, base64url-safe token that differs across calls", async () => {
    const { generateCsrfToken } = await import("@/lib/auth/csrf");
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("buildCsrfCookie", () => {
  it("[AC-AUTH-023 static check] is NOT httpOnly (client JS must read it to echo it back) and carries SameSite=Lax, path=/", async () => {
    const { buildCsrfCookie } = await import("@/lib/auth/csrf");
    const cookie = buildCsrfCookie("some-token");
    expect(cookie.name).toBe("csrf_token");
    expect(cookie.value).toBe("some-token");
    expect(cookie.options.httpOnly).toBe(false);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.path).toBe("/");
  });

  it("derives Secure from NODE_ENV — false in development, true otherwise", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string>).NODE_ENV = "development";
      const { buildCsrfCookie } = await import("@/lib/auth/csrf");
      expect(buildCsrfCookie("t").options.secure).toBe(false);
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(buildCsrfCookie("t").options.secure).toBe(true);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });
});

describe("verifyCsrfRequest (AC-AUTH-023)", () => {
  it("returns true when the csrf_token cookie matches the X-CSRF-Token header", async () => {
    const { verifyCsrfRequest } = await import("@/lib/auth/csrf");
    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "csrf_token=abc123", "x-csrf-token": "abc123" },
    });
    expect(verifyCsrfRequest(request)).toBe(true);
  });

  it("returns false when the X-CSRF-Token header is missing", async () => {
    const { verifyCsrfRequest } = await import("@/lib/auth/csrf");
    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "csrf_token=abc123" },
    });
    expect(verifyCsrfRequest(request)).toBe(false);
  });

  it("returns false when the csrf_token cookie is missing", async () => {
    const { verifyCsrfRequest } = await import("@/lib/auth/csrf");
    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { "x-csrf-token": "abc123" },
    });
    expect(verifyCsrfRequest(request)).toBe(false);
  });

  it("returns false when the cookie and header values mismatch", async () => {
    const { verifyCsrfRequest } = await import("@/lib/auth/csrf");
    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "csrf_token=abc123", "x-csrf-token": "different-value" },
    });
    expect(verifyCsrfRequest(request)).toBe(false);
  });
});
