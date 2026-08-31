---
id: SPEC-ORDER-001
status: draft
updated: 2026-08-31
tier: L
---

# Design: SPEC-ORDER-001 — 주문 도메인 설계 (게스트 전용)

이 문서는 **되돌리기 가장 어려운 결정부터** 배열한다. 데이터 모델 → 트랜잭션 경계 → 동시성 → 가격 확정 → 멱등성 → 신원/인가 → UI 순이다.

> **범위 전제**: 이 SPEC은 **게스트 체크아웃만** 만든다. 회원 체크아웃이 왜 구조적으로 불가능한지, 그리고 후속 SPEC이 무엇을 받아 가는지는 spec.md §3의 첫 항목에 전문이 있다. 아래 설계는 그 전제 위에 서 있으며, 특히 §1(모델)과 §6(신원)이 그 전제를 코드로 강제한다.

## §1. Prisma 모델 (되돌리기 가장 어려움)

```prisma
enum OrderStatus {
  pending_payment   // 이 SPEC이 생성하는 유일한 상태
  paid              // 후속 결제 SPEC 소유 — 이 SPEC은 값만 예약
  cancelled         // 후속 취소 SPEC 소유 — 이 SPEC은 값만 예약
}

model Order {
  id            String      @id @default(cuid())
  orderNumber   String      @unique   // 사람이 읽는 주문 번호 (REQ-ORDER-003)
  status        OrderStatus @default(pending_payment)

  // 소유 신원 — 게스트 전용이므로 NOT NULL 단일 컬럼 (§1.4)
  guestId       String      // 주문 시점의 guest_cart_id 값 (게스트 주문 열람 근거)

  // 배송 정보 스냅샷 (REQ-ORDER-008) — 5개 항목 그 이상은 없음
  recipientName String
  recipientPhone String
  postalCode    String
  address       String
  deliveryMemo  String?

  // 금액 스냅샷 (REQ-ORDER-003)
  itemsSubtotal Int         // 주문 항목 lineTotal 합
  shippingFee   Int
  totalAmount   Int         // itemsSubtotal + shippingFee

  idempotencyKey String     @unique   // REQ-ORDER-016

  items         OrderItem[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([guestId])
}

model OrderItem {
  id          String  @id @default(cuid())
  orderId     String
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // Restrict: 주문에 팔린 상품은 삭제할 수 없다. CartItem이 Cascade인 것과 반대 (§1.2)
  productId   String
  product     Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  // 주문 시점 스냅샷 (REQ-ORDER-002)
  productName String
  unitPrice   Int
  quantity    Int
  lineTotal   Int     // unitPrice * quantity — 저장해 두어 재계산 불일치를 없앤다

  createdAt   DateTime @default(now())

  @@index([orderId])
  @@index([productId])
}
```

`Product`에 `orderItems OrderItem[]` 역참조만 추가한다(기존 필드 무변경). **`User` 모델은 이 SPEC이 전혀 건드리지 않는다** — 이유는 §1.4.

### §1.1 스냅샷을 컬럼으로 중복 보관하는 이유

`productName`과 `unitPrice`는 `Product`에서 조인하면 되는 값처럼 보이지만, **조인하면 안 되는 값**이다. 조인은 "현재 값"을 주고 주문은 "그때 값"을 요구한다. `lineTotal`까지 저장하는 것은 한 걸음 더 나간 선택인데, 근거는 반올림·정책 변경 내성이다 — 나중에 금액 계산식이 바뀌어도 과거 주문의 표시 금액이 흔들리지 않는다. KRW 정수라 지금은 `unitPrice * quantity`와 항상 일치하지만, 일치한다는 사실이 저장하지 않을 이유는 아니다.

### §1.2 `onDelete` 방향이 CartItem과 반대인 이유

`CartItem.product`는 `Cascade`다 — 삭제된 상품은 모든 장바구니에서 그냥 사라지면 된다(SPEC-CART-001 plan.md §4, 그리고 `schema.prisma`의 해당 주석 "a deleted product simply leaves every cart"). `OrderItem.product`는 **`Restrict`** 다. 주문 기록은 회계 기록이며, 상품 행 삭제로 과거 주문이 조용히 훼손되어서는 안 된다. 상품을 지울 수 없게 되는 불편은 의도된 결과이며, 실무적으로는 관리자 SPEC이 "판매 중지" 플래그를 도입해 해결할 문제다(이번 범위 밖).

이 `Cascade`는 §2 2단계의 형태도 결정한다 — §1.5를 보라.

### §1.3 주문 번호 형식

`ORD-YYYYMMDD-XXXXXX`(`XXXXXX` = 대문자·숫자 6자, `randomBytes` 기반). 순차 증가 번호를 쓰지 않는 이유: 주문 번호가 순차면 하루 주문량이 외부에 노출되고, 번호 추측으로 타인 주문 조회를 시도할 여지가 생긴다. 다만 주문 번호 자체는 **인가 수단이 아니다** — 열람 인가는 §6이 담당한다.

### §1.4 `Order.userId`를 두지 않는 이유 (범위 경계를 스키마로 강제)

이전 판은 `Cart`와 같은 XOR 패턴(`userId String?` + `guestId String?`)을 두고 회원 주문을 표현했다. 이번 판은 **`userId`를 아예 만들지 않는다.** 근거는 두 가지다.

1. **쓰지 않을 컬럼이다.** 회원 체크아웃이 범위 밖이므로(spec.md §3 첫 항목) 이 SPEC의 어떤 코드 경로도 `userId`를 채우지 않는다. 스키마에만 존재하고 어떤 실행 경로도 도달하지 않는 상태는, 이 SPEC이 `PRODUCT_GONE`을 삭제한 것과 정확히 같은 이유로 남겨 두지 않는다 — 도달 불가능한 선언은 읽는 사람에게 "지원된다"는 잘못된 신호를 준다.
2. **경계가 문서가 아니라 타입으로 강제된다.** `guestId`가 `NOT NULL`이므로 회원 귀속 주문은 **표현할 수 없다.** 회원 경로가 실수로 열리더라도 데이터 계층에서 막힌다.

**후속 SPEC이 치를 비용**: 회원 체크아웃 SPEC은 `userId String?` 추가, `guestId`를 nullable로 완화, `User.orders` 역참조 추가, XOR 불변식 도입의 마이그레이션을 소유한다. `guestId`의 `NOT NULL` 해제는 기존 행이 전부 값을 가진 상태에서의 `DROP NOT NULL`이므로 파괴적이지 않다. 그 마이그레이션은 회원 신원 전송 수단을 SPEC-AUTH-001과 함께 결정하는 SPEC이 짜야 하며, 지금 미리 컬럼을 깔아 두는 것은 그 설계를 앞질러 정하는 일이다.

### §1.5 `PRODUCT_GONE`을 만들지 않는 이유 (도달 불가능한 상태)

이전 판은 "장바구니 항목이 참조하는 상품이 삭제됨"을 §2 2단계에서 걸러 `PRODUCT_GONE` 409로 응답했다. **그 상태는 이 스키마에서 존재할 수 없다.** `CartItem.product`가 `onDelete: Cascade`이고 `Product`에 소프트 삭제·`isActive` 컬럼이 없으므로(모델 전문 확인), 상품 삭제는 그 상품을 참조하던 장바구니 항목을 함께 지운다. 남는 장바구니는 항목이 줄어들거나 비워질 뿐이며, "상품이 비어 있는 항목"으로는 절대 조회되지 않는다. `CART_INCLUDE`의 상품 조인도 필수 FK 조인이라 타입 수준에서 `product`가 non-nullable이다.

따라서 그 분기, 그 실패 코드, 그것을 검사하던 AC를 전부 삭제한다. 실제로 도달 가능한 인접 상황 — 트랜잭션이 진행되는 도중 다른 세션이 상품을 삭제하는 경우 — 는 §9에 잔여 위험으로 기록한다.

**이 원칙의 경계 — "스키마상 불가능"과 "스키마는 허용하지만 애플리케이션이 막는다"는 다르다.** plan.md §6의 "도달할 수 없는 상태를 위한 방어 코드를 쓰지 말 것"은 전자에만 적용된다. `PRODUCT_GONE`은 FK Cascade가 그 상태를 물리적으로 만들어내지 못하게 하므로 방어가 무의미하다. 반면 `CartItem.quantity`는 `prisma/schema.prisma`에서 CHECK 제약 없는 순수 `Int`이고 `≥ 1` 규칙은 API 경계의 `parseQuantity`에만 산다 — 즉 스키마는 `quantity ≤ 0`을 **허용**하며, 그 상태는 다른 경로나 데이터 이상으로 실재할 수 있다. 따라서 REQ-ORDER-004 / AC-ORDER-004의 방어 분기는 이 원칙의 예외가 아니라 적용 대상이 아니다. 판별 기준: **스키마가 그 상태를 저장할 수 있는가** — 저장할 수 없으면 분기를 지우고, 저장할 수 있으면 방어한다.

## §2. 트랜잭션 경계 (REQ-ORDER-011/012)

```
POST /api/orders
  ├─ [tx 밖] 신원 해석 → 회원이면 즉시 거부 (§6.2, REQ-ORDER-021)
  ├─ [tx 밖] 요청 본문 파싱 · 배송 정보 형식 검증 (REQ-ORDER-010)
  ├─ [tx 밖] 멱등키 조회 → 기존 주문 있으면 그대로 반환 (REQ-ORDER-016)
  └─ prisma.$transaction(async (tx) => {
        1. 게스트 Cart + items + product(price·stock·name) 재조회        R3(a)
        2. 장바구니가 없거나 비었으면 abort                              REQ-ORDER-015
        3. 금액 재계산 → 클라이언트 확인 금액과 다르면 abort              REQ-ORDER-014
        4. 각 상품에 대해 조건부 재고 차감 (§3) → 하나라도 실패 시 abort   REQ-ORDER-013 · R3(c)
        5. Order + OrderItem[] 생성 (단가·상품명 스냅샷)                  R3(b)
        6. Cart 삭제 (CartItem은 FK cascade)                            R3(d)
     })
```

> **`R3(x)` 라벨의 네임스페이스**: 위 오른쪽 열의 `R3(a)`~`R3(d)`는 **research.md §3의 네 가지 후보 동작**(재고 재확인 / 가격 스냅샷 / 재고 차감 / 장바구니 비우기)을 가리킨다. acceptance.md의 AC Then 절 하위 항목 `(a)/(b)/(c)`와는 **다른 네임스페이스**이며 서로 대응하지 않는다. 두 네임스페이스가 같은 글자를 쓰던 혼동을 없애기 위해 이 문서는 research.md 쪽 참조에 `R3` 접두사를 **예외 없이** 붙인다.

### 단계 순서가 load-bearing인 지점

- **4가 5보다 앞선다.** 재고 차감이 실패하는 경우가 가장 흔한 실패이므로, 주문 행을 만들기 전에 걸러 롤백 비용을 줄인다. 원자성 자체는 순서와 무관하지만 실패 경로의 명료함이 달라진다.
- **6이 마지막이다.** 장바구니는 주문 성립의 입력이므로, 성립이 확정되기 전에 지우면 실패 시 복구할 원본이 사라진다(롤백이 되돌려 주긴 하지만, 트랜잭션 안에서 이후 단계가 장바구니를 다시 읽을 수 있으므로 순서를 명시해 둔다).
- **1이 트랜잭션 안이다.** 트랜잭션 밖에서 읽은 가격·재고로 안에서 쓰면 읽기와 쓰기 사이에 창이 생긴다.
- **회원 거부가 트랜잭션 밖이다.** 아무 것도 쓰지 않고 끝나는 판정이므로 트랜잭션을 열 이유가 없다.

### §2.1 트랜잭션 클라이언트를 받는 카트 리포지토리 (결정: 중복이 아니라 인자 추가)

위 1단계와 6단계는 **카트 도메인의 데이터**를 트랜잭션 안에서 읽고 지운다. 그런데 `src/features/cart/repositories/cart-repository.ts`의 함수들은 전부 모듈 수준 Prisma 싱글턴에 묶여 있어 그대로는 `$transaction` 콜백이 넘겨준 클라이언트로 실행할 수 없다. 선택지는 둘뿐이었다.

| 대안 | 내용 | 판단 |
|---|---|---|
| A. 주문 도메인에 질의를 복제 | `order-repository.ts` 안에서 `tx.cart.findUnique(...)`를 자체 `include`와 함께 다시 작성 | **기각** |
| B. **카트 리포지토리에 선택적 트랜잭션 클라이언트 인자 추가**(채택) | 필요한 함수에 한해 기본값이 있는 인자를 덧붙여, 기존 호출부는 한 글자도 바꾸지 않고 주문 서비스만 `tx`를 넘긴다 | **채택** |

A를 기각한 근거는 취향이 아니라 그 파일이 스스로 선언한 불변식이다. `cart-repository.ts`의 헤더 주석은 `@MX:ANCHOR fan-in target — every cart mutation and read in the SPEC reaches the database through this module`이라고 못 박고, 이어서 `@MX:REASON ... a change here is an authorization-boundary change rather than a query detail`이라고 그 이유를 밝힌다. 카트의 **소유권 판정 질의**(`where: { guestId }`)를 이 모듈 바깥에 두 번째 사본으로 만드는 것은 그 앵커가 막으려던 바로 그 상태 — 소유권 질의가 두 곳에서 갈라지는 상태 — 를 만드는 일이다. 게다가 복제 대상에는 `CART_INCLUDE`(가격·재고·이름을 함께 끌어오는 조인)까지 포함되므로, 사본은 작지도 않고 authorization 표면에 놓인다.

B가 침습적이지 않은 이유: 인자가 **선택적이고 기본값이 싱글턴**이므로 기존 호출부(카트 서비스·로그인 병합 경로)의 시그니처·동작·테스트가 전부 그대로다. 반환 타입도 바뀌지 않는다. 즉 이것은 동작 변경이 아니라 **주입 지점 하나를 여는 순수 가산 변경**이다.

대상 함수는 아래 **2개로 한정**한다. 이 목록 밖의 어떤 카트 파일도 이 SPEC이 건드리지 않는다(plan.md §4).

| 함수 | 현재 | 변경 후 | 이 SPEC의 사용처 |
|---|---|---|---|
| `findCartByGuestId` | `(guestId)` | `(guestId, client = prisma)` | §2 1단계 — 게스트 신원의 카트+항목+상품 재조회 |
| `deleteCart` | `(cartId)` | `(cartId, client = prisma)` | §2 6단계 — 주문 성립 후 카트 행 삭제 |

**`findCartByUserId`는 대상에서 빠졌다.** 이전 판은 회원 경로 1단계를 위해 이 함수도 목록에 넣었으나, 회원 체크아웃이 범위 밖이 되면서 이 SPEC은 회원 장바구니를 트랜잭션 안에서 읽을 일이 없다. 쓰지 않을 함수에 대해 불변 조건을 여는 것은 §9가 경계하는 "구멍이 넓어짐" 위험만 키우므로, 완화 대상을 3개에서 2개로 **좁혔다**. 채택한 설계(B: 선택적 인자 추가)는 바뀌지 않았다.

`client`의 타입은 `Prisma.TransactionClient`다 — `$transaction` 콜백 인자와 모듈 싱글턴 양쪽이 이 타입을 만족하므로 union이 필요 없다.

`findProductForCart`는 **대상이 아니다**: §2 1단계가 필요로 하는 `price`·`stock`·`name`은 `CART_INCLUDE`의 상품 조인이 이미 함께 실어 오므로 별도 상품 조회가 발생하지 않는다(그리고 `findProductForCart`는 `name`을 select 하지도 않는다).

**남는 부담**: 이 결정으로 `src/features/cart/**`는 더 이상 전면 불변이 아니다. 그 완화는 위 2개 함수의 인자 추가로 **한정**되며, 그 경계는 plan.md §4.1에 기계적으로 확인 가능한 형태(변경 함수 2개, 기존 호출부 diff 0줄)로 기록된다.

### 장바구니를 "비운다" = Cart 행 삭제

`CartItem`만 지우고 `Cart` 행을 남기는 선택지도 있으나, SPEC-CART-001은 이미 "카트 행 없음"을 정상 상태로 취급한다 — `src/features/cart/services/cart-service.ts:108`의 주석이 `plan.md §2.6 — "no cart yet" is a normal state, not an error`라고 적고, 바로 아래 `toCartDTO(cart: CartWithItems | null)`이 `cart === null`이면 `emptyCart()`를 반환한다(`:113-114`). 따라서 행 삭제가 기존 계약과 충돌하지 않으며, 게스트의 경우 `guestId`가 어떤 카트에도 결속되지 않은 상태로 되돌아가 다음 담기에서 새 카트가 생긴다.

## §3. 초과 판매 방지 — 조건부 갱신 (동시성)

읽고-검사하고-쓰는(read-check-write) 순서는 두 주문이 동시에 들어오면 둘 다 통과시킨다. Prisma에는 `SELECT ... FOR UPDATE`를 직접 표현하는 API가 없으므로, **조건을 UPDATE의 WHERE에 넣는다**:

```ts
const updated = await tx.product.updateMany({
  where: { id: productId, stock: { gte: quantity } },
  data: { stock: { decrement: quantity } },
});
if (updated.count !== 1) {
  throw new InsufficientStockError(productId);   // 트랜잭션 전체 롤백
}
```

`updateMany`의 `count`가 그대로 "조건이 성립했는가"의 답이다. 데이터베이스가 UPDATE 대상 행에 잠금을 잡으므로 동시 요청은 직렬화되고, 뒤늦은 쪽은 `count === 0`을 받아 롤백된다. `update`(단수)를 쓰면 조건 불일치가 예외로 오지만 `where`에 non-unique 조건을 넣을 수 없어 이 형태가 성립하지 않는다.

**검증 한계**: 이 동작의 실제 직렬화는 살아 있는 PostgreSQL에서만 관측된다(research.md §5). 이 SPEC의 자동 테스트는 "조건부 갱신 형태로 작성되었고, `count !== 1`이면 롤백 경로로 간다"까지만 판정한다.

## §4. 가격 확정 — 확인 금액 대조 (REQ-ORDER-014)

주문서를 그린 시점(T1)과 제출 시점(T2) 사이에 가격이 바뀔 수 있다. 세 가지 처리 방식을 검토했다.

| 대안 | 동작 | 판단 |
|---|---|---|
| A. 조용히 T2 가격으로 주문 | 사용자가 본 금액과 다른 금액이 결제됨 | **기각.** 사용자가 동의하지 않은 금액이 청구된다 |
| B. **확인 금액 대조 후 거부**(채택) | 클라이언트가 T1에 표시된 총액을 함께 제출, T2 재계산값과 다르면 409 + 새 금액 반환 → 사용자 재확인 | 사용자가 동의한 금액으로만 주문이 성립한다. 구현 비용이 낮고 상태를 남기지 않는다 |
| C. 가격 잠금(장바구니 담기 시점 스냅샷 + 유효기간) | 담은 가격을 일정 시간 보장 | SPEC-CART-001이 명시적으로 기각한 설계(§2.4). 그 결정을 이 SPEC이 뒤집을 근거가 없고, 잠금 유효기간 만료 처리라는 새 문제를 만든다 |

B를 채택한다. 확인 금액은 **신뢰 경계 밖의 값**이므로 "이 금액으로 청구하라"는 지시가 아니라 "내가 본 금액이 이것이다"라는 대조용 입력으로만 쓴다 — 서버는 항상 자신이 계산한 금액을 저장한다.

## §5. 멱등성 (REQ-ORDER-016)

`tech.md`가 요구한 멱등키를 여기서 이행한다. 클라이언트가 주문서 렌더 시점에 발급받은 키를 제출 요청에 실어 보내고, `Order.idempotencyKey`의 unique 제약이 최종 방어선이 된다.

- **1차 방어(빠른 경로)**: 트랜잭션 진입 전 키로 기존 주문을 조회해 있으면 그대로 반환.
- **2차 방어(경합 경로)**: 두 요청이 동시에 1차를 통과하면 뒤늦은 INSERT가 unique 위반으로 실패하고 트랜잭션이 롤백된다 → 롤백 후 키로 재조회해 최초 주문을 반환한다. 재고가 두 번 차감되지 않는 것은 롤백이 보장한다.

키는 서버가 주문서 렌더 시 생성해 폼에 실어 보낸다(클라이언트가 자유롭게 만들면 재사용·충돌 책임이 클라이언트로 넘어간다). 새로고침하면 새 키가 발급되며, 이는 의도된 동작이다 — 멱등키가 막는 것은 "같은 제출의 중복 도착"이지 "사용자가 다시 주문하는 것"이 아니다.

## §6. 신원 해석과 열람 인가 (REQ-ORDER-007 / REQ-ORDER-020 / REQ-ORDER-021)

이 SPEC의 신원은 **게스트 신원 하나뿐**이다. 회원 신원이 왜 서버 렌더 화면에 도달할 수 없는지는 spec.md §3 첫 항목과 research.md §6에 증거와 함께 있다. 아래는 그 결론 위에서 읽기 경로와 쓰기 경로를 각각 설계한다.

**읽기 경로와 쓰기 경로를 다르게 다루는 이유**는 두 경로의 인가 무게가 다르기 때문이다. 주문서·완료 화면은 **보여 주기만** 하고, `POST /api/orders`는 **주문을 만들고 재고를 줄인다**. 그래서 쓰기 경로는 SPEC-CART-001의 신원 판정 함수를 그대로 재사용하고, 읽기 경로는 필요한 사실 하나(이 요청이 어떤 게스트 쿠키를 제시했는가)만 읽는다.

### §6.1 읽기 경로 — 서버 컴포넌트의 게스트 신원 (어댑터 없음)

이전 판은 `next/headers`의 `headers()`로 `authorization`·`cookie` 두 헤더를 옮겨 담아 가짜 `Request`를 만들고 `resolveCartIdentity()`를 호출하는 **얇은 어댑터**(`server-identity.ts`)를 두었다. 그 어댑터는 **회원 신원을 서버 컴포넌트에서 해석하기 위한 장치**였고, 회원 체크아웃이 범위 밖이 된 지금 존재 이유가 사라졌으므로 **설계에서 삭제한다.** 어댑터가 하던 일 중 이 SPEC에 남는 것은 게스트 쿠키 읽기 한 가지뿐이며, 그것은 App Router가 이미 제공한다.

```
src/app/checkout/page.tsx (그리고 complete/[orderId]/page.tsx)
  ├─ const jar = await cookies()                              ← next/headers
  ├─ const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null
  │     ↑ 이름은 src/lib/auth/guest-identity.ts에서 import (문자열 리터럴 금지)
  └─ guestId === null  →  안내 화면 (REQ-ORDER-006)
     guestId !== null  →  게스트 장바구니 조회 후 주문서 렌더
```

이 형태가 성립하는 근거와, 그럼에도 authorization 표면이 갈라지지 않는 이유:

- **쿠키는 최상위 내비게이션에 실린다.** 헤더와 달리 쿠키는 브라우저가 모든 동일 출처 요청에 자동으로 붙이므로, 서버 렌더 시점에 게스트 쿠키는 확실히 도착한다. 회원 토큰이 도착하지 못하는 것과 정확히 대비되는 지점이며, 이것이 "게스트는 되고 회원은 안 되는" 비대칭의 원인이다.
- **판정 규칙을 복제하지 않는다.** 복제 위험이 있었던 것은 토큰 검증, 회원/게스트 우선순위, 게스트 id 발급 세 가지인데 읽기 경로는 셋 다 하지 않는다. 남는 것은 "쿠키 값이 곧 게스트 id"라는 항등식 하나이며, 여기에는 판정할 것이 없다.
- **쿠키 이름을 두 번 쓰지 않는다.** `GUEST_CART_COOKIE_NAME`을 `src/lib/auth/guest-identity.ts`에서 import한다(그 모듈이 이미 export하고 있다). 주문 도메인에 `"guest_cart_id"` 리터럴은 등장하지 않는다 — 이름이 갈라지면 신원도 갈라지기 때문이다. **import는 수정이 아니므로 `src/lib/auth/**` 불변 조건은 그대로다.**
- **id를 발급하지 않는다.** 쿠키가 없으면 조회할 게스트 id 자체가 없고, id 없이는 어떤 카트도 찾을 수 없다. 그래서 "쿠키 없음 → 보여 줄 장바구니 없음"은 추론이 아니라 항진명제다. 서버 컴포넌트는 쿠키를 설정할 수도 없으므로(Next.js는 Server Component 렌더 중 쿠키 설정을 지원하지 않는다) 여기서 발급을 시도하는 것 자체가 무의미하다. 발급은 라우트 핸들러의 일이다(§6.2).

이 성질들은 문서로만 두지 않고 AC-ORDER-021이 정적 검사로 고정한다(금지 토큰: `verifyAccessToken`·`resolveCartIdentity`·`readGuestCartId`·`getCookieValue`·`generateGuestCartId`·`new Request(`, 그리고 `"guest_cart_id"` 리터럴).

검토했지만 택하지 않은 대안:

| 대안 | 기각 사유 |
|---|---|
| 이전 판의 헤더 복사 어댑터를 유지 | 어댑터의 존재 이유였던 `authorization` 헤더가 서버 렌더 요청에 원리적으로 오지 않는다(spec.md §3). 회원 분기를 지운 뒤 남는 것은 쿠키 한 개 읽기이며, 그것을 위해 가짜 `Request`를 만드는 것은 우회로를 자산처럼 남기는 일이다 |
| `resolveCartIdentity()`에 `next/headers` 오버로드 추가 | `cart-service.ts:36-38`이 스스로 "Framework-independent ... it takes a plain Request"라고 선언한 성질을 깨뜨린다. `features/`가 프레임워크 비의존이라는 structure.md 레이어링 규칙에도 어긋나고, `src/lib/auth/**`와 `cart-service.ts` 두 불변 조건을 추가로 뚫어야 한다 |
| 신원 해석을 라우트 핸들러로 옮기고 페이지는 그 결과를 받는다 | 주문서 페이지는 **렌더 시점에** 자기 장바구니를 알아야 요약을 그린다. 자기 자신의 HTTP API를 다시 타는 형태가 되어 SPEC-STOREFRONT-001 plan.md §B의 선례(네트워크 왕복·base URL 환경변수·JSON 경계 타입 소실 회피)를 정면으로 뒤집는다 |

### §6.2 쓰기 경로 — `POST /api/orders`의 신원 해석과 회원 거부

라우트 핸들러는 진짜 `Request`를 가지므로 **`resolveCartIdentity(request)`를 그대로 재사용한다.** 여기가 이 SPEC에서 신원이 판정되는 유일한 지점이며, SPEC-CART-001의 authorization 표면과 갈라지지 않는다.

| 해석 결과 | 이 SPEC의 처리 |
|---|---|
| `{ kind: "user", userId }` | **거부.** 409 `MEMBER_CHECKOUT_UNSUPPORTED`. 주문·재고·장바구니 어느 것도 변경하지 않는다(REQ-ORDER-021) |
| `{ kind: "guest", guestId }`, `issuedGuestId === null` | 정상 경로 — §2의 트랜잭션으로 진행 |
| `{ kind: "guest", guestId }`, `issuedGuestId !== null` | 이 요청은 게스트 쿠키가 없어 방금 발급받았다 → 그 신원에는 카트가 없으므로 409 `CART_EMPTY`. **응답에는 쿠키를 붙인다**(기존 카트 라우트와 동일 패턴) — 붙여 두어야 이 방문자의 다음 담기가 같은 신원으로 이어진다 |

**회원 거부가 조용한 실패보다 나은 이유**: 거부하지 않으면 회원의 주문이 그 회원의 게스트 id로 만들어지거나(§1.4가 막는다) 아예 만들어졌다가 정작 본인이 완료 화면을 열지 못하는 상태가 된다. 후자가 iteration 2 감사가 지적한 바로 그 결함이다. 명시적 거부는 그 상태를 **발생시키지 않으며**, 이번 범위의 경계를 사용자에게 정직하게 알린다.

**이 거부는 도달 가능한 경로다.** 브라우저 폼 제출은 토큰을 붙일 수 없지만, `POST /api/orders`는 공개 엔드포인트이므로 유효한 Bearer 토큰을 가진 누구나 직접 호출할 수 있다. 신뢰 경계에 놓인 실제 가드이지 장식이 아니며, 그래서 AC-ORDER-022가 이를 검증한다.

### §6.3 완료 화면 열람 인가

| 신원 | `Order.guestId` | 완료 화면 열람 조건 |
|---|---|---|
| 게스트 | 주문 시점 `guest_cart_id` | 요청 쿠키의 `guest_cart_id`가 `Order.guestId`와 **문자열 일치** |
| 그 외 전부(쿠키 없음, 다른 게스트 쿠키, 회원 토큰만 제시) | — | 열람 불가 → `notFound()` |

완료 화면은 `Authorization` 헤더를 **읽지 않는다.** 따라서 회원 토큰을 제시해도 얻는 것이 없으며, 이는 회원 체크아웃 부재의 직접적 귀결이다.

**주문 id를 아는 것만으로는 열람되지 않는다**(REQ-ORDER-020). 불일치 시 404를 반환한다 — 403이 아니라 404인 이유는 SPEC-CART-001의 `findOwnedItem()`이 세운 선례와 같다: 상태 코드로 "그 id는 실재한다"를 알려주지 않기 위해서다.

게스트 쿠키가 만료되면(14일) 게스트는 자신의 주문 완료 화면에 다시 접근할 수 없다. 이는 이 SPEC의 완료 화면이 **주문 직후 1회 표시용**이기 때문에 수용 가능한 결과이며, 재방문 조회 수단은 주문 조회 SPEC의 몫이다(spec.md §3).

## §7. UI 구조 (SPEC-STOREFRONT-001 패턴 준수)

```
/checkout                        서버 컴포넌트 — 게스트 쿠키 읽기(§6.1) + 장바구니 조회 + 주문 요약 + 멱등키 발급
  └─ <OrderSummary>              순수 프레젠테이션 (서버)
  └─ <CheckoutForm>              "use client" — 입력·검증·제출만
/checkout/complete/[orderId]     서버 컴포넌트 — 게스트 쿠키 읽기(§6.1) 후 대조하여 완료 내용 표시
```

- 서버 컴포넌트가 **서비스 계층을 직접 호출한다** — 자기 자신의 HTTP API를 다시 타지 않는다(SPEC-STOREFRONT-001 plan.md §B가 세운 선례: 네트워크 왕복·base URL 환경변수·JSON 경계에서의 타입 소실을 피한다).
- 두 페이지 모두 `cookies()`를 쓰므로 request-time API가 되어 자동으로 동적 렌더링이 된다. 장바구니·주문은 요청마다 달라지는 내용이므로 이는 원하는 결과다(정적 캐시가 걸리면 남의 주문이 노출된다).
- 제출만 클라이언트에서 `fetch("/api/orders")`로 나간다. 최초 화면 렌더에는 클라이언트 데이터 요청이 없다(REQ-ORDER-005).
- 스타일링은 Tailwind CSS v4 유틸리티, 폰트는 `globals.css`의 시스템 스택. SPEC-STOREFRONT-001에서 확정된 사항이므로 재논의하지 않는다.
- 접근성: 모든 입력에 `<label htmlFor>`, 오류는 `aria-describedby`로 해당 입력과 프로그래밍적으로 연결, 오류 영역은 `role="alert"`.

### §7.1 안내 화면의 문구 계약 (REQ-ORDER-006)

쿠키가 없는 요청은 **한 번도 담은 적 없는 방문자**일 수도, **방금 로그인해 게스트 쿠키가 만료된 회원**일 수도 있다(spec.md §3 첫 항목 (3)). 서버는 이 둘을 **구별할 수 없다** — 구별하려면 회원을 식별해야 하는데 그것이 불가능하다는 것이 이 SPEC의 전제이기 때문이다.

따라서 안내 문구는 두 독자 모두에게 참이어야 한다. 계약은 두 줄이다.

- **단정 금지**: "장바구니가 비어 있습니다"처럼 방문자의 장바구니 상태를 사실로 주장하지 않는다. 회원에게는 거짓일 수 있다. 대신 서버가 실제로 관측한 것만 말한다 — "이 요청에 연결된 게스트 장바구니를 찾을 수 없습니다".
- **범위 고지**: 회원 체크아웃이 이번 범위에 없다는 사실을 함께 표시한다. 로그인한 회원이 이 화면을 보고 원인을 알 수 있는 유일한 수단이다.

이 계약을 AC-ORDER-006이 문자열 단언으로 고정한다. 문구를 "장바구니가 비었습니다"로 되돌리는 변경은 AC를 깨뜨린다.

## §8. 실패 응답 형태

| 상황 | 상태 | 본문 |
|---|---|---|
| 배송 정보 형식 오류 (REQ-ORDER-010) | 400 | `{ error, fieldErrors: { [field]: message } }` |
| 회원 자격 증명 제시 (REQ-ORDER-021) | 409 | `{ error, code: "MEMBER_CHECKOUT_UNSUPPORTED" }` |
| 장바구니 비어 있음/없음 (REQ-ORDER-015) | 409 | `{ error, code: "CART_EMPTY" }` |
| 재고 부족 (REQ-ORDER-013) | 409 | `{ error, code: "INSUFFICIENT_STOCK", products: [{ productId, name, available }] }` |
| 확인 금액 불일치 (REQ-ORDER-014) | 409 | `{ error, code: "PRICE_CHANGED", totalAmount }` |
| 그 외 예기치 못한 오류 | 500 | `{ error }` — 코드 없음. `orderNumber`의 `@unique` 충돌처럼 위 표가 명시하지 않은 트랜잭션 예외가 여기로 나온다(재시도하지 않는다, §5) |

400과 409의 구분: 400은 **요청 자체가 잘못된 경우**(고치면 같은 요청이 성공), 409는 **요청은 옳지만 서버 상태와 충돌하는 경우**(사용자가 상황을 다시 확인해야 함)다. 회원 거부가 401/403이 아니라 409인 이유는 자격 증명이 **무효해서**가 아니라 **이번 범위가 그 신원을 지원하지 않아서**이기 때문이다 — 다시 로그인해도 결과는 같으므로 인증 오류로 알리면 오해를 부른다.

`PRODUCT_GONE`은 이 표에서 삭제되었다. 사유는 §1.5.

## §9. 남은 위험

| 위험 | 성격 | 완화 |
|---|---|---|
| 미결제 주문이 재고를 무기한 점유 | 설계상 필연(research.md `R3(c)`) | 해제 정책은 이 SPEC 범위 밖 — plan.md §0 #2의 잠정 결정(타임아웃 후 해제를 향후 방향으로 기록). 이 SPEC은 이를 숨기지 않고 명시한다 |
| 트랜잭션 원자성을 실 DB에서 검증하지 못함 | 하네스 한계 | acceptance.md §0에서 관측 가능/불가능을 분류. 초록불을 원자성의 증거로 제시하지 않는다 |
| 주문서로 가는 화면 링크 부재 | 선행 SPEC 부재 | 주소 직접 진입으로 검증. 장바구니 UI SPEC이 링크를 붙인다 |
| 결제 SPEC 도입 시 상태 전이 소유권 충돌 | plan.md §0 #1(주문 선생성 확정)의 후속 경계 | 상태 필드만 만들고 전이 로직은 만들지 않아 충돌 표면을 최소화 |
| 카트 리포지토리에 낸 트랜잭션 인자 구멍이 이후 넓어짐 | §2.1에서 연 완화의 후속 위험 | 대상 함수를 2개로 좁혀 이름으로 못 박고, 기존 호출부 diff 0줄을 DoD(acceptance.md §4)에서 기계적으로 확인 |
| 트랜잭션 진행 중 다른 세션이 상품을 삭제 | 실제로 도달 가능한 동시성 상황(§1.5가 삭제한 `PRODUCT_GONE`의 진짜 대응물) | 삭제가 커밋되면 4단계 `updateMany`가 0행을 갱신하므로 `INSUFFICIENT_STOCK` 경로로 빠지고 트랜잭션 전체가 롤백된다. **정합성은 안전하다**(주문 0건·재고 무변경). 남는 흠은 메시지가 "재고 부족"으로 나가 원인을 정확히 알리지 못한다는 것뿐이며, 상품 삭제가 드문 관리 작업이므로 별도 코드를 만들지 않고 수용한다 |
| 로그인한 회원이 `/checkout`에서 안내 화면만 보게 됨 | 게스트 전용 범위의 직접적 귀결 | 서버가 회원을 식별할 수 없으므로 회원 맞춤 안내는 불가능하다. §7.1의 문구 계약으로 **거짓을 말하지 않고** 범위를 고지하는 것까지가 이 SPEC이 할 수 있는 전부이며, 근본 해소는 회원 체크아웃 SPEC의 몫이다 |
| 회원 거부(REQ-ORDER-021)가 후속 SPEC에서 지워지지 않고 남음 | 범위 확장 시의 잔재 위험 | 실패 코드 이름 자체가 `MEMBER_CHECKOUT_UNSUPPORTED`이므로 회원 체크아웃을 구현하는 SPEC이 반드시 마주치고 제거하게 된다 |
