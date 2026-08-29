---
id: SPEC-CART-001
status: completed
updated: 2026-08-29
tier: M
---

# Plan: SPEC-CART-001 — 장바구니 및 게스트→회원 카트 병합

## §1. 개요 / 목표

`product.md` 핵심 기능 #2(장바구니)를 구축한다. 상품 담기/수량변경/삭제/조회 4개 API와, 로그인 성공 시 게스트 카트를 회원 카트로 병합하는 서비스 로직을 다룬다. 새 Prisma 모델 2개(`Cart`, `CartItem`)와, 이 저장소 최초의 "게스트 신원" 개념(opaque 쿠키)을 도입한다.

## §2. 결정 사항 (가장 되돌리기 어려운 것부터)

### 2.1 Cart 소유권 표현: nullable FK 두 개 vs 대안

**결정: `Cart.userId String?` + `Cart.guestId String?` — 둘 다 nullable, 앱 레벨 XOR 불변식으로 정확히 하나만 채운다.**

| 대안 | 장점 | 단점 |
|---|---|---|
| A. `userId?`/`guestId?` 둘 다 nullable(선택) | `User`/게스트 각각에 직접 `@relation` + `@@unique`를 걸 수 있어 Prisma 타입이 자연스러움. 조회 쿼리가 단순(`where: { userId }` 또는 `where: { guestId }`) | DB 레벨 CHECK 제약(정확히 하나만 NOT NULL)이 Prisma 스키마만으로는 표현되지 않음 — 리포지토리 레이어가 XOR을 지켜야 함(앱 레벨 불변식) |
| B. `ownerType`(enum "user"\|"guest") + `ownerId`(String) 단일 다형 컬럼 | 컬럼 하나로 통일 | `ownerId`가 `User.id`와 게스트 식별자 두 타입을 섞어 담으므로 Prisma `@relation`을 걸 수 없음(참조 무결성 상실) — SPEC-CATALOG-001이 §2.1에서 이미 피했던 것과 같은 종류의 타입 안전성 손실 |
| C. `UserCart`/`GuestCart` 별도 테이블 | 각각 완전한 FK 무결성 | `CartItem`이 어느 테이블을 참조하는지 다형적으로 갈라져야 하고, 병합 로직이 테이블 간 이관(모델 변경)을 수반 — 이번 SPEC 규모에 비해 과설계 |

A를 선택한다. XOR 불변식은 리포지토리 레이어(`cart-repository.ts`)의 생성 함수 두 개(`createUserCart`/`createGuestCart`)로만 카트를 만들도록 강제해 지킨다 — 둘 다 채우거나 둘 다 비우는 경로를 아예 만들지 않는다(YAGNI: DB 레벨 CHECK 제약 SQL은 이번 SPEC에서 추가하지 않되, 후속 SPEC에서 강화 가능하도록 막지 않는다). `@@unique([userId])`/`@@unique([guestId])`(partial하게는 아니지만 nullable 컬럼에 대한 Prisma unique는 NULL을 여러 개 허용하므로 "사용자당 카트 하나" 제약이 정확히 성립한다.

### 2.2 게스트 식별 쿠키 설계

**결정: 이름 `guest_cart_id`, 값은 `randomBytes(32)`(base64url) opaque 무작위 문자열(해시 저장 안 함), 수명 14일(기본, `GUEST_CART_COOKIE_EXPIRY` 환경변수로 조정 가능).**

- **이름**: 기존 쿠키(`refresh_token`/`csrf_token`/`oauth_state`)와 이름이 겹치지 않는 별도 네임스페이스. §1에서 밝힌 대로 게스트는 인증 세션의 축소판이 아니므로, 회원 쿠키와 혼동될 수 있는 이름(`session_id` 등)을 피한다.
- **값 — DB에 해시가 아닌 원문 저장**: `RefreshToken.tokenHash`는 원문을 저장하지 않는다(REQ-AUTH-008) — 유출 시 계정 전체를 탈취할 수 있는 자격 증명이기 때문이다. 게스트 카트 식별자는 유출되어도 최악의 경우가 "타인의 장바구니 내용(상품·수량, PII 없음)을 열람"에 그친다 — 결제 수단도, 개인정보도, 계정 접근권도 얻지 못한다. 이 낮은 피해 범위(blast radius)가 리프레시 토큰과 다른 취급을 정당화한다: `Cart.guestId`에 원문 opaque 값을 직접 저장해 조회 쿼리를 단순하게(`where: { guestId }`) 유지한다. 값 자체는 여전히 `randomBytes(32)` 기반 암호학적 난수이므로 추측(guessing)에 의한 열거 공격은 여전히 어렵다.
- **수명 — 리프레시 토큰(30일)과 독립적으로 14일**: 게스트 데이터는 재인증 플로우도 없고 보존 가치가 회원 세션보다 낮다(재방문하지 않으면 그냥 버려지는 임시 카트) — 30일과 동일하게 맞출 근거가 없다. 반대로 한 번의 방문 세션만큼 짧게(예: 1일) 잡으면 며칠 뒤 재방문해 결제를 마치려는 사용자의 카트가 사라진다. 14일을 "다시 방문해 구매를 마칠 가능성이 있는 기간"과 "회원 세션보다는 짧게 유지"라는 두 요구의 절충값으로 결정한다. `JWT_ACCESS_TOKEN_EXPIRY`/`JWT_REFRESH_TOKEN_EXPIRY`와 동일한 컨벤션으로 환경변수 오버라이드를 지원한다.
- **httpOnly/Secure/SameSite**: `cookies.ts`의 기존 패턴(`isSecureEnvironment()` — `NODE_ENV`에서 파생, `sameSite: "lax"`)을 그대로 재사용한다. run-phase에서 `isSecureEnvironment()`를 `cookies.ts`에서 export해 재사용하거나(선택), `guest-identity.ts`에 동일한 한 줄 로직을 반복하지 않도록 재사용 사다리(constitution §Enforce Simplicity)를 따른다 — 새 헬퍼를 만들기보다 기존 것을 export하는 쪽을 우선 검토한다.
- **CSRF 보호는 이번 SPEC 범위 밖**(spec.md §3) — 잔여 위험을 명시적으로 수용한다.

### 2.3 병합 알고리즘: sum + clamp + omit-zero

**결정**: 로그인 성공 시(email/password 또는 Google OAuth 공통), 요청 쿠키의 `guest_cart_id`로 게스트 카트를 조회한다.

1. 게스트 카트가 없으면(쿠키 없음 또는 카트 미존재) 아무 것도 하지 않는다.
2. 사용자 카트가 없으면(첫 로그인) — **게스트 카트를 사용자 카트로 승격(promote)한다**: `Cart.userId`를 채우고 `Cart.guestId`를 비운다. 항목을 하나씩 복사하는 대신 소유권만 재할당해 불필요한 행 churn을 피한다(REQ-CART-013의 "게스트 쿠키로 더 이상 조회되지 않음"은 `guestId`가 비워짐으로써 자연히 성립한다 — spec.md REQ-CART-013을 구현 중립적으로 쓴 이유).
3. 사용자 카트가 이미 있으면 — 게스트 카트의 각 항목에 대해:
   - 사용자 카트에 동일 `productId`가 있으면: `합산 수량 = min(게스트 수량 + 사용자 수량, Product.stock)`으로 사용자 카트 항목을 갱신.
   - 없으면: `수량 = min(게스트 수량, Product.stock)`으로 사용자 카트에 새 항목 생성.
   - 클램프 결과가 0이면(재고 소진) 해당 상품은 병합된 카트에 항목으로 남기지 않는다(REQ-CART-002/012).
   - 병합 완료 후 게스트 카트(및 하위 `CartItem`)를 삭제한다(cascade).
4. 두 경로(승격/병합) 모두 게스트 카트는 더 이상 그 `guestId`로 조회되지 않으므로, 같은 게스트 쿠키로 재로그인해도 자연히 no-op(멱등)이다 — 별도의 "이미 병합됨" 플래그가 필요 없다.

이 승격-vs-병합 구분은 **구현 최적화**이며 spec.md의 관찰 가능한 계약(REQ-CART-011~013)을 바꾸지 않는다 — spec.md는 의도적으로 "비움·삭제·소유권 이전 등 구현 방식은 자유"라고 명시해 이 최적화를 허용해 둔다.

### 2.4 가격 스냅샷 여부: 라이브 조인 (선택) vs 담기 시점 스냅샷

**결정: 스냅샷하지 않는다 — `CartItem`은 가격을 저장하지 않고 항상 `Product.price`를 조인해 계산한다.**

트레이드오프(SPEC-CATALOG-002의 §2.3 스타일):

| 대안 | 장점 | 단점 |
|---|---|---|
| A. 라이브 조인(선택) | 스키마 단순(가격 컬럼 불필요), 카트가 항상 현재 판매가를 반영 — 아직 구매를 확정하지 않은 단계이므로 "지금 이 가격에 산다"는 약속이 존재하지 않음 | 담은 후 가격이 오르면 사용자가 놀랄 수 있음(그러나 체크아웃 진입 시 재확인하면 됨 — 그 시점의 가격 확정/잠금은 체크아웃 SPEC의 책임) |
| B. 담기 시점 스냅샷 | 사용자가 담은 가격이 보존됨 | 이번 SPEC에 구체적 요구사항이 없는 상태에서 컬럼과 동기화 로직을 미리 추가하는 선제 설계 — YAGNI 위반. 체크아웃 SPEC이 결제 정합성(`tech.md` 최우선 제약)을 위해 어차피 독자적인 가격 확정/잠금 메커니즘(멱등키·웹훅 기반, tech.md §PG 연동)을 설계해야 하므로, 카트 레벨 스냅샷은 그 설계와 중복되거나 충돌할 위험이 있음 |

A를 선택한다: 체크아웃 SPEC이 결제 정합성을 위해 독자적인 가격 확정 메커니즘을 소유해야 한다는 것이 이미 `tech.md`에 명시돼 있으므로, 카트 단계에서 선제적으로 가격을 잠그는 것은 그 책임을 흐리게 만든다. spec.md §3 Out of Scope에 명시.

### 2.5 수량 시맨틱: 담기=증분(increment), 수량변경=절대설정(absolute set)

**결정**: `POST /api/cart/items`(담기)는 같은 상품을 다시 담으면 기존 수량에 **더한다**(REQ-CART-006) — "장바구니에 1개 더 담기"라는 일반적인 이커머스 UX와 일치. `PATCH /api/cart/items/:itemId`(수량변경)는 요청 값으로 수량을 **절대 설정**한다(REQ-CART-008) — 카트 UI의 수량 스테퍼/입력창이 "지금부터 N개"를 표현하는 일반적인 패턴과 일치. 두 엔드포인트가 다른 의미론을 갖는 것은 의도적이며, 각 REQ에 명시했다.

수량을 0으로 낮추는 것은 `PATCH`가 아니라 `DELETE /api/cart/items/:itemId`로 표현한다 — "0개"라는 매직 넘버로 삭제를 암묵적으로 표현하지 않는다(REQ-CART-002 불변식과 일치: `PATCH`에 `quantity: 0`이 오면 REQ-CART-007의 "1 이상의 정수가 아님" 검증에 걸려 400으로 거부된다).

### 2.6 장바구니 지연 생성 (lazy Cart row creation)

**결정**: 신원 해석(REQ-CART-003)은 게스트 쿠키를 즉시 발급하지만(쿠키 자체는 저렴하고, 요청 간 신원을 안정적으로 식별하게 해줌), 실제 `Cart` DB 행은 **첫 담기(add-item) 호출 시점에만** 지연 생성한다. 아직 아무것도 담지 않은 방문자가 카트 배지를 표시하려고 `GET /api/cart`를 호출할 때마다 빈 `Cart` 행이 쌓이는 것을 피한다 — `Cart` 행이 없으면 `GET`은 빈 카트 형태(`{ items: [], subtotal: 0, itemCount: 0 }`)를 DB 쓰기 없이 반환한다.

## §3. API 계약 (Route Handlers)

응답 일관성 결정: 담기/수량변경/삭제 3개 변경 엔드포인트 모두 `GET /api/cart`와 **동일한 전체 카트 형태**를 응답으로 반환한다(단일 항목만 반환하지 않음) — 클라이언트가 매 변경 후 별도로 카트를 다시 조회하지 않아도 되도록 한다.

### 3.1 `GET /api/cart` — 조회

응답 200:
```json
{
  "items": [
    { "id": "...", "productId": "...", "name": "...", "price": 39000, "image": "...",
      "stock": 12, "quantity": 2, "lineTotal": 78000 }
  ],
  "subtotal": 78000,
  "itemCount": 2
}
```
카트 행이 없으면 `{ "items": [], "subtotal": 0, "itemCount": 0 }` (§2.6).

### 3.2 `POST /api/cart/items` — 담기

요청: `{ "productId": "...", "quantity": 2 }`. 응답 200: `GET /api/cart`와 동일한 전체 카트 형태. 응답 400: 존재하지 않는 `productId`, 1 이상의 정수가 아닌 `quantity`, 또는 재고 초과(REQ-CART-007).

### 3.3 `PATCH /api/cart/items/:itemId` — 수량 변경

요청: `{ "quantity": 5 }`(절대값). 응답 200: 전체 카트 형태. 응답 400: REQ-CART-007과 동일. 응답 404: `itemId`가 존재하지 않거나 해석된 카트에 속하지 않음(REQ-CART-010).

### 3.4 `DELETE /api/cart/items/:itemId` — 삭제

응답 200: 전체 카트 형태(삭제 후 상태). 응답 404: REQ-CART-010과 동일.

### 3.5 병합 — 공개 HTTP 엔드포인트 아님

`mergeGuestCartIntoUserCart(userId, guestId)`는 `cart-service.ts`가 노출하는 **서비스 함수**이며, 별도의 공개 라우트가 아니다. 로그인 성공 경로(§6)에서만 호출된다.

## §4. Prisma 스키마 확장 (설계 — run-phase에서 적용, 이번 plan-phase는 `prisma/schema.prisma` 미변경)

```prisma
model Cart {
  id        String     @id @default(cuid())
  userId    String?    @unique
  guestId   String?    @unique
  user      User?      @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([guestId])
}

model CartItem {
  id        String   @id @default(cuid())
  cartId    String
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([cartId, productId])
  @@index([productId])
}
```

- `User` 모델에 `carts Cart[]` 관계 필드 추가 필요(run-phase, §2.1).
- `Product` 모델에 `cartItems CartItem[]` 관계 필드 추가 필요(run-phase).
- `@@unique([cartId, productId])`는 "카트당 상품 하나에 행 하나"를 DB 레벨에서 보장 — REQ-CART-006의 담기=증분 로직(upsert)이 이 제약에 의존한다.
- `@@unique([userId])`/`@@unique([guestId])`는 nullable 컬럼이므로 NULL은 유일성 검사에서 제외된다(Postgres 표준 동작) — "회원당 카트 최대 1개", "게스트 쿠키당 카트 최대 1개"를 보장하면서도 두 컬럼이 동시에 NULL인 행(불변식 위반)은 스키마만으로 막지 못한다(§2.1에서 밝힌 대로 앱 레벨 책임).

## §5. 레이어링 및 파일 목록

```
src/lib/auth/guest-identity.ts                      # NEW — 게스트 쿠키 생성/빌더(§2.2), cookies.ts와 병렬 구조
src/features/cart/types/cart.ts                      # NEW — Cart/CartItem DTO, 요청/응답 타입
src/features/cart/repositories/cart-repository.ts    # NEW — Prisma 쿼리(조회/생성/증분/절대설정/삭제/승격/병합 보조 쿼리)
src/features/cart/services/cart-service.ts            # NEW — 신원 해석, 검증, 재고 체크, 응답 조립, mergeGuestCartIntoUserCart()
src/app/api/cart/route.ts                             # NEW — GET
src/app/api/cart/items/route.ts                       # NEW — POST
src/app/api/cart/items/[itemId]/route.ts              # NEW — PATCH, DELETE
src/app/api/auth/login/route.ts                       # EXTEND (run-phase) — §6 통합 지점만 추가
src/app/api/auth/google/callback/route.ts             # EXTEND (run-phase) — §6 통합 지점만 추가
prisma/schema.prisma                                  # EXTEND (run-phase) — §4
prisma/migrations/<timestamp>_add_cart_cart_item/     # NEW (run-phase)
tests/unit/cart/**                                    # NEW
tests/integration/cart/**                             # NEW
```

기존 SPEC-AUTH-001(`User`/`OAuthAccount`/`RefreshToken` 모델, `src/lib/auth/{jwt,session,cookies,password,rate-limit,csrf,google-oauth}.ts`, `src/middleware.ts`)과 SPEC-CATALOG-001/002(`Category`/`Product` 모델, `src/features/catalog/**`, `src/app/api/products/**`)는 PRESERVE — `login/route.ts`·`google/callback/route.ts`의 §6 통합 지점을 제외하고 손대지 않는다.

## §6. SPEC-AUTH-001 통합 지점 (cross-cutting, 이번 plan-phase는 파일 미수정)

로그인 성공 경로 두 곳(`src/app/api/auth/login/route.ts`, `src/app/api/auth/google/callback/route.ts`)은 이미 `issueSession(userId, role)` 호출 직후 응답 쿠키를 구성하고 있다(각각 94번째 줄 부근, 196번째 줄 부근). run-phase는 그 직후 지점에:

1. 들어온 요청의 `guest_cart_id` 쿠키 값을 읽는다 — `google/callback/route.ts`에는 이미 모듈 비공개 `getCookieValue(request, name)` 헬퍼가 있다(36번째 줄). `login/route.ts`에는 아직 쿠키를 읽는 코드가 없다. 이 헬퍼를 공유 위치(예: `src/lib/auth/guest-identity.ts` 또는 신설 `src/lib/http/cookies.ts`)로 옮겨 두 라우트가 함께 재사용하도록 한다 — 파서를 두 번 구현하지 않는다(재사용 사다리).
2. `mergeGuestCartIntoUserCart(user.id 또는 userId, guestId)`를 호출한다.
3. 응답에 게스트 쿠키를 만료시켜 설정한다(`buildExpiredGuestCookie()`) — 병합 후에는 그 게스트 쿠키가 더 이상 유효한 카트를 가리키지 않으므로, 클라이언트에 남겨두면 다음 요청이 존재하지 않는 게스트 카트를 조회하려 시도하게 된다.

이 통합은 두 파일 모두에서 **추가만** 일어난다 — 기존 로그인/OAuth 로직(REQ-AUTH-004~019)은 변경하지 않는다. 정확한 diff는 run-phase 작업이며, 이번 plan-phase는 파일을 수정하지 않는다(과제 제약).

## §7. 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (Priority High)** — Prisma 스키마 확장: `Cart`/`CartItem` 모델 추가, `User.carts`/`Product.cartItems` 관계 필드 추가, 마이그레이션 생성·적용.
- **M2 (Priority High)** — `src/lib/auth/guest-identity.ts` + `features/cart/{types,repositories}`: 게스트 쿠키 빌더, Cart/CartItem 쿼리 레이어(조회/증분 upsert/절대설정/삭제/승격).
- **M3 (Priority High)** — `features/cart/services/cart-service.ts`: 신원 해석(bearer vs guest cookie), 요청 검증(REQ-CART-007), 재고 체크, 응답 조립(subtotal 계산), `mergeGuestCartIntoUserCart()`(sum+clamp+omit-zero, §2.3).
- **M4 (Priority High)** — Route Handlers(`app/api/cart/route.ts`, `app/api/cart/items/route.ts`, `app/api/cart/items/[itemId]/route.ts`) 연결.
- **M5 (Priority Medium)** — SPEC-AUTH-001 통합(§6): `login/route.ts`, `google/callback/route.ts`에 병합 호출 + 게스트 쿠키 만료 처리 추가.
- **M6 (Priority Medium)** — 단위/통합 테스트: 담기 증분, 수량변경 절대설정, 재고 초과 400, 404 케이스, 병합 sum/clamp/omit-zero, 병합 후 재로그인 멱등성, 게스트 무인증 접근, 재고 비차감 확인, 기존 인증/카탈로그 API 회귀 없음.

## §8. 리스크

- **게스트 카트 동시 수정 경합(race)**: 같은 게스트 쿠키로 여러 탭에서 거의 동시에 담기 요청을 보내면 `@@unique([cartId, productId])` upsert 경합이 발생할 수 있다 — 이번 SPEC은 재고 예약/락(REQ-CART-015)을 다루지 않으므로 낮은 우선순위의 잔여 위험으로 남기며, 필요 시 run-phase에서 Prisma의 `upsert` 원자성으로 대부분 자연히 완화된다.
- **`getCookieValue` 헬퍼 이동에 따른 회귀 위험**: §6에서 기존 `google/callback/route.ts`의 모듈 비공개 헬퍼를 공유 위치로 옮기는 작업은 SPEC-AUTH-001 파일을 건드리는 유일한 지점이다 — run-phase에서 기존 OAuth 콜백 테스트(AC-AUTH-014 등)가 회귀 없이 통과하는지 반드시 확인해야 한다.
- **`pg_trgm`/재고 컬럼과 무관하지만 `Product` FK 방향**: `CartItem.productId`에 `onDelete: Cascade`를 걸었다 — 상품이 삭제되면 모든 카트에서 해당 항목이 조용히 사라진다. 이번 SPEC은 상품 삭제 API를 만들지 않으므로 즉시 발동하지 않지만, 향후 관리자 상품 삭제 SPEC이 이 동작을 재검토할 수 있음을 기록해 둔다(SPEC-CATALOG-001의 `Category` FK `Restrict` 결정과 대비되는 선택 — 카트 항목은 삭제된 상품을 계속 참조할 이유가 없으므로 Cascade가 더 단순하다).

## §9. plan-audit 대상 확인 사항

**Clarification status**: 미해결 항목 없음 — 이번 SPEC은 사용자와 사전 확정된 요구사항(게스트 카트 저장 방식, 병합 충돌 전략의 sum+clamp, 재고 검증 규칙, 4개 엔드포인트 필요성)을 기반으로 하며, 사용자가 이번 SPEC 저작자의 판단에 맡긴 항목(게스트 쿠키 설계 §2.2, 가격 스냅샷 여부 §2.4)은 이번 plan-phase에서 대안을 검토해 명시적으로 결정했다. plan-phase에서 추가로 열린 질문은 발생하지 않았다.
