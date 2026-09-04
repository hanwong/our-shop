# Research: SPEC-ADMIN-002 — 관리자 상품 등록/수정 백오피스

조사 대상은 세 가지다. (1) `Product` 도메인의 현재 모양과 이 SPEC이 추가할 컬럼이 부딪히는 지점, (2) `SPEC-ADMIN-001`이 남긴 관리자 세션·CSRF·경로 관례를 그대로 재사용할 수 있는지, (3) **소프트 삭제 컬럼 추가가 이미 완료된 고객 대면 카탈로그(SPEC-CATALOG-001/002)에 미치는 연쇄 효과**. 세 번째가 이 SPEC의 진짜 어려운 부분이며 §5에서 별도로 다룬다.

---

## §1. `Product` 모델의 현재 모양 (`prisma/schema.prisma:105~134`)

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  price       Int      // KRW minor-unit-free integer — not Decimal
  description String
  images      String[] // image URLs; array order is display order
  stock       Int      @default(0)
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  cartItems   CartItem[]
  orderItems  OrderItem[]   // FK 쪽이 Restrict

  @@index([categoryId])
  @@index([createdAt])
  @@index([price])
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin, map: "product_name_trgm_idx")
}
```

확인한 사실:

- **가시성/삭제 표시 컬럼이 없다.** `isActive`, `deletedAt`, `publishedAt` 같은 필드가 어디에도 없다 — 지금까지 "상품이 존재한다 = 팔린다"였다.
- **할인가/세일가 컬럼이 없다.** 가격은 `price` 하나뿐이다. `SPEC-DISCOUNT-001`이 쿠폰을 주문/코드 레벨(`Coupon`, `Order.couponCode`)로만 모델링했으므로, 상품별 할인은 이 저장소에 개념 자체가 없다 — 이 SPEC이 만들 이유도 없다(`SPEC-DISCOUNT-001` spec.md §3 "Out of Scope — 특정 상품·카테고리 한정 쿠폰").
- **낙관적 잠금(version) 컬럼이 없다.** `stock`은 `SPEC-ORDER-001`의 주문 생성 트랜잭션이 조건부 갱신으로, `SPEC-ADMIN-001`의 `cancelOrderAsAdmin()`이 `increment`로 각각 다룬다 — 둘 다 별도의 버전 컬럼 없이 동작한다. §6 잔여 위험에서 다시 다룬다.
- **`images`는 URL 문자열 배열이다.** 저장소 전체를 훑어봐도 파일 업로드 파이프라인(멀티파트 파서, S3/R2 클라이언트, `next/image` 로더 설정 이상의 무엇)은 존재하지 않는다. URL을 어디서 얻는지는 애플리케이션 밖의 문제로 남아 있다.

### FK 방향의 비대칭 (이 SPEC의 삭제 의미론을 결정한다)

| 관계 | onDelete | 결과 |
|---|---|---|
| `OrderItem.product` | `Restrict` | **주문된 적 있는 상품은 DB 레벨에서 물리 삭제 불가.** 스키마 주석이 이유를 직접 적고 있다 — "an order line is an accounting record and must not be destroyed by a product deletion" |
| `CartItem.product` | `Cascade` | 상품이 삭제되면 모든 장바구니에서 그 항목이 조용히 사라진다 |

즉 물리 삭제(`prisma.product.delete`)는 이 도메인에서 두 방향 모두로 나쁘다: 주문 이력이 있으면 아예 실패하고(`Restrict`), 성공하는 경우에도 고객 장바구니가 예고 없이 줄어든다(`Cascade`). **소프트 삭제 결정(사용자 확정 사항 #2)은 이 비대칭에 대한 정확한 대응**이며, 새로운 선호가 아니라 스키마가 이미 요구하고 있던 것이다.

`SPEC-CART-001` plan.md §8이 이 점을 미리 기록해 두었다:

> `CartItem.productId`에 `onDelete: Cascade`를 걸었다 — 상품이 삭제되면 모든 카트에서 해당 항목이 조용히 사라진다. 이번 SPEC은 상품 삭제 API를 만들지 않으므로 즉시 발동하지 않지만, **향후 관리자 상품 삭제 SPEC이 이 동작을 재검토할 수 있음**을 기록해 둔다.

이 SPEC이 그 "향후 SPEC"이다. 재검토 결과: **`Cascade`를 바꾸지 않는다** — 소프트 삭제를 택했으므로 `product.delete`가 호출되는 경로 자체가 생기지 않고, 따라서 `Cascade`는 영원히 발동하지 않는다. FK 방향을 손대는 것은 `SPEC-CART-001` 소유 스키마 결정을 뒤집는 일이며, 발동하지 않는 동작을 위해 그럴 이유가 없다.

## §2. `Category`가 enum이 아니라 테이블인 이유 — 이 SPEC이 수혜자

`prisma/schema.prisma:89~99`의 주석이 명시적이다:

> Modelled as a TABLE rather than a Prisma enum (plan.md §2.1) so that **a future admin SPEC can add or rename categories with a data change instead of a schema migration + deploy**.

`SPEC-CATALOG-001` spec.md §3 "Out of Scope — 카테고리 관리 API"도 같은 결론이다:

> `Category` 생성/수정/삭제 API는 이번 SPEC 범위 밖이다. `Category` 테이블은 존재하지만 값을 채우는 시드 스크립트 또는 **후속 관리자 SPEC**은 별도 범위다.

주의할 점: 이 두 문장은 "미래의 관리자 SPEC이 카테고리 CUD를 만들 수 있다"는 **가능성**을 열어둔 것이지, 이 SPEC(`t11`)이 그것을 인수한다는 위임이 아니다. 사용자 확정 사항 #3이 카테고리 CUD 화면을 명시적으로 범위 밖으로 두었으므로, 이 SPEC은 **읽기만** 한다 — 상품 폼의 `<select>`가 기존 `Category` 행을 나열할 뿐이다.

기존 카테고리 조회 함수는 `findCategoryIdBySlug(slug)` 하나뿐이다(`src/features/catalog/repositories/category-repository.ts`). 전체 목록을 반환하는 함수는 없으므로, 관리자 폼용 목록 조회는 이 SPEC이 관리자 쪽 저장소에 새로 만든다(§4의 자기 완결 원칙).

## §3. `SPEC-ADMIN-001`이 남긴 재사용 가능한 관례

`SPEC-ADMIN-001` spec.md §3이 이 SPEC을 명시적으로 지목한다:

> ### Out of Scope — 상품/카탈로그 관리자 화면 (별도 백로그 카드)
> - 상품 등록·수정·재고 조정 관리자 화면과 API는 범위 밖이다(`product.md` 핵심 기능 #6의 다른 절반).
> - 넘긴 곳: 백로그 카드 `t11`("관리자 상품 등록/수정 백오피스"). **이 SPEC이 만드는 관리자 세션 판정 로직(REQ-ADMIN-001~003)은 `t11`이 그대로 재사용할 수 있게 설계한다**(design.md §1).

design.md §1도 같은 말을 한다: "이 경로 선택은 `t11`(관리자 상품 백오피스, 후속 SPEC)이 그대로 재사용할 수 있는 관례를 만든다 — `/staff/products`, `/admin/api/products` 형태로 확장 가능."

### 재사용 대상 (읽고 확인한 실제 코드)

| 자산 | 위치 | 확인한 시그니처/동작 |
|---|---|---|
| 관리자 세션 판정 | `src/features/admin/services/admin-session.ts:50` | `resolveAdminSession(cookieStore: AdminCookieStore): Promise<AdminSession \| null>`. `refresh_token` 쿠키 원문 → `hashRefreshToken()`(import) → `prisma.refreshToken.findFirst` → `revokedAt`/`expiresAt`/`role !== "admin"` 검사 → 전부 `null`로 수렴(사유 은닉). **쓰기 쿼리 0건** |
| 페이지 게이팅 패턴 | `src/app/staff/orders/page.tsx:1~30` | `const jar = await cookies(); const session = await resolveAdminSession(jar); if (session === null) redirect("/staff/login");` — 데이터 조회 **이전**에 수행 |
| 쓰기 라우트 호출 순서 | `src/app/admin/api/orders/[orderId]/status/route.ts:43~73` | ① `verifyCsrfRequest(request)` (DB 접근 전) → ② **새로** `resolveAdminSession()` → ③ 본문 검증 → ④ 트랜잭션. CSRF 실패와 세션 실패가 **같은 403 + 같은 본문**(`Not authorized`)으로 응답 |
| CSRF | `src/lib/auth/csrf.ts:130` | `verifyCsrfRequest(request): boolean` — `csrf_token` 쿠키 vs `X-CSRF-Token` 헤더 더블서브밋. 쿠키는 `POST /api/auth/login`이 발급(`login/route.ts:98~102`) |
| 클라이언트 CSRF 토큰 읽기 | `src/app/staff/orders/[orderId]/CancelOrderButton.tsx:24~28` | `document.cookie.match(/(?:^\|;\s*)csrf_token=([^;]*)/)` — 쿠키가 httpOnly가 아니라 가능 |
| 페이지네이션 상수 | `src/features/admin/types/admin.ts:16~22` | `DEFAULT_PAGE=1`, `DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=100` — `product.ts`의 값을 그대로 복제해 둔 것 |
| 목록 저장소 형태 | `src/features/admin/repositories/admin-order-repository.ts:67~90` | `Promise.all([findMany, count])` 병렬 + `[{createdAt:"desc"},{id:"asc"}]` 안정 정렬. `findProductsPage`와 같은 모양 |

### 확인한 부재 — 공유 관리자 레이아웃/네비/테이블 컴포넌트가 없다

`src/features/admin/`은 파일 3개(`types/admin.ts`, `repositories/admin-order-repository.ts`, `services/admin-session.ts`)가 전부다. `src/components/`에도 admin 하위 디렉터리가 없다(`cart/`, `checkout/`, `orders/`, `product/`만 존재). `/staff/*` 페이지 3장(`login` 120줄, `orders` 178줄, `orders/[orderId]` 159줄)은 각자 자기 안에서 Tailwind 마크업·`formatWon`·`STATUS_LABEL`을 직접 들고 있는 **자기 완결형**이다 — 심지어 `formatWon`은 `ProductDetailView`의 같은 함수를 복제한 것이라고 주석이 스스로 밝힌다.

`GET /admin/api/orders` 라우트도 **일부러 만들지 않았다**. `SPEC-ADMIN-001` design.md §3:

> `/staff/orders`(page.tsx)는 Server Component로 (…) `listOrdersForAdmin()`을 **직접 호출**한다(중간에 자기 자신의 API를 fetch하지 않는다 — 서버 컴포넌트가 굳이 네트워크 왕복을 만들 이유가 없다). (…) 향후 `t11` 같은 다른 화면이나 외부 도구가 같은 목록 조회가 필요해지면, **그때 별도 SPEC 또는 이 SPEC의 후속 확장으로 추가한다**.

즉 목록 API 라우트의 필요 여부 판단이 이 SPEC에 넘어와 있다. 판단은 design.md §3에 기록한다(결론: 만들지 않는다 — 판단 근거도 동일하다).

## §4. `SPEC-ADMIN-001`이 채택한 "자기 완결" 원칙

`admin-order-repository.ts`는 `order-repository.ts`를 import하지 않고 자기 Prisma 쿼리를 직접 쓴다. `types/admin.ts`도 `OrderDTO`/`ShippingInfo`를 재사용하지 않고 `AdminOrderDetailDTO`를 따로 정의하며, 그 이유를 주석이 직접 적는다:

> 이 SPEC의 admin 모듈은 **일부러** orders 기능의 타입에 의존하지 않는다(admin-order-repository.ts가 order-repository.ts를 import하지 않고 자기 Prisma 쿼리를 도는 것과 같은 이유).

`cancelOrderAsAdmin()`이 `payment-repository.ts`의 재고 복원 로직을 재사용하지 않고 복제한 것도 같은 원칙의 연장이다(design.md §4가 WET 트레이드오프를 명시적으로 인정). 이 SPEC도 같은 원칙을 따른다 — 관리자 상품 조회는 `product-repository.ts`를 호출하지 않고 관리자 쪽에 자기 쿼리를 둔다. **단, §5의 고객 대면 필터만은 예외**다(그건 재사용이 아니라 확장이고, 다른 선택지가 없다).

---

## §5. 핵심 조사 — `isActive` 추가가 완료된 카탈로그에 미치는 연쇄 효과

이 절이 이 SPEC의 사전 조사에서 가장 중요한 부분이다. 소프트 삭제를 도입하면서 고객 대면 조회를 그대로 두면, **관리자 화면의 "삭제" 버튼이 고객에게 아무 효과가 없다** — 기능이 작동하지 않는 것이다.

### §5.1 고객 대면 상품 노출 경로 전수 조사

`grep`으로 `findProductsPage` / `findProductById` / `findProductForCart`의 모든 호출부를 열거했다:

| 조회 함수 | 호출부 | 그 위의 표면 |
|---|---|---|
| `findProductsPage` | `product-service.ts:206` (`getProductList`) | `GET /api/products` (공개 API). **목록 화면은 아직 없다** — `src/app/products/`에는 `[productId]/`만 있고 `page.tsx`가 없으며, 홈(`src/app/page.tsx`, 23줄)은 상품 상세 링크 하나짜리 스텁이다(`SPEC-STOREFRONT-001` §3이 목록 화면을 명시적으로 범위 밖에 둠) |
| `findProductById` | `product-service.ts:228` (`getProductDetail`) | `GET /api/products/[productId]` (공개 API) **및** `/products/[productId]` 페이지(`page.tsx:28` → 실패 시 `notFound()`) |
| `findProductForCart` | `cart-service.ts:194` (담기), `cart-service.ts:258` (수량 변경) | `POST /api/cart/items`, `PATCH /api/cart/items/[itemId]` |
| (없음 — 스냅샷) | — | 주문 이력은 `OrderItem.productName`/`unitPrice`/`lineTotal` **스냅샷 컬럼**을 읽는다(`schema.prisma:289~296`). `Product`를 조인하지 않는다 |

마지막 행이 결정적이다. `OrderItem`은 주문 시점의 상품명·단가·합계를 컬럼으로 복사해 저장하며, 주석이 이유를 직접 적는다 — "Joining Product would give the CURRENT values; an order needs the ones the shopper agreed to." **따라서 고객 대면 상품 조회에 필터를 걸어도 주문 이력·주문 상세 화면은 전혀 영향받지 않는다.**

### §5.2 조사 질문 ① — 목록 조회에 필터가 필요한가

**필요하다.** `findProductsPage`는 `where`를 `findMany`와 `count` 양쪽에 같은 객체로 넘기므로(`product-repository.ts:98~112`), 필터를 걸면 `totalCount`와 페이지네이션이 자동으로 일관되게 좁혀진다. 반대로 서비스 레이어에서 결과 배열을 사후 필터링하면 `totalCount`가 필터 이전 값이라 페이지 수가 어긋난다 — **저장소 레이어가 유일하게 맞는 위치다.**

검토한 세 가지 방식:

| 방식 | 판정 |
|---|---|
| (a) `where`에 `isActive: true`를 **무조건** 추가 (시그니처 무변경) | **채택.** 호출부 수정 0건. 미래에 새 호출부가 생겨도 자동으로 안전 — 빠뜨릴 수 있는 옵트인 플래그가 없다 |
| (b) `includeInactive?: boolean` 인자 추가(기본 false) | 기각. 관리자 쪽은 §4 원칙대로 자기 쿼리를 쓰므로 이 탈출구를 쓸 소비자가 **하나도 없다**. 쓰지 않을 매개변수를 공개 API에 뚫는 것은 순수 부채 |
| (c) 서비스 레이어(`product-service.ts`)에서 사후 필터 | 기각. `totalCount`가 어긋난다(위 문단) |

**(a)의 알려진 비용 — 기존 테스트 9건의 기댓값이 깨진다.** `tests/unit/catalog/product-repository.test.ts`가 `where` 객체를 `toEqual`로 **정확 일치** 비교하고(6건), 상세 조회 테스트는 `findUnique` 모킹에 묶여 있다(3건). 파일을 읽어 확인한 전체 목록:

`findProductsPage`의 `where` `toEqual` 6건 — `isActive: true` 키가 하나 늘어나므로 전부 실패한다:

- `:111`·`:112` — `expect(...where).toEqual({ categoryId: "cat-tops" })` ("filters findMany AND count by the same categoryId…")
- `:119`·`:120` — `expect(...where).toEqual({})` ("applies no where filter when no categoryId is supplied")
- `:132` — `expect(where).toEqual({ name: { contains: "denim", mode: "insensitive" } })` ("matches name with a case-insensitive substring filter, never description" — `SPEC-CATALOG-002` 소유 검색 테스트)
- `:149~152` — `toEqual({ categoryId: "cat-tops", name: {…} })` ("[AC-CATALOG-021] composes search AND category into one where clause" — `SPEC-CATALOG-002` 소유)
- `:168` — `toEqual({})` ("leaves the where clause empty when search is absent (REGRESSION — AC-CATALOG-029)")
- `:186~188` — `toEqual({ name: { contains: "50%_off'", mode: "insensitive" } })` ("passes a term containing SQL wildcards through as a bound parameter" — `SPEC-CATALOG-002` 소유)

`findProductById`의 `findUnique` 모킹 결속 3건 + 모킹 셋업:

- `:20`/`:28`/`:39` + `:197~198`·`:216`·`:221~223` — 모킹 셋업이 `prisma.product.findUnique`만 두고 있어 `prisma.product.findFirst`가 `undefined`이고, `findProductById` 테스트 3건이 `findUnique.mock.calls`를 검사한다. §5.4의 상세 필터는 `findFirst` 치환을 요구하므로(unique 아닌 조건 결합) 모킹을 **먼저** 추가하지 않으면 호출 즉시 TypeError로 죽는다 — 모킹과 그 3건을 함께 갱신해야 한다

깨지지 **않는** 인접 테스트: `:161`(`[AC-CATALOG-024]`)은 두 `where`를 서로 비교하므로 양쪽에 같은 키가 늘어도 통과하고, `:176~177`은 `toMatchObject`와 `orderBy`만 본다. 합계 6 + 3 = **9건**. 위치별 갱신 방향은 design.md §3의 표에 있다.

이건 **요구사항 변경이 아니라 기댓값 갱신**이다. `AC-CATALOG-029`가 지키려던 것은 "검색어가 없으면 검색 조건이 붙지 않는다"이지 "`where`가 영원히 빈 객체다"가 아니다. run-phase에서 각 기댓값을 `{ isActive: true }` / `{ categoryId: "cat-tops", isActive: true }` 형태로 갱신하고, 각 갱신에 이 SPEC의 REQ 번호를 주석으로 남긴다. `SPEC-CATALOG-001/002`의 spec.md·acceptance.md 본문은 **건드리지 않는다**(그건 완료된 SPEC의 요구사항 변경이며 이 SPEC의 권한 밖이다).

선례 대조: `SPEC-ADMIN-001`은 `PaymentEventSource`(SPEC-PAYMENT-001 소유 enum)에 값 하나를 **순수 추가**했고, 기존 두 값의 의미·사용처는 바꾸지 않았다(plan.md §2). 같은 **방향**(소유 SPEC의 계약에 최소 추가)의 EXTEND다 — 기존 동작(활성 상품의 목록·정렬·검색·페이지네이션)은 문자 그대로 그대로이고, 비활성이라는 **새 상태의 취급만** 정의한다. 다만 성격이 같다고까지는 할 수 없다: enum 값 추가는 기존 소비자에게 영향이 없어 깨뜨린 테스트가 **0건**이었던 반면, 이번 확장은 기존 함수의 반환 집합을 좁히므로 기댓값 갱신 **9건**을 동반한다.

### §5.3 조사 질문 ② — 장바구니에 이미 담긴 상품이 비활성화되면?

**기존 검증이 이것을 우연히 막아주지 못한다. 진짜 새 공백이다.** 코드를 두 지점에서 확인했다.

**담기 경로** (`cart-service.ts:194~213`):
```ts
const product = await findProductForCart(productId);   // select: { id, price, stock } — 가시성 개념 없음
if (product === null) { ... 400 }
if (alreadyHeld + quantity > product.stock) { ... 400 }
```
`findProductForCart`(`cart-repository.ts:131~139`)는 `{ id, price, stock }` 세 컬럼만 읽는다. 비활성 상품이라도 `stock > 0`이면 담기가 성공한다.

**체크아웃 경로** (`order-service.ts:474~510`, 트랜잭션 내부):
1. 카트 재조회 → 비었으면 409
2. `quantity < 1` 같은 데이터 이상 → 500
3. 가격 재계산 → 쿠폰 검증 → 조건부 재고 차감
4. 재고 부족 시 `REQ-ORDER-025/026`에 따라 부족 품목을 나열해 거부

**어느 단계도 상품의 판매 가능 여부를 묻지 않는다.** 검증하는 것은 오직 재고 숫자다. 소프트 삭제는 `stock`을 건드리지 않으므로(REQ-ADMIN-031), `stock > 0`인 비활성 상품은 그대로 결제까지 통과한다.

**이 SPEC이 고칠 수 있는가?** 고치려면 `cart-repository.ts`(SPEC-CART-001 소유)의 projection과 `cart-service.ts`의 검증, 그리고 `order-service.ts`(SPEC-ORDER-001/002 소유, `REQ-ORDER-045`가 보존 대상으로 지목한 주문 생성 트랜잭션)를 함께 손대야 한다. 그건 이 SPEC의 범위를 두 개의 완료된 도메인 SPEC으로 확장하는 일이다.

**결론: 고치지 않고, 명시적 잔여 위험 + 신규 백로그 카드로 넘긴다.** 이는 이 저장소가 이미 세 번 쓴 패턴이다 — `t21`(미결제 주문의 재고 점유 해제 소유자 없음), `t22`(미결제 이탈 주문의 쿠폰 사용분 해제 소유자 없음), `t25`(연락처 표기 정규화 — "근본 수정은 주문 생성 트랜잭션(REQ-ORDER-045 보존 대상)을 건드려야 함"). 세 카드 모두 정확히 이 모양이다: 두 완료 SPEC 사이에서 인수되지 않은 공백을, 발견한 SPEC이 떠안지 않고 카드로 등재한다.

**노출 창의 실제 크기** (위험 평가에 필요하므로 명시). §5.2/§5.4의 두 필터가 닫는 것은 **발견 경로**이지 **담기 경로**가 아니다:
- 목록(§5.2 필터 적용 후) — 노출 안 됨
- 상세 페이지·상세 API(§5.4 필터 적용 후) — 404. **새로 진입하는** 방문자는 담기 버튼에 도달할 수 없다
- **남는 경로는 둘이다**:
  - **(a) 중단 이전에 이미 담긴 카트** — 비활성화 이전에 그 항목을 담아둔 방문자가 `/cart`에서 그대로 결제로 진행하는 경우. `/cart` 렌더는 `findCartByGuestId`의 `include`로 상품을 읽으므로(§5.1 표에 없는 별도 경로) 상세 필터의 영향을 받지 않는다.
  - **(b) 중단 이후의 신규 담기** — `POST /api/cart/items`(`src/app/api/cart/items/route.ts`)는 `REQ-CART-014`에 따라 **자격 증명을 요구하지 않는 공개 엔드포인트**이며 본문의 `productId`를 그대로 받는다. 위에서 확인한 대로 `findProductForCart`는 `{ id, price, stock }` 세 컬럼만 읽으므로 판매 가능 여부를 묻지 않는다. 따라서 `productId`를 아는 요청자 — 중단 시점에 이미 열려 있던 상세 화면의 `AddToCartButton`(`SPEC-STOREFRONT-002` 소유 클라이언트 컴포넌트로, 이미 렌더된 트리에 `productId`를 들고 있다), 또는 식별자를 아는 직접 호출 — 은 **중단 이후에도** 담기에 성공한다. `REQ-ADMIN-034/035`는 이 엔드포인트를 건드리지 않는다.

즉 두 필터는 노출 표면 중 **발견 경로만** 닫는다. 남는 창은 "중단 시점에 이미 카트에 있던 항목"으로 시간이 제한되지 않으며 — 경로 (b)가 중단 이후에도 열려 있으므로 — 좁아지는 것은 발견 난이도뿐이다. 그럼에도 이 SPEC이 떠안지 않는 판단은 유지한다: 근거는 창의 크기가 아니라 **범위 번짐**이다(고치려면 `SPEC-CART-001`과 `SPEC-ORDER-001/002`의 보존 대상 트랜잭션을 함께 손대야 한다 — 위 문단). 넘길 카드 문구는 (a)·(b) 두 경로와 `SPEC-STOREFRONT-002` 소유 UI 표면을 모두 담아야 하며, 그러지 않으면 다음 SPEC이 같은 범위를 다시 조사하게 된다.

**검토했으나 기각한 우회책 — 비활성화 시 `stock`을 0으로 함께 설정.** 재고 검증이 두 경로 모두에 이미 있으므로 공백이 우연히 닫힌다. 기각 이유: (1) 관리자가 지정하지 않은 컬럼을 조용히 덮어쓴다, (2) 복구(REQ-ADMIN-032) 시 원래 재고 숫자를 되살릴 방법이 없다, (3) "판매 중단"과 "품절"이라는 서로 다른 두 상태를 하나의 컬럼에 뭉갠다 — 관리자 화면이 둘을 구분해 보여줄 수 없게 된다. 사용자 확정 사항 #4가 재고를 "폼의 평범한 필드"로 두라고 한 것과도 어긋난다.

### §5.4 조사 질문 ③ — 상세 조회에도 같은 필터가 필요한가

**필요하다 — 걸어야 한다.** 근거는 다음 셋이다.

1. **`findProductById`는 순수한 조회 함수가 아니라 구매 동선의 입구다.** `/products/[productId]` 페이지는 `getProductDetail` 실패 시 `notFound()`를 호출하고(`page.tsx:28~35`), 성공하면 `ProductDetailView`를 렌더하는데 그 안에 `AddToCartButton`(`src/components/product/AddToCartButton.tsx`)이 들어 있다. 필터를 걸지 않으면 링크를 가진 사람은 판매 중단된 상품의 상세를 보고 **담기 버튼을 그대로 누를 수 있다** — §5.3의 공백으로 직접 이어지는 새 입구를 열어두는 셈이다.
2. **주문 이력은 이 함수에 의존하지 않는다.** §5.1의 마지막 행 — `OrderItem`이 스냅샷 컬럼을 들고 있으므로, "이미 주문한 사람이 나중에 그 상품을 못 본다"는 부작용이 발생하지 않는다. 고객의 주문 상세(`/orders/lookup/[orderNumber]`)와 관리자 주문 상세는 둘 다 `OrderItem` 행을 읽는다.
3. **"삭제"라는 관리자 행위의 의미와 일치한다.** 관리자가 고른 동작의 이름은 삭제다. 목록에서는 사라지는데 직접 링크로는 멀쩡히 열리는 상품은 "삭제됐다"고 부를 수 없고, 두 화면이 서로 다른 말을 하는 상태가 된다.

**반대 방향(필터를 걸지 않는 선택)도 검토했다.** "이미 링크를 가진 사람은 계속 볼 수 있어야 한다"는 주장의 근거는 (i) 공유된 링크가 죽지 않는다, (ii) 카트에 담아둔 사람이 무엇을 담았는지 확인할 수 있다 — 두 가지다. 기각한 이유: (i)은 단종 상품에 대해서는 오히려 잘못된 약속이다(살 수 없는 상품의 페이지를 계속 보여주는 것). (ii)은 `/cart` 화면이 이미 상품명·가격·이미지를 자체 조회로 보여주므로(§5.3) 상세 페이지가 필요 없다. 즉 두 근거 모두 실질을 잃는다.

`ProductDetail` 응답 타입(`toDetail`)에 `isActive`를 노출하지 않는 것도 함께 확인해야 한다 — 고객 API가 내부 운영 상태를 알 이유가 없고, 노출하면 클라이언트가 그 값으로 분기하는 코드를 쓸 여지가 생긴다.

---

## §6. 잔여 위험으로 남길 것 (사용자 확정 사항 #4의 결과)

**관리자 재고 편집과 주문 취소 재고 복원의 경합.** 사용자 확정 사항 #4는 재고를 폼의 평범한 필드로 두고 별도 조정 액션·이력·잠금을 만들지 않기로 했다. 이때 이런 순서가 가능하다:

1. 관리자 A가 상품 편집 폼을 연다 — 재고 필드에 `10`이 채워진다.
2. 그 사이 관리자 B(또는 같은 A)가 그 상품이 든 주문을 취소한다 → `cancelOrderAsAdmin()`이 `stock: { increment: 2 }`를 수행 → 재고 `12`.
3. A가 폼을 그대로 저장한다 → 재고가 `10`으로 절대 설정된다. **복원된 2개가 조용히 사라진다.**

이는 새로 만드는 결함이 아니라 **기존 설계가 이미 안고 있는 종류의 위험**이다 — `SPEC-ADMIN-001`의 `cancelOrderAsAdmin()` 자신도 낙관적 잠금 없이 `increment`를 쓰며, 그 SPEC은 이를 수용된 위험으로 남겼다. 이 SPEC이 새 잠금 메커니즘을 도입하면 두 함수의 동시성 모델이 갈라지므로(한쪽만 버전 컬럼을 검사) 오히려 더 나쁘다.

`increment`(상대 연산)와 폼 저장(절대 설정)의 의미 차이가 위험의 본질이라는 점은 기록해 둔다. 실제 발동 조건은 좁다 — 편집 폼이 열려 있는 동안 같은 상품의 주문이 취소되어야 한다. spec.md §4에 명시하고, 관측 가능한 완화 하나만 둔다: 편집 폼의 재고 필드에 "저장 시 이 값으로 덮어씁니다"를 명시해 관리자가 상대/절대 차이를 인지하게 한다.

## §7. 관리자 계정 프로비저닝 (변함없음)

`POST /api/auth/signup`은 항상 `customer`로 생성하며 관리자 계정을 만드는 경로가 애플리케이션에 없다 — `SPEC-ADMIN-001` research.md §8이 확인한 그대로이고, 이 SPEC이 바꾸지 않는다. 테스트는 seed 헬퍼로 `role: admin` User를 만든다.

## §8. 열린 질문

없다. 아래 항목은 조사 과정에서 판단이 필요했으나 이 문서 안에서 근거와 함께 결정했다:

- 목록·상세 필터 방식 → §5.2(a) 채택, §5.4 상세도 필터
- 장바구니 공백 처리 → §5.3, 범위 밖 + 신규 카드
- 재고 경합 → §6, 잔여 위험으로 명시
- 카테고리 조회 함수 신설 위치 → §2 + §4 원칙에 따라 관리자 쪽

미해결 명확화 항목 없음 — 조사 단계에서 판단이 필요했던 모든 항목이 근거와 함께 위에서 결정되었다.
