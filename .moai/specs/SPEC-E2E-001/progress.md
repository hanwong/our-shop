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

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
