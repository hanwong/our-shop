# Plan: SPEC-ADMIN-002 — 관리자 상품 등록/수정 백오피스

## §0. 결정 사항 (착수 전 확인 대상)

**되돌리기 비용이 큰 순서**로 나열한다 — 위쪽일수록 이후 모든 마일스톤이 그 결정 위에 세워진다.

### 결정 1 — 소프트 삭제 컬럼 추가가 고객 대면 카탈로그를 확장한다 (가장 되돌리기 비쌈)

**결정(확정)**: `Product.isActive`를 추가하고(REQ-ADMIN-019), **동시에** `findProductsPage`/`findProductById`(SPEC-CATALOG-001 소유)의 `where`에 `isActive: true`를 더한다(REQ-ADMIN-034/035).

이 두 가지는 하나의 결정이며 쪼갤 수 없다. 컬럼만 추가하고 필터를 걸지 않으면 **관리자 화면의 "삭제"가 고객에게 아무 효과가 없다** — 목록에도 그대로 뜨고 상세도 그대로 열린다. 기능이 작동하지 않는 것이다(research.md §5).

되돌리기 비용이 가장 큰 이유: 완료된 SPEC(CATALOG-001/002)이 소유한 파일과 그 테스트 **9건**을 건드린다(`where` `toEqual` 비교 6건 + `findUnique` 모킹에 묶인 상세 테스트 3건 — design.md §3의 위치별 표가 9건을 개별로 열거한다). 대안 검토는 research.md §5.2에 기록했다 — 서비스 레이어 사후 필터는 `totalCount`를 어긋나게 하고(페이지 수가 틀어진다), `includeInactive?` 옵트인 플래그는 쓸 소비자가 하나도 없다.

**사용자 확인이 필요한 이유**: 완료된 SPEC의 구현 파일과 테스트에 손대는 유일한 지점이다. `SPEC-ADMIN-001`은 같은 상황에서 `payment-repository.ts` 수정을 **기각**하고 로직을 복제했다(그 design.md §4). 여기서는 복제가 불가능하다 — 고객 대면 조회 경로는 하나뿐이고, 그것을 우회할 방법이 없다. 이 비대칭을 명시적으로 확인받는다.

**사용자가 원치 않을 경우의 대안**: 소프트 삭제를 포기하고 "판매 중단" 개념 자체를 이 SPEC에서 빼는 것(등록·수정만). 그러면 카탈로그 파일은 한 줄도 바뀌지 않지만, 상품을 내리는 방법이 없는 백오피스가 된다.

### 결정 2 — 장바구니 공백을 이 SPEC이 고치지 않는다

**결정(확정, 사용자 지침에 따름)**: 판매 중단 **이전에** 장바구니에 담긴 상품이 결제까지 통과하는 공백은 범위 밖으로 두고 신규 백로그 카드로 넘긴다(spec.md §3, research.md §5.3).

조사로 확인한 사실: 담기 경로와 체크아웃 트랜잭션 어느 쪽도 판매 가능 여부를 묻지 않으며, 재고만 검증한다 — **기존 검증이 이 경우를 우연히 막아주지 못한다.** 고치려면 `SPEC-CART-001`과 `SPEC-ORDER-001/002`(`REQ-ORDER-045` 보존 대상 트랜잭션)로 범위가 번진다. `t21`/`t22`/`t25`와 같은 모양의 크로스-SPEC 공백이므로 같은 방식으로 처리한다.

기록만 하고 별도 확인 없이 채택한다 — 사용자 지침이 이 처리 방식을 명시했다.

### 결정 3 — 판매 중단을 별도 API 라우트로 분리한다

**결정(잠정, design.md §1에 근거)**: `PATCH /admin/api/products/[productId]/active`를 수정 라우트와 분리한다.

`SPEC-ADMIN-001`이 주문 상태 전이를 `/status` 하위 라우트로 분리한 선례와 일치하며, 수정 폼이 `isActive`를 무심코 뒤집는 사고를 구조적으로 막는다.

**대안**: 수정 라우트 본문에 `isActive`를 포함시켜 라우트 하나로 통합 — 파일은 하나 줄지만, 폼 제출이 판매 상태를 함께 실어 보내게 되어 위 사고 경로가 열린다. 기각.

### 결정 4 — 재고 경합을 해결하지 않는다

**결정(확정, 사용자 확인 사항 #4)**: 재고는 폼의 평범한 필드이며 별도 조정 액션·이력·낙관적 잠금을 만들지 않는다. 편집 폼 저장과 `cancelOrderAsAdmin()`의 `increment` 사이 경합은 **잔여 위험으로 명시**한다(spec.md §4, research.md §6).

`SPEC-ADMIN-001`이 같은 종류의 위험을 이미 수용했고, 이 SPEC만 잠금을 도입하면 두 쓰기 경로의 동시성 모델이 갈라진다. 완화는 폼 안내 문구 하나뿐이다(design.md §6).

---

## §1. 사용자 흐름 (가장 변경 가능성 높은 UX 결정)

```
관리자 → GET /staff/login (기존 화면, 무변경)
       → POST /api/auth/login (기존 API, 무변경) → csrf_token + refresh_token 쿠키

관리자 → GET /staff/products?category=&search=&page=
       → 목록(판매 중단 상품 포함, 상태 배지로 구분)
       → "새 상품 등록" → GET /staff/products/new
                        → 폼 제출 → POST /admin/api/products
                        → 성공 → /staff/products 로 이동
                        → 검증 실패 → 필드별 오류 표시, 상품 생성 없음

       → 행 클릭 → GET /staff/products/[productId] (수정 폼, 현재 값 채워짐)
                  → 폼 제출 → PATCH /admin/api/products/[productId]
                  → 성공 → router.refresh()
                  → "판매 중단" / "판매 재개" 버튼 → PATCH /admin/api/products/[productId]/active
                  → 성공 → router.refresh() (배지 갱신)

고객   → GET /api/products (목록)        → 판매 중인 상품만 (REQ-ADMIN-034)
       → GET /products/[productId]       → 판매 중단이면 not-found (REQ-ADMIN-035)
       → 주문 이력                        → 영향 없음 (OrderItem 스냅샷을 읽음)
```

`/staff/*`는 관리자용 SSR 화면, `/admin/api/*`는 쓰기 API — `SPEC-ADMIN-001`이 확립한 경로 관례 그대로다(REQ-ADMIN-040). 두 경로가 미들웨어와 어떤 관계인지는 그 SPEC의 design.md §1이 이미 상세히 기록했으므로 되풀이하지 않는다.

## §2. 데이터 모델 변경 (두 번째로 되돌리기 비쌈)

### 신규 컬럼 1개 — `Product.isActive`

```prisma
model Product {
  // ... 기존 필드 전부 무변경 ...
  isActive    Boolean  @default(true) // SPEC-ADMIN-002 — 판매 가능 여부. false = 관리자가 판매 중단(소프트 삭제)
  // ... 기존 관계·인덱스 전부 무변경 ...
}
```

- **마이그레이션**: 컬럼 1개 추가. `@default(true)`이므로 기존 모든 행이 판매 가능 상태를 유지한다(REQ-ADMIN-019) — 백필 스크립트 불필요.
- **인덱스 없음**: design.md §7의 판단(카디널리티 2인 컬럼의 단독 인덱스는 플래너가 대개 무시한다). 재검토 조건도 거기 기록.
- **FK 방향 무변경**: `CartItem.product`의 `Cascade`, `OrderItem.product`의 `Restrict` 둘 다 그대로. 소프트 삭제를 택했으므로 `product.delete`가 호출되는 경로 자체가 없고 `Cascade`는 발동하지 않는다(REQ-ADMIN-020, research.md §1).

### 신규 모델·enum 없음

`Category`/`CartItem`/`OrderItem`/`Order`/`Coupon` 스키마는 전혀 건드리지 않는다. 이 SPEC은 위 컬럼 1개만 추가한다.

## §3. 아키텍처 경계

### 신규 (`src/features/admin/**`)

- `services/product-validation.ts` — `parseProductInput(body)`. 프레임워크 독립 순수 함수, 생성·수정 라우트가 공유(REQ-ADMIN-026/027). `zod` 미도입(의존성에 없음 — design.md §4).
- `repositories/admin-product-repository.ts` — `listProductsForAdmin()`, `findProductByIdForAdmin()`, `createProduct()`, `updateProduct()`, `setProductActive()`, `listCategoriesForAdmin()`. 검증·기본값 없음(인자를 그대로 믿는다), `Promise.all([findMany, count])` 병렬, `[{createdAt:"desc"},{id:"asc"}]` 안정 정렬 — `admin-order-repository.ts`와 같은 모양.

### 신규 (`src/app/**`)

- `staff/products/page.tsx` — 목록(Server Component, `resolveAdminSession()` 게이팅 후 저장소 **직접 호출**).
- `staff/products/new/page.tsx` — 등록 화면.
- `staff/products/[productId]/page.tsx` — 수정 화면 + 판매 중단/재개 영역.
- `staff/products/ProductForm.tsx` — 등록·수정이 공유하는 Client Component 폼(design.md §5의 유일한 선례 이탈 지점, 지역 컴포넌트).
- `admin/api/products/route.ts` — `POST`(생성).
- `admin/api/products/[productId]/route.ts` — `PATCH`(수정).
- `admin/api/products/[productId]/active/route.ts` — `PATCH`(판매 중단/재개).

세 라우트 모두 호출 순서가 동일하다: **CSRF → 새 `resolveAdminSession()` → 본문 검증 → 쓰기**(REQ-ADMIN-038/039). `SPEC-ADMIN-001`의 `status/route.ts:43~73`이 그 순서를 문서화해 두었다.

### EXTEND (기존 파일에 최소 추가)

| 파일 | 변경 | 소유 SPEC |
|---|---|---|
| `prisma/schema.prisma` | `Product.isActive` 한 줄 | SPEC-CATALOG-001 |
| `src/features/catalog/repositories/product-repository.ts` | `findProductsPage`의 `where`에 `isActive: true` 1줄, `findProductById`를 `findFirst({ where: { id, isActive: true } })`로 치환 | SPEC-CATALOG-001 |
| `src/features/admin/types/admin.ts` | 상품 쪽 DTO/입력 타입 추가(기존 주문 타입 무변경) | SPEC-ADMIN-001 |
| `tests/unit/catalog/product-repository.test.ts` | 기댓값 9건 갱신 + `findFirst` 모킹 추가 (design.md §3의 위치별 표) | SPEC-CATALOG-001/002 |
| `tests/unit/catalog/query-surface.test.ts` | `AC-CATALOG-001` 블록의 `Product` 픽스처 3곳: 명시 타입 주석(`:116~124`)에 `isActive: boolean`, 리터럴(`:126~134`)에 `isActive: true`, `Object.keys().sort()` 기대값(`:137~147`)에 `"isActive"`(정렬 위치는 `images`와 `name` 사이). `:135`의 `satisfies Product`가 이 3곳을 함께 요구한다 | SPEC-CATALOG-001 |

이 5개 항목은 spec.md §1 "확장하는 계약" 표와 **같은 파일 목록·같은 단위**다(REQ-ADMIN-041의 예외 조항과 AC-ADMIN-041의 검증 대상이 이 하나의 경계를 가리킨다). 둘 중 한쪽만 고치면 두 문서가 다른 경계를 말하게 되므로 항상 함께 갱신한다.

### PRESERVE (절대 수정하지 않음 — REQ-ADMIN-041)

- `src/middleware.ts`
- `src/lib/auth/{jwt,session,cookies,csrf}.ts` — import만, 로직 무변경
- `src/app/api/auth/**` — 로그인·리프레시·로그아웃 무변경
- `src/features/admin/services/admin-session.ts` — **읽고 import만**. 이 SPEC은 관리자 판정 로직을 한 줄도 바꾸지 않는다(REQ-ADMIN-037)
- `src/features/admin/repositories/admin-order-repository.ts`, `src/app/staff/orders/**`, `src/app/admin/api/orders/**` — SPEC-ADMIN-001의 주문 절반 전체
- `src/features/catalog/services/product-service.ts` — 저장소 시그니처가 안 바뀌므로 호출부도 안 바뀐다
- `src/features/catalog/repositories/category-repository.ts` — 관리자용 카테고리 목록은 관리자 쪽에 새로 둔다
- `src/features/cart/**`, `src/features/orders/**`, `src/features/payments/**`, `src/features/discounts/**`
- `src/components/**` — 고객 대면 컴포넌트 전부
- `.moai/specs/SPEC-CATALOG-001/**`, `.moai/specs/SPEC-CATALOG-002/**` 등 완료된 SPEC의 본문 문서

### 범위 밖(어느 마일스톤에도 배정하지 않음)

- `GET /admin/api/products` (목록 JSON) — design.md §2의 판단. Server Component가 저장소를 직접 호출하므로 필요하지 않고, 어떤 REQ도 요구하지 않는다.
- 카테고리 CUD 화면·API — spec.md §3.
- 이미지 업로드 파이프라인 — spec.md §3.

## §4. 위험 요소

| 위험 | 완화 |
|---|---|
| 고객 대면 카탈로그 확장이 CATALOG-001/002의 회귀를 부른다 | 확장 범위를 `where` 조건 1개 + `findUnique`→`findFirst` 치환으로 **한정**(REQ-ADMIN-036). 시그니처·projection·정렬·페이지네이션 산술 무변경. M1에서 이 확장만 먼저 랜딩하고 카탈로그 스위트 전체를 통과시킨 뒤에 관리자 기능으로 넘어간다 |
| `isActive`가 고객 응답에 새어 나감 | `LIST_SELECT`/`DETAIL_SELECT`에 추가하지 않는다 — `toListItem`/`toDetail`이 그 값을 볼 방법 자체가 없다(구조로 차단, design.md §3) |
| 관리자 저장소가 카탈로그 저장소와 갈라짐(WET) | `SPEC-ADMIN-001`의 자기 완결 원칙을 의도적으로 따른 결과. design.md §4에 트레이드오프 기록 + `@MX:NOTE` |
| 등록 폼과 수정 폼의 검증이 갈라짐 | `parseProductInput()` 하나를 두 라우트가 공유(REQ-ADMIN-026~030). `ProductForm.tsx`도 두 화면이 공유(design.md §5) |
| `categoryId` 실존 검증의 TOCTOU 경합 | 애플리케이션 사전 조회 대신 FK 제약 위반(`P2003`)을 잡아 필드 오류로 변환 — 유일하게 경합 없는 판정(design.md §4) |
| 재고 편집과 주문 취소 복원의 경합 | **해결하지 않는다**(결정 4). 폼 안내 문구로만 완화하고 spec.md §4에 잔여 위험으로 명시 |
| 장바구니에 담긴 판매 중단 상품 | **범위 밖**(결정 2). sync-phase에서 백로그 카드 등재 |
| 관리자 계정이 실제로 없어 검증이 seed에 의존 | 테스트 seed 헬퍼로 `role: admin` User 생성 — `SPEC-ADMIN-001`이 이미 쓰는 방식 |

## §5. 마일스톤 (우선순위 기반, 시간 추정 없음)

**M1이 가장 위험한 변경을 먼저 착지시킨다** — 완료된 SPEC의 파일을 건드리는 유일한 지점이므로, 관리자 기능을 쌓기 전에 회귀가 없음을 확인한다.

1. **M1 (Priority High) — 스키마 + 고객 대면 필터 확장**: `Product.isActive` 추가 + 마이그레이션, `findProductsPage`/`findProductById` 확장, `tests/unit/catalog/product-repository.test.ts` 기댓값 9건 갱신 + `findFirst` 모킹, 판매 중단 상품이 목록·상세에서 사라지는 단위 테스트 신규. **완료 기준: 카탈로그·스토어프론트 스위트 전체 통과.**
2. **M2 (Priority High) — 관리자 저장소 + 검증 모듈**: `admin-product-repository.ts` 6개 함수, `product-validation.ts`, `types/admin.ts` 상품 타입 추가. 검증 단위 테스트(가격 0/음수/소수, 재고 음수, 이름·설명 공백, 이미지 비URL·빈 배열 허용).
3. **M3 (Priority High) — 관리자 상품 목록 화면**: `/staff/products` Server Component, 세션 게이팅, 카테고리·검색 필터, 페이지네이션, 판매 중단 배지.
4. **M4 (Priority High) — 등록·수정 폼과 쓰기 API**: `ProductForm.tsx`, `/staff/products/new`, `/staff/products/[productId]`, `POST /admin/api/products`, `PATCH /admin/api/products/[productId]`. CSRF → 세션 재판정 → 검증 → 쓰기 순서 적용. `categoryId` FK 위반 처리.
5. **M5 (Priority High) — 판매 중단·복구**: `setProductActive()`, `PATCH /admin/api/products/[productId]/active`, 수정 화면의 중단/재개 영역. 중단이 `CartItem`/`OrderItem`을 건드리지 않음을 검증하는 테스트(REQ-ADMIN-033).
6. **M6 (Priority Medium) — 통합·회귀·접근성**: 전체 스위트 무회귀, 커버리지 임계값, `src/middleware.ts`·`admin-session.ts`·주문 관련 파일 diff 0줄 회귀 가드, 폼 접근성(라벨 연결, `role="alert"` 오류, 키보드 조작), `@MX` 태그 정리.

## §6. 성공 기준

- REQ-ADMIN-019 ~ 041 각각 acceptance.md에 대응 AC 존재.
- `src/middleware.ts` diff 0줄.
- `src/features/admin/services/admin-session.ts` diff 0줄 (import만).
- `src/features/admin/repositories/admin-order-repository.ts` · `src/app/staff/orders/**` · `src/app/admin/api/orders/**` diff 0줄.
- `src/features/catalog/repositories/product-repository.ts`의 변경이 `where` 조건 1개 추가 + `findUnique`→`findFirst` 치환으로 한정됨(시그니처·`LIST_SELECT`·`DETAIL_SELECT`·`SORT_ORDER_BY` diff 0줄).
- `src/features/catalog/services/product-service.ts` diff 0줄.
- `npm run typecheck` · `npm run lint` · `npm test` 종료 코드 0.

## §7. plan-audit 대상 확인 사항

**Clarification status**: 미해결 항목 없음.

사용자와 사전 확정된 항목 4건(이미지 URL 입력 방식, 소프트 삭제 컬럼, 카테고리는 선택만, 재고는 평범한 필드)은 §0 결정 2·4와 spec.md의 REQ에 그대로 반영했다. 오케스트레이터가 가정으로 제시한 4건(공유 레이아웃 없음, 목록은 Server Component 직접 호출, 검증 규칙, 상품별 할인가 없음)은 조사로 근거를 확인해 각각 design.md §5·§2·§4와 spec.md §3에 결정으로 기록했다 — 조사 결과가 가정과 어긋난 지점은 하나뿐이고(`ProductForm.tsx` 공유 컴포넌트 도입, design.md §5가 선례 이탈로 명시), 나머지는 가정이 성립함을 확인했다.

plan-phase에서 새로 열린 항목은 §0 결정 1의 사용자 확인 하나이며, 이는 미해결 명확화 항목이 아니라 **Implementation Kickoff Approval 게이트에서 확인할 승인 대상 결정**으로 기록한다 — 조사로 근거와 대안이 모두 확보되어 있어 답을 모르는 상태가 아니라, 완료된 SPEC의 파일을 건드리는 데 대한 승인이 필요한 상태이기 때문이다.
