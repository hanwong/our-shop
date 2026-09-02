---
id: SPEC-PAYMENT-001
status: draft
updated: 2026-09-02
tier: L
---

# Design: SPEC-PAYMENT-001 — 결제 도메인 설계 (게스트 전용)

되돌리기 가장 어려운 결정부터 배열한다. 데이터 모델 → 트랜잭션/조건부 전이 → 멱등성 → 금액 검증 → 웹훅 재확인(Toss 결제 조회) → UI → 환경변수 → 실패 응답 → 잔여 위험 순이다.

> **범위 전제**: 이 SPEC이 다루는 모든 주문은 SPEC-ORDER-001이 만든 게스트 전용 주문이다. 회원 결제 경로는 다루지 않는다(spec.md §3).

## §1. Prisma 모델 변경 (되돌리기 가장 어려움)

```prisma
model Order {
  // ...SPEC-ORDER-001의 기존 컬럼 전부 무변경...

  // 이 SPEC이 추가하는 유일한 컬럼. 하나의 주문을 최대 하나의 PG 결제 건에
  // 귀속시킨다(REQ-PAYMENT-004). 승인 또는 웹훅이 처음 이 주문을 확정할 때
  // 값이 채워지며, 이후 다른 paymentKey를 가진 이벤트를 거부하는 근거가 된다.
  paymentKey String? @unique

  auditLogs PaymentAuditLog[]
}

enum PaymentEventSource {
  CONFIRM_API   // 성공 리다이렉트 → 승인(confirm) API 호출 경로
  WEBHOOK       // PAYMENT_STATUS_CHANGED 웹훅 경로
}

model PaymentAuditLog {
  id             String             @id @default(cuid())
  orderId        String
  order          Order              @relation(fields: [orderId], references: [id], onDelete: Restrict)

  source         PaymentEventSource
  previousStatus OrderStatus
  newStatus      OrderStatus
  paymentKey     String?

  // 웹훅 재전송 멱등성의 2차 방어선(§3). confirm 경로 이벤트는 이 값이 없다.
  transmissionId String?            @unique

  createdAt      DateTime           @default(now())

  @@index([orderId])
}
```

### §1.1 `paymentKey`를 `Order`에 두는 이유 (별도 `Payment` 테이블을 두지 않는 이유)

이 SPEC은 결제 건을 표현하기 위한 별도 `Payment` 모델을 만들지 않는다. 하나의 주문이 최대 하나의 결제 건에만 대응하므로(1:1), `paymentKey` 컬럼 하나로 그 관계 전부를 표현할 수 있다. 별도 테이블을 두면 `Order`와 `Payment`가 항상 1:1이라는 불변식을 애플리케이션 코드가 지켜야 하는데, 그 불변식을 스키마의 `@unique` 하나가 대신 지켜 줄 수 있다면 테이블을 늘릴 이유가 없다(Enforce Simplicity — 아래 조건부 갱신 자체가 이 컬럼 하나로 충분하다).

### §1.2 `PaymentAuditLog`를 append-only로 강제하는 방법

Prisma/PostgreSQL 수준의 `UPDATE`/`DELETE` 금지 트리거는 이 SPEC의 범위 밖이다(운영 DB 정책은 별도 관심사). 대신 애플리케이션 계층에서 **`payment-repository.ts`가 `PaymentAuditLog`에 대해 `create`만 export하고 `update`/`delete`는 export하지 않는다** — cart-repository.ts가 소유권 질의를 한곳에 모아 둔 것과 같은 원칙이다. `@MX:ANCHOR`로 이 제약을 코드에 남긴다(plan.md §4).

### §1.3 `OrderStatus`에 새 값을 추가하지 않는 이유

SPEC-ORDER-001이 이미 `paid`·`cancelled`를 예약해 두었다(스키마 주석: "reserved for the follow-up payment SPEC"). 이 SPEC은 그 자리를 채우는 것이지 새로 만드는 것이 아니다. 결제 실패·중단에 대해서도 새 값을 만들지 않는다 — 실패는 "상태가 없는 상태", 즉 `pending_payment` 그대로이며, 그것이 재시도를 가능하게 하는 정확한 표현이다(REQ-PAYMENT-009/010).

## §2. 조건부 전이 — 두 경로가 경쟁해도 한 번만 반영된다 (REQ-PAYMENT-007/013/014/017)

승인(confirm) 경로와 웹훅 경로는 **둘 다 `pending_payment → paid`에 도달할 수 있는 별개의 트리거**다(research.md §4). 두 트리거가 거의 동시에 도착해도 전이가 두 번 일어나서는 안 되므로, SPEC-ORDER-001의 재고 차감이 쓴 것과 같은 조건부 `updateMany` 패턴을 상태 전이에 그대로 적용한다.

```ts
// pending_payment -> paid (승인 경로·DONE 웹훅 공통)
const updated = await tx.order.updateMany({
  where: { id: orderId, status: "pending_payment" },
  data: { status: "paid", paymentKey },
});
if (updated.count !== 1) {
  // count !== 1 자체는 "이 호출로는 아무 것도 바뀌지 않았다"만을 뜻한다 — 그 원인이
  // "이미 처리됨(멱등)"인지 "진짜 불일치(REQ-PAYMENT-004)"인지는 재조회 없이는
  // 구별되지 않는다. 판정 절차는 §3.1을 따른다.
}
```

```ts
// paid -> cancelled (취소 웹훅), 재고 복원과 한 트랜잭션
await prisma.$transaction(async (tx) => {
  const updated = await tx.order.updateMany({
    where: { id: orderId, status: "paid" },
    data: { status: "cancelled" },
  });
  if (updated.count !== 1) return; // 이미 cancelled이거나 아직 paid가 아님 — 아무 것도 하지 않는다
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
  await tx.paymentAuditLog.create({ data: { /* ... */ } });
});
```

`count !== 1`은 실패가 아니라 **"이미 처리되었다"는 관측 가능한 신호**다 — SPEC-ORDER-001의 `decrementStockIfAvailable`이 `count`를 그대로 답으로 쓴 것과 같은 원칙이다.

### §2.1 왜 `order-repository.ts`를 확장하지 않고 새 `payment-repository.ts`를 만드는가

`src/features/orders/repositories/order-repository.ts`는 SPEC-ORDER-001이 소유한 파일이며, 그 파일의 모든 쓰기 함수는 `Prisma.TransactionClient`를 인자로 받아 **주문 생성 트랜잭션의 원자성**을 지키는 데만 쓰인다(그 파일 자신의 주석). 결제 상태 전이는 다른 트랜잭션 경계(주문 생성이 끝난 한참 뒤, 별개의 요청)에서 일어나므로 그 파일에 함수를 추가하면 "이 파일의 모든 쓰기는 주문 생성 트랜잭션 안에서만 일어난다"는 그 파일 자신의 불변식이 깨진다. 대신 `src/features/payments/repositories/payment-repository.ts`를 새로 만들어 `Order.status`·`Order.paymentKey`에 대한 조건부 갱신과 `PaymentAuditLog` 쓰기를 전담시킨다. 결과적으로 **`src/features/orders/**`는 이 SPEC에서 diff 0줄**이다(plan.md §4).

## §3. 멱등성 — 2단 방어 (REQ-PAYMENT-016/017)

| 방어선 | 무엇을 막는가 | 구현 |
|---|---|---|
| 1차 — 조건부 전이 | 승인 경로와 웹훅 경로가 같은 시각에 도착해 둘 다 전이를 시도하는 경우 | §2의 `updateMany` `count` 판정. 뒤늦은 쪽은 `count === 0`을 받고 아무 것도 쓰지 않는다 |
| 2차 — `transmissionId` unique | 같은 웹훅 이벤트가 PG에 의해 재전송되는 경우(응답 지연·타임아웃) | `PaymentAuditLog.transmissionId`의 `@unique` 제약. 먼저 처리된 이벤트가 이미 그 값으로 행을 남겼다면, 재전송된 이벤트는 **처리 로직을 다시 실행하기 전에** 그 값으로 조회해 "이미 처리됨"을 확인하고 재고를 다시 되돌리지 않는다 |

두 방어선의 역할이 다르다는 점이 중요하다 — 1차는 "동시에 도착한 서로 다른 트리거"를 가려내고, 2차는 "같은 트리거의 중복 배달"을 가려낸다. 어느 한쪽만으로는 두 경우를 모두 막지 못한다(예: 재전송된 웹훅은 `orderId`·`status`가 완전히 같아 조건부 전이만으로는 "이미 처리됨"과 "이번이 처음"을 구별할 수 없다 — `transmissionId`가 있어야 구별된다).

응답은 PG에게 항상 처리 성공(2xx)으로 답한다 — 재전송이 감지되어 아무 것도 하지 않은 경우도 "성공적으로 처리했다(그리고 중복이었다)"는 뜻이므로 실패로 응답하면 PG가 불필요한 재재전송을 계속하게 된다.

### §3.1 `count !== 1`의 두 가지 원인을 가르는 판정 절차 (REQ-PAYMENT-004/016/017)

§2의 조건부 `updateMany`가 `count !== 1`을 반환하는 원인은 두 가지이며, 서로 반대되는 처리(로그 여부)를 요구하므로 재조회로 반드시 구별해야 한다:

1. **이미 다른 트리거가 먼저 반영함(멱등, REQ-PAYMENT-016/017)** — 승인 경로와 웹훅 경로가 같은 이벤트를 거의 동시에 처리하려 한 경우.
2. **진짜 `paymentKey` 불일치(REQ-PAYMENT-004)** — 이미 다른 `paymentKey`로 귀속된 주문에 그와 다른 `paymentKey`를 가진 이벤트가 도착한 경우.

판정 절차:

```ts
if (updated.count !== 1) {
  const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (current.paymentKey === incomingPaymentKey) {
    // 이미 같은 paymentKey로 반영되어 있다 — 다른 트리거가 먼저 처리한 것뿐이다.
    // 멱등 무시: 로그를 남기지 않고 그대로 성공 응답한다(REQ-PAYMENT-016/017).
    return { outcome: "already-applied" };
  }
  // 현재 paymentKey가 이번 이벤트의 것과 다르다 — 진짜 불일치다.
  // 거부 + PaymentAuditLog 기록(REQ-PAYMENT-004).
  await tx.paymentAuditLog.create({ data: { /* 불일치 사실 */ } });
  return { outcome: "payment-key-mismatch" };
}
```

이 분기는 §2 조건부 갱신 코드의 주석이 가리키는 절차이며, `payment-repository.ts`의 공통 헬퍼로 구현되어 승인 경로·웹훅 경로 양쪽에서 재사용된다.

## §4. 금액 검증 (REQ-PAYMENT-006/015)

승인 경로와 웹훅 경로 모두, **상태를 바꾸기 전에** 이벤트가 실어 온 금액을 `Order.totalAmount`와 대조한다. 대조 실패 시:

- 승인 경로: 승인 API 자체를 호출하지 않는다(REQ-PAYMENT-006) — 애초에 서버가 알고 있는 금액과 다른 리다이렉트라면, 그 리다이렉트가 진짜 Toss가 보낸 것인지도 아직 확인되지 않은 상태이므로 확인 API 호출로 신뢰를 확장하지 않는다.
- 웹훅 경로: 상태를 전이시키지 않고 `PaymentAuditLog`에 불일치 사실을 남긴다(REQ-PAYMENT-015) — 서명은 유효하지만 금액이 다른 웹훅은 PG 쪽 데이터 이상이거나 공격 시도일 수 있으므로, 침묵하지 않고 기록해 나중에 조사할 수 있게 한다.

이 원칙은 SPEC-ORDER-001의 REQ-ORDER-014(확인 금액은 지시가 아니라 대조용 입력)와 정확히 같은 모양이다 — 이 SPEC은 그 원칙을 외부 시스템이 보내는 금액에도 동일하게 적용한다.

## §5. 웹훅 재확인 — Toss 결제 조회 API (REQ-PAYMENT-011/012)

**정정(CodeRabbit PR #9 리뷰 Finding 1)**: 이전 버전의 이 절은 HMAC-SHA256 서명 검증을 설계했으나, `PAYMENT_STATUS_CHANGED` 웹훅에는 `tosspayments-webhook-signature` 헤더가 애초에 실려 오지 않는다(그 헤더는 `payout.changed`·`seller.changed` 전용 — research.md §4 정정 참조). 아래는 Toss 공식 문서가 이 이벤트 타입에 권고하는 검증 방식으로 재설계된 흐름이다.

```
POST /api/payments/webhook
  ├─ raw body 읽기 (request.text())
  ├─ §3의 2차 방어(transmissionId 조회) — 먼저 실행, 재전송을 파싱·조회 이전에 차단
  ├─ JSON.parse — payload에서 paymentKey만 추출 (다른 필드는 아직 신뢰하지 않음)
  ├─ Toss 결제 조회 API 호출: GET /v1/payments/{paymentKey}, Basic 인증(PG_SECRET_KEY,
  │    confirm API와 동일한 시크릿)
  │    ├─ 호출 실패(네트워크 오류·타임아웃·비-2xx) → 처리 중단, 502(재시도 유도)
  │    └─ 조회된 기록의 orderId ≠ payload의 orderId → 처리 중단, 400(불일치)
  ├─ 조회된 기록의 orderId로 주문 조회
  ├─ §4(금액 대조 — 조회된 기록의 totalAmount 사용) → §2(조건부 전이 — 조회된 기록의
  │    status·paymentKey 사용)
  └─ CANCELED 전이 직전에는 추가로 조회된 기록의 paymentKey가 주문에 저장된
       paymentKey와 일치하는지 대조한다 — 불일치 시 취소를 적용하지 않는다.
```

**payload 자신이 주장하는 값은 어디에도 신뢰의 근거로 쓰이지 않는다** — `paymentKey`는 오직 "어느 결제를 조회할지"를 가리키는 색인일 뿐이고, 그 이후의 모든 판단(주문 식별, 금액, 상태)은 Toss 서버 자신이 되돌려준 조회 결과에서만 나온다. 이것이 서명이 없는 이벤트 타입에서도 웹훅을 신뢰할 수 있게 만드는 유일한 근거다 — 누구든 임의의 `POST`로 페이로드를 조작할 수 있지만, Toss의 결제 조회 API 응답 자체는 조작할 수 없다.

## §6. UI — 결제 시작 버튼과 완료 화면 조건부 렌더 (research.md §2·§6)

```
/checkout/complete/[orderId]   서버 컴포넌트 (SPEC-ORDER-001 소유, 이 SPEC이 EXTEND)
  ├─ status === "pending_payment" → 기존 안내 문구 + <PayButton orderId totalAmount />
  ├─ status === "paid"            → "결제가 완료되었습니다" 안내 (새 문구)
  ├─ status === "cancelled"       → "이 주문은 취소되었습니다" 안내 (새 문구)
  └─ ?payment_failed=1 쿼리 존재 && status === "pending_payment"
                                  → 위 문구 위에 재시도 안내 배너 추가(REQ-PAYMENT-009)
     ※ status가 "paid" 또는 "cancelled"이면 ?payment_failed=1이 있어도 배너를 표시하지 않는다
       (상태 우선 원칙 — 실제 저장된 상태가 쿼리 파라미터보다 우선한다. acceptance.md AC-PAYMENT-009 참조)

<PayButton>                      "use client" — Toss SDK 결제창 호출만
  └─ onClick → SDK.requestPayment({ orderId, amount: totalAmount, orderName,
                                     successUrl: "/api/payments/confirm",
                                     failUrl: "/checkout/complete/{orderId}?payment_failed=1" })
```

### §6.1 `orderName` 도출 규칙 (REQ-PAYMENT-005)

`orderName`은 `Order` 테이블의 컬럼이 아니다 — `OrderItem[]`으로부터 매 호출 시 계산되는 파생값이다. 도출 규칙:

```ts
function buildOrderName(items: OrderItem[]): string {
  const first = items[0].productName;
  return items.length > 1 ? `${first} 외 ${items.length - 1}건` : first;
}
```

- 항목이 하나뿐이면 상품명 그대로(`"머그컵"`), 둘 이상이면 국내 이커머스 관례인 "외 N건" 접미사를 붙인다(`"머그컵 외 2건"`).
- 이 값은 완료 화면 서버 컴포넌트가 이미 로드해 둔 주문 요약(`Order.items`)에서 계산되며, 별도 조회나 스키마 변경이 필요 없다.
- `<PayButton>`은 이 값을 그대로 prop으로 전달받아 SDK 호출에 넘길 뿐, 계산 로직을 갖지 않는다(순수 UI 원칙, §6 본문).



- **인가 로직은 건드리지 않는다.** 게스트 쿠키 대조는 이 화면이 이미 하고 있으므로(SPEC-ORDER-001 §6.3), `PayButton`은 이미 인가된 화면 안에 얹히는 순수 UI다.
- **`failUrl`은 별도 서버 라우트가 아니다.** 결제창 실패·중단 시점에는 PG 쪽에서 확정할 것이 없으므로(결제가 아예 성사되지 않음), 서버 호출 없이 곧바로 완료 화면으로 쿼리 파라미터를 붙여 되돌아간다(research.md §2 대안 표에서 검토한 "새 화면"과 다른 결정 — 여기서는 "새 서버 라우트"를 만들지 않는 결정이다).
- **`successUrl`은 서버 라우트다.** 승인 여부가 아직 확정되지 않았으므로 반드시 서버가 대조 → 확인 API 호출을 거쳐야 한다(§2, §4).

## §7. 환경변수 (research.md §5의 결정 반영)

| 변수 | 노출 범위 | 용도 |
|---|---|---|
| `PG_SECRET_KEY` | 서버 전용 | 승인(confirm) API + 결제 조회(Payment Query) API 호출 시 Basic 인증(§5) |
| `NEXT_PUBLIC_PG_CLIENT_KEY` | **클라이언트 노출(설계상 공개 키)** | 브라우저 SDK 초기화 |

**정정(CodeRabbit PR #9 리뷰 Finding 1)**: `PG_WEBHOOK_SECRET`은 더 이상 쓰이지 않는다 — §5 정정에서 확인했듯 웹훅 서명 헤더 자체가 이 SPEC의 이벤트 타입에는 존재하지 않으므로, 그 시크릿으로 검증할 대상이 없다. `.env.example`에서 제거했다.

`tech.md`가 예고한 `PG_API_KEY`라는 이름은 재사용하지 않는다 — research.md §5에서 확인했듯 그 이름이 가리키는 값(Toss의 클라이언트 키)은 원래 공개 키이므로, 노출 범위를 이름에 정직하게 반영하는 `NEXT_PUBLIC_` 접두사가 필요하다. `PG_SECRET_KEY`는 `tech.md`가 이미 서버 전용으로 규정한 대로 그대로 쓴다(REQ-PAYMENT-018).

## §8. 실패 응답 형태

| 상황 | 상태 | 본문/동작 |
|---|---|---|
| 승인 리다이렉트 금액 불일치 (REQ-PAYMENT-006) | 확인 API 호출 안 함, 완료 화면으로 `?payment_failed=1` 리다이렉트 | — |
| 승인 API 호출 실패/거부 (REQ-PAYMENT-008) | 완료 화면으로 `?payment_failed=1` 리다이렉트 | 주문 상태 무변경 |
| 대상 주문이 이미 `pending_payment`가 아님 (REQ-PAYMENT-008) | 완료 화면으로 정상 리다이렉트(이미 처리된 결제이므로 오류로 취급하지 않음) | — |
| 웹훅 결제 조회 API 호출 자체가 실패 (REQ-PAYMENT-012, **정정**) | 502(일시적 — PG 재시도 유도) | 처리 없음, 로그 없음 |
| 웹훅 조회 기록이 payload의 orderId와 불일치 (REQ-PAYMENT-012, **정정**) | 400 | 처리 없음, 로그 없음 |
| 웹훅 payload가 JSON으로 파싱되지 않음 | 400 | 처리 없음, 로그 없음 |
| 웹훅 금액 불일치 (REQ-PAYMENT-015) | 200(PG에게는 수신 확인) | `PaymentAuditLog`에 불일치 사실 기록, 전이 없음 |
| 웹훅 재전송(이미 처리됨) (REQ-PAYMENT-016) | 200 | 처리 없음(멱등) |
| `paymentKey` 불일치 (REQ-PAYMENT-004) | 승인 경로: 확인 API 호출 안 함 / 웹훅 경로: 200(수신 확인), 전이 없음 | `PaymentAuditLog`에 불일치 사실 기록 |
| 웹훅 `PARTIAL_CANCELED` (이 SPEC 범위 밖의 부분 취소) | 200(수신 확인) | `PaymentAuditLog`에 무전이 기록만 남김(REQ-PAYMENT-014, **정정**) — 전체 취소 경로로 라우팅하지 않음 |

## §9. 남은 위험

| 위험 | 성격 | 완화 |
|---|---|---|
| 조건부 전이·웹훅 재확인의 실제 동시성 동작을 실 PostgreSQL 없이 검증 못함 | 하네스 한계(SPEC-ORDER-001과 동일) | acceptance.md §0에서 관측 가능/불가능 분류. 초록불을 동시성의 증거로 제시하지 않는다 |
| Toss SDK의 정확한 npm 패키지명·버전은 이 문서에서 확정하지 않음 | 조사 시점 정보 한계 | M4에서 공식 문서를 재확인해 확정한다. 인터페이스(요청 파라미터 이름)는 이미 확정되어 있으므로 어댑터 내부 구현만 영향받는다 |
| `tech.md`의 `PG_API_KEY` 항목이 이 SPEC의 실제 변수명과 불일치 | 문서-현실 불일치(research.md §5) | sync 단계에서 `tech.md` 갱신을 후속 작업으로 남긴다. plan-phase 문서는 이 불일치를 숨기지 않고 명시했다 |
| 완료 화면 EXTEND가 SPEC-ORDER-001의 게스트 인가 로직에 실수로 손을 대는 경우 | 스코프 침범 위험 | plan.md §4가 EXTEND 대상을 "안내 문구 조건 분기 + `<PayButton>` 추가"로 좁히고, 인가 관련 코드(쿠키 읽기·대조·`notFound()`)의 diff 0줄을 acceptance.md DoD에서 확인한다 |
