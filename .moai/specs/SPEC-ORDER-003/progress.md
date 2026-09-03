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

### M3 — 조회 엔드포인트 레이트리밋과 노출 금지 항목의 동적 검증 (완료, TDD)

**범위**: `src/app/api/orders/lookup/route.ts`에 레이트리밋 확인(`checkIpRateLimit("orders-lookup", request)`)을 POST 핸들러 최상단에 추가(AC-ORDER-041), 그리고 성공 응답 본문에서 `id`/`paymentKey`/`idempotencyKey`/`guestId`를 벗겨내는 응답 재구성 로직을 추가(AC-ORDER-043). `tests/unit/api/orders/lookup-route.test.ts`에 두 AC의 테스트를 추가했다. M4(회귀 확인)는 이 커밋 범위 밖.

**작업 환경 메모**: 이 worktree는 `feat/SPEC-ORDER-003` 로컬 브랜치를 (주 체크아웃이 이미 점유하고 있어) 직접 공유할 수 없었다. `origin/feat/SPEC-ORDER-003`(M1+M2 포함, HEAD `e36ce0b`)에서 로컬 브랜치 `spec-order-003-m3`를 새로 만들어 작업했고, 커밋은 `origin/feat/SPEC-ORDER-003`로 직접 푸시한다.

**설계 결정 — 노출 금지 필드를 라우트에서 벗겨내는 이유(AC-ORDER-043)**: `toOrderDTO()`(order-service.ts, PRESERVE 대상 — M3에서 수정하지 않음)가 반환하는 `OrderDTO`에는 `paymentKey`/`idempotencyKey`/`guestId` 필드가 타입 자체에 없어 이미 구조적으로 안전하다. 그러나 `id`(내부 DB 기본키)는 `OrderDTO` 타입에 실제로 존재하며, 이는 `checkout/complete/[orderId]/page.tsx`(PRESERVE 대상)가 `orderId={order.id}`로 필요로 하는 값이라 `toOrderDTO()` 자체나 공유 `OrderDTO` 타입을 수정할 수 없다(수정 시 PRESERVE 위반과 결제 완료 화면 회귀를 동시에 일으킨다). 대신 이 SPEC이 소유한 `/api/orders/lookup` 라우트에서만 성공 응답 직전에 `id`를 구조 분해로 제거했다 — 나머지 세 필드(`paymentKey`/`idempotencyKey`/`guestId`)도 같은 자리에서 함께 구조 분해해 방어적으로 제거한다(서비스 계층이 훗날 실수로 이 필드들을 포함하게 되어도 이 라우트의 응답에는 영향이 없도록).

**RED (구현 전 실패, 커밋 전 로컬 관측)**:

```
$ npx vitest run tests/unit/api/orders/lookup-route.test.ts
 ❯ tests/unit/api/orders/lookup-route.test.ts (8 tests | 2 failed) 11ms
   × SPEC-ORDER-003 M3 — repeated failures from one origin are rate-limited (AC-ORDER-041) > answers 429 on the 6th request within the window and calls the repository ZERO times on it
     → expected 404 to be 429 // Object.is equality
   × SPEC-ORDER-003 M3 — the response body never carries an internal identifier or secret (AC-ORDER-043) > never serializes paymentKey, idempotencyKey, guestId, or a bare internal id
     → expected '{"id":"order-1","orderNumber":"ORD-20…' not to match /paymentKey/
 Test Files  1 failed (1) / Tests  2 failed | 6 passed (8)
```

**GREEN (구현 후)**: `npx vitest run tests/unit/api/orders/lookup-route.test.ts` → `Test Files 1 passed (1)` / `Tests 8 passed (8)`.

**E1 — AC PASS/FAIL 매트릭스**

| AC | 상태 | 검증 명령 | 관측 결과 |
|---|---|---|---|
| AC-ORDER-041 | PASS | `npx vitest run tests/unit/api/orders/lookup-route.test.ts -t "AC-ORDER-041"` | `✓ ... answers 429 on the 6th request within the window and calls the repository ZERO times on it` `✓ ... keeps a different origin's quota untouched by another origin's lockout` (2건, 8건 중 6건 스킵) |
| AC-ORDER-043 | PASS | `npx vitest run tests/unit/api/orders/lookup-route.test.ts -t "AC-ORDER-043"` | `✓ ... never serializes paymentKey, idempotencyKey, guestId, or a bare internal id` (1건, 8건 중 7건 스킵) |

**E2 — 전체 빌드**: `npm run build` → exit 0. baseline과 동일하게 정적/동적 라우트 구성 그대로, `ƒ /api/orders/lookup` 라우트 유지.

**E3 — 전체 테스트**: `npm test` → `Test Files 76 passed (76)` / `Tests 945 passed (945)` (M2 baseline 942건 + M3 신규 3건 = 945건, 회귀 0건). AC-041 테스트 2건(429 본검증 + 다른 출처 격리 확인) + AC-043 테스트 1건. `tests/integration/auth/login.test.ts`의 AC-AUTH-005는 이번 실행에서 통과했다(diff=28.37ms/34.68ms, tolerance=35.41ms/36.51ms — 두 차례 전체 실행 모두 통과, 플레이키 재현 없음).

**E4 — typecheck·lint**: `npx tsc --noEmit`(§3 Definition of Done의 정확한 명령) → exit 0, 신규 오류 0건. `npm run lint` → exit 0, 신규 경고 0건.

**E5 — PRESERVE 확인**: `git diff --stat -- src/lib/auth/rate-limit.ts` → 출력 없음(무변경). `git diff --stat -- src/app/checkout/` → 출력 없음(무변경). `git diff --stat -- prisma/schema.prisma` → 출력 없음(무변경). `git diff --stat -- src/features/orders/repositories/order-repository.ts` → 출력 없음(무변경). 최종 `git diff --stat`은 `src/app/api/orders/lookup/route.ts`와 `tests/unit/api/orders/lookup-route.test.ts` 2개 파일만 보고한다(`git status --short`로 교차 확인). 빌드 과정에서 Next.js가 `tsconfig.json`을 자동으로 재포맷·`allowJs: true` 추가한 부수효과가 있었으나, 이 SPEC 범위 밖이라 `git checkout -- tsconfig.json`으로 되돌리고 `npx tsc --noEmit`이 원본 `tsconfig.json`으로도 여전히 통과함을 재확인했다.

**E6 — 커밋/푸시**: 이 항목은 이 커밋 자신을 가리키므로 커밋 SHA는 `git log -1`로 사후 확인. 커밋 메시지 예정: `feat(SPEC-ORDER-003): M3 rate-limit lookup endpoint + dynamic redaction`. `git push origin spec-order-003-m3:feat/SPEC-ORDER-003`(로컬 브랜치명이 다르므로 refspec 명시).

**E7 — 블로커**: 없음.

**E8 — RED 실패 출력(verbatim)**:

```
$ npx vitest run tests/unit/api/orders/lookup-route.test.ts

 ❯ tests/unit/api/orders/lookup-route.test.ts (8 tests | 2 failed) 11ms
   × SPEC-ORDER-003 M3 — repeated failures from one origin are rate-limited (AC-ORDER-041) > answers 429 on the 6th request within the window and calls the repository ZERO times on it 4ms
     → expected 404 to be 429 // Object.is equality
   × SPEC-ORDER-003 M3 — the response body never carries an internal identifier or secret (AC-ORDER-043) > never serializes paymentKey, idempotencyKey, guestId, or a bare internal id 1ms
     → expected '{"id":"order-1","orderNumber":"ORD-20…' not to match /paymentKey/

 FAIL  tests/unit/api/orders/lookup-route.test.ts > SPEC-ORDER-003 M3 — repeated failures from one origin are rate-limited (AC-ORDER-041) > answers 429 on the 6th request within the window and calls the repository ZERO times on it
AssertionError: expected 404 to be 429 // Object.is equality
- Expected: 429
+ Received: 404
 ❯ tests/unit/api/orders/lookup-route.test.ts:205:26

 FAIL  tests/unit/api/orders/lookup-route.test.ts > SPEC-ORDER-003 M3 — the response body never carries an internal identifier or secret (AC-ORDER-043) > never serializes paymentKey, idempotencyKey, guestId, or a bare internal id
AssertionError: expected '{"id":"order-1","orderNumber":"ORD-20…' not to match /paymentKey/
+ Received:
"{\"id\":\"order-1\",\"orderNumber\":\"ORD-20260903-0AB123\",\"status\":\"pending_payment\",\"items\":[],\"itemsSubtotal\":20000,\"shippingFee\":0,\"totalAmount\":20000,\"couponCode\":null,\"discountAmount\":0,\"shipping\":{\"recipientName\":\"홍길동\",\"recipientPhone\":\"010-1234-5678\",\"postalCode\":\"06236\",\"address\":\"서울시 강남구 테헤란로 1\",\"deliveryMemo\":null},\"createdAt\":\"2026-09-03T00:00:00.000Z\",\"paymentKey\":\"pk_live_super_secret\",\"idempotencyKey\":\"idem-key-super-secret\",\"guestId\":\"guest-super-secret\"}"
 ❯ tests/unit/api/orders/lookup-route.test.ts:279:26

 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
```

**M3에서 결정하지 않은 것**: 없음 — plan.md §3이 M3에 명시적으로 넘긴 두 항목(레이트리밋 배선, 응답 본문 동적 검증) 모두 이 커밋에서 완결했다.

### M4 — 보존 검증 (완료, 오케스트레이터 직접 수행)

**위임 경위**: manager-develop에게 위임했으나, 이 세션의 백그라운드 에이전트 격리 환경이 SPEC-ORDER-003과 무관한 다른 SPEC(SPEC-STOREFRONT-001) 컨텍스트·오래된 HEAD·`node_modules` 부재 상태의 worktree를 배정하는 환경 결함이 있어, 에이전트가 (정당하게) 검증을 거부하고 블로커 보고서를 반환했다. M4는 검증 전용(신규 코드 없음)이고, 오케스트레이터가 이미 M1~M3 각 단계에서 주 체크아웃에 직접 fast-forward 후 typecheck·테스트를 독립 재실행해 온 동일한 방식으로 이 마일스톤의 4개 항목을 직접 재확인했다(관측 명령·결과는 이 세션에서 실제로 실행한 것이며, 위임 시도 이전에 오케스트레이터가 이미 관측했던 값과 일치를 재확인함).

**REQ-ORDER-045 / AC-ORDER-049 — 3개 보존 대상**:

```
$ git diff --stat 284a492...HEAD -- src/app/checkout/complete/
(출력 없음 — diff 0줄)

$ findOrderForGuest() 본문에 닿는 diff hunk 0건 (grep으로 확인)

$ git diff --stat 284a492...HEAD -- prisma/schema.prisma
(출력 없음 — diff 0줄)

$ git diff --stat 284a492...HEAD -- prisma/migrations/
(출력 없음 — 신규 마이그레이션 없음)

$ createOrder() 본문(order-service.ts:446)에 닿는 diff hunk 0건 (grep으로 확인 — 실제 diff hunk는 import 구역과 725행 이후 순수 추가분뿐)
```

**전체 빌드**: `npm run build` → exit 0. 신규 라우트 3개(`/orders/lookup`, `/orders/lookup/[orderNumber]`, `/api/orders/lookup`) 정상 등록.

**전체 테스트**: `npm test` → `Test Files 76 passed (76)` / `Tests 945 passed (945)`. 회귀 0건.

**typecheck**: `npx tsc --noEmit` → exit 0.

**AC 누적 커버리지 (13건 전부)**:

| AC | 검증 단계 | 판정 |
|---|---|---|
| AC-ORDER-037 | M1 | PASS |
| AC-ORDER-038 | M1 | PASS |
| AC-ORDER-039 | M1 | PASS |
| AC-ORDER-040 | M1 | PASS |
| AC-ORDER-041 | M3 | PASS |
| AC-ORDER-042 | M2 | PASS |
| AC-ORDER-043 | M2(정적)+M3(동적) | PASS |
| AC-ORDER-044 | M2 | PASS |
| AC-ORDER-045 | M2 | PASS |
| AC-ORDER-046 | M2 | PASS |
| AC-ORDER-047 | M1(서비스)+M2(폼) | PASS |
| AC-ORDER-048 | M2 | PASS |
| AC-ORDER-049 | M4 | PASS (위 4항목) |

13건 전부 최소 1개 마일스톤에서 PASS 기록을 갖고 있다.

**M4가 새로 발견한 문제 — acceptance.md §2 엣지 케이스와 M1 실제 구현의 불일치**: acceptance.md §2가 "연락처 표기가 다름(`010-1234-5678` vs `01012345678`) → ... 정규화 규칙은 M1에서 정하고 테스트로 고정한다"라고 명시하지만, M1의 실제 §E.2 기록은 정반대로 "연락처 표기 정규화는 이번 M1에 포함하지 않았다"라고 스스로 밝히고 있다. 오케스트레이터가 코드로 직접 확인한 결과:

- 조회 측(`RECIPIENT_PHONE_PATTERN`, order-service.ts:737)은 하이픈이 있어도 없어도 통과하는 느슨한 정규식이다.
- 그러나 주문 생성 측(`REQUIRED_SHIPPING_FIELDS`, order-service.ts:129-133)은 `recipientPhone`이 **비어있지 않다는 것만** 검사하며 형식을 전혀 강제하지 않는다. 체크아웃 폼(`CheckoutForm.tsx:31`)도 자유 텍스트 입력이라 클라이언트 측 마스킹이 없다.
- `findOrderByNumberAndPhone()`은 저장된 값과 입력값을 **정확히 문자열 비교**하는 단일 `where` 절이다.

**결과적으로**: 체크아웃 때 공백·점 등 비표준 표기로 연락처를 입력한 실제 고객은, 나중에 같은(또는 다른) 표기로 조회를 시도해도 자신의 실재하는 정당한 주문을 찾지 못할 수 있다 — 형식 검증에서 거부되거나(비표준 표기가 `RECIPIENT_PHONE_PATTERN`과도 안 맞으면), 문자열 불일치로 "대조 실패"와 구별 안 되게 조용히 실패한다. 이는 acceptance.md가 명시적으로 요구했던 엣지 케이스 처리가 실제로는 구현되지 않은 것이며, plan-audit이 통과한 계획과 최종 산출물 사이의 실질적 괴리다.

**왜 M4에서 즉시 고치지 않았는지**: 근본 수정(정규화를 쓰기·읽기 양쪽에 일관되게 적용, 또는 최소한 쓰기 시점 정규화)은 주문 생성 트랜잭션(`order-service.ts`의 `createOrder()`/`REQUIRED_SHIPPING_FIELDS`)을 건드려야 하는데, 이는 이 SPEC의 PRESERVE 목록과 REQ-ORDER-045가 명시적으로 금지하는 대상이다. 읽기 쪽만 느슨하게 만드는 것은 M1이 이미 검토하고 기각한 방향과 같다(저장된 표기와 다른 표기로 조회하면 정당한 주문도 못 찾는 위험). 이 괴리를 이 SPEC 안에서 안전하게 닫을 방법이 없어 사용자 결정을 요청한다 — 상세는 이 진행 기록이 아니라 오케스트레이터의 사용자 응답에서 다룬다.

## §E.3 Run-phase Audit-Ready Signal

**4개 마일스톤(M1~M4) 모두 기계적으로 완료**: 코드·테스트·빌드·타입체크 전부 그린, PRESERVE 3항목 diff 0줄, 13개 AC 전부 최소 1곳에서 PASS 기록 보유.

**연락처 표기 정규화 격차 — 사용자 결정으로 종결(2026-09-03)**: M4가 발견한 acceptance.md §2와 M1 구현 사이의 괴리를 사용자에게 보고했다. 결정: **알려진 잔여 한계로 받아들이고 범위 밖으로 명시 확정** — 근본 수정이 이 SPEC의 PRESERVE 대상(주문 생성 트랜잭션)을 건드려야 하므로, 이 SPEC 안에서 고치지 않는다. 조치: (1) acceptance.md §2의 해당 엣지 케이스 행을 "범위 밖" + 근거로 수정, (2) acceptance.md §3 DoD 8개 항목 전부 체크, (3) 백로그 카드 `t25` 신설(연락처 표기 정규화 — 주문 생성 트랜잭션을 다루는 후속 SPEC 필요). **run-phase 진입을 막던 항목은 이제 없다. sync-phase 진입 준비 완료.**

## §E.4 Sync-phase Audit-Ready Signal

_&lt;pending sync-phase&gt;_
