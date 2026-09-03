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

### M2 — 조회 화면과 진입 경로 (완료, TDD)

**범위**: 조회 입력 화면(`/orders/lookup`), 쿠키 귀속 결과 화면(`/orders/lookup/[orderNumber]`), 조회 API 라우트(`/api/orders/lookup`), 공유 결과 표시 컴포넌트(`OrderLookupResultView`), 입력 폼 컴포넌트(`OrderLookupForm`), 그리고 AC-ORDER-048을 위한 저장소·서비스 확장 함수(`findOrderByNumberForGuest`/`getOrderByNumberForGuest`). M3(레이트리밋·노출 금지 항목의 동적 검증)·M4(회귀 확인)는 이 커밋 범위 밖.

**설계 결정 — 라우트 구성**: SPEC에 라우트 경로가 명시되지 않아(Section B #1) 직접 정했다.
- 입력 화면: `/orders/lookup` (서버 컴포넌트 셸 + 클라이언트 폼).
- 대조값 기반 결과: **별도 URL로 이동하지 않고** 폼 컴포넌트 내부 상태 전환으로 인라인 렌더링한다. 이는 `recipientPhone` 값이 URL 쿼리 문자열·브라우저 히스토리·리퍼러 헤더에 남는 것을 막기 위한 결정이다.
- 쿠키 귀속(REQ-ORDER-044) 결과: **별도 URL** `/orders/lookup/[orderNumber]` — 연락처 없이 쿠키만으로 여는 경로이므로 URL로 직접 도달 가능해야 의미가 있다.
- 두 경로 모두 같은 표시 컴포넌트(`OrderLookupResultView`)를 공유해 두 진입점이 서로 다른 것을 보여줄 위험을 구조적으로 없앴다.

**AC-ORDER-048 설계**: `findOrderForGuest()`(주문 ID + guestId)와 같은 판별을 `orderNumber` + `guestId`로 바꾼 새 함수 `findOrderByNumberForGuest()`를 `order-repository.ts`에 추가했다 — 단일 `findFirst` 호출의 `where`에 두 조건을 모두 담아, M1이 세운 "가져온 뒤 비교 금지" 규율을 그대로 따른다.

**RED (구현 전 실패, 커밋 전 로컬 관측 — 저장소 레이어)**:

```
$ npx vitest run tests/unit/orders/order-repository.test.ts
 × SPEC-ORDER-003 M2 — findOrderByNumberForGuest (...) > bakes BOTH orderNumber and guestId into ONE findFirst where clause
   → repo.findOrderByNumberForGuest is not a function
 × ... joins the items so the cookie-bypass path can render the order snapshot
   → repo.findOrderByNumberForGuest is not a function
 × ... runs on the transaction client when given one
   → repo.findOrderByNumberForGuest is not a function
 Test Files  1 failed (1) / Tests  3 failed | 19 passed (22)
```

**RED (AC-ORDER-048 쿠키 우회 페이지 테스트 — 구현 전 관측)**:

```
$ npx vitest run tests/unit/app/order-lookup-by-number-page.test.tsx
 RUN  v2.1.9 ...
 ❯ tests/unit/app/order-lookup-by-number-page.test.tsx (0 test)
 ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  tests/unit/app/order-lookup-by-number-page.test.tsx [ tests/unit/app/order-lookup-by-number-page.test.tsx ]
Error: Failed to resolve import "@/app/orders/lookup/[orderNumber]/page" from "tests/unit/app/order-lookup-by-number-page.test.tsx". Does the file exist?
  Plugin: vite:import-analysis
  File: .../tests/unit/app/order-lookup-by-number-page.test.tsx:33:58
  17 |  const { notFound } = await import("next/navigation");
  18 |  const { cookies } = await import("next/headers");
  19 |  const { default: OrderLookupByNumberPage } = await import("@/app/orders/lookup/[orderNumber]/page");
     |                                                            ^
 Test Files  1 failed (1) / Tests  no tests
```

(다른 신규 파일들 — API 라우트, `OrderLookupResultView`, `OrderLookupForm`, `/orders/lookup` 페이지 — 도 동일하게 "모듈을 찾을 수 없음" RED를 먼저 관측한 뒤 구현했다. 위 두 건은 대표로 기록한다.)

**GREEN (구현 후, 전량)**: `npx vitest run tests/unit/orders/order-repository.test.ts tests/unit/orders/order-service.test.ts tests/unit/api/orders/lookup-route.test.ts tests/unit/components/order-lookup-result-view.test.tsx tests/unit/components/order-lookup-form.test.tsx tests/unit/app/order-lookup-page.test.tsx tests/unit/app/order-lookup-by-number-page.test.tsx` → `Test Files 7 passed (7)` / `Tests 135 passed (135)`.

**E1 — AC PASS/FAIL 매트릭스**

| AC | 상태 | 검증 명령 | 관측 결과 |
|---|---|---|---|
| AC-ORDER-042 | PASS | `npx vitest run tests/unit/components/order-lookup-result-view.test.tsx -t "AC-ORDER-042"` | `✓ SPEC-ORDER-003 M2 — the full snapshot renders (AC-ORDER-042) > shows the order number, order date, items, totals, and shipping address` |
| AC-ORDER-043 | PASS | `npx vitest run tests/unit/components/order-lookup-result-view.test.tsx -t "AC-ORDER-043"` | `✓ SPEC-ORDER-003 M2 — sensitive fields never appear (REQ-ORDER-039, AC-ORDER-043) > has no code path referencing paymentKey, idempotencyKey, guestId, or an internal id field` |
| AC-ORDER-044 | PASS | `npx vitest run tests/unit/components/order-lookup-result-view.test.tsx -t "AC-ORDER-044\|forbidden"` | `✓ ...renders a status notice with none of the forbidden fulfillment phrases for status=pending_payment/paid/cancelled` (3건) `✓ ...shows three DIFFERENT status notices across the three stored values` |
| AC-ORDER-045 | PASS | `npx vitest run tests/unit/components/order-lookup-result-view.test.tsx -t "AC-ORDER-045"` | `✓ SPEC-ORDER-003 M2 — an unpaid order says so plainly, with no payment action (REQ-ORDER-041, AC-ORDER-045) > shows an unpaid notice and no completed-payment wording` `✓ ...renders no <PayButton> and no payment-failed retry banner — this screen is read-only` |
| AC-ORDER-046 | PASS | `npx vitest run tests/unit/app/order-lookup-page.test.tsx -t "AC-ORDER-046"` | `✓ SPEC-ORDER-003 M2 — the lookup input screen opens with no auth (AC-ORDER-046) > renders an order number input and a recipient phone input with nothing injected` |
| AC-ORDER-047 | PASS | `npx vitest run tests/unit/components/order-lookup-form.test.tsx -t "AC-ORDER-047"` | `✓ SPEC-ORDER-003 M2 — a format failure shows per-field errors (AC-ORDER-047) > names both fields and calls the lookup endpoint exactly once` |
| AC-ORDER-048 | PASS | `npx vitest run tests/unit/app/order-lookup-by-number-page.test.tsx -t "AC-ORDER-048"` | `✓ SPEC-ORDER-003 M2 — a matching guest cookie opens the order, no phone needed (AC-ORDER-048) > renders the order snapshot when the presenting cookie owns it` `✓ ...never calls the service with a recipient phone` `✓ SPEC-ORDER-003 M2 — a DIFFERENT guest's cookie is refused, not shown (AC-ORDER-048) > 404s when the presenting cookie belongs to a different guest` |

전체 M2 신규 테스트 배치 실행: `npx vitest run tests/unit/orders/order-repository.test.ts tests/unit/orders/order-service.test.ts tests/unit/api/orders/lookup-route.test.ts tests/unit/components/order-lookup-result-view.test.tsx tests/unit/components/order-lookup-form.test.tsx tests/unit/app/order-lookup-page.test.tsx tests/unit/app/order-lookup-by-number-page.test.tsx` → `Test Files 7 passed (7)` / `Tests 135 passed (135)`.

**E2 — 전체 빌드**: `npm run build` → exit 0. 신규 라우트 3개가 정상 등록됨: `○ /orders/lookup` (정적), `ƒ /orders/lookup/[orderNumber]` (동적), `ƒ /api/orders/lookup` (동적).

**E3 — 전체 테스트**: `npm test` → `Test Files 76 passed (76)` / `Tests 942 passed (942)` (M1 baseline 910건 + M2 신규 32건 = 942건, 회귀 0건). 첫 실행에서 `tests/integration/auth/login.test.ts`의 응답시간 비교 테스트(AC-AUTH-005, SPEC-ORDER-003과 무관한 SPEC-AUTH 도메인의 실측 타이밍 테스트)가 1건 실패했으나 재실행 시 통과 — 머신 부하에 따라 흔들리는 사전 존재 플레이키 테스트로 확인했다(§ 잔여 위험에 기록).

**E4 — typecheck·lint**: `npm run typecheck` → exit 0, 신규 오류 0건. `npm run lint` → exit 0, 신규 경고 0건.

**E5 — PRESERVE 확인**: `git diff --stat -- src/app/checkout/complete/` → 출력 없음(무변경). `git diff --stat -- prisma/schema.prisma` → 출력 없음(무변경, 신규 마이그레이션도 없음). `order-repository.ts`의 `findOrderForGuest()`/`findOrderByNumberAndPhone()`는 `git diff`상 변경 줄 0줄(새 함수 `findOrderByNumberForGuest()`가 그 뒤에 순수 추가됨만 확인).

**E6 — 커밋/푸시**: 이 항목은 이 커밋 자신을 가리키므로 커밋 SHA는 `git log -1`로 사후 확인. 커밋 메시지: `feat(SPEC-ORDER-003): M2 게스트 재방문 조회 화면과 쿠키 우회 진입`. `git push` 결과는 본 진행 기록 갱신 시점에 §E.3에 반영한다.

**E7 — 블로커**: 없음. 단, 작업 시작 시 worktree 격리 환경이 `feat/SPEC-ORDER-003` 브랜치(주 체크아웃에 이미 체크아웃됨)를 직접 공유할 수 없어, 이 worktree에서 `wt-order003-m2` 로컬 브랜치를 `origin/feat/SPEC-ORDER-003`(M1 포함, HEAD `0c122c5`)에서 새로 만들어 작업했다. 커밋은 `origin/feat/SPEC-ORDER-003`로 직접 푸시하며, 주 체크아웃의 로컬 `feat/SPEC-ORDER-003` 브랜치는 이 세션이 아닌 후속 동기화(메모리 `feedback_post-merge-local-sync.md` 절차)로 갱신되어야 한다.

**E8 — RED 실패 출력**: AC-ORDER-048 쿠키 우회 테스트의 구현 전 실패 출력은 위 "RED (AC-ORDER-048 쿠키 우회 페이지 테스트)" 블록에 verbatim으로 기록했다.

**핵심 설계 확인**: `findOrderByNumberForGuest()`도 M1의 `findOrderByNumberAndPhone()`과 같은 원칙을 따른다 — `where: { orderNumber, guestId }`를 단일 `findFirst` 호출에 담아 "가져온 뒤 비교" 금지를 지킨다. 서비스 계층(`getOrderByNumberForGuest()`)은 조회 전 주문 번호를 대문자로 정규화한다(`generateOrderNumber()`가 항상 대문자를 생성하므로 M1과 동일하게 안전한 정규화다).

**M2에서 결정하지 않은 것 (M3로 명시적으로 넘김)**: `paymentKey`/`idempotencyKey`/`guestId`/내부 `id`의 노출 금지는 `OrderDTO` 타입이 애초에 그 필드들을 갖지 않는다는 구조적 사실과 컴포넌트 소스에 대한 정적 스캔(grep)으로 M2에서 검증했다. 그러나 API 응답 본문에 대한 동적(런타임 JSON 직렬화) 검증과 반복 실패 제한(레이트리밋, REQ-ORDER-037)은 plan.md §3이 M3으로 명시한 대로 이 커밋에 포함하지 않았다.

**잔여 위험**: `tests/integration/auth/login.test.ts`의 AC-AUTH-005 응답시간 비교 테스트가 머신 부하에 따라 간헐적으로 실패하는 사전 존재 플레이키 테스트임을 관측했다(이 SPEC과 무관, 재실행 시 통과 확인). `tests/integration/discounts/coupon-model.test.ts`도 의도된 실패를 검증하는 과정에서 `prisma:error` 로그를 출력하지만 테스트 자체는 항상 통과한다(오탐 아님).

## §E.3 Run-phase Audit-Ready Signal

_&lt;pending run-phase&gt;_

## §E.4 Sync-phase Audit-Ready Signal

_&lt;pending sync-phase&gt;_
