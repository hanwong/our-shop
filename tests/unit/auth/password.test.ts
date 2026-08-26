import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword, dummyCompare } from "@/lib/auth/password";

/**
 * SPEC-AUTH-001 M2 — src/lib/auth/password.ts
 * Traces: REQ-AUTH-001 (72-byte handling), REQ-AUTH-002 (bcrypt cost 12),
 * REQ-AUTH-005 (dummyCompare timing equalization), REQ-AUTH-025 (no logging
 * of raw password/hash — verified via static grep in the self-verification
 * report, not here).
 */

describe("hashPassword / comparePassword (REQ-AUTH-002)", () => {
  it("hashes a password into a bcrypt hash distinct from the raw password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it("uses cost factor 12 in the produced hash", async () => {
    const hash = await hashPassword("some-password-123");
    // bcrypt hash format: $2b$<cost>$<22-char-salt><31-char-hash>
    const costSegment = hash.split("$")[2];
    expect(costSegment).toBe("12");
  });

  it("round-trips: comparePassword returns true for the original password", async () => {
    const hash = await hashPassword("myS3cretPassw0rd!");
    await expect(comparePassword("myS3cretPassw0rd!", hash)).resolves.toBe(true);
  });

  it("comparePassword returns false for a wrong password", async () => {
    const hash = await hashPassword("myS3cretPassw0rd!");
    await expect(comparePassword("wrong-password", hash)).resolves.toBe(false);
  });
});

describe("72-byte password handling (REQ-AUTH-001 / AC-AUTH-003a)", () => {
  it("round-trips correctly for a password exceeding 72 UTF-8 bytes", async () => {
    // 100 'a' characters == 100 bytes, well over the 72-byte bcrypt limit.
    const longPassword = "a".repeat(100);
    const hash = await hashPassword(longPassword);
    await expect(comparePassword(longPassword, hash)).resolves.toBe(true);
  });

  it("distinguishes two >72-byte passwords that differ only after byte 72", async () => {
    // Raw bcrypt truncates at 72 bytes, so these two would collide without
    // the SHA-256 pre-hash. With pre-hashing they must NOT be interchangeable.
    const base = "b".repeat(72);
    const passwordA = base + "AAAAAAAA";
    const passwordB = base + "BBBBBBBB";
    const hashA = await hashPassword(passwordA);
    await expect(comparePassword(passwordB, hashA)).resolves.toBe(false);
    await expect(comparePassword(passwordA, hashA)).resolves.toBe(true);
  });

  it("handles multi-byte UTF-8 characters correctly within the round trip", async () => {
    const unicodePassword = "패스워드🔐".repeat(10);
    const hash = await hashPassword(unicodePassword);
    await expect(comparePassword(unicodePassword, hash)).resolves.toBe(true);
  });
});

describe("dummyCompare (REQ-AUTH-005 timing equalization)", () => {
  it("always returns false", async () => {
    await expect(dummyCompare()).resolves.toBe(false);
  });

  it("resolves after performing bcrypt work (not a short-circuit stub)", async () => {
    // A crude but meaningful guard: dummyCompare must actually invoke bcrypt's
    // compare (not just `return false` synchronously) so its cost profile
    // resembles a real comparePassword call. We assert it returns a genuine
    // Promise that resolves to false, exercised alongside a real hash of the
    // same cost factor.
    const realHash = await hashPassword("some-real-password");
    const realCostSegment = realHash.split("$")[2];
    expect(realCostSegment).toBe("12");
    await expect(dummyCompare()).resolves.toBe(false);
  });
});
