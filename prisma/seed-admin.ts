/**
 * Standalone, dev-only admin-account seed script (matches the
 * prisma/seed-coupons.ts convention — no admin-signup endpoint exists:
 * /api/auth/signup always creates `role: "customer"`, so a role: "admin"
 * User row has to be created directly against the database).
 *
 * Run with:
 *   node prisma/seed-admin.ts [email]
 *
 * (Node 22.6+ strips TypeScript types natively — no `tsx`/`ts-node`
 * dependency needed, same as seed-coupons.ts.)
 *
 * The password is never hardcoded here. Each run generates a fresh random
 * password, hashes it with the project's own hashPassword() (bcrypt cost
 * 12, see src/lib/auth/password.ts), stores only the hash, and prints the
 * plaintext to the terminal exactly once — that is the only place it is
 * ever recoverable, since the hash cannot be reversed. Re-running this
 * script against the same email resets that account's password (upsert),
 * so treat a re-run as a password reset, not a no-op.
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.ts";

const prisma = new PrismaClient();

const DEFAULT_EMAIL = "admin@our-shop.local";

// URL-safe, no ambiguous punctuation to transcribe — 24 bytes of entropy
// base64url-encoded is well above any reasonable brute-force floor and
// clears the signup route's own 8-character minimum by a wide margin.
function generatePassword(): string {
  return randomBytes(24).toString("base64url");
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase() || DEFAULT_EMAIL;
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin", emailVerified: true },
    create: { email, passwordHash, role: "admin", emailVerified: true },
  });

  // Printed exactly once, deliberately — this is the only surface the
  // plaintext password ever touches. Do not log it anywhere else.
  console.log("Admin account ready:");
  console.log(`  email:    ${admin.email}`);
  console.log(`  password: ${password}`);
  console.log("Store this password now — it is not recoverable afterward (only its bcrypt hash is kept).");
}

main()
  .catch((err) => {
    console.error("Failed to seed admin account:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
