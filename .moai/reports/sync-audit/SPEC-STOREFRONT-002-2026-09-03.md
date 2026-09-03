# Sync-Audit Report — SPEC-STOREFRONT-002

Date: 2026-09-03
Auditor: sync-auditor (independent post-implementation quality audit)
Worktree at audit time: `.claude/worktrees/SPEC-STOREFRONT-002`, branch `feat/SPEC-ORDER-003` (shared checkout — SPEC-STOREFRONT-002 work lands on `main` per Route A Hybrid Trunk), HEAD `636aeed393669edf4b8278ceadd6f9613798ede4`

## Evaluation Report
SPEC: SPEC-STOREFRONT-002
Overall Verdict: PASS

Must-pass firewall: Functionality PASS, Security PASS (both independently above threshold). No blocking findings — all findings below are optional/low-severity and do not affect the verdict.

### Dimension Scores

| Dimension | Score | Verdict | Evidence |
|-----------|-------|---------|----------|
| Functionality (40%) | 96/100 | PASS | Full suite re-run this session: `npm run test:coverage -- --exclude "**/tests/integration/auth/login.test.ts"` → exit 0, `Test Files 79 passed (79)`, `Tests 960 passed \| 21 skipped (981)` — matches progress.md's claim exactly, byte-for-byte on the pass/skip counts. All 15 AC-STOREFRONT-016~030 independently re-verified: re-ran the 4 SPEC-owned test files (`cart-page.test.tsx`, `cart-view.test.tsx`, `add-to-cart-button.test.tsx`, `empty-cart.test.tsx`) individually via the full-suite run and confirmed pass counts (9/13/6/2). Read the actual assertion bodies of `cart-view.test.tsx` and `add-to-cart-button.test.tsx` in full (not just test names) — every assertion genuinely matches its cited AC's stated requirement (see § AC Spot-Check below). `npx tsc --noEmit` → exit 0 (no output). `npm run lint` → exit 0 (no output). Deduction: did not independently re-run `npm run build` this session (relied on tsc+lint+test passing as strong corroboration of progress.md's verbatim build log, which is internally consistent). |
| Security (25%) | 95/100 | PASS | `AddToCartButton.tsx` POSTs only `{ productId, quantity }` to `/api/cart/items`; `CartView.tsx` PATCHes only `{ quantity }` to `/api/cart/items/:itemId` — grep-confirmed (`fetch(` call sites read in full) that no client-supplied `price` or any other server-authoritative field is ever sent in a mutation body; `price` appears in the source only inside a display expression (`formatWon(item.price)`), never in a request payload. No new client-side trust boundary introduced — both components consume the existing SPEC-CART-001 backend unmodified (confirmed 0-diff below). `grep -n "dangerouslySetInnerHTML\|eval("` across the 3 new/modified component files → 0 matches. Backend service/auth layers (`src/features/{cart,orders,payments,discounts}/**`, `src/lib/auth/**`) independently confirmed 0-diff (see § PRESERVE Verification). |
| Craft (20%) | 93/100 | PASS | Per-file coverage cross-checked against progress.md's table via this session's full-suite run: `CartView.tsx` 93.79/86.95/87.5/93.79 (exact match to progress.md), `EmptyCart.tsx` 100/100/100/100 (exact match), `PayButton.tsx` 100/100/100/100 (exact match) — all ≥85%/80% thresholds, `coverage_exemptions.enabled: false` confirmed no exemption path taken. `npx tsc --noEmit` exit 0, `npm run lint` exit 0 (both re-run this session, not carried over from progress.md). Deduction: `CartView.tsx` uses a raw `<img>` tag rather than `next/image` (used elsewhere in this codebase, e.g. `ProductGallery.tsx: import Image from "next/image"`) — see F2. |
| Consistency (15%) | 85/100 | PASS | `PayButton.tsx` diff independently re-verified via `git diff 53588cf..HEAD -- src/components/checkout/PayButton.tsx`: **exactly 2 lines changed**, both pure `className` string-literal token substitutions (`px-4 py-3`→`px-4 py-2`, `text-red-700`→`text-red-600`) — zero structural/logic/handler changes, honoring the SPEC's own §E boundary rule (AC-STOREFRONT-029) precisely. Deduction: (a) `progress.md` carries no `## §F Phase 4 Mode Selection` section per `orchestration-mode-selection.md` §D (`grep -A5 "Mode Selection" progress.md` → 0 matches) — a process/traceability gap, not a code defect (see F1); (b) the raw-`<img>` deviation from the codebase's `next/image` convention elsewhere (F2, shared with Craft). |

### AC Spot-Check (read actual test assertions, not just names — 3 required, 5 performed)

1. **AC-STOREFRONT-020** (rejected change not reflected, other item unaffected) — `cart-view.test.tsx:103-115`. Test mocks a 400 response, fires the quantity-increase click, asserts `screen.getByRole("alert").textContent` equals the server's exact error string, then asserts `document.body.textContent` still contains the item's PRE-rejection line total (`"20,000"`) AND the untouched sibling item's line total (`"5,000"`). This is a genuine "state unchanged + other item unaffected" assertion matching the AC's Given-When-Then exactly, not a superficial existence check.
2. **AC-STOREFRONT-027** (disabled button issues zero requests) — `add-to-cart-button.test.tsx:93-104`. Asserts `button.disabled === true` at `stock={0}`, THEN fires a click on the (disabled) button, THEN asserts `fetchMock` was never called (`.not.toHaveBeenCalled()`). This directly verifies the AC's "0-count spy confirmation" requirement, not merely that the button renders disabled.
3. **AC-STOREFRONT-023** (checkout boundary — no shipping/payment fields, no `/api/orders` call) — `cart-view.test.tsx:196-204`. Reads `CartView.tsx`'s actual source text via `readFileSync` and asserts `not.toMatch(/postalCode|recipientName|recipientPhone|cardNumber/i)` and `not.toMatch(/\/api\/orders/)`. This is a genuine static-source boundary check, matching the AC's own "정적 소스를 검사한다" (inspect the static source) methodology — not a runtime behavioral proxy.
4. **AC-STOREFRONT-022** (checkout entry link) — `cart-view.test.tsx:153-159`. Asserts the rendered link's `href` attribute equals exactly `"/checkout"`.
5. **AC-STOREFRONT-025** (add-to-cart success, no navigation) — `add-to-cart-button.test.tsx:40-51`. Asserts the success status text, the `/cart` link's href, AND — critically — that the add button is STILL present in the DOM after success (proving no navigation/unmount occurred), matching the AC's "여전히 상품 상세 화면이다(내비게이션 없음)" requirement.

### PRESERVE Verification (git diff --stat, independently re-run against base `53588cf`)

| Target | Command | Result |
|---|---|---|
| `src/features/{cart,orders,payments,discounts}/**`, `src/lib/auth/**` | `git diff --stat 53588cf..HEAD -- <paths>` | **0 lines** — no output |
| `src/app/checkout/page.tsx`, `CheckoutForm.tsx`, `OrderSummary.tsx`, `CheckoutInteractive.tsx`, `CheckoutUnavailable.tsx` (5 untouched checkout files) | `git diff --stat 53588cf..HEAD -- <paths>` | **0 lines** — no output |
| `src/app/products/[productId]/page.tsx`, `src/middleware.ts` | `git diff --stat 53588cf..HEAD -- <paths>` | **0 lines** — no output |
| `src/components/checkout/PayButton.tsx` | `git diff 53588cf..HEAD -- <path>` (full diff, not --stat) | Exactly 2 lines changed, both `className` token substitutions — verbatim diff quoted in Consistency row above |

All PRESERVE claims in progress.md's §E.3 self-check are independently confirmed — not just taken on trust from the agent's Read-based self-check (which itself flagged this as needing orchestrator `git diff --stat` re-verification).

### Test-suite claim verification

- `npm run test:coverage -- --exclude "**/tests/integration/auth/login.test.ts"` (this run): `Test Files 79 passed (79)`, `Tests 960 passed | 21 skipped (981)`, exit 0 — matches the 960/21/0 claim exactly.
- `npx vitest run tests/integration/auth/login.test.ts` (isolated, this run, **twice** to rule out a one-off pass): both runs green — `[AC-AUTH-005] median(nonexistent-email)=209.33ms median(wrong-password)=209.60ms diff=0.26ms tolerance=31.44ms` and `diff=0.06ms tolerance=31.37ms` on the repeat — well inside tolerance both times, confirming this is genuinely a load-sensitive timing flake (unrelated to SPEC-STOREFRONT-002, tracked as backlog card `t20`) rather than a masked regression.

### CHANGELOG / README convention check

- `grep -n "SPEC-STOREFRONT-002" CHANGELOG.md` → 2 matches (`### 추가 — SPEC-STOREFRONT-002...`, `### 알려진 한계 — SPEC-STOREFRONT-002`) — present under `[Unreleased]`, matching this project's established per-SPEC CHANGELOG section convention (cf. SPEC-DISCOUNT-001, SPEC-ORDER-003 in recent git log).
- `grep -n "SPEC-STOREFRONT-002" README.md` → 2 matches, including a full `## 장바구니 화면·담기 UI (SPEC-STOREFRONT-002)` section placed between the SPEC-STOREFRONT-001 and SPEC-ORDER-001 sections — correct chronological/domain placement.

### Findings (structured defect-list)

- **F1** [Low] [optional] `.moai/specs/SPEC-STOREFRONT-002/progress.md` — no `## §F Phase 4 Mode Selection` section exists (`grep -A5 "Mode Selection" progress.md` → 0 matches), which `orchestration-mode-selection.md` §D requires the orchestrator to log before the first run-phase `Agent()` spawn. This is a process-traceability gap in the orchestrator's own logging discipline, not a defect in the delivered code — the underlying implementation work is correct and complete. Required fix (if pursued): none required for this SPEC to remain PASS; a future SPEC's orchestrator should ensure this logging fires.
- **F2** [Low] [optional] `src/components/cart/CartView.tsx:132-136` — the product-image element uses a raw `<img>` tag, while `src/components/product/ProductGallery.tsx` (a sibling component in the same codebase, same STOREFRONT domain) uses `next/image`. This is a deliberate, cited decision (`design.md` line 64 specifies `<img>` verbatim with a rationale comment), not an oversight, but it is an inconsistency with the project's established image-handling convention for optimization/lazy-loading. Required fix (optional): none required to PASS this SPEC — if pursued in a future pass, evaluate whether `next/image`'s remote-pattern configuration already covers the cart's image source and migrate for consistency.

### Recommendations

- No blocking action required — this SPEC is ready to remain `completed`.
- F1/F2 are informational; address opportunistically in a future SPEC touching the same files, not as a follow-up task solely for this reason.
