import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-AUTH-002 M4 -- boundary-preservation static checks.
 *
 * Traces: AC-AUTH-036 (REQ-AUTH-037) -- no client-side auth-state store
 * (React context, useAuth hook, localStorage/sessionStorage) across the
 * three files this SPEC introduces. AC-AUTH-035 (REQ-AUTH-036, git-diff
 * half) is verified separately via `git diff --stat` (the orchestrator's
 * own verification batch) -- a source file cannot assert its own git
 * history, so that half is not duplicated here.
 */

const CLIENT_STATE_PATTERN = /createContext|useContext|useAuth\b|localStorage|sessionStorage/;

const FILES = [
  "src/app/(shop)/login/page.tsx",
  "src/app/(shop)/signup/page.tsx",
  "src/lib/auth/session-resolver.ts",
];

describe("AC-AUTH-036 -- 클라이언트 측 인증 상태 저장소 부재", () => {
  it.each(FILES)("%s에 createContext/useContext/useAuth/localStorage/sessionStorage가 없다", (relPath) => {
    const source = readFileSync(path.resolve(__dirname, "../../../", relPath), "utf8");
    expect(source).not.toMatch(CLIENT_STATE_PATTERN);
  });
});
