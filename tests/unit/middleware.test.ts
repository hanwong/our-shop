import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SPEC-AUTH-001 M6 — src/middleware.ts
 * Traces: REQ-AUTH-022 (/admin RBAC gate — role==="admin" required),
 * AC-AUTH-022(a)/(b).
 */

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
});

function makeAdminRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }
  return new NextRequest("http://localhost/admin/dashboard", { headers });
}

describe("middleware (/admin RBAC gate)", () => {
  it("[AC-AUTH-022a] passes a request through when the access token's role is admin", async () => {
    const { signAccessToken } = await import("@/lib/auth/jwt");
    const { middleware } = await import("@/middleware");
    const token = await signAccessToken({ sub: "admin-1", role: "admin" });
    const response = await middleware(makeAdminRequest(token));
    expect(response.headers.get("location")).toBeNull();
  });

  it("[AC-AUTH-022b] rejects a request with no Authorization header (no valid session)", async () => {
    const { middleware } = await import("@/middleware");
    const response = await middleware(makeAdminRequest());
    expect(response.headers.get("location")).toBeTruthy();
  });

  it("[AC-AUTH-022b] rejects a request carrying a valid but non-admin (customer) access token", async () => {
    const { signAccessToken } = await import("@/lib/auth/jwt");
    const { middleware } = await import("@/middleware");
    const token = await signAccessToken({ sub: "user-1", role: "customer" });
    const response = await middleware(makeAdminRequest(token));
    expect(response.headers.get("location")).toBeTruthy();
  });

  it("[AC-AUTH-022b] rejects a request carrying a malformed/invalid access token", async () => {
    const { middleware } = await import("@/middleware");
    const response = await middleware(makeAdminRequest("not-a-real-jwt"));
    expect(response.headers.get("location")).toBeTruthy();
  });
});
