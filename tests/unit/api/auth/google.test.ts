import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M5 — src/app/api/auth/google/route.ts
 * Traces: REQ-AUTH-014 (consent URL + CSRF state), AC-AUTH-013.
 *
 * google-auth-library's OAuth2Client is fully mocked (no live network / no
 * real Google credentials in this sandbox); only `generateAuthUrl` is
 * exercised by this route.
 */

const { generateAuthUrlMock } = vi.hoisted(() => ({
  generateAuthUrlMock: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: generateAuthUrlMock,
  })),
}));

beforeEach(() => {
  generateAuthUrlMock.mockReset();
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";
});

describe("GET /api/auth/google", () => {
  it("[AC-AUTH-013] 302-redirects to the Google consent URL (scope=openid email profile, URL-encoded, + a state param) and sets the oauth_state cookie", async () => {
    generateAuthUrlMock.mockReturnValue(
      "https://accounts.google.com/o/oauth2/v2/auth?scope=openid+email+profile&state=STATEVALUE&client_id=test-client-id"
    );
    const { GET } = await import("@/app/api/auth/google/route");

    const response = await GET();

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("accounts.google.com");
    expect(location).toMatch(/scope=openid(\+|%20)email(\+|%20)profile/);
    expect(location).toContain("state=");

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/oauth_state=/);
    expect(setCookie).toMatch(/HttpOnly/i);

    // The route must forward a fresh, non-empty state to generateAuthUrl —
    // not a hardcoded/empty value — and request exactly the 3 REQ-AUTH-014
    // scopes.
    expect(generateAuthUrlMock).toHaveBeenCalledTimes(1);
    const callArgs = generateAuthUrlMock.mock.calls[0]![0] as { scope: string[]; state: string };
    expect(callArgs.scope).toEqual(["openid", "email", "profile"]);
    expect(typeof callArgs.state).toBe("string");
    expect(callArgs.state.length).toBeGreaterThan(0);
  });

  it("sets a DIFFERENT state on each call (fresh CSRF token per request)", async () => {
    generateAuthUrlMock.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mock=1");
    const { GET } = await import("@/app/api/auth/google/route");

    await GET();
    await GET();

    const [firstCallArgs, secondCallArgs] = generateAuthUrlMock.mock.calls as Array<[{ state: string }]>;
    expect(firstCallArgs![0].state).not.toBe(secondCallArgs![0].state);
  });
});
