---
id: SPEC-ADMIN-002
title: "관리자 상품 등록/수정 백오피스"
version: "0.1.0"
status: in-progress
created: 2026-09-04
updated: 2026-09-04
author: snake
priority: P1
phase: "v0.2.0 target"
module: "src/features/admin"
lifecycle: spec-anchored
tags: "admin, backoffice, product, catalog, soft-delete, crud, session"
tier: L
depends_on: [SPEC-ADMIN-001, SPEC-CATALOG-001, SPEC-CATALOG-002, SPEC-AUTH-001]
related_specs: [SPEC-CART-001, SPEC-ORDER-001, SPEC-ORDER-002, SPEC-DISCOUNT-001, SPEC-STOREFRONT-001, SPEC-STOREFRONT-002]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-04 | 0.1.0 | draft | plan-phase 최초 작성. 백로그 카드 `t11`("관리자 상품 등록/수정 백오피스")를 다룬다. `SPEC-ADMIN-001`이 `product.md` 핵심 기능 #6의 주문 관리 절반을 끝내면서 상품 관리 절반을 명시적으로 이 카드에 넘겼고, 관리자 세션 판정·CSRF·경로 관례를 `t11`이 그대로 재사용할 수 있게 설계해 두었다(research.md §3). **조사에서 드러난 이 SPEC 고유의 어려움은 소프트 삭제 컬럼 추가가 이미 완료된 고객 대면 카탈로그(SPEC-CATALOG-001/002)에 미치는 연쇄 효과다** — 필터를 걸지 않으면 관리자의 "삭제"가 고객에게 아무 효과가 없다(research.md §5). 이 SPEC은 `findProductsPage`/`findProductById`를 EXTEND해 그 연쇄를 닫되(REQ-ADMIN-034~036), 장바구니에 이미 담긴 상품의 공백은 떠안지 않고 신규 백로그 카드로 넘긴다(§3, research.md §5.3). |

---

## §1. 개요

`our-shop`의 **두 번째 관리자(백오피스) 화면**을 정의한다 — 관리자가 상품 목록을 조회하고, 새 상품을 등록하고, 기존 상품을 수정하고, 상품을 판매 중단(소프트 삭제)·복구할 수 있게 한다. `product.md` 핵심 기능 #6("관리자 상품·주문 관리")의 **상품 관리 절반**이며, 주문 관리 절반은 `SPEC-ADMIN-001`이 이미 완료했다.

> **이 SPEC은 새 관리자 인증 체계를 만들지 않는다.** `SPEC-ADMIN-001`이 만든 `resolveAdminSession()`, CSRF 적용 순서, `/staff/*` 페이지 + `/admin/api/*` 쓰기 API 경로 관례를 **그대로 재사용**한다(research.md §3). 그 SPEC의 design.md §1이 "`t11`이 그대로 재사용할 수 있는 관례를 만든다 — `/staff/products`, `/admin/api/products` 형태로 확장 가능"이라고 이 확장을 미리 지목해 두었다.

> **이 SPEC은 상품을 물리 삭제하지 않는다.** `OrderItem.product`가 `onDelete: Restrict`이므로 주문된 적 있는 상품은 DB 레벨에서 삭제가 아예 실패하고, `CartItem.product`는 `onDelete: Cascade`라 삭제가 성공하는 경우에도 고객 장바구니가 예고 없이 줄어든다(research.md §1). 소프트 삭제는 이 비대칭에 대한 정확한 대응이며, 새 선호가 아니라 스키마가 이미 요구하던 것이다.

### 이 SPEC이 인수하는, 선행 SPEC이 명시적으로 넘긴 책임

네 개의 선행 SPEC이 독립적으로 상품 관리자 기능의 소유자로 이 SPEC(백로그 `t11`)을 지목했다.

| 출처 | 문구 | 이 SPEC의 인수 |
|---|---|---|
| `SPEC-ADMIN-001` §3 "Out of Scope — 상품/카탈로그 관리자 화면" | "상품 등록·수정·재고 조정 관리자 화면과 API는 범위 밖이다(`product.md` 핵심 기능 #6의 다른 절반). 넘긴 곳: 백로그 카드 `t11`. 이 SPEC이 만드는 관리자 세션 판정 로직(REQ-ADMIN-001~003)은 `t11`이 그대로 재사용할 수 있게 설계한다" | REQ-ADMIN-021 ~ 033, 037 ~ 040 |
| `SPEC-CATALOG-001` §3 "Out of Scope — 상품 쓰기 API (Write APIs)" | "상품 생성/수정/삭제(관리자용 CUD API)는 이번 SPEC 범위 밖이다 — 이 SPEC은 읽기 전용(list/detail) API만 다룬다. 관리자 상품 관리는 `product.md` 로드맵 후보의 별도 SPEC 대상이다" | REQ-ADMIN-024 ~ 031 |
| `SPEC-CATALOG-002` §3 "Out of Scope — 상품 옵션/변형, 리뷰, 관리자 쓰기 API (SPEC-CATALOG-001에서 이월)" | 같은 제외를 재확인 | 상동 |
| `SPEC-CART-001` plan.md §8 | "`CartItem.productId`에 `onDelete: Cascade`를 걸었다 (…) **향후 관리자 상품 삭제 SPEC이 이 동작을 재검토할 수 있음**을 기록해 둔다" | REQ-ADMIN-020, 031, 033 — 재검토 결과는 "소프트 삭제를 택했으므로 `Cascade`는 발동하지 않는다, FK 방향 무변경"(research.md §1) |

`SPEC-CATALOG-001` §3 "Out of Scope — 카테고리 관리 API"와 `prisma/schema.prisma`의 `Category` 모델 주석("a future admin SPEC can add or rename categories with a data change instead of a schema migration")은 카테고리 CUD의 **가능성**을 열어둔 것이지 이 SPEC에 대한 위임이 아니다 — 이 SPEC은 카테고리를 **읽기만** 한다(§3의 명시적 제외).

`SPEC-DISCOUNT-001` §3 "Out of Scope — 특정 상품·카테고리 한정 쿠폰"이 확인해 주는 대로, 상품별 할인가·세일가 필드는 이 저장소에 개념 자체가 없고 이 SPEC도 만들지 않는다.

### 소비하는 계약 (변경하지 않음)

| 출처 | 형태 | 이 SPEC에서의 쓰임 |
|---|---|---|
| `SPEC-ADMIN-001` `resolveAdminSession(cookieStore)` (`admin-session.ts:50`) | 함수 | 관리자 판정 기준. **재구현하지 않고 그대로 import**(REQ-ADMIN-037) |
| `SPEC-AUTH-001` `verifyCsrfRequest(request)` (`csrf.ts:130`) | 함수 | 쓰기 API의 CSRF 검증. 새 메커니즘 만들지 않음(REQ-ADMIN-039) |
| `SPEC-AUTH-001` `POST /api/auth/login` + `buildCsrfCookie` | API | 관리자 로그인은 기존 `/staff/login` 화면을 그대로 씀. 무변경 |
| `SPEC-ADMIN-001` `DEFAULT_PAGE` / `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` (`types/admin.ts:16~22`) | 상수 | 관리자 상품 목록 페이지네이션에 그대로 import(REQ-ADMIN-023) |
| `SPEC-ADMIN-001` `listOrdersForAdmin()` (`admin-order-repository.ts:67`) | 함수 시그니처 패턴 | 관리자 상품 목록 저장소가 같은 모양(`Promise.all([findMany, count])` + 안정 정렬)을 따름 |
| `SPEC-ADMIN-001` `/staff/*` 페이지 + `/admin/api/*` 쓰기 API 경로 관례 (design.md §1) | 경로 관례 | `/staff/products`, `/admin/api/products`로 확장(REQ-ADMIN-040) |
| `SPEC-CATALOG-001` `Category` 모델 | 모델 | 상품 폼의 `<select>` 옵션 원본. **읽기 전용** |
| `SPEC-ORDER-001` `OrderItem.productName`/`unitPrice`/`lineTotal` 스냅샷 | 컬럼 | 주문 이력이 `Product`를 조인하지 않는다는 사실이, 고객 대면 필터(REQ-ADMIN-034/035)가 주문 이력에 영향을 주지 않는 근거 |

### 확장하는 계약 (EXTEND — 기존 요구사항은 바꾸지 않음)

**이 표는 파일 단위로 센다.** 완료된 SPEC이 소유한 파일 중 이 SPEC이 변경하는 것 **전부(5개 파일)**이며, `plan.md` §3 EXTEND 표와 같은 항목·같은 단위다. REQ-ADMIN-041의 예외 조항과 AC-ADMIN-041의 검증 대상이 모두 이 표 하나를 가리킨다 — 두 곳이 서로 다른 경계를 말하지 않도록 단일 출처로 둔다.

| 파일 | 소유 SPEC | 확장 내용 |
|---|---|---|
| `prisma/schema.prisma` | `SPEC-CATALOG-001` | `Product` 모델에 `isActive Boolean @default(true)` 컬럼 **1개 추가**(REQ-ADMIN-019). 기존 컬럼·인덱스·관계 무변경 |
| `src/features/catalog/repositories/product-repository.ts` | `SPEC-CATALOG-001` / `SPEC-CATALOG-002` | `findProductsPage`의 `where`에 `isActive: true` 조건 **1개 추가**(REQ-ADMIN-034), `findProductById`를 같은 조건을 건 `findFirst`로 치환(REQ-ADMIN-035). **시그니처 무변경**, 정렬·검색·카테고리 필터·페이지네이션 산술·projection 무변경(REQ-ADMIN-036) |
| `src/features/admin/types/admin.ts` | `SPEC-ADMIN-001` | 상품 쪽 DTO·입력 타입 **추가**(design.md §3). 기존 주문 타입과 `DEFAULT_PAGE`/`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` 상수 무변경 |
| `tests/unit/catalog/product-repository.test.ts` | `SPEC-CATALOG-001` / `SPEC-CATALOG-002` | 기댓값 **9건 갱신** + `findFirst` 모킹 추가(design.md §3의 위치별 표). 요구사항 변경이 아니라 기댓값 갱신이며, `SPEC-CATALOG-001/002`의 spec.md·acceptance.md 본문은 건드리지 않는다 |
| `tests/unit/catalog/query-surface.test.ts` | `SPEC-CATALOG-001` | `Product` 픽스처의 명시 타입 주석에 `isActive: boolean`, 리터럴에 `isActive: true`, `Object.keys().sort()` 기대값에 `"isActive"` — **한 줄씩 3곳 추가**(REQ-ADMIN-019 파생). `satisfies Product` 타입 가드를 통과시키기 위한 최소 갱신이다. 검증 의도(생성된 `Product` 타입이 필수 필드를 전부 갖췄는지)는 불변이고 필드 목록만 9개→10개로 늘어난다 |

선례: `SPEC-ADMIN-001`이 `PaymentEventSource`(SPEC-PAYMENT-001 소유 enum)에 값 하나를 순수 추가하되 기존 두 값의 의미·사용처는 바꾸지 않은 것과 **같은 방향**(소유 SPEC의 계약에 최소 추가)의 확장이다. 다만 성격이 완전히 같지는 않다 — enum 값 추가는 기존 소비자에게 영향이 없어 깨뜨린 테스트가 0건이었던 반면, 이번 확장은 기존 함수의 반환 집합을 좁히므로 기댓값 갱신 9건을 동반한다. 활성 상품에 대한 기존 동작은 문자 그대로 그대로이고 **비활성이라는 새 상태의 취급만** 정의한다는 점은 같다. 이 확장이 왜 불가피한지(서비스 레이어 사후 필터는 `totalCount`를 어긋나게 한다)와 그 비용(`tests/unit/catalog/product-repository.test.ts`의 기댓값 **9건** 갱신)은 research.md §5.2에 기록했다.

---

## §2. 요구사항 (GEARS, REQ-ADMIN-019 ~ 041)

Tier L — 요구사항 상한 25개 이내(현재 23개). `SPEC-ADMIN-001`의 REQ-ADMIN-001~018 다음 번호부터 이어간다.

### 스키마 (REQ-ADMIN-019 ~ 020)

- **REQ-ADMIN-019** (Ubiquitous): `Product` 모델은 판매 가능 여부를 나타내는 불리언 컬럼을 가져야 하며, 그 기본값은 판매 가능(`true`)이어서 마이그레이션 시점의 모든 기존 상품이 판매 가능 상태를 유지해야 한다.
- **REQ-ADMIN-020** (Unwanted, shall not): 이 SPEC은 `Product` 행을 물리적으로 삭제하는 경로(화면·API·저장소 함수)를 만들어서는 안 되며, `CartItem.product` / `OrderItem.product`의 `onDelete` 방향을 변경해서도 안 된다.

### 관리자 상품 목록 (REQ-ADMIN-021 ~ 023)

- **REQ-ADMIN-021** (When): 유효한 관리자 세션으로 관리자 상품 목록에 진입하면, 백오피스는 **판매 중단된 상품을 포함한** 전체 상품을 페이지 단위로(상품마다 이름·가격·재고·카테고리·판매 가능 여부를) 표시해야 한다.
- **REQ-ADMIN-022** (When): 카테고리 또는 검색어 값이 요청에 포함되어 있으면, 관리자 상품 목록은 그 조건에 일치하는 상품만 반환해야 한다.
- **REQ-ADMIN-023** (Ubiquitous): 관리자 상품 목록의 페이지네이션은 `SPEC-ADMIN-001`이 이미 쓰는 `page`/`pageSize` 상수와 클램프 규칙을 그대로 따라야 하며, 새로운 페이지네이션 방식을 도입해서는 안 된다.

### 상품 등록·수정 (REQ-ADMIN-024 ~ 030)

- **REQ-ADMIN-024** (When): 관리자가 유효한 신규 상품 입력을 제출하면, 백오피스는 이름·설명·가격·재고·카테고리·이미지 URL 목록을 가진 새 상품을 판매 가능 상태로 생성해야 한다.
- **REQ-ADMIN-025** (When): 관리자가 기존 상품에 대해 유효한 수정 입력을 제출하면, 백오피스는 그 상품의 이름·설명·가격·재고·카테고리·이미지 URL 목록을 제출된 값으로 갱신해야 한다.
- **REQ-ADMIN-026** (Ubiquitous): 상품 입력 검증은 가격을 1 이상의 정수(원 단위, 소수점 없음)로, 재고를 0 이상의 정수로, 이름과 설명을 공백이 아닌 문자열로 요구해야 한다.
- **REQ-ADMIN-027** (Ubiquitous): 이미지 입력은 URL 문자열의 목록이어야 하며, 빈 목록은 허용하되(사진 없이 등록되는 신규 상품) 목록에 포함된 각 항목은 구문상 유효한 절대 URL이어야 한다.
- **REQ-ADMIN-028** (Unwanted, shall not): 이 SPEC은 파일 업로드 처리 경로나 외부 스토리지 연동을 만들어서는 안 되며, 이미지는 관리자가 붙여 넣은 URL 문자열로만 입력받아야 한다.
- **REQ-ADMIN-029** (Ubiquitous): 상품의 카테고리는 이미 존재하는 `Category` 행 중에서만 선택될 수 있어야 하며, 존재하지 않는 카테고리를 지정한 제출은 거부되어야 한다.
- **REQ-ADMIN-030** (When — 이벤트 탐지형): 제출된 상품 입력이 REQ-ADMIN-026·027·029 중 어느 검증이라도 통과하지 못하면, 백오피스는 어떤 상품 행도 생성하거나 갱신하지 않고 요청을 거부해야 하며, 관리자가 어느 입력을 고쳐야 하는지 식별할 수 있는 응답을 돌려주어야 한다.

### 판매 중단(소프트 삭제)과 복구 (REQ-ADMIN-031 ~ 033)

- **REQ-ADMIN-031** (When): 관리자가 상품의 판매 중단을 요청하면, 백오피스는 그 상품의 판매 가능 여부만 `false`로 전환해야 하며, 상품 행을 삭제하거나 이름·가격·재고·이미지·카테고리 중 어느 값도 함께 변경해서는 안 된다.
- **REQ-ADMIN-032** (When): 관리자가 판매 중단된 상품의 복구를 요청하면, 백오피스는 그 상품의 판매 가능 여부만 `true`로 되돌려야 한다.
- **REQ-ADMIN-033** (Unwanted, shall not): 판매 중단 전환은 그 상품을 참조하는 `CartItem` 또는 `OrderItem` 행을 삭제하거나 변경해서는 안 된다.

### 고객 대면 카탈로그 확장 (REQ-ADMIN-034 ~ 036)

- **REQ-ADMIN-034** (Ubiquitous): 고객 대면 상품 목록 조회는 판매 가능한 상품만 반환해야 하며, 그 응답이 보고하는 전체 개수도 같은 조건으로 계산되어야 한다(목록 행과 개수가 서로 다른 모집단을 세는 일이 없어야 한다).
- **REQ-ADMIN-035** (Ubiquitous): 고객 대면 상품 상세 조회는 판매 중단된 상품을 "찾을 수 없음"으로 취급해야 하며, 판매 중단된 상품의 상세 표현을 고객에게 돌려주어서는 안 된다.
- **REQ-ADMIN-036** (Unwanted, shall not): REQ-ADMIN-034·035의 확장은 기존 카탈로그 조회 함수의 시그니처, 정렬 순서, 검색 조건, 카테고리 필터, 페이지네이션 산술, 응답 필드 구성 중 어느 것도 변경해서는 안 되며, 판매 가능 여부를 고객 대면 응답에 노출해서도 안 된다.

### 경계와 보안 (REQ-ADMIN-037 ~ 041)

- **REQ-ADMIN-037** (Ubiquitous): 관리자 상품 화면과 관리자 상품 API는 `SPEC-ADMIN-001`이 만든 관리자 세션 판정 함수를 그대로 재사용해야 하며, 별도의 관리자 판정 로직을 새로 만들어서는 안 된다. 또한 관리자 판정 실패는 그 사유(세션 쿠키 없음·만료·폐기·`role`이 관리자가 아님)를 요청자가 응답으로 구별할 수 없는 형태여야 한다.
- **REQ-ADMIN-038** (Unwanted, shall not): 관리자 상품 쓰기 API는 페이지 진입 시점에 판정된 관리자 여부를 재사용해서는 안 되며, 생성·수정·판매 중단·복구를 포함한 모든 쓰기 요청마다 관리자 세션을 다시 판정해야 한다.
- **REQ-ADMIN-039** (Ubiquitous): 관리자 상품 쓰기 API는 `SPEC-ADMIN-001`의 상태 변경 API와 동일한 CSRF 검증을 어떤 데이터베이스 접근보다도 먼저 수행해야 하며, CSRF 검증 실패 응답은 REQ-ADMIN-037의 관리자 판정 실패 응답과 상태 코드·본문 모양에서 구별되지 않아야 한다.
- **REQ-ADMIN-040** (Ubiquitous): 관리자 상품 화면은 기존 RBAC 미들웨어 매처와 겹치지 않는 `/staff` 하위 경로에, 관리자 상품 쓰기 API는 `/admin/api` 하위 경로에 두어 `SPEC-ADMIN-001`이 확립한 경로 관례를 따라야 한다.
- **REQ-ADMIN-041** (Unwanted, shall not): 이 SPEC은 `src/middleware.ts`, `SPEC-AUTH-001`의 토큰 발급·회전·로그아웃 로직, `SPEC-ADMIN-001`의 주문 관련 파일, `SPEC-CATALOG-001`·`SPEC-CATALOG-002`·`SPEC-PAYMENT-001`·`SPEC-DISCOUNT-001`·`SPEC-ORDER-001`·`SPEC-CART-001`이 소유한 구현 파일과 테스트 파일을 변경해서는 안 된다 — 유일한 예외는 §1 "확장하는 계약" 표에 열거한 **5개 파일**이다.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다.

### Out of Scope — 이미지 파일 업로드 및 스토리지 연동

- 파일 선택·멀티파트 업로드·이미지 리사이즈·CDN/오브젝트 스토리지 연동은 범위 밖이다. 관리자는 이미 어딘가에 올려둔 이미지의 URL을 붙여 넣는다(REQ-ADMIN-027/028).
- 근거: 저장소 어디에도 업로드 파이프라인이 없으며(research.md §1), `Product.images`는 처음부터 URL 문자열 배열로 설계되어 있다. 업로드는 스토리지 선택·비용·보안(용량 제한, 파일 형식 검증)을 함께 결정해야 하는 별도 크기의 작업이다.

### Out of Scope — 카테고리 생성·수정·삭제 화면

- 카테고리를 추가·이름 변경·삭제하는 관리자 화면과 API는 범위 밖이다. 이 SPEC의 상품 폼은 **이미 존재하는** `Category` 행을 나열해 고르게만 한다(REQ-ADMIN-029).
- 근거: `SPEC-CATALOG-001` §3 "Out of Scope — 카테고리 관리 API"가 이 제외를 이미 확정했고, 그 문장은 "후속 관리자 SPEC은 별도 범위"라고 적을 뿐 이 카드에 위임하지 않는다. 카테고리 값은 계속 seed 스크립트나 수동 DB 삽입으로 확보한다.

### Out of Scope — 상품별 할인가·세일가

- 상품 단위의 할인 가격·정가 대비 표시·기간 한정 세일 필드는 범위 밖이다.
- 근거: `SPEC-DISCOUNT-001`이 할인을 주문/코드 레벨(`Coupon`, `Order.couponCode`)로만 모델링했고 §3에서 "특정 상품·카테고리 한정 쿠폰"을 명시적으로 제외했다. `Product`에는 `price` 하나뿐이며(research.md §1) 이 SPEC은 컬럼을 늘리지 않는다.

### Out of Scope — 재고 조정 이력과 낙관적 잠금

- 재고 변경 내역을 남기는 감사 로그, 별도의 "재고 조정" 액션, 버전 컬럼 기반 낙관적 잠금은 범위 밖이다. 재고는 상품 폼의 평범한 필드다(REQ-ADMIN-025/026).
- 근거: `SPEC-ADMIN-001`의 `cancelOrderAsAdmin()`도 잠금 없이 `increment`로 재고를 복원하며 그 SPEC은 이를 수용된 위험으로 남겼다. 이 SPEC만 잠금을 도입하면 두 쓰기 경로의 동시성 모델이 갈라져 오히려 더 나쁘다. 이로 인한 경합은 §4에 잔여 위험으로 명시한다.

### Out of Scope — 장바구니에 이미 담긴 판매 중단 상품의 체크아웃 차단

- 판매 중단 **이전에** 이미 장바구니에 담겨 있던 상품이 그대로 결제까지 진행되는 것을 막는 검증은 범위 밖이다.
- 조사 결과(research.md §5.3): 담기 경로(`cart-service.ts:194~213`)와 체크아웃 트랜잭션(`order-service.ts:474~510`) 어느 쪽도 상품의 판매 가능 여부를 묻지 않는다 — 검증하는 것은 재고 숫자뿐이고, 소프트 삭제는 재고를 건드리지 않으므로(REQ-ADMIN-031) 재고가 남은 판매 중단 상품은 결제까지 통과한다. **기존 검증이 이 경우를 우연히 막아주지 못하는, 진짜 새 공백이다.**
- 이 SPEC이 떠안지 않는 이유: 고치려면 `cart-repository.ts`(SPEC-CART-001 소유)의 projection과 `cart-service.ts`의 검증, 그리고 `SPEC-ORDER-002`의 `REQ-ORDER-045`가 보존 대상으로 지목한 주문 생성 트랜잭션을 함께 손대야 한다 — 두 개의 완료된 도메인 SPEC으로 범위가 번진다. 이는 백로그 `t21`(미결제 주문의 재고 점유 해제)·`t22`(미결제 이탈 주문의 쿠폰 해제)·`t25`(연락처 표기 정규화)와 정확히 같은 모양의 크로스-SPEC 공백이다.
- 노출 창의 크기: REQ-ADMIN-034/035가 닫는 것은 **발견 경로**(목록·상세)이지 **담기 경로**가 아니다. 남는 경로는 둘이다.
  - **(a) 판매 중단 이전에 이미 담아둔 카트** — 그 방문자가 `/cart`에서 그대로 결제로 진행하는 경우. `/cart` 렌더는 `findCartByGuestId`의 `include`로 상품을 읽으므로 상세 필터의 영향을 받지 않는다.
  - **(b) 판매 중단 이후의 신규 담기** — `POST /api/cart/items`는 `REQ-CART-014`에 따라 **자격 증명을 요구하지 않는 공개 엔드포인트**이고, `findProductForCart`가 `{ id, price, stock }` 세 컬럼만 읽으므로 판매 가능 여부를 아예 묻지 않는다(research.md §5.3). 따라서 `productId`를 아는 요청자 — 판매 중단 시점에 이미 열려 있던 상세 화면의 `AddToCartButton`(`SPEC-STOREFRONT-002` 소유 클라이언트 컴포넌트가 렌더된 트리에 `productId`를 들고 있다), 또는 식별자를 아는 직접 호출 — 은 **중단 이후에도** 담기에 성공한다.
- 즉 이 공백은 "중단 시점에 이미 카트에 있던 항목"으로 시간이 제한되지 않는다. 좁아지는 것은 발견 난이도뿐이며, 창 자체는 열려 있다.
- 넘긴 곳: **신규 백로그 카드 후보** — "판매 중단(`isActive=false`) 상품이 장바구니를 통해 결제까지 통과하는 공백 — (a) 중단 이전에 담긴 카트와 (b) 공개 엔드포인트 `POST /api/cart/items`(REQ-CART-014)를 통한 중단 이후 신규 담기 두 경로. SPEC-CART-001·SPEC-ORDER-001/002 사이에서 인수되지 않았고, 담기 UI 표면은 SPEC-STOREFRONT-002 소유. SPEC-ADMIN-002 plan-phase에서 분리". sync-phase에서 `moai todo add`로 등재하며, 카드 문구에 두 경로와 `SPEC-STOREFRONT-002` 소유 표면을 모두 담는다.

### Out of Scope — 상품 옵션·변형(variant)

- 색상·사이즈 같은 옵션별 재고·가격 관리는 범위 밖이다.
- 근거: `SPEC-CATALOG-001`/`SPEC-CATALOG-002`/`SPEC-STOREFRONT-001` 모두 옵션·변형을 명시적으로 범위 밖에 두었고, `Product` 스키마에 옵션 개념이 없다. 이 SPEC은 그 결정을 뒤집지 않는다.

### Out of Scope — 일괄(bulk) 등록·수정·CSV 가져오기

- 여러 상품을 한 번에 등록·수정하거나 CSV/스프레드시트로 가져오는 기능은 범위 밖이다. 이 SPEC은 상품 하나씩의 등록·수정만 다룬다.

### Out of Scope — 공유 관리자 레이아웃·내비게이션 컴포넌트

- `/staff/*` 전체에 걸친 공통 헤더·사이드바·테이블 컴포넌트 추출은 범위 밖이다.
- 근거: `SPEC-ADMIN-001`이 만든 `/staff/*` 페이지 3장은 각자 자기 안에 마크업을 들고 있는 자기 완결형이며(research.md §3), 공유 레이아웃은 화면이 더 늘어난 뒤에 실제 중복을 보고 뽑는 편이 낫다. 이 SPEC의 판단 근거는 design.md §5에 기록한다.

### Out of Scope — 관리자 계정 프로비저닝

- `role: admin` 사용자를 만드는 화면·API·가입 플로우는 범위 밖이다.
- 근거: `SPEC-ADMIN-001` §3이 이미 확정한 제외다. `POST /api/auth/signup`은 항상 `customer`로 생성하며, 관리자 계정은 seed나 수동 DB 갱신으로 확보하는 운영 절차로 남는다.

### Out of Scope — 고객 대면 상품 목록 화면

- 고객이 상품을 둘러보는 목록·검색 화면은 범위 밖이다. 이 SPEC은 고객 대면 **조회 조건**만 확장할 뿐(REQ-ADMIN-034), 화면을 만들지 않는다.
- 근거: `SPEC-STOREFRONT-001` §3 "Out of Scope — 상품 목록 / 검색 화면"이 이 제외를 이미 확정했고, 현재 `src/app/products/`에는 상세 페이지만 있다(research.md §5.1).

### Out of Scope — 판매 중단 상품의 고객 대면 안내 문구

- 판매 중단된 상품의 상세 링크로 접근했을 때 "판매가 종료된 상품입니다" 같은 전용 안내 화면을 보여주는 것은 범위 밖이다 — REQ-ADMIN-035에 따라 기존 "찾을 수 없음" 처리를 그대로 재사용한다.

---

## §4. 위험과 잔여 위험

| 위험 | 성격 | 대응 |
|---|---|---|
| **관리자 재고 편집과 주문 취소 재고 복원의 경합** — 편집 폼이 열려 있는 동안 같은 상품이 든 주문이 취소되면(`cancelOrderAsAdmin()`의 `stock: { increment }`), 폼 저장이 그 복원분을 덮어쓴다 | **잔여 위험(수용)**. `increment`(상대 연산)와 폼 저장(절대 설정)의 의미 차이에서 나온다. 새로 만드는 결함이 아니라 `SPEC-ADMIN-001`이 이미 수용한 것과 같은 종류의 위험이며(research.md §6), 이 SPEC만 잠금을 도입하면 두 쓰기 경로의 동시성 모델이 갈라진다 | 해결하지 않는다. 편집 폼의 재고 필드에 "저장 시 이 값으로 덮어씁니다"를 표시해 관리자가 상대/절대 차이를 인지하게 하는 것이 유일한 완화다(§3 "재고 조정 이력과 낙관적 잠금" 제외와 짝을 이룸) |
| **장바구니에 담긴 판매 중단 상품의 결제 통과** | **범위 밖 + 잔여 위험**. §3의 해당 절과 research.md §5.3 | 신규 백로그 카드로 등재. REQ-ADMIN-034/035가 닫는 것은 목록·상세라는 **발견 경로**뿐이며, 공개 엔드포인트 `POST /api/cart/items`(REQ-CART-014)를 통한 담기 경로는 중단 이후에도 열려 있다 — 노출 창은 시간 제한적이지 않다(§3의 (a)·(b) 두 경로). 카드 문구가 두 경로와 `SPEC-STOREFRONT-002` 소유 UI 표면을 모두 담아야 한다 |
| **고객 대면 조회 확장이 기존 카탈로그 테스트 기댓값을 깨뜨림** — `tests/unit/catalog/product-repository.test.ts`가 `findProductsPage`의 `where`를 `toEqual`(정확 일치)로 비교하는 테스트가 **6건**, `findProductById` 테스트가 `findUnique` 모킹에 묶여 있는 것이 **3건**(총 **9건**) | **알려진 비용**. 요구사항 변경이 아니라 기댓값 갱신이다(research.md §5.2, design.md §3의 위치별 표) | run-phase에서 9건을 갱신하고 각 갱신에 이 SPEC의 REQ 번호를 주석으로 남긴다. `SPEC-CATALOG-001/002`의 spec.md·acceptance.md 본문은 건드리지 않는다 |
| **관리자 상품 저장소가 카탈로그 저장소와 갈라질 위험(WET)** — 관리자 목록이 `product-repository.ts`를 재사용하지 않고 자기 쿼리를 둔다 | **의도적 선택**. `SPEC-ADMIN-001`의 자기 완결 원칙(research.md §4)을 그대로 따른다 — 관리자는 비활성 상품을 봐야 하므로 고객 쪽 필터를 옵션으로 뚫는 것보다 별도 쿼리가 안전하다 | design.md §2에 트레이드오프를 기록하고 `@MX:NOTE`로 추적 |
| **`isActive` 컬럼에 인덱스가 없어 목록 조회 계획이 바뀔 위험** — `Product`에는 `categoryId`/`createdAt`/`price`/`name` GIN 인덱스만 있고, `REQ-CATALOG-016`이 p95 300ms 예산을 건다 | **낮음, 관측 대상** | 카디널리티가 2인 컬럼의 단독 인덱스는 대개 도움이 되지 않는다. design.md §4에서 인덱스를 추가하지 않는 판단과 재검토 조건을 기록한다 |
