---
id: SPEC-DISCOUNT-001
title: "쿠폰·할인 정책 계산 엔진 (게스트 주문)"
version: "0.2.0"
status: completed
created: 2026-09-02
updated: 2026-09-03
author: snake
priority: P2
phase: "v0.2.0 target"
module: "src/features/discounts"
lifecycle: spec-anchored
tags: "discount, coupon, pricing, order, concurrency, prisma, guest"
tier: L
depends_on: [SPEC-CART-001, SPEC-ORDER-001, SPEC-PAYMENT-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-02 | 0.2.0 | draft | plan-audit 반복 1(점수 0.79, Tier L 임계값 0.85 미달)의 차단 결함 4건을 국소 보수했다. **D1** — 범위 안으로 확정되었으나 요구사항·인수 기준이 없던 산출물 2종에 커버리지를 부여했다: 체크아웃 최소 UI(REQ/AC-DISCOUNT-023·024)와 사전 검증 엔드포인트(REQ/AC-DISCOUNT-025, 무쓰기 성질을 요구사항 본문에 명문화하고 `redeemedCount` 불변을 관측으로 고정). 각각 22 → **25건**(Tier L 상한과 동일). **D2** — AC-DISCOUNT-022의 검증을 기계 실행 가능한 확정 명령으로 교체했다(부정어 동반 여부까지 판정). **D3** — AC-DISCOUNT-016 본문에 `DATABASE_URL` 도달성 게이트를 옮겨 적고 acceptance.md §I(완료의 정의)에 `SKIPPED ≠ PASS`를 명문화해 design.md §7과 일치시켰다. **D4** — `payment-service.ts:83` 금액 관문의 귀속을 `REQ-PAYMENT-015`(웹훅 경로)에서 `REQ-PAYMENT-006`(승인 리다이렉트 경로)으로 정정했다(spec.md §2 + plan.md §1 두 자리). 설계 판단은 하나도 바뀌지 않았다. |
| 2026-09-02 | 0.1.0 | draft | plan-phase 최초 작성. 백로그 카드 `t7`("쿠폰·할인 정책 계산 엔진")을 다룬다. 저장소에 쿠폰·할인 개념이 **전혀 없음**을 확인했다(`grep -rniE "coupon|discount|promo" src prisma` → `promoteGuestCartToUser` 한 건만 일치, 게스트 카트 병합 함수로 무관). 따라서 이 SPEC은 도메인 `DISCOUNT`의 첫 SPEC이며 REQ/AC 번호가 001에서 시작한다. 조사 과정에서 확정한 결정 4건은 plan.md §0에 기록했다. 조사만으로 좁혀지지 않아 명확화 대기로 남겼던 4건(UI 소유권 / 사용 제한 범위 / 할인 유형 범위 / 사용분 해제 시점)은 **2026-09-02 사용자 결정으로 전부 확정**되었으며, 결정 내용과 받아들인 트레이드오프를 plan.md §0에 옮겨 적고 대기 마커는 제거했다. |

---

## §1. 개요

`our-shop`의 **쿠폰·할인 정책 계산 엔진**을 정의한다. 쿠폰 코드를 담는 데이터 모델, 코드를 검증하고 할인액을 산출하는 순수 계산 엔진, 그리고 그 결과를 SPEC-ORDER-001이 만든 주문 생성 트랜잭션에 반영하는 통합 경로를 다룬다.

이 저장소에 할인 개념이 존재한 적이 없다는 점이 이 SPEC의 출발점이자 가장 큰 제약이다. 지금까지 주문 금액은 `totalAmount = itemsSubtotal + shippingFee` 단 하나의 식이었고(`order-service.ts` 3단계), 그 식은 **세 곳에서 서로 독립적으로 재현**된다 — 주문서 화면(`src/app/checkout/page.tsx`), 주문 생성 트랜잭션(`order-service.ts`), 그리고 결제 승인 시 PG가 보내온 금액과 대조하는 검사(`payment-service.ts:83`, `order.totalAmount !== amount` → `AMOUNT_MISMATCH`). 할인은 이 식을 바꾸는 변경이므로, 세 지점 중 하나라도 놓치면 **정상 주문이 결제 단계에서 거부되거나, 반대로 할인 없는 금액이 청구된다**.

그래서 이 SPEC의 핵심 설계 판단은 "할인을 어디에 두는가"이다. 결론은 **할인을 `Order.totalAmount`에 미리 녹여 넣는 것**이다(§2, plan.md §1). 그렇게 하면 결제 경로는 한 글자도 바뀌지 않는다 — `payment-service.ts:83`은 이미 "주문에 적힌 금액"과 "PG가 말한 금액"을 비교할 뿐, 그 금액이 어떻게 만들어졌는지 묻지 않기 때문이다.

두 번째 판단은 **쿠폰 사용 횟수의 동시성**이다. 남은 1장의 쿠폰을 두 주문이 동시에 요청하는 상황은 SPEC-ORDER-002가 재고에서 이미 푼 문제와 같은 모양이다. 이 SPEC은 그 전략을 새로 발명하지 않고 **`order-repository.ts:129-139`의 조건부 원자 갱신을 그대로 차용**한다(§2, design.md §3).

---

## §2. 배경과 현재 상태 (조사로 확인한 사실)

이 절의 모든 항목은 파일을 직접 열어 확인한 것이다. 추정이 아니다.

- **할인 도메인은 존재하지 않는다.** `prisma/schema.prisma`의 모델은 `User`, `OAuthAccount`, `RefreshToken`, `Category`, `Product`, `Cart`, `CartItem`, `Order`, `OrderItem`, `PaymentAuditLog` 10종이며 쿠폰·할인·프로모션을 담을 모델이 없다. 재사용해 확장할 후보 구조도 없다(§6 단순성 사다리 검토).

- **주문 금액 식은 단순하고, 스냅샷 계약이 걸려 있다.** `order-service.ts`는 트랜잭션 안에서 `lineTotal = price * quantity` → `itemsSubtotal = Σ lineTotal` → `totalAmount = itemsSubtotal + shippingFee`를 계산한다. `OrderItem.lineTotal`은 **재계산하지 않고 저장하는 회계 기록**이며(스키마 주석: "저장하는 이유는 나중에 산술이 바뀌어도 과거 주문의 숫자가 움직이지 않게 하기 위함"), 이 SPEC은 그 계약을 깨지 않는다.

- **배송비는 항상 0이다.** `calculateShippingFee()`는 인자를 `void`로 버리고 `return 0`한다(`order-service.ts:69-72`, "실제 정책이 오면 이 함수 본문만 바뀐다"는 주석과 함께). 따라서 **무료배송 쿠폰은 이 저장소에서 산술적으로 아무 일도 하지 않는다** — §3에서 제외하는 근거다.

- **`confirmedTotal` 교차 검사가 이미 있다.** 화면이 보여준 금액을 폼에 실어 보내고, 서버가 자기 계산과 다르면 `409 PRICE_CHANGED`로 거절한다(`order-service.ts`, `OrderFailureCode`). 할인이 붙으면 **이 검사가 비교하는 대상이 할인 후 금액으로 바뀌어야** 한다 — 그러지 않으면 쿠폰을 적용한 모든 주문이 `PRICE_CHANGED`로 거부된다.

- **결제 금액 검사는 주문 금액을 그대로 읽는다.** `payment-service.ts:83`의 `if (order.totalAmount !== amount)`가 유일한 금액 관문이며, 이는 **어떤 Toss 호출보다 먼저** 실행된다(REQ-PAYMENT-006 — 승인 리다이렉트 경로. 웹훅 경로의 대응 금액 대조는 REQ-PAYMENT-015이며 별개 요구사항이다). 할인이 `totalAmount`에 녹아 있으면 이 코드는 변경 대상이 아니다.

- **결제 취소 시 재고는 이미 복원된다.** `payment-repository.ts:135-140`이 취소 트랜잭션에서 `stock: { increment: item.quantity }`를 수행한다. 즉 **취소 경로에는 "되돌리는 자리"가 이미 존재**하므로, 쿠폰 사용분 해제도 새 실행 축 없이 같은 자리에 얹을 수 있다.

- **주문은 게스트 전용이다.** `Order`에 `userId`도 `user` 관계도 없고 `guestId`가 NOT NULL이다. 회원 체크아웃은 SPEC-ORDER-001이 **구조적으로 제외**했다(액세스 토큰이 클라이언트 메모리에만 있어 서버 렌더 화면이 회원을 식별할 수 없음). 따라서 **"1인 1회" 같은 인별 사용 제한은 이 저장소에서 강제할 수 없다** — 게스트 식별자는 쿠키이고 쿠키는 지워진다. 이 사실 위에서 **전역 총량 상한만 두는 결정**이 내려졌다(plan.md §0 확정 #2).

- **`/checkout` 화면은 이미 존재한다.** `src/app/checkout/page.tsx`가 `CheckoutForm` + `OrderSummary`를 렌더하며 `itemsSubtotal`/`shippingFee`/`totalAmount`를 계산해 내려준다. 즉 **쿠폰 입력란이 들어갈 자리는 이미 있다.** 백로그 카드 `t10`("장바구니·체크아웃 화면 UI")이 이 화면의 UI를 별도로 다루므로 소유권이 겹치는데, 그 경계는 **이 SPEC이 최소한의 입력란과 실패 문구까지 만들고 스타일링은 `t10`이 가져가는** 것으로 확정되었다(plan.md §0 확정 #1).

- **재고 차감의 동시성 해법이 선례로 존재한다.** `order-repository.ts:129-139`의 조건부 원자 갱신(`updateMany` + `where` 조건 + 영향 행 수 검사)을 SPEC-ORDER-002가 계약으로 고정했다(REQ-ORDER-022). 쿠폰 사용 횟수 상한도 같은 모양의 문제다.

- **관리자 백오피스는 별도 카드가 소유한다.** `moai todo` 결과에 `t11`("관리자 상품 등록/수정 백오피스"), `t12`("관리자 주문 목록·상태 변경 백오피스")가 queued 상태로 있다. `Category` 모델 주석도 "미래의 admin SPEC이 데이터 변경만으로 카테고리를 추가"하도록 테이블로 설계했다고 적고 있다 — 관리자 저작 기능을 도메인 SPEC이 떠안지 않는 선례다.

---

## §3. Out of Scope

### Out of Scope — 무료배송 쿠폰
- 배송비를 면제하는 할인 유형은 이번 범위 밖이다.
- **근거가 산술적이다**: `calculateShippingFee()`는 인자를 무시하고 항상 `0`을 반환하므로(`order-service.ts:69-72`), 무료배송 쿠폰이 줄일 금액이 존재하지 않는다. 배송비 정책이 실제로 도입되는 시점에 그 SPEC이 이 유형을 함께 정의하는 것이 옳다.

### Out of Scope — 쿠폰 중복 적용(스태킹)
- 한 주문에 두 장 이상의 쿠폰을 함께 적용하는 기능은 이번 범위 밖이다.
- 스태킹은 적용 순서(정률 먼저인가 정액 먼저인가), 상한의 상호작용, 배타 규칙이라는 세 가지 새 결정을 한꺼번에 요구한다. 한 장짜리 엔진이 먼저 성립해야 그 위에서 순서를 논할 수 있다.

### Out of Scope — 관리자 쿠폰 저작 화면·API
- 쿠폰을 만들고 수정하고 폐기하는 관리자 화면과 그 쓰기 API는 이번 범위 밖이다.
- 백로그 카드 `t11`·`t12`가 관리자 백오피스를 소유하고 있고, `Category` 모델이 같은 방식으로 관리자 기능을 후속 SPEC에 미룬 선례가 있다. 이 SPEC은 검증에 필요한 쿠폰을 **시드 스크립트**로 만든다(plan.md §4 M1).

### Out of Scope — 인별(1인 1회) 사용 제한
- "한 사람당 한 번"류의 제한은 이번 범위 밖이며, **이 SPEC은 그것을 제공한다고 주장하지 않는다**(REQ-DISCOUNT-022).
- 강제할 수단이 없다: 주문의 유일한 신원은 `Order.guestId`이고 그 값은 쿠키에서 온다. 쿠키를 지우면 새 신원이 된다. 회원 신원은 SPEC-ORDER-001이 구조적으로 제외했으므로 주문에 붙일 수 없다. 강제할 수 없는 제한을 있는 것처럼 제시하지 않는다.

### Out of Scope — 특정 상품·카테고리 한정 쿠폰
- 쿠폰의 적용 대상을 일부 상품이나 카테고리로 좁히는 조건은 이번 범위 밖이다.
- 대상 한정은 할인액을 **품목별로 배분**해야 성립하는데, 그것은 `OrderItem.lineTotal` 스냅샷 계약을 건드리는 변경이다(§2). 주문 단위 할인이 먼저 성립한 뒤에 다룰 문제다.

### Out of Scope — 자동 적용 프로모션 (코드 없는 할인)
- "3만원 이상 5% 자동 할인"처럼 코드 입력 없이 조건만으로 걸리는 프로모션은 이번 범위 밖이다. 이 SPEC의 진입점은 **쿠폰 코드 입력** 하나뿐이다.

### Out of Scope — 회원 체크아웃
- SPEC-ORDER-001 §3 첫 항목의 구조적 제외를 그대로 승계한다. 이 SPEC은 게스트 주문 경로만 다루며, 회원 신원을 새로 도입하지 않는다.

### Out of Scope — 미결제 이탈 주문의 쿠폰 사용분 자동 해제
- 결제하지 않고 방치된 `pending_payment` 주문이 점유한 쿠폰 사용분을 **시간 경과로** 되돌리는 만료 작업은 이번 범위 밖이다.
- 이는 백로그 카드 `t21`(미결제 주문의 재고 점유 해제)과 **동일한 구조의 공백**이다 — 트리거가 시간인 작업은 스케줄러라는 새 실행 축을 요구한다. 취소 웹훅이 도달하는 경로의 해제는 이 SPEC이 인수한다(REQ-DISCOUNT-021); 도달하지 않는 경로는 인수하지 않고 기록만 한다 — 이 분담은 plan.md §0 확정 #4로 결정되었다. 시간 기반 해제의 소유자는 아직 정해지지 않았고 **그것을 다룰 백로그 카드도 아직 만들어지지 않았다**; `t21`과 같은 성격의 공백이므로 재고 축의 해법이 정해질 때 함께 다루는 것이 자연스럽다.

### Out of Scope — 쿠폰 발급·배포 경로
- 쿠폰 코드를 사용자에게 전달하는 수단(이메일, 문자, 이벤트 페이지, 대량 코드 생성)은 이번 범위 밖이다. 이 SPEC은 **이미 손에 코드를 쥔 사람이 그것을 쓰는 경로**만 다룬다.

---

## §4. 요구사항 (GEARS, REQ-DISCOUNT-001 ~ 025)

### 데이터 모델

**REQ-DISCOUNT-001** (Ubiquitous)
`Coupon` 모델은 쿠폰 코드 한 건을 표현하며, 코드·할인 유형·할인 값·유효 기간·최소 주문 금액·총 사용 상한·누적 사용 횟수를 보유해야 한다.

**REQ-DISCOUNT-002** (Ubiquitous)
`Coupon.code`는 저장소 전역에서 유일해야 하며, 대소문자를 구분하지 않고 조회되도록 **정규화된 형태(대문자)로 저장**되어야 한다.

**REQ-DISCOUNT-003** (Ubiquitous)
할인 유형은 정률(`PERCENTAGE`)과 정액(`FIXED_AMOUNT`) 두 가지여야 하며, 그 외의 유형을 표현할 수단을 두지 않아야 한다.

### 계산 엔진

**REQ-DISCOUNT-004** (Ubiquitous)
할인 계산 엔진은 **순수 함수**여야 한다 — 데이터베이스, 시계, 난수, 네트워크에 접근하지 않고, 주어진 쿠폰 값과 주문 금액만으로 할인액을 결정해야 한다.

**REQ-DISCOUNT-005** (Ubiquitous)
할인은 `itemsSubtotal`에만 적용되어야 하며, `shippingFee`를 줄이지 않아야 한다. 최종 금액은 `totalAmount = itemsSubtotal - discountAmount + shippingFee`여야 한다.

**REQ-DISCOUNT-006** (Ubiquitous)
할인 계산 엔진은 `OrderItem.lineTotal`과 `itemsSubtotal`을 변경하지 않아야 한다 — 할인은 품목별로 배분되지 않고 주문 단위의 별도 금액으로 표현되어야 한다.

**REQ-DISCOUNT-007** (Event-driven)
**When** 정률 쿠폰의 할인액을 산출할 때, 계산 엔진은 `floor(itemsSubtotal × rate / 100)`으로 **원 단위 내림** 처리하여 정수 원화 금액을 산출해야 한다.

**REQ-DISCOUNT-008** (Ubiquitous)
산출된 할인액은 `itemsSubtotal`을 초과하지 않도록 상한이 적용되어야 하며, 그 결과 `totalAmount`는 결코 음수가 되지 않아야 한다.

### 쿠폰 검증과 거절

**REQ-DISCOUNT-009** (Event-driven)
**When** 존재하지 않는 쿠폰 코드가 제출되면, 할인 서비스는 `COUPON_NOT_FOUND` 사유로 적용을 거절해야 한다.

**REQ-DISCOUNT-010** (Event-driven)
**When** 현재 시각이 쿠폰의 유효 기간 밖임이 확인되면, 할인 서비스는 `COUPON_EXPIRED` 사유로 적용을 거절해야 한다.

**REQ-DISCOUNT-011** (Event-driven)
**When** 주문의 `itemsSubtotal`이 쿠폰의 최소 주문 금액에 미달함이 확인되면, 할인 서비스는 `COUPON_MINIMUM_NOT_MET` 사유로 적용을 거절하고 **요구되는 최소 금액을 함께 알려야** 한다.

**REQ-DISCOUNT-012** (Event-driven)
**When** 쿠폰의 누적 사용 횟수가 총 사용 상한에 도달했음이 확인되면, 할인 서비스는 `COUPON_EXHAUSTED` 사유로 적용을 거절해야 한다.

**REQ-DISCOUNT-013** (Ubiquitous)
쿠폰 거절 사유는 주문 실패 코드 체계와 동일한 형태로 표현되어야 하며, 거절은 요청 자체의 결함이 아니라 서버 상태와의 불일치이므로 **409**로 응답되어야 한다.

### 주문 트랜잭션 통합

**REQ-DISCOUNT-014** (Ubiquitous)
`Order`는 적용된 할인의 스냅샷 — 쿠폰 코드와 할인액 — 을 보유해야 하며, 그 값은 주문 생성 시점에 고정되어 이후 쿠폰이 변경·폐기되어도 움직이지 않아야 한다.

**REQ-DISCOUNT-015** (Ubiquitous)
쿠폰 검증·할인액 산출·사용 횟수 증가는 주문 생성 트랜잭션 **안에서** 수행되어야 하며, 트랜잭션이 롤백되면 사용 횟수 증가도 함께 되돌아가야 한다.

**REQ-DISCOUNT-016** (Ubiquitous)
쿠폰 사용 횟수 증가는 **조건부 원자 갱신**으로 수행되어야 한다 — 상한 미만임을 조건으로 갱신하고 영향받은 행 수로 성공을 판정하여, 두 주문이 마지막 한 장을 동시에 요청해도 상한을 초과하지 않아야 한다.

**REQ-DISCOUNT-017** (Event-driven)
**When** 조건부 갱신이 0행을 반환함이 확인되면(경쟁에서 패배), 주문 생성은 `COUPON_EXHAUSTED` 사유로 거절되어야 한다.

**REQ-DISCOUNT-018** (Ubiquitous)
`confirmedTotal` 교차 검사는 **할인이 반영된 최종 금액**과 대조되어야 하며, 쿠폰이 적용된 주문이 그 검사만으로 `PRICE_CHANGED`로 거절되지 않아야 한다.

**REQ-DISCOUNT-019** (Ubiquitous)
쿠폰 코드가 제출되지 않은 주문의 금액 계산과 응답 형태는 이 SPEC 도입 전과 **동일해야** 한다 — 할인액 0, 쿠폰 코드 없음으로 표현되며 기존 주문 경로의 동작이 변하지 않아야 한다.

### 결제 경로

**REQ-DISCOUNT-020** (Ubiquitous)
결제 승인 시의 금액 대조는 `Order.totalAmount`를 그대로 읽어야 하며, 할인 도입으로 인해 결제 서비스의 금액 검사 로직이 변경되지 않아야 한다.

**REQ-DISCOUNT-021** (Event-driven)
**When** 결제 취소로 주문의 재고가 복원되면, 같은 트랜잭션에서 그 주문이 사용한 쿠폰의 누적 사용 횟수도 함께 되돌려져야 한다.

### 정직성

**REQ-DISCOUNT-022** (Ubiquitous)
이 SPEC의 어떤 산출물도 인별 사용 제한(1인 1회 등)이 강제된다고 제시하지 않아야 하며, 총 사용 상한이 **전역 상한**임을 명시해야 한다.

### 체크아웃 화면 (최소 범위 — plan.md §0 확정 #1)

이 절의 두 요구사항은 plan.md §0 확정 #1이 **범위 안**으로 정한 최소 UI를 요구사항 레이어로 옮겨 적은 것이다. "최소한"의 경계가 여기서 관측 가능한 문장이 된다 — 아래 두 건이 요구하는 것이 이 SPEC이 만드는 UI의 **전부**이며, 스타일링·레이아웃·상호작용 개선은 백로그 카드 `t10`이 가져간다.

**REQ-DISCOUNT-023** (Ubiquitous)
체크아웃 화면은 쿠폰 코드 입력란과 적용 결과 표시 영역을 보유해야 하며, 그 화면의 금액 요약은 `discountAmount`가 0보다 클 때 할인 행을 표시하고 `discountAmount`가 0일 때는 할인 행을 표시하지 않아야 한다.

**REQ-DISCOUNT-024** (Event-driven)
**When** 제출된 쿠폰 코드의 적용이 거절되면, 체크아웃 화면은 §4 "쿠폰 검증과 거절"의 4종 거절 사유(`COUPON_NOT_FOUND`·`COUPON_EXPIRED`·`COUPON_MINIMUM_NOT_MET`·`COUPON_EXHAUSTED`) 각각에 대해 **서로 구별되는** 사용자 문구를 표시해야 하며, `COUPON_MINIMUM_NOT_MET`의 문구는 요구되는 최소 주문 금액을 포함해야 한다.

### 사전 검증 엔드포인트

**REQ-DISCOUNT-025** (Ubiquitous)
쿠폰 사전 검증 엔드포인트(`POST /api/discounts/validate`)는 코드와 `itemsSubtotal`을 받아 할인액 또는 거절 사유를 돌려주되, **어떤 상태도 변경하지 않아야 한다** — 이 엔드포인트는 `Coupon.redeemedCount`를 포함해 어떤 행도 쓰지 않으며, 사용분을 점유하거나 예약하는 행위가 **아니어야** 한다. 그 응답은 주문 시점의 적용 가능성을 보장하지 않아야 하며, 실제 강제는 주문 생성 트랜잭션의 조건부 원자 갱신(REQ-DISCOUNT-016)만이 수행해야 한다.

---

## §5. 요약

| 항목 | 값 |
|---|---|
| Tier | **L** (>15 파일, 새 도메인 모델 + 마이그레이션 + 주문 트랜잭션 통합) |
| 요구사항 | 25건 (REQ-DISCOUNT-001 ~ 025) — Tier L 상한 25건에 **정확히 도달**, 여유 0건 |
| 인수 기준 | 25건 (AC-DISCOUNT-001 ~ 025) — Tier L 상한 25건에 **정확히 도달**, 여유 0건 |
| 산출물 | spec.md · plan.md · acceptance.md · design.md · research.md (+ progress.md) |
| 선행 SPEC | SPEC-CART-001 · SPEC-ORDER-001 · SPEC-PAYMENT-001 (모두 `status: completed`) |
| 열린 결정 | **0건** — plan.md §0의 4건은 2026-09-02 사용자 결정으로 전부 확정 |
