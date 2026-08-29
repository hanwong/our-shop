// SPEC-CI-001 M4 — temporary probe file used to inject and observe individual
// CI failure modes on a real GitHub Actions run (AC-CI-006/007/008/009/010/012).
// Deleted before this PR is done; not part of the SPEC's shipped surface.

export function ciVerifyScratchProbe(): string {
  const unusedVariable = "this triggers @typescript-eslint/no-unused-vars";
  return "probe";
}
