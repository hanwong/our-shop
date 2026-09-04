---
id: SPEC-REVIEW-001
title: "상품 리뷰 작성 및 평점/후기 표시"
version: "0.1.0"
status: in-progress
created: 2026-09-04
updated: 2026-09-05
author: snake
priority: P2
phase: "v0.2.0 target"
module: "src/features/reviews"
lifecycle: spec-anchored
tags: "reviews, rating, product-detail, auth"
tier: M
depends_on: [SPEC-AUTH-002]
related_specs: [SPEC-CATALOG-001, SPEC-STOREFRONT-001, SPEC-STOREFRONT-003, SPEC-ORDER-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-04 | 0.1.0 | draft | plan-phase 최초 작성. 착수 전 사용자가 이미 Socratic AskUserQuestion 라운드로 범위를 확정한 상태로 위임됨 — 별도 명료화 라운드 없이 진행. `[NEEDS CLARIFICATION]` 마커 없음. |

---

## §1. 개요

로그인한 모든 고객(또는 admin 계정)이 상품마다 **별점(1-5) + 텍스트 후기**를 하나씩 작성할 수 있게 하고, 상품 상세 페이지에 **평균 평점, 리뷰 개수, 리뷰 목록**을 표시하며, 미로그인 방문자에게는 작성 폼 대신 로그인 유도 문구를 보여준다.

### 이 SPEC이 잇는 경계 — SPEC-CATALOG-001과 SPEC-STOREFRONT-001이 이미 예고한 대상

`SPEC-CATALOG-001/spec.md`는 이미 이렇게 적어 두었다: "상품 리뷰 작성/조회, 관련 상품 추천은 `structure.md`가 별도로 제안한 `features/reviews` 도메인에서 다룬다." `SPEC-STOREFRONT-001/spec.md`의 **REQ-STOREFRONT-009**(Unwanted)는 "상품 상세 화면은 리뷰... 를 표시해서는 안 된다"라고 명시했고, 바로 그 SPEC의 §3 Out of Scope는 "리뷰 작성/조회 UI... 는 각각 별도 도메인 SPEC 대상이다"라고 못박았다. `structure.md`(43행, 56행) 역시 `src/features/reviews/`와 `src/app/api/reviews/`를 미리 예약해 두었다.

이 SPEC이 바로 그 예고된 SPEC이다. 따라서 이 SPEC의 구현은 **SPEC-STOREFRONT-001의 REQ-STOREFRONT-009를 리뷰 표시 범위에 한해 대체**한다 — REQ-STOREFRONT-009 자체를 이 문서에서 수정하지는 않는다(그 SPEC은 `status: completed`로 종료된 별도 문서이며, 이 SPEC은 manager-spec의 아티팩트 소유 범위 밖이다). 대신 그 REQ가 "리뷰는 아직 없다"는 전제로 쓰인 것이었고, 이 SPEC이 그 전제를 채운다는 관계를 여기 명시적으로 기록한다.

### 이 대체가 건드리는 구체적 파일 — 기존 회귀 테스트의 조정

REQ-STOREFRONT-009는 서술로만 존재하는 것이 아니라 `tests/unit/components/product-detail-view.test.tsx`(`describe("ProductDetailView — AC-STOREFRONT-009", ...)`)에서 렌더링된 텍스트에 "리뷰|관련 상품|재고 변동" 정규식이 매치되지 않아야 한다고 기계적으로 단언한다. 이 SPEC이 `ProductDetailView.tsx`에 리뷰 섹션을 추가하면 그 단언 중 "리뷰" 부분은 더 이상 성립하지 않는다 — 이것은 우연한 회귀가 아니라 REQ-REVIEW-007/008/009가 REQ-STOREFRONT-009를 의도적으로 승계한 데 따른 예정된 결과다. 이 SPEC은 이 테스트 파일을 자신의 수정 대상으로 명시적으로 등재하고("관련 상품"/"재고 변동" 부재 단언은 그대로 유지한 채 "리뷰" 부재 단언만 조정한다), 구체적 반영 방법을 `plan.md` M3와 §F 파일 목록에 기술한다.

### 소비하는 기존 계약 (변경하지 않음)

- **`resolveSession(cookieStore): Promise<{userId: string; role: "customer" | "admin"} | null>`** (`src/lib/auth/session-resolver.ts`, SPEC-AUTH-002 `status: completed`) — 역할 무관 세션 조회. 이 SPEC은 이 함수를 **첫 실제 소비자**로 호출한다(SPEC-AUTH-002 작성 시점엔 "아직 호출자가 없다"고 기록되어 있었다). 읽기 전용이며 쿠키를 갱신하지 않는다.
- **`Product`/`User` 모델** (`prisma/schema.prisma`) — 각각에 `reviews Review[]` 역참조만 추가하고 기존 필드는 건드리지 않는다.

### 왜 "구매 인증"이 아니라 "로그인 인증"인가 — 회원 체크아웃이 아예 불가능하다

원래 요청에는 "구매 인증(verified purchase)" 배지가 포함되어 있었으나, `src/app/api/orders/route.ts`를 직접 읽어 확인한 사실은 이렇다: `POST /api/orders`는 `resolveCartIdentity(request)`의 `identity.kind === "user"` 분기에서 요청 본문을 파싱하기도 전에 409 `MEMBER_CHECKOUT_UNSUPPORTED`를 반환한다 — 이것은 SPEC-ORDER-001/CART-001/STOREFRONT-002가 공유하는 **의도된, 문서화된 범위 경계**(게스트 전용 체크아웃)다. `Order` 모델(`prisma/schema.prisma`)도 `guestId String`(NOT NULL)만 갖고 `userId`/`user` 관계 자체가 존재하지 않는다.

즉 로그인한 회원은 오늘 이 저장소에서 **주문을 완료할 방법이 아예 없다** — 따라서 "이 회원이 이 상품을 실제로 구매했는가"를 검증할 데이터가 존재하지 않는다. 이 상태에서 구매 인증 배지를 만드는 것은 검증 불가능한 기능을 만드는 것과 같으므로, 이번 SPEC 범위에서 명시적으로 제외한다(§3 참고). 대신 **로그인 여부**만으로 작성 권한을 판정한다 — 구매자로 한정하지 않는다.

### 데이터 모델 — `Review` (신규)

`prisma/schema.prisma`에 `User`(29-45행)·`Product`(107-141행) 각각에 역참조 `reviews Review[]`를 추가하고, `Product` 모델 부근에 신규 모델을 둔다:

```prisma
model Review {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int
  body      String
  createdAt DateTime @default(now())

  @@unique([userId, productId])
  @@index([productId])
}
```

`rating`(1-5)의 범위 검증은 DB 제약이 아니라 **서비스 레이어에서만** 수행한다 — 이 스키마의 기존 관례(예: `Product.stock`/`price`도 DB 레벨 range 제약이 없다)를 그대로 따른 것이며, 새로운 제약 스타일을 도입하지 않는다(constitution Enforce Simplicity).

`@@unique([userId, productId])`가 "사용자당 상품당 리뷰 1개"라는 확정된 결정(§3 아님, 본 스코프)을 DB 레벨에서 강제한다 — 두 번째 작성 시도는 애플리케이션 레벨 사전 조회가 아니라 이 제약이 최종 방어선이다(동시 요청 레이스에서도 안전).

### 평균/개수 — 라이브 집계, 비정규화 컬럼 아님 (명시적 설계 결정)

`Product`에 `averageRating`/`reviewCount` 같은 비정규화 컬럼을 두지 않는다. 대신 `prisma.review.aggregate({_avg: {rating: true}, _count: true, where: {productId}})`를 상품 상세 페이지 렌더링 시점에 직접 호출한다. 이유: 이 저장소 어디에도 아직 비정규화-집계 패턴의 선례가 없고, 현재 트래픽 규모에서 성능상 이 방식을 포기할 근거도 없다 — 조기 최적화를 피한다(constitution Enforce Simplicity). 트래픽이 늘어 성능 문제가 실측되면 별도 SPEC에서 비정규화를 재검토한다.

### API/화면 책임 분리 — 쓰기만 HTTP, 읽기는 서비스 직접 호출

이 저장소의 확립된 관례(`product-service.ts`/`ProductDetailPage` 문서 주석)를 그대로 따른다: 서버 컴포넌트는 이 앱 자신의 HTTP API를 거치지 않고 서비스 함수를 직접 호출한다. 따라서:

- `POST /api/reviews`만 신설한다(`src/app/api/reviews/route.ts`) — 클라이언트 컴포넌트(`ReviewForm`, `"use client"`)가 유일하게 HTTP 경계를 넘어야 하는 쓰기 경로이기 때문이다.
- `GET /api/reviews`는 만들지 않는다 — 상품 상세 페이지는 리뷰 목록과 집계를 리뷰 서비스 함수에서 직접 읽는다.

### 상품 상세 페이지 변경 — "익명 전용 설계" 주석의 갱신

`src/app/products/[productId]/page.tsx`는 현재 "Anonymous by design (REQ-STOREFRONT-005): no session lookup"이라는 문서 주석과 함께 세션 조회를 전혀 하지 않는다. 이 SPEC은 그 문서 주석이 서술하는 사실 자체를 바꾼다 — 페이지(또는 그 아래 위임 대상)가 `resolveSession()`을 호출해 로그인 여부를 판정하고, 그 결과에 따라 `ReviewForm`(로그인 시) 또는 "로그인하고 리뷰 남기기" 안내(비로그인 시)를 렌더링한다. 상품 조회 자체(REQ-STOREFRONT-005의 "누구나 볼 수 있다"는 취지)는 바뀌지 않는다 — 바뀌는 것은 페이지가 이제 세션도 함께 읽는다는 사실뿐이므로, 오래된 "no session lookup" 주석은 갱신되어야 한다(구현 시 반영, `plan.md` §F 파일 목록 참고).

`src/components/product/ProductDetailView.tsx`의 렌더 순서(`ProductGallery` → 이름 → 카테고리 → 가격 → 재고 → `AddToCartButton` → 설명)의 **맨 끝, 설명 다음**에 리뷰 섹션(평균/개수 + 목록 + 폼-또는-로그인프롬프트)을 추가한다.

---

## §2. 요구사항 (GEARS)

- **REQ-REVIEW-001** (Ubiquitous): 리뷰 서비스는 (userId, productId) 쌍마다 리뷰를 최대 1개까지만 유지해야 한다(shall), DB `@@unique([userId, productId])` 제약으로 강제한다.
- **REQ-REVIEW-002** (When, event-driven): **When** 인증된 사용자가 아직 리뷰하지 않은 상품에 대해 유효한 rating(1-5 정수)과 비어 있지 않은 body로 `POST /api/reviews`를 호출하면, 리뷰 서비스는 Review 행을 생성하고 201과 생성된 리뷰를 반환해야 한다(shall).
- **REQ-REVIEW-003** (When, event-detected): **When** `resolveSession()`이 `null`을 반환하는 상태(세션 없음/무효)로 `POST /api/reviews`가 호출되면, API 라우트는 Review 행을 생성하지 않고 401을 반환해야 한다(shall).
- **REQ-REVIEW-004** (When, event-detected): **When** 이미 해당 상품에 리뷰가 있는 사용자가 `POST /api/reviews`를 다시 호출하면, 리뷰 서비스는 기존 행을 변경하지 않고 409를 반환해야 한다(shall).
- **REQ-REVIEW-005** (When, event-detected): **When** rating이 1-5 범위를 벗어나거나 body가 없거나 빈 문자열인 상태로 `POST /api/reviews`가 호출되면, API 라우트는 행을 생성하지 않고 어떤 필드가 유효하지 않은지 명시하는 400을 반환해야 한다(shall).
- **REQ-REVIEW-006** (When, event-detected): **When** 존재하지 않는 productId로 `POST /api/reviews`가 호출되면, API 라우트는 행을 생성하지 않고 404를 반환해야 한다(shall).
- **REQ-REVIEW-007** (Ubiquitous): 상품 상세 페이지는 `prisma.review.aggregate()`로 계산한 해당 상품의 평균 평점(소수 1자리 반올림)과 리뷰 개수를 표시해야 한다(shall).
- **REQ-REVIEW-008** (Where, capability gate): **Where** 요청 방문자의 세션이 인증된 사용자로 해석되면, 상품 상세 페이지는 리뷰 작성 폼을 렌더링해야 한다(shall); 그렇지 않으면 `/login`으로 연결되는 로그인 유도 문구를 대신 렌더링해야 한다(shall).
- **REQ-REVIEW-009** (Ubiquitous): 상품 상세 페이지는 해당 상품의 리뷰 목록(평점 + 본문 + 작성일)을 최신 작성순으로 표시해야 한다(shall).
- **REQ-REVIEW-010** (Unwanted, shall not): 홈 라우트 상품 그리드(`ProductGrid`/`ProductCard`)는 평점 배지나 리뷰 개수를 표시해서는 안 된다(shall not).
- **REQ-REVIEW-011** (Unwanted, shall not): 이 기능은 기존 리뷰에 대한 수정, 삭제, 관리자 모더레이션 기능을 제공해서는 안 된다(shall not).
- **REQ-REVIEW-012** (Unwanted, shall not): 리뷰 작성 경로는 구매 여부를 검증하거나 요구해서는 안 된다(shall not).

### 인라인 AC 개요 (상세는 acceptance.md — Tier M이므로 참고용 요약만)

각 REQ는 `acceptance.md`의 AC-REVIEW-001 ~ AC-REVIEW-016에 1:1 이상으로 대응한다. GEARS 요구사항 자체(위 목록)는 이 문서(spec.md)가 SSOT이며, Given-When-Then 시나리오는 acceptance.md가 SSOT다 — 두 레이어를 혼용해 서술하지 않는다.

---

## §3. 범위 제외 (Out of Scope)

### Out of Scope — 구매 인증 (Verified Purchase)
- 이 SPEC은 "실제로 이 상품을 구매한 사용자만 작성 가능" 또는 "구매 확인됨" 배지를 만들지 않는다.
- 근거: `POST /api/orders`가 로그인 회원의 체크아웃을 409 `MEMBER_CHECKOUT_UNSUPPORTED`로 항상 거부하므로(§1), 구매 여부를 검증할 데이터 자체가 존재하지 않는다.
- 향후 별도의 "회원 체크아웃" SPEC이 로그인 회원의 주문 완료를 가능하게 하면, 그 SPEC이 이 제약을 해제하는 후속 전제가 된다 — 현재는 어떤 SPEC-ID도 확정되지 않았으므로 여기서 특정 ID를 지정하지 않는다.

### Out of Scope — 구매자 한정 작성 제한 (Purchaser-Only Restriction)
- 작성 권한은 오직 "로그인했는가"로만 판정한다. 관리자(admin) 계정도 고객과 동일하게 작성할 수 있다 — 역할별 차등 없음.

### Out of Scope — 리뷰 수정 (Edit on Second Attempt)
- 동일 (user, product) 쌍의 두 번째 작성 시도는 기존 리뷰를 덮어쓰지 않는다 — 409 충돌로 거부한다(REQ-REVIEW-004). "수정" 동작 자체가 이번 범위에 없다.

### Out of Scope — 리뷰 수정/삭제 및 관리자 모더레이션
- 작성된 리뷰를 편집하거나 삭제하는 UI/API를 만들지 않는다. 관리자 백오피스(SPEC-ADMIN-002/003)에도 리뷰 모더레이션 화면을 추가하지 않는다.

### Out of Scope — 상품 목록 그리드 노출
- 홈 라우트(`src/app/page.tsx`)의 `ProductGrid`/`ProductCard`(SPEC-STOREFRONT-003)에 평점 배지를 추가하지 않는다. 표시 위치는 상품 상세 페이지로 한정한다. 그리드 노출은 향후 별도 SPEC 후보다.

---

## §4. 교차 참조

- **SPEC-AUTH-002** (`status: completed`, `depends_on`): `resolveSession()`의 원천. 이 SPEC이 첫 실제 소비자.
- **SPEC-CATALOG-001**: `features/reviews` 도메인을 미리 예고한 SPEC.
- **SPEC-STOREFRONT-001**: REQ-STOREFRONT-009(리뷰 미표시)와 §3 Out of Scope(리뷰는 별도 SPEC)로 이 SPEC을 미리 예고. 이 SPEC 구현 이후, REQ-STOREFRONT-009는 "리뷰 표시" 범위에 한해 이 SPEC의 REQ-REVIEW-007/008/009로 대체된다(문서 자체는 수정하지 않음 — §1 참고).
- **SPEC-STOREFRONT-003**: 홈 그리드/`ProductCard`. 이 SPEC은 그 컴포넌트를 변경하지 않는다(§3).
- **SPEC-ORDER-001**: `POST /api/orders`의 회원 체크아웃 거부 로직 — 구매 인증 배제의 근거.
- **(미확정) 향후 "회원 체크아웃" SPEC**: 구매 인증 기능의 미래 전제 조건. 현재 SPEC-ID 없음.
