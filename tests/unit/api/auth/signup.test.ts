import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-AUTH-001 M3 — src/app/api/auth/signup/route.ts
 * Traces: REQ-AUTH-001 (server-side email/password validation, 72-byte
 * handling), REQ-AUTH-002 (bcrypt cost 12 hashing), REQ-AUTH-003 (duplicate
 * email rejection).
 *
 * No live PostgreSQL in this sandbox — @/lib/db is mocked with an in-memory
 * fake implementing only the prisma.user.findUnique/create delegates this
 * route actually calls (same pattern as tests/unit/auth/session.test.ts).
 */

interface FakeUserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  role: "customer" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

let users: FakeUserRow[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        return users.find((u) => u.email === where.email) ?? null;
      }),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { email: string; passwordHash: string; role: "customer" | "admin" };
        }) => {
          const row: FakeUserRow = {
            id: `user-${users.length + 1}`,
            email: data.email,
            passwordHash: data.passwordHash,
            emailVerified: false,
            role: data.role,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          users.push(row);
          return row;
        }
      ),
    },
  },
}));

beforeEach(() => {
  users = [];
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  it("[AC-AUTH-001] creates a User with a bcrypt hash and returns 201 with no password/hash anywhere in the response body", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(makeRequest({ email: "user@example.com", password: "correcthorse" }));
    expect(response.status).toBe(201);

    const bodyText = await response.text();
    expect(bodyText).not.toContain("correcthorse");

    expect(users).toHaveLength(1);
    const created = users[0]!;
    expect(created.passwordHash).not.toBe("correcthorse");
    expect(created.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(bodyText).not.toContain(created.passwordHash!);
  });

  it("[AC-AUTH-002] rejects duplicate email with 409 and does not create a second User", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const first = await POST(makeRequest({ email: "dup@example.com", password: "password1" }));
    expect(first.status).toBe(201);
    expect(users).toHaveLength(1);

    const second = await POST(makeRequest({ email: "dup@example.com", password: "password2" }));
    expect(second.status).toBe(409);
    expect(users).toHaveLength(1);
  });

  it("[F1 fix, acceptance.md §7] normalizes email to lowercase before both the duplicate-check and storage, so a mixed-case signup cannot bypass the case-normalized duplicate check google/callback relies on", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(makeRequest({ email: "MixedCase@Example.COM", password: "password1" }));
    expect(response.status).toBe(201);
    expect(users).toHaveLength(1);
    expect(users[0]!.email).toBe("mixedcase@example.com");

    // A second signup differing only by case must be rejected as the SAME
    // account (409), not silently create a case-differing duplicate row.
    const dup = await POST(makeRequest({ email: "mixedcase@example.com", password: "password2" }));
    expect(dup.status).toBe(409);
    expect(users).toHaveLength(1);
  });

  it("[AC-AUTH-003b] rejects malformed email with 400 and creates no User", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    for (const email of ["not-an-email", "@example.com", "user@"]) {
      const response = await POST(makeRequest({ email, password: "password1" }));
      expect(response.status).toBe(400);
    }
    expect(users).toHaveLength(0);
  });

  it("[AC-AUTH-003c] rejects a password under 8 characters with 400 and creates no User", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(makeRequest({ email: "user@example.com", password: "short12" }));
    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
  });

  it("rejects a malformed JSON request body with 400 and creates no User", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const malformedRequest = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-valid-json",
    });
    const response = await POST(malformedRequest);
    expect(response.status).toBe(400);
    expect(users).toHaveLength(0);
  });

  it("[AC-AUTH-003a] accepts and round-trips a password exceeding 72 UTF-8 bytes (no silent truncation) via signup + re-hash-check", async () => {
    const { POST } = await import("@/app/api/auth/signup/route");
    const longPassword = "p".repeat(80) + "-tail";
    const response = await POST(makeRequest({ email: "longpw-signup@example.com", password: longPassword }));
    expect(response.status).toBe(201);
    expect(users).toHaveLength(1);

    const { comparePassword } = await import("@/lib/auth/password");
    await expect(comparePassword(longPassword, users[0]!.passwordHash!)).resolves.toBe(true);
  });
});
