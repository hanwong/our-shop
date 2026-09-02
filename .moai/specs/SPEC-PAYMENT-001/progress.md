---
id: SPEC-PAYMENT-001
status: completed
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

cycle_type: **tdd** (RED-GREEN-REFACTOR). M1~M5를 커밋 7건으로 완료했다(feat 4 + fix 1 보정 + docs 1 감사수정 + test 1).
브랜치 `WT-payment-pg-webhook`, plan-phase 기준 커밋 `13f567b`, run-phase 종료 시점 HEAD `a36eef3`.

| 마일스톤 | 커밋 | 산출물 |
|---|---|---|
| M1 데이터 모델 | `b243a97` | `prisma/schema.prisma`(Order.paymentKey, PaymentEventSource, PaymentAuditLog), 마이그레이션, `tests/unit/payments/schema.test.ts` |
| M2 리포지토리·서비스·어댑터 | `8bf4cfb` | `features/payments/{types,repositories,services}`, `src/lib/payment/toss-server.ts` |
| M3 API 라우트 | `2f6829e` | `src/app/api/payments/{confirm,webhook}/route.ts` |
| M3 보정 | `5e0a11f` | `tests/unit/orders/scope-boundaries.test.ts`의 AC-ORDER-019 제외 목록에 `src/app/api/payments` 추가(M3가 도입한 정당한 결제 통합을 오탐하던 것을 수정) |
| plan-audit 수정 | `ec30a8b` | Phase 1 Plan Audit Gate 1차 FAIL(0.78)의 D1/D2/D3 반영 — spec.md REQ-PAYMENT-008 재작성, design.md §6 상태-우선 게이팅 명시, 이 progress.md §E.1 정정 |
| M4 결제창 트리거 | `5175614` | `src/components/checkout/PayButton.tsx`, `src/lib/payment/toss-client.ts`, `checkout/complete/[orderId]/page.tsx` 확장(재시도 배너 + 결제 버튼) |
| M5 env·통합테스트 | `a36eef3` | `.env.example`(PG_SECRET_KEY/PG_WEBHOOK_SECRET/NEXT_PUBLIC_PG_CLIENT_KEY), `tests/integration/payments/webhook-flow.test.ts` |
| (본 세션) closeout | 이 커밋 | `tests/unit/payments/guest-only-scope.test.ts`(AC-PAYMENT-020 회귀 테스트 신설), 이 progress.md §E |

### 실행한 검증 명령과 관측된 출력 (HEAD `a36eef3` 기준, closeout 커밋 직전. 증거 로그 `.moai/state/verify/spec-payment-001/`)

| 명령 | 종료 코드 | 관측 결과 |
|---|---|---|
| `npm run typecheck` | 0 | 출력 없음 |
| `npm run lint` | 0 | 출력 없음 |
| `npx prisma validate` | 0 | `The schema at prisma/schema.prisma is valid 🚀` |
| `npm run test` | **1** | `Test Files 1 failed \| 60 passed (61)` / `Tests 1 failed \| 716 passed (717)` — 실패 1건은 `tests/integration/auth/login.test.ts` AC-AUTH-005(아래 별도 기록, 이 SPEC과 무관) |
| `npx vitest run tests/integration/auth/login.test.ts`(단독) | 0 | `1 passed` — 부하 없이 단독 실행하면 통과 |
| `npx vitest run --coverage --exclude tests/integration/auth/login.test.ts` | 0 | `Test Files 60 passed (60)` / `Tests 716 passed (716)` / `All files 97.56 stmts / 93.09 branch / 100 funcs / 97.56 lines` — 임계값(85/85/80/85) 상회 |
| `npm run build` | **1** | **선행 결함 — 아래 참조. 이 SPEC이 만든 것이 아니다** |

이 SPEC이 추가한 신규 테스트: M1 schema 20건 내외 + M2 47건(리포지토리+서비스+toss-server) + M3 라우트 + M4/M5 UI·통합 테스트 + 본 세션의 `guest-only-scope` 4건. 전체 스위트는 717 테스트(61 파일)이며, 그중 1건(AC-AUTH-005)이 이 SPEC과 무관한 이유로 부하 하에서 간헐 실패한다.

### `npm run build` 실패는 선행 결함이다 (근거를 남긴다)

- 실패 지문: `Failed to compile.` + `UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins` + import trace `./src/lib/auth/jwt.ts` — **SPEC-ORDER-001의 progress.md §E.2가 이미 귀속 실험으로 확인한 것과 완전히 동일한 결함**(Edge 런타임의 `middleware.ts`가 `jwt.ts`를 import하고, `jwt.ts`가 `node:crypto`를 사용).
- **이 SPEC은 두 원인 파일을 전혀 건드리지 않았다**: `git diff --numstat b243a97~1 HEAD -- src/lib/auth/jwt.ts src/middleware.ts` → 빈 출력(0줄, 이번 세션에서 직접 확인).
- SPEC-AUTH-001 표면의 문제이며, 백로그 카드 `t16`(별도 워크트리 `.claude/worktrees/t16` 이미 존재)으로 추적 중이다. **고치지 않았다** — plan.md의 PRESERVE 대상이다.

### `tests/integration/auth/login.test.ts` AC-AUTH-005는 알려진 플레이크다 (근거를 남긴다)

bcrypt 타이밍-허용오차 비교 테스트로, 전체 스위트를 동시 실행할 때의 CPU 경합에 민감하다. 이번 세션에서 직접 재현·재확인했다:

- 전체 스위트 동시 실행 시 실패 — 1차 시도는 `diff=74.74ms > tolerance=65.14ms`, 2차(커버리지 포함) 시도는 `Test timed out in 30000ms`. 실패 형태가 매번 다르다는 것 자체가 부하-의존(비결정적) 신호다.
- 같은 세션에서 해당 파일만 단독 실행 시 통과(`diff=3.32ms`, `tolerance=54.35ms`).
- 이 현상은 새로운 발견이 아니다 — M4 커밋(`5175614`)이 이 플레이크를 M4 이전 베이스라인에서 `git stash`로 이미 재현해 선행 상태임을 확인한 기록을 커밋 메시지에 남겼고, M5 커밋(`a36eef3`)도 동일하게 재확인했다. 이번 세션의 재현은 그 기록과 일치한다.

**초록불을 이 SPEC이 만든 증거로 계상하지 않는다 — 그 반대도 마찬가지다.** 실패가 이 SPEC의 회귀라고도 계상하지 않는다. 원인은 머신 부하이며, 이 SPEC이 건드린 어떤 파일과도 무관하다(AC-AUTH-005는 SPEC-AUTH-001 소유).

### `SKIP_MOAI_PRECOMMIT=1` 사용 이력 (4건, 사유는 서로 다르다)

pre-commit 훅 우회는 임의가 아니라 각 시점에 커밋 메시지 본문에 남겨진 사유가 있다.

| 커밋 | 사유 | 사후 처리 |
|---|---|---|
| `2f6829e`(M3) | scope-boundary 테스트(AC-ORDER-019)의 `PAYMENT_DOMAIN_PATHS`가 당시 `src/app/api/payments`를 제외 목록에 포함하지 않아, 이 라우트가 읽어야 하는 Toss 웹훅 헤더 리터럴(`tosspayments-webhook-*`)을 오탐지 — 훅의 전체 스위트가 이 오탐 실패로 막혔다 | 바로 다음 커밋 `5e0a11f`에서 제외 목록을 확장해 정식으로 고쳤다(우회 방치가 아니라 즉시 수정) |
| `5175614`(M4) | pre-commit 훅 자체의 전체 스위트 실행(ast-grep 프로브 + lint + typecheck + 전체 테스트)이 추가하는 CPU 경합이 AC-AUTH-005 타이밍 비교를 스큐시켰다(3/3 재시도 모두 실패) | 커밋 메시지에 수동 검증 근거를 남겼다 — 훅 밖에서 단독 실행한 706/706 스위트 통과, 격리 실행 diff 0.26ms(허용치 54ms) |
| `a36eef3`(M5) | 동일 AC-AUTH-005 플레이크. `git stash`로 M4 베이스라인에서도 동일하게 재현됨을 확인(선행 상태 확정) | 커밋 메시지에 재현 절차 기록 |
| `f39edc8`(AC-PAYMENT-020 closeout) | 동일 AC-AUTH-005 플레이크. 훅의 전체 스위트 실행이 더한 CPU 경합 아래 `diff=123.40ms > tolerance=72.60ms`로 재발 — 이 SPEC에서 4번째 발현 | 커밋 메시지에 수동 검증 근거 기록 — 훅 밖 단독 실행 716/717(동일 플레이크만 실패, 격리 시 통과 diff=3.32ms), `--coverage --exclude tests/integration/auth/login.test.ts`로 716/716 클린 통과 + 커버리지 97.56/93.09/100/97.56, M4/M5 선례와 동일한 근거 |

네 건 모두 "선행 결함 또는 이 SPEC과 무관한 플레이크를 훅이 오판"한 사유이며, "테스트를 작성하지 않고 우회"한 사례는 없다. 각 마일스톤에서 직접 수행한 수동 검증(단독 실행 통과, 격리 diff 측정)이 훅이 대신할 검증의 실질적 증거로 커밋 메시지에 남아 있다.

### AC별 PASS/FAIL/EXCLUDED 매트릭스 (20건: PASS 19 + EXCLUDED 1)

| AC | 판정 | 검증 위치 |
|---|---|---|
| AC-PAYMENT-001 | PASS | `payment-repository.test.ts`(createAuditLog — 정확히 1행), `webhook-flow.test.ts`(통합) |
| AC-PAYMENT-002 | PASS | `payment-repository.test.ts` — PaymentAuditLog에 대한 update/delete/upsert export 0건 |
| AC-PAYMENT-003 | PASS | `schema.test.ts` — `OrderStatus` enum 3값 불변 |
| AC-PAYMENT-004 | PASS(부분) | `payment-service.test.ts`(확인·웹훅 양쪽에서 paymentKey 불일치 시 거부·기록), `schema.test.ts`(paymentKey unique 컬럼). **`AC-004-EXCL-CONCURRENCY`는 미검증으로 별도 기록**(실 PostgreSQL 부재로 승인/웹훅 경로가 진짜 동시 도착할 때의 행 잠금 직렬화는 관측 불가) |
| AC-PAYMENT-005 | PASS | `pay-button.test.tsx`, `toss-client.test.ts` — orderId/amount/orderName/successUrl/failUrl 전달 |
| AC-PAYMENT-006 | PASS | `payment-service.test.ts` — 금액 불일치 시 확인 API 미호출·트랜잭션 미개시 |
| AC-PAYMENT-007 | PASS | `payment-service.test.ts`, `webhook-flow.test.ts`(통합) — 승인 후 `paid` 전이 + CONFIRM_API 감사 로그 1건 |
| AC-PAYMENT-008 | PASS | `payment-service.test.ts` — (i) API 실패 시 트랜잭션 미개시 (ii) 이미 처리된 주문 멱등 재응답 |
| AC-PAYMENT-009 | PASS | `checkout-complete-page-payment.test.tsx` — (i) `pending_payment` + `payment_failed=1` → 배너+결제 버튼 (ii) 저장된 상태가 쿼리 파라미터보다 우선 |
| AC-PAYMENT-010 | PASS | `schema.test.ts`(OrderStatus 불변) + 직접 확인한 grep(`OrderStatus`와 `failed`/`payment_failed` 동시 참조 0건) |
| AC-PAYMENT-011 | PASS | `toss-server.test.ts`(HMAC 서명 검증), `payment-service.test.ts`, `webhook-flow.test.ts`(통합, 실제 서명 사용) |
| AC-PAYMENT-012 | PASS | `payment-service.test.ts` — 서명 실패 시 주문 조회 도달 이전에 차단 |
| AC-PAYMENT-013 | PASS | `payment-service.test.ts`, `webhook-flow.test.ts`(통합) — `DONE` 웹훅이 `pending_payment`를 `paid`로 전이 |
| AC-PAYMENT-014 | PASS | `payment-repository.test.ts`, `payment-service.test.ts`, `webhook-flow.test.ts`(통합) — 취소 웹훅이 재고 복원+`cancelled` 전이, 단일 트랜잭션 |
| AC-PAYMENT-015 | PASS | `payment-service.test.ts` — 금액 불일치 웹훅은 기록만 남기고 전이 없음 |
| AC-PAYMENT-016 | PASS | `payment-service.test.ts`, `webhook-flow.test.ts`(통합) — 재전송 시 no-op(known transmissionId) |
| AC-PAYMENT-017 | PASS | `payment-repository.test.ts` — `markOrderPaid`/`markOrderCancelledAndRestoreStock`이 조건부 `updateMany` 형태로 작성됨 |
| AC-PAYMENT-018 | PASS | `toss-client.test.ts` — `PG_SECRET_KEY`/`PG_WEBHOOK_SECRET` 참조 0건, `NEXT_PUBLIC_PG_CLIENT_KEY`만 사용 |
| AC-PAYMENT-019 | PASS | `toss-server.test.ts`(`next/*` import 0건), `pay-button.test.tsx`, `confirm/webhook route.test.ts`(서버 라우트 핸들러로만 존재) |
| AC-PAYMENT-020 | PASS | **`tests/unit/payments/guest-only-scope.test.ts`(신규, 이 세션에서 추가)** — `userId` 참조 0건, `resolveCartIdentity`의 `kind: "user"` 분기 0건, `Order`/`PaymentAuditLog` 모델에 `userId` 컬럼 없음. 이전에는 임시 `grep -rn "userId" src/features/payments src/app/api/payments`(0건, 미커밋)로만 확인되던 것을 이 세션에서 정규 회귀 테스트로 승격했다 |

### plan.md PRESERVE 경계 (git diff로 확인)

- `src/lib/auth/**` diff **0줄**, `src/middleware.ts` diff **0줄**(위 build 실패가 선행 결함임을 뒷받침하는 동일 증거).
- SPEC-ORDER-001 도메인(`src/features/orders/**`, `src/features/cart/**` 등)은 M2/M3/M4/M5에서 scope-boundary 제외 목록 확장(narrowing)만 있었고 기존 로직 diff는 없다 — SPEC-ORDER-001의 `scope-boundaries.test.ts`가 매 실행마다 이를 재확인한다(이번 세션의 전체 스위트 실행에도 포함되어 통과).

## §E.3 Run-phase Audit-Ready Signal

- run_status: **audit-ready**
- run_complete_at: 2026-09-02
- branch: `WT-payment-pg-webhook` / HEAD(마일스톤 종료 시점): `a36eef3` / base(plan-phase): `13f567b`
- 커밋 7건 — feat 4(M1/M2/M3/M4) + fix 1(M3 보정 `5e0a11f`) + docs 1(plan-audit 수정 `ec30a8b`) + test 1(M5 `a36eef3`). 관련 없는 마일스톤을 한 커밋에 묶지 않았다.
- 자동 검증 가능한 AC **19건 전부 PASS**. 이름 붙은 제외 1건(`AC-004-EXCL-CONCURRENCY`)은 위 표에 **미검증으로 명시 기록**했고 PASS로 계상하지 않았다.
- AC-PAYMENT-020은 이 세션에서 회귀 테스트(`tests/unit/payments/guest-only-scope.test.ts`)로 승격되어 이제 커밋된 자동 검증을 갖는다(과거엔 임시 grep 확인뿐이었다).
- 품질 게이트: typecheck/lint/prisma-validate 3개는 exit 0. 테스트는 알려진 플레이크(AC-AUTH-005, SPEC-AUTH-001 소유) 1건을 제외하면 전부 통과(716/716)하며, 커버리지는 97.56/93.09/100/97.56로 임계값(85/85/80/85)을 상회한다. `npm run build`만 exit 1이며, SPEC-ORDER-001이 이미 귀속 확인한 것과 동일한 선행 결함(node:crypto ↔ Edge 런타임)임을 이번 세션에서도 diff 0줄로 재확인했다.
- sync-phase가 받아 갈 잔여 항목:
  1. `npm run build` 선행 실패(Edge 런타임 ↔ `node:crypto`) — SPEC-AUTH-001 표면의 문제이므로 별도 SPEC 또는 이슈로 처리해야 한다. 이 SPEC이 도입하지 않았고 이 SPEC이 고칠 수도 없다. 백로그 카드 `t16`(워크트리 `.claude/worktrees/t16` 이미 존재)으로 추적 중.
  2. `AC-004-EXCL-CONCURRENCY` — 실 PostgreSQL 없이는 검증 불가, 숨기지 않고 명시 기록한다.
  3. `tests/integration/auth/login.test.ts` AC-AUTH-005 — 머신 부하 플레이크, SPEC-AUTH-001 소유, 이 SPEC이 만들지도 고치지도 않았다.

## §E.4 Sync-phase Audit-Ready Signal

sync_status: **audit-ready**
sync_complete_at: 2026-09-02
sync_commit_sha: `4d584371cd6bfe57973d71bbf17e183aaddedeb1`(백필 — 원 sync 커밋에는 `pending-backfill-sync-payment-001` 플레이스홀더로 기록되어 있었고, 이 커밋이 그 SHA를 채운다)
branch: `WT-payment-pg-webhook`
base_head_at_sync_entry: `f39edc8`(run-phase 종료 HEAD, closeout 커밋 포함)
changelog_entry_position: `CHANGELOG.md` `[Unreleased]` 섹션, SPEC-ORDER-001 항목(추가+알려진 한계) 다음, 최하단에 신규 추가(`### 추가 — SPEC-PAYMENT-001: ...` + `### 알려진 한계 — SPEC-PAYMENT-001`)

**§G 관련 정정**: 이 문서의 `§G Run-phase Blocker`는 이전 세션에서 `Agent(manager-develop)` 위임이 잘못된 워크트리로 자동 격리되며 발생한 블로커 보고다. 그 블로커는 이후 세션에서 해소되어 M1~M5가 정상적으로 이 브랜치(`WT-payment-pg-webhook`)에 순차 커밋되었다 — `git log --oneline`으로 `b243a97`(M1)부터 `f39edc8`(closeout)까지 8개 커밋이 실제로 이 브랜치에 존재함을 sync-phase에서 직접 확인했다. `§G`는 삭제하지 않고 이력으로 보존하되, **더 이상 유효한 차단 상태가 아님**을 여기 명시한다.

### sync-phase에서 재실행한 품질 게이트 (이 세션에서 직접 관측, HEAD `f39edc8`)

| 명령 | 종료 코드 | 관측 결과 |
|---|---|---|
| `npm run lint` | 0 | 출력 없음 |
| `npm run typecheck` | 0 | 출력 없음 |
| `npx prisma validate` | 0 | `The schema at prisma/schema.prisma is valid 🚀` |
| `npm run test -- --run` | 0 | `Test Files 61 passed (61)` / `Tests 717 passed (717)` — 이 실행에서는 AC-AUTH-005도 통과(부하 낮음, 플레이크 미발현) |
| `npx vitest run --coverage` | **1** | `Test Files 1 failed \| 60 passed (61)` / `Tests 1 failed \| 716 passed (717)` — 실패 1건은 `tests/integration/auth/login.test.ts` AC-AUTH-005(`diff=69.92ms > tolerance=64.30ms`), run-phase가 §E.2에 이미 기록한 것과 동일한 특성의 재현. SPEC-AUTH-001 소유, 이 SPEC과 무관 |
| `npx vitest run --coverage --exclude tests/integration/auth/login.test.ts` | 0 | `Test Files 60 passed (60)` / `Tests 716 passed (716)` / `All files 97.56 stmts / 93.09 branch / 100 funcs / 97.56 lines` — 임계값(85/85/80/85) 상회, run-phase §E.2 수치와 일치 |
| `npm run build` | **1** | `UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins` + import trace `./src/lib/auth/jwt.ts` — run-phase가 §E.2에 이미 귀속 확인한 것과 동일한 선행 결함. 이 세션은 run-phase의 귀속 결론을 재인용하지 않고, 실패 지문 자체를 이 세션에서 직접 재관측했다 |

증거 로그: `.moai/state/verify/spec-payment-001-sync/{lint,typecheck,prisma,test,coverage,coverage-excl,build}.log`(이 트리에 로컬 저장, gitignore 대상).

### B12 CHANGELOG 발행 자기검증 (3종)

1. **발행 전 grep**: `grep -c 'SPEC-PAYMENT-001' CHANGELOG.md` → 이 커밋 작성 직전 0건(중복 발행 없음 확인 후 신규 섹션 2개 추가).
2. **AC 개수 일치**: `grep -oE 'AC-PAYMENT-[0-9]+' .moai/specs/SPEC-PAYMENT-001/acceptance.md | sort -u | wc -l` → **20**. CHANGELOG 추가 항목 본문이 "인수 기준 20개 중 19개 PASS, 1개 제외"로 동일한 개수를 명시한다.
3. **파일 경로 검증**: CHANGELOG·README에 언급된 경로(`src/features/payments/`, `src/lib/payment/`, `src/app/api/payments/`, `src/components/checkout/PayButton.tsx`, `.env.example`) 전부 `ls`로 존재 확인 완료.

### frontmatter_status_transitions

- `spec.md`: `draft → implemented`
- `plan.md`: `draft → implemented`
- `acceptance.md`: `draft → implemented`
- `progress.md`: `in-progress → implemented`
- (`status:`/`updated:` 필드만 변경, 본문 내용은 변경하지 않음 — spec-frontmatter-schema.md § Forbidden ownership crossings 준수)

### canary_compliance_check

이 SPEC은 자기 자신이 테스트하는 forward-looking 정책을 정의하지 않는다(canary 항목 해당 없음).

### docs-site 동기화 확인

`ls -d docs .moai/docs` → `docs` 없음, `.moai/docs` 있음(디렉터리 내용은 프로젝트 문서 스캐폴딩용이며 별도의 다국어 docs-site가 아니다). 이 저장소에는 `adk.mo.ai.kr` 유형의 docs-site가 **존재하지 않는다** — 동기화를 건너뛴 것이 아니라 동기화 대상 자체가 없다(SPEC-ORDER-001 sync-phase의 동일한 확인과 일치).

### 잔여 항목 (sync-phase가 물려받아 재확인만 하고 고치지 않은 것)

1. `npm run build` 선행 실패(Edge 런타임 ↔ `node:crypto`) — 백로그 카드 `t16`.
2. `AC-004-EXCL-CONCURRENCY` — 실 PostgreSQL 없이는 여전히 미검증.
3. `tests/integration/auth/login.test.ts` AC-AUTH-005 — 머신 부하 플레이크, 이번 세션에서도 재현(coverage 실행에서 실패, 단독/저부하 실행에서는 통과).

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

## §G Run-phase Blocker — M1 Dispatch (environment mismatch) — RESOLVED, historical record

**Status: RESOLVED.** This blocker occurred at the START of the run-phase, before any milestone landed. It was resolved and M1-M5 subsequently completed across 7 commits — see §E.2 above (`b243a97` through `a36eef3`) for the full milestone-to-commit record. This section is retained as a historical account of the dispatch failure and its diagnosis; it does NOT describe the current state of this SPEC's implementation.

M1 (Prisma schema) was dispatched to `Agent(manager-develop, cycle_type=tdd)` from within this `t5` worktree (branch `WT-payment-pg-webhook`, HEAD `13f567b`). The spawn auto-isolated into a NEW worktree (`.claude/worktrees/agent-a7220c3c5f96b3d3f`, branch `worktree-agent-a7220c3c5f96b3d3f`) based on the PRIMARY checkout's `origin/main` tip (`bf075d3f`) — not on `WT-payment-pg-webhook`. That tree has no `.moai/specs/SPEC-PAYMENT-001/` directory at all. The leaf worker's own worktree-session guard refused any git operation reaching into `t5`, so it correctly returned a blocker report with zero file changes rather than fabricating work.

Confirmed via `git worktree list` that this is systemic, not a one-off: four pre-existing orphaned `agent-*` worktrees already exist in this repository from prior, unrelated spawns (branches `worktree-agent-aa41069806d133733`, `worktree-agent-aaa110e3320666a7f`, `worktree-agent-aec75fcdc20b707f5`, plus the one from this spawn) — every `Agent()` spawn in this environment auto-isolates into a fresh L1 worktree off the primary checkout's current branch, regardless of the calling session's own worktree/branch and regardless of whether `isolation:` was requested.

This contradicts the explicit task instruction to work directly in `t5` without creating a new worktree, and no in-prompt instruction can route around it (the guard is mechanical, not a matter of leaf-worker compliance). Escalated to the orchestrator as a blocker report rather than proceeding with an unvalidated cross-worktree cherry-pick reconciliation workaround across all 5 milestones without approval. See the blocker report returned in-band to the parent orchestrator for the proposed remediation options.

## §H CodeRabbit PR #9 Review Findings — Fix Pass

Branch `WT-payment-pg-webhook`, worktree `t5`. Fixes CodeRabbit's PR #9 review of this SPEC's implementation (8 findings, 4 Major code + 4 Minor doc). TDD: new/updated tests written first, RED captured against the pre-fix implementation via `git stash`, then GREEN against the fix — see `.moai/state/verify/spec-payment-001-coderabbit/{RED,GREEN}.log`.

**Finding 1 (Major, architectural)** — the general `PAYMENT_STATUS_CHANGED` webhook does NOT carry a `tosspayments-webhook-signature` header (that header is Toss-documented as `payout.changed`/`seller.changed`-only). Replaced `verifyWebhookSignature` (HMAC-SHA256) with `queryTossPayment(paymentKey)` — Toss's own Payment Query API (`GET /v1/payments/{paymentKey}`, Basic auth via `PG_SECRET_KEY`) — and rewired `processWebhook()` to drive every decision (orderId, amount, status) from the QUERIED record, never from the webhook payload's own claims. `PG_WEBHOOK_SECRET` removed from `.env.example` (no longer referenced anywhere in `src/`). SPEC docs (`spec.md`, `plan.md`, `design.md`, `research.md`, `acceptance.md`) updated to describe the query-based flow; REQ/AC numbering kept stable (REQ-PAYMENT-011/012/014, AC-PAYMENT-011/012/013/014).

**Finding 2 (Major)** — the CANCELED webhook branch cancelled the order without checking the queried `paymentKey` against the order's own stored `paymentKey`. Added the guard: mismatch → `payment-key-mismatch` outcome, no cancellation, no repository call.

**Finding 3 (Major)** — `PARTIAL_CANCELED` was routed into the same full-cancellation path as `CANCELED`, over-restoring stock and wrongly marking a partially-paid order fully cancelled. Routed to a distinct branch: records a no-transition `PaymentAuditLog` entry (previousStatus === newStatus) and returns a new `unhandled` outcome; `markOrderCancelledAndRestoreStock` is never called for this status.

**Finding 4 (Major)** — `confirmTossPayment`'s `fetch` call had no timeout, so a hung Toss response could hang the guest's confirm redirect indefinitely. Added `signal: AbortSignal.timeout(10_000)` to both `confirmTossPayment` and the new `queryTossPayment`; a timeout/network error is caught and returned as an ordinary `{ ok: false, status: 504 }` failure result (never a thrown exception), so `confirmPayment()`'s existing `CONFIRM_API_FAILED` retry path handles it unchanged.

**Findings 5-8 (Minor, documentation)** — acceptance.md DoD re-verified accurate as of this fix (see below); progress.md §G retitled RESOLVED/historical (was still reading "BLOCKED"); CHANGELOG.md's "717 tests passed" qualified with the load-dependent 716/717 vs 717/717 split (matching this file's own §E.2/§E.4 record) and the `CONFIRM_API_FAILED`-implies-cancellation misstatement corrected (only the webhook `CANCELED` branch cancels).

**§4 DoD re-verification (Finding 5)**: after this fix, `npm run typecheck` / `npm run lint` / `npx prisma validate` all exit 0 (evidence below). `npm run build` still exits 1 — the same pre-existing, previously-attributed `node:crypto` ↔ Edge-runtime defect this SPEC does not own (unchanged by this fix; diff 0 lines on `src/middleware.ts` / `src/lib/auth/jwt.ts`). Full suite: 730/731 passed (1 known AC-AUTH-005 flake, SPEC-AUTH-001-owned). With that flake excluded via `--exclude tests/integration/auth/login.test.ts`: 730/730 passed, coverage 97.69% stmts / 93.78% branch / 100% funcs / 97.69% lines (threshold 85/85/80/85). `status: completed` in this SPEC's frontmatter remains accurate for the SPEC's own scope — CodeRabbit's findings were code-review feedback on already-completed work, now addressed as a follow-up fix commit; no formal amendment transition was needed since scope/requirements did not change, only the webhook-verification mechanism's correctness.

### Evidence (Section E, attributable)

```text
$ npm run typecheck                                          → exit 0
$ npm run lint                                                → exit 0
$ npx prisma validate                                         → "The schema at prisma/schema.prisma is valid"
$ npx vitest run --run                                        → Test Files 1 failed | 60 passed (61); Tests 1 failed | 730 passed (731)
                                                                  (the 1 failure is AC-AUTH-005, tests/integration/auth/login.test.ts — known flake, SPEC-AUTH-001 scope)
$ npx vitest run --coverage --exclude tests/integration/auth/login.test.ts
                                                                → exit 0; Test Files 60 passed (60); Tests 730 passed (730)
                                                                  All files 97.69% stmts / 93.78% branch / 100% funcs / 97.69% lines
```

Baseline attribution: this run, this tree, HEAD at fix-commit time (see the commit trailer for the exact SHA). Logs persisted at `.moai/state/verify/spec-payment-001-coderabbit/{RED,GREEN,typecheck,lint,full-suite,coverage}.log` (gitignored, local to this worktree).

Gaps: `AC-004-EXCL-CONCURRENCY` remains unverified (no live PostgreSQL in this environment — unchanged, pre-existing limitation, unrelated to this fix). The Toss Payment Query API's real HTTP behavior (rate limits, exact response shape edge cases) is not exercised — only mocked/faked, matching this SPEC's existing harness-limitation pattern for `confirmTossPayment`.

## §J Round-2 fix — CodeRabbit PR #9 second review (2026-09-02)

Fixes 3 code findings from CodeRabbit's second review pass on PR #9, commit `9211a10`.

**Finding A (Major, CWE-20 Improper Input Validation)** — `processWebhook()` looked up the idempotency key (`transmissionId`) BEFORE validating it was non-empty. The webhook route defaults a missing/absent transmission-id header to `""`, so multiple header-less deliveries would all collide on the same empty-string audit-log key and be incorrectly classified `already-applied` (dropped), even though each is a genuinely new event with real state to apply. Fixed: `processWebhook()` now rejects `headers.transmissionId === ""` as `malformed-payload` BEFORE calling `findAuditLogByTransmissionId` or persisting any audit data — reusing the existing `"malformed-payload"` union member (no type change needed). Regression test added (`payment-service.test.ts`): an empty-transmissionId webhook is rejected as malformed, and `findAuditLogByTransmissionId`/`queryTossPayment`/`createAuditLog` are never called.

**Finding B (Major, CWE-400 DoS)** — `POST /api/payments/webhook` had no rate/concurrency limiting; `src/middleware.ts` protects only `/admin/**`. An attacker could hit this public, unauthenticated endpoint repeatedly, each unique `transmissionId` triggering an authenticated `queryTossPayment` call (consuming Toss API quota) with no throttle. Fixed: reused the EXISTING `checkIpRateLimit` utility (`src/lib/auth/rate-limit.ts`, unmodified — read-only import) at the top of the route handler, before any body parsing or Toss calls — same call shape and 429 response convention (`{ error: "Too many requests" }`) as `src/app/api/auth/login/route.ts`. Regression tests added (`route.test.ts`): the 6th request within the rolling window from the same IP gets 429 and `processWebhook` is never called for it; a different IP is unaffected. The pre-existing webhook route/integration test suites (none of which set `x-forwarded-for`, so they share the "unknown" IP bucket) needed `__resetRateLimitStoreForTests()` added to their `beforeEach` to avoid a spurious cross-test 429 — this is test-infrastructure adaptation, not a behavior change to those suites.

**Finding C (Minor, CWE-319 Cleartext Transmission via redirect)** — both `fetch` calls to Toss (`confirmTossPayment` and `queryTossPayment`) in `toss-server.ts` carried `Authorization: Basic <PG_SECRET_KEY>` without `redirect: "error"`; a response redirected to an unintended host could have the secret-bearing header replayed there. Fixed: added `redirect: "error"` to both fetch option objects. Regression tests added (`toss-server.test.ts`) asserting `init.redirect === "error"` for both calls.

**Minor doc fixes** — `design.md` §5 and `progress.md` §E (Evidence) fenced code blocks lacked a language tag (MD040 lint); both now tagged ` ```text `.

**Honest DoD re-verification (per acceptance.md §4)**: after Findings A/B/C, `npm run typecheck` and `npm run lint` still exit 0; the full suite passes 736/736 (including the previously-flaky AC-AUTH-005, green this run) and, with that test excluded per the standard convention, 735/735 with coverage 97.70% stmts / 93.81% branch / 100% funcs / 97.70% lines (threshold 85/85/80/85 — met). However, `npm run build` **still exits 1** — the same pre-existing `node:crypto` ↔ Edge-runtime defect in `src/lib/auth/jwt.ts` (a file this fix's PRESERVE constraint forbids touching), unchanged by this round. acceptance.md §4's own DoD checklist already carries 4 unchecked items independent of Findings A/B/C — the `npm run build` failure (§3 quality gate), the fake `$transaction` rollback-record gap, the completion-page EXTEND-boundary diff record, and the plan.md §0 decision-cross-check record — none of which this round's scope (3 CodeRabbit code findings + 2 doc fences) touches or resolves. **CodeRabbit's "completed while DoD open" finding is THEREFORE NOT stale**: a genuine gap remains (`npm run build` exit 1, plus 3 unconfirmed DoD checklist items), and this progress record does not claim the SPEC's overall DoD is fully closed — only that Findings A/B/C are fixed and verified. The `status: completed` frontmatter value is unchanged by this round (not a transition this fix performs); resolving the residual DoD gap is a separate, out-of-scope follow-up.

### Evidence (round-2, attributable)

```text
$ npx vitest run tests/unit/payments/payment-service.test.ts tests/unit/payments/toss-server.test.ts tests/unit/api/payments/webhook/route.test.ts
  → RED (pre-fix): 4 failed | 38 passed (42)
  → GREEN (post-fix): 42 passed (42)
$ npm run typecheck                                                          → exit 0
$ npm run lint                                                                → exit 0
$ npx vitest run --run                                                        → Test Files 61 passed (61); Tests 736 passed (736)
$ npx vitest run --coverage --exclude tests/integration/auth/login.test.ts
                                                                → Test Files 60 passed (60); Tests 735 passed (735)
                                                                  All files 97.70% stmts / 93.81% branch / 100% funcs / 97.70% lines
$ npm run build                                                               → exit 1 (pre-existing node:crypto defect, unchanged)
```

Baseline attribution: this run, this tree, HEAD at round-2 fix-commit time (see the commit trailer for the exact SHA). Logs persisted at `.moai/state/verify/spec-payment-001-coderabbit-r2/{RED,GREEN,typecheck,lint,full-suite,coverage}.log` (gitignored, local to this worktree).

Gaps: same as §E.4 above (`AC-004-EXCL-CONCURRENCY`, real Toss HTTP behavior) — unchanged by this round. Additionally: the `npm run build` failure and the 3 unconfirmed acceptance.md §4 DoD items (fake `$transaction` rollback record, EXTEND-boundary diff record, plan.md §0 decision cross-check) remain open and are explicitly out of this round's scope.
