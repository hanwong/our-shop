import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, dummyCompare } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";
import { buildRefreshTokenCookie } from "@/lib/auth/cookies";
import { checkIpRateLimit } from "@/lib/auth/rate-limit";
import { buildCsrfCookie, generateCsrfToken } from "@/lib/auth/csrf";

/**
 * SPEC-AUTH-001 M3 — POST /api/auth/login
 * Traces: REQ-AUTH-004 (valid login issues a token pair via the shared
 * session-issuance path), REQ-AUTH-005 (dummy-compare timing equalization +
 * a single generic failure message shared by both the not-found and
 * wrong-password paths — the client MUST NOT be able to distinguish them via
 * message content, status code, or timing), REQ-AUTH-006 (claim shape, via
 * the shared JWT path in jwt.ts/session.ts).
 *
 * SPEC-AUTH-001 M6 additive hardening — REQ-AUTH-021 (rate limit: >5
 * requests/60s from the same IP -> 429 + 15-minute soft lockout), REQ-AUTH-023
 * (a csrf_token double-submit cookie is set alongside the refresh-token
 * cookie on every session issuance — login does not itself require CSRF
 * *verification*, since it is the ORIGIN of a session, not a cookie-
 * authenticated mutation; see csrf.ts).
 *
 * @MX:DEBT this route deliberately wires ONLY the IP-keyed half of
 * REQ-AUTH-021 ("동일 IP 또는 동일 계정" — same IP OR same account),
 * omitting the account-keyed half (`checkAccountRateLimit`, implemented and
 * unit-tested in rate-limit.ts but NOT called here). Wiring the account-
 * keyed check deterministically breaks the pre-existing M3 integration test
 * tests/integration/auth/login.test.ts (AC-AUTH-005), which issues 30
 * repeated requests against the SAME email to gather a statistical timing
 * sample — the 6th such request would be rejected with 429 before the
 * dummy-compare/compare timing path even runs, making the timing
 * measurement impossible. This is a genuine SPEC-level conflict between
 * REQ-AUTH-021 (account-keyed limiting) and REQ-AUTH-005/AC-AUTH-005 (which
 * requires 30 uninterrupted same-account requests), not an implementation
 * gap — see this milestone's self-verification report's Blocker section.
 * @MX:CEILING IP-only enforcement holds until AC-AUTH-005's test
 * methodology is revised (e.g., to use per-sample rate-limit resets or
 * distinct synthetic accounts) or the SPEC explicitly narrows
 * REQ-AUTH-021's login scope to IP-only.
 * @MX:UPGRADE re-add `checkAccountRateLimit("login", email)` here once
 * AC-AUTH-005's test methodology is reconciled with account-keyed rate
 * limiting (tracked as this milestone's primary blocker).
 */

// AC-AUTH-005/AC-AUTH-006: identical wording on both failure branches so the
// client cannot distinguish "no such user" from "wrong password".
const GENERIC_LOGIN_ERROR = "Invalid email or password";

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  // REQ-AUTH-021 — IP-keyed check runs before any DB access; skipped when
  // the IP cannot be determined (see checkIpRateLimit's doc comment).
  if (!checkIpRateLimit("login", request).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: LoginRequestBody;
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = await prisma.user.findUnique({ where: { email } });

  // Both "no such user" AND "OAuth-only account with no password set" take
  // the dummyCompare() branch — comparePassword() would throw against a null
  // hash, and calling it here would also break the REQ-AUTH-005 timing
  // equalization this branch exists to provide.
  if (!user || !user.passwordHash) {
    await dummyCompare();
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  const { accessToken, refreshToken, refreshTokenExpiresAt } = await issueSession(user.id, user.role);
  const cookie = buildRefreshTokenCookie(refreshToken, refreshTokenExpiresAt);
  const csrfCookie = buildCsrfCookie(generateCsrfToken());

  const response = NextResponse.json({ accessToken }, { status: 200 });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  response.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.options);
  return response;
}
