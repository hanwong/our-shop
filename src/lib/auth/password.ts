import bcrypt from "bcrypt";
import { createHash } from "node:crypto";

/**
 * SPEC-AUTH-001 M2 — password hashing, comparison, and timing-attack
 * mitigation (REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-005, REQ-AUTH-025).
 */

// @MX:NOTE bcrypt cost factor — REQ-AUTH-002 fixes this at 12. Raising it
// increases hashing time roughly 2x per increment; lowering it weakens
// brute-force resistance. Do not change without updating REQ-AUTH-002.
const BCRYPT_COST_FACTOR = 12;

/**
 * SHA-256 pre-hash before bcrypt (REQ-AUTH-001 §72-byte handling, design
 * choice (b) per plan.md/research.md — chosen over choice (a) [reject >72
 * bytes] because it is more permissive to users).
 *
 * bcrypt silently truncates any input beyond 72 bytes, discarding the tail —
 * two passwords that differ only after byte 72 would hash identically.
 * Mapping every password through SHA-256 first collapses it to a fixed
 * 64-character hex digest (well under 72 bytes) before bcrypt ever sees it,
 * so truncation never occurs and every byte of the original password
 * contributes to the resulting hash. This is applied unconditionally (not
 * only to passwords >72 bytes) so hashPassword and comparePassword stay
 * symmetric with no branching on input length.
 */
function preHash(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

/**
 * Hashes a password with bcrypt (cost 12) after SHA-256 pre-hashing.
 * REQ-AUTH-025: never log `password` or the returned hash anywhere in this
 * module — no console.log/console.error/similar touches password material.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(preHash(password), BCRYPT_COST_FACTOR);
}

/**
 * Constant-time (via bcrypt's own comparison) password verification against
 * a stored hash. Returns false on any mismatch — never throws for a wrong
 * password.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(preHash(password), hash);
}

// Fixed, precomputed bcrypt hash (cost 12) of a fixed dummy value — computed
// once ahead of time (not at module load) so importing this module carries
// no extra bcrypt.hashSync cost. Used exclusively by dummyCompare() below to
// equalize response timing between "user not found" and "wrong password"
// login paths (REQ-AUTH-005 / AC-AUTH-005).
const DUMMY_HASH = "$2b$12$w8X0dGvBiCsvCeRTol7pbeN/wKSETcewsbjU6hGTK9GCnBmShnPg.";
const DUMMY_INPUT = "dummy-input-for-timing-equalization";

/**
 * Performs a bcrypt compare at the same cost factor as comparePassword()
 * against a fixed precomputed hash, discarding the result. Always resolves
 * to false. Callers use this to equalize response timing on the login path
 * when the looked-up user does not exist (REQ-AUTH-005) — the caller does a
 * real comparePassword() when the user exists, or dummyCompare() when not,
 * so both branches spend a comparable number of bcrypt rounds.
 */
export async function dummyCompare(): Promise<boolean> {
  await bcrypt.compare(preHash(DUMMY_INPUT), DUMMY_HASH);
  return false;
}
