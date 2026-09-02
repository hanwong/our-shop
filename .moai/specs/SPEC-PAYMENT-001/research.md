---
id: SPEC-PAYMENT-001
status: draft
updated: 2026-09-02
tier: L
---

# Research: SPEC-PAYMENT-001 — PG 결제 연동 착수 전 저장소·외부 문서 조사

이 문서는 두 갈래의 조사를 함께 담는다. (1) 이 저장소가 지금 무엇을 가지고 있고 무엇이 없는지 — SPEC-ORDER-001이 남긴 자리, (2) Toss Payments 공식 문서에서 실제로 확인한 결제 흐름·웹훅·서명 검증 사실. 추정으로 좁힌 범위와 확인으로 좁힌 범위를 구분하기 위해 각 결론에 근거를 함께 적는다.

## §1. 저장소 현재 상태 (관측된 사실)

| 확인 항목 | 수단 | 결과 |
|---|---|---|
| `Order.status` 실제 쓰기 경로 | `src/features/orders/services/order-service.ts` 전문 읽기 | `pending_payment`만 쓴다. `paid`·`cancelled`로의 전이 로직은 **어디에도 없다**(REQ-ORDER-019가 이를 금지) |
| `OrderStatus` enum | `prisma/schema.prisma:214-218` | `pending_payment` / `paid` / `cancelled` 세 값이 이미 선언되어 있으나, 뒤 두 값은 주석 그대로 "reserved for the follow-up payment SPEC — no transition exists here" |
| 결제 관련 의존성 | `package.json` dependencies | 없음. PG SDK·HMAC 검증 라이브러리 어느 것도 설치되어 있지 않음 |
| 결제 환경변수 | `.env.example` | 없음. `PG_API_KEY`/`PG_SECRET_KEY`/`PG_WEBHOOK_SECRET` 어느 것도 등록되어 있지 않음(`tech.md`의 권고안만 존재) |
| 완료 화면의 결제 문구 | `src/app/checkout/complete/[orderId]/page.tsx:59-65` | "아직 결제 전 단계입니다. 주문 내역만 접수되었으며, 결제는 진행되지 않았습니다." 를 **무조건** 표시한다 — `Order.status`를 조건으로 분기하지 않는다 |
| 결제창을 호출하는 코드 | `src/app/checkout/**`, `src/components/checkout/**` 전체 grep | 없음. 주문 생성(`POST /api/orders`) 이후 결제창을 여는 어떤 트리거도 존재하지 않는다 |
| 카트-주문 트랜잭션 패턴 | `order-service.ts`의 `createOrder()` | 조건부 `updateMany`(재고 차감)로 경합을 막는 패턴이 이미 확립되어 있다 — §3에서 이 패턴을 상태 전이에 재사용한다 |

**결론**: 이 SPEC은 결제 도메인의 첫 SPEC이며, 인수할 유예된 책임이 하나 있다 — REQ-ORDER-019가 명시적으로 금지해 둔 "결제 승인 결과 기록·상태 전이"다. 그리고 놓치기 쉬운 두 번째 사실 하나 — **완료 화면의 결제 안내 문구가 지금 무조건 "결제 전"이라고 말한다.** 이 SPEC이 주문을 실제로 `paid`로 전이시키기 시작하면 그 문구는 즉시 거짓이 된다. 이는 "화면을 새로 만드는 일"이 아니라 이 SPEC이 만드는 사실 변화가 기존 화면에 남긴 결함을 닫는 일이므로, §2의 소비 계약에서 EXTEND 대상으로 명시한다.

## §2. 조사 질문 1 — 결제창은 어디서, 언제 열리는가

### 확인된 근거

1. SPEC-ORDER-001의 확정 결정(spec.md §1, plan.md §0 #1): **주문을 먼저 만들고 결제는 나중**. 주문은 `POST /api/orders` 성공 시 `pending_payment`로 생성되고, 곧바로 `/checkout/complete/[orderId]`로 안내된다.
2. 카트는 주문 생성 트랜잭션의 마지막 단계에서 **이미 비워진다**(`order-service.ts` 6단계). 즉 결제가 실패해도 `/checkout` 주문서 화면으로 돌아가 다시 제출할 수 없다 — 비울 카트가 없다.
3. Toss Payments 결제 흐름(공식 문서, §5 인용)은 클라이언트가 SDK로 결제창을 열 때 `orderId`·`amount`·`successUrl`·`failUrl`을 함께 전달하라고 요구한다.

### 결론

**결제창은 `/checkout/complete/[orderId]` 화면에서, 그 주문이 아직 `pending_payment`일 때 연다.** 이 화면이 이미 주문의 `orderId`·`totalAmount`를 알고 있는 유일한 접근 가능 화면이기 때문이다(§1). "재시도"의 의미도 이 지점에서 자연스럽게 정해진다 — 새 주문을 만드는 것이 아니라 **같은 주문에 대해 결제창을 다시 여는 것**이다(plan.md §0 #2). 이는 사용자 지시("Order.status stays pending_payment, retry allowed")와 정확히 일치하며 새 화면을 발명하지 않는다.

### 검토했지만 택하지 않은 대안

| 대안 | 기각 사유 |
|---|---|
| `/checkout` 주문서 제출과 동시에(같은 요청 안에서) 결제창을 연다 | 결제창 호출은 브라우저의 최상위 상호작용(SDK가 모달/리다이렉트를 제어)이 필요해 서버 API 응답 하나로 대체할 수 없다. 또한 주문 생성과 결제 시작을 한 요청에 묶으면 REQ-ORDER-012(주문 생성 트랜잭션의 원자성)의 경계에 결제라는 외부 시스템 호출이 끼어들게 된다 |
| 새로운 화면(`/checkout/pay/[orderId]`)을 만든다 | 완료 화면이 이미 필요한 정보를 전부 가지고 있고 재방문 인가(게스트 쿠키 대조)도 이미 구현되어 있다. 새 화면을 만들면 그 인가를 다시 구현해야 한다 |

## §3. 조사 질문 2 — 승인(confirm) 흐름의 신뢰 경계는 어디인가

### 확인된 근거 (Toss Payments 공식 문서)

- 결제 흐름은 요청(request) → 인증(auth) → 승인(confirm) 3단계다. 구매자 인증 후 Toss는 `successUrl`로 `paymentKey`·`orderId`·`amount` 쿼리 파라미터를 실어 브라우저를 리다이렉트한다. **서버는 그 `orderId`/`amount`를 요청 전에 저장해 둔 값과 대조한 뒤** `POST /v1/payments/confirm`을 `{paymentKey, orderId, amount}`로 호출해 결제를 확정해야 한다. (출처: https://docs.tosspayments.com/guides/v2/get-started/payment-flow)
- 확인(confirm) API 요청 본문 제약: `paymentKey`(문자열, ≤200자), `orderId`(6~64자, `[A-Za-z0-9\-_]`), `amount`(정수). POST API는 선택적으로 `Idempotency-Key` 요청 헤더를 지원한다. (출처: 검색 결과가 인용한 https://docs.tosspayments.com/reference)

### 결론

**"서버가 이미 알고 있는 값"과 "리다이렉트가 실어 온 값"의 대조가 확인(confirm) API 호출보다 먼저 와야 한다.** 리다이렉트 쿼리 파라미터는 브라우저를 거쳐 오므로 신뢰 경계 밖의 입력이며, `amount`를 대조 없이 그대로 확인 API에 넘기면 그 값을 확인 API가 "그렇다"고 답했다는 사실 자체가 위조된 리다이렉트를 검증해 준 꼴이 된다. 저장된 값은 `Order.totalAmount`이며, 이는 SPEC-ORDER-001이 이미 서버 계산으로 확정해 둔 값이다(REQ-ORDER-014와 같은 원칙 — 클라이언트가 실어 온 금액은 지시가 아니라 대조용 입력).

## §4. 조사 질문 3 — 웹훅은 무엇을 언제 신뢰할 근거로 삼는가

### 확인된 근거 (Toss Payments 공식 문서)

- 관련 웹훅 이벤트는 두 가지다. `PAYMENT_STATUS_CHANGED`(카드/계좌이체/휴대폰 등 결제의 상태 변경, `data.status`에 `DONE`/`CANCELED`/`PARTIAL_CANCELED` 등 포함 — **국내 카드 결제 취소의 1차 신호**)와 `CANCEL_STATUS_CHANGED`(**해외 간편결제 취소/실패 전용** 동반 이벤트). 이 SPEC은 후자를 다루지 않는다 — 해외 간편결제 자체가 범위 밖이다(spec.md §3). (출처: https://docs.tosspayments.com/reference/using-api/webhook-events)
- 서명 검증은 세 헤더로 이루어진다 — `tosspayments-webhook-transmission-time`·`tosspayments-webhook-signature`·`tosspayments-webhook-transmission-id`(재전송 시 `tosspayments-webhook-transmission-retried-count` 추가). 사전 공유 시크릿으로 payload에 대한 HMAC-SHA256을 계산해 서명 헤더와 base64 비교한다. (출처: 위와 동일)

### 결론

**웹훅은 두 가지 역할을 겸한다** — (1) 확인(confirm) 리다이렉트가 어떤 이유로든 서버에 도달하지 못했을 때의 **승인 완료의 대체 신호**(`DONE`), (2) **취소의 1차 신호**(`CANCELED`/`PARTIAL_CANCELED`, 사용자 확인 결정 1). 서명 검증 없이 페이로드를 신뢰하면 누구나 임의의 `POST`로 결제 상태를 조작할 수 있으므로, 서명 검증은 그 어떤 상태 판단보다 먼저 와야 한다. `transmission-id`는 웹훅 특유의 재전송에 대한 자연스러운 멱등키 후보다 — Toss가 응답을 못 받으면 같은 이벤트를 같은 id로 재전송하기 때문이다.

## §5. 조사 질문 4 — `PG_API_KEY` 이름이 실제 Toss 모델과 맞는가 (문서-현실 불일치, 정직하게 기록)

`tech.md`는 `PG_API_KEY`/`PG_SECRET_KEY`를 나란히 "서버 전용, 클라이언트에 노출 금지"로 규정한다. 그러나 Toss Payments의 실제 키 모델은 **두 키의 성격이 다르다** — "클라이언트 키(client key)"는 결제창을 여는 브라우저 SDK에 그대로 박아 넣도록 설계된 **공개 키**이고, "시크릿 키(secret key)"만 서버 전용이다. `tech.md`가 작성된 시점에는 어떤 PG사를 쓸지조차 정해지지 않아(§2) 이 구분이 반영되지 못한 것으로 보인다.

**이 SPEC이 내리는 결정**: `PG_SECRET_KEY`와 `PG_WEBHOOK_SECRET`은 `tech.md`가 예고한 이름 그대로 서버 전용으로 쓴다. 클라이언트 키는 그 이름을 재사용하지 않고 `NEXT_PUBLIC_PG_CLIENT_KEY`라는 새 변수로 둔다 — Next.js에서 클라이언트 번들에 포함되는 환경변수는 `NEXT_PUBLIC_` 접두사가 있어야 하며(design.md §7), 이 접두사 없이 `PG_API_KEY`라는 이름을 그대로 쓰면 "서버 전용"이라는 이름의 의미와 실제 노출 범위가 어긋난다. 이는 `tech.md`의 오기를 조용히 따르는 대신 실제 SDK 요구사항에 맞춰 이름을 바로잡는 선택이며, `tech.md`는 이 SPEC의 sync 단계에서 갱신 대상으로 남긴다(이 문서에서 직접 고치지 않는다 — plan-phase는 spec 작성 범위이지 project 문서 갱신 범위가 아니다).

## §6. 조사 질문 5 — 완료 화면과 결제 도메인의 경계

완료 화면(`page.tsx`)은 SPEC-ORDER-001이 소유한 파일이다. 이 SPEC은 그 파일의 존재 이유(REQ-ORDER-018 — 주문 내용·배송지·결제 여부 안내)를 바꾸지 않고, **결제 여부 안내가 실제 상태를 반영하도록 조건을 추가**하고 **결제 시작 버튼을 얹는다.** 이것이 SPEC-ORDER-001의 PRESERVE 목록을 침해하는 일인지 검토했다 — SPEC-ORDER-001의 plan.md §4 불변 조건은 "run-phase에서" 그 SPEC 자신이 건드리지 않을 파일을 정한 것이며, 이후 SPEC이 그 파일을 **EXTEND**하는 것을 막지 않는다(오히려 그 SPEC의 REQ-ORDER-019 — "결제 도메인은 이 SPEC의 범위가 아니다" — 가 결제 SPEC이 이어받을 자리로 지목한 지점이다). 따라서 이 파일은 이 SPEC의 EXTEND 대상으로 명시하며(spec.md §1), PRESERVE 목록에 없다.

## §7. 검증 하네스의 한계 (SPEC-ORDER-001과 동일한 한계, 재확인)

`vitest.config.ts`는 여전히 `node` 환경이고 살아 있는 PostgreSQL이 없다(SPEC-ORDER-001 research.md §5). 이 SPEC의 핵심 주장 중 하나(조건부 갱신에 의한 이중 전이 방지)는 SPEC-ORDER-001의 재고 차감과 같은 성격의 주장이므로 같은 분류가 적용된다 — 순차 요청으로 관측 가능한 부분과 실 DB 잠금이 있어야만 관측 가능한 동시성 성질을 acceptance.md §0에서 분리한다.

## §8. 자원 표

| 소스 | URL | 이 문서에서의 인용처 |
|---|---|---|
| Toss Payments 결제 흐름 가이드 | https://docs.tosspayments.com/guides/v2/get-started/payment-flow | §3 |
| Toss Payments 웹훅 이벤트 레퍼런스 | https://docs.tosspayments.com/reference/using-api/webhook-events | §4 |
| Toss Payments 승인 API 레퍼런스(검색 결과 인용) | https://docs.tosspayments.com/reference | §3 |
