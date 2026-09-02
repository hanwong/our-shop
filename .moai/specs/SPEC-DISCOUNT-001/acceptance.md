# Acceptance: SPEC-DISCOUNT-001 — 쿠폰·할인 정책 계산 엔진

> 인수 기준 25건(AC-DISCOUNT-001 ~ 025)이 요구사항 25건(REQ-DISCOUNT-001 ~ 025)과 1:1로 대응한다. 각 항목은 Given-When-Then으로 쓰며, **이진 판정 가능**해야 한다 — "적절히", "충분히" 같은 판단어를 쓰지 않는다.
>
> AC-DISCOUNT-019·020·022·025는 **부재를 확인하는** 기준이다. 무엇이 일어났는지가 아니라 무엇이 일어나지 **않았는지**를 관측하므로, 검증 수단이 테스트가 아니라 정적 검사(diff·grep)이거나 상태 불변 관측인 항목이 섞여 있다.
>
> AC-DISCOUNT-016은 **능력 게이트**를 갖는다 — 살아 있는 PostgreSQL에 도달할 수 없는 환경에서는 판정되지 않으며, 그 경우 `SKIPPED`로 기록되고 **PASS로 계산되지 않는다**(§I).

---

## §A. 데이터 모델

**AC-DISCOUNT-001** — REQ-DISCOUNT-001
- **Given** 마이그레이션이 적용된 데이터베이스에서
- **When** `Coupon` 모델의 컬럼 집합을 조회하면
- **Then** `code`, `type`, `value`, `minOrderAmount`, `maxRedemptions`, `redeemedCount`, `startsAt`, `endsAt`이 모두 존재한다.

**AC-DISCOUNT-002** — REQ-DISCOUNT-002
- **Given** 코드 `SAVE10`인 쿠폰이 저장된 상태에서
- **When** 같은 코드의 두 번째 쿠폰을 삽입하려 하면
- **Then** 유일성 제약 위반으로 실패하고, **When** 쿠폰 조회 서비스를 통해 `save10`(소문자)으로 조회하면 **Then** 같은 쿠폰이 조회된다(정규화는 애플리케이션 계층이 수행한다 — design.md §1의 대소문자 구분 유일 인덱스와 모순이 아니다).

**AC-DISCOUNT-003** — REQ-DISCOUNT-003
- **Given** `DiscountType` 열거형이 정의된 상태에서
- **When** 그 값의 목록을 확인하면
- **Then** 정확히 `PERCENTAGE`와 `FIXED_AMOUNT` 두 개뿐이며 그 외 값이 없다.

---

## §B. 계산 엔진

**AC-DISCOUNT-004** — REQ-DISCOUNT-004
- **Given** 할인 계산 엔진 모듈에서
- **When** 그 소스에서 import 목록과 전역 호출을 정적으로 검사하면
- **Then** `prisma`, `Date.now`, `new Date()`, `Math.random`, 네트워크 호출이 **하나도 나타나지 않는다**.

**AC-DISCOUNT-005** — REQ-DISCOUNT-005
- **Given** `itemsSubtotal = 50000`, `shippingFee = 0`, 할인액 `5000`인 계산에서
- **When** 최종 금액을 산출하면
- **Then** `totalAmount === 45000`이고 `shippingFee`는 `0`으로 변하지 않는다.

**AC-DISCOUNT-006** — REQ-DISCOUNT-006
- **Given** 쿠폰이 적용된 주문이 생성된 뒤
- **When** 그 주문의 `OrderItem` 행들과 `itemsSubtotal`을 조회하면
- **Then** 각 `lineTotal === unitPrice × quantity`이고 `itemsSubtotal === Σ lineTotal`이며, 할인은 이 값들에 반영되어 있지 않다.

**AC-DISCOUNT-007** — REQ-DISCOUNT-007
- **Given** `itemsSubtotal = 33333`, 정률 10% 쿠폰에서
- **When** 할인액을 산출하면
- **Then** `3333`이다(`floor(3333.3)`) — 올림 `3334`도 반올림 `3333`도 아닌 **내림 결과**임이 경계값으로 고정된다.

**AC-DISCOUNT-008** — REQ-DISCOUNT-008
- **Given** `itemsSubtotal = 5000`이고 정액 `10000`원 쿠폰에서
- **When** 할인액을 산출하면
- **Then** 할인액은 `5000`으로 상한이 적용되고 `totalAmount === 0`이며, 음수가 되지 않는다.

---

## §C. 쿠폰 검증과 거절

**AC-DISCOUNT-009** — REQ-DISCOUNT-009
- **Given** 저장되지 않은 코드 `NOPE`가 제출된 상태에서
- **When** 쿠폰 검증을 수행하면
- **Then** `COUPON_NOT_FOUND` 사유로 거절되고 어떤 쿠폰의 `redeemedCount`도 변하지 않는다.

**AC-DISCOUNT-010** — REQ-DISCOUNT-010
- **Given** `endsAt`이 현재보다 과거인 쿠폰과 `startsAt`이 미래인 쿠폰 각각에 대해
- **When** 검증을 수행하면
- **Then** 두 경우 모두 `COUPON_EXPIRED` 사유로 거절된다.

**AC-DISCOUNT-011** — REQ-DISCOUNT-011
- **Given** `minOrderAmount = 30000`인 쿠폰과 `itemsSubtotal = 29999`인 주문에서
- **When** 검증을 수행하면
- **Then** `COUPON_MINIMUM_NOT_MET`으로 거절되고 응답에 요구 최소 금액 `30000`이 포함된다.

**AC-DISCOUNT-012** — REQ-DISCOUNT-012
- **Given** `maxRedemptions = 5`, `redeemedCount = 5`인 쿠폰에서
- **When** 검증을 수행하면
- **Then** `COUPON_EXHAUSTED`로 거절된다.

**AC-DISCOUNT-013** — REQ-DISCOUNT-013
- **Given** §C의 네 가지 거절 각각에 대해
- **When** 주문 API를 통해 요청하면
- **Then** HTTP 상태는 모두 `409`이고 본문의 `code`가 해당 사유 문자열과 일치한다(`400`이나 `500`이 아니다).

---

## §D. 주문 트랜잭션 통합

**AC-DISCOUNT-014** — REQ-DISCOUNT-014
- **Given** 코드 `SAVE10`으로 할인 `5000`원이 적용된 주문이 생성된 뒤
- **When** 그 쿠폰의 `value`를 변경하거나 쿠폰 행을 삭제하고 주문을 다시 조회하면
- **Then** 주문의 `couponCode === "SAVE10"`, `discountAmount === 5000`, `totalAmount`가 모두 그대로다.

**AC-DISCOUNT-015** — REQ-DISCOUNT-015
- **Given** 쿠폰이 유효하지만 이후 단계(재고 부족 등)에서 트랜잭션이 롤백되는 주문에서
- **When** 주문 생성을 시도하면
- **Then** 요청은 실패하고 그 쿠폰의 `redeemedCount`는 시도 전 값과 동일하다.

**AC-DISCOUNT-016** — REQ-DISCOUNT-016
- **Given** `DATABASE_URL`이 가리키는 **살아 있는 PostgreSQL**에 마이그레이션이 적용되어 있고, 그 데이터베이스에 `maxRedemptions = 1`, `redeemedCount = 0`인 쿠폰이 있으며, 두 주문이 그 쿠폰을 동시에 요청하는 상황에서
- **When** 두 요청을 병행 실행하면
- **Then** 정확히 하나만 성공하고, 종료 후 `redeemedCount === 1`이며 `maxRedemptions`를 넘지 않는다.
- **능력 게이트 (design.md §7과 일치)**: `DATABASE_URL`에 도달할 수 없는 환경에서는 이 AC를 판정하지 않고 **건너뛴 사실을 기록**한다. **건너뜀은 통과가 아니다** — 건너뛴 실행은 `SKIPPED`로 기록되며 §I(완료의 정의)의 "전부 PASS" 집계에 PASS로 계산하지 않는다. 이 저장소의 `.github/workflows/ci.yml`에는 `services: postgres`가 없으므로, 이 AC는 현재 개발자 기계에서만 닫힌다(SPEC-ORDER-002 AC-ORDER-035가 남긴 공백을 그대로 상속하며, 이 SPEC이 새로 만든 문제가 아니다).

**AC-DISCOUNT-017** — REQ-DISCOUNT-017
- **Given** AC-DISCOUNT-016의 경쟁에서 패배한 요청에 대해
- **When** 그 응답을 확인하면
- **Then** `409` / `COUPON_EXHAUSTED`이며, 그 주문은 데이터베이스에 생성되어 있지 않다.

**AC-DISCOUNT-018** — REQ-DISCOUNT-018
- **Given** `itemsSubtotal = 50000`, 정액 `5000` 쿠폰, 화면이 계산해 보낸 `confirmedTotal = 45000`인 요청에서
- **When** 주문 생성을 수행하면
- **Then** 주문이 성공하고 `PRICE_CHANGED`가 발생하지 않으며, **When** `confirmedTotal = 50000`(할인 미반영)을 보내면 **Then** `409 PRICE_CHANGED`로 거절된다.

**AC-DISCOUNT-019** — REQ-DISCOUNT-019
- **Given** 쿠폰 코드를 제출하지 않는 기존 주문 경로에서
- **When** 이 SPEC 도입 전에 통과하던 주문 관련 테스트 전체를 실행하면
- **Then** **한 건도 수정하지 않고 전부 통과**하며, 생성된 주문의 `discountAmount === 0`, `couponCode === null`이다.

---

## §E. 결제 경로

**AC-DISCOUNT-020** — REQ-DISCOUNT-020
- **Given** 이 SPEC의 run-phase 변경 전체에 대해
- **When** `git diff`로 `src/features/payments/services/payment-service.ts`의 변경 여부를 확인하면
- **Then** 이 파일에 **변경이 없다**. 그리고 할인 적용 주문의 결제 승인이 `AMOUNT_MISMATCH` 없이 성공한다.

**AC-DISCOUNT-021** — REQ-DISCOUNT-021
- **Given** 쿠폰이 적용되어 `redeemedCount = 1`이 된 주문이 결제 취소되는 상황에서
- **When** 취소 웹훅 처리가 완료되면
- **Then** 재고가 복원되어 있고 **동시에** 그 쿠폰의 `redeemedCount === 0`으로 되돌아가 있다.

---

## §F. 정직성

**AC-DISCOUNT-022** — REQ-DISCOUNT-022

이 AC는 **두 개의 확정 명령**으로 판정된다. 문자열이 나타나는지가 아니라 **긍정 주장**이 나타나는지를 세야 하므로(제한이 **없음**을 밝히는 부정 서술은 위반이 아니라 오히려 REQ-DISCOUNT-022가 요구하는 바다), 검색 대상 문장에 부정어가 동반되는지까지 명령이 판정한다. 판정자의 사람 판단은 개입하지 않는다.

**관측 1 — 인별 제한의 긍정 주장 0건**

- **Given** 이 SPEC의 주장 산출물(spec.md, plan.md, design.md, research.md)과 구현 산출물(`src/`의 코드 주석·UI 문구)에서 — `acceptance.md`는 **검증 도구이지 주장이 아니므로** 대상에서 제외한다(이 AC 본문 자체가 검색어를 문자 그대로 담고 있기 때문이다)
- **When** 아래 명령을 실행하면

  ```bash
  grep -rhoE '[^.!?]*(1인 1회|한 사람당|per user|once per customer)[^.!?]*' \
    .moai/specs/SPEC-DISCOUNT-001/spec.md \
    .moai/specs/SPEC-DISCOUNT-001/plan.md \
    .moai/specs/SPEC-DISCOUNT-001/design.md \
    .moai/specs/SPEC-DISCOUNT-001/research.md \
    src/ 2>/dev/null \
    | grep -vE '(제외|아니|않|없|밖|Out of Scope|not |no )' \
    | wc -l
  ```

  (앞 `grep`은 일치 문자열이 포함된 **문장 단위**를 뽑아내고 — `.`·`!`·`?`가 문장 경계다 —, 뒤 `grep -v`는 그 문장에 부정어가 동반된 경우, 즉 "제한이 없다"는 서술을 걸러낸다. 남는 것은 부정어 없이 인별 제한을 **긍정하는** 문장뿐이다.)

- **Then** 출력은 정확히 `0`이다. `0`이 아니면 남은 문장 각각이 REQ-DISCOUNT-022 위반이며 그 문장을 보고서에 그대로 인용한다.

**관측 2 — `maxRedemptions` 선언 자리마다 전역 상한 명시**

- **Given** `maxRedemptions`를 **스키마 컬럼으로 선언하는** 자리(plan.md §2와 design.md §1.1의 두 곳)에서
- **When** 아래 두 명령을 실행하면

  ```bash
  # (a) 선언 자리 수
  grep -rhc 'maxRedemptions Int' \
    .moai/specs/SPEC-DISCOUNT-001/plan.md \
    .moai/specs/SPEC-DISCOUNT-001/design.md | paste -sd+ - | bc
  # (b) 그중 선언 줄 또는 바로 윗줄에 "전역 상한"이 적힌 수
  grep -rh -B1 'maxRedemptions Int' \
    .moai/specs/SPEC-DISCOUNT-001/plan.md \
    .moai/specs/SPEC-DISCOUNT-001/design.md | grep -c '전역 상한'
  ```

- **Then** (a)와 (b)가 **같은 수**이며 그 수는 `2`다 — 즉 선언 자리가 두 곳이고, 두 곳 모두 전역 상한임이 명시되어 있다. 두 값이 다르면 명시가 빠진 선언 자리가 존재한다는 뜻이다.

---

## §G. 체크아웃 화면

**AC-DISCOUNT-023** — REQ-DISCOUNT-023
- **Given** `/checkout` 화면을 렌더한 상태에서
- **When** 그 DOM에서 쿠폰 코드 입력란과 적용 결과 표시 영역의 존재를 조회하고, `discountAmount = 5000`인 경우와 `discountAmount = 0`인 경우 각각의 금액 요약을 조회하면
- **Then** 세 관측이 모두 성립한다 — (i) 쿠폰 코드 입력란이 정확히 1개 존재하고, (ii) 적용 결과 표시 영역이 존재하며, (iii) `discountAmount = 5000`일 때 금액 요약에 할인 행이 존재하고 그 값이 `5000`이며, `discountAmount = 0`일 때 할인 행이 **존재하지 않는다**.

**AC-DISCOUNT-024** — REQ-DISCOUNT-024
- **Given** 4종 거절 사유(`COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_MINIMUM_NOT_MET`, `COUPON_EXHAUSTED`) 각각을 응답으로 받은 체크아웃 화면에서
- **When** 각 경우에 표시되는 사용자 문구를 수집해 집합으로 만들면
- **Then** 수집된 문구가 정확히 4개이고 **서로 모두 다르며**(집합 크기 `=== 4`), 어느 것도 빈 문자열이나 원시 코드 문자열(`"COUPON_NOT_FOUND"` 등) 그 자체가 아니고, `COUPON_MINIMUM_NOT_MET`의 문구는 요구 최소 금액(예: `30000`)을 포함한다.

---

## §H. 사전 검증 엔드포인트

**AC-DISCOUNT-025** — REQ-DISCOUNT-025
- **Given** `maxRedemptions = 5`, `redeemedCount = 0`인 유효한 쿠폰이 저장된 상태에서
- **When** `POST /api/discounts/validate`를 그 코드로 **10회** 호출하면(성공 응답 10회, 즉 매번 적용 가능하다고 답하는 경우)
- **Then** 10회 호출 후 그 쿠폰의 `redeemedCount === 0`이며(단 1도 증가하지 않는다), `Coupon` 행의 `updatedAt`도 호출 전 값과 동일하고, 그 사이에 생성된 `Order` 행이 0건이다 — 이 엔드포인트가 어떤 쓰기도 수행하지 않았음의 관측이다.

---

## §I. 완료의 정의 (Definition of Done)

- [ ] AC-DISCOUNT-001 ~ 025 전부 PASS, 각 항목에 **실행한 명령과 그 출력**이 증거로 첨부됨
- [ ] **`SKIPPED`는 `PASS`가 아니다** — 능력 게이트로 판정되지 않은 AC(현재 AC-DISCOUNT-016 하나)는 `SKIPPED`로 기록되며, 위 "전부 PASS" 항목의 집계에 통과로 계산하지 않는다. 건너뛴 실행은 **건너뛴 사실과 그 사유(`DATABASE_URL` 도달 불가)를 기록**해야 하며, 그 기록의 부재는 그 자체로 이 항목의 미충족이다. 미관측을 성공으로 접지 않는 것이 이 줄의 목적이다
- [ ] `npx tsc --noEmit` 종료 코드 0
- [ ] lint 종료 코드 0
- [ ] 기존 테스트 전체가 **수정 없이** 통과 (AC-DISCOUNT-019)
- [ ] `payment-service.ts` 무변경 확인 (AC-DISCOUNT-020)
- [ ] 마이그레이션이 기존 주문 행을 깨지 않음 — 적용 후 기존 주문 조회 성공
- [x] plan.md §0의 열린 결정 4건이 **전부 확정**되고 그 결정이 문서에 반영됨 — 2026-09-02 사용자 결정, 산출물 6종에 명확화 대기 마커 0건
- [ ] 받아들인 공백(이탈 주문의 쿠폰 점유)이 **백로그 카드로 등록됨** — 시간 기반 해제를 다룰 카드는 아직 만들어지지 않았다(`t21`과 같은 성격). 카드 번호를 여기에 미리 적지 않으며, 등록 시점에 채운다
