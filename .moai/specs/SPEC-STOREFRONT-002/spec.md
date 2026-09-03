---
id: SPEC-STOREFRONT-002
title: "장바구니 화면·상품 담기 UI 및 체크아웃 화면 스타일 정리"
version: "0.1.0"
status: completed
created: 2026-09-03
updated: 2026-09-03
author: snake
priority: P1
phase: "v0.2.0 target"
module: "src/app/cart"
lifecycle: spec-anchored
tags: "cart, storefront, ui, checkout, add-to-cart, nextjs, tailwind"
tier: M
depends_on: [SPEC-CART-001, SPEC-STOREFRONT-001, SPEC-ORDER-001, SPEC-PAYMENT-001, SPEC-DISCOUNT-001]
related_specs: [SPEC-CATALOG-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-03 | 0.1.0 | draft | plan-phase 최초 작성. 백로그 카드 `t10`("장바구니·체크아웃 화면 UI")을 다룬다. **착수 전 조사로 카드 설명의 전제 하나가 틀렸음을 확인했다** — `/checkout` 화면은 이미 완전히 동작한다(배송지 폼·주문 요약·쿠폰 입력·결제 버튼 전부 SPEC-ORDER-001/SPEC-PAYMENT-001/SPEC-DISCOUNT-001에 걸쳐 이미 구현됨). SPEC-DISCOUNT-001의 plan.md §0 확정 #1이 이미 "체크아웃 화면의 스타일링은 `t10`이 가져간다"고 명시적으로 경계를 그어 두었다. 그 결과 이 SPEC의 실제 범위는 사용자가 서술한 것보다 좁다 — 체크아웃은 **재구현이 아니라 스타일 정리**만 하고, 진짜 신규 구축 대상은 (1) 지금까지 존재한 적 없는 `/cart` 화면과 (2) 상품 상세의 "장바구니 담기" 버튼(SPEC-STOREFRONT-001·SPEC-ORDER-001 양쪽이 이미 이 SPEC으로 명시적으로 떠넘겨 둔 항목)이다. 조사 근거와 범위 축소 사유는 아래 §1에 전문을 남긴다. |

---

## §1. 개요

`our-shop`의 **장바구니 화면**(`/cart`)과 **상품 상세의 담기 버튼**을 새로 만들고, 이미 완성되어 있는 **체크아웃 화면의 스타일**을 정리한다.

### 이 SPEC이 잇는 도메인 — STOREFRONT (UI), 왜 CART나 새 도메인이 아닌가

이 저장소는 이미 "백엔드 도메인 = 소문자 기능명, UI 도메인 = STOREFRONT" 분리 선례를 갖고 있다 — SPEC-CATALOG-001/002(상품 백엔드)와 SPEC-STOREFRONT-001(상품 상세 화면 UI, 루트 레이아웃·Tailwind·App Router 컨벤션을 함께 확정)의 관계가 그것이다. 이 SPEC은 정확히 같은 모양의 분리를 장바구니에 적용한다 — SPEC-CART-001(장바구니 백엔드: 데이터 모델·쿠키 신원·병합 로직)과 이 SPEC(장바구니 화면 UI)의 관계다.

세 후보를 검토했다.

| 후보 ID | 기각/채택 사유 |
|---|---|
| `SPEC-CART-002` | 기각. `SPEC-CART-001`의 `module`은 `src/features/cart`이며 그 SPEC은 스스로를 "백엔드 도메인(데이터 모델·리포지토리·서비스)"로 규정했다. 이 SPEC은 `src/features/cart/**`를 단 한 줄도 수정하지 않는다 — 기존 API를 소비만 한다. `CART-002`로 명명하면 장바구니 **백엔드**가 이어서 확장되는 것처럼 읽히지만 실제로는 그 반대(백엔드 무변경 + UI 신설)다. |
| `SPEC-CHECKOUT-001` (신규 도메인) | 기각. "체크아웃"이라는 이름의 새 도메인을 열면 체크아웃 **기능**이 이 SPEC에서 처음 만들어지는 것처럼 읽힌다. 그러나 체크아웃 로직(폼·트랜잭션·쿠폰·결제 트리거)은 이미 SPEC-ORDER-001(`module: src/features/orders`)·SPEC-PAYMENT-001(`module: src/features/payments`)·SPEC-DISCOUNT-001(`module: src/features/discounts`) 세 SPEC에 걸쳐 완성되어 있다(§1 하단 증거). 이 SPEC이 체크아웃 화면에서 하는 일은 스타일 정리뿐이므로, 새 도메인을 여는 것은 소유권을 왜곡한다. |
| `SPEC-STOREFRONT-002` **(채택)** | SPEC-STOREFRONT-001이 이미 "고객 대면 화면 UI" 도메인으로 확립되어 있다 — 루트 문서 셸, Tailwind v4 확정, App Router 서버 컴포넌트 컨벤션, `src/components/<domain>/` 배치 원칙을 그 SPEC이 세웠다. 이 SPEC은 그 컨벤션을 그대로 이어받아 화면을 하나 더 추가할 뿐이며, 스키마·백엔드 변경이 전혀 없다는 점에서 정확히 STOREFRONT-001과 같은 성격이다. |

### 착수 전 조사 — 카드 `t10`의 전제와 실제 저장소 상태의 차이

카드 `t10`의 설명("장바구니·체크아웃 화면 UI")과 사용자가 제시한 범위 가이드는 체크아웃 화면이 아직 없다고 전제하고 있었다. 저장소를 직접 확인한 결과는 다르다.

| 확인 항목 | 명령/방법 | 결과 |
|---|---|---|
| `/cart` 라우트 | `find src/app -type f` | **부재** — `src/app` 아래 `cart` 디렉터리 없음 |
| 상품 상세의 담기 버튼 | `grep -n "cart\|장바구니" src/app/products/[productId]/page.tsx src/components/product/*.tsx` | **매치 0건** — 버튼 없음 |
| `/checkout` 라우트 | `cat src/app/checkout/page.tsx` | **이미 존재.** `CheckoutInteractive`(쿠폰) + `CheckoutForm`(배송지) + `OrderSummary`(요약)를 조립하는 완성된 서버 컴포넌트 |
| 체크아웃 하위 컴포넌트 | `find src/components/checkout -type f` | `CheckoutForm.tsx`, `CheckoutInteractive.tsx`, `CheckoutUnavailable.tsx`, `OrderSummary.tsx`, `PayButton.tsx` **5개 전부 존재하고 동작함** |
| 결제 트리거 | `cat src/components/checkout/PayButton.tsx` | Toss 결제창을 호출하는 완성된 클라이언트 컴포넌트(SPEC-PAYMENT-001 M4) |
| 체크아웃 UI 소유권에 대한 선행 결정 | `cat .moai/specs/SPEC-DISCOUNT-001/spec.md` (§4 요구사항) + plan.md §0 확정 #1 | REQ-DISCOUNT-023/024 주석에 명시: "최소 UI만(plan.md §0 확정 #1) ... 스타일링/레이아웃 정리 없음 — 카드 `t10`이 나중에 가져간다" |

즉 사용자가 서술한 "체크아웃 화면: 배송지 폼·쿠폰 입력·주문 요약·주문 생성 및 결제로의 핸드오프 액션"은 **이미 전부 구현되어 동작 중**이다. 이 SPEC이 체크아웃에서 할 일은 그 기능을 다시 만드는 것이 아니라, SPEC-DISCOUNT-001이 이미 이 카드로 넘겨 둔 **시각적 정리**뿐이다(§2 REQ-STOREFRONT-028/029).

### 회원 신원 — 이 화면들도 게스트 전용이다 (구조적 제약, 재확인)

SPEC-ORDER-001은 서버 렌더 체크아웃 화면이 회원을 식별할 수 없다는 구조적 결함을 발견하고 회원 체크아웃을 범위에서 제외했다(그 SPEC spec.md §3 첫 항목 — 액세스 토큰이 클라이언트 메모리에만 있고, 로그인 시 게스트 쿠키가 만료됨). 이 SPEC을 시작하기 전, 그 결함이 새로 만드는 화면(`/cart`, 담기 버튼)에도 적용되는지 직접 확인했다.

- `grep -rn "accessToken\|AuthProvider\|useAuth\b" src` — 매치는 라우트 핸들러(`login`/`refresh`/`google/callback`)와 `src/lib/auth/session.ts`/`google-oauth.ts`뿐이다. **클라이언트 측에 액세스 토큰을 보관하는 컨텍스트·스토어·훅이 저장소 어디에도 없다.**
- `grep -rn "localStorage\|sessionStorage\|AuthContext" src` — 매치는 `src/middleware.ts`의 주석(토큰을 저장하지 **않는다**는 설명) 하나뿐이다.

결론: SPEC-AUTH-001이 "액세스 토큰은 클라이언트 메모리에" 두기로 설계했지만, **그 메모리 저장소 자체(React context/스토어)를 실제로 구현한 SPEC이 아직 없다.** 따라서 회원으로 로그인한 방문자라도 현재 프런트엔드에는 `Authorization` 헤더를 실어 보낼 수단이 전혀 없다 — 서버 컴포넌트뿐 아니라 클라이언트 컴포넌트도 마찬가지다. 이 SPEC이 만드는 `/cart`와 담기 버튼은 이 결함을 새로 만들지 않고, ORDER-001과 동일한 경계를 상속한다: **게스트 신원(쿠키)만 다룬다**(§3 Out of Scope).

### 소비하는 계약 (변경하지 않음)

| 출처 | 형태 | 이 SPEC에서의 쓰임 |
|---|---|---|
| SPEC-CART-001 `CartDTO`/`CartItemDTO` | `{ items, subtotal, itemCount }`, 항목마다 `id`·`productId`·`name`·`price`(현재가)·`image`·`stock`·`quantity`·`lineTotal` | 장바구니 화면의 표시 데이터. 4개 엔드포인트(`GET`/`POST /items`/`PATCH /items/:id`/`DELETE /items/:id`) 전부가 이 동일한 전체 카트 형태를 반환한다(CART-001 plan.md §3) — 그래서 매 변경 후 별도 재조회 없이 응답으로 상태를 갱신할 수 있다(plan.md §B) |
| SPEC-CART-001 `resolveCartIdentity` / `getCart` | 게스트 쿠키 해석 | `/cart` 서버 컴포넌트가 SPEC-STOREFRONT-001 plan.md §B(서버 컴포넌트가 서비스 계층을 직접 호출) 선례를 그대로 따른다 |
| SPEC-STOREFRONT-001 UI 컨벤션 | Tailwind CSS v4, App Router 서버 컴포넌트 + 얇은 클라이언트 경계, `src/components/<domain>/` 배치 | 이 SPEC의 모든 신규 화면·컴포넌트가 따르는 스타일·구조 규범 |
| SPEC-ORDER-001 `/checkout` 화면 및 하위 컴포넌트 | `CheckoutForm`/`OrderSummary`/`CheckoutInteractive`/`CheckoutUnavailable`/`PayButton` | **유일한 EXTEND 대상.** 클래스 표기(Tailwind 유틸리티)만 바꾼다 — 로직·상태·마크업 구조는 §2 REQ-STOREFRONT-029가 금지한다 |
| SPEC-DISCOUNT-001 plan.md §0 확정 #1 | "체크아웃 최소 UI는 DISCOUNT-001이, 스타일링은 t10이" | 이 SPEC이 그 스타일링 부분을 이행하는 근거 문서 |

---

## §2. 요구사항 (GEARS, REQ-STOREFRONT-016 ~ 030)

Tier M — 요구사항 상한 16개 이내(현재 15개). `STOREFRONT` 도메인 번호를 SPEC-STOREFRONT-001(REQ-STOREFRONT-001~015)에서 이어받는다.

### 장바구니 화면 — 진입과 표시

- **REQ-STOREFRONT-016** (When): 방문자가 `/cart` 주소를 요청하면, 스토어프론트는 해석된 게스트 신원의 현재 장바구니 내용(각 항목의 상품명·이미지·단가·수량·품목 합계, 그리고 전체 소계)이 이미 채워진 화면을 서버에서 렌더링해 응답해야 하며, 최초 화면을 그리기 위한 브라우저 측 추가 데이터 요청이 발생해서는 안 된다.
- **REQ-STOREFRONT-017** (When — 이벤트 탐지형): 장바구니가 비어 있거나(게스트 쿠키는 있으나 항목이 0개) 게스트 쿠키 자체가 없으면, `/cart`는 수량 조작 UI 대신 안내 화면을 표시해야 하며, 상품 목록으로 이동할 수 있는 링크를 함께 제시해야 한다.
- **REQ-STOREFRONT-018** (Ubiquitous): 장바구니 화면의 각 항목은 상품 이미지(없으면 대체 표시), 상품명, 단가, 수량, 품목 합계(단가 × 수량)를 표시해야 하며, 화면 하단에는 전체 소계를 표시해야 한다.

### 장바구니 화면 — 수량 변경과 삭제

- **REQ-STOREFRONT-019** (When): 사용자가 장바구니 화면에서 어떤 항목의 수량을 변경하면, 화면은 그 값을 절대값으로 `PATCH /api/cart/items/:itemId`에 제출해야 하며, 응답으로 돌아온 전체 카트 형태로 화면 전체(각 품목 합계와 소계 포함)를 갱신해야 하고, 전체 페이지를 다시 불러오지 않아야 한다.
- **REQ-STOREFRONT-020** (When — 이벤트 탐지형): 수량 변경 또는 담기 요청이 카트 API로부터 거부(400)되면, 장바구니 화면(또는 담기 버튼)은 거부 사유를 그 자리에서 알려야 하며, 거부된 변경을 화면에 반영해서는 안 되고, 다른 항목이나 이미 반영된 상태를 잃어서는 안 된다.
- **REQ-STOREFRONT-021** (When): 사용자가 장바구니 화면에서 항목 삭제를 실행하면, 화면은 `DELETE /api/cart/items/:itemId`를 호출하고 응답으로 돌아온 전체 카트 형태로 화면을 갱신해야 하며, 삭제된 항목만 사라지고 다른 항목은 그대로 남아야 한다.

### 장바구니 화면 — 체크아웃 진입

- **REQ-STOREFRONT-022** (While): 장바구니에 하나 이상의 항목이 있는 동안, 장바구니 화면은 `/checkout`으로 이동하는 명확한 진입 동작(버튼 또는 링크)을 제시해야 한다.
- **REQ-STOREFRONT-023** (Unwanted, shall not): 장바구니 화면은 배송 정보·결제 수단을 입력받거나 주문을 생성해서는 안 된다 — 그 책임은 `/checkout`(SPEC-ORDER-001)에 있다.

### 상품 상세 — 장바구니 담기

- **REQ-STOREFRONT-024** (Ubiquitous): 상품 상세 화면은 담기 수량을 선택할 수 있는 입력(기본값 1, 하한 1)과 담기를 실행하는 버튼을 제공해야 한다.
- **REQ-STOREFRONT-025** (When): 유효한 담기 요청이 성공하면(`POST /api/cart/items`), 담기 컨트롤은 성공을 알리는 확인 문구와 장바구니 화면(`/cart`)으로 이동할 수 있는 링크를 표시해야 하며, 상품 상세 화면을 떠나지 않아야 한다.
- **REQ-STOREFRONT-026** (When — 이벤트 탐지형): 담기 요청이 카트 API로부터 거부되면(재고 초과 등, 400), 담기 컨트롤은 상품 상세 화면을 벗어나지 않고 거부 사유를 표시해야 한다.
- **REQ-STOREFRONT-027** (While): 상품의 현재 재고가 0인 동안, 담기 버튼은 비활성 상태여야 하며 담기 요청을 제출해서는 안 된다.

### 체크아웃 화면 — 스타일 정리 (재구현 아님)

- **REQ-STOREFRONT-028** (Ubiquitous): 체크아웃 화면(`/checkout` 및 그 하위 컴포넌트 5개)의 시각적 여백·타이포그래피·색상 사용은 이 SPEC과 SPEC-STOREFRONT-001이 확립한 Tailwind 컨벤션과 일관되도록 정리되어야 하며, 정리 이전에 존재하던 기능적 동작(폼 제출, 쿠폰 적용, 결제 시작, 오류 표시)은 그대로 보존되어야 한다.
- **REQ-STOREFRONT-029** (Unwanted, shall not): 이 SPEC은 `/api/orders`·`/api/discounts/validate`·`/api/payments/confirm`의 요청/응답 계약이나 검증 규칙, 또는 체크아웃 하위 컴포넌트의 상태 관리 로직(리액트 훅 사용·이벤트 핸들러·조건 분기)을 변경해서는 안 된다 — 체크아웃 화면 소유 파일에 허용되는 변경은 마크업 구조와 Tailwind 클래스 표기뿐이다.

### 접근성 (NFR)

- **REQ-STOREFRONT-030** (Ubiquitous): 장바구니의 수량 변경·삭제 컨트롤과 상품 상세의 담기 컨트롤은 키보드만으로 조작 가능해야 하고 보조 기술이 그 목적을 식별할 수 있는 라벨을 가져야 하며, 장바구니 화면에 표시되는 모든 상품 이미지는 상품명을 포함한 대체 텍스트를 가져야 한다.

---

## §3. Out of Scope

### Out of Scope — 회원 장바구니·체크아웃 (구조적 제약, ORDER-001과 동일 근거)

- 로그인한 회원을 위한 `/cart`·담기 버튼·`/checkout`은 이번 범위 밖이다. 근거는 §1에서 확인한 대로 클라이언트 측에 액세스 토큰을 보관하는 저장소가 저장소 전체에 아직 존재하지 않는다는 사실이다 — 이 SPEC이 그 저장소(React context 등)를 새로 만드는 것은 SPEC-AUTH-001의 인증 전송 설계를 재여는 별도 작업이며 이 SPEC의 몫이 아니다.

### Out of Scope — 체크아웃 기능 재구현

- 배송지 폼 필드 구성·검증 규칙, 쿠폰 검증 흐름, 주문 생성 트랜잭션, 결제창 호출 로직은 이미 SPEC-ORDER-001·SPEC-DISCOUNT-001·SPEC-PAYMENT-001이 구현을 마쳤다. 이 SPEC은 그 파일들의 **Tailwind 클래스 표기만** 바꾼다(REQ-STOREFRONT-028/029).

### Out of Scope — 결제 수단 UI 및 주문 완료 화면

- PG 결제창 자체의 UI(결제수단 선택 등)는 SPEC-PAYMENT-001이 소유한다(그 SPEC §3 "카드사·간편결제 수단별 UI 커스터마이징").
- 주문 완료 화면(`/checkout/complete/[orderId]`)은 SPEC-ORDER-001·SPEC-PAYMENT-001의 PRESERVE 대상이며 이 SPEC은 그 화면을 건드리지 않는다.

### Out of Scope — 배송지 주소록 (백로그 카드 t23)

- 회원 전용 저장된 배송지 목록·마이페이지 화면은 백로그 카드 `t23`으로 이미 분리되어 있으며, 회원 체크아웃/신원 기반(카드 t18)이 먼저 서야 한다.

### Out of Scope — 배송 이행 상태 UI (백로그 카드 t24)

- 준비중/배송중/배송완료 같은 배송 이행 상태 표시·갱신 UI는 백로그 카드 `t24`(`SPEC-SHIPPING-001` 후보)로 이미 분리되어 있다.

### Out of Scope — 헤더·푸터·전역 내비게이션·장바구니 배지

- SPEC-STOREFRONT-001이 만든 최소 문서 셸에는 헤더·푸터·내비게이션이 없다(그 SPEC §3). 이 SPEC도 그것을 추가하지 않는다 — 장바구니 개수를 표시하는 헤더 배지, 전역 "장바구니로 이동" 아이콘은 만들지 않는다. `/cart` 진입은 담기 성공 후 표시되는 링크(REQ-STOREFRONT-025)와 주소 직접 입력으로 검증한다.

### Out of Scope — 위시리스트 / 나중에 보기

- SPEC-CART-001이 이미 제외한 기능이며 이 SPEC도 다루지 않는다.

### Out of Scope — 실시간 재고 동기화

- 장바구니·상품 상세에 표시되는 재고는 렌더 시점 스냅샷이며, WebSocket 등을 통한 실시간 갱신은 다루지 않는다. 재고 정합성의 최종 강제는 항상 서버(주문 생성 트랜잭션)의 몫이다(SPEC-ORDER-001·SPEC-ORDER-002).

### Out of Scope — 브라우저 E2E 자동화

- SPEC-STOREFRONT-001과 동일하게, 이 SPEC의 자동 검증은 jsdom + Testing Library 컴포넌트 테스트까지다. Playwright 등 브라우저 E2E 하네스 도입은 이번 범위 밖이다.

### Out of Scope — 디자인 시스템·재사용 컴포넌트 라이브러리

- 수량 스테퍼·버튼 등을 위한 별도 디자인 토큰 체계나 `src/components/ui/` 재사용 라이브러리 구축은 이번 범위 밖이다(SPEC-STOREFRONT-001과 동일 결정).
