# Design: SPEC-DISCOUNT-001 — 쿠폰·할인 정책 계산 엔진

> 이 문서는 plan.md §1(할인을 `totalAmount`에 녹인다)과 §2(모델 1종)의 결정을 전제로, 그 결정이 코드에서 어떤 모양이 되는지를 적는다. 한때 §5(UI)와 §6(시점)은 plan.md §0의 미확정 항목에 종속되어 있었으나, 그 4건은 **2026-09-02 사용자 결정으로 전부 확정**되었다(plan.md §0). 두 절은 이제 확정된 설계다.

---

## §1. 스키마 변경

### 1.1 새 열거형과 모델

```prisma
enum DiscountType {
  PERCENTAGE    // value = 퍼센트 (0 < value <= 100)
  FIXED_AMOUNT  // value = 원
}

model Coupon {
  id             String       @id @default(cuid())
  // 대문자 정규화 저장. 애플리케이션이 조회 전에 toUpperCase() 하므로
  // Postgres의 대소문자 구분 유일 인덱스로 충분하다 — citext 확장을 들이지
  // 않는다(현재 확장은 pg_trgm 하나뿐이고, 정규화가 더 단순하다).
  code           String       @unique
  type           DiscountType
  value          Int
  minOrderAmount Int          @default(0)

  // 전역 상한이다. 인별 상한이 아니다 (REQ-DISCOUNT-022).
  maxRedemptions Int
  // @MX:ANCHOR 이 컬럼의 갱신은 조건부 원자 갱신으로만 이루어진다(§3).
  // @MX:REASON 평범한 read-then-write로 바꾸면 상한이 조용히 깨진다.
  redeemedCount  Int          @default(0)

  startsAt       DateTime
  endsAt         DateTime
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([code])
}
```

`Coupon`에는 `Order`로의 역관계를 두지 **않는다**. 관계가 없기 때문이다(§1.2).

### 1.2 `Order` 확장 — 관계가 아니라 스냅샷

```prisma
model Order {
  // ... 기존 컬럼 불변 ...
  couponCode     String?          // 적용된 코드의 사본
  discountAmount Int     @default(0)
}
```

두 컬럼 모두 **외래키가 아니다**. `OrderItem`이 `productName`·`unitPrice`를 조인 대신 복사해 저장하는 것과 정확히 같은 이유다 — 조인은 *현재* 값을 주는데, 주문에는 *고객이 동의한* 값이 필요하다. 쿠폰이 폐기되거나 할인율이 바뀌어도 과거 주문의 금액은 움직이면 안 된다.

`@default(0)`과 nullable이 마이그레이션의 안전을 만든다: 기존 주문 행들은 값을 채우지 않아도 유효하며, `discountAmount = 0` / `couponCode = null`이 곧 "쿠폰 없는 주문"의 표현이다(REQ-DISCOUNT-019).

---

## §2. 모듈 경계

`structure.md`의 규칙 — `features/`는 전달 수단(`next/*`, `@prisma/client`)에 의존하지 않는다 — 을 그대로 따르며, 기존 `features/orders` 구조를 거울처럼 반영한다.

```
src/features/discounts/
  types/discount.ts         순수 타입 + 실패 코드 유니온. import 없음
  services/discount-engine.ts   순수 계산 함수. DB·시계·난수 접근 없음
  services/discount-service.ts  조회 + 검증 + 엔진 호출 조합
  repositories/coupon-repository.ts  Prisma 접근. 조건부 원자 갱신 소유
```

**엔진과 서비스를 나누는 이유**가 이 절의 핵심이다. 금액 산술이 **세 곳**에서 필요하기 때문이다: 화면(`/checkout`이 보여줄 금액), 주문 서비스(저장할 금액), 그리고 테스트. 산술이 서비스 안에 묻혀 있으면 화면은 그것을 호출할 수 없어(DB 접근이 딸려오므로) 자기 사본을 갖게 되고, 두 사본은 반드시 갈라진다 — 그것이 plan.md §6의 첫 번째 리스크다.

`discount-engine.ts`가 순수 함수인 덕분에 화면과 서비스가 **같은 함수**를 호출한다. AC-DISCOUNT-004가 이 순수성을 정적 검사로 고정한다.

```
calculateDiscount(
  { type, value, minOrderAmount },
  itemsSubtotal
) -> number       // 항상 0 이상, itemsSubtotal 이하
```

시각 비교(유효기간)는 엔진 **밖**에 둔다 — 시계에 닿는 순간 순수하지 않기 때문이다. 서비스가 `now`를 인자로 넘겨 판정한다.

---

## §3. 트랜잭션 순서

`order-service.ts`의 기존 6단계에 쿠폰 관련 작업이 끼어든다. **순서가 load-bearing**이다.

| 단계 | 기존 | 변경 |
|---|---|---|
| 1 | 장바구니 재조회 | 불변 |
| 2 | 수량 이상 검사 | 불변 |
| 3 | 금액 계산 + `confirmedTotal` 대조 | **여기가 바뀐다** (아래) |
| 4 | 재고 조건부 차감 (상품 id 오름차순) | 불변 |
| 5 | 주문·품목 기록 | 스냅샷 컬럼 2개 추가 |
| 6 | 장바구니 비우기 | 불변 |

### 3.1 3단계의 새 내부 순서

```
3a. itemsSubtotal 계산                       (기존과 동일)
3b. 쿠폰 코드가 있으면 조회 + 유효성 판정     → 실패 시 409로 abort
3c. calculateDiscount()로 할인액 산출         (순수)
3d. totalAmount = itemsSubtotal - discount + shippingFee
3e. confirmedTotal !== totalAmount → PRICE_CHANGED
3f. 쿠폰 사용 횟수 조건부 원자 증가           → 0행이면 COUPON_EXHAUSTED로 abort
```

**왜 3f가 3e 뒤인가**: `confirmedTotal` 불일치는 쿠폰과 무관한 실패이며, 그 경우 사용 횟수를 올렸다가 롤백하는 것은 낭비다. 더 중요하게는, 3b의 소진 검사와 3f의 조건부 갱신이 **둘 다 필요**하다는 점을 분명히 해 둔다 — 3b는 빠르고 친절한 사전 판정(사용자에게 이유를 알려주기 위함)이고, 3f는 **실제 강제**다. 3b만 두면 경쟁 조건에서 상한이 깨지고, 3f만 두면 실패 사유를 구분해 알려줄 수 없다.

**왜 3f가 4단계(재고)보다 앞인가**: 쿠폰 갱신은 **한 행**만 건드리므로 SPEC-ORDER-002 REQ-ORDER-023의 교착 회피 순서 규칙과 충돌하지 않는다. 재고 루프보다 앞에 두면, 쿠폰이 소진된 요청이 재고 잠금을 전혀 잡지 않고 빠져나가므로 다른 주문의 경합을 늘리지 않는다. 순서를 반대로 하면 소진된 쿠폰 요청이 재고 행을 잠갔다가 되돌리는 낭비를 만든다.

### 3.2 조건부 원자 갱신 (SPEC-ORDER-002 선례 차용)

```
updateMany({
  where: { id: couponId, redeemedCount: { lt: maxRedemptions } },
  data:  { redeemedCount: { increment: 1 } },
})
→ count !== 1 이면 경쟁 패배 → COUPON_EXHAUSTED
```

`update`가 아니라 `updateMany`인 이유는 `where`에 **비-유일 조건**(`redeemedCount < maxRedemptions`)을 넣을 수 있는 유일한 형태이기 때문이다. `order-repository.ts:129-139`의 재고 차감과 같은 모양이며, 그 SPEC이 이미 계약으로 고정한 패턴이다.

---

## §4. 실패 코드 확장

`OrderFailureCode` 유니온에 4개를 더한다. 기존 5개는 건드리지 않는다.

```
  | "COUPON_NOT_FOUND"
  | "COUPON_EXPIRED"
  | "COUPON_MINIMUM_NOT_MET"     // + requiredMinimum: number
  | "COUPON_EXHAUSTED"
```

전부 `409`다 — 요청 자체는 형식적으로 온전하고, 서버 상태가 그것에 동의하지 않는 것이므로 기존 5개와 같은 분류다(REQ-DISCOUNT-013). `COUPON_MINIMUM_NOT_MET`만 추가 필드를 갖는데, `INSUFFICIENT_STOCK`이 `products`를, `PRICE_CHANGED`가 `totalAmount`를 싣는 것과 같은 이유다: 고객이 **행동으로 고칠 수 있는** 실패이므로 얼마가 모자란지 알려줘야 한다.

---

## §5. 화면 (plan.md §0 확정 #1 반영)

이 SPEC이 **최소한의 입력란과 실패 문구까지** 만드는 것으로 확정되었으므로(plan.md §0 확정 #1), 이 절과 M6는 유지된다. 스타일링·레이아웃 개선은 여기에 들어오지 않으며 카드 `t10`이 뒤에 가져간다.

- `/checkout`은 이미 `itemsSubtotal` / `shippingFee` / `totalAmount`를 계산해 `OrderSummary`와 `CheckoutForm`에 내려준다. 여기에 `discountAmount`와 `couponCode`가 더해진다.
- 코드 적용은 **주문 제출과 별개의 왕복**이 필요하다(적용 결과를 보여준 뒤 제출해야 하므로). 검증 전용 엔드포인트를 하나 둔다: `POST /api/discounts/validate` — 코드와 `itemsSubtotal`을 받아 할인액 또는 거절 사유를 돌려주며, **아무것도 쓰지 않는다**(사용 횟수를 올리지 않는다).
- 이 엔드포인트는 편의일 뿐 **강제가 아니다**. 실제 강제는 주문 트랜잭션의 3b·3f다. 검증 엔드포인트가 통과시킨 코드가 주문 시점에 소진되었을 수 있으며, 그때는 주문이 정당하게 거절된다.
- 화면이 제출하는 `confirmedTotal`은 **할인 반영 후 금액**이다(AC-DISCOUNT-018).

**남용 방지 관찰**: 검증 엔드포인트는 코드의 존재 여부를 알려주므로 코드 추측에 쓰일 수 있다. 이 SPEC은 속도 제한을 도입하지 않으며, 그 사실을 research.md §5에 관찰로 남긴다 — 없는 방어를 있다고 하지 않기 위함이다.

---

## §6. 사용 시점과 해제 (plan.md §0 확정 #4 반영)

주문 생성 시점 증가 + 취소 웹훅 해제로 확정된 설계다(plan.md §0 확정 #4).

- **증가**: 주문 생성 트랜잭션 3f. 재고 차감과 같은 시점이므로 두 자원이 하나의 규칙을 공유한다.
- **해제**: SPEC-PAYMENT-001의 취소 트랜잭션(`payment-repository.ts:135-140`, 재고를 `increment`하는 그 루프)과 **같은 트랜잭션 안**에서 `redeemedCount`를 `decrement`한다. 주문의 `couponCode` 스냅샷으로 대상 쿠폰을 찾는다.
  - 쿠폰 행이 이미 삭제되었을 수 있다. 그 경우 해제는 **조용히 건너뛴다** — 존재하지 않는 쿠폰의 카운터를 되돌릴 수 없고, 그것이 취소 자체를 실패시킬 이유는 없다.
  - `decrement`는 `redeemedCount`가 0 미만으로 내려가지 않아야 한다. 취소는 반드시 증가가 선행하므로 정상 경로에서는 발생하지 않지만, 조건부 갱신(`where: { redeemedCount: { gt: 0 } }`)으로 방어한다.
- **해제되지 않는 경로**: 결제도 취소도 하지 않고 방치된 주문. 이 SPEC은 이를 인수하지 않는다(spec.md §3). `t21`과 같은 성격의 공백이다.

---

## §7. 테스트 전략

| 층 | 대상 | 비고 |
|---|---|---|
| 단위 | `discount-engine.ts` | 순수 함수이므로 목이 필요 없다. 경계값 중심: 내림(AC-007), 클램프(AC-008), 0원, 100% |
| 단위 | `discount-service.ts` | 레포지토리 목. 4종 거절 사유 각각 |
| 단위 | `coupon-repository.ts` | 트랜잭션 클라이언트 필수(싱글턴 기본값 없음) — `findStockByProductIds`의 선례를 따른다 |
| 통합 | 주문 생성 + 쿠폰 | 기존 인메모리 fake 트랜잭션 확장. 쿠폰 store 추가 |
| 동시성 | AC-DISCOUNT-016 | **살아 있는 PostgreSQL 필요**. SPEC-ORDER-002 REQ-ORDER-032의 선례대로 `DATABASE_URL` 도달 가능 여부로 게이트한다. 도달 불가면 건너뛴 사실과 사유를 `SKIPPED`로 기록하며, **PASS로 계산하지 않는다** — 건너뜀은 통과가 아니다(acceptance.md §I) |
| 정적 | AC-004, 020, 022 | grep / `git diff` 기반 |

동시성 테스트의 CI 승격은 SPEC-ORDER-002가 남긴 것과 **같은 공백**을 상속한다 — `.github/workflows/ci.yml`에 `services: postgres`가 없는 한 개발자 기계에서만 닫힌다. 이 SPEC은 그 사실을 기록하고 새로 해결하지 않는다.

---

## §8. 교차 참조

- plan.md §1 — `totalAmount`에 녹이는 결정과 기각된 대안
- plan.md §3 — 동시성 전략의 출처
- research.md — 조사 기록
- `order-repository.ts:129-139` — 조건부 원자 갱신 원본
- `payment-repository.ts:135-140` — 취소 시 복원 트랜잭션(해제가 얹힐 자리)
- `payment-service.ts:83` — 변경하지 않는 금액 관문
