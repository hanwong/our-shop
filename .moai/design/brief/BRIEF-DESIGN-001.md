---
spec: SPEC-DESIGN-001
design_system: Classical
generated: 2026-09-05
pipeline: D1-D5 (manager-design)
role: re-verification only (token values already captured in plan.md §D.1; not re-derived)
---

# Design Handoff Brief — SPEC-DESIGN-001

## D1 — Connection setup

No live claude.ai / DesignSync connection was available this session (see
§ Tool Availability below). D1 could not proceed past the availability check.
This is a defined, expected path per REQ-DESIGN-010 — the SPEC's design-phase
role was already reduced to re-verification because plan-phase (with prior
DesignSync authorization) had already acquired and fixed the Classical token
block in `plan.md` §D.1.

## D2 — Design-system generation and sync

**Not executed.** D2 (code -> design push via `write_files`/`finalize_plan`)
does not apply to this SPEC's design-phase role — no push to Claude Design
was requested or needed; the direction of travel here is design -> code
(token re-verification and consumption), not code -> design.

## D3 — Screen artifact generation

**Not executed.** No new Claude Design canvas screens were generated this
session. This SPEC's UI-surface heuristic is satisfied via
`acceptance.md` (explicit component/page deliverables), not via a
freshly-generated canvas; the token/component source is the pre-existing
Classical project referenced in plan.md, not a canvas this pipeline drives.

## D4 — Handoff receipt and paste (this session's actual work)

**Live re-verification attempted and NOT possible.**

- `.mcp.json` (read this session) registers exactly three MCP servers:
  `context7`, `moai`, `playwright`. No `DesignSync` server is registered.
- This agent's tool list carries no `mcp__DesignSync__*` tool.
- `.moai/project/brand/` does not exist (expected — plan.md §B.4).

This is a structural tool-registration absence, not an authentication
failure or a network error — DesignSync was simply never wired into this
project's `.mcp.json` for this session.

**Path taken: REQ-DESIGN-010 / AC-DESIGN-013 (offline SSOT).**
`plan.md` §D.1 is carried forward, unmodified, as the token source of truth
for run-phase. No live diff against the Classical project was performed.
No divergence can be reported because no live comparison occurred — this is
explicitly distinct from "compared and found no divergence."

Handoff artifacts pasted to reserved paths (H2):
- `.moai/design/tokens.json` — verbatim Classical `:root` token block
  (colors, typography, spacing, radius, shadow), transcribed from
  `plan.md` §D.1, with the tool-availability record embedded.
- `.moai/design/components.json` — primitive extraction targets, the
  Classical-class -> repo-component mapping (plan.md §D.3), and the
  readme constraints (plan.md §D.4), scoped to what M1-M5 actually consume.
- `.moai/design/brief/BRIEF-DESIGN-001.md` — this file.

No `assets/` were pasted — this SPEC introduces no new image/icon assets
(Lucide icon adoption is explicitly deferred, spec.md §4).

## D5 — Implementation linkage

Per plan.md §F, run-phase milestones consume these artifacts as follows:

| Milestone | Consumes |
|---|---|
| M0 (font loading pre-work) | `tokens.json` typography block (`font-heading`, `font-body`) |
| M1 (tokens + primitives) | `tokens.json` full block -> `@theme` transcription; `components.json` primitives_to_extract -> button + form-field primitive build |
| M2 (LogoutButton fix) | `components.json` button primitive contract |
| M3 (customer pages) | `components.json` component_mapping rows for SiteHeader.tsx, ProductCard.tsx + primitive consumers |
| M4 (staff pages) | `components.json` component_mapping (button/form rows only — no new Classical class introduced for staff) |
| M5 (verification) | `tokens.json` value list for grep verification (AC-DESIGN-001); `components.json` readme_constraints for AC-DESIGN-005(b)/(c) |

This SPEC's re-delegation to `manager-develop` is NOT performed by this
design-phase pass — per the task scope, this session produces the design
SSOT + verification record only; the H8 Section A-E delegation package to
manager-develop is assembled by the orchestrator at run-phase entry, not
here. No application code (`.tsx`/`.css`) was modified in this session.

## Tool Availability (H1 graceful degradation)

| Check | Result |
|---|---|
| `.mcp.json` DesignSync entry | Absent (0 matches on `grep -c "DesignSync" .mcp.json`) |
| `mcp__DesignSync__*` tool in this agent's tool list | Absent |
| `.moai/project/brand/` directory | Absent (expected, plan.md §B.4) |
| Conclusion | DesignSync is NOT operational this session. REQ-DESIGN-009's `Where` precondition is false — REQ-DESIGN-009 does not fire. REQ-DESIGN-010 fires: proceed on `plan.md` §D.1 as offline SSOT, record that no live re-verification occurred (this document + tokens.json `live_reverification` block). |

## What M0-M5 implementers should know beyond plan.md

Nothing beyond what plan.md already states. Specifically:

- No new discrepancy, correction, or update to the plan.md §D.1 token block
  is being proposed — the values transcribed into `tokens.json` are
  byte-identical to plan.md §D.1's `:root` block (verified by direct
  transcription in this session, not by independent re-derivation).
- No blocker is being raised. The DesignSync-unavailable path is a defined,
  fully-progressable branch per REQ-DESIGN-010/AC-DESIGN-013 — the SPEC
  proceeds to run-phase without modification to spec.md, plan.md, or
  acceptance.md.
- `components.json`'s `primitives_to_extract` and `readme_constraints`
  sections are a convenience re-packaging of plan.md §D.2/§D.4 content
  into a shape run-phase can consume directly (JSON, not prose) — no new
  facts were introduced beyond what plan.md already recorded.
