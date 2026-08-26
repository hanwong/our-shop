import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M5 — src/lib/auth/google-oauth.ts
 * Traces: REQ-AUTH-014 (consent URL + state), REQ-AUTH-016 (Google ID token
 * verification — signature/iss/aud library-provided; email_verified
 * application-added), AC-AUTH-013/015/015b.
 *
 * No live network / no real Google credentials in this sandbox —
 * google-auth-library's OAuth2Client is fully mocked; every test exercises
 * only this module's own logic plus the mocked library's call contract.
 */

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

beforeEach(() => {
  generateAuthUrlMock.mockReset();
  getTokenMock.mockReset();
  verifyIdTokenMock.mockReset();
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";
});

describe("generateState", () => {
  it("returns a cryptographically random, URL-safe, sufficiently long token that differs each call", async () => {
    const { generateState } = await import("@/lib/auth/google-oauth");
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("buildConsentUrl", () => {
  it("[AC-AUTH-013] calls OAuth2Client.generateAuthUrl with scope openid/email/profile and the given state, returning its URL verbatim", async () => {
    generateAuthUrlMock.mockReturnValue(
      "https://accounts.google.com/o/oauth2/v2/auth?scope=openid+email+profile&state=test-state-value&client_id=test-client-id"
    );
    const { buildConsentUrl } = await import("@/lib/auth/google-oauth");

    const url = buildConsentUrl("test-state-value");

    expect(url).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?scope=openid+email+profile&state=test-state-value&client_id=test-client-id"
    );
    expect(generateAuthUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ["openid", "email", "profile"],
        state: "test-state-value",
      })
    );
  });

  it("throws when GOOGLE_CLIENT_ID is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const { buildConsentUrl } = await import("@/lib/auth/google-oauth");
    expect(() => buildConsentUrl("s")).toThrow();
  });
});

describe("exchangeCodeAndVerifyIdToken", () => {
  it("returns { sub, email, emailVerified } on a fully valid token, calling verifyIdToken with the exchanged id_token + GOOGLE_CLIENT_ID as audience", async () => {
    getTokenMock.mockResolvedValue({ tokens: { id_token: "mock-id-token-1" } });
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: "google-sub-1", email: "User@Example.com", email_verified: true }),
    });
    const { exchangeCodeAndVerifyIdToken } = await import("@/lib/auth/google-oauth");

    const identity = await exchangeCodeAndVerifyIdToken("auth-code-1");

    expect(identity).toEqual({ sub: "google-sub-1", email: "User@Example.com", emailVerified: true });
    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: "mock-id-token-1",
      audience: "test-client-id",
    });
  });

  it("[RED case: bad signature] rejects when verifyIdToken rejects with an invalid-signature error (library-provided check — see the provenance comment in google-oauth.ts)", async () => {
    getTokenMock.mockResolvedValue({ tokens: { id_token: "mock-id-token-2" } });
    verifyIdTokenMock.mockRejectedValue(new Error("Invalid token signature: mock-id-token-2"));
    const { exchangeCodeAndVerifyIdToken } = await import("@/lib/auth/google-oauth");

    await expect(exchangeCodeAndVerifyIdToken("auth-code-2")).rejects.toThrow();
  });

  it("[RED case: bad iss] rejects when verifyIdToken rejects with an invalid-issuer error (library-provided check)", async () => {
    getTokenMock.mockResolvedValue({ tokens: { id_token: "mock-id-token-3" } });
    verifyIdTokenMock.mockRejectedValue(
      new Error("Invalid issuer, expected one of [accounts.google.com,https://accounts.google.com], but got evil.example.com")
    );
    const { exchangeCodeAndVerifyIdToken } = await import("@/lib/auth/google-oauth");

    await expect(exchangeCodeAndVerifyIdToken("auth-code-3")).rejects.toThrow();
  });

  it("[RED case: bad aud] rejects when verifyIdToken rejects with a wrong-recipient (audience mismatch) error (library-provided check)", async () => {
    getTokenMock.mockResolvedValue({ tokens: { id_token: "mock-id-token-4" } });
    verifyIdTokenMock.mockRejectedValue(new Error("Wrong recipient, payload audience != requiredAudience"));
    const { exchangeCodeAndVerifyIdToken } = await import("@/lib/auth/google-oauth");

    await expect(exchangeCodeAndVerifyIdToken("auth-code-4")).rejects.toThrow();
  });

  it("[AC-AUTH-015 / RED case: email_verified=false] rejects when the verified payload's email_verified is false (application-added check, NOT library-provided)", async () => {
    getTokenMock.mockResolvedValue({ tokens: { id_token: "mock-id-token-5" } });
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: "google-sub-5", email: "unverified@example.com", email_verified: false }),
    });
    const { exchangeCodeAndVerifyIdToken } = await import("@/lib/auth/google-oauth");

    await expect(exchangeCodeAndVerifyIdToken("auth-code-5")).rejects.toThrow(/email.*verif/i);
  });

  it("throws when getToken() resolves with no id_token", async () => {
    getTokenMock.mockResolvedValue({ tokens: {} });
    const { exchangeCodeAndVerifyIdToken } = await import("@/lib/auth/google-oauth");

    await expect(exchangeCodeAndVerifyIdToken("auth-code-6")).rejects.toThrow();
  });

  it("propagates a getToken() rejection (code-exchange/network failure — acceptance.md §7 edge case, independent of state validation)", async () => {
    getTokenMock.mockRejectedValue(new Error("network error contacting Google"));
    const { exchangeCodeAndVerifyIdToken } = await import("@/lib/auth/google-oauth");

    await expect(exchangeCodeAndVerifyIdToken("auth-code-7")).rejects.toThrow();
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });
});

describe("oauth_state cookie builders", () => {
  it("buildOAuthStateCookie sets httpOnly, sameSite=lax, and a maxAge of at most 10 minutes", async () => {
    const { buildOAuthStateCookie, OAUTH_STATE_COOKIE_NAME } = await import("@/lib/auth/google-oauth");
    const cookie = buildOAuthStateCookie("state-xyz");

    expect(cookie.name).toBe(OAUTH_STATE_COOKIE_NAME);
    expect(cookie.value).toBe("state-xyz");
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.maxAge).toBeGreaterThan(0);
    expect(cookie.options.maxAge).toBeLessThanOrEqual(600);
  });

  it("buildExpiredOAuthStateCookie has an empty value and maxAge 0", async () => {
    const { buildExpiredOAuthStateCookie, OAUTH_STATE_COOKIE_NAME } = await import("@/lib/auth/google-oauth");
    const cookie = buildExpiredOAuthStateCookie();

    expect(cookie.name).toBe(OAUTH_STATE_COOKIE_NAME);
    expect(cookie.value).toBe("");
    expect(cookie.options.maxAge).toBe(0);
  });
});

describe("buildAccessTokenHandoffCookie", () => {
  it("sets a non-httpOnly, short-lived (<=60s) cookie carrying the access token", async () => {
    const { buildAccessTokenHandoffCookie, OAUTH_ACCESS_TOKEN_HANDOFF_COOKIE_NAME } = await import(
      "@/lib/auth/google-oauth"
    );
    const cookie = buildAccessTokenHandoffCookie("mock-access-token");

    expect(cookie.name).toBe(OAUTH_ACCESS_TOKEN_HANDOFF_COOKIE_NAME);
    expect(cookie.value).toBe("mock-access-token");
    expect(cookie.options.httpOnly).toBe(false);
    expect(cookie.options.maxAge).toBeGreaterThan(0);
    expect(cookie.options.maxAge).toBeLessThanOrEqual(60);
  });
});
