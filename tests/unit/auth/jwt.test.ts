import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

/**
 * SPEC-AUTH-001 M2 — src/lib/auth/jwt.ts
 * Traces: REQ-AUTH-006 (claim shape — no PII), REQ-AUTH-007 (expiry env var),
 * REQ-AUTH-020 (algorithm whitelist + iss/aud/exp verification).
 * AC-AUTH-004 (claim shape), AC-AUTH-004b (expiry env var), AC-AUTH-019
 * (alg whitelist), AC-AUTH-020 (exp/iss/aud — 4 independent failure-mode
 * test cases, satisfying the "3+ individual test cases" requirement).
 */

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-bytes-long-for-hs256";
  delete process.env.JWT_ACCESS_TOKEN_EXPIRY;
});

afterEach(() => {
  restoreEnv();
});

describe("signAccessToken (REQ-AUTH-006, REQ-AUTH-007)", () => {
  it("produces a token whose claims are EXACTLY sub/iat/exp/iss/aud/jti/role and nothing else", async () => {
    const { signAccessToken, verifyAccessToken } = await import("@/lib/auth/jwt");
    const token = await signAccessToken({ sub: "user-123", role: "customer" });
    const claims = await verifyAccessToken(token);
    const claimKeys = Object.keys(claims).sort();
    expect(claimKeys).toEqual(["aud", "exp", "iat", "iss", "jti", "role", "sub"]);
    expect(claims.sub).toBe("user-123");
    expect(claims.role).toBe("customer");
  });

  it("defaults access-token expiry to 15 minutes (900s) when JWT_ACCESS_TOKEN_EXPIRY is unset", async () => {
    delete process.env.JWT_ACCESS_TOKEN_EXPIRY;
    const { signAccessToken, verifyAccessToken } = await import("@/lib/auth/jwt");
    const token = await signAccessToken({ sub: "user-1", role: "customer" });
    const claims = await verifyAccessToken(token);
    expect(claims.exp - claims.iat).toBe(900);
  });

  it("honors JWT_ACCESS_TOKEN_EXPIRY=5m to produce a 300s expiry window", async () => {
    process.env.JWT_ACCESS_TOKEN_EXPIRY = "5m";
    const { signAccessToken, verifyAccessToken } = await import("@/lib/auth/jwt");
    const token = await signAccessToken({ sub: "user-1", role: "customer" });
    const claims = await verifyAccessToken(token);
    expect(claims.exp - claims.iat).toBe(300);
  });

  it("generates a unique jti per call", async () => {
    const { signAccessToken, verifyAccessToken } = await import("@/lib/auth/jwt");
    const tokenA = await signAccessToken({ sub: "user-1", role: "customer" });
    const tokenB = await signAccessToken({ sub: "user-1", role: "customer" });
    const claimsA = await verifyAccessToken(tokenA);
    const claimsB = await verifyAccessToken(tokenB);
    expect(claimsA.jti).not.toBe(claimsB.jti);
  });
});

describe("verifyAccessToken failure modes (REQ-AUTH-020 / AC-AUTH-019 / AC-AUTH-020)", () => {
  it("[1] rejects a token signed with alg: none (algorithm confusion)", async () => {
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    // jose refuses to sign with "none" via SignJWT's normal API, so we hand
    // craft an unsigned JWT (header.payload.) to simulate an attacker-forged
    // alg:none token arriving at verification.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "attacker",
        role: "admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        iss: "our-shop",
        aud: "our-shop-api",
        jti: "forged",
      }),
    ).toString("base64url");
    const forgedToken = `${header}.${payload}.`;
    await expect(verifyAccessToken(forgedToken)).rejects.toThrow();
  });

  it("[2] rejects a token signed with an algorithm outside the allowlist (e.g. HS384 when only HS256 is allowed)", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const wrongAlgToken = await new SignJWT({
      role: "customer",
      iss: "our-shop",
      aud: "our-shop-api",
    })
      .setProtectedHeader({ alg: "HS384" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .setJti("some-jti")
      .sign(secret);
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    await expect(verifyAccessToken(wrongAlgToken)).rejects.toThrow();
  });

  it("[3] rejects a token with an unexpected iss claim", async () => {
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    // A token that is otherwise validly signed and structured, but carries
    // the wrong iss — verifyAccessToken must reject it independently of
    // signature validity.
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const badIssToken = await new SignJWT({
      role: "customer",
      iss: "malicious-issuer",
      aud: "our-shop-api",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .setJti("some-jti")
      .sign(secret);
    await expect(verifyAccessToken(badIssToken)).rejects.toThrow();
  });

  it("[4] rejects a token with an unexpected aud claim", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const badAudToken = await new SignJWT({
      role: "customer",
      iss: "our-shop",
      aud: "some-other-audience",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .setJti("some-jti")
      .sign(secret);
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    await expect(verifyAccessToken(badAudToken)).rejects.toThrow();
  });

  it("[5] rejects an expired token", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const expiredToken = await new SignJWT({
      role: "customer",
      iss: "our-shop",
      aud: "our-shop-api",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 2000)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1000)
      .setJti("some-jti")
      .sign(secret);
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    await expect(verifyAccessToken(expiredToken)).rejects.toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("a-completely-different-secret-value-here");
    const wrongSecretToken = await new SignJWT({
      role: "customer",
      iss: "our-shop",
      aud: "our-shop-api",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .setJti("some-jti")
      .sign(wrongSecret);
    const { verifyAccessToken } = await import("@/lib/auth/jwt");
    await expect(verifyAccessToken(wrongSecretToken)).rejects.toThrow();
  });
});
