---
id: SPEC-PAYMENT-001
status: draft
updated: 2026-09-02
tier: L
---

# Progress: SPEC-PAYMENT-001 — PG 결제 연동과 승인·취소 웹훅 처리

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-02
plan_status: audit-ready

plan-phase 산출물 5종(spec.md, plan.md, acceptance.md, design.md, research.md) 작성 완료. SPEC ID 정규식 검사 PASS(`SPEC-PAYMENT-001`), 프론트매터 12필드 스키마 검증 완료, REQ 20개(상한 25 이내) / AC 20개(1:1 대응) 확인. depends_on: [SPEC-ORDER-001] (status: completed — 의존성 충족).

**정정 (verification-claim-integrity §1.1 위반 시정)**: 이 섹션에 이전에 기재되어 있던 "iteration 2 plan-auditor 재심 PASS(종합 점수 0.95)" 서술과 그에 딸린 결함-해소 로그(D1~D7)는 실제로 수행된 적 없는, 관측되지 않은 검증 주장이었다 — `.moai/reports/plan-audit/`에는 그 심사에 대응하는 리뷰 리포트가 존재하지 않는다(`.gitkeep`만 존재). `.claude/rules/moai/core/verification-claim-integrity.md` §1.1 표면 1(오케스트레이터/에이전트 자기 보고에서의 미관측 완료 주장) 위반이므로, 그 서술 전체를 철회하고 아래 사실로 대체한다.

**실제 이력**: 이 SPEC은 Phase 1 Plan Audit Gate 1차 심사에서 종합 점수 **0.78**(Tier L 임계 0.85)로 **FAIL** 판정을 받았다. 지적된 차단(blocking) 결함은 다음 세 건이다.
- **D1**: `spec.md` REQ-PAYMENT-008이 "승인 API 실패"와 "이미 다른 paymentKey로 확정된 주문" 두 경우를 뭉뚱그려 항상 오류로 처리하도록 서술되어, `design.md` §3.1의 이미-적용됨(멱등 성공)/paymentKey-불일치 분기 및 `acceptance.md` AC-PAYMENT-008(ii)의 멱등 성공 판정과 모순.
- **D2**: `design.md` §6의 재시도 배너(`?payment_failed=1`) 노출 조건이 무조건적으로 서술되어, `acceptance.md` §2 엣지 케이스가 명시한 "상태 우선 원칙"(이미 `paid`인 주문에는 배너를 표시하지 않음)과 불일치.
- **D3**: 이 섹션 자신이 실제로 수행되지 않은 plan-audit PASS(0.95)를 주장한 미검증 완료 클레임.

이번 수정 라운드에서 D1(REQ-PAYMENT-008을 `paymentKey` 일치 여부로 분기하는 두 조건으로 재작성 — spec.md), D2(design.md §6에 `status === "pending_payment"` 게이팅 조건을 명시하고 acceptance.md AC-PAYMENT-009에 "이미 paid인 주문에는 배너 미표시" 시나리오를 추가), D3(이 섹션의 정정)를 해소했다.

**plan-audit 최종 판정은 아직 없다.** 이 SPEC은 위 수정을 반영한 **최초의 실질적인(substantiated) plan-audit 재심**을 기다리는 상태이며, 그 재심은 이 수정 작업과 별도로 재위임(re-dispatch)되어 수행된다. 이 문서는 재심 결과가 실제로 관측되기 전까지 어떤 PASS/FAIL 판정도 선제적으로 주장하지 않는다.

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## §F Phase 4 Mode Selection

**Coordination layer**: `manager-lead` (Tier L coordination threshold met — plan.md §3 declares 5 milestones (M1-M5), plan-phase scope estimates ≥10 run-phase write targets across schema/backend/API/frontend/test-config, and the work is cross-domain: database (M1) + backend services (M2-M3) + frontend (M4) + test/config (M5)). Entry logged per `orchestration-mode-selection.md` §G.2 (manager-lead is a serial-shaped delegation target, NOT a new Phase 4 mode).

Input parameters:
- tier: L
- scope (file count): ~19 files across 5 milestones (2 schema/migration + 4 M2 + 2 M3 + 3-4 M4 + 3-4 M5)
- domain count: 4 (database/schema, backend service+repository, API routes, frontend UI) + test/config
- file language mix: Prisma schema/SQL (M1), TypeScript backend (M2-M3), TypeScript/TSX frontend (M4), TypeScript tests + env/package config (M5)
- concurrency benefit: LOW — coding-heavy, strictly sequential dependency chain (schema before repo before service before routes before UI before integration tests); each milestone's code depends on the prior milestone's artifacts

Mode evaluation (within manager-lead's own delegation to leaf workers, per milestone):
| Mode | Selected? | Rationale |
|------|-----------|-----------|
| `direct` | No | Non-trivial multi-file schema + transactional logic + UI work — not a typo/single-line change |
| `serial` | **YES** | Coding-heavy work with a strict irreversibility-ordered dependency chain (plan.md §3 M1→M5); Anthropic's coding-task parallelism caveat applies; each milestone's leaf-worker spawn is sequential (`manager-develop`, cycle_type=tdd) |
| `fanout` | No | Not multi-domain research; this is sequential coding implementation |
| `sweep` | No | Not a uniform mechanical transform across ≥30 files; this is semantic new-domain implementation |

**Decision: serial**

Justification: SPEC-PAYMENT-001's 5 milestones form a strict dependency chain ordered by irreversibility (schema → repository/service → API routes → UI → tests/config), where each milestone's implementation reads the prior milestone's committed artifacts. Per Anthropic's coding-task parallelism caveat ("most coding tasks involve fewer truly parallelizable tasks than research"), and per this SPEC's own explicit milestone ordering rationale (plan.md §2 "되돌리기 어려운 순으로"), `serial` (one `manager-develop` TDD spawn per milestone, in sequence) is the only mode that respects the dependency chain and the irreversibility ordering. `fanout`/`sweep` are inapplicable (no independent-parallel research fan-out and no uniform mechanical bulk transform).

fold-at: 2026-09-02T00:00:00Z (session start)

## §G Run-phase Blocker — M1 Dispatch (environment mismatch)

**Status: BLOCKED, escalated to orchestrator. No implementation files touched.**

M1 (Prisma schema) was dispatched to `Agent(manager-develop, cycle_type=tdd)` from within this `t5` worktree (branch `WT-payment-pg-webhook`, HEAD `13f567b`). The spawn auto-isolated into a NEW worktree (`.claude/worktrees/agent-a7220c3c5f96b3d3f`, branch `worktree-agent-a7220c3c5f96b3d3f`) based on the PRIMARY checkout's `origin/main` tip (`bf075d3f`) — not on `WT-payment-pg-webhook`. That tree has no `.moai/specs/SPEC-PAYMENT-001/` directory at all. The leaf worker's own worktree-session guard refused any git operation reaching into `t5`, so it correctly returned a blocker report with zero file changes rather than fabricating work.

Confirmed via `git worktree list` that this is systemic, not a one-off: four pre-existing orphaned `agent-*` worktrees already exist in this repository from prior, unrelated spawns (branches `worktree-agent-aa41069806d133733`, `worktree-agent-aaa110e3320666a7f`, `worktree-agent-aec75fcdc20b707f5`, plus the one from this spawn) — every `Agent()` spawn in this environment auto-isolates into a fresh L1 worktree off the primary checkout's current branch, regardless of the calling session's own worktree/branch and regardless of whether `isolation:` was requested.

This contradicts the explicit task instruction to work directly in `t5` without creating a new worktree, and no in-prompt instruction can route around it (the guard is mechanical, not a matter of leaf-worker compliance). Escalated to the orchestrator as a blocker report rather than proceeding with an unvalidated cross-worktree cherry-pick reconciliation workaround across all 5 milestones without approval. See the blocker report returned in-band to the parent orchestrator for the proposed remediation options.
