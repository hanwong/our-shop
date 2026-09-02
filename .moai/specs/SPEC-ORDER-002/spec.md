---
id: SPEC-ORDER-002
title: "재고 차감 동시성 제어와 품절 처리 (게스트 주문)"
version: "0.1.0"
status: in-progress
created: 2026-09-02
updated: 2026-09-02
author: snake
priority: P1
phase: "v0.1.0 MVP"
module: "src/features/orders"
lifecycle: spec-anchored
tags: "order, inventory, stock, concurrency, oversell, out-of-stock, transaction, postgresql"
tier: M
depends_on: [SPEC-ORDER-001, SPEC-PAYMENT-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-02 | 0.1.0 | draft | plan-phase 최초 작성. 백로그 카드 t6("재고 차감 동시성 제어와 품절 처리")를 다룬다. **조사 결과 재고 차감 자체는 이미 조건부 원자 갱신으로 구현되어 있다**(`order-repository.ts:129-139`, SPEC-ORDER-001 design.md §3). 따라서 이 SPEC은 동시성 전략을 새로 발명하지 않고, 그 전략이 실제로 성립하지 않는 **네 개의 잔여 구멍**을 막고 그 성립을 **처음으로 실제 관측**하는 것을 범위로 삼는다. 결정이 필요한 2건은 plan.md §0에 미해결 질문으로 기록했다(아래 행에서 확정). |
| 2026-09-02 | 0.1.0 | draft | plan.md §0의 결정 2건이 사용자 확정으로 해소되었다. (1) CI DB 배선 소유권 = **(B)** — 하네스는 이 SPEC(M4)이 `DATABASE_URL` 게이트 형태로 만들고, CI 필수 검사 승격은 후속 CI SPEC이 소유한다(받아들인 공백: `AC-013-EXCL-CONCURRENCY`는 개발자 기계에서만 닫힌다). (2) 미결제 주문 재고 해제 = **범위 밖 유지**, 백로그 카드 `t21`이 추적을 이어받는다. 이 문서에서는 §3 마지막 항목의 결정 대기 표기를 확정 표기로 바꿨다. |

---

## §1. 개요

`our-shop`의 **재고 차감 동시성 제어**와 **품절/재고 부족의 화면 표면화**를 정의한다. SPEC-ORDER-001이 만든 주문 생성 트랜잭션을, 두 주문이 같은 상품의 마지막 한 개를 동시에 요청하는 상황에서도 초과 판매가 일어나지 않도록 굳히고, 그 경쟁에서 진 쪽이 무엇이 왜 안 되었는지 알 수 있게 한다.

> **이 SPEC은 동시성 전략을 새로 고르지 않는다.** 조사 결과 올바른 전략이 이미 코드에 있다. 이 SPEC이 하는 일은 그 전략을 **계약으로 고정**하고, 그것이 실제로는 성립하지 않는 네 지점을 막고, 그 성립을 **증거로 관측**하는 것이다. 무엇이 이미 있고 무엇이 없는지는 §2에 증거와 함께 있다.

### 이 SPEC이 인수하는, 명시적으로 미검증인 주장

SPEC-ORDER-001은 자신의 동시성 주장이 **검증되지 않았음을 스스로 기록**했다.

| 출처 | 문구 | 이 SPEC의 인수 |
|---|---|---|
| SPEC-ORDER-001 design.md §3 | "이 동작의 실제 직렬화는 살아 있는 PostgreSQL에서만 관측된다. 이 SPEC의 자동 테스트는 '조건부 갱신 형태로 작성되었고, `count !== 1`이면 롤백 경로로 간다'까지만 판정한다" | REQ-ORDER-032 / REQ-ORDER-033 |
| SPEC-ORDER-001 acceptance.md 제외 항목 `AC-013-EXCL-CONCURRENCY` | 실 DB 필요 — 자동 DoD 제외 | REQ-ORDER-032가 이 제외 항목을 닫는다 |
| SPEC-PAYMENT-001 acceptance.md `AC-004-EXCL-CONCURRENCY` | 같은 사유의 제외 | 이 SPEC이 만드는 하네스를 그 SPEC도 쓸 수 있게 되지만, PAYMENT의 AC를 닫는 것은 이 SPEC의 범위가 아니다(§3) |

즉 "초과 판매는 막힌다"는 이 저장소의 가장 값비싼 주장이 지금까지 **한 번도 관측된 적 없다**. `tests/integration/orders/create-order.test.ts`의 주석이 이를 자인하고, `.github/workflows/ci.yml:60`의 `DATABASE_URL`은 어떤 데이터베이스도 열리지 않는 자리표시자다.

### 소비하는 계약

| 출처 | 형태 | 이 SPEC에서의 쓰임 |
|---|---|---|
| SPEC-ORDER-001 `decrementStockIfAvailable()` | `updateMany({ where: { id, stock: { gte } }, data: { decrement } })` → `count` | **유지·강화 대상.** 형태는 그대로 두고, 호출 순서와 실패 후 보고를 이 SPEC이 규정한다 |
| SPEC-ORDER-001 `OrderFailure` / `InsufficientStockProduct` | `{ code: "INSUFFICIENT_STOCK", products: InsufficientStockProduct[] }` | 배열 타입은 이미 복수를 약속하는데 구현은 한 건만 채운다. 이 SPEC이 그 약속을 이행한다 |
| SPEC-CART-001 `CartItemDTO.stock` | 항목마다 현재 재고 | 주문서 요약의 재고 표시 근거. **새로 조회하지 않는다** |
| SPEC-STOREFRONT-001 `ProductDetailView` 품절 표시 | `stock === 0 → "품절"` | **이미 충족된 요구.** 변경하지 않는다(REQ-ORDER-031) |
| SPEC-PAYMENT-001 `markOrderCancelledAndRestoreStock()` | 취소 웹훅 시 `increment` 복원 | **변경하지 않는다.** 이 SPEC은 차감 경로만 다룬다 |

---

## §2. 조사가 확인한 것 — 이미 있는 것과 없는 것

이 절은 요구사항의 근거다. 각 항목은 읽은 파일과 줄 번호를 가진다.

### 이미 있고, 올바르며, 그대로 둔다

- **조건부 원자 갱신**: `src/features/orders/repositories/order-repository.ts:134-138`이 `updateMany({ where: { id, stock: { gte: quantity } } })` 형태로 차감한다. PostgreSQL은 UPDATE 대상 행에 잠금을 잡고 잠금 획득 후 조건을 재평가하므로, 읽고-검사하고-쓰는 경로가 가진 경쟁 구간이 이 형태에는 없다. **이것이 이 SPEC이 채택하는 전략이며, 대안 검토와 기각 사유는 plan.md §1에 있다.**
- **트랜잭션 경계**: `order-service.ts:310-411`의 단일 `prisma.$transaction`. 장바구니 재조회부터 장바구니 비우기까지가 한 트랜잭션 안에 있다.
- **상세 화면 품절 표시**: `ProductDetailView.tsx:30,45-49`가 `stock === 0`일 때 "품절"을, 아니면 "재고 N개 남음"을 렌더한다. 담기 버튼 자체가 이 화면에 없으므로 "품절이면 담기 비활성화"라는 대상은 존재하지 않는다.

### 없거나, 있어도 성립하지 않는 것 — 이 SPEC이 막는 네 구멍

**(G1) 상품 잠금 순서가 결정되어 있지 않다 → 교착 상태.**
`order-service.ts:360`의 차감 루프는 `cart.items`의 순서, 즉 `CartItem.createdAt` 오름차순(`cart-repository.ts:38`)을 따른다. 이 순서는 **장바구니마다 다르다**. 두 게스트가 상품 A와 B를 반대 순서로 담았다면 한쪽은 A→B, 다른 쪽은 B→A로 행 잠금을 요청하고, 동시에 도착하면 PostgreSQL이 교착을 탐지해 한쪽을 중단시킨다(SQLSTATE 40P01). 그 오류는 `OrderAbort`도 `P2002`도 아니므로 `order-service.ts:448`에서 그대로 재던져지고, 주문자는 이유를 알 수 없는 500을 받는다.

**(G2) 재고 부족 응답의 `available` 값이 사실과 다르다.**
`order-service.ts:367`은 `line.product.stock`을 그대로 보고하는데, 이 값은 트랜잭션 1단계에서 읽은 값이다. 경쟁에서 진 경우 그 사이 승자가 커밋했으므로 실제 재고는 더 적다. 결과적으로 "재고가 부족합니다"라고 말하면서 "구매 가능 수량 5개"를 함께 보내는, **자기 모순인 응답**이 나온다. 요청 수량이 1이었다면 특히 그렇다.

**(G3) 재고가 부족한 상품을 한 건만 보고한다.**
같은 루프가 첫 실패에서 멈추고 `products: [product]`에 한 건만 담는다. 타입은 배열이고 REQ-ORDER-013은 "재고가 부족한 상품을 식별 가능하게"라고 복수를 전제하는데, 세 항목이 모두 부족한 주문자는 한 건을 고치고 다시 제출해 또 거부당하는 일을 세 번 반복한다.

**(G4) 주문서 화면이 재고 상태를 전혀 보여주지 않는다.**
`OrderSummary.tsx`는 이름·단가·수량·금액만 렌더한다 — `CartItemDTO.stock`을 이미 받고 있는데도 쓰지 않는다. 그리고 `CheckoutForm.tsx:103`은 `failure.error` 문자열만 표시하고 `products` 배열을 버린다. 즉 경쟁에서 진 주문자는 배송 정보를 모두 입력해 제출한 뒤에야, **어떤 상품이** 문제인지 알 수 없는 한 줄짜리 오류를 받는다.

### 상품 목록·장바구니 화면은 존재하지 않는다

`src/app/page.tsx`는 상세 화면으로 가는 링크만 있는 스텁이고(SPEC-STOREFRONT-001 §4), `src/app/`에 장바구니 화면 라우트가 없다. 목록 API는 `stock`을 이미 응답에 담는다(`product.ts:48`). 따라서 "목록·장바구니에서의 품절 표시"는 **바꿀 화면이 없으므로** 이번 범위 밖이다(§3).

---

## §3. Out of Scope

### Out of Scope — 미결제 주문의 재고 자동 해제 (TTL/배치)
- 결제되지 않은 채 방치된 `pending_payment` 주문이 잡고 있는 재고를 시간 경과로 되돌리는 만료 작업은 이번 범위 밖이다.
- **소유자가 현재 비어 있다는 사실을 명시해 둔다**: SPEC-ORDER-001 §3은 이 책임의 소유자를 "결제 SPEC 또는 별도 운영 SPEC"으로 지목했고, SPEC-PAYMENT-001 plan.md §0 #4는 이벤트 주도 복원만 인수하고 시간 주도 해제는 명시적으로 제외했다. 즉 이 항목은 두 SPEC 사이에서 인수되지 않은 채 남아 있다. 이 SPEC은 그 사실을 기록만 하고 인수하지 않는다 — 트리거가 시간인 작업은 스케줄러라는 새 실행 축을 요구하며, 그것은 동시성 제어와 다른 문제다.

### Out of Scope — 재고 예약(hold)·대기열·분산 락
- 장바구니에 담는 시점이나 주문서 진입 시점에 재고를 선점해 두는 예약 모델, 예약의 TTL, 대기열, 외부 분산 락은 이번 범위 밖이다.
- 스키마에 근거가 없다: `prisma/schema.prisma`의 재고는 `Product.stock` 정수 컬럼 하나뿐이며, 예약 행·홀드 테이블·만료 컬럼이 존재하지 않는다. 예약 모델은 스키마가 약속한 적 없는 개념이므로 이 SPEC이 도입하지 않는다.

### Out of Scope — 관리자 재입고·재고 조정 UI
- 재입고, 수동 재고 조정, 재고 이력 조회 화면과 그 API는 이번 범위 밖이다. `Product`에 대한 쓰기 API 자체가 아직 없다(SPEC-CATALOG-001 §3에서 이월된 제외 항목).

### Out of Scope — 백오더·입고 알림·품절 대기 신청
- 품절 상품에 대한 예약 구매(back-order), 재입고 알림 신청, 대기 명단은 이번 범위 밖이다. 이를 담을 모델이 스키마에 없고, 이 SPEC은 만들지 않는다.

### Out of Scope — 상품 목록·장바구니 화면의 품절 표시
- 바꿀 화면이 존재하지 않기 때문이다(§2 마지막 항목). 목록 API는 이미 `stock`을 응답에 포함하므로, 화면이 생기는 시점에 그 화면의 SPEC이 표시 규칙을 정한다.

### Out of Scope — 상품 상세 화면의 품절 표시 변경
- 이미 구현되어 있고 올바르다(`ProductDetailView.tsx:45-49`). 이 SPEC은 그것을 보존하며(REQ-ORDER-031), 문구·배치·조건을 바꾸지 않는다.

### Out of Scope — 결제·취소 경로의 재고 복원
- SPEC-PAYMENT-001의 `markOrderCancelledAndRestoreStock()`은 이 SPEC의 대상이 아니다. 이 SPEC은 **차감 경로**만 다룬다.
- 다만 그 복원 함수도 여러 항목을 순회하며 행을 갱신하므로 REQ-ORDER-023의 순서 규칙이 적용될 여지가 있다. 이 SPEC은 그것을 강제하지 않고, plan.md §5에 관찰 사항으로만 남긴다.

### Out of Scope — 회원 체크아웃
- SPEC-ORDER-001 §3 첫 항목의 구조적 제외를 그대로 승계한다. 이 SPEC은 게스트 주문 경로만 다루며, 회원 신원을 새로 도입하지 않는다.

### Out of Scope — CI에 PostgreSQL 서비스 컨테이너 추가
- REQ-ORDER-032의 하네스는 **데이터베이스에 도달 가능한 환경에서 실행되는 형태**로 작성된다. GitHub Actions 워크플로에 `services: postgres`를 추가해 CI 필수 검사로 승격시키는 일은 SPEC-CI-001이 소유한 파일(`.github/workflows/ci.yml`)의 변경이므로 이번 범위 밖이며, **2026-09-02 사용자 확정으로 후속 CI SPEC(SPEC-CI-001 소유)에 명시적으로 미뤘다**(plan.md §0 "확정된 결정"). 그 결과 `AC-013-EXCL-CONCURRENCY`는 개발자 기계에서만 닫히고 CI에서는 열린 채로 남는다 — 받아들인 공백이다.

---

## §4. 요구사항 (GEARS, REQ-ORDER-022 ~ 033)

번호는 SPEC-ORDER-001의 REQ-ORDER-021에 이어진다 — SPEC-CATALOG-002가 SPEC-CATALOG-001의 번호를 이어 쓴 선례(`REQ-CATALOG-018`~)와 같은 방식이며, 같은 도메인의 요구사항이 한 줄기로 읽히게 한다.

Tier M — 요구사항 상한 20개 이내(현재 12개).

### 재고 차감의 동시성 (REQ-ORDER-022 ~ 027)

- **REQ-ORDER-022** (Ubiquitous): 주문 서비스는 재고 차감을 **조건부 원자 갱신** — 차감 대상 수량 이상의 재고를 조건으로 갖는 단일 UPDATE — 으로만 수행해야 하며, 재고를 읽어 애플리케이션 코드에서 비교한 뒤 그 결과로 갱신하는 경로를 가져서는 안 된다.

- **REQ-ORDER-023** (When): 하나의 주문 트랜잭션이 둘 이상의 상품 재고를 차감할 때, 주문 서비스는 상품 식별자의 오름차순이라는 **결정적 순서**로 차감해야 하며, 장바구니 항목의 저장 순서를 따라서는 안 된다.

- **REQ-ORDER-024** (When — 이벤트 탐지형): 같은 상품의 마지막 재고를 두 개 이상의 주문이 동시에 요청하면, 정확히 하나의 주문만 성공해야 하며, 어떤 상품의 재고도 음수가 되어서는 안 된다.

- **REQ-ORDER-025** (When — 이벤트 탐지형): 조건부 차감이 어떤 행에도 적용되지 않으면, 주문 서비스는 **같은 트랜잭션 안에서** 주문 대상 상품들의 재고를 다시 읽어, 요청 수량보다 재고가 적은 **모든** 항목을 실패 응답에 담아야 한다.

- **REQ-ORDER-026** (Ubiquitous): 재고 부족 실패 응답에 담긴 각 항목의 구매 가능 수량은 그 항목의 요청 수량보다 **작아야** 하며, 요청 수량 이상인 값이 담겨서는 안 된다.

- **REQ-ORDER-027** (When — 이벤트 탐지형): 교착 상태나 직렬화 실패로 데이터베이스가 트랜잭션을 중단시키면, 주문 서비스는 이를 **재시도 가능한 실패로 식별되는 응답**으로 매핑해야 하며, 분류되지 않은 서버 오류로 흘려보내서는 안 된다.

### 품절·재고 부족의 표면화 (REQ-ORDER-028 ~ 031)

- **REQ-ORDER-028** (When): 주문서 화면이 렌더링될 때, 주문 요약은 각 항목의 현재 재고가 그 항목의 수량보다 적으면 **재고 부족**으로, 재고가 0이면 **품절**로 각 항목을 식별 가능하게 표시해야 한다.

- **REQ-ORDER-029** (Ubiquitous): 주문서 화면은 REQ-ORDER-028의 표시를 근거로 주문 제출을 차단해서는 안 된다 — 화면이 읽은 재고는 렌더 시점의 값이고, 구매 가능 여부의 유일한 권위는 주문 트랜잭션이다.

- **REQ-ORDER-030** (When): 주문 제출이 재고 부족으로 거부되면, 주문서 화면은 응답이 식별한 **각 상품의 이름과 현재 구매 가능 수량**을 항목별로 표시해야 하며, 어떤 상품이 문제인지 알 수 없는 단일 문구만 표시해서는 안 된다.

- **REQ-ORDER-031** (Ubiquitous): 이 SPEC은 상품 상세 화면의 품절 표시(SPEC-STOREFRONT-001)와 결제 취소 시 재고 복원 경로(SPEC-PAYMENT-001)를 변경해서는 안 된다.

### 검증의 정직성 (REQ-ORDER-032 ~ 033)

- **REQ-ORDER-032** (Where — 능력 게이트): 살아 있는 PostgreSQL에 도달 가능한 환경에서, 검증 하네스는 같은 상품의 마지막 재고를 노리고 **실제로 동시에** 실행된 두 주문 중 정확히 하나만 성공하고 재고가 정확히 0이 됨을 관측해야 한다.

- **REQ-ORDER-033** (Ubiquitous): 살아 있는 PostgreSQL이 없는 환경에서 하네스가 통과했다는 사실을, 어떤 산출물도 행 잠금 직렬화가 성립했다는 증거로 제시해서는 안 된다.

---

## §5. 성공 기준

- REQ-ORDER-022 ~ 033 각각에 대응하는 AC가 acceptance.md에 1:1로 존재하고, 실 DB가 필요한 항목은 §0에서 이름 붙은 제외로 분류되어 있다.
- SPEC-ORDER-001의 기존 AC 21건과 SPEC-PAYMENT-001의 AC 20건이 회귀 없이 유지된다.
- `npm run typecheck` · `npm run lint` · `npm test` 종료 코드 0.
