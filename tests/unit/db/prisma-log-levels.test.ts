import { describe, it, expect } from "vitest";
import { getPrismaLogLevels } from "@/lib/db";

describe("getPrismaLogLevels (SPEC-AUTH-001 M1)", () => {
  it("enables warn+error logging in development", () => {
    expect(getPrismaLogLevels("development")).toEqual(["warn", "error"]);
  });

  it("restricts to error-only logging outside development", () => {
    expect(getPrismaLogLevels("production")).toEqual(["error"]);
    expect(getPrismaLogLevels("test")).toEqual(["error"]);
    expect(getPrismaLogLevels(undefined)).toEqual(["error"]);
  });
});
