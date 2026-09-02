---
id: SPEC-PAYMENT-001
status: implemented
updated: 2026-09-02
tier: L
---

# Plan: SPEC-PAYMENT-001 — PG 결제 연동과 승인·취소 웹훅 처리

## §0. 결정 기록 — run-phase 진입 전 확정 완료

이 SPEC은 사용자가 이미 다섯 가지 범위 결정을 사전에 확인해 준 상태로 시작한다. 아래는 그 결정과, plan-phase 조사(research.md)가 추가로 확정한 두 가지다.

### #1 취소의 범위 — 웹훅 주도만 (사용자 확인)

- **확정**: PG가 먼저 알린 취소·실패 통지(웹훅, 또는 확인 API 실패 경로)만 다룬다. 관리자·사용자 주도 취소·환불 API는 범위 밖이다(spec.md §3, 백로그 카드 t12).
- **이 결정이 고정하는 것**: `payment-repository.ts`는 취소를 **일으키는** 함수를 export하지 않는다 — 웹훅이 보고한 사실을 **반영하는** 함수만 export한다(design.md §2).

### #2 확인 실패/중단 시 재시도 — 새 상태값 없음 (사용자 확인)

- **확정**: 확인 API 실패나 결제창 중단 시 `Order.status`는 `pending_payment`로 남고, 같은 주문에 대해 결제를 재시도할 수 있다. `failed` 같은 새 enum 값을 만들지 않는다.
- **이 결정이 고정하는 것**: M1의 스키마 변경은 `Order.paymentKey` 컬럼 추가 **하나뿐**이다 — `OrderStatus` enum 자체는 무변경.

### #3 결제 감사 로그 — 포함 (사용자 확인)

- **확정**: 이 SPEC은 `PaymentAuditLog`(append-only)를 만들어 이 SPEC이 주도하는 모든 상태 전이를 기록한다.
- **근거**: `product.md`의 "결제 데이터 정합성 최우선" 제약과 `tech.md`의 명시적 권고를 직접 이행한다.

### #4 즉시 재고 복원 — 이벤트 주도만 포함, TTL 배치는 제외 (사용자 확인)

- **확정**: 취소 웹훅이 도착했을 때 그 주문이 잡고 있던 재고를 **같은 트랜잭션 안에서** 즉시 복원한다(design.md §2). 방치된 미결제 주문의 시간 기반 재고 해제(TTL/배치)는 별도의 향후 SPEC/운영 관심사로 남는다.
- **왜 헷갈리기 쉬운가**: 두 가지 모두 "재고를 되돌린다"는 점에서 같아 보이지만 트리거가 다르다 — 이것은 **웹훅이라는 사건**에 반응하고, 제외된 것은 **시간 경과**에 반응한다. 이 SPEC은 후자를 만들지 않는다.

### #5 PG사 — Toss Payments (사용자 확인, plan-phase 이전에 이미 확정)

- 결제 흐름·웹훅 이벤트·서명 검증 방식은 research.md §3~§4가 Toss 공식 문서에서 확인한 사실을 그대로 따른다.

### #6 결제창 호출 지점 — 새 화면 없이 완료 화면에 얹는다 (research.md §2가 확정)

- **질문이었던 것**: 결제창을 여는 트리거는 어디에 두는가.
- **확정**: `/checkout/complete/[orderId]`(SPEC-ORDER-001 소유)에 결제 시작 버튼을 얹는다. 새 화면을 만들지 않는다 — 그 화면이 이미 주문 id·금액·게스트 인가를 전부 가지고 있기 때문이다.
- **이 결정이 고정하는 것**: 이 SPEC은 `/checkout` 주문서 화면과 주문 생성 트랜잭션을 건드리지 않는다(§4). 완료 화면만 EXTEND한다.

### #7 환경변수 이름 — `tech.md`의 `PG_API_KEY`를 그대로 쓰지 않는다 (research.md §5가 확정)

- **왜 다시 열었나**: `tech.md`는 `PG_API_KEY`를 "서버 전용"으로 규정했으나, Toss의 클라이언트 키는 설계상 브라우저에 노출되는 공개 키다. 이름과 실제 노출 범위가 어긋난 채로 그대로 쓰면 "서버 전용"이라는 이름이 거짓이 된다.
- **확정**: 클라이언트 키는 `NEXT_PUBLIC_PG_CLIENT_KEY`라는 새 이름을 쓴다. `PG_SECRET_KEY`·`PG_WEBHOOK_SECRET`은 `tech.md` 그대로 서버 전용으로 쓴다(design.md §7).
- **후속 조치**: `tech.md`의 해당 항목 갱신은 sync 단계 이후로 남긴다 — plan-phase는 SPEC 작성 범위이지 project 문서 갱신 범위가 아니다.

## §1. 개요 / 목표

`our-shop`에 **결제 도메인을 처음 도입**한다. 대상은 SPEC-ORDER-001이 만든 게스트 주문의 결제 승인·취소뿐이다(§0 #5 회원 결제 없음 — spec.md §3). 산출물은 세 층이다.

1. **데이터**: `Order.paymentKey` 컬럼 추가, `PaymentAuditLog` 모델 + `PaymentEventSource` enum + 마이그레이션.
2. **도메인**: 조건부 상태 전이(design.md §2), 2단 멱등 방어(§3), 금액 대조(§4), 웹훅 서명 검증(§5).
3. **화면**: PG SDK 결제창 호출 버튼 + 완료 화면 조건부 렌더(§6). 새 화면 없음.

## §2. 기술적 접근 — 되돌리기 어려운 순으로

| 결정 | 내용 | design.md 위치 |
|---|---|---|
| 스키마 변경 범위 | `Order.paymentKey` 컬럼 1개 + `PaymentAuditLog` 신규 테이블. `OrderStatus` enum 무변경 | §1 |
| 결제-주문 관계 | 1:1이므로 별도 `Payment` 테이블 없이 `Order.paymentKey`로 표현 | §1.1 |
| 상태 전이 방식 | 조건부 `updateMany`(`where: status = 기대값`) — SPEC-ORDER-001의 재고 차감과 같은 패턴 | §2 |
| 리포지토리 분리 | `order-repository.ts`를 확장하지 않고 새 `payment-repository.ts`를 만든다 — 트랜잭션 경계가 다르기 때문 | §2.1 |
| 멱등성 | 조건부 전이(1차) + `PaymentAuditLog.transmissionId` unique(2차) | §3 |
| 금액 검증 | 상태 전이 전에 항상 `Order.totalAmount`와 대조 | §4 |
| 서명 검증 | raw body에 대한 HMAC-SHA256, 파싱 전에 먼저 검증 | §5 |
| 결제창 호출 지점 | 새 화면 없이 완료 화면에 버튼 하나 추가 | §6 |
| 환경변수 | `NEXT_PUBLIC_PG_CLIENT_KEY`(신규, 공개) + `PG_SECRET_KEY`/`PG_WEBHOOK_SECRET`(서버 전용) | §7 |

## §3. 마일스톤 (되돌리기 어려운 순)

### M1 — 데이터 모델 (가장 되돌리기 어려움)

- `prisma/schema.prisma`에 `Order.paymentKey String? @unique` 추가, `PaymentEventSource` enum·`PaymentAuditLog` 모델 추가.
- **`OrderStatus` enum은 건드리지 않는다**(§0 #2). `OrderItem`·기존 `Order` 컬럼도 무변경.
- 마이그레이션 생성.
- 산출물: `prisma/schema.prisma`, `prisma/migrations/*_add_payment_audit_log/migration.sql`
- 검증: `npm run prisma:validate`, 스키마 형태 단위 테스트. `Order`의 기존 필드 diff 0줄(신규 필드 1개 추가만 확인), `OrderStatus` enum diff 0줄 확인.

### M2 — 결제 리포지토리 및 서비스 (핵심 트랜잭션)

- `src/features/payments/types/payment.ts` — `PaymentEventSourceDTO`, 승인/웹훅 처리 결과 타입, 실패 코드 union(`AMOUNT_MISMATCH`·`ORDER_NOT_PENDING`·`PAYMENT_KEY_MISMATCH`·`CONFIRM_API_FAILED`).
- `src/features/payments/repositories/payment-repository.ts` — `Prisma.TransactionClient`를 받는 조건부 전이 함수 2개(`markOrderPaid`, `markOrderCancelledAndRestoreStock`) + `PaymentAuditLog` `create` 전용 함수 + `findAuditLogByTransmissionId`. **`update`/`delete`는 export하지 않는다**(design.md §1.2).
- `src/lib/payment/toss-server.ts` — 승인(confirm) API 호출 래퍼(Basic 인증, `PG_SECRET_KEY`)와 웹훅 서명 검증 함수(design.md §5). `next/*` 미의존.
- `src/features/payments/services/payment-service.ts` — `confirmPayment(orderId, paymentKey, amount)`(§2 조건부 전이 + §4 금액 대조 오케스트레이션), `processWebhook(rawBody, headers)`(서명 검증 → 이벤트 파싱 → 금액 대조 → 조건부 전이 → 멱등 판정).
- 검증: 리포지토리 단위 테스트(Prisma 클라이언트 모킹) + 서비스 단위 테스트(정상 승인/금액 불일치/이미 처리됨/재전송/취소/재고 복원 각각).

### M3 — API 라우트

- `src/app/api/payments/confirm/route.ts` — `GET`. 쿼리 파라미터(`paymentKey`·`orderId`·`amount`) 파싱 → `confirmPayment()` 호출 → 완료 화면으로 리다이렉트(성공 시 그대로, 실패 시 `?payment_failed=1`).
- `src/app/api/payments/webhook/route.ts` — `POST`. `request.text()`로 raw body를 먼저 읽고 `processWebhook()`에 위임 → 결과에 따라 200/401.
- 검증: 라우트 단위 테스트(서비스 모킹) — 리다이렉트 목적지, 상태 코드, raw body가 파싱 전에 서명 검증에 쓰이는지 확인.

### M4 — 결제창 UI 및 완료 화면 EXTEND

- `src/lib/payment/toss-client.ts` — 브라우저 SDK 로더/초기화 래퍼(`NEXT_PUBLIC_PG_CLIENT_KEY`). 정확한 SDK 패키지명·버전은 이 단계에서 공식 문서 재확인 후 확정(design.md §9).
- `src/components/checkout/PayButton.tsx` — `"use client"`. `requestPayment()` 호출만, 인가·검증 로직 없음.
- `src/app/checkout/complete/[orderId]/page.tsx` — **EXTEND(SPEC-ORDER-001 소유 파일)**. `order.status` 조건부 안내 문구 3분기 + `pending_payment`일 때 `<PayButton>` 렌더 + `?payment_failed=1` 재시도 배너. **게스트 쿠키 읽기·대조·`notFound()` 로직은 한 글자도 바꾸지 않는다.**
- 검증: 컴포넌트 테스트(상태 3분기 렌더, 버튼 존재/부재, 재시도 배너) + 인가 로직 diff 0줄 확인(git diff로 해당 함수 블록 무변경 검증).

### M5 — 환경변수·문서·통합 테스트

- `.env.example`에 `PG_SECRET_KEY`·`PG_WEBHOOK_SECRET`·`NEXT_PUBLIC_PG_CLIENT_KEY` 추가.
- `package.json`에 Toss SDK 의존성 추가(M4에서 확정한 패키지명).
- `tests/integration/payments/webhook-flow.test.ts` — 인메모리 fake로 승인→웹훅 재전송→취소 전체 경로 구동.
- 커버리지 임계값(lines 85 / functions 85 / branches 80 / statements 85) 유지 확인.

## §4. 변경하지 않는 것 (불변 조건)

run-phase에서 아래 파일을 **수정하지 않는다**. 예외는 없다 — SPEC-ORDER-001이 소비 계약으로 지목한 완료 화면(§4.1)조차 "EXTEND"이지 이 목록의 예외가 아니라, 아래 §4.1이 그 EXTEND의 경계를 별도로 좁게 못 박는다.

- `src/features/orders/repositories/order-repository.ts`, `src/features/orders/services/order-service.ts`, `src/features/orders/types/order.ts` — 이 SPEC은 이 파일들을 **읽지도** 확장하지도 않는다. 필요한 조회(주문 조회, 금액 대조)는 `payment-repository.ts`가 자체 Prisma 질의로 수행한다(design.md §2.1).
- `src/app/api/orders/route.ts`, `src/app/checkout/page.tsx` — 무변경.
- `src/features/cart/**` — 무변경.
- `src/lib/auth/**` — 무변경.
- `prisma/schema.prisma`의 `Order` 기존 컬럼, `OrderItem`, `OrderStatus` enum 값 — 무변경(신규 컬럼 1개 추가만 허용, §0 #2).

### §4.1 유일한 예외 — 완료 화면의 좁은 EXTEND

`src/app/checkout/complete/[orderId]/page.tsx`는 이 SPEC이 수정하는 **유일한 SPEC-ORDER-001 소유 파일**이다. 허용된 변경은 정확히 세 가지로 한정한다.

| 변경 | 허용 여부 |
|---|---|
| `order.status`에 따른 안내 문구 조건 분기(3가지: pending/paid/cancelled) | 허용 |
| `pending_payment`일 때 `<PayButton>` 렌더 | 허용 |
| `?payment_failed=1` 쿼리 존재 시 재시도 배너 렌더 | 허용 |
| 게스트 쿠키 읽기·대조·`notFound()` 판정 로직 | **금지 — 무변경** |
| `getOrderForGuest()` 호출 방식·인자 | **금지 — 무변경** |

경계 조건(acceptance.md §4 DoD 항목):

- 위 세 가지 **외의 변경은 없다**.
- 인가 관련 코드 블록(쿠키 읽기 ~ `getOrderForGuest` 호출 ~ `notFound()` 분기)의 diff가 0줄이어야 한다.

이 범위를 넘는 변경이 필요해지면 §4 본문의 원칙대로 **멈추고 보고한다**.

## §5. 위험

| 위험 | 영향 | 완화 |
|---|---|---|
| 실 PostgreSQL 부재로 조건부 전이의 실제 직렬화 미검증 | 핵심 주장(이중 전이 방지)이 자동 검증되지 않음 | acceptance.md §0에서 관측 가능/불가능 분류 |
| Toss SDK 패키지명·버전 미확정 | M4에서 재확인 필요 | 인터페이스(파라미터 이름)는 이미 확정되어 있어 어댑터 내부만 영향 |
| `tech.md`의 `PG_API_KEY` 항목과 실제 변수명 불일치 | 문서 신뢰도 저하 | sync 단계에서 `tech.md` 갱신을 후속 작업으로 명시 남김(§0 #7) |
| 완료 화면 EXTEND가 SPEC-ORDER-001의 인가 경계를 실수로 넘음 | 회원/타인 주문 노출 재발 위험 | §4.1의 좁은 허용 목록 + diff 0줄 확인을 DoD에 명시 |
| 웹훅 서명 검증을 우회하는 사설 페이로드 주입 | 임의 상태 조작 | REQ-PAYMENT-011/012가 서명 검증을 모든 처리보다 앞에 두도록 강제, raw body 기준 검증(design.md §5) |
| 웹훅과 승인 API가 다른 `paymentKey`를 보고(주문 id 재사용·오류) | 다른 결제 건이 한 주문에 섞임 | `Order.paymentKey`의 `@unique` + REQ-PAYMENT-004의 불일치 거부 |

## §6. 안티패턴 (하지 말 것)

- `order-repository.ts`/`order-service.ts`에 결제 전이 함수를 추가하지 말 것 — 트랜잭션 경계가 다르다(design.md §2.1).
- 웹훅 payload를 `request.json()`으로 먼저 파싱한 뒤 서명을 검증하지 말 것 — raw body가 서명 검증의 유일한 근거다(design.md §5).
- 조건부 전이의 `count !== 1`을 오류로 취급해 예외를 던지지 말 것 — 그것은 "이미 처리됨"이라는 정상 신호다(design.md §2).
- 방치된 미결제 주문의 시간 기반 재고 해제를 이 SPEC에 슬쩍 끼워 넣지 말 것 — §0 #4가 이미 제외했다.
- 완료 화면의 게스트 인가 로직을 "결제 상태를 더 잘 보여주려고" 건드리지 말 것 — §4.1의 경계 위반이다.
- `PG_API_KEY`라는 이름을 되살리지 말 것 — 노출 범위가 이름과 어긋난다(§0 #7).
- 새 `OrderStatus` 값을 결제 실패 표현을 위해 추가하지 말 것 — §0 #2가 이미 제외했다.

## §7. 교차 참조

- spec.md — 요구사항 REQ-PAYMENT-001~020, Out of Scope
- research.md — Toss Payments 공식 문서 인용, 저장소 현재 상태, 환경변수 이름 불일치 조사
- design.md — 스키마·조건부 전이·멱등성·서명 검증·UI 설계
- acceptance.md — AC-PAYMENT-001~020 및 검증 수단 경계
- SPEC-ORDER-001 REQ-ORDER-019 — 이 SPEC이 인수한 유예 책임의 출처
- SPEC-ORDER-001 `/checkout/complete/[orderId]` — 이 SPEC의 유일한 EXTEND 대상
