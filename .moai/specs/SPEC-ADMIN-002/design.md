# Design: SPEC-ADMIN-002 — 관리자 상품 등록/수정 백오피스

## §1. 경로 배치 — `SPEC-ADMIN-001` 관례의 직접 확장

```
/staff/products                 (페이지, Server Component)  ─┐
/staff/products/new             (페이지, 폼)                 ─┤  resolveAdminSession() 자체 판정
/staff/products/[productId]     (페이지, 폼 — 수정)          ─┘  (미들웨어 매처 밖)

POST   /admin/api/products                     (생성)          ─┐  CSRF → 새 resolveAdminSession()
PATCH  /admin/api/products/[productId]         (수정)          ─┤  → 본문 검증 → 쓰기
PATCH  /admin/api/products/[productId]/active  (중단/복구)     ─┘
```

`SPEC-ADMIN-001` design.md §1이 이 확장을 미리 지목해 두었다 — "`/staff/products`, `/admin/api/products` 형태로 확장 가능". 두 경로 선택의 근거는 그 SPEC이 이미 확립했으므로 여기서 되풀이하지 않는다: 페이지가 `/admin` **밖**에 있는 이유는 `src/middleware.ts`의 `/admin/:path*` 매처가 `Authorization` 헤더 없는 요청을 무조건 리다이렉트하는데 브라우저 최상위 내비게이션은 그 헤더를 실을 수 없기 때문이고, 쓰기 API가 `/admin/api` **안**에 있는 이유는 미들웨어를 이중 방어선으로 얻되 그것에 의존하지 않기 때문이다(라우트 핸들러가 자체 판정을 다시 수행 — REQ-ADMIN-038).

### 왜 판매 중단이 별도 하위 라우트인가

`PATCH /admin/api/products/[productId]/active`를 수정 라우트에 접지 않고 분리했다.

- **선례 일치**: `SPEC-ADMIN-001`이 주문 상태 전이를 `PATCH /admin/api/orders/[orderId]/status`라는 전용 하위 라우트로 분리했다. 판매 중단은 상품의 상태 전이이므로 같은 모양이 맞다.
- **사고로 뒤집히지 않는다**: 수정 폼이 `isActive`를 함께 보내면, 폼이 비활성 상품을 편집할 때 무심코 활성으로 되살리거나 그 반대가 일어날 수 있다. 라우트를 나누면 판매 중단은 **의도적으로 그 요청을 보낼 때만** 일어난다.
- **수정 라우트의 검증이 단순해진다**: `PATCH /admin/api/products/[productId]`의 본문은 REQ-ADMIN-026·027·029가 정한 필드 집합으로 고정되고, `isActive`는 그 집합에 없다 — 들어오면 무시가 아니라 거부 대상이다.

## §2. `GET /admin/api/products`를 만들지 않는다

`SPEC-ADMIN-001` design.md §3이 남긴 판단을 이 SPEC이 이어받는다. 그 SPEC은 목록 API를 만들지 않고 Server Component가 저장소를 직접 호출하게 했으며, "향후 `t11` 같은 다른 화면이나 외부 도구가 같은 목록 조회가 필요해지면, 그때 별도 SPEC 또는 이 SPEC의 후속 확장으로 추가한다"고 결정을 이 SPEC에 넘겼다.

**결론: 만들지 않는다.** `t11`의 관리자 상품 목록 화면 역시 Server Component이며, 자기 서버 프로세스 안에서 호출할 수 있는 함수를 굳이 HTTP 왕복으로 감쌀 이유가 없다. REQ-ADMIN-021~023 어느 것도 이 라우트의 존재를 요구하지 않고, AC 검증도 Server Component의 직접 호출만으로 충족된다. 목록 JSON을 필요로 하는 외부 소비자가 실제로 나타나면 그때 만든다 — 지금 만들면 소비자 없는 인증·페이지네이션·직렬화 표면을 하나 더 유지해야 한다.

`/staff/products`(page.tsx)의 데이터 흐름:

```
cookies() → resolveAdminSession() → null이면 redirect("/staff/login")
          → listProductsForAdmin({ page, pageSize, categoryId?, search? })  // 직접 호출
          → 마크업 렌더
```

쓰기는 다르다. 등록·수정·중단 폼은 버튼 상호작용이 필요하므로 Client Component이며, 위 세 API를 실제로 `fetch`한다. 성공하면 `router.refresh()`로 서버 컴포넌트를 다시 읽는다 — 낙관적 업데이트 없음(`SPEC-ADMIN-001`의 `CancelOrderButton`과 동일한 규율: 정합성이 우선인 도메인에서 UI가 상태를 미리 가정하지 않는다).

## §3. 고객 대면 카탈로그 확장 — 정확히 어디에 무엇을 더하는가

`src/features/catalog/repositories/product-repository.ts`의 두 함수에 조건 하나씩을 더한다. **시그니처·projection·정렬·페이지네이션 산술은 한 글자도 바뀌지 않는다**(REQ-ADMIN-036).

```ts
// findProductsPage — 현재
const where: Prisma.ProductWhereInput = {
  ...(categoryId ? { categoryId } : {}),
  ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
};

// findProductsPage — 확장 후 (REQ-ADMIN-034)
const where: Prisma.ProductWhereInput = {
  isActive: true,                                    // ← 무조건. 옵트인 플래그 없음
  ...(categoryId ? { categoryId } : {}),
  ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
};
```

```ts
// findProductById — 확장 후 (REQ-ADMIN-035)
// findUnique는 unique 필드 외의 조건을 where에 받지 않으므로 findFirst로 바꾼다.
// id는 여전히 기본키이므로 조회 계획과 비용은 동일하고, 반환 타입도 동일하다.
export async function findProductById(id: string): Promise<ProductDetailRow | null> {
  return prisma.product.findFirst({ where: { id, isActive: true }, select: DETAIL_SELECT });
}
```

`findUnique` → `findFirst` 치환은 이 확장에서 유일하게 함수 **본문의 호출 형태**가 바뀌는 지점이다. 반환 타입(`ProductDetailRow | null`)과 시그니처는 그대로이므로 호출부(`product-service.ts:228`)는 수정하지 않는다. 선례가 있다 — `admin-session.ts:63`도 같은 이유(unique 아닌 조건 결합)로 `findFirst`를 쓰며 주석이 "still a single read, no different in behavior"라고 적고 있다.

**무조건 필터인 이유**(research.md §5.2에서 선택지 (b) `includeInactive?: boolean`을 기각한 근거의 요약): 관리자 쪽은 §4의 자기 완결 원칙에 따라 자기 쿼리를 쓰므로 이 탈출구를 쓸 소비자가 하나도 없고, 무조건 필터는 미래에 새 호출부가 생겨도 빠뜨릴 수 없다는 성질을 공짜로 준다.

**`isActive`를 고객 응답에 노출하지 않는다**(REQ-ADMIN-036). `LIST_SELECT`/`DETAIL_SELECT`에 `isActive`를 추가하지 않으므로, `toListItem`/`toDetail`이 그 값을 볼 방법 자체가 없다 — 규율이 아니라 구조로 막는다.

**깨지는 기존 테스트 9건과 갱신 방향**(research.md §5.2). 모두 `tests/unit/catalog/product-repository.test.ts` 안이며, 파일을 실제로 읽어 확인한 위치다. 9건은 두 무리로 나뉜다 — `where`를 `toEqual`(부분 일치가 아니라 **정확 일치**)로 비교하는 `findProductsPage` 테스트 **6건**, `findUnique` 모킹에 묶인 `findProductById` 테스트 **3건**.

**무리 A — `findProductsPage`의 `where` `toEqual` 정확 일치 (6건).** `where`에 `isActive: true` 키가 하나 더 생기므로 6건 모두 그대로 실패한다.

| 테스트 | 단언 위치 | 현재 기댓값 | 갱신 후 |
|---|---|---|---|
| `filters findMany AND count by the same categoryId…` | `:111`·`:112` | `toEqual({ categoryId: "cat-tops" })` (findMany·count 각 1건) | `toEqual({ isActive: true, categoryId: "cat-tops" })` |
| `applies no where filter when no categoryId is supplied` | `:119`·`:120` | `toEqual({})` (findMany·count 각 1건) | `toEqual({ isActive: true })` |
| `matches name with a case-insensitive substring filter, never description` | `:132` | `toEqual({ name: { contains: "denim", mode: "insensitive" } })` | `toEqual({ isActive: true, name: { contains: "denim", mode: "insensitive" } })` — 같은 테스트의 `:133`·`:134`(`where.description`/`where.OR`가 `undefined`)는 무변경 |
| `[AC-CATALOG-021] composes search AND category into one where clause` | `:149~152` | `toEqual({ categoryId: "cat-tops", name: {…} })` | `toEqual({ isActive: true, categoryId: "cat-tops", name: { contains: "denim", mode: "insensitive" } })` |
| `leaves the where clause empty when search is absent (REGRESSION — AC-CATALOG-029)` | `:168` | `toEqual({})` | `toEqual({ isActive: true })` — 테스트 이름과 의도("검색 조건이 붙지 않는다")는 유지 |
| `passes a term containing SQL wildcards through as a bound parameter` | `:186~188` | `toEqual({ name: { contains: "50%_off'", mode: "insensitive" } })` | `toEqual({ isActive: true, name: { contains: "50%_off'", mode: "insensitive" } })` |

깨지지 **않는** 인접 테스트 두 건은 갱신 대상이 아니다: `:161`(`[AC-CATALOG-024]`)은 `count`의 `where`와 `findMany`의 `where`를 서로 비교하므로 양쪽에 같은 키가 늘어도 그대로 통과하고, `:176~177`은 `toMatchObject`와 `orderBy`만 본다.

**무리 B — `findUnique` → `findFirst` 치환 (3건 + 모킹 셋업).** 이 3건은 단언 대상이 바뀌는 문제만이 아니다 — `:23~34`의 `vi.mock`이 `product`에 `findMany`/`count`/`findUnique`만 두고 있어 `prisma.product.findFirst`가 `undefined`이므로, 모킹을 먼저 추가하지 않으면 호출 즉시 TypeError로 죽는다.

| 테스트 / 셋업 | 위치 | 현재 | 갱신 후 |
|---|---|---|---|
| 모킹 셋업 | `:20`·`:28`·`:39` | `prisma.product.findUnique`만 모킹 | `findFirst` 모킹을 **추가**한다(`const findFirst = vi.fn()` + `vi.mock`의 `product`에 등록 + `beforeEach`의 `mockReset().mockResolvedValue(null)`). `findUnique` 모킹은 `categoryFindUnique`와 별개로 남겨두되, `findProductById`가 더 이상 그것을 호출하지 않는다 |
| `selects the full detail projection including description and updatedAt` | `:197~198` | `findUnique.mock.calls[0]![0]`의 `where`를 `toEqual({ id: "prod_abc" })` | `findFirst.mock.calls[0]![0]` + `toEqual({ id: "prod_abc", isActive: true })`. `:199~209`의 `select` `toMatchObject`는 무변경 |
| `[AC-CATALOG-015] never selects reviews or relatedProducts` | `:216` | `findUnique.mock.calls[0]![0].select` 검사 | `findFirst.mock.calls[0]![0].select` — `select`(DETAIL_SELECT)는 무변경이므로 기댓값 자체는 그대로 |
| `returns null for an id Prisma cannot find` | `:221~223` | `findUnique`가 `null`을 반환하도록 둔 채 `findProductById("prod_nonexistent")` → `null` | 모킹 대상만 `findFirst`로. 기댓값 그대로 |

**주의**: 위 줄 번호는 이 문서 작성 시점의 파일 상태 기준이며, M1에서 모킹 셋업을 추가하면 그 아래 줄 번호가 함께 밀린다. 갱신은 줄 번호가 아니라 테스트 이름을 기준으로 찾는다. 또한 9건이 전부라는 것은 `toEqual`의 정확 일치 의미론과 `findFirst` 모킹 부재로부터 도출한 것이므로, M1에서 `isActive: true`를 넣은 **직후 스위트를 한 번 돌려 실제 실패 목록을 기준선으로 삼는다**(M1 완료 기준이 이미 "스위트 전체 통과"이므로 절차는 이미 있다).

모든 갱신에 `// SPEC-ADMIN-002 REQ-ADMIN-034/035` 주석을 남긴다. `SPEC-CATALOG-001/002`의 spec.md·acceptance.md 본문은 건드리지 않는다 — 이것은 기댓값 갱신이지 요구사항 변경이 아니다.

## §4. 관리자 쪽 새 모듈

### `src/features/admin/repositories/admin-product-repository.ts`

`admin-order-repository.ts`와 같은 모양(검증·기본값 없음, 인자를 그대로 믿는다; `Promise.all([findMany, count])` 병렬; 안정 정렬).

```ts
listProductsForAdmin({ page, pageSize, categoryId?, search? }): Promise<AdminProductsPage>
  // where: { ...(categoryId && {categoryId}), ...(search && {name:{contains,mode:"insensitive"}}) }
  //   → isActive 조건 없음. 관리자는 중단된 상품도 봐야 한다 (REQ-ADMIN-021)
  // orderBy: [{ createdAt: "desc" }, { id: "asc" }]  — listOrdersForAdmin과 동일한 두 키

findProductByIdForAdmin(productId): Promise<AdminProductDetailRow | null>
  // findUnique — 관리자 쪽은 isActive 조건이 없으므로 unique 조회 그대로

createProduct(input): Promise<{ id: string }>
updateProduct(productId, input): Promise<{ updated: boolean }>
setProductActive(productId, isActive): Promise<{ updated: boolean }>
  // updateMany + count 검사로 "행이 없었다"를 예외 없이 판별 —
  // cancelOrderAsAdmin의 { transitioned: boolean } 관용구와 같은 모양

listCategoriesForAdmin(): Promise<Array<{ id: string; name: string; slug: string }>>
  // 상품 폼 <select>의 옵션 원본 (REQ-ADMIN-029).
  // category-repository.ts(CATALOG-001 소유)에는 findCategoryIdBySlug 하나뿐이라
  // 전체 목록 함수가 없다. §4의 자기 완결 원칙대로 관리자 쪽에 둔다.
```

**자기 완결 원칙**: `product-repository.ts`를 import하지 않는다. 관리자 목록은 중단된 상품을 포함해야 하므로 고객 쪽 함수와 요구가 정반대이고, 고객 쪽에 옵트인 플래그를 뚫는 것보다(§3에서 기각) 별도 쿼리가 안전하다. `SPEC-ADMIN-001`이 `admin-order-repository.ts`에서 내린 것과 같은 판단이며, 같은 WET 비용을 같은 이유로 받아들인다 — `@MX:NOTE`로 추적한다.

### `src/features/admin/services/product-validation.ts`

프레임워크 독립(순수 함수, `next/*`·`@prisma/client` import 없음). 생성 라우트와 수정 라우트가 **같은 함수를 공유**한다 — 두 곳에 같은 규칙을 두 번 쓰면 갈라진다.

```ts
type ProductInputErrors = Partial<Record<"name"|"description"|"price"|"stock"|"categoryId"|"images", string>>;

parseProductInput(body: unknown): { ok: true; data: ProductInput } | { ok: false; errors: ProductInputErrors }
```

- `price`: `Number.isSafeInteger(v) && v >= 1` (REQ-ADMIN-026). 원 단위 정수 — `Product.price`가 `Int`이므로 소수는 애초에 저장할 수 없다.
- `stock`: `Number.isSafeInteger(v) && v >= 0` (REQ-ADMIN-026). 0 허용 — 품절은 정상 상태다.
- `name` / `description`: `typeof v === "string" && v.trim().length > 0`. 저장은 `trim()` 결과로.
- `images`: `Array.isArray(v)` && 각 항목이 문자열이고 `new URL(item)`이 던지지 않으며 프로토콜이 `http:`/`https:`. 빈 배열 허용(REQ-ADMIN-027).
- `categoryId`: 문자열 존재 검사만 여기서. **실존 여부는 DB가 판정한다**(아래).

`zod`는 의존성에 없다(`package.json`의 dependencies는 `@prisma/client`/`bcrypt`/`google-auth-library`/`jose`/`next`/`react`/`react-dom`뿐). 새 의존성을 들이지 않고 손으로 쓴다 — `cart-service.ts`의 `parseQuantity`, `product-service.ts`의 `parseListQuery`가 이미 같은 방식이다.

**`categoryId` 실존 검증을 DB에 맡기는 이유**(REQ-ADMIN-029): 애플리케이션이 먼저 `category.findUnique`로 확인해도, 확인과 삽입 사이에 카테고리가 사라지면 경합이 남는다. `Product.categoryId`는 FK이므로 존재하지 않는 값이면 Prisma가 `P2003`(foreign key constraint failed)으로 실패한다 — 그것을 잡아 `{ categoryId: "존재하지 않는 카테고리입니다" }`로 변환하는 것이 유일하게 경합 없는 판정이다. 폼의 `<select>`는 이미 실존 행만 나열하므로, 이 경로는 정상 흐름에서 발동하지 않는 방어선이다.

### `src/features/admin/types/admin.ts` (EXTEND)

같은 파일에 상품 쪽 타입을 덧붙인다 — `SPEC-ADMIN-001`이 M3에서 목록 타입을, M4에서 상세·상태 변경 타입을 같은 파일에 차례로 덧붙인 것과 같은 방식이다. 새 파일을 만들지 않는다.

```ts
AdminProductListItemDTO { id, name, price, stock, isActive, categoryName, createdAt }
PaginatedAdminProducts { items, page, pageSize, totalCount, totalPages }
AdminProductDetailDTO  { id, name, description, price, stock, images, categoryId, isActive }
ProductInput           { name, description, price, stock, images, categoryId }
SetProductActiveBody   { isActive: boolean }
```

`DEFAULT_PAGE`/`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`는 이미 이 파일에 있으므로 그대로 쓴다(REQ-ADMIN-023).

## §5. 공유 관리자 레이아웃을 만들지 않는 판단

**결론: 만들지 않는다 — `SPEC-ADMIN-001`의 자기 완결형 페이지 스타일을 그대로 잇는다.**

현재 `/staff/*` 3장(`login` 120줄, `orders` 178줄, `orders/[orderId]` 159줄)은 각자 Tailwind 마크업과 `formatWon`·`STATUS_LABEL` 같은 표시 헬퍼를 자기 안에 들고 있다. 이 SPEC이 3장을 더한다(`products`, `products/new`, `products/[productId]`).

중복이 실제로 생기는 지점을 세어 보면:

| 중복 후보 | 실제 규모 | 판단 |
|---|---|---|
| `formatWon` | 이미 3곳(`ProductDetailView`, `staff/orders`, 이 SPEC의 목록) | 3줄짜리 `Intl.NumberFormat` 래퍼. 공유 모듈을 하나 만들어 3곳이 import하게 하는 것이 순이득인지 애매하다 — `ProductDetailView`는 `src/components/`, 나머지는 `src/app/staff/` 아래라 자연스러운 공통 위치가 없다 |
| 폼 필드 마크업(라벨+입력+오류) | 등록/수정 **2장**이 공유 | **이건 뽑는다** — 단, 전역 레이아웃이 아니라 `src/app/staff/products/ProductForm.tsx` 한 파일로. 등록과 수정이 같은 필드 집합을 쓰므로 두 페이지가 이 컴포넌트를 `mode`와 초기값만 달리해 렌더한다 |
| 테이블 마크업 | 주문 목록과 상품 목록의 **열이 다르다** | 뽑지 않는다. 공통 `<AdminTable>`은 열 정의를 props로 받는 추상화가 되는데, 소비자가 둘뿐이고 열 구성이 겹치지 않는다 |
| 헤더·내비게이션 | 현재 **존재하지 않는다** — 관리자는 URL로 이동한다 | 만들지 않는다. `SPEC-ADMIN-001`도 만들지 않았고, 내비게이션 정보 구조는 화면이 더 늘어난 뒤에 정하는 편이 낫다 |

즉 **선례에서 벗어나는 지점은 `ProductForm.tsx` 하나뿐**이며, 그것도 전역 공유 컴포넌트가 아니라 같은 라우트 세그먼트 안의 지역 컴포넌트다(`SPEC-ADMIN-001`이 `staff/orders/[orderId]/CancelOrderButton.tsx`를 같은 방식으로 둔 것과 동일한 배치). 등록 폼과 수정 폼이 필드 하나라도 갈라지면 그 순간 두 화면의 검증이 서로 다른 말을 하기 시작하므로, 이 하나는 중복을 남기는 쪽이 더 위험하다.

## §6. 상품 폼의 필드 배치

등록(`/staff/products/new`)과 수정(`/staff/products/[productId]`)이 같은 `ProductForm`을 쓴다. 위에서 아래로:

| 필드 | 입력 | 비고 |
|---|---|---|
| 이름 | 한 줄 텍스트, 필수 | `required` + 서버 검증(REQ-ADMIN-026) |
| 카테고리 | `<select>`, 필수 | `listCategoriesForAdmin()` 결과를 서버에서 렌더. **자유 입력 없음**(REQ-ADMIN-029) |
| 가격 | 숫자, 필수, `min=1` `step=1` | 라벨에 "원" 단위 명시. 소수 입력은 서버가 거부 |
| 재고 | 숫자, 필수, `min=0` `step=1` | **라벨 아래 안내 문구: "저장 시 이 값으로 덮어씁니다"** — spec.md §4의 재고 경합 완화(research.md §6) |
| 설명 | 여러 줄 텍스트, 필수 | |
| 이미지 URL | 반복 가능한 URL 입력 + "추가"/"제거" 버튼, 0개 허용 | 배열 순서가 곧 표시 순서(`Product.images` 주석: "array order is display order"). 위/아래 이동은 넣지 않는다 — 제거 후 다시 추가로 충분하고, 순서 조작 UI는 이 SPEC의 최소 산출물 밖이다 |

수정 화면에는 폼 아래에 **판매 중단/복구 버튼**을 별도 영역으로 둔다(§1의 별도 라우트와 짝). 현재 상태가 판매 중이면 "판매 중단", 중단됨이면 "판매 재개"를 보여준다. 저장 버튼과 시각적으로 분리해 실수로 누르기 어렵게 배치한다.

**CSRF 토큰 조달**: `CancelOrderButton.tsx:24~28`이 쓰는 것과 같은 방식 — `document.cookie`에서 `csrf_token`을 읽어 `X-CSRF-Token` 헤더에 싣는다. 그 쿠키는 httpOnly가 아니며 `POST /api/auth/login`이 발급한다.

**접근성**: 각 입력에 `<label htmlFor>`, 서버 검증 오류는 필드 옆에 `role="alert"`로 표시하고 `aria-describedby`로 입력과 연결한다. `SPEC-ADMIN-001` M5가 같은 기준을 적용했다.

## §7. `isActive` 인덱스를 추가하지 않는 판단

`Product`에는 `categoryId`/`createdAt`/`price` B-tree와 `name` GIN 인덱스가 있고, `REQ-CATALOG-016`이 목록·상세에 p95 300ms 예산을 건다. `isActive: true`가 모든 고객 대면 조회의 `where`에 들어가므로 인덱스 후보처럼 보인다.

**추가하지 않는다.** 카디널리티가 2인 컬럼의 단독 B-tree 인덱스는 선택도가 낮아 플래너가 대개 무시한다 — 특히 대다수 행이 `true`인 상태(정상 운영 시의 분포)에서는 전체 스캔과 다를 바 없다. 실제로 도움이 되는 형태는 기존 정렬 인덱스에 붙인 부분 인덱스(`WHERE isActive = true`)이지만, 그건 3개 정렬 인덱스를 모두 부분 인덱스로 바꾸는 작업이고 카탈로그 성능 요구를 소유한 `SPEC-CATALOG-001`의 결정 영역이다.

재검토 조건: 판매 중단 상품이 전체의 상당 비율을 차지하게 되거나, `REQ-CATALOG-016`의 p95 예산이 실제 측정에서 초과되면 그때 부분 인덱스를 별도 SPEC으로 검토한다. 이 판단을 `admin-product-repository.ts`에 `@MX:NOTE`로 남긴다.

## §8. 잔여 위험

- **재고 편집과 주문 취소 재고 복원의 경합** — spec.md §4의 첫 행, research.md §6. 해결하지 않고 §6의 폼 안내 문구로만 완화한다.
- **장바구니에 담긴 판매 중단 상품의 결제 통과** — spec.md §3의 해당 제외, research.md §5.3. 신규 백로그 카드로 넘긴다.
- **관리자 상품 저장소와 카탈로그 저장소의 분기(WET)** — §4의 자기 완결 원칙이 낳는 비용. `@MX:NOTE`로 추적.
- **`findUnique` → `findFirst` 치환이 카탈로그 상세 테스트의 모킹 대상을 바꾼다** — 확인 완료: `tests/unit/catalog/product-repository.test.ts:20/28/39`가 `prisma.product.findUnique`를 모킹하고 `:194~223`의 3개 테스트가 `findUnique.mock.calls`를 검사한다. §3의 표대로 `findFirst` 모킹 추가 + 3개 테스트 갱신이 필요하다. 이 SPEC의 성공 기준은 갱신 후 카탈로그 스위트 전체가 통과하는 것이다.
