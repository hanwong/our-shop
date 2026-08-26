import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

/**
 * SPEC-AUTH-001 M3 — POST /api/auth/signup
 * Traces: REQ-AUTH-001 (server-side email/password validation; the 72-byte
 * bcrypt truncation limit is handled unconditionally inside hashPassword()
 * via SHA-256 pre-hashing — see password.ts), REQ-AUTH-002 (bcrypt cost 12
 * hashing on User creation), REQ-AUTH-003 (duplicate-email rejection).
 */

// Deliberately permissive server-side format check (not RFC 5322-exhaustive):
// requires a non-whitespace local part, an "@", a non-whitespace domain, and
// at least one "." in the domain. Rejects the malformed-email AC-AUTH-003b
// examples (`not-an-email`, `@example.com`, `user@`) while accepting normal
// addresses. Client-side validation is never trusted (REQ-AUTH-001).
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;

interface SignupRequestBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: SignupRequestBody;
  try {
    body = (await request.json()) as SignupRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_FORMAT_REGEX.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // REQ-AUTH-001 §72-byte handling: hashPassword() applies the SHA-256
  // pre-hash unconditionally (see password.ts), so no length branching is
  // needed here regardless of the raw password's byte length.
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "customer" },
  });

  // AC-AUTH-001: response body MUST NOT contain the raw password or the
  // stored hash anywhere — only the non-sensitive identifiers are returned.
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
