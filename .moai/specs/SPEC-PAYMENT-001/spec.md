---
id: SPEC-PAYMENT-001
title: "PG 결제 연동과 결제 승인·취소 웹훅 처리 (게스트 전용)"
version: "0.1.0"
status: completed
created: 2026-09-02
updated: 2026-09-02
author: snake
priority: P1
phase: "v0.1.0 MVP"
module: "src/features/payments"
lifecycle: spec-anchored
tags: "payment, pg, tosspayments, webhook, idempotency, audit-log, guest"
tier: L
depends_on: [SPEC-ORDER-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-02 | 0.1.0 | draft | plan-phase 최초 작성. SPEC-ORDER-001이 명시적으로 유예한 두 책임 — 결제 승인·웹훅 처리, 그리고 `pending_payment` 이후의 상태 전이(REQ-ORDER-019) — 를 이 SPEC이 인수한다. PG사(Toss Payments)는 사용자가 이미 확정했고, 범위 경계 4건(취소는 웹훅 주도만/확인 실패는 재시도 허용/감사 로그 포함/즉시 재고 복원 포함)은 사용자와의 사전 확인을 통해 확정된 채로 이 문서에 반영한다. |

---

## §1. 개요

`our-shop`의 **PG(Toss Payments) 결제 연동**과 **결제 승인·취소 웹훅 처리**를 정의한다. SPEC-ORDER-001이 `pending_payment` 상태로 생성해 둔 게스트 주문을, 이 SPEC이 실제 결제창 호출 → 승인(confirm) → 웹훅 기반 후속 상태 전이로 이어 붙인다.

> **이 SPEC이 다루는 주문은 SPEC-ORDER-001이 만든 게스트 주문뿐이다.** 회원 결제는 다루지 않는다 — SPEC-ORDER-001이 회원 체크아웃 자체를 구조적으로 제외했으므로(그 SPEC spec.md §3 첫 항목), 회원에게 귀속된 주문이 이 저장소에 존재하지 않는다. 이 SPEC은 그 부재를 새로 만들지 않는다.

### 이 SPEC이 인수하는 두 가지 유예된 책임

SPEC-ORDER-001은 두 가지를 **명시적으로 범위 밖에 두면서 그 소유자를 결제 SPEC으로 지목**했다.

| 유예된 책임 | SPEC-ORDER-001의 문구 | 이 SPEC의 인수 |
|---|---|---|
| 결제 상태 전이 | REQ-ORDER-019 — "주문 도메인은 외부 결제대행사를 호출하거나, 결제 승인 결과를 기록하거나, 주문을 결제 완료 상태로 전이시켜서는 안 된다" | REQ-PAYMENT-007(승인 시 paid 전이) / REQ-PAYMENT-014(취소 시 cancelled 전이) |
| 결제 감사 로그 | `tech.md` "결제 상태 변경 이력을 별도 테이블에 감사 로그(append-only)로 남긴다" | REQ-PAYMENT-001(PaymentAuditLog) |

### 결제창은 어디서 열리는가 — 새 화면을 만들지 않는다

주문은 이미 `POST /api/orders`가 만들고, 카트는 그 트랜잭션의 마지막 단계에서 비워진다(SPEC-ORDER-001 REQ-ORDER-011). 따라서 결제 실패 후 "주문서로 돌아가 다시 담기"는 성립하지 않으며, 재시도는 **같은 주문에 대해 결제창을 다시 여는 것**을 뜻한다. 이 SPEC은 그 결제창 호출 지점을 이미 존재하는 `/checkout/complete/[orderId]` 화면(SPEC-ORDER-001 REQ-ORDER-018)에 얹는다 — 그 화면이 이미 주문의 `orderId`·`totalAmount`와 게스트 귀속 인가를 가지고 있는 유일한 화면이기 때문이다(research.md §2·§6).

### 소비하는 계약과, 유일한 EXTEND 대상

| 출처 | 형태 | 이 SPEC에서의 쓰임 |
|---|---|---|
| SPEC-ORDER-001 `Order` / `OrderItem` (Prisma) | `id`·`orderNumber`·`status`·`guestId`·`totalAmount`·`items[]` 등 | 승인·웹훅 처리의 대상 행. 이 SPEC은 `Order`에 `paymentKey` 컬럼 **하나만** 추가한다(design.md §1) |
| SPEC-ORDER-001 `OrderStatus` enum | `pending_payment` / `paid` / `cancelled` | 이 SPEC은 **이미 예약된 두 값**(`paid`, `cancelled`)에 처음으로 전이 로직을 붙인다. 새 값을 추가하지 않는다(REQ-PAYMENT-003) |
| SPEC-ORDER-001 `/checkout/complete/[orderId]` 화면 | 게스트 귀속 인가 + 주문 요약 렌더 | **유일한 EXTEND 대상.** 결제 안내 문구를 `Order.status` 조건부로 바꾸고, `pending_payment`일 때 결제 시작 버튼을 추가한다(research.md §6). 인가 로직(게스트 쿠키 대조)은 건드리지 않는다 |
| `tech.md` 결제(PG) 연동 방식 | 서버 사이드 처리 + 웹훅 기반 정합성 + 감사 로그 | 이 SPEC이 이행하는 세 가지 요구의 원출처 |

---

## §2. 요구사항 (GEARS, REQ-PAYMENT-001 ~ 020)

Tier L — 요구사항 상한 25개 이내(현재 20개).

### 데이터 모델 및 불변식

- **REQ-PAYMENT-001** (Ubiquitous): 결제 도메인은 `Order.status`의 모든 전이(`pending_payment→paid`, `paid→cancelled`)마다 정확히 하나의 `PaymentAuditLog` 행을 남겨야 하며, 그 행은 전이 전 상태, 전이 후 상태, 트리거 출처(승인 API 응답 | 웹훅), 관련 주문 id, 발생 시각을 보존해야 한다.
- **REQ-PAYMENT-002** (Unwanted, shall not): 이미 기록된 `PaymentAuditLog` 행은 수정되거나 삭제되어서는 안 된다.
- **REQ-PAYMENT-003** (Unwanted, shall not): 결제 도메인은 `OrderStatus` enum에 `pending_payment`·`paid`·`cancelled` 외의 새 값을 추가해서는 안 된다.
- **REQ-PAYMENT-004** (Ubiquitous): 결제 도메인은 하나의 주문을 최대 하나의 PG 결제 건(`paymentKey`)에만 귀속시켜야 하며, 이미 다른 `paymentKey`로 귀속된 주문에 그와 다른 `paymentKey`를 가진 이벤트가 도착하면 그 이벤트는 거부되고 주문 상태는 변경되지 않아야 하며, 그 거부 사실이 `PaymentAuditLog`에 기록되어야 한다(결제 데이터 정합성 최우선 원칙에 따른 감사 추적).

### 결제창 호출 및 승인(confirm) 흐름

- **REQ-PAYMENT-005** (When): 게스트가 결제 대기 상태인 자신의 주문 완료 화면에서 결제를 시작하면, 화면은 PG 결제창을 그 주문의 `orderId`·주문명(`orderName`)·금액(`Order.totalAmount`)으로 호출해야 하며, `orderName`은 그 주문의 첫 번째 `OrderItem.productName`에 나머지 항목 수를 "외 N건"으로 덧붙인 문자열로 도출되어야 한다(단일 항목 주문은 "외 N건" 접미사 없이 상품명 그대로, 도출 규칙은 design.md §6 참조).
- **REQ-PAYMENT-006** (When): 결제 성공 리다이렉트(`paymentKey`·`orderId`·`amount` 쿼리 파라미터)가 도착하면, 결제 서비스는 승인(confirm) API를 호출하기 전에 그 `amount`를 대상 주문의 `totalAmount`와 대조해야 하며, 다르면 승인 API를 호출하지 않고 거부해야 한다.
- **REQ-PAYMENT-007** (When): `amount`가 일치하면, 결제 서비스는 승인 API를 호출해야 하며, 승인이 성공하면 대상 주문이 그 시점에 여전히 `pending_payment`인 조건 아래에서만 `paid`로 전이시켜야 한다.
- **REQ-PAYMENT-008** (When — 이벤트 탐지형): 승인 처리는 다음 두 조건을 구분해서 응답해야 한다.
  - (a) 승인 API 호출이 실패하거나(네트워크 오류·PG 거부), 또는 대상 주문이 이미 이번 이벤트와 **다른** `paymentKey`로 확정되어 있으면, 결제 서비스는 주문 상태를 변경하지 않고 재시도 가능함을 알리는 오류를 반환해야 하며, 후자(`paymentKey` 불일치)의 경우 그 거부 사실을 REQ-PAYMENT-004에 따라 `PaymentAuditLog`에 기록해야 한다.
  - (b) 대상 주문이 이미 이번 이벤트와 **같은** `paymentKey`로 `paid` 상태이면(멱등 재시도), 결제 서비스는 오류 없이 성공으로 처리하고 완료 화면으로 정상 리다이렉트해야 하며, 새로운 `PaymentAuditLog`를 기록해서는 안 된다.

### 결제 실패·중단

- **REQ-PAYMENT-009** (When): 게스트가 결제창에서 인증을 완료하지 못하고 실패 경로(failUrl)로 돌아오면, 대상 주문의 상태는 `pending_payment`로 남아야 하며, 그 주문의 완료 화면은 같은 주문에 대해 결제를 다시 시작할 수 있는 수단을 제시해야 한다.
- **REQ-PAYMENT-010** (Unwanted, shall not): 결제 도메인은 결제 실패·중단을 표현하기 위한 새 `OrderStatus` 값을 추가해서는 안 된다.

### 웹훅 수신 및 서명 검증

- **REQ-PAYMENT-011** (When): 결제 웹훅 엔드포인트에 요청이 도착하면, 결제 서비스는 사전에 공유된 웹훅 시크릿으로 전송 시각·서명·전송 id 헤더에 대한 HMAC-SHA256 서명을 검증한 뒤에만 페이로드를 처리해야 한다.
- **REQ-PAYMENT-012** (When — 이벤트 탐지형): 웹훅 서명 검증이 실패하면, 결제 서비스는 페이로드를 처리하지 않고 어떤 주문 상태도 변경하지 않으며 어떤 `PaymentAuditLog`도 기록하지 않아야 한다.
- **REQ-PAYMENT-013** (When): 서명이 유효한 `PAYMENT_STATUS_CHANGED` 웹훅이 상태 `DONE`을 보고하고 그 주문이 그 시점에 `pending_payment`이면, 결제 서비스는 금액을 대조한 뒤 그 주문을 `paid`로 전이시켜야 한다(REQ-PAYMENT-007과 동일한 최종 상태에 도달하는 대체 경로).
- **REQ-PAYMENT-014** (When): 서명이 유효한 `PAYMENT_STATUS_CHANGED` 웹훅이 상태 `CANCELED` 또는 `PARTIAL_CANCELED`를 보고하고 그 주문이 그 시점에 `paid`이면, 결제 서비스는 하나의 트랜잭션 안에서 주문을 `cancelled`로 전이시키고 그 주문에 속한 각 주문 항목의 수량만큼 해당 상품의 재고를 되돌려야 한다.
- **REQ-PAYMENT-015** (Ubiquitous): 웹훅이 보고하는 금액은 어떤 상태 전이가 일어나기 전에 대상 주문의 저장된 금액과 대조되어야 하며, 대조에 실패하면 전이는 일어나지 않고 그 사실이 기록되어야 한다.

### 멱등성

- **REQ-PAYMENT-016** (When): 동일한 전송 id를 가진 웹훅이 중복 전달되면, 결제 서비스는 두 번째 이후의 전달에 대해 상태를 다시 전이시키거나 재고를 다시 되돌리거나 `PaymentAuditLog`를 다시 기록해서는 안 되며, PG에게는 여전히 처리 성공으로 응답해야 한다.
- **REQ-PAYMENT-017** (Ubiquitous): 결제 상태 전이는 승인 경로와 웹훅 경로 양쪽에서 같은 이벤트가 동시에 도착하더라도 정확히 한 번만 반영되어야 하며, 나중에 도착한 쪽은 상태를 다시 바꾸지 않아야 한다(구현 기법은 design.md §2 참조).

### 보안 경계

- **REQ-PAYMENT-018** (Unwanted, shall not): 서버는 PG 시크릿 키 또는 웹훅 서명 시크릿을 클라이언트로 전송하거나 클라이언트 번들에 포함시켜서는 안 된다.
- **REQ-PAYMENT-019** (Unwanted, shall not): 결제 승인(confirm) API 호출과 웹훅 처리는 서버에서만 수행되어야 하며, 클라이언트 코드는 이 두 호출 중 어느 것도 직접 수행해서는 안 된다.

### 게스트 전용 경계 (SPEC-ORDER-001 상속)

- **REQ-PAYMENT-020** (Ubiquitous): 결제 도메인이 다루는 모든 주문은 SPEC-ORDER-001이 만든 게스트 전용 주문이며, 결제 도메인은 회원 귀속 주문이나 회원 결제 경로를 도입해서는 안 된다.

---

## §3. Out of Scope

### Out of Scope — 관리자·사용자 주도 취소·환불

- 관리자 또는 사용자가 직접 요청하는 취소·환불 API, 부분 취소·부분 환불 UI는 이번 범위 밖이다.
- 근거: 사용자가 사전 확인한 범위 결정 — "취소"는 **PG가 먼저 알린 취소·실패 통지(웹훅, 또는 확인 API 실패 경로)만** 다룬다. 관리자 주도 취소·환불은 향후 백오피스 주문 관리 SPEC(칸반 카드 t12로 이미 백로그에 등재)의 몫이다.

### Out of Scope — 미결제 주문의 재고 자동 해제 (TTL/배치)

- 결제되지 않은 채 방치된 주문이 잡아둔 재고를 일정 시간 후 되돌리는 만료 작업(스케줄러/배치)은 이번 범위 밖이다.
- 근거: 사용자가 사전 확인한 범위 결정. 이 SPEC이 다루는 재고 복원은 **이벤트 주도(웹훅이 취소를 알렸을 때)뿐**이며, 시간 경과만으로 트리거되는 예약 작업은 별도 운영 SPEC의 몫이다. SPEC-ORDER-001 spec.md §3도 같은 결정을 이미 명시해 두었다.

### Out of Scope — 결제 실패를 위한 새 상태값

- `OrderStatus`에 `failed` 같은 새 값을 추가하지 않는다.
- 근거: 사용자가 사전 확인한 범위 결정 — 확인(confirm) 실패나 결제창 중단은 주문을 `pending_payment`에 그대로 두고 재시도를 허용한다. 새 상태값은 재시도 의미론을 오히려 복잡하게 만든다(REQ-PAYMENT-010).

### Out of Scope — 가상계좌·정기결제·해외 간편결제·정산

- 가상계좌 결제, 정기/구독 결제, 해외 간편결제 전용 흐름(`CANCEL_STATUS_CHANGED` 웹훅 포함), 정산·지급대행 웹훅(`payout.changed`/`seller.changed`), ARS 결제는 이번 범위 밖이다.
- 근거: 요청받은 범위는 카드/일반 결제의 승인 + 두 웹훅 이벤트(`PAYMENT_STATUS_CHANGED`)로 한정된다(research.md §4). 위 항목 중 어느 것도 사용자가 요청하지 않았으며, 지금 추상화를 준비해 두는 것은 확정되지 않은 요구에 대한 추측성 설계다.

### Out of Scope — 회원 결제

- 로그인한 회원의 결제 경로, 회원 귀속 주문의 결제 처리는 이번 범위 밖이다.
- 근거: SPEC-ORDER-001이 회원 체크아웃 자체를 구조적으로 제외했으므로(그 SPEC spec.md §3 첫 항목 — 서버 렌더 화면이 회원을 식별할 수단이 없음), 이 저장소에는 회원에게 귀속된 주문이 존재하지 않는다. 이 SPEC은 존재하지 않는 대상을 위한 분기를 만들지 않는다.

### Out of Scope — 주문서 화면·주문 생성 트랜잭션의 재설계

- `/checkout` 주문서 화면, `POST /api/orders`의 주문 생성 트랜잭션 내부 로직(가격 스냅샷·재고 차감·멱등키)은 이번 범위 밖이며 이 SPEC은 그 파일들을 건드리지 않는다(plan.md §4).
- 근거: 이미 SPEC-ORDER-001이 소유하고 검증을 마친 경계다. 이 SPEC이 다시 여는 것은 그 경계를 흐리는 일이다.

### Out of Scope — 카드사·간편결제 수단별 UI 커스터마이징

- 결제수단 선택 UI를 자체적으로 만들지 않는다. PG SDK가 제공하는 결제창(위젯)을 그대로 사용한다.
- 근거: 요청받은 범위가 "결제창 호출 + 승인 + 웹훅"이며, 결제수단별 UI는 PG SDK의 책임 영역이다.
