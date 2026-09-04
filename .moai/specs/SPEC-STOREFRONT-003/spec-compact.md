# SPEC-STOREFRONT-003 (Compact) — 홈 화면 상품 목록 그리드

> Run-phase 로딩용 압축본. 개요·기술 접근·교차 참조 근거는 spec.md/plan.md 참고. ~30% 토큰 절감 목적.

## Requirements (GEARS, REQ-STOREFRONT-031 ~ 041)

- **REQ-STOREFRONT-031** (When): `/` 요청 시, `listProducts` 기본값(`page=1`, `pageSize=20`, `sort="newest"`)으로 조회한 상품 첫 페이지가 서버에서 완성된 HTML로 응답되어야 하며, 최초 화면을 위한 브라우저 측 추가 데이터 요청이 없어야 한다.
- **REQ-STOREFRONT-032** (Ubiquitous): 홈 화면은 `listProducts`를 서버 컴포넌트에서 직접 호출해야 하며, `/api/products`를 재호출하거나 새 클라이언트 데이터 조회 계층을 도입해서는 안 된다.
- **REQ-STOREFRONT-033** (Ubiquitous): 그리드 각 카드는 대표 이미지(첫 번째 이미지)·상품명·가격을 표시해야 한다.
- **REQ-STOREFRONT-034** (Ubiquitous): 가격은 천 단위 구분 기호 + `원` 표기(예: `89,000원`)여야 한다.
- **REQ-STOREFRONT-035** (Ubiquitous): 각 카드는 `/products/{productId}`로 이동하는 링크여야 한다.
- **REQ-STOREFRONT-036** (When-이벤트탐지): `totalCount`가 0이면 빈 그리드 대신 안내 문구를 표시해야 한다.
- **REQ-STOREFRONT-037** (When-이벤트탐지): 카드 상품이 이미지가 없으면 오류·빈 영역 없이 대체 표시(placeholder)를 렌더해야 한다.
- **REQ-STOREFRONT-038** (Unwanted): 페이지네이션·정렬·카테고리 필터 컨트롤을 제공해서는 안 된다.
- **REQ-STOREFRONT-039** (Unwanted): 초기 렌더 경로에서 브라우저 측 `fetch`/`useEffect` 데이터 로딩을 수행해서는 안 된다.
- **REQ-STOREFRONT-040** (Unwanted): 카드는 상품 설명·재고 수량·카테고리명을 표시해서는 안 된다.
- **REQ-STOREFRONT-041** (Ubiquitous, NFR): 모든 카드 이미지는 상품명을 포함한 대체 텍스트를 가져야 하며, 카드 링크는 키보드로 포커스·활성화 가능해야 한다.

## Acceptance Criteria (Given-When-Then, AC-STOREFRONT-031 ~ 041)

- **AC-STOREFRONT-031**: Given 상품 3개 이상 / When `/` 요청 / Then 이름·가격이 채워진 서버 렌더 HTML, `listProducts(page=1,pageSize=20,sort=newest)` 호출 확인, 초기 렌더 추가 fetch 없음.
- **AC-STOREFRONT-032**: Given 홈 화면 소스 / When 정적 스캔 / Then `listProducts` import 존재, `/api/products` 호출 패턴 매치 0건.
- **AC-STOREFRONT-033**: Given 상품 A(이미지 1장 이상, 89,000원, id p-1) / When 그리드 렌더 / Then 대표 이미지·이름·`89,000원` 표시, `/products/p-1` 링크.
- **AC-STOREFRONT-034**: Given `totalCount: 0` / When `/` 렌더 / Then 카드 0개, 안내 문구 표시.
- **AC-STOREFRONT-035**: Given `images: []`인 상품 B / When 카드 렌더 / Then 오류 없이 placeholder 표시, 이름·가격 정상.
- **AC-STOREFRONT-036**: Given 홈 화면 소스 / When 정적 스캔 / Then 페이지네이션/정렬/필터/검색 UI 요소·쿼리 조작 코드 매치 0건.
- **AC-STOREFRONT-037**: Given page.tsx/ProductGrid.tsx/ProductCard.tsx 소스 / When 정적 스캔 / Then `fetch(`/`useEffect` 매치 0건, `"use client"` 없음.
- **AC-STOREFRONT-038**: Given 설명·재고·카테고리를 가진 상품 A / When 카드 렌더 / Then 카드 텍스트에 설명·재고 문구·카테고리명 부재.
- **AC-STOREFRONT-039**: Given 상품 A/B/C 3개 첫 페이지 / When 그리드 렌더 / Then 카드 정확히 3개, 서로 다른 id 링크, 배열 순서 보존.
- **AC-STOREFRONT-040**: Given 렌더된 그리드 / (a) 모든 카드 이미지 alt에 상품명 포함 / (b) Tab으로 첫 카드 링크 포커스 도달(활성화는 플랫폼 보증).
- **AC-STOREFRONT-041**: Given `ProductListItem[]` props 직접 구성(서비스 모킹 없음) / When `ProductGrid`/`ProductCard` 단독 렌더 / Then props만으로 이름·가격·이미지·링크 재현, 서비스 모킹 불필요.

## Files to Modify / Create

| 파일 | 종류 |
|---|---|
| `src/app/page.tsx` | 교체(REPLACE) — SPEC-STOREFRONT-001 §4 스텁 본문을 그리드로 교체 |
| `src/components/product/ProductGrid.tsx` | 신규(NEW) |
| `src/components/product/ProductCard.tsx` | 신규(NEW) |
| `tests/unit/app/shell.test.tsx` | 부분 교체(MODIFY) — `HomePage stub` describe 블록만, `RootLayout` 블록은 PRESERVE |
| `tests/unit/components/product-grid.test.tsx` | 신규(NEW) |
| `tests/unit/components/product-card.test.tsx` | 신규(NEW, 필요 시) |

## Exclusions (What NOT to Build)

- 페이지네이션·정렬(`newest`/`price_asc`/`price_desc`)·카테고리 필터·검색 UI — 다음 SPEC으로 이월(spec.md §3).
- 그리드 카드에서 바로 담기(장바구니 추가) 버튼.
- `src/features/catalog/**`, `src/app/api/products/**`, `prisma/schema.prisma` 변경.
- 헤더·푸터·전역 내비게이션·검색창.
- 재사용 UI 컴포넌트 라이브러리(`src/components/ui/`), 디자인 토큰, 다크 모드.
- `next.config.ts`의 `images.remotePatterns` 변경.
- 브라우저 E2E 자동화(Playwright 등).
