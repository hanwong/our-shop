// SPEC-CI-001 M4 — temporary probe test used to inject a deliberate test
// failure on a real GitHub Actions run (AC-CI-008). Deleted before this PR
// is done.
import { describe, expect, it } from "vitest";
import { ciVerifyScratchProbe } from "../../scripts/ci-verify-scratch";

describe("ci-verify-scratch probe", () => {
  it("deliberately asserts a wrong expected value", () => {
    expect(ciVerifyScratchProbe()).toBe("this assertion is deliberately wrong");
  });
});
