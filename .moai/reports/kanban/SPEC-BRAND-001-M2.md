# Kanban Milestone Report: SPEC-BRAND-001 M0-M2

## AC Matrix
| AC-id | Verdict | Peer verdict | Evidence path |
|-------|---------|--------------|---------------|
| AC-BRAND-001 | PASS | PASS (lead re-verify) | git show 7f3a99b; grep our-shop → no match |
| AC-BRAND-002 | PASS | PASS (lead re-verify) | git show 7f3a99b -- "src/app/(shop)/page.tsx" |
| AC-BRAND-003 | PASS | PASS (lead re-verify) | git show 7f3a99b -- package.json |
| AC-BRAND-004 | PASS | PASS (lead re-verify) | git diff 9e788e9..HEAD -- src/lib/auth/jwt.ts → empty |
| AC-BRAND-005 | PASS | PASS (lead re-verify) | public/brand/logo_mono_black.png exists, valid 240x240 PNG (`file`, python3 struct parse) |
| AC-BRAND-006 | PASS | PASS (lead re-verify) | src/components/layout/BrandLogo.tsx — next/image, alt="OUR", width/height explicit; tests/unit/components/brand-logo.test.tsx (2 tests) |
| AC-BRAND-007 | PASS | PASS (lead re-verify) | git show 1ccaa1b -- src/app/globals.css: font tokens (--font-heading/--font-heading-weight/--font-body) byte-unchanged; `grep -c 'accent-2-'` → 0 |
| AC-BRAND-008 | PASS | PASS (lead re-verify) | globals.css flat + ramp token values match research.md §4.1 exactly |
| AC-BRAND-009 | PASS | PASS (lead re-verify) | divider/shadow color-mix base → #1f1f1f; `grep -nE '#b68235|#ac803e|#201f1d|#2d2b2b' globals.css` → no match |
| AC-BRAND-010 | PASS | PASS (lead re-verify) | `.plate { filter: grayscale(1) contrast(1.05); }` added |

## Leaf Workers
| Worker | Scope | Worktree branch | Outcome |
|--------|-------|------------------|---------|
| general-purpose (M0+M1+M2) | package.json, layout.tsx, home page h1, public/brand/ + BrandLogo, globals.css tokens + .plate | WT-our-brand-pivot (no isolation occurred — HEAD matched at start) | Completed, 3 commits (7f3a99b, 81524b9, 1ccaa1b) |

## Contradictions

None between the leaf worker's self-report and the lead's independent re-verification for the code changes themselves. One numeric discrepancy found and resolved: the leaf worker reported "1642/1643 passing, 1 known flake" from its own full-suite run; the lead's independent full-suite re-run immediately after showed 3 failures (1640/1643) under higher contention. All 3 (`AC-AUTH-005` timing-similarity, `AC-AUTH-021` rate-limit timing, `address-form.test.tsx` CSRF POST) were re-run in isolation by the lead and passed cleanly — confirmed pre-existing contention/timing flakiness, not a regression from M0-M2's changes (none of the 3 failing test files touch any file M0-M2 modified). Recorded in progress.md §E.2.

## Gaps

None for M0-M2's own scope. Full end-to-end HTML-rendering verification of AC-BRAND-001 (title tag in a served response) was NOT performed via a running dev server in this milestone group — verified instead via direct source/JSX inspection (`git show` diff) and the `home-page.test.tsx`/`shell.test.tsx` unit-test suite, which is the pattern this repo already uses for equivalent prior SPECs (no live-server AC verification precedent exists in this codebase's test suite). This is flagged, not silently assumed — a live-render smoke check will be included in M8's final verification pass.
