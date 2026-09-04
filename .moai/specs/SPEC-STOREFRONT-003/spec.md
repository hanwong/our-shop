---
id: SPEC-STOREFRONT-003
title: "홈 화면 상품 목록 그리드 (첫 페이지, 정렬·필터 없음)"
version: "0.1.0"
status: completed
created: 2026-09-04
updated: 2026-09-04
author: snake
priority: P1
phase: "v0.2.0 target"
module: "src/app"
lifecycle: spec-anchored
tags: "storefront, ui, product-grid, home, catalog, nextjs, tailwind"
tier: M
depends_on: [SPEC-STOREFRONT-001, SPEC-CATALOG-001]
related_specs: [SPEC-STOREFRONT-002, SPEC-CATALOG-002]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-04 | 0.1.0 | draft | plan-phase 최초 작성. SPEC-STOREFRONT-001이 명시적으로 범위 밖으로 떠넘긴 "목록 화면"(그 SPEC spec.md §3, `### Out of Scope — 상품 목록 / 검색 화면`)을 이어받는 SPEC. 착수 전 사용자가 이미 AskUserQuestion으로 확정한 두 가지 범위 축소 결정(페이지네이션/정렬/필터 UI 제외, `next/image` 사용)을 반영해 작성했다. `[NEEDS CLARIFICATION]` 마커는 없다 — 모든 미해결 질문이 착수 전에 이미 해소되었다. |

---

## §1. 개요

`our-shop`의 **홈 화면**(`/`)에 상품 목록 그리드를 표시한다. 현재 `/`는 SPEC-STOREFRONT-001 §4가 "콘텐츠 설계 없는 최소 예외"로 남겨 둔 스텁 — 안내 문구 하나와 `/products/p-1`로 가는 하드코딩된 링크 하나 — 상태이며, 이 SPEC이 그 스텁을 실제 상품 그리드로 교체하는 **첫 목록 화면 SPEC**이다.

### 이 SPEC이 잇는 경계 — SPEC-STOREFRONT-001의 명시적 이월

SPEC-STOREFRONT-001은 자신의 범위를 상세 화면 하나로 못박으면서, 목록 화면을 별도 SPEC으로 명시적으로 떠넘겼다:

> `GET /api/products`(SPEC-CATALOG-001) 및 키워드 검색(SPEC-CATALOG-002)을 드러내는 목록 화면, 카테고리 필터 UI, 정렬 UI, 페이지네이션 UI는 별도 SPEC 대상이다. 이 SPEC은 상세 화면 하나만 만든다.
> — SPEC-STOREFRONT-001 spec.md §3, `### Out of Scope — 상품 목록 / 검색 화면`

그리고 홈 스텁을 남긴 이유도 명시했다:

> `/` 경로에 페이지가 없으면 개발 서버 첫 화면이 404가 되어, 상세 화면을 손으로 확인할 진입점이 사라진다. 이 때문에 **콘텐츠 설계 없는 최소 스텁 홈 페이지 한 장**만 예외적으로 포함한다. 홈 화면의 구성·디자인·상품 노출 로직은 위 Out of Scope에 명시한 대로 이번 범위가 아니다.
> — SPEC-STOREFRONT-001 spec.md §4

이 SPEC이 정확히 그 이월된 작업이다. 단, 사용자가 착수 전에 이미 범위를 아래와 같이 좁혀 확정했다 — SPEC-STOREFRONT-001이 가리킨 "목록 화면" 전체(정렬 UI·카테고리 필터 UI·페이지네이션 UI 포함)를 이번에 전부 만들지 않는다.

### 확정된 범위 축소 결정 (착수 전 AskUserQuestion으로 이미 승인됨)

1. **페이지네이션·정렬·카테고리 필터 UI는 이번 범위에 없다.** `listProducts`의 기본값(`page=1`, `pageSize=20`, `sort="newest"`)으로 요청한 첫 페이지 결과만 가져와 표시한다. 이 결정은 §3에 이월 대상으로 명시적으로 기록한다 — SPEC-STOREFRONT-001이 §4에서 취한 것과 같은 방식(범위를 좁히되 다음 SPEC의 출발점을 문서에 남긴다)이다.
2. **상품 이미지는 `next/image`를 사용한다.** 기존 `ProductGallery.tsx`(SPEC-STOREFRONT-001)의 관례를 따른다 — 장바구니 썸네일에 쓰인 평범한 `<img>`(`CartView.tsx`, SPEC-STOREFRONT-002) 관례는 채택하지 않는다. `next.config.ts`가 플레이스홀더 이미지 호스트 `picsum.photos`를 `images.remotePatterns`에 이미 허용 목록으로 등록해 두었으므로(SPEC-STOREFRONT-001 M1), 현재 사용 중인 플레이스홀더 이미지에 대해서는 이 SPEC에서 설정 변경이 필요 없다.

### 소비하는 데이터 계약 (SPEC-CATALOG-001에서 확정됨, 변경하지 않음)

이 화면이 부르는 API는 `listProducts(searchParams: URLSearchParams): Promise<ServiceResult<PaginatedProducts>>`(`src/features/catalog/services/product-service.ts`, `GET /api/products`로도 노출됨)이며, 지금까지 이 함수를 소비하는 화면이 하나도 없었다 — **이 SPEC이 그 첫 소비자다.**

| 필드 (`ProductListItem`) | 타입 | 그리드에서의 쓰임 |
|---|---|---|
| `id` | `string` | `/products/{id}` 링크 대상 |
| `name` | `string` | 카드 제목 |
| `price` | `number` | 원(KRW) 정수 — 카드에 천 단위 구분 기호로 표시 |
| `images` | `string[]` | 첫 번째 원소가 대표 이미지(`ProductGallery`와 동일 관례) |
| `stock` | `number` | 이 SPEC은 사용하지 않음(§3) |
| `category` | `{id,name,slug}` | 이 SPEC은 사용하지 않음(§3) |
| `createdAt` | `string` (ISO-8601) | 이 SPEC은 사용하지 않음(정렬은 서버가 `sort=newest` 기본값으로 이미 수행) |

`ProductListItem`에는 `description` 필드가 없다(SPEC-CATALOG-001 product.ts 주석: "card-style list UI does not render it"). 이 SPEC의 카드 설계는 처음부터 이 사실과 일치한다.

`PaginatedProducts`는 `{ items, page, pageSize, totalCount, totalPages }` 형태다. `totalCount === 0`(등록된 상품이 하나도 없을 때)이 빈 상태 판정 기준이다(§2 REQ-STOREFRONT-036).

### 데이터를 가져오는 방식 — 이 저장소의 확립된 관례를 따른다

이 저장소에는 클라이언트 측 fetch 래퍼가 어디에도 없다. 상세 화면(`src/app/products/[productId]/page.tsx`, SPEC-STOREFRONT-001)과 장바구니 화면(`src/app/cart/page.tsx`, SPEC-STOREFRONT-002) 둘 다 서버 컴포넌트가 서비스 함수를 직접 호출하는 동일한 패턴을 쓴다. 이 SPEC의 홈 화면도 같은 패턴을 따른다 — `listProducts`를 서버 컴포넌트에서 직접 호출하며, 브라우저 측 `fetch`/`useEffect` 데이터 로딩을 도입하지 않는다(§2 REQ-STOREFRONT-031/038).

### 재사용 가능한 그리드/카드 컴포넌트가 아직 없다

SPEC-STOREFRONT-001과 SPEC-STOREFRONT-002 둘 다 재사용 가능한 `src/components/ui/` 라이브러리를 만들지 않기로 "동일 결정"을 내렸다(SPEC-STOREFRONT-002 spec.md §3, `### Out of Scope — 디자인 시스템·재사용 컴포넌트 라이브러리`). 이 SPEC도 그 결정을 이어받는다 — `ProductGrid`/`ProductCard`는 이 저장소가 이미 쓰고 있는 도메인별 컴포넌트 배치 원칙(`src/components/product/`, `src/components/cart/`)을 따라 `src/components/product/` 아래 신설한다.

---

## §2. 요구사항 (GEARS, REQ-STOREFRONT-031 ~ 041)

Tier M — 요구사항 상한 16개 이내(현재 11개). `STOREFRONT` 도메인의 기존 번호(SPEC-STOREFRONT-002가 REQ-STOREFRONT-030까지 사용)를 이어받아 REQ-STOREFRONT-031부터 시작한다.

### 홈 화면 — 진입과 데이터 소스

- **REQ-STOREFRONT-031** (When): 방문자가 `/` 주소를 요청하면, 홈 화면은 `listProducts`의 기본값(`page=1`, `pageSize=20`, `sort="newest"`)으로 조회한 상품 첫 페이지가 이미 채워진 완성된 HTML을 서버에서 렌더링해 응답해야 하며, 최초 화면을 그리기 위한 브라우저 측 추가 데이터 요청이 발생해서는 안 된다.
- **REQ-STOREFRONT-032** (Ubiquitous): 홈 화면은 `listProducts`를 서버 컴포넌트에서 직접 호출해 상품 목록을 가져와야 하며, 자체 API 라우트(`/api/products`)를 다시 호출하거나 새로운 클라이언트 측 데이터 조회 계층을 도입해서는 안 된다.

### 상품 그리드 — 표시 내용

- **REQ-STOREFRONT-033** (Ubiquitous): 그리드의 각 카드는 상품의 대표 이미지(목록의 첫 번째 이미지), 상품명, 가격을 표시해야 한다.
- **REQ-STOREFRONT-034** (Ubiquitous): 카드의 가격은 원화 정수 금액으로, 천 단위 구분 기호와 통화 표기를 붙여 표시해야 한다(예: `89,000원`) — SPEC-STOREFRONT-001 REQ-STOREFRONT-007과 동일한 표기 규칙.
- **REQ-STOREFRONT-035** (Ubiquitous): 그리드의 각 카드는 `/products/{productId}` 상세 화면으로 이동하는 링크여야 한다.
- **REQ-STOREFRONT-036** (When — 이벤트 탐지형): 조회된 상품 목록의 `totalCount`가 0이면, 홈 화면은 빈 그리드 대신 상품이 아직 없다는 안내 문구를 표시해야 한다.
- **REQ-STOREFRONT-037** (When — 이벤트 탐지형): 어떤 카드의 상품이 이미지를 하나도 갖지 않으면, 그 카드는 대체 표시(placeholder)를 렌더링해야 하며 오류를 발생시키거나 빈 이미지 영역을 남겨서는 안 된다 — `ProductGallery`(SPEC-STOREFRONT-001, REQ-STOREFRONT-013)가 상세 화면에서 이미 채택한 것과 동일한 패턴.

### 상품 그리드 — 표시 범위 제한

- **REQ-STOREFRONT-038** (Unwanted, shall not): 홈 화면은 페이지네이션 컨트롤, 정렬 컨트롤, 카테고리 필터 컨트롤을 제공해서는 안 된다 — 첫 페이지 고정 결과만 표시한다(§3 이월 대상).
- **REQ-STOREFRONT-039** (Unwanted, shall not): 홈 화면과 그 컴포넌트는 초기 렌더링 경로에서 브라우저 측 `fetch` 호출이나 `useEffect` 기반 데이터 로딩을 수행해서는 안 된다.
- **REQ-STOREFRONT-040** (Unwanted, shall not): 상품 카드는 상품 설명, 재고 수량, 카테고리명을 표시해서는 안 된다 — 카드는 이미지·상품명·가격만 표시하는 최소 구성을 유지한다(`ProductListItem`에는 애초에 `description` 필드가 없다 — SPEC-CATALOG-001).

### 접근성 (NFR)

- **REQ-STOREFRONT-041** (Ubiquitous): 그리드에 표시되는 모든 상품 이미지는 상품명을 포함한 대체 텍스트를 가져야 하며, 각 카드 링크는 키보드만으로 포커스·활성화가 가능해야 한다.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다. SPEC-STOREFRONT-001이 이월한 "목록 화면" 전체 중 이번에 실제로 만드는 것은 첫 페이지 그리드 하나뿐이며, 나머지는 명시적으로 다음 SPEC으로 다시 이월한다.

### Out of Scope — 페이지네이션·정렬·카테고리 필터 UI (다음 SPEC으로 이월)

- `listProducts`가 이미 지원하는 `page`/`pageSize`/`sort`/`category` 파라미터를 드러내는 UI는 이번 범위 밖이다 — 페이지 번호 이동, "더 보기" 버튼, 정렬 드롭다운(`newest`/`price_asc`/`price_desc`), 카테고리 필터 목록 어느 것도 만들지 않는다. 홈 화면은 첫 페이지(`page=1`, `pageSize=20`, `sort="newest"`) 고정 결과만 표시한다(§1 확정 결정 1, REQ-STOREFRONT-038).
- 검색(SPEC-CATALOG-002의 `search` 파라미터)을 드러내는 검색창도 마찬가지로 제외한다.
- 이 항목들은 SPEC-STOREFRONT-001이 이미 "별도 SPEC 대상"으로 지정해 둔 것이며, 이 SPEC은 그 지정을 다음 SPEC으로 다시 넘긴다 — 출발점은 이 SPEC이 소비하는 동일한 `listProducts` 계약이다.

### Out of Scope — 상품 상세 화면·장바구니 담기 동선

- 그리드 카드에서 `/products/{productId}`로의 이동(REQ-STOREFRONT-035)까지가 이 SPEC의 몫이다. 상세 화면 자체(SPEC-STOREFRONT-001)와 담기 버튼(SPEC-STOREFRONT-002)은 이미 완성되어 있으며 이 SPEC은 건드리지 않는다.
- 그리드 카드에 담기 버튼을 얹는 것(카드에서 바로 장바구니에 담기)은 이번 범위가 아니다.

### Out of Scope — 카탈로그 API 및 도메인 계층 변경

- `src/features/catalog/**`, `src/app/api/products/**`, `prisma/schema.prisma`는 이 SPEC에서 수정하지 않는다. 홈 화면은 `listProducts` 계약을 소비만 한다.

### Out of Scope — 공통 레이아웃 UI (헤더·푸터·내비게이션)

- SPEC-STOREFRONT-001이 확립한 최소 문서 셸에는 헤더·푸터·전역 내비게이션·검색창·장바구니 아이콘이 없다(그 SPEC §3). 이 SPEC도 추가하지 않는다.

### Out of Scope — 디자인 시스템 및 재사용 컴포넌트 라이브러리

- 재사용 가능한 UI 컴포넌트 라이브러리(`src/components/ui/`), 디자인 토큰 체계, 다크 모드는 이번에 만들지 않는다 — SPEC-STOREFRONT-001·SPEC-STOREFRONT-002와 동일 결정(§1).

### Out of Scope — 이미지 호스트 설정 변경

- `next.config.ts`의 `images.remotePatterns`는 이미 `picsum.photos`를 허용 목록에 등록해 두었다(SPEC-STOREFRONT-001 M1). 이 SPEC은 그 설정을 수정하지 않는다 — 실제 상품 이미지 호스팅이 확정되면 별도로 갱신되어야 한다(그 SPEC의 기존 경고 유지).

### Out of Scope — 성능 측정 및 브라우저 E2E 자동화

- 카탈로그 p95 300ms 목표(REQ-CATALOG-016)의 렌더링 측면 측정 방법론은 이 SPEC의 대상이 아니다.
- SPEC-STOREFRONT-001·002와 동일하게, 자동 검증은 jsdom + Testing Library 컴포넌트 테스트까지다. Playwright 등 브라우저 E2E 하네스 도입은 제외한다.

---

## §4. 참고 — 기존 홈 스텁과의 관계

`src/app/page.tsx`는 현재 SPEC-STOREFRONT-001 §4의 최소 스텁(안내 문구 + `/products/p-1` 하드코딩 링크)이다. 이 SPEC은 그 파일의 본문을 완전히 교체한다 — 서버 컴포넌트라는 성격은 유지하되, 콘텐츠를 정적 안내문에서 실제 상품 그리드로 바꾼다.

`src/components/cart/EmptyCart.tsx`(SPEC-STOREFRONT-002)는 이미 "상품 목록으로 이동" 링크가 `/`를 가리키도록 만들어져 있으며, 그 파일의 주석은 "이 저장소에는 아직 상품 목록 화면이 없어 홈 스텁을 대신 가리킨다"고 명시하고 있다. 이 SPEC이 완료되면 그 링크가 가리키는 대상이 처음으로 실제 상품 목록 화면이 된다 — `EmptyCart.tsx` 자체는 이 SPEC에서 수정하지 않는다(링크 대상 경로가 바뀌지 않으므로).

---

## §5. 교차 참조

- SPEC-STOREFRONT-001 — 이 SPEC이 이어받는 목록 화면 이월 결정(spec.md §3, §4), 루트 문서 셸·Tailwind v4·App Router 서버 컴포넌트 컨벤션, `next/image` + `picsum.photos` 허용 목록의 출처, `ProductGallery`의 이미지-없음 placeholder 패턴(REQ-STOREFRONT-013)의 선례.
- SPEC-CATALOG-001 — 이 SPEC이 소비하는 `listProducts`/`ProductListItem`/`PaginatedProducts` 계약의 출처.
- SPEC-CATALOG-002 — `search` 파라미터를 포함한 검색 기능. 이 SPEC은 사용하지 않으며(§3), 다음 목록-UI SPEC의 대상.
- SPEC-STOREFRONT-002 — `src/components/<domain>/` 컴포넌트 배치 원칙과 재사용 라이브러리 미도입 결정(§1)의 선례, `EmptyCart.tsx`가 이 SPEC의 결과물을 가리키게 될 링크(§4).
- `.moai/project/tech.md` — Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 확정.
- `.moai/project/structure.md` — `app/`/`features/`/`components/` 레이어링 원칙.
