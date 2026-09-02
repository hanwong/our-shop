# Research: SPEC-DISCOUNT-001 — 쿠폰·할인 정책 계산 엔진

> plan-phase 조사 기록. 이 문서의 모든 주장은 **파일을 직접 열어 확인한 것**이며, 확인 수단(명령·경로·행 번호)을 함께 적는다. 확인하지 못한 것은 §5에 "확인하지 못한 것"으로 분리한다.

---

## §1. 할인 도메인의 부재 확인

```
$ grep -rniE "coupon|discount|promo" src prisma
src/features/cart/repositories/cart-repository.ts:201:export async function promoteGuestCartToUser(...)
src/features/cart/services/cart-service.ts:13:  promoteGuestCartToUser,
src/features/cart/services/cart-service.ts:294: *  - The member has no cart -> PROMOTE: ...
src/features/cart/services/cart-service.ts:314:    await promoteGuestCartToUser(guestCart.id, userId);
```

일치한 4건은 전부 `promoteGuestCartToUser` — 게스트 카트를 회원에게 넘기는 SPEC-CART-001의 함수이며 할인과 무관하다(`promote`가 `promo`를 포함해 걸린 것). **할인·쿠폰 개념은 이 저장소에 존재하지 않는다.**

`.moai/specs/` 목록에도 할인 도메인 SPEC이 없다: AUTH-001, CART-001, CATALOG-001/002, CI-001, ORDER-001/002, PAYMENT-001, STOREFRONT-001. 따라서 `SPEC-DISCOUNT-001`은 도메인 `DISCOUNT`의 첫 SPEC이며 REQ/AC 번호가 001에서 시작한다.

---

## §2. 금액 계산 경로의 전수 조사

할인이 침범하는 표면을 빠짐없이 찾기 위해 금액 식이 나타나는 곳을 모두 확인했다. **세 곳**이다.

| # | 위치 | 하는 일 | 할인 도입 시 |
|---|---|---|---|
| 1 | `src/app/checkout/page.tsx` | `itemsSubtotal = cart.subtotal` → `shippingFee` → `totalAmount`를 계산해 화면과 폼에 내려줌 | **변경 필요** — 표시 금액과 `confirmedTotal` |
| 2 | `src/features/orders/services/order-service.ts` 3단계 | 트랜잭션 안에서 재계산 후 `confirmedTotal`과 대조, 불일치 시 `PRICE_CHANGED` | **변경 필요** — 식과 대조 대상 |
| 3 | `src/features/payments/services/payment-service.ts:83` | `if (order.totalAmount !== amount)` → `AMOUNT_MISMATCH` | **변경 불필요** (§3) |

세 곳이 서로 독립적으로 같은 식을 재현한다는 점이 이 SPEC의 가장 큰 실패 위험이며, plan.md §6의 첫 리스크이자 design.md §2가 순수 엔진을 분리하는 이유다.

### 2.1 배송비가 상수 0이라는 결정적 사실

```
$ grep -n -A 4 "export function calculateShippingFee" src/features/orders/services/order-service.ts
69:export function calculateShippingFee(itemsSubtotal: number): number {
70:  void itemsSubtotal;
71:  return 0;
72:}
```

주석(64-67행)이 이유를 밝힌다 — "3,000 같은 지어낸 숫자는 아무도 실제로 내리지 않은 결정으로 굳어져 테스트·픽스처·화면으로 퍼진다. 실제 정책이 오면 이 함수 본문만 바뀐다."

**이 사실이 두 개의 질문을 닫는다**:
1. "할인이 배송비 앞인가 뒤인가" — 배송비가 0이므로 두 선택이 같은 숫자를 낸다. **관측 가능한 차이가 없으므로 열린 질문이 아니다.**
2. "무료배송 쿠폰을 지원하는가" — 줄일 금액이 없다. 지원하면 **성공과 실패를 구별할 관측이 존재하지 않는 기능**이 된다.

---

## §3. 결제 금액 관문의 성질

```
$ grep -n "totalAmount !== amount" -B 3 -A 3 src/features/payments/services/payment-service.ts
83:  if (order.totalAmount !== amount) {
```

주석(67행): "순서가 load-bearing이다 — 금액 검사는 **어떤 Toss 호출보다 먼저** 실행된다." 그리고 33행에 `@MX:REASON amount verification MUST run before any external confirm-API` 앵커가 걸려 있다.

이 코드는 `order.totalAmount`가 **어떻게 만들어졌는지 묻지 않는다**. 주문에 적힌 금액과 PG가 말한 금액을 비교할 뿐이다. 따라서 할인을 `totalAmount`에 미리 녹여 넣으면 이 파일은 변경 대상이 아니다 — plan.md §1이 A안을 채택한 결정적 근거이며, AC-DISCOUNT-020이 `git diff`로 그 무변경을 검증한다.

반대로 "정가를 저장하고 결제 때 할인" 방식(B안)을 택하면 이 `@MX:REASON`이 지키는 코드를 고쳐야 한다. 저장소에서 가장 보안 민감하다고 명시된 지점을 할인 기능을 위해 건드리는 것은 위험 대비 이득이 없다.

---

## §4. 동시성과 되돌림 선례

### 4.1 조건부 원자 갱신 (차용 대상)

`order-repository.ts:129-139`의 재고 차감이 `updateMany` + `where` 조건 + 영향 행 수 검사 형태로 되어 있고, SPEC-ORDER-002가 이를 REQ-ORDER-022로 **계약 고정**했다. 쿠폰 사용 상한은 같은 모양의 문제(카운터 + 상한 + 경쟁)이므로 전략을 새로 고르지 않고 차용한다.

### 4.2 취소 시 복원 자리가 이미 있다

```
$ grep -rn -A 3 "increment: item.quantity" src/features/payments/repositories/payment-repository.ts
135:  for (const item of items) {
136:    await tx.product.update({
137:      where: { id: item.productId },
138:      data: { stock: { increment: item.quantity } },
```

결제 취소가 재고를 되돌리는 트랜잭션이 이미 존재한다. 따라서 쿠폰 사용분 해제(REQ-DISCOUNT-021)는 **새 실행 축(스케줄러 등)을 요구하지 않고** 이 루프 옆에 얹힌다. 이 사실이 (A)안의 비용을 낮추었고, plan.md §0 확정 #4가 그 안으로 결정되었다.

### 4.3 되돌려지지 않는 경로 — `t21`과 같은 공백

`moai todo`에 카드 `t21`이 있다: "결제 안 한 주문(pending_payment)의 재고 점유를 시간 경과로 해제하는 소유자 없음 — SPEC-ORDER-001·SPEC-PAYMENT-001 사이에서 인수되지 않음". SPEC-ORDER-002 plan.md §0이 이를 범위 밖으로 두고 `t21`에 넘겼다.

쿠폰도 **정확히 같은 공백**을 갖는다. 새로운 문제가 아니라 기존 공백이 자원 하나를 더 갖게 되는 것이므로, 이 SPEC이 독자적 해법을 발명할 이유가 없다.

---

## §5. 신원 제약 — 인별 제한이 불가능한 이유

스키마의 `Order`에는 `userId` 컬럼도 `user` 관계도 **없고**, `guestId`가 NOT NULL이다. 스키마 주석이 그 의도를 명시한다: "범위 경계를 산문이 아니라 **여기서** 강제한다 — 회원 소유 주문은 표현 불가능하다."

SPEC-ORDER-001 v0.2.0의 HISTORY가 배경을 설명한다: REQ-AUTH-009가 액세스 토큰을 클라이언트 메모리에만 두므로 서버 렌더 페이지는 회원을 식별할 수단이 없고, 로그인 시 게스트 쿠키가 만료되므로(`login/route.ts:129`) 회원은 두 신원 중 어느 것도 서버에 제시하지 못한다. 이는 **문구 수정으로 해소되지 않는 설계 충돌**로 판정되어 회원 체크아웃이 범위에서 제외되었다.

결과: 주문의 유일한 신원은 쿠키에서 온 `guestId`다. **쿠키를 지우면 새 사람이 된다.** 따라서 "1인 1회" 제한은 이 저장소에서 강제할 수 없으며, 강제하는 척하는 구현은 우회 비용이 거의 0인 방어를 위해 코드를 늘리면서 **잘못된 안심**을 만든다. 이것이 REQ-DISCOUNT-022가 "주장 자체를 금지"하는 요구사항인 이유다.

관련 백로그: 카드 `t18`("서버 렌더링 화면에서 로그인 상태 확인하는 방법 설계 — SPEC-AUTH-001 메모리 전용 토큰과의 구조적 충돌 해결")이 이 제약의 근본 원인을 추적하고 있다. 인별 제한은 `t18`이 해소된 뒤에야 논할 수 있다.

---

## §6. UI 자리 확인 — 오래된 전제의 반증

조사 착수 시점의 전제는 "SPEC-ORDER-002 시점 기준 `src/app/`에 장바구니/체크아웃 화면이 없다"였다. **이 전제는 현재 성립하지 않는다.**

```
$ find src/app -type f
src/app/checkout/page.tsx
src/app/checkout/complete/[orderId]/page.tsx
src/app/products/[productId]/page.tsx
... (그 외 API 라우트)
```

`/checkout`은 SPEC-ORDER-001 M5가 만든 실제 화면이며 `CheckoutForm` + `OrderSummary`를 렌더하고 `itemsSubtotal`/`shippingFee`/`totalAmount`를 계산해 내려준다. **쿠폰 입력란이 들어갈 자리는 이미 있다.**

다만 `moai todo`의 카드 `t10`("장바구니·체크아웃 화면 UI")이 이 화면의 UI를 별도로 다루기로 되어 있어 **소유권이 겹쳤다** — 없는 것은 자리가 아니라 소유권 합의였다. 그 합의는 plan.md §0 확정 #1로 이루어졌다: 이 SPEC이 최소한의 입력란과 실패 문구를 만들고, `t10`이 뒤에 재작업한다.

---

## §7. 관리자 저작 기능의 선례

`Category` 모델 주석: "Prisma enum이 아니라 **테이블**로 모델링한 이유는, 미래의 admin SPEC이 스키마 마이그레이션과 배포 없이 데이터 변경만으로 카테고리를 추가·개명할 수 있게 하기 위함이다."

즉 이 저장소는 **도메인 SPEC이 관리자 저작 기능을 떠안지 않고 데이터 구조만 준비해 두는** 패턴을 이미 쓰고 있다. 백로그의 `t11`·`t12`가 그 admin SPEC 자리를 차지하고 있다. 쿠폰도 같은 패턴을 따른다: 모델은 이 SPEC이 만들고, 저작 화면은 admin SPEC이 만든다.

---

## §8. 확인하지 못한 것 (Gaps)

정직하게 남긴다. 아래는 이 조사가 **확인하지 않은** 것이며, 확인했다고 주장하지 않는다.

- **테스트를 실행하지 않았다.** plan-phase는 코드를 바꾸지 않으므로 테스트·타입체크·lint를 실행하지 않았다. "기존 테스트가 전부 통과한다"는 주장은 이 문서 어디에도 없으며, AC-DISCOUNT-019가 run-phase에서 실제로 관측할 항목이다.
- **`moai spec lint`를 실행하지 않았다.** 프론트매터 12필드와 Out of Scope 절 형식은 스키마 문서와 SPEC-ORDER-002의 통과 선례를 대조해 맞췄으나, 린트 도구의 출력을 관측하지는 않았다.
- **조사 시점(plan-phase 1차 작성 시점) 기준 — 이 문서를 쓸 당시에는 plan-audit 판정이 없었다.** 그 이후의 plan-audit 이력은 `progress.md` §E.1에 기록되며, 이 문서는 그 이력을 따라 갱신되지 않는다 — 최신 판정은 `progress.md`를 직접 확인해야 한다.
- **살아 있는 데이터베이스에 접속하지 않았다.** 스키마 파일은 읽었으나 실제 DB의 상태(적용된 마이그레이션, 기존 행 수)는 확인하지 않았다.
- **검증 엔드포인트의 남용 위험을 방어하지 않는다.** design.md §5의 `POST /api/discounts/validate`는 코드의 존재 여부를 노출하므로 코드 추측(enumeration)에 쓰일 수 있다. 이 SPEC은 속도 제한을 도입하지 않으며, 따라서 **그 방어가 있다고 주장하지 않는다.** 속도 제한이 필요하다고 판단되면 별도 카드로 다뤄야 한다.
- **`t10`의 실제 범위를 읽지 않았다.** 카드 제목만 확인했으며 그 카드에 딸린 상세 계획은 존재하지 않는다(SPEC이 아직 없음). plan.md §0 확정 #1이 정한 UI 경계는 결정으로 확정되었으나, **`t10`과 겹치는 범위의 크기 추정은 여전히 카드 제목에만 근거한다** — 결정이 이 관측 공백을 메우지는 않는다.
