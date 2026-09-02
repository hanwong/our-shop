---
id: SPEC-PAYMENT-001
status: completed
updated: 2026-09-02
tier: L
---

# Acceptance Criteria: SPEC-PAYMENT-001 — PG 결제 연동과 승인·취소 웹훅 처리

Tier L — AC 상한 25개 이내(현재 20개). 각 항목은 REQ-PAYMENT-XXX 하나 이상을 검증하며, 통과/실패가 이분법으로 판정 가능해야 한다.

## §0. 검증 수단의 경계 (읽기 전에)

이 SPEC의 핵심 주장 중 하나는 **조건부 전이에 의한 이중 반영 방지**(REQ-PAYMENT-017)인데, SPEC-ORDER-001과 같은 이유로 이 저장소에는 **살아 있는 PostgreSQL이 없다**(SPEC-ORDER-001 research.md §5). 순차 요청으로 관측 가능한 부분과, 실제 동시 도착·행 잠금이 있어야만 관측 가능한 성질을 아래처럼 분리한다.

| 분류 | 의미 | 해당 항목 |
|---|---|---|
| **하네스 관측 가능** | vitest(node) + 인메모리 fake + 정적 소스 검사로 판정 | 대부분의 AC |
| **실 DB 필요 — 자동 DoD 제외** | 살아 있는 PostgreSQL에서만 관측 가능 | `AC-004-EXCL-CONCURRENCY` |

### 이름 붙은 제외 항목

| 제외 ID | 소속 AC | 관측 불가능한 것 |
|---|---|---|
| `AC-004-EXCL-CONCURRENCY` | AC-PAYMENT-004 | 승인 경로와 웹훅 경로가 **정말로 동시에** 도착했을 때 조건부 `updateMany`가 실제 행 잠금으로 직렬화되는 것. 순차 재현(먼저 하나를 반영한 뒤 두 번째를 호출)으로는 "조건부 갱신 형태로 작성되었고 `count !== 1`이면 무시한다"까지만 판정된다 |

## §1. Given-When-Then 시나리오

### 데이터 모델 및 불변식

**AC-PAYMENT-001** — 모든 전이가 감사 로그 한 건을 남긴다 (REQ-PAYMENT-001)
- Given: `pending_payment` 상태의 주문과, 그 주문에 대해 유효한 승인 이벤트
- When: 승인을 처리한다
- Then: `PaymentAuditLog`가 정확히 1건 생성되고, `orderId`·`previousStatus === "pending_payment"`·`newStatus === "paid"`·`source === "CONFIRM_API"`·`createdAt`이 채워져 있다.
- 검증 수단: fake DB에 기록된 행 검사.

**AC-PAYMENT-002** — 감사 로그는 갱신·삭제되지 않는다 (REQ-PAYMENT-002)
- Given: `PaymentAuditLog` 행이 1건 존재한다
- When: `payment-repository.ts`의 export 목록을 정적 검사한다
- Then: `update`·`delete`·`upsert` 계열 함수가 `PaymentAuditLog`에 대해 export되어 있지 않다.
- 검증 수단: 정적 소스 검사(export 이름 전수 검사).

**AC-PAYMENT-003** — 새 `OrderStatus` 값이 추가되지 않는다 (REQ-PAYMENT-003)
- Given: 이 SPEC이 추가·수정한 전체 산출물
- When: `prisma/schema.prisma`의 `OrderStatus` enum을 정적 검사한다
- Then: 값이 `pending_payment`·`paid`·`cancelled` 세 개 그대로이고, git diff가 0줄이다.
- 검증 수단: 정적 소스 검사 + git diff.

**AC-PAYMENT-004** — 하나의 주문은 최대 하나의 `paymentKey`에만 귀속된다 (REQ-PAYMENT-004)
- Given: `paymentKey: "PK1"`로 이미 `paid`가 된 주문
- When: 같은 주문 id에 대해 `paymentKey: "PK2"`인 웹훅 이벤트를 처리한다
- Then: 주문 상태·`paymentKey`가 변하지 않고, `PaymentAuditLog`에 불일치 사실이 기록되며, 응답은 PG에게 여전히 200이다.
- 검증 수단: fake DB 스냅샷 비교.
- **실 DB 필요 — 자동 DoD 제외 · `AC-004-EXCL-CONCURRENCY`**: 승인 경로와 웹훅 경로가 진짜 동시에 도착하는 경우의 직렬화는 실 DB에서만 관측된다(§0).

### 승인(confirm) 흐름

**AC-PAYMENT-005** — 결제 시작이 올바른 파라미터로 SDK를 호출한다 (REQ-PAYMENT-005)
- Given: `pending_payment` 상태의 주문 요약(`orderId`, `totalAmount`, 항목 `[{productName: "머그컵"}, {productName: "텀블러"}]`)을 가진 완료 화면
- When: `<PayButton>`을 클릭한다(SDK 호출을 스파이로 대체)
- Then: `requestPayment`가 그 주문의 `orderId`·`totalAmount`와 함께 `orderName: "머그컵 외 1건"`을 인자로 호출된다(design.md §6.1 도출 규칙).
- 검증 수단: jsdom + Testing Library, SDK 모킹.

**AC-PAYMENT-006** — 리다이렉트 금액 불일치 시 확인 API를 호출하지 않는다 (REQ-PAYMENT-006)
- Given: `Order.totalAmount === 30000`인 주문
- When: 성공 리다이렉트가 `amount: 25000`으로 도착한다
- Then: 확인(confirm) API 호출이 발생하지 않고, 완료 화면으로 `?payment_failed=1`과 함께 리다이렉트되며, 주문 상태는 무변경이다.
- 검증 수단: 확인 API 호출 스파이 미호출 단언 + 리다이렉트 목적지 단언 + fake DB 스냅샷 비교.

**AC-PAYMENT-007** — 금액이 일치하면 승인 후 `paid`로 전이한다 (REQ-PAYMENT-007)
- Given: `Order.totalAmount === 30000`, 상태 `pending_payment`
- When: `amount: 30000`인 리다이렉트가 도착하고 확인 API가 성공을 반환한다
- Then: 주문 상태가 `paid`가 되고 `paymentKey`가 채워지며, `PaymentAuditLog` 1건이 남는다.
- 검증 수단: fake DB 상태 단언 + AC-PAYMENT-001과 동일 판정.

**AC-PAYMENT-008** — 확인 API 실패 또는 이미 처리된 주문은 상태를 바꾸지 않는다 (REQ-PAYMENT-008)
- Given: (i) 확인 API가 실패(네트워크 오류)를 반환하는 상태의 주문, (ii) 이미 `paid`인 주문에 대해 다시 도착한 성공 리다이렉트
- When: 각각 승인 처리를 수행한다
- Then: (i) 주문은 `pending_payment` 그대로이고 재시도 가능함을 알리는 오류가 반환된다. (ii) 주문 상태는 그대로 `paid`이고 오류 없이 완료 화면으로 리다이렉트되며 `PaymentAuditLog`가 추가로 생기지 않는다.
- 검증 수단: fake DB 스냅샷 비교(전후) + 응답 단언.

### 결제 실패·중단

**AC-PAYMENT-009** — 실패 경로 도착 시 재시도 가능, 단 실제 상태가 우선한다 (REQ-PAYMENT-009)
- Given (i): `pending_payment` 상태의 주문
- When (i): failUrl(`/checkout/complete/{orderId}?payment_failed=1`)로 되돌아온다
- Then (i): 주문 상태가 여전히 `pending_payment`이고, 완료 화면이 재시도 배너와 `<PayButton>`을 함께 렌더한다.
- Given (ii): 이미 `paid`로 전이된 주문(예: 승인 API는 응답이 지연·타임아웃되었으나, 웹훅이 먼저 `DONE`을 보고해 `paid`로 전이시킨 뒤 브라우저가 뒤늦게 failUrl로 되돌아오는 경우)
- When (ii): 같은 주문에 대해 `?payment_failed=1` 쿼리를 가진 완료 화면 요청이 도착한다
- Then (ii): 완료 화면은 재시도 배너를 표시하지 않고 "결제가 완료되었습니다" 안내를 렌더한다 — 저장된 실제 상태(`paid`)가 쿼리 파라미터보다 우선한다(design.md §6 상태 우선 원칙).
- 검증 수단: jsdom + Testing Library 렌더 단언(양쪽 케이스) + fake DB 상태 확인.

**AC-PAYMENT-010** — 새 상태값이 추가되지 않는다 (REQ-PAYMENT-010)
- Given: 이 SPEC이 추가·수정한 전체 산출물
- When: 소스 전체를 정적 검사한다
- Then: `failed`·`payment_failed` 등을 값으로 갖는 `OrderStatus` 관련 선언이 존재하지 않는다(쿼리 파라미터 이름 `payment_failed`는 예외 — enum 값이 아니다).
- 검증 수단: 정적 소스 검사.

### 웹훅 수신 및 Toss 결제 조회 재확인 (CodeRabbit PR #9 리뷰 Finding 1 — REQ-PAYMENT-011/012 재작성)

**AC-PAYMENT-011** — Toss 결제 조회 API가 웹훅의 주장을 확인해야만 처리된다 (REQ-PAYMENT-011)
- Given: `PAYMENT_STATUS_CHANGED` 웹훅 payload, 그리고 payload의 `paymentKey`로 Toss 결제 조회 API를 호출했을 때 payload와 같은 `orderId`를 담은 기록이 성공적으로 반환되는 상황
- When: `POST /api/payments/webhook`을 호출한다
- Then: 조회가 payload를 확인해 이후 처리 단계(주문 조회·금액 대조·전이)로 진입한다.
- 검증 수단: 서비스 단위 테스트(`queryTossPayment` 모킹 + 통과 분기 진입 스파이) + 통합 테스트(라우트를 통해 재확인).

**AC-PAYMENT-012** — Toss 결제 조회가 실패하거나 웹훅의 주장과 모순되면 아무 것도 처리하지 않는다 (REQ-PAYMENT-012)
- Given (i): Toss 결제 조회 API 호출 자체가 실패하는 상황(네트워크 오류·타임아웃·비-2xx 응답)
- Given (ii): 조회는 성공했지만 반환된 기록의 `orderId`가 웹훅 payload가 주장한 `orderId`와 다른 상황
- When: `POST /api/payments/webhook`을 호출한다
- Then (i): 502가 반환되고(PG 재시도 유도), 어떤 주문 상태도 변하지 않으며 `PaymentAuditLog`가 0건 생성된다.
- Then (ii): 400이 반환되고, 어떤 주문 상태도 변하지 않으며 `PaymentAuditLog`가 0건 생성된다.
- 검증 수단: 응답 단언 + fake DB 스냅샷 비교(전후 동일), (i)/(ii) 각각 별도 테스트.

**AC-PAYMENT-013** — `DONE` 웹훅이 `pending_payment` 주문을 `paid`로 전이한다 (REQ-PAYMENT-013)
- Given: `pending_payment` 상태의 주문, Toss 결제 조회 API가 확인해 준 `PAYMENT_STATUS_CHANGED` 웹훅(`status: "DONE"`, 금액 일치)
- When: 웹훅을 처리한다
- Then: 주문이 `paid`가 되고 `PaymentAuditLog`(`source: "WEBHOOK"`)가 1건 생긴다.
- 검증 수단: fake DB 상태 단언.

**AC-PAYMENT-014** — 취소 웹훅이 재고를 복원하며 `cancelled`로 전이한다 (REQ-PAYMENT-014, **정정 반영**: CodeRabbit PR #9 Finding 1/2/3)
- Given (a): `paid` 상태의 주문(`paymentKey: "PK1"`, 항목: 상품 A 수량 3, 현재 재고 7), Toss 결제 조회 API가 같은 `paymentKey`로 `status: "CANCELED"`를 반환하는 `PAYMENT_STATUS_CHANGED` 웹훅
- When (a): 웹훅을 처리한다
- Then (a): (i) 주문이 `cancelled`가 된다. (ii) 상품 A의 재고가 `10`이 된다(7+3). (iii) `PaymentAuditLog` 1건이 생긴다. 전부 하나의 트랜잭션 안에서 일어난다(정적 검사 — 재고 갱신과 상태 갱신이 같은 `$transaction` 콜백 안에서만 호출되는지 확인).
- Given (b) — **Finding 2 회귀**: 위와 같은 `paid` 주문(`paymentKey: "PK1"`)에, Toss 결제 조회 API가 **다른** `paymentKey`(`"PK-ATTACKER"`)로 `status: "CANCELED"`를 반환하는 웹훅
- When/Then (b): 웹훅을 처리해도 주문은 `paid`로 남고, 재고는 복원되지 않으며(`markOrderCancelledAndRestoreStock` 미호출), `PaymentAuditLog`가 추가로 생기지 않는다. 응답은 200(PG에게는 수신 확인)이다.
- Given (c) — **Finding 3 회귀**: 위와 같은 `paid` 주문에, Toss 결제 조회 API가 같은 `paymentKey`로 `status: "PARTIAL_CANCELED"`를 반환하는 웹훅
- When/Then (c): 웹훅을 처리해도 주문은 `paid`로 남고(전체 취소 경로로 라우팅되지 않음), 재고는 과다 복원되지 않으며(여전히 7), `PaymentAuditLog`에 무전이(이전/이후 상태 동일) 기록 1건이 남는다. 응답은 200이다.
- 검증 수단: fake DB 상태 단언 + 정적 소스 검사((a)), 서비스/통합 회귀 테스트((b)/(c)).
- **전제(fake 롤백)**: SPEC-ORDER-001 acceptance.md §0과 동일한 전제 — fake가 `$transaction`을 콜백 성공 시에만 커밋하도록 구현했을 때에만 (a)의 원자성 주장이 유효하다.

**AC-PAYMENT-015** — 금액 불일치 웹훅은 전이 없이 기록만 남긴다 (REQ-PAYMENT-015)
- Given: `Order.totalAmount === 30000`
- When: `amount: 20000`인 웹훅을 처리한다
- Then: 주문 상태가 변하지 않고, `PaymentAuditLog`에 불일치 사실이 기록되며, 응답은 200이다.
- 검증 수단: fake DB 스냅샷 비교 + 로그 행 검사.

### 멱등성

**AC-PAYMENT-016** — 웹훅 재전송은 부작용을 만들지 않는다 (REQ-PAYMENT-016)
- Given: 전송 id `T1`로 이미 처리되어 `cancelled` + 재고 복원까지 끝난 주문
- When: 같은 전송 id `T1`로 같은 웹훅을 다시 처리한다
- Then: 상태가 다시 바뀌지 않고, 재고가 다시 늘어나지 않으며, `PaymentAuditLog`가 추가로 생기지 않고, 응답은 200이다.
- 검증 수단: 두 번째 처리 전후 fake DB 스냅샷 비교(변화 없음) + 응답 단언.

**AC-PAYMENT-017** — 상태 전이가 조건부 갱신 형태로 작성된다 (REQ-PAYMENT-017)
- Given: 이 SPEC이 작성한 전이 코드 전체
- When: `payment-repository.ts`를 정적 검사한다
- Then: 상태 갱신이 전부 `updateMany({ where: { ..., status: <기대값> }, ... })` 형태이며, 조건 없는 `update`로 상태를 쓰는 지점이 0건이다.
- 검증 수단: 정적 소스 검사.

### 보안 경계

**AC-PAYMENT-018** — 시크릿이 클라이언트 번들에 포함되지 않는다 (REQ-PAYMENT-018)
- Given: 이 SPEC이 추가한 클라이언트 컴포넌트·클라이언트 전용 모듈 전체
- When: `"use client"` 파일과 `src/lib/payment/toss-client.ts`를 정적 검사한다
- Then: `PG_SECRET_KEY`·`PG_WEBHOOK_SECRET` 토큰의 매치가 0건이고, `NEXT_PUBLIC_` 접두사 없는 서버 전용 환경변수를 참조하는 지점이 없다.
- 검증 수단: 정적 소스 검사.

**AC-PAYMENT-019** — 확인 API·웹훅 처리가 서버 전용 경로에서만 일어난다 (REQ-PAYMENT-019)
- Given: 이 SPEC이 추가한 전체 산출물
- When: `"use client"` 파일 전체와 `src/components/checkout/PayButton.tsx`를 정적 검사한다
- Then: 확인(confirm) API 호출 함수·웹훅 처리 함수에 대한 import나 직접 fetch 호출이 클라이언트 파일 안에 존재하지 않는다.
- 검증 수단: 정적 소스 검사.

### 게스트 전용 경계

**AC-PAYMENT-020** — 회원 결제 경로가 존재하지 않는다 (REQ-PAYMENT-020)
- Given: 이 SPEC이 추가·수정한 전체 산출물
- When: `src/features/payments/**`, `src/app/api/payments/**`를 정적 검사하고, `prisma/schema.prisma`의 `Order`·`PaymentAuditLog`를 검사한다
- Then: `userId`를 참조하거나 `resolveCartIdentity`의 `kind: "user"` 분기를 처리하는 코드가 결제 도메인 안에 존재하지 않는다.
- 검증 수단: 정적 소스 검사(토큰 매치 0건).

---

## §1.5 추적성 (REQ → AC)

REQ 20개 전부가 정확히 하나의 AC에 대응한다(1:1). AC도 20개다.

| REQ | AC |
|---|---|
| REQ-PAYMENT-001 ~ 020 | AC-PAYMENT-001 ~ 020 (동일 번호 1:1) |

---

## §2. 엣지 케이스

| 케이스 | 기대 동작 | 관련 AC |
|---|---|---|
| 같은 주문에 대해 승인 리다이렉트와 `DONE` 웹훅이 모두 도착 | 먼저 도착한 쪽이 `paid`로 전이시키고, 나중 쪽은 `count === 0`으로 아무 것도 하지 않음 | AC-004, AC-013 |
| 웹훅이 아직 `pending_payment`인 주문에 `CANCELED`를 보고 | `where: status = "paid"` 조건이 성립하지 않아 `count === 0`, 전이 없음 | AC-014 |
| 확인 API가 타임아웃되었지만 실제로는 PG 쪽에서 승인이 성사됨 | 이 SPEC은 그 경우를 웹훅의 `DONE` 이벤트로 뒤늦게 잡는다(REQ-PAYMENT-013이 대체 경로) | AC-013 |
| 재전송된 웹훅의 `transmission-id`가 새 값(진짜 새 이벤트, 이전 것과 다름) | 정상 처리 — 멱등 방어는 같은 id에만 적용됨 | AC-016 |
| 완료 화면에 `?payment_failed=1`과 실제로는 이미 `paid`인 주문이 함께 도착(브라우저 뒤로가기 등) | 실제 상태(`paid`)가 우선 렌더되고 재시도 배너는 표시되지 않음(상태 우선 원칙) | AC-009 |

## §3. 품질 게이트

- `npm run lint` exit 0
- `npm run typecheck` exit 0
- `npm run test` exit 0
- `npm run test:coverage` — 기존 임계값 유지(lines 85 / functions 85 / branches 80 / statements 85)
- `npm run prisma:validate` exit 0
- `npm run build` exit 0

## §4. Definition of Done

- [x] AC 20개 중 **하네스 관측 가능** 항목이 전부 PASS — progress.md §E.2/§E.3: 자동 검증 가능 19건 전부 PASS
- [x] 이름 붙은 제외 1건(`AC-004-EXCL-CONCURRENCY`)이 **미검증으로 명시 기록**됨 — progress.md §E.2에 그대로 적는다 (실 PostgreSQL 부재로 미검증 명시)
- [ ] fake의 `$transaction` 롤백 구현 여부가 progress.md §E.2에 기록됨(AC-PAYMENT-014의 전제) — progress.md에 해당 기록을 찾지 못함, 미확인
- [ ] §3 품질 게이트 6개 전부 exit 0 — `npm run build`가 run-phase/sync-phase 모두 exit 1(선행 결함으로 귀속·기록되었으나 §3 문언 그대로는 미충족)
- [x] plan.md §4 불변 조건 파일들의 변경 0건(diff로 확인) — progress.md §E.2: `src/lib/auth/**` diff 0줄, `src/middleware.ts` diff 0줄, orders/cart 도메인은 scope-boundary 목록 확장만 있고 로직 diff 없음
- [ ] plan.md §4.1이 허용한 **유일한 EXTEND**의 경계가 지켜짐 — 완료 화면의 인가 관련 코드 블록 diff 0줄 — progress.md에 해당 기록을 찾지 못함, 미확인
- [x] `OrderStatus` enum diff 0줄, 새 enum 값 없음(AC-PAYMENT-003/010) — progress.md §E.2 AC-PAYMENT-003/010 PASS 근거
- [x] 게스트 전용 경계가 지켜짐 — 결제 도메인에 `userId`/회원 분기 코드 없음(AC-PAYMENT-020) — progress.md §E.2 AC-PAYMENT-020 PASS 근거(`guest-only-scope.test.ts`)
- [ ] 구현이 plan.md §0의 확정 결정 7건과 일치함 — progress.md에 §0 결정 7건 대조 기록을 찾지 못함, 미확인
