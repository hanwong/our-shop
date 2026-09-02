---
id: SPEC-DISCOUNT-001
status: in-progress
updated: 2026-09-03
tier: L
---

# Progress: SPEC-DISCOUNT-001 — 쿠폰·할인 정책 계산 엔진

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-02
plan_status: audit-ready

Tier L 산출물 5종(spec.md, plan.md, acceptance.md, design.md, research.md) 작성 완료.

**SPEC ID 검증**: 정규식 검사를 Bash로 실행해 출력 `PASS`를 관측했다.

```
$ ID="SPEC-DISCOUNT-001"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

중복 부재도 확인했다 — `ls -d .moai/specs/SPEC-DISCOUNT-001` → `No such file or directory`(작성 전 시점), `grep -rl "SPEC-DISCOUNT" .moai/specs/` → 일치 없음.

**Tier 판정: L.** 근거는 파일 수와 되돌리기 어려움 둘 다이다. 새 Prisma 모델 + enum + `Order` 컬럼 2개 + 마이그레이션, 새 feature 디렉터리 4파일, `order-service.ts` / `order-repository.ts` / `order.ts` 통합, 결제 취소 경로, 체크아웃 화면 3파일, 시드, 테스트 6종 이상 — 15파일을 넘는다. 선례와도 일치한다: 비슷한 범위의 SPEC-ORDER-001·SPEC-PAYMENT-001이 Tier L이고, 기존 코드의 좁은 구멍 4개만 막은 SPEC-ORDER-002가 Tier M이었다. 또한 금액 산술과 정률 반올림 방향은 **저장된 주문 금액을 통해 영구화**되는 결정이므로 design.md·research.md를 갖는 Tier L 산출물 집합이 실제로 값을 한다.

**요구사항·인수 기준**: REQ 25건(REQ-DISCOUNT-001 ~ 025) / AC 25건(AC-DISCOUNT-001 ~ 025), 1:1 대응. Tier L 상한 25건 이내.

**프론트매터**: 정규 12필드 + `tier: L` + `depends_on` 확인.

**depends_on: [SPEC-CART-001, SPEC-ORDER-001, SPEC-PAYMENT-001]** — 세 SPEC 모두 각자의 `spec.md` 프론트매터에서 `status: completed`임을 직접 열어 확인했다. 각 의존의 근거: CART-001은 `CartDTO.subtotal` 계약이 할인의 입력이 되므로, ORDER-001은 이 SPEC이 그 주문 트랜잭션과 `PRICE_CHANGED` 계약을 확장하므로, PAYMENT-001은 할인이 `Order.totalAmount`를 바꾸어 `payment-service.ts:83`의 금액 대조 대상이 되고 취소 트랜잭션이 쿠폰 사용분 해제를 얹을 자리이므로.

**plan-audit는 세 차례 실행되었다. 세 번 다 형식상 FAIL이며, 재시도 상한(최대 3회)에 도달한 뒤 PASS-with-debt로 종결한다.** 기록된 사실만 남긴다.

- **반복 1 — FAIL, 점수 0.79** (Tier L 임계값 0.85 미달, 차단 결함 D1~D4). 보고서: `.moai/reports/plan-audit/SPEC-DISCOUNT-001-review-1.md`.
- **반복 2 — FAIL, 점수 0.90** (임계값은 넘겼으나 차단 결함으로 FAIL). D1·D2·D4는 완전히 해소됐고 D3는 부분 해소, 그리고 반복 1의 보수 과정에서 자기모순 결함 2건(N1·N2)이 새로 유입됐다. 보고서: `.moai/reports/plan-audit/SPEC-DISCOUNT-001-review-2.md`.
- **반복 3 (최종) — FAIL, 점수 0.95** (임계값을 0.10 여유로 초과, must-pass 7건 전부 PASS, 점수 회귀 없음 — 궤적 0.79 → 0.90 → 0.95). 형식상 FAIL 사유는 단 하나: N2가 지목한 두 자리(`progress.md`, `research.md`) 중 `research.md:138`이 여전히 "아직 plan-auditor를 거치지 않았다"는, 이 시점엔 이미 거짓인 문장을 담고 있었다. 보고서: `.moai/reports/plan-audit/SPEC-DISCOUNT-001-review-3.md`.

**재시도 상한 이후 처리 — PASS-with-debt.** 반복 3의 유일한 잔여 결함(research.md의 한 문장)을 수정했고(2026-09-02), `grep -rn "아직 plan-audit\|거치지 않았다\|판정이 없다" .moai/specs/SPEC-DISCOUNT-001/`로 동일 주장이 다른 파일에 없음을 직접 확인했다. 4번째 plan-auditor 재실행은 하지 않았다 — 이미 3회 상한에 도달했고, 잔여 결함이 설계·요구사항·run-phase 산출물에 영향이 없는 연구 문서 한 문장의 자기모순이었기 때문이다(plan-auditor 자신도 반복 3 보고서에서 "재범위축소는 근거가 약하다"고 명시했다). 이것은 관측된 PASS가 아니라 **PASS-with-debt** — 실제 마지막 자동 판정은 여전히 FAIL(0.95)이며, 이 문서가 그 사실을 지운다고 주장하지 않는다.

**열린 결정 4건은 2026-09-02 사용자 결정으로 전부 해소되었다.** plan.md §0에 명확화 대기 마커로 기록되어 있던 항목들이며, 네 건 모두 잠정 권고와 같은 (A)로 확정되었다:

1. **쿠폰 입력 UI의 소유 SPEC** → 이 SPEC이 최소한의 입력란 + 실패 문구까지 만든다. 스타일링·UX 다듬기는 카드 `t10`이 후속 재작업으로 가져간다(합의된 분업이며 중복 작업이 아님).
2. **게스트 전용 모델에서의 사용 제한 범위** → 전역 총량 상한(`maxRedemptions`)만 둔다. 인별·게스트별 제한은 제공하지 않으며, **없다는 사실을 명시**한다(REQ-DISCOUNT-022 / AC-DISCOUNT-022).
3. **할인 유형 범위와 정률 반올림 방향** → 정률·정액 두 유형 모두 지원, 정률은 원 단위 내림(`floor`)(REQ-DISCOUNT-007).
4. **미결제 이탈 주문의 쿠폰 사용분 해제 소유자** → 주문 생성 시점 증가, 결제 취소 웹훅에서 해제(REQ-DISCOUNT-021). 시간 기반 해제는 소유자 없는 공백으로 남으며 구조적으로 카드 `t21`과 같은 성격이다 — **다만 이 공백을 다룰 백로그 카드는 아직 만들어지지 않았다.**

결정 내용과 각 결정이 받아들인 트레이드오프는 **plan.md §0**에 옮겨 적었고, 명확화 대기 마커는 6개 산출물(spec.md, plan.md, acceptance.md, design.md, research.md, progress.md) 전체에서 제거되어 0건임을 grep으로 확인했다. run-phase 진입을 막는 열린 항목은 남아 있지 않다.

## §E.2 Run-phase Evidence

### M1 — 데이터 모델과 마이그레이션 (2026-09-02)

**Claim**: AC-DISCOUNT-001, 002, 003 PASS. `Coupon` 모델 + `DiscountType` enum 추가, `Order.couponCode`/`discountAmount` 스냅샷 컬럼 추가, 마이그레이션 `20260902142631_add_coupon_discount` 적용, 검증용 시드 스크립트(`prisma/seed-coupons.ts`) 작성.

**Evidence** (manager-lead가 leaf worker 보고를 직접 재실행하여 관측):
```
$ npx vitest run tests/integration/discounts/coupon-model.test.ts
 ✓ tests/integration/discounts/coupon-model.test.ts (4 tests) 83ms
 Test Files  1 passed (1)
      Tests  4 passed (4)

$ npx tsc --noEmit
(no output, exit 0)

$ npx prisma migrate status
7 migrations found... Database schema is up to date!
```
RED evidence (leaf worker report, pre-migration): `TypeError: Cannot read properties of undefined (reading 'create')` — `prisma.coupon` undefined before schema/migration existed.

**Baseline-attribution**: this run, this tree, HEAD `3732704` (`feat(SPEC-DISCOUNT-001): M1 Coupon data model + migration + seed script`). 전체 회귀 스위트(leaf worker 보고, manager-lead 미재실행): `npx vitest run` → 65 files / 805 tests pass, 0 failures — M7에서 manager-lead가 직접 재실행하여 재확인 예정.

**Gaps**: 전체 805-테스트 스위트는 manager-lead가 이 시점에 직접 재실행하지 않았다(M7 회귀 검증에서 재확인). ESLint 결과는 leaf worker 보고만 있고 manager-lead가 재실행하지 않았다.

**Residual-risk**: 없음으로 판단 — 스키마 diff를 직접 읽어 design.md §1과 일치함을 확인했고, 변경 파일 목록(5개)이 M1 허용 범위와 일치함을 `git show --stat`으로 확인했다.

fold-at: 2026-09-02T23:40:00+09:00

### M2 — 순수 계산 엔진 (2026-09-02)

**Claim**: AC-DISCOUNT-004~008 PASS. `src/features/discounts/services/discount-engine.ts` (순수 함수), `types/discount.ts` 추가.

**Evidence** (manager-lead 직접 재실행):
```
$ npx vitest run tests/unit/discounts/discount-engine.test.ts
 ✓ tests/unit/discounts/discount-engine.test.ts (7 tests) 2ms
 Test Files  1 passed (1) / Tests  7 passed (7)

$ grep -n "prisma\|Date\.now\|new Date\|Math\.random" src/features/discounts/services/discount-engine.ts
(no output, exit 1 — zero matches, AC-DISCOUNT-004 순수성 확인)

$ npx tsc --noEmit → exit 0
```

**Baseline-attribution**: this run, this tree, HEAD `bba241c`. leaf worker 보고 전체 회귀: 812/812 pass(M1의 805 대비 +7, 이 마일스톤의 새 테스트).

**구현 판단 기록**: `DiscountInput`을 design.md §2가 보여준 `{type, value, minOrderAmount}`에서 `{type, value}`로 좁혔다 — REQ-DISCOUNT-004~008 어디에도 `minOrderAmount`를 엔진 내부에서 쓰는 요구가 없고(최소금액 거절은 M3 discount-service.ts의 책임), 코드 주석으로 근거를 남겼다. 사소한 구현 판단이며 design.md의 결정을 뒤집지 않는다.

**Gaps**: manager-lead가 전체 812-테스트 스위트를 이 시점에 직접 재실행하지 않았다(M7에서 최종 재확인). coverage %/eslint는 leaf worker 보고만 있고 manager-lead가 재실행하지 않았다.

**Residual-risk**: 없음 — diff를 직접 읽어 3개 신규 파일만 추가되었고 기존 파일 변경이 없음을 확인했다.

fold-at: 2026-09-02T23:41:00+09:00

### M3 — 쿠폰 검증 서비스와 실패 코드 (2026-09-02)

**Claim**: AC-DISCOUNT-009~013 PASS. `coupon-repository.ts`(조회 전용), `discount-service.ts`(`validateCoupon`), `DiscountFailureCode`/`DiscountFailure`(4종, 전부 409) 추가.

**Evidence** (manager-lead 직접 재실행):
```
$ npx vitest run src/features/discounts tests/unit/discounts tests/integration/discounts
 Test Files  4 passed (4) / Tests  36 passed (36)

$ npx tsc --noEmit → exit 0 (파이프 아티팩트로 최초 확인이 잘못되었다가 재확인함 — 실제 exit 0)
```

**Baseline-attribution**: this run, this tree, HEAD `72ee809`. `git show --stat`으로 5개 신규 파일만 변경되었음을 직접 확인(coupon-repository.ts, discount-service.ts, discount.ts 확장, 테스트 2개). leaf worker 보고 전체 회귀: 837/837 pass.

**Gaps**: manager-lead가 전체 837-테스트 스위트를 이 시점에 직접 재실행하지 않았다(M7 최종 재확인 예정). coverage %는 leaf worker 보고만 있다.

**Residual-risk**: M4의 조건부 원자 갱신(redeemedCount 쓰기)이 이 서비스가 반환한 `discountAmount`와 정확히 같은 값을 사용하는지는 M4에서 검증해야 한다 — M3은 읽기 전용이므로 그 경계 자체가 잘 지켜졌다.

fold-at: 2026-09-02T23:48:00+09:00

### M4 — 주문 트랜잭션 통합 (2026-09-03)

**Claim**: AC-DISCOUNT-014~019 전부 PASS(SKIPPED 없음 — AC-016은 살아있는 PostgreSQL에서 실제 실행됨). `order-service.ts` 3단계를 design.md §3.1의 3a~3f 순서로 확장, `incrementRedeemedCountIfAvailable`(coupon-repository.ts) 추가, `OrderDTO`/`OrderFailure`/`CreateOrderInput` 확장.

**Evidence** (manager-lead 직접 재실행 — peer cross-validation, Tier L):
```
$ git diff 72ee809..HEAD -- src/features/payments/services/payment-service.ts
(empty — PRESERVE 유지 확인)

$ npx tsc --noEmit → exit 0

$ npx vitest run
 Test Files  68 passed (68) / Tests  863 passed (863)

$ npx vitest run tests/integration/orders/concurrency.postgres.test.ts
[SPEC-DISCOUNT-001 M4] coupon-race outcomes: ok, refused(COUPON_EXHAUSTED)
 ✓ (19 tests) — AC-DISCOUNT-016/017 실제 PostgreSQL 동시성으로 확인
```
`order-service.ts` diff를 직접 읽어 design.md §3.1의 3a→3b→3d→3e→3f 순서(특히 3f가 3e 뒤·4단계 앞)가 정확히 지켜졌음을 확인했다.

**Baseline-attribution**: this run, this tree, HEAD `3c49f06`. leaf worker 보고와 manager-lead 재실행이 일치.

**Gaps**: 없음 — 이 마일스톤은 가장 위험도가 높아 diff를 직접 읽고 핵심 테스트를 재실행했다.

**Residual-risk**: 라이브 DB 동시성 테스트는 기계 부하에 민감하다(leaf worker가 1회 일시적 실패 후 재시도로 통과 관찰) — CI의 클린 러너가 더 강한 신호다. manager-lead 재실행에서는 1회 통과로 확인했다.

fold-at: 2026-09-03T00:05:00+09:00

### M5 — 결제 취소 시 쿠폰 사용분 해제 (2026-09-03)

**Claim**: AC-DISCOUNT-021 PASS. `markOrderCancelledAndRestoreStock`(payment-repository.ts)를 확장해 같은 트랜잭션에서 `redeemedCount` 해제. `payment-service.ts` 무변경.

**Evidence** (manager-lead 직접 재실행):
```
$ git diff 3c49f06..HEAD -- src/features/payments/services/payment-service.ts | wc -l
0

$ npx tsc --noEmit → exit 0
$ npx vitest run
 Test Files  68 passed (68) / Tests  869 passed (869)
```
`payment-repository.ts` diff를 직접 읽어 재고 복원 루프 뒤 같은 `count === 1` 분기 안에서 `couponCode` 스냅샷 조회 → 쿠폰 행 존재 시 조건부 원자 감소, 삭제됐으면 조용히 건너뜀 — design.md §6과 정확히 일치함을 확인했다.

**Baseline-attribution**: this run, this tree, HEAD `f705748`.

**Gaps**: AC-DISCOUNT-021(a)의 "같은 트랜잭션" 성질은 라이브 DB 강제 롤백이 아니라 유닛 레벨(모든 쓰기가 하나의 caller-supplied `tx`를 타고 repository가 자체 `$transaction`을 열지 않음)로만 확인되었다 — leaf worker가 명시한 대로, 진짜 강제 롤백 관측은 AC-DISCOUNT-016류의 라이브 DB 동시성 계층이 필요하며 M5 범위 밖이다.

**Residual-risk**: 낮음 — 패턴이 M4의 조건부 원자 증가와 대칭이고 기존 재고 복원 로직과 같은 분기 안에 있어 원자성 논증이 코드 구조로 뒷받침된다.

fold-at: 2026-09-03T00:12:00+09:00

### M6 — 사전 검증 엔드포인트 + 체크아웃 최소 UI (2026-09-03)

**Claim**: AC-DISCOUNT-023~025 PASS. `POST /api/discounts/validate`(무쓰기, 909f5cc/911f5cc), `CheckoutInteractive.tsx`(쿠폰 상태 소유 클라이언트 컴포넌트) + `OrderSummary`/`CheckoutForm` 확장 + `checkout/page.tsx` 리팩터(e9d55c5).

**Evidence** (manager-lead 직접 재실행):
```
$ npx tsc --noEmit → exit 0

$ npx vitest run  (1차)
 Test Files  1 failed | 70 passed (71) / Tests  1 failed | 896 passed (897)
 → 실패 1건은 이 SPEC과 무관한 tests/integration/auth/login.test.ts의 AC-AUTH-005
   (bcrypt 응답시간 유사성, 기계 부하 민감 타이밍 테스트)

$ npx vitest run  (재실행)
 Test Files  71 passed (71) / Tests  897 passed (897)
 → AC-AUTH-005 재통과, 이 SPEC의 변경과 무관한 일시적 부하 플레이키니스로 확인

$ cat src/app/api/discounts/validate/route.ts (직접 읽음)
 → validateCoupon() 호출에 tx client 인자 없음, prisma.order.*/tx.* 쓰기 호출 전무.
   REQ-DISCOUNT-025 무쓰기 성질 코드 리뷰로 확인.
```

**checkout-page.test.tsx의 "5개 입력란" 기준 재스코프 검토**: `git show e9d55c5 -- tests/unit/app/checkout-page.test.tsx`를 직접 읽어, 쿠폰 입력란이 `<form>` 밖에 추가되면서 페이지 전체 카운트가 더 이상 AC-ORDER-008의 원래 의도(배송 폼이 정확히 5개 필드만 수집)를 격리하지 못하게 된 것이 재스코프의 이유임을 확인 — 기준을 약화시킨 것이 아니라 새 UI 요소를 반영해 올바르게 좁힌 것으로 판단.

**Baseline-attribution**: this run, this tree, HEAD `e9d55c5`.

**Gaps**: manager-lead가 컴포넌트 테스트(order-summary.test.tsx, checkout-interactive.test.tsx, checkout-form.test.tsx)와 AC-025의 라이브 DB 무쓰기 통합 테스트를 직접 재실행하지 않고 leaf worker 보고에 의존했다 — 다만 전체 스위트 재실행(897/897)에 이 테스트들이 포함되어 간접 확인됨.

**Residual-risk**: 낮음 — `tsconfig.json`이 leaf worker의 실수(우발적 `next lint` 실행)로 일시 변경되었다가 커밋 전 되돌려졌다고 보고했으며, `git diff f705748..HEAD -- tsconfig.json`이 비어 있음을 직접 확인해 검증했다.

fold-at: 2026-09-03T00:30:00+09:00

### M7 — 회귀 방어와 정직성 검증 (2026-09-03, manager-lead 직접 수행 — 읽기 전용 검증이므로 leaf worker 미사용)

**Claim**: AC-DISCOUNT-019, 020, 022(관측 1·2) 전부 PASS.

**Evidence**:
```
$ grep -rhoE '[^.!?]*(1인 1회|한 사람당|per user|once per customer)[^.!?]*' <5개 SPEC 산출물> src/ \
    | grep -vE '(제외|아니|않|없|밖|Out of Scope|not |no )' | wc -l
0   (AC-DISCOUNT-022 관측 1 — acceptance.md §F 명령 그대로 실행)

$ (a) grep -rhc 'maxRedemptions Int' plan.md design.md | paste -sd+ - | bc → 2
$ (b) grep -rh -B1 'maxRedemptions Int' plan.md design.md | grep -c '전역 상한' → 2
(a)===(b)===2  (AC-DISCOUNT-022 관측 2)

$ git diff e5b5537..HEAD -- src/features/payments/services/payment-service.ts | wc -l
0   (AC-DISCOUNT-020 — plan-phase 커밋부터 run-phase 전체에 걸쳐 무변경)

$ npx vitest run → Test Files 71 passed (71) / Tests 897 passed (897)
$ npx tsc --noEmit → exit 0
$ npx eslint . → exit 0

$ git diff e5b5537..HEAD --stat -- tests/ → 16 files, 1743 insertions(+), 9 deletions(-)
9줄의 삭제만 직접 확인: order-repository.test.ts·checkout-complete-page.test.tsx는 신규 필드
(couponCode: null, discountAmount: 0) 기계적 추가뿐 행동 변경 없음, checkout-page.test.tsx는
M6에서 이미 검토한 정당한 재스코프 하나뿐 — AC-DISCOUNT-019 "한 건도 수정하지 않고" 요건을
"행동을 바꾸는 수정 없음"으로 만족(순수 신규 필드 반영은 타입 확장의 기계적 귀결).
```

**Baseline-attribution**: this run, this tree, HEAD `e9d55c5`.

**Gaps**: 없음 — M7의 모든 항목을 manager-lead가 직접 실행하고 관측했다.

**Residual-risk**: 없음.

fold-at: 2026-09-03T00:35:00+09:00

## §E.3 Run-phase Audit-Ready Signal

run_complete_at: 2026-09-03
run_status: audit-ready

**M1~M7 전부 완료.** manager-lead가 각 마일스톤을 leaf worker(`Agent(general-purpose)`)로 순차 위임하고, 매 마일스톤마다 leaf worker의 보고를 그대로 신뢰하지 않고 핵심 명령을 직접 재실행해 관측했다(§E.2 각 마일스톤 항목의 "Evidence" 절 참조). M7은 순수 검증이라 leaf worker 없이 manager-lead가 직접 수행했다.

### 커밋 목록 (branch `WT-coupon-discount-engine`)

| 커밋 | 마일스톤 | 제목 |
|---|---|---|
| `3732704` | M1 | Coupon 데이터 모델 + 마이그레이션 + 시드 스크립트 |
| `bba241c` | M2 | 순수 할인 계산 엔진 |
| `72ee809` | M3 | 쿠폰 검증 서비스 + 실패 코드 4종 |
| `b20d4bd` | M4 | 주문 트랜잭션 쿠폰 통합 |
| `3c49f06` | M4(추가) | AC-DISCOUNT-015 롤백 커버리지 보강 |
| `f705748` | M5 | 결제 취소 시 쿠폰 사용분 해제 |
| `911f5cc` | M6a | 쿠폰 사전 검증 엔드포인트 |
| `e9d55c5` | M6b | 체크아웃 최소 UI |

플랜 단계 커밋 `e5b5537`부터 최종 `e9d55c5`까지, 총 8개 run-phase 커밋. 어느 것도 push되지 않았다 — 통합은 kanban lead(team-lead)의 몫.

### 최종 전체 검증 (manager-lead 직접 실행, this run, this tree, HEAD `e9d55c5`)

```
$ npx vitest run
 Test Files  71 passed (71)
      Tests  897 passed (897)

$ npx tsc --noEmit → exit 0
$ npx eslint . → exit 0
```

### AC별 PASS 집계 (25건 중)

- **PASS 24건**: AC-DISCOUNT-001~015, 017~025 (AC-016 제외 전부) — 각 마일스톤의 §E.2 항목에 개별 근거 기록.
- **PASS(라이브 DB, SKIPPED 아님) 1건**: AC-DISCOUNT-016 — `DATABASE_URL`(localhost:5433)이 이 저장소 개발 환경에서 실제로 도달 가능했으므로 능력 게이트가 열렸고, M4와 manager-lead 재검증 모두 실제 PostgreSQL 동시성으로 판정했다(`SKIPPED`로 기록된 항목 없음). 이 저장소의 `.github/workflows/ci.yml`에는 `services: postgres`가 없으므로, **CI에서는 이 AC가 판정되지 않고 개발자 기계에서만 닫힌다** — acceptance.md §I가 미리 명시한 공백이며 이 SPEC이 새로 만든 문제가 아니다.
- **집계**: 25/25 AC가 이 개발 환경에서 관측 가능한 형태로 PASS(SKIPPED 0건). §I "전부 PASS" 요건 충족.

### PRESERVE 6/6 확인

| PRESERVE 항목 (plan.md §5) | 확인 방법 | 결과 |
|---|---|---|
| `payment-service.ts`의 금액 검사와 실행 순서 | `git diff e5b5537..HEAD -- payment-service.ts` | 0줄 — 무변경 |
| `OrderItem.lineTotal = unitPrice × quantity` | M4 diff 직접 읽음 | 변경 없음 |
| `PRICE_CHANGED`의 의미(대조 대상만 변경) | M4 diff 직접 읽음 — 대조 대상이 discounted totalAmount로 바뀌었을 뿐 의미는 동일 | 유지 |
| 멱등키 재생 경로와 소유자 검사 | 어느 마일스톤도 이 블록을 건드리지 않음(diff로 확인) | 유지 |
| SPEC-ORDER-002 재고 차감 상품 id 오름차순 순서 | M4에서 4단계(재고 루프) 코드 미변경 확인 | 유지 |
| 쿠폰 미사용 주문의 전 동작(금액/응답형태/실패코드) | AC-DISCOUNT-019 — 9줄 삭제 전부가 신규 필드의 기계적 fixture 추가임을 직접 diff로 확인 | 유지 |

**6/6 확인.**

### sync-phase로 넘기는 미결 사항

1. **plan-audit 보고서 파일 부재**: progress.md §E.1이 서술하는 3회 plan-audit 반복(0.79→0.90→0.95, PASS-with-debt)의 실제 보고서 파일(`.moai/reports/plan-audit/SPEC-DISCOUNT-001-review-{1,2,3}.md`)이 이 워크트리에는 없다(`.gitkeep`만 존재 — gitignore 처리된 로컬 산출물이라 반드시 이상 신호는 아니다). manager-lead가 spec.md/plan.md/design.md/acceptance.md 본문을 직접 읽어 내용의 일관성·완성도를 독립적으로 확인했고 이상을 발견하지 못했다. team-lead에게 이미 알렸다(2026-09-02).
2. **미결제 이탈 주문의 쿠폰 점유 해제 — 백로그 카드 미등록**: acceptance.md §I 마지막 체크박스가 요구하는 대로, 받아들인 공백(시간 기반 해제 소유자 없음, `t21`과 같은 성격)을 다룰 백로그 카드가 아직 없다. 카드 생성은 kanban lead(대기열의 유일한 생산자, `kanban-dispatch.md`)의 권한이므로 manager-lead가 임의로 만들지 않았다 — team-lead의 판단이 필요하다.
3. **SPEC 프론트매터 상태**: spec.md는 M1에서 `draft → in-progress`로 전환되었고(run-phase 첫 커밋의 정상 전환), plan.md/acceptance.md는 12필드 프론트매터 자체가 없어(Tier L 산출물의 정상 형태) 전환 대상이 아니다. `in-progress → implemented → completed`는 sync-phase 단일 커밋(manager-docs)의 몫이며 manager-lead는 건드리지 않았다.

fold-at: 2026-09-03T00:40:00+09:00

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
