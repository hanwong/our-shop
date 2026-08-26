import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M6 — src/lib/auth/rate-limit.ts
 * Traces: REQ-AUTH-021 (in-memory sliding-window limiter, 5 requests/60s
 * threshold, 15-minute soft lockout, per-endpoint independent verification),
 * AC-AUTH-021.
 */

beforeEach(async () => {
  const { __resetRateLimitStoreForTests } = await import("@/lib/auth/rate-limit");
  __resetRateLimitStoreForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit (REQ-AUTH-021)", () => {
  it("allows the first 5 requests within a 60s window", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("test:key-a").allowed).toBe(true);
    }
  });

  it("[AC-AUTH-021] blocks the 6th request within the same window", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test:key-b");
    }
    const sixth = checkRateLimit("test:key-b");
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
  });

  it("[AC-AUTH-021] stays locked out well within the 15-minute lockout window", async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 6; i++) {
      checkRateLimit("test:key-c");
    }
    vi.advanceTimersByTime(60_000); // the 60s counting window has elapsed, but the 15-min lockout has not
    expect(checkRateLimit("test:key-c").allowed).toBe(false);
  });

  it("[AC-AUTH-021] allows a request again once the 15-minute lockout has fully elapsed (fast-forwarded via fake timers, not a real 15-minute wait)", async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 6; i++) {
      checkRateLimit("test:key-d");
    }
    vi.advanceTimersByTime(15 * 60_000 + 1);
    expect(checkRateLimit("test:key-d").allowed).toBe(true);
  });

  it("[AC-AUTH-021] tracks distinct keys independently — a lockout on one key/endpoint does not block another", async () => {
    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 6; i++) {
      checkRateLimit("login:ip:1.2.3.4");
    }
    expect(checkRateLimit("login:ip:1.2.3.4").allowed).toBe(false);
    expect(checkRateLimit("refresh:ip:1.2.3.4").allowed).toBe(true);
    expect(checkRateLimit("login:ip:5.6.7.8").allowed).toBe(true);
  });
});

describe("checkIpRateLimit / checkAccountRateLimit (route-handler convenience wrappers)", () => {
  it("checkIpRateLimit skips the check entirely (always allowed) when the IP is undeterminable", async () => {
    const { checkIpRateLimit } = await import("@/lib/auth/rate-limit");
    const request = new Request("http://localhost/api/auth/login");
    for (let i = 0; i < 20; i++) {
      expect(checkIpRateLimit("login", request).allowed).toBe(true);
    }
  });

  it("[AC-AUTH-021] checkIpRateLimit blocks the 6th request from the SAME determinable IP within the window", async () => {
    const { checkIpRateLimit } = await import("@/lib/auth/rate-limit");
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "198.51.100.9" },
    });
    for (let i = 0; i < 5; i++) {
      expect(checkIpRateLimit("login", request).allowed).toBe(true);
    }
    expect(checkIpRateLimit("login", request).allowed).toBe(false);
  });

  it("[AC-AUTH-021] checkIpRateLimit tracks endpoints independently for the same IP", async () => {
    const { checkIpRateLimit } = await import("@/lib/auth/rate-limit");
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    });
    for (let i = 0; i < 6; i++) {
      checkIpRateLimit("login", request);
    }
    expect(checkIpRateLimit("login", request).allowed).toBe(false);
    expect(checkIpRateLimit("refresh", request).allowed).toBe(true);
    expect(checkIpRateLimit("google-callback", request).allowed).toBe(true);
  });

  it("checkAccountRateLimit skips the check (always allowed) when no identifier is given", async () => {
    const { checkAccountRateLimit } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 20; i++) {
      expect(checkAccountRateLimit("login", undefined).allowed).toBe(true);
    }
  });

  it("[AC-AUTH-021] checkAccountRateLimit blocks the 6th request for the SAME account (case-insensitive) within the window", async () => {
    const { checkAccountRateLimit } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) {
      expect(checkAccountRateLimit("login", "User@Example.com").allowed).toBe(true);
    }
    expect(checkAccountRateLimit("login", "user@example.com").allowed).toBe(false);
  });
});

describe("extractClientIp", () => {
  it("extracts the first entry of a comma-separated x-forwarded-for header", async () => {
    const { extractClientIp } = await import("@/lib/auth/rate-limit");
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.4, 70.41.3.18" },
    });
    expect(extractClientIp(request)).toBe("203.0.113.4");
  });

  it("returns a fallback value when no x-forwarded-for header is present", async () => {
    const { extractClientIp } = await import("@/lib/auth/rate-limit");
    const request = new Request("http://localhost/api/auth/login");
    expect(extractClientIp(request)).toBe("unknown");
  });
});
