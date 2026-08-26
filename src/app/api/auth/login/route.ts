import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, dummyCompare } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";
import { buildRefreshTokenCookie } from "@/lib/auth/cookies";

/**
 * SPEC-AUTH-001 M3 — POST /api/auth/login
 * Traces: REQ-AUTH-004 (valid login issues a token pair via the shared
 * session-issuance path), REQ-AUTH-005 (dummy-compare timing equalization +
 * a single generic failure message shared by both the not-found and
 * wrong-password paths — the client MUST NOT be able to distinguish them via
 * message content, status code, or timing), REQ-AUTH-006 (claim shape, via
 * the shared JWT path in jwt.ts/session.ts).
 */

// AC-AUTH-005/AC-AUTH-006: identical wording on both failure branches so the
// client cannot distinguish "no such user" from "wrong password".
const GENERIC_LOGIN_ERROR = "Invalid email or password";

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request): Promise<Response> {
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

  const response = NextResponse.json({ accessToken }, { status: 200 });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
