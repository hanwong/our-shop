---
id: SPEC-ORDER-001
status: in-progress
updated: 2026-08-31
tier: L
---

# Plan: SPEC-ORDER-001 — 게스트 주문서 작성 화면 및 주문 생성 트랜잭션

## §0. 결정 기록 — run-phase 진입 전 확정 완료

아래 5건은 저장소·문서 어디에도 답이 없어 plan-phase에서 **추측하지 않고 질문으로 남겼던 항목**이며, 모두 확정되었다. #1과 #5는 사용자가 명시적으로 확인해 준 결정이고, #2~#4는 사용자 지시("잠정값으로 진행")에 따라 **이 plan-phase의 확정값**으로 채택한 잠정 결정이다. 잠정 결정은 재검토 가능하되, run-phase는 아래 값을 전제로 진행한다.

### #1 결제 SPEC과의 경계 — 주문 선생성 vs 결제 선승인

- **확정 (사용자 확인, 2026-08-31):** (A) **주문 먼저 생성, 결제는 별도**. 이 SPEC이 `pending_payment` 상태로 주문을 만들고 **주문 생성 시점에 재고를 차감**한다. 후속 결제 SPEC이 그 주문을 결제 완료 상태로 전이시킨다.
- **기각한 대안**: (B) 결제 승인이 먼저 나고 그 결과로 주문을 생성하는 순서. 기각 근거는 research.md `R3(c)` — 결제가 성사됐는데 물건이 없는 상태(환불을 수반하는 더 나쁜 실패)를 만들지 않는 쪽을 택했다.
- **이 결정이 고정하는 것**: 재고 차감 시점(주문 생성 시점)과 트랜잭션 경계. (B)였다면 서비스 계층 전체가 재작성 대상이었으므로, 이 확인이 M3의 전제다.

### #2 미결제 주문의 재고 해제 정책

- **질문이었던 것**: 결제되지 않은 채 남은 주문이 잡아둔 재고를 언제, 무엇이 되돌리는가(만료 시간, 실행 주체 — 배치/스케줄러/요청 시 지연 처리).
- **왜 필요해졌나**: #1의 확정(주문 생성 시점 재고 차감)에서 필연적으로 생기는 후속 요구다. 이 SPEC 자체는 범위 밖으로 두었지만(spec.md §3), **구멍이 있다는 사실 자체는 숨기지 않는다**.
- **잠정 결정 (재검토 가능):** 이 SPEC에서는 해제 정책을 만들지 않고 진행한다. 타임아웃 후 해제(release-after-timeout)를 향후 방향으로 두되, 만료 시간과 실행 주체는 후속 SPEC이 정한다. `Order.status`와 `createdAt`이 이미 있으므로 후속 SPEC이 추가 스키마 변경 없이 만료 작업을 붙일 수 있다.

### #3 배송비 정책

- **질문이었던 것**: 배송비가 정액인가, 금액 조건부 무료인가, 0원인가. `product.md`·`tech.md` 어디에도 언급이 없다.
- **잠정 결정 (재검토 가능):** 단일 정책 함수 `calculateShippingFee(itemsSubtotal)`로 격리하고 **0원**을 반환한다. 0원을 택하는 이유는 임의의 금액(예: 3,000원)을 발명하면 그 값이 테스트와 화면에 박혀 나중에 "결정된 값"처럼 보이기 때문이다. 함수와 `shippingFee` 컬럼은 실재하므로 정책이 정해지면 함수 본문 한 곳만 바뀐다. 이 값이 결정값처럼 굳는 위험은 §5 위험 표에 남겨 둔다.

### #4 게스트 주문 확인 수단 — 이메일 수집 여부

- **질문이었던 것**: 게스트가 나중에 주문을 다시 찾으려면 무엇으로 본인을 증명하는가(주문번호+연락처? 이메일?). 이메일을 받는다면 주문서 수집 항목이 하나 늘어난다.
- **왜 이렇게 정했나**: `tech.md`의 개인정보 최소 수집 원칙상 **당장의 목적이 없는 항목은 받지 않는 것이 맞고**, 이 SPEC 범위(주문 직후 1회 표시)에서는 이메일의 목적이 없다.
- **잠정 결정 (재검토 가능):** 이메일을 받지 않는다(REQ-ORDER-008). 주문 조회 SPEC이 이메일을 요구하면 그 SPEC이 수집 항목을 추가한다.

### #5 회원 체크아웃 — 이 SPEC에서 제외 (사용자 확인, 2026-08-31)

- **질문이었던 것이 아니라, 감사가 찾아낸 구조적 충돌이다.** plan-audit iteration 2가 확인했다: SPEC-AUTH-001의 REQ-AUTH-009가 액세스 토큰을 클라이언트 메모리에만 두므로 서버 렌더 페이지는 회원을 식별할 수 없고(`src/middleware.ts:18-31`), 로그인 시 게스트 쿠키가 무조건 만료되므로(`src/app/api/auth/login/route.ts:129`) 회원은 두 신원 중 어느 것도 제시하지 못한다. 증거 사슬 전문은 spec.md §3 첫 항목과 research.md §6.
- **확정 (사용자 확인):** **회원 체크아웃을 이 SPEC의 범위에서 제외한다.** 이 SPEC이 만드는 것은 게스트 체크아웃뿐이다. 회원 체크아웃은 SPEC-AUTH-001의 토큰 전송 설계와 **함께** 재검토해야 하는 별도 SPEC의 몫이다.
- **기각한 대안** (감사가 제시한 나머지 둘):
  - (b) 서버가 읽을 수 있는 세션 쿠키를 이 SPEC에서 도입 — SPEC-AUTH-001의 REQ-AUTH-009 전송 결정을 이 SPEC이 뒤집게 된다. 교차 SPEC 조정이 필요한 사안을 조용한 예외로 처리할 수 없다.
  - (c) 신원 해석을 클라이언트로 옮겨 `CheckoutForm`이 `Authorization` 헤더를 붙여 장바구니를 가져오게 함 — REQ-ORDER-005(최초 렌더에 브라우저 측 데이터 요청 없음)와 AC-ORDER-005(b)를 정면으로 뒤집는다.
- **이 결정이 고정하는 것**: 데이터 모델에서 `Order.userId`를 만들지 않고(design.md §1.4), 회원 자격 증명을 제시한 주문 제출을 거부하며(REQ-ORDER-021), 서버 컴포넌트의 신원 해석은 게스트 쿠키 읽기 하나로 줄어든다(design.md §6.1 — 직전 판의 `next/headers` 어댑터 설계는 이 결정으로 삭제되었다).
- **이 결정이 되돌리기 어려운 정도**: M1(스키마)에 닿으므로 이 문서에서 가장 비싼 결정이다. 되돌리려면 `guestId`의 `NOT NULL` 해제 + `userId` 추가 마이그레이션이 필요하며, 그 마이그레이션은 회원 체크아웃 SPEC이 소유한다.

### 관련 메모 — 주문서로 가는 진입 링크가 없다 (결정 사항 아님, 관측된 사실)

저장소에 장바구니 화면이 없어 `/checkout`으로 이어지는 링크가 존재하지 않는다(research.md §4). 이 SPEC은 링크를 만들지 않는다 — 만들면 장바구니 UI SPEC의 설계를 선점하게 된다. 검증은 주소 직접 진입으로 수행한다.

## §1. 개요 / 목표

`our-shop`에 **주문 도메인을 처음 도입**한다. 대상은 **게스트 체크아웃 하나**다(§0 #5). 산출물은 세 층이다.

1. **데이터**: `Order` / `OrderItem` 모델 + `OrderStatus` enum + 마이그레이션.
2. **도메인**: 주문 생성 트랜잭션(재고 재확인 → 가격 스냅샷 → 재고 차감 → 장바구니 비우기)과 멱등 처리, 그리고 회원 신원 거부 가드.
3. **화면**: `/checkout` 주문서(배송 정보 입력 + 주문 요약)와 `/checkout/complete/[orderId]` 완료 화면.

결제(PG) 연동은 범위 밖이며 주문은 `pending_payment`로 생성된다(spec.md §1, research.md §2).

## §2. 기술적 접근

설계 결정 전문은 **design.md**에 있다. 요약하면:

| 결정 | 내용 | design.md 위치 |
|---|---|---|
| 스냅샷 컬럼 | `OrderItem`이 `productName`·`unitPrice`·`lineTotal`을 보관 | §1.1 |
| FK 방향 | `OrderItem.product`는 `Restrict`(CartItem의 `Cascade`와 반대) | §1.2 |
| 귀속 신원 | `Order.guestId`(NOT NULL) 단일 컬럼. `userId` 없음 — 범위 경계를 스키마로 강제 | §1.4 |
| 도달 불가 분기 삭제 | `PRODUCT_GONE`을 만들지 않음(`CartItem.product`가 `Cascade`) | §1.5 |
| 트랜잭션 | `prisma.$transaction` 안에서 재조회→금액대조→조건부 차감→주문생성→카트삭제 | §2 |
| 트랜잭션 내 카트 접근 | 카트 리포지토리 **2개** 함수에 선택적 트랜잭션 클라이언트 인자 추가(질의 복제 기각) | §2.1 |
| 초과 판매 | `updateMany({ where: { id, stock: { gte: qty } } })`의 `count`로 판정 | §3 |
| 가격 확정 | 클라이언트 확인 금액 대조 후 불일치 시 409 | §4 |
| 멱등성 | 서버 발급 키 + `@unique` 제약 2단 방어 | §5 |
| 신원 — 읽기 경로 | 서버 컴포넌트는 `cookies()`로 게스트 쿠키만 읽는다. **어댑터 없음** | §6.1 |
| 신원 — 쓰기 경로 | 라우트 핸들러는 `resolveCartIdentity()` 재사용. 회원이면 409 거부 | §6.2 |
| 열람 인가 | 쿠키의 `guest_cart_id`와 `Order.guestId` 일치, 불일치 시 404 | §6.3 |

### structure.md 제안 구조와 의도적으로 다른 두 지점 (기록)

`.moai/project/structure.md`의 제안 구조와 이 SPEC의 배치가 두 곳에서 다르다. 둘 다 의도된 선택이므로 근거를 남긴다.

| 지점 | structure.md | 이 SPEC | 근거 |
|---|---|---|---|
| 도메인 디렉터리 | `features/checkout/`(체크아웃/PG 연동)과 `features/orders/`(주문/배송 상태)를 분리 | 전부 `features/orders/` | `features/checkout/`은 그 이름대로 **PG 연동 경계**를 담는 자리인데 이 SPEC은 PG를 다루지 않는다(spec.md §3). 배송 상태 역시 범위 밖이므로 지금 두 디렉터리를 만들면 둘 다 절반만 채워진다. 결제 SPEC이 `features/checkout/`을 자기 경계로 만드는 편이 낫다 |
| 라우트 그룹 | `app/(shop)/checkout/…` + 게스트 전용 `checkout/guest/page.tsx` | `app/checkout/…` 단일 폼 | 라우트 그룹 생략은 저장소의 기존 선례를 따른 것이다 — `src/app/products/…`가 이미 `(shop)` 없이 존재한다. 게스트 전용 화면을 **따로** 두지 않는 것은, 이 SPEC의 체크아웃이 애초에 게스트 전용이어서 "일반 폼과 게스트 폼"의 구분 자체가 성립하지 않기 때문이다(§0 #5) |

두 divergence 모두 되돌리기 싸다(디렉터리 이동). 반대로 지금 선점하면 결제·배송 SPEC의 설계를 앞질러 정하게 된다.

## §3. 마일스톤 (되돌리기 어려운 순)

앞쪽일수록 나중에 바꾸기 비싼 결정을 담고 있으므로, 리뷰 주의력을 M1~M3에 집중해야 한다.

### M1 — 데이터 모델 (가장 되돌리기 어려움)

- `prisma/schema.prisma`에 `OrderStatus` enum, `Order`, `OrderItem` 추가. `Product`에는 역참조 필드만 추가(기존 필드 무변경). **`User`는 건드리지 않는다**(design.md §1.4).
- `Order.guestId`는 `String`(NOT NULL). `userId`·`user` 관계·`@@index([userId])`는 **만들지 않는다**.
- 마이그레이션 생성.
- 산출물: `prisma/schema.prisma`, `prisma/migrations/*_add_order_models/migration.sql`
- 검증: `npm run prisma:validate`, 스키마 형태 단위 테스트(`tests/unit/orders/schema.test.ts` — 기존 `tests/unit/cart/schema.test.ts` 패턴). `User` 모델 diff 0줄 확인.

### M2 — 도메인 타입 및 리포지토리

- `src/features/orders/types/order.ts` — `OrderDTO`, `OrderItemDTO`, `ShippingInfo`, `CreateOrderInput`, 실패 코드 union(`MEMBER_CHECKOUT_UNSUPPORTED`·`CART_EMPTY`·`INSUFFICIENT_STOCK`·`PRICE_CHANGED`). `next/*`·`@prisma/client` 미의존(structure.md 레이어링 규칙).
- `src/features/orders/repositories/order-repository.ts` — 트랜잭션 클라이언트를 인자로 받는 형태(`tx: Prisma.TransactionClient`)로 작성해 서비스가 트랜잭션 경계를 소유하게 한다.
- **`src/features/cart/repositories/cart-repository.ts` — §4가 명시적으로 허용한 유일한 예외.** `findCartByGuestId`·`deleteCart` **두 함수에만** 기본값 `prisma`를 갖는 `client: Prisma.TransactionClient` 인자를 덧붙인다(design.md §2.1). 기존 호출부는 수정하지 않는다 — 인자가 선택적이므로 diff 0줄이어야 한다.
- **신원 어댑터 파일은 만들지 않는다.** 직전 판의 `src/features/orders/lib/server-identity.ts`는 회원 신원 해석을 위한 장치였고 §0 #5로 사라졌다(design.md §6.1).
- 검증: 리포지토리 단위 테스트(Prisma 클라이언트 모킹) + 카트 리포지토리 기존 테스트 무변경 통과 + 두 함수에 `tx`를 넘겼을 때 그 클라이언트로 질의가 나가는지 단언.

### M3 — 주문 생성 서비스 (이 SPEC의 핵심)

- `src/features/orders/services/order-service.ts`:
  - `createOrder(guestId, input)` — design.md §2의 6단계. 인자가 `CartIdentity` union이 아니라 게스트 id 문자열인 것은 §0 #5의 직접적 귀결이다.
  - `calculateShippingFee(itemsSubtotal)` — 잠정 0원(§0 #3).
  - `generateOrderNumber()`, `generateIdempotencyKey()`.
  - `getOrderForGuest(orderId, guestId)` — 완료 화면용, 불일치 시 null(→404).
- 실패 코드는 design.md §8 표 그대로.
- 검증: 서비스 단위 테스트 — 정상, 재고 부족, 금액 불일치, 빈 카트, 멱등 재제출, 검증 실패 각각.

### M4 — API 라우트 (회원 거부 가드 포함)

- `src/app/api/orders/route.ts` — `POST`. 신원 해석은 `resolveCartIdentity()` 재사용(design.md §6.2).
  - `identity.kind === "user"` → 409 `MEMBER_CHECKOUT_UNSUPPORTED`. 트랜잭션을 열지 않는다(REQ-ORDER-021).
  - 게스트 쿠키 신규 발급 시 응답에 부착(기존 카트 라우트와 동일 패턴).
- 검증: 라우트 단위 테스트(서비스 모킹) — 상태 코드/본문 매핑, JSON 파싱 실패 처리, **유효 Bearer 토큰 제시 시 거부**(AC-ORDER-022).

### M5 — 주문서 화면

- `src/app/checkout/page.tsx` — 서버 컴포넌트. **게스트 신원은 `cookies()`로 `GUEST_CART_COOKIE_NAME` 쿠키를 읽어 얻는다**(design.md §6.1). 쿠키 이름은 `@/lib/auth/guest-identity`에서 import하며 문자열 리터럴을 쓰지 않는다. 이어서 카트 서비스 직접 호출, 빈/부재 분기(REQ-ORDER-006), 멱등키 발급.
  - 쿠키가 없으면 조회할 게스트 id가 없으므로 곧바로 안내 화면으로 간다. 서버 컴포넌트는 쿠키를 발급하지 않는다.
  - 안내 화면 문구는 design.md §7.1의 계약(단정 금지 + 범위 고지)을 따른다.
  - 멱등키는 쿠키가 아니라 폼에 실려 나가는 값이므로 여기서 발급하는 데 제약이 없다.
- `src/components/checkout/OrderSummary.tsx` — 순수 프레젠테이션.
- `src/components/checkout/CheckoutForm.tsx` — `"use client"`. 입력·클라이언트 검증·제출·오류 표시.
- 검증: jsdom + Testing Library 컴포넌트 테스트(`next/headers`의 `cookies()` 모킹), 정적 소스 검사(초기 렌더에 `fetch`/`useEffect` 데이터 로딩 없음), AC-ORDER-021.

### M6 — 완료 화면

- `src/app/checkout/complete/[orderId]/page.tsx` — 서버 컴포넌트. M5와 같은 방식으로 게스트 쿠키를 읽어 `Order.guestId`와 대조 후 표시, 불일치·부재 시 `notFound()`.
- 검증: 컴포넌트 테스트(정상/다른 게스트 쿠키/쿠키 없음/회원 토큰만 제시/주문 부재, `cookies()` 모킹), `notFound()` 호출 여부 스파이.

### M7 — 통합 테스트 및 문서 정합

- `tests/integration/orders/create-order.test.ts` — 기존 `tests/integration/cart/guest-merge.test.ts`의 인메모리 fake 패턴을 확장해 `$transaction`·`updateMany` 지원 fake로 전체 경로 구동.
- 커버리지 임계값(lines 85 / functions 85 / branches 80 / statements 85) 유지 확인.

## §4. 변경하지 않는 것 (불변 조건)

run-phase에서 아래 파일을 **수정하지 않는다**. 수정이 필요해지면 그것은 이 SPEC의 범위 판단이 틀렸다는 신호이므로 멈추고 보고한다. 예외는 아래 §4.1 **단 한 건**이며, 그 경계까지 여기에 적는다 — 목록이 "금지되어 있지만 필요한" 상태를 남기지 않도록.

- `src/features/cart/**` — 카트 도메인은 소비만 한다. **§4.1의 두 함수만 예외.**
- `src/features/catalog/**`, `src/app/api/products/**` — 상품 계약은 소비만 한다.
- `src/lib/auth/**` — **완화 없음.** 이 SPEC은 `guest-identity.ts`가 이미 export하는 `GUEST_CART_COOKIE_NAME`을 **import만** 하고(design.md §6.1), `resolveCartIdentity()`를 **호출만** 한다. import·호출은 수정이 아니므로 이 디렉터리의 diff는 0줄이어야 한다.
- `src/middleware.ts` — `/checkout`은 보호 경로가 아니다(REQ-ORDER-007).
- `prisma/schema.prisma`의 `User` 모델 — 회원 귀속 컬럼을 만들지 않으므로 역참조도 필요 없다(design.md §1.4).
- `.env.example`, `package.json` dependencies — 결제 관련 추가 없음(spec.md §3).

### §4.1 유일한 예외 — 카트 리포지토리 2개 함수의 인자 추가

design.md §2의 트랜잭션은 카트와 그 항목·상품을 **트랜잭션 안에서** 읽고, 성립 후 카트 행을 **트랜잭션 안에서** 지워야 한다(원자성의 근거 자체). 그런데 `cart-repository.ts`의 함수들은 모듈 싱글턴에 묶여 있어 그대로는 `tx`로 실행할 수 없다. 대안은 질의 복제뿐인데, 그 파일이 스스로 `@MX:ANCHOR fan-in target ... authorization-boundary`라고 선언한 소유권 질의를 두 번째 사본으로 만드는 일이므로 기각했다(design.md §2.1의 대안 표).

따라서 **아래 2개 함수에 한해** `src/features/cart/**` 불변 조건을 연다.

| 파일 | 함수 | 허용된 변경 |
|---|---|---|
| `src/features/cart/repositories/cart-repository.ts` | `findCartByGuestId` | 기본값 `prisma`를 갖는 `client: Prisma.TransactionClient` 인자 추가 |
| 〃 | `deleteCart` | 〃 |

**`findCartByUserId`는 목록에서 빠졌다** — 직전 판에는 있었으나 회원 경로가 범위 밖이 되어 이 SPEC이 호출하지 않는다. 쓰지 않을 함수에 대해 불변 조건을 여는 것은 §5의 "구멍이 넓어짐" 위험만 키운다.

경계 조건(전부 diff로 확인 가능하며 acceptance.md §4 DoD 항목이다):

- 위 2개 **외의 함수는 건드리지 않는다** — `findCartByUserId`·`findProductForCart`·`findItemById`·`createUserCart`·`createGuestCart`·`promoteGuestCartToUser` 등 포함.
- `src/features/cart/` 하위의 **다른 파일은 건드리지 않는다** — `cart-service.ts`, `types/cart.ts` 변경 0건.
- **기존 호출부 diff 0줄** — 인자가 선택적이므로 카트 서비스와 로그인 병합 경로는 한 글자도 바뀌지 않는다. 바뀐다면 그것은 이 예외의 경계를 넘은 것이므로 멈추고 보고한다.
- 반환 타입·동작·기존 테스트 무변경.

이 범위를 넘는 카트 변경이 필요해지면 §4 본문의 원칙대로 **멈추고 보고한다**.

## §5. 위험

| 위험 | 영향 | 완화 |
|---|---|---|
| 실 PostgreSQL 부재로 트랜잭션 원자성 미검증 | 핵심 주장이 자동 검증되지 않음 | acceptance.md §0에서 관측 가능/불가능 분류. 초록불을 원자성 증거로 제시하지 않음 |
| 인메모리 fake가 `$transaction`을 흉내 내면서 롤백을 구현하지 않으면 테스트가 거짓 초록 | 위와 결합해 위험 증폭 | fake는 롤백을 **반드시 구현**하거나, 구현하지 않았다면 그 사실을 테스트 파일 상단 주석과 progress.md §E.2에 명시하고 해당 AC를 PASS로 계상하지 않음 |
| 확정된 #1(주문 선생성)이 결제 SPEC 착수 시 (B)로 뒤집힘 | M3 재작성 | 사용자 확인으로 (A) 확정되어 확률은 낮으나 0은 아니다. M1/M2 산출물은 어느 쪽에서도 재사용 가능하도록 설계(상태 필드만 두고 전이 로직 없음) |
| 배송비 0원이 잠정값에서 결정값처럼 굳음 | 잘못된 금액 출고 | 단일 함수 `calculateShippingFee()`로 격리 + §0 #3에 **잠정 결정(재검토 가능)** 표기 유지 |
| 주문 완료 후 사용자가 새로고침해 재주문 시도 | 중복 주문 | 멱등키는 제출 중복만 막는다. 카트가 비워졌으므로 재제출은 `CART_EMPTY` 409로 귀결 |
| §4.1로 연 카트 리포지토리 구멍이 run-phase에서 넓어짐 | 불변 조건이 사실상 무력화 | 대상 함수 2개를 이름으로 못 박고, "기존 호출부 diff 0줄"을 DoD의 기계적 확인 항목으로 둠. 초과 시 멈추고 보고 |
| 게스트 전용 경계가 코드에서 새어 회원 주문이 생성됨 | 그 회원이 열 수 없는 주문이 남는다(iteration 2 감사가 지적한 결함 그 자체) | 3중 방어: 스키마에 회원 컬럼 없음(§1.4) → 서비스가 게스트 id 문자열만 받음(M3) → 라우트가 회원 신원을 409로 거부(M4·AC-ORDER-022) |
| 서버 컴포넌트가 쿠키를 직접 읽어 신원 판정이 갈라짐 | authorization 표면이 둘로 나뉨 | 읽기 경로는 판정을 하지 않는다 — 토큰 검증·id 발급·신원 우선순위 전부 없고, 쿠키 이름조차 `src/lib/auth/`에서 import한다. AC-ORDER-021이 금지 토큰 매치 0건 + 리터럴 0건으로 정적 고정 |
| 로그인한 회원이 `/checkout`에서 원인을 모른 채 안내만 봄 | UX 혼란, 그리고 잘못하면 **거짓 안내** | 서버가 회원을 식별할 수 없으므로 맞춤 안내는 불가능. design.md §7.1의 문구 계약(장바구니가 비었다고 단정하지 않음 + 회원 체크아웃 부재 고지)을 AC-ORDER-006이 문자열로 고정 |

## §6. 안티패턴 (하지 말 것)

- 확정되지 않은 PG의 인터페이스를 "나중에 쉽게 붙이려고" 미리 추상화하지 말 것 — research.md §2 대안 A/B의 기각 사유.
- **회원 체크아웃을 "조금만" 지원하지 말 것** — `Order.userId`를 몰래 추가하거나, 회원 요청을 게스트로 강등해 주문을 만들거나, 세션 쿠키를 임시로 도입하는 것 전부 §0 #5의 위반이다. 필요하다고 판단되면 멈추고 보고한다.
- 트랜잭션 밖에서 재고를 읽고 안에서 쓰지 말 것 — 읽기/쓰기 창이 초과 판매를 허용한다.
- 클라이언트가 보낸 확인 금액을 저장 금액으로 사용하지 말 것 — 대조용 입력이지 지시가 아니다(design.md §4).
- 주문 열람 실패에 403을 반환하지 말 것 — 404가 SPEC-CART-001이 세운 선례다(design.md §6.3).
- 완료 화면에 결제 완료를 암시하는 문구를 쓰지 말 것 — 주문은 `pending_payment`다(REQ-ORDER-018).
- 카트 소유권 질의(`where: { guestId }` + `CART_INCLUDE`)를 주문 도메인에 복제하지 말 것 — §4.1이 인자 추가를 허용한 이유가 바로 그 복제를 피하기 위해서다(design.md §2.1).
- 서버 컴포넌트에서 토큰을 검증하거나 게스트 id를 발급하지 말 것 — 읽기 경로가 하는 일은 쿠키 하나 읽기가 전부다(design.md §6.1).
- 서버 컴포넌트가 쓸 `Request` 객체를 합성하지 말 것 — 그 어댑터는 회원 신원 때문에 있었고 §0 #5로 사라졌다. 되살리면 쓰지 않는 회원 분기가 함께 돌아온다.
- 안내 화면에 "장바구니가 비어 있습니다"라고 쓰지 말 것 — 회원에게는 거짓일 수 있다(design.md §7.1).
- 도달할 수 없는 상태를 위한 방어 코드를 쓰지 말 것 — `PRODUCT_GONE`을 삭제한 이유가 그것이다(design.md §1.5).

## §7. 교차 참조

- spec.md — 요구사항 REQ-ORDER-001~021, Out of Scope(첫 항목이 회원 체크아웃 제외 사유)
- research.md — 범위 조사 근거(결제 경계, 트랜잭션 필수 동작, UI 표면, 하네스 한계, §6 회원 신원 도달 불가)
- design.md — 스키마·트랜잭션·동시성·멱등성·신원/인가 설계
- acceptance.md — AC-ORDER-001~022 및 검증 수단 경계
- SPEC-CART-001 REQ-CART-015 / spec.md §3 — 이 SPEC이 인수한 유예 책임의 출처
- SPEC-AUTH-001 REQ-AUTH-009 — 회원 체크아웃을 제외하게 만든 토큰 전송 결정
- SPEC-STOREFRONT-001 plan.md §B/§C — 서버 컴포넌트에서 서비스 직접 호출, Tailwind v4 확정
