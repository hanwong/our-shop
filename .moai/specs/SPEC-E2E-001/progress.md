# SPEC-E2E-001 — 진행 기록

> 결제·주문 경로 E2E 테스트 시나리오 (게스트 전용)

## §Phase 1 SKIP Rationale

**Phase 1 (Explore recon)은 건너뛰었다.**

사유: 위임 시점에 이미 Explore recon 패스가 완료되어 결과가 위임 프롬프트에 요약되어 전달됐다 — 저장소에 브라우저 E2E가 전무하다는 사실(`playwright.config.*` 없음, `e2e/` 없음, `test:e2e` 스크립트 없음, CI 브라우저 잡 없음), 선행 SPEC 목록, 여정 경로/파일 지도가 모두 포함됐다. 동일 정찰을 재실행하는 것은 중복 비용이므로 생략하고, 대신 전달받은 지도를 **실제 코드에 대해 재검증**했다.

재검증에서 확인된 드리프트 2건 (spec.md §4.2에 반영):

1. **컴포넌트 경로**: `PayButton.tsx` 등은 라우트 디렉터리에 동거하지 않고 `src/components/checkout/` 아래에 있다. `src/app/checkout/complete/[orderId]/` 에는 `page.tsx` 하나뿐이다.
2. **SPEC-CI-001 상태**: 위임 프롬프트는 "아직 생성되지 않음"으로 기술했으나, 실제로는 **이미 존재하며 `status: completed`** 다. CI 워크플로(`.github/workflows/ci.yml`)도 존재한다. 다만 그 SPEC은 CD와 데이터베이스를 명시적으로 범위 밖에 두고 닫혔으므로 — `DATABASE_URL` 은 루프백 자리표시자이고 테스트는 Prisma 이음매를 모킹한다 — "CI에 살아 있는 데이터베이스가 없다"는 전제 자체는 **그대로 성립**한다. 확정된 범위 결정 #2는 영향받지 않으며, SPEC ID 귀속만 정정했다.

추가로 발견된 설계상 난점 1건 — 서버 측 Toss confirm 호출의 대상 URL이 `toss-server.ts` 의 모듈 상수로 하드코딩되어 있어 Playwright `page.route()` 로 가로챌 수 없다는 사실 — 은 `plan.md` §B에 기록했고, **2026-09-05 사용자 결정으로 확정됐다**: 테스트 전용 undici `setGlobalDispatcher` 네트워크 모킹을 채택하고 프로덕션 소스는 0줄 변경한다. 베이스 URL 환경 변수 이음매는 기각됐다. 확정된 범위 결정 #1의 의도(Toss에 실제로 도달하지 않는다)는 그대로 유지된다.

---

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_complete_at: 2026-09-05
plan_status: audit-passed   # iter2 PASS 0.94 (Tier M 임계값 0.80) + D9·D10 당일 후속 반영
spec_id: SPEC-E2E-001
tier: M
artifacts:
  - spec.md
  - plan.md
  - acceptance.md
  - spec-compact.md
  - progress.md
requirements: REQ-E2E-001..016
acceptance_criteria: AC-E2E-001..015   # 005a/005b 분기 포함 실제 16항목
open_decisions: 0   # plan.md §B 확정 (2026-09-05, 사용자 결정)
phase1_skipped: true
```

**미해결 결정 없음.** `plan.md` §B의 서버 측 confirm 가로채기 이음매는 2026-09-05 사용자 결정으로 확정됐다 — 테스트 전용 undici `setGlobalDispatcher` 모킹, 프로덕션 소스 변경 0줄, 베이스 URL 환경 변수 이음매는 기각. run-phase M1은 이 이음매가 `TOSS_CONFIRM_URL` 과 조회 엔드포인트를 실제로 가로채는지 4단계 스파이크로 먼저 증명한 뒤 나머지 스위트를 진행한다.

### plan-audit 이력

| 회차 | 판정 | 점수 | 상태 |
|---|---|---|---|
| iter1 (2026-09-05) | FAIL | 0.825 (Tier M 임계값 0.80) | D1~D8 전량 반영 |
| iter2 (2026-09-05) | **PASS** | **0.94** | D9·D10 당일 후속 반영 |

iter1의 FAIL은 점수 미달이 아니라 blocking-class 소견에서 발생했다(must-pass 7건은 전부 통과). 보고서: `.moai/reports/plan-audit/SPEC-E2E-001-2026-09-05.md` (`## Iteration 2` 절 포함).

반영 내역 — D1(기각 대안 잔존 서술 제거), D2(AC 범위 상호 참조 정정), D3(AC-E2E-015 신설로 REQ-E2E-016 커버), D4(요구사항 20→16 병합, `tier: M` 유지), D5(`TOSS_PAYMENT_QUERY_URL` 실제 값 정정), D6(AC 개수 표기 정합), D7(D4 병합으로 자연 해소), D8(재현 불가 수치 완화). **8건 전부 반영, 부분 반영 없음.**

D4 산술 정정: 감사 보고서가 제시한 병합 후보 3쌍(002+003, 008+009, 018+019)은 20−3=17로 Tier M 상한 16에 도달하지 못한다. 의미상 이미 단일 단위인 네 번째 쌍 — 구 REQ-E2E-006(Toss 호스트 무접촉 금지)과 구 REQ-E2E-010(서버 측 가로채기 의무) — 을 추가 병합해 16에 맞췄다. 이 둘은 병합 전에도 AC-E2E-004 하나가 함께 추적하던 쌍이라 1:1 추적성이 오히려 개선된다.

### iter2 이후 당일 후속 반영 (D9·D10)

iter2에서 PASS(0.94)를 받은 뒤, 점수에 반영되지 않는 소견 2건을 같은 날 추가로 고쳤다. 새로운 감사 회차가 아니며, 채점 대상 내용을 바꾸지 않는다.

- **D9** — `plan.md` §E 자체 검증 표의 "기존 스위트 불변" 행이 병합 이후 잘못된 REQ ID(`REQ-E2E-003`)를 가리키고 있었다. 해당 내용은 병합 후 `REQ-E2E-002`에 속하고 `REQ-E2E-003`은 무관한 서버 기동 대기 게이트이므로 `REQ-E2E-002`로 정정했다.
- **D10** — iter1 반영 시 D8(재현 불가한 "268개" 수치 완화)을 `spec.md`에만 적용하고 `spec-compact.md`를 빠뜨렸다. `spec-compact.md`에도 동일하게 "당시 전체 단위·통합 스위트"로 완화했다. iter1 기록의 "8건 전부 반영" 주장은 이 시점에야 실제로 성립한다.

**변경 후 재확인한 것**: `moai spec lint` 무소견, `plan.md`의 REQ 참조 21건을 `spec.md` 정의와 대조(불일치 0), `acceptance.md` `추적:` 라인 16개와 REQ 16건의 대응. **재확인하지 않은 것**: 산문 서술의 사실성 전반 — 위 세 가지 외의 항목은 이번 후속에서 다시 검증하지 않았다.

재감사가 다시 필요해질 경우 확인 대상: 요구사항 16건(REQ-E2E-001~016), AC 16항목(AC-E2E-001~015, 005a/005b 분기 포함), `추적:` 라인 16개가 REQ 16건을 빠짐없이 덮는지.

## §E.2 Run-phase Evidence

### M1 — 하네스 뼈대와 다리 2 스파이크 (완료)

**작업 위치**: 이 milestone은 오케스트레이터 격리 배치로 `.claude/worktrees/agent-a477de99ff461615d` (t14가 아닌 별도 워크트리, HEAD가 `WT-checkout-e2e-tests`와 불일치)에서 수행됐다. `git checkout -b m1-e2e-spike e3cb982...`로 t14의 plan-phase 커밋에서 분기해 작업했다 — 위임 프롬프트 §A.0의 예상된 격리 시나리오. 최종 통합(머지)은 오케스트레이터가 t14 워크트리에서 수행한다.

**cycle_type=tdd — RED-GREEN 실행 기록**: `e2e/smoke.spec.ts`를 Chromium 브라우저 설치 이전에 먼저 실행해 RED 상태(`browserType.launch: Executable doesn't exist`)를 확보한 뒤 `npx playwright install chromium`으로 GREEN 전환했다. 그 과정에서 실제 결함 2건을 발견·수정했다 — (a) Playwright config 프로세스가 Next.js의 자체 `.env` 로딩을 거치지 않아 `DATABASE_URL`이 누락으로 오판정되던 문제(env-check.ts가 루트 `.env`도 함께 로드하도록 수정), (b) Next.js dev 서버가 `--import` 훅을 **한 프로세스가 아니라 여러 워커 프로세스**에서 각각 로드한다는 사실이 드러나며, 인터셉터 모듈 자신이 로드 시점에 호출 로그 파일을 truncate하던 로직이 나중에 뜬 워커의 로드로 먼저 기록된 호출을 지워버리는 경합을 일으켰다(로그 클리어를 Playwright config 프로세스로 이전해 웹서버 기동 전 단 한 번만 실행되도록 수정).

**M1 스파이크 4단계 — 전부 PASS**: 아래 §E.2 PASS/FAIL 매트릭스 참조.

## §E.2a M1 스파이크 PASS/FAIL 매트릭스 (plan.md §B 4단계)

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | `/api/payments/confirm`을 태워 `confirmTossPayment()`가 실제로 실행됨 | PASS | `e2e/m1-spike.spec.ts`가 실제 pending_payment 주문으로 confirm 라우트를 호출하고, 응답 리다이렉트가 `?payment_failed=1` 없이 `/checkout/complete/{orderId}`로 도달함을 확인(성공 경로는 `confirmTossPayment()`가 2xx를 받아야만 도달 가능) |
| 2 | 그 호출이 `TOSS_CONFIRM_URL`로 나갔고 MockAgent가 가로챘음이 인터셉터 측 기록으로 확인됨 | PASS | `e2e/.tmp/toss-mock-calls.jsonl`에 `{"endpoint":"confirm","method":"POST","path":"/v1/payments/confirm",...}` 기록 (호출 카운트 방식 채택 — plan.md §B가 명시한 두 방식 중 하나) |
| 3 | `queryTossPayment()`의 조회 엔드포인트도 같은 방식으로 가로채짐 | PASS | 동일 로그에 `{"endpoint":"query","method":"GET","path":"/v1/payments/e2e_spike_<orderId>",...}` 기록 — `/api/payments/webhook`을 태워 재현 |
| 4 | Toss 호스트 감시 라우트가 한 번도 발동하지 않음(반대 방향 증거) | PASS | `e2e/support/fixtures.ts`의 `tossHostHits` 픽스처(모든 `*.tosspayments.com` 요청을 abort+기록)가 스파이크 시나리오 전체에서 길이 0으로 유지됨 (`expect(tossHostHits).toHaveLength(0)`) |

**결론**: plan.md §B가 확정한 undici 전역 디스패처 모킹은 Next.js dev 서버의 route handler 실행 컨텍스트(다수의 워커 프로세스 포함)에 실제로 도달한다 — ASSUMPTION이 아니라 이제 관측된 사실이다. M2 이후 진행에 블로커 없음.

### AC-E2E-003 개별 재확인

M1 종료 조건과 별개로, `e2e/e2e-stub.env`를 임시로 제거한 뒤 `npm run test:e2e`를 실행해 `NEXT_PUBLIC_PG_CLIENT_KEY, PG_SECRET_KEY`를 정확히 이름으로 지목하는 조기 실패 메시지를 확인했다(§E 자체 검증 섹션의 명령/출력 참조). 파일을 원복한 뒤 스위트가 다시 GREEN임을 재확인했다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_milestone: M1
run_status: milestone-complete   # M1만 완료 — M2~M6은 미착수
m1_spike_points_pass: 4   # / 4
ac_verified_this_milestone: [AC-E2E-002, AC-E2E-003]   # 부분: AC-E2E-001은 M3+ 실 여정에서 완전 검증
baseline_vitest_files_before: 110
baseline_vitest_files_after: 110
baseline_vitest_tests_after: 1478
toss_server_ts_diff_lines: 0
typecheck_status: pass
lint_status: pass
new_files:
  - playwright.config.ts
  - e2e/e2e-stub.env
  - e2e/smoke.spec.ts
  - e2e/m1-spike.spec.ts
  - e2e/support/env-check.ts
  - e2e/support/call-log.ts
  - e2e/support/fixtures.ts
  - e2e/support/order-fixture.ts
  - e2e/support/mock-toss-api.mjs
modified_files:
  - package.json   # test:e2e script + @playwright/test + undici devDependencies
  - package-lock.json
worktree_case: isolated-recovery   # A.0 — 별도 워크트리에서 m1-e2e-spike 브랜치로 작업, t14로 머지 예정
next_milestone: M2   # Toss 스텁 SDK와 결제 경로 (plan.md §F)
```

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## §F Phase 4 Mode Selection

**Input parameters**: tier=M, scope≈6 milestones/~10 files (playwright.config.ts, package.json, e2e/support/*, e2e/*.spec.ts, e2e/README.md), domain count=1 (E2E/Playwright — single cross-cutting concern touching both browser and server-side mocking), file language mix=TypeScript, concurrency benefit=LOW (coding-heavy, milestones have sequential dependency — M2 depends on M1's spike proof), Agent Teams prereqs=not requested.

| Mode | Selected? | Rationale |
|---|---|---|
| `direct` | No | Non-trivial: new test harness + mocking infrastructure across 6 milestones |
| `serial` | **YES** | Coding-heavy, sequential milestone dependency (M1 spike gates M2+); Anthropic's coding-task parallelism caveat applies |
| `fanout` | No | Not multi-domain research; single cross-cutting E2E concern |
| `sweep` | No | Not mechanical/uniform; M1 spike is a genuine unknown requiring judgment, not a bulk transform |

**Decision: serial**

**Justification**: This is coding-heavy implementation work with a hard sequential dependency — M2-M6 all build on M1's proof that the undici interceptor reaches the Next.js route-handler execution context. Per Anthropic's coding-task parallelism caveat, coding work has fewer truly parallelizable units than research; `serial` (single manager-develop spawn per milestone) is the correct default here.

**Implementation Kickoff Approval**: user approved 2026-09-05 via AskUserQuestion (option: "지금 시작 (권장)"); progression mode = autonomous ("자동 진행 (권장)").
