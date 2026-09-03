---
id: SPEC-ORDER-003
status: in-progress
updated: 2026-09-03
tier: M
---

# Progress: SPEC-ORDER-003 — 게스트 주문 재방문 조회와 주문 상태 표시

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-03
plan_status: audit-ready

plan-phase 산출물 3종(spec.md, plan.md, acceptance.md) 작성 완료. Tier M.

**SPEC ID 검사**: 정규식 검사를 Bash로 실행해 `PASS SPEC-ORDER-003`을 관측했다. 동일 ID 부재도 확인했다 — `.moai/specs/SPEC-ORDER-003` 디렉터리 없음, `.moai/specs/` 전체 grep에서 `SPEC-ORDER-003` 참조 0건.

**프론트매터**: 정본 12필드 전부 존재 + `tier: M` + `depends_on`. `phase: "v0.2.0 target"`(릴리스 대상), `status: draft`.

**REQ/AC 대응**: REQ 12건(REQ-ORDER-034 ~ 045) / AC 13건(AC-ORDER-037 ~ 049). 13:12인 사유는 acceptance.md §0 머리말에 명시했다(REQ-ORDER-036이 응답 동일성과 조회 호출 횟수라는 두 관측으로 나뉜다). Tier M 상한(REQ 16 / AC 16) 이내.

**번호 이어받기**: `ORDER` 도메인의 기존 번호를 잇는다 — SPEC-ORDER-001이 REQ 001~021, SPEC-ORDER-002가 REQ 022~033 / AC ~036을 사용했으므로 이 SPEC은 REQ 034, AC 037부터 시작한다. SPEC-ORDER-002가 SPEC-ORDER-001을 이어받은 선례를 따랐다.

**depends_on 근거**: `SPEC-ORDER-001`(`status: completed` — `Order` 모델·`orderNumber`·배송지 스냅샷·`OrderStatus`·`findOrderForGuest()` 제공, 그리고 §3에서 재방문 조회 수단을 이 SPEC 앞으로 명시적으로 넘김), `SPEC-PAYMENT-001`(`status: completed` — `pending_payment → paid | cancelled` 전이 제공. 이것이 없으면 모든 주문이 영원히 초기 상태여서 "상태 조회"가 성립하지 않음). 두 SPEC의 프론트매터를 직접 읽어 `status: completed`를 확인했다.

**범위 형태 결정**: 백로그 카드 `t8`이 묶은 세 능력 중 하나(게스트 재방문 조회)만 인수하고 둘(배송지 주소록, 배송 이행 상태 기계)은 spec.md §3에서 제외했다. 사유와 증거는 spec.md §2, 넘긴 곳과 선행 조건은 plan.md §0에 있다. 제외한 둘은 각각 백로그 카드 `t23`(배송지 주소록 관리)과 `t24`(배송 이행 상태 기계)로 분리되어 `t8`에서 떨어져 나왔다. SPEC ID는 `SPEC-SHIPPING-001` 대신 `SPEC-ORDER-003`으로 확정했다 — 결정 2가 이행 상태값을 범위 밖으로 확정했으므로 `SHIPPING` 이름을 되돌릴 조건은 현재 성립하지 않는다.

**plan-audit 판정: PASS · 종합 점수 0.94** (Tier M 임계값 0.80, 세 번째이자 마지막으로 가능했던 반복에서 관측). 이 SPEC의 plan-audit은 세 번 실행되었다 — 앞 두 번은 FAIL, 세 번째가 PASS다. 세 보고서 모두 `.moai/reports/plan-audit/` 아래에 실재하며, 오케스트레이터가 직접 열어 판정 문구를 대조했다.

- **1차 — FAIL, 점수 0.81** (Tier M 임계값 0.80). 점수는 임계값을 넘겼으나 결함 두 건에 막혔다 — **D1**(치명, 차단): REQ-ORDER-034/035가 REQ-ORDER-044의 쿠키 기반 조회와 모순되어 요구사항 쌍이 동시에 만족될 수 없었다. **D2**(중대, 차단): REQ-ORDER-036의 "응답 시간" 절이 AC-ORDER-040의 검증 범위와 맞춰지지 않은 채 남아 있었다. must-pass는 7/7 PASS였다. 보고서: `.moai/reports/plan-audit/SPEC-ORDER-003-review-1.md`.
- **2차 — FAIL, 점수 0.94** (임계값을 크게 상회). D1·D2가 모두 완전히 해소되었고 must-pass도 7/7 PASS였으나, 이 progress.md 자신이 감사 이력이 없다는 취지로 쓰여 있어 사실과 어긋난 결함(N1) 하나 때문에 FAIL로 닫혔다. 보고서: `.moai/reports/plan-audit/SPEC-ORDER-003-review-2.md`.
- **3차(최종) — PASS, 점수 0.94** (2차와 동일 점수 — 이번 반복은 결함 수정이 아니라 N1 정정 확인이었다). N1·N2 모두 RESOLVED로 재확인, must-pass 7/7, 회귀 결함 0건. 남은 항목은 전부 optional이며(O1~O4) 감사 자신이 "강제 FAIL 사유 아님, 마지막 반복에서 인위적으로 FAIL을 만들지 않는다"고 명시했다. 보고서: `.moai/reports/plan-audit/SPEC-ORDER-003-review-3.md`.

**run-phase 진입을 막는 항목은 이제 없다.** Implementation Kickoff Approval 게이트로 넘어갈 준비가 됐다.

**열린 항목 3건 모두 해소됨 (2026-09-03 사용자 결정)**. run-phase 진입 전 해소가 필요했던 세 항목 — 배송지 주소록 제외 여부 / "배송 상태"의 의미 / 재방문 조회의 대조 비밀값 — 은 셋 다 사용자 결정으로 닫혔고, 확정 내용·근거·받아들인 대가는 plan.md §0에 결정 1~3으로 기록되어 있다. 확정 요지: (1) 배송지 주소록은 이 SPEC에서 완전히 제외하고 백로그 카드 `t23`으로 분리, (2) 새 이행 상태값을 도입하지 않고 기존 `OrderStatus` 3종만 재방문 조회에서 표시하며 이행 상태 기계는 백로그 카드 `t24`로 분리, (3) 대조 비밀값은 주문 번호 + 수령인 연락처(`recipientPhone`). 셋 다 조사가 내놓았던 권고와 같은 선택이므로 Tier M과 `SPEC-ORDER-003` ID는 그대로 유지된다. **범위를 여는 열린 항목은 이제 없다.**

## §E.2 Run-phase Evidence

### M1 — 조회 권한 규칙과 실패 표면 (완료, TDD)

**범위**: `order-repository.ts`에 `findOrderByNumberAndPhone()` 추가, `order-service.ts`에 `lookupOrderByNumberAndPhone()` 유스케이스 추가, `types/order.ts`에 `LookupOrderInput`/`LookupOrderFailure`/`LookupOrderResult` 추가. M2(화면)·M3(레이트리밋)·M4(회귀 확인)는 이 커밋 범위 밖.

**RED (구현 전 실패, 커밋 전 로컬 관측)**:

```
$ npx vitest run tests/unit/orders/order-repository.test.ts
 × SPEC-ORDER-003 M1 — findOrderByNumberAndPhone (...) > bakes BOTH orderNumber and recipientPhone into ONE findFirst where clause
   → repo.findOrderByNumberAndPhone is not a function
 × ... joins the items so the lookup result can render the order snapshot
   → repo.findOrderByNumberAndPhone is not a function
 × ... runs on the transaction client when given one
   → repo.findOrderByNumberAndPhone is not a function
 Test Files  1 failed (1) / Tests  3 failed | 16 passed (19)

$ npx vitest run tests/unit/orders/order-service.test.ts
 × SPEC-ORDER-003 M1 — lookupOrderByNumberAndPhone > AC-ORDER-037 ... > returns the order when orderNumber AND recipientPhone both match
   → service.lookupOrderByNumberAndPhone is not a function
 (동일하게 AC-ORDER-038/039/040/047×2 — 총 6건 모두 "is not a function")
 Test Files  1 failed (1) / Tests  6 failed | 78 passed (84)
```

**GREEN (구현 후)**: `npx vitest run tests/unit/orders/order-repository.test.ts tests/unit/orders/order-service.test.ts` → `Test Files 2 passed (2)` / `Tests 103 passed (103)`.

**E1 — AC PASS/FAIL 매트릭스**

| AC | 상태 | 검증 명령 | 관측 결과 |
|---|---|---|---|
| AC-ORDER-037 | PASS | `npx vitest run tests/unit/orders/order-service.test.ts -t "AC-ORDER-037"` | `✓ ... returns the order when orderNumber AND recipientPhone both match` |
| AC-ORDER-038 | PASS | `npx vitest run tests/unit/orders/order-service.test.ts -t "AC-ORDER-038"` | `✓ ... returns a failure carrying no order field when the phone does not match` |
| AC-ORDER-039 | PASS | `npx vitest run tests/unit/orders/order-service.test.ts -t "AC-ORDER-039"` | `✓ ... returns the SAME status and body for a nonexistent order number and a wrong-phone match` |
| AC-ORDER-040 | PASS | `npx vitest run tests/unit/orders/order-service.test.ts -t "AC-ORDER-040"` | `✓ ... calls the repository EXACTLY once for both the not-found and the mismatch path` |
| AC-ORDER-047 | PASS | `npx vitest run tests/unit/orders/order-service.test.ts -t "AC-ORDER-047"` | `✓ ... names both a blank order number and a malformed phone, and never calls the repository` / `✓ ... passes a well-formed submission through to the repository` |

전체 배치 실행(6건 동시): `npx vitest run tests/unit/orders/order-service.test.ts -t "AC-ORDER-037|AC-ORDER-038|AC-ORDER-039|AC-ORDER-040|AC-ORDER-047"` → `Test Files 1 passed (1)` / `Tests 6 passed | 78 skipped (84)`.

**E2 — 전체 빌드**: `npm run build` → exit 0 (baseline과 동일하게 정적 페이지 18/18 생성, `/checkout/complete/[orderId]` 라우트 그대로).

**E3 — 전체 테스트**: `npm test` → `Test Files 71 passed (71)` / `Tests 910 passed (910)` (baseline 901건 + 신규 9건 = 910건, 회귀 0건).

**E4 — typecheck·lint**: `npm run typecheck` → exit 0, 신규 오류 0건. `npm run lint` → exit 0, 신규 경고 0건 (baseline도 동일하게 clean이었음).

**E5 — PRESERVE 확인**: `findOrderForGuest()`는 `git diff`상 changed line 0줄(추가만 그 뒤에 발생). `git status --short src/app/checkout/complete/[orderId]/page.tsx` → 출력 없음(무변경). `prisma/schema.prisma` 무변경, `prisma/migrations/` 신규 디렉터리 없음(4개 기존 마이그레이션 그대로).

**E6 — 커밋/푸시**: 이 항목은 이 커밋 자신을 가리키므로 `git log -1`로 사후 확인. 커밋 메시지: `feat(SPEC-ORDER-003): M1 게스트 재방문 조회 권한 규칙과 실패 표면`. `git push` 결과는 아래 §E.3에 기록.

**E7 — 블로커**: 없음.

**핵심 설계 확인**: `findOrderByNumberAndPhone()`은 `where: { orderNumber, recipientPhone }`을 단일 `findFirst` 호출에 담아 plan.md §1이 요구하는 "가져온 뒤 비교" 금지를 지킨다. "없는 주문"과 "대조 실패"가 같은 `null`을 내는 것은 서비스 계층의 분기가 아니라 이 단일 쿼리 구조에서 나오는 성질이라 REQ-ORDER-036이 "공짜로" 충족된다(plan.md §1 서술과 일치).

**M1에서 결정하지 않은 것 (범위 밖으로 명시)**: acceptance.md §2 엣지 케이스가 언급하는 연락처 표기 정규화(`010-1234-5678` vs `01012345678`)는 이번 M1에 포함하지 않았다. 주문 생성 시점(order-service.ts의 주문 생성 트랜잭션, PRESERVE 대상)이 연락처를 정규화하지 않고 저장하므로, 조회 쪽만 정규화하면 저장된 표기와 다른 표기로 조회 시 존재하는 주문도 못 찾을 위험이 있다 — 이는 쓰기 경로를 건드리는 결정이라 이 SPEC의 PRESERVE 목록과 충돌한다. 주문 번호는 대소문자만 정규화했다(`generateOrderNumber()`가 항상 대문자를 생성하므로 이 정규화는 저장 표기와 항상 일치해 안전하다). 연락처 표기 정규화가 필요하면 별도 결정으로 M2/M3 또는 후속 SPEC에서 다뤄야 한다.

## §F Phase 4 Mode Selection

**Input parameters** (기록: M1 위임 직전, Implementation Kickoff Approval 통과 후): tier=M · scope≈6 files (`order-repository.ts` 확장, `order-service.ts` 확장, 조회 입력 화면 신설, 조회 결과 화면 신설, 각 테스트 파일) · domain count=1 (단일 모듈 `src/features/orders` 내 백엔드+프런트엔드) · file language mix=TypeScript 100% · concurrency benefit=LOW (M1→M2→M3→M4 순차 의존 — M1의 조회 권한 규칙이 M2 화면의 전제)

| 모드 | 선택 여부 | 근거 |
|---|---|---|
| direct | 미선택 | 자명한 한 줄 수정이 아님 — 마일스톤 4개, 파일 6개 |
| **serial** | **선택** | 코딩 중심 작업 + 마일스톤 간 순차 의존. Anthropic 코딩 작업 병렬화 지침에 부합 |
| fanout | 미선택 | 멀티 도메인 리서치가 아님 — 단일 모듈 순차 구현 |
| sweep | 미선택 | 기계적 대량 변환이 아님 — 마일스톤마다 다른 설계 판단이 필요 |

**Decision: serial**

**Justification**: Tier M, 단일 모듈(`src/features/orders`) 내 코딩 중심 작업이며 M1(조회 권한 규칙)이 M2(화면) 이하 모든 마일스톤의 전제 조건이라 병렬화 이득이 없다. manager-develop 1개를 마일스톤마다 순차로 위임하는 `serial` 모드가 적합하다.

## §E.3 Run-phase Audit-Ready Signal

_&lt;pending run-phase&gt;_

## §E.4 Sync-phase Audit-Ready Signal

_&lt;pending sync-phase&gt;_
