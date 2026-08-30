---
id: SPEC-STOREFRONT-001
title: "상품 상세 페이지 UI 및 이미지 갤러리 (루트 레이아웃 선행 구축 포함)"
version: "0.1.2"
status: completed
created: 2026-08-30
updated: 2026-08-30
author: snake
priority: P1
phase: "v0.1.0 MVP"
module: "src/app/products"
lifecycle: spec-anchored
tags: "storefront, ui, product-detail, gallery, layout, nextjs"
tier: M
depends_on: [SPEC-CATALOG-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-08-30 | 0.1.0 | draft | plan-phase 최초 작성. `our-shop`의 **첫 UI SPEC**. 저장소에 `.tsx` 파일과 CSS가 하나도 없음을 직접 확인했고(§1 참고), 그 결과 루트 문서 셸 구축이 상세 페이지의 선행 산출물로 범위에 포함됐다. 상세 데이터 계약은 SPEC-CATALOG-001 구현체(`ProductDetail`)에서 직접 읽어 확정했다. 미해결 결정 2건(스타일링 방식, 이미지 호스트 허용 목록)은 plan.md에 확인 요청 항목으로 표시. |
| 2026-08-30 | 0.1.1 | draft | 미해결 결정 2건이 사용자 결정으로 해소됨. (1) 스타일링 = **Tailwind CSS v4**(`tech.md` 추천안 채택, CSS Modules 대안 제거 — plan.md §C). (2) 이미지 = **`next/image`** + `images.remotePatterns` 허용 목록에 플레이스홀더 서비스 `picsum.photos` 등록(실제 호스팅 확정 시 교체·확장할 임시 목록 — plan.md §D). 요구사항(REQ) 본문은 변경 없음 — 구현 수단 결정만 확정됐다. |
| 2026-08-30 | 0.1.2 | draft | plan-audit iteration 1의 blocking 결함 2건 반영. (1) 여러 AC가 선언된 검증 하네스(jsdom + Testing Library)로는 판정 불가였던 문제 — 각 AC의 판정 지점을 페이지 컴포넌트가 실제로 제어하는 지점으로 좁히고(`notFound()` 호출 여부, `className` 토큰, 렌더 출력 텍스트), 관측 불가 항목은 "프레임워크 보증" / "수동 시각 확인"으로 분류해 명시(plan.md §H-5, acceptance.md §5, 위 §3). (2) `layout.tsx`·홈 스텁 `page.tsx`가 커버리지 대상이면서 테스트 계획이 없던 문제 — plan.md §F에 최소 스모크 테스트와 함께 산출물로 등재. 요구사항(REQ) 본문은 변경 없음 — 검증 수단 선언과 범위 표기만 정밀해졌다. |

---

## §1. 개요

`our-shop`의 **상품 상세 화면**을 정의한다. 방문자가 `/products/{productId}` 주소로 진입하면 상품의 이름·가격·설명·카테고리·재고 상태와 함께, 여러 장의 상품 이미지를 썸네일로 전환해가며 볼 수 있는 화면이다.

이 SPEC은 `product.md` 사용 사례 #1(비회원 빠른 구매)에서 "상세 페이지 확인" 단계에 해당하며, SPEC-CATALOG-001이 이미 제공하는 상세 조회 능력(REQ-CATALOG-013/014/015)을 화면으로 처음 드러내는 작업이다.

### 이 SPEC이 프로젝트에서 갖는 특수한 위치

지금까지 완료된 4개 SPEC(AUTH-001, CATALOG-001, CATALOG-002, CART-001)은 전부 API·도메인 계층만 만들었고 **화면은 하나도 만들지 않았다**. 저장소 상태를 직접 확인한 결과는 다음과 같다.

| 확인 항목 | 명령 | 결과 |
|---|---|---|
| 루트 레이아웃 | `ls src/app/layout.tsx` | **부재** |
| 루트 페이지 | `ls src/app/page.tsx` | **부재** |
| 모든 `.tsx` 파일 | `find src -name "*.tsx"` | **0건** |
| 모든 CSS 파일 | `find . -name "*.css" -not -path "./node_modules/*"` | **0건** |
| `src/app` 하위 | `ls src/app` | `api` 디렉터리 하나뿐 |

Next.js App Router는 라우트 세그먼트를 렌더링할 때 상위 방향으로 루트 레이아웃을 요구한다. 즉 **현재 저장소 상태에서는 어떤 페이지도 렌더링될 수 없다.** 따라서 공통 문서 셸(문서 언어·기본 타이포그래피·전역 스타일·사이트 메타데이터)은 이 SPEC의 부수 작업이 아니라 **상세 페이지가 존재하기 위한 선행 산출물**이며, §2의 REQ-STOREFRONT-001/002가 그 요구사항이다.

이 셸은 "최소한"이라는 말 그대로 최소한이다. 헤더·푸터·전역 내비게이션·디자인 시스템은 전부 §3에서 명시적으로 제외한다.

### 소비하는 데이터 계약 (SPEC-CATALOG-001에서 확정됨)

상세 화면이 표시하는 상품 표현은 SPEC-CATALOG-001이 이미 확정한 `ProductDetail` 형태이며, 이 SPEC은 이 계약을 **소비만 하고 변경하지 않는다**.

| 필드 | 타입 | 화면에서의 의미 |
|---|---|---|
| `id` | `string` | 라우트 세그먼트 값과 동일 |
| `name` | `string` | 상품명 |
| `price` | `number` | **원(KRW) 정수** — 소수점 단위 없음 |
| `description` | `string` | 전체 설명 |
| `images` | `string[]` | 이미지 URL 목록. **배열 순서가 곧 표시 순서** |
| `stock` | `number` | 재고 수량 |
| `category` | `{ id, name, slug }` | 카테고리 |
| `createdAt` / `updatedAt` | `string` | ISO-8601 문자열 |

존재하지 않는 상품 id에 대해 카탈로그 도메인은 404 의미의 결과를 돌려준다(REQ-CATALOG-014). 응답에는 리뷰나 관련 상품이 포함되지 않는다(REQ-CATALOG-015).

---

## §2. 요구사항 (GEARS, REQ-STOREFRONT-001 ~ 015)

Tier M — 요구사항 상한 16개 이내(현재 15개).

### 공통 문서 셸 (선행 요건)

- **REQ-STOREFRONT-001** (Ubiquitous): 스토어프론트의 모든 페이지는 문서 언어가 한국어(`ko`)로 선언되고, 기본 타이포그래피와 전역 스타일이 적용된 공통 문서 셸 안에서 렌더링되어야 한다.
- **REQ-STOREFRONT-002** (Ubiquitous): 스토어프론트의 모든 페이지 응답은 사이트 기본 제목(title)과 설명(description) 메타데이터를 포함해야 한다.

### 상품 상세 화면 — 진입과 실패

- **REQ-STOREFRONT-003** (When): 방문자가 `/products/{productId}` 주소를 요청하면, 스토어프론트는 상품 정보가 이미 채워진 완성된 HTML을 서버에서 렌더링해 응답해야 하며, 최초 화면을 그리기 위한 브라우저 측 추가 데이터 요청이 발생해서는 안 된다.
- **REQ-STOREFRONT-004** (When — 이벤트 탐지형): 존재하지 않는 상품 식별자로 상세 화면이 요청되면, 스토어프론트는 HTTP 404 상태와 함께 "상품을 찾을 수 없다"는 안내 화면을 응답해야 하며, 오류 스택·내부 오류 문자열·데이터베이스 정보를 노출해서는 안 된다.
- **REQ-STOREFRONT-005** (Ubiquitous): 상품 상세 화면은 인증 없이 익명 방문자를 포함한 모든 사용자가 열람 가능해야 한다.

### 상품 상세 화면 — 표시 내용

- **REQ-STOREFRONT-006** (Ubiquitous): 상품 상세 화면은 상품의 이름, 가격, 전체 설명, 카테고리 이름, 재고 가용 상태를 모두 표시해야 한다.
- **REQ-STOREFRONT-007** (Ubiquitous): 상품 상세 화면은 가격을 원화 정수 금액으로, 천 단위 구분 기호와 통화 표기를 붙여 표시해야 한다(예: `89,000원`).
- **REQ-STOREFRONT-008** (While): 상품의 재고 수량이 0인 동안, 상품 상세 화면은 품절 상태를 명시적인 문구로 표시해야 한다.
- **REQ-STOREFRONT-009** (Unwanted, shall not): 상품 상세 화면은 리뷰, 관련 상품, 재고 변동 이력, 내부 식별자(카테고리 id 등)를 표시해서는 안 된다.

### 이미지 갤러리

- **REQ-STOREFRONT-010** (Ubiquitous): 이미지 갤러리는 상품 이미지 목록의 첫 번째 이미지를 최초 대표 이미지로 표시해야 한다.
- **REQ-STOREFRONT-011** (While): 상품 이미지가 둘 이상인 동안 갤러리는 이미지마다 하나씩 대응하는 썸네일 목록을 표시해야 하며, 이미지가 정확히 하나인 동안에는 썸네일 목록을 표시해서는 안 된다.
- **REQ-STOREFRONT-012** (When): 사용자가 썸네일 하나를 선택하면, 갤러리는 대표 이미지를 선택된 썸네일의 이미지로 교체하고, 어떤 썸네일이 선택되었는지를 시각적으로도 보조 기술로도 식별 가능하게 표시해야 한다.
- **REQ-STOREFRONT-013** (When — 이벤트 탐지형): 갤러리가 이미지가 하나도 없는 상품을 받으면, 대체 표시(placeholder)를 렌더링해야 하며 오류를 발생시키거나 빈 영역을 남겨서는 안 된다.
- **REQ-STOREFRONT-014** (Unwanted, shall not): 이미지 갤러리는 확대(zoom), 전체 화면 라이트박스, 스와이프 제스처, 자동 재생 캐러셀을 제공해서는 안 된다.

### 접근성 및 반응형 (NFR)

- **REQ-STOREFRONT-015** (Ubiquitous): 갤러리의 썸네일은 키보드만으로 이동·선택 가능해야 하고 선택 상태가 포커스와 구분되어 보여야 하며, 화면에 표시되는 모든 상품 이미지는 상품명을 포함한 대체 텍스트를 가져야 한다. 또한 상세 화면은 폭 375px 뷰포트에서 가로 스크롤 없이 읽을 수 있어야 한다.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다. 첫 UI SPEC이라는 위치상 "이왕 화면 만드는 김에" 확장될 여지가 크기 때문에, 경계를 평소보다 촘촘히 못 박는다.

### Out of Scope — 장바구니 담기 및 구매 동선

- 상세 화면의 "장바구니 담기" 버튼과 그 동작은 이번 범위 밖이다. `POST /api/cart/items` API는 SPEC-CART-001로 이미 존재하지만, 수량 선택기·담기 성공/실패 피드백·게스트 쿠키 처리 UX는 장바구니 UI SPEC에서 함께 다뤄야 일관된다.
- 즉시 구매, 체크아웃 진입, 위시리스트도 마찬가지로 제외한다.

### Out of Scope — 공통 레이아웃 UI (헤더 / 푸터 / 내비게이션)

- 루트 문서 셸에는 헤더, 푸터, 전역 내비게이션 바, 검색창, 장바구니 아이콘을 포함하지 않는다. 셸은 문서 언어·폰트·전역 스타일·기본 메타데이터까지만 담당한다.
- 사이트 홈 화면의 콘텐츠 설계도 제외한다(§4의 최소 스텁 예외 참고).

### Out of Scope — 상품 목록 / 검색 화면

- `GET /api/products`(SPEC-CATALOG-001) 및 키워드 검색(SPEC-CATALOG-002)을 드러내는 목록 화면, 카테고리 필터 UI, 정렬 UI, 페이지네이션 UI는 별도 SPEC 대상이다. 이 SPEC은 상세 화면 하나만 만든다.

### Out of Scope — 고급 갤러리 상호작용

- 확대/돋보기(hover zoom), 전체 화면 라이트박스, 핀치 줌, 스와이프 제스처, 자동 재생 캐러셀, 360도 뷰, 동영상 미디어를 제공하지 않는다(REQ-STOREFRONT-014).
- 이미지 프리로딩 전략, 블러 플레이스홀더 생성 파이프라인도 이번 범위 밖이다.

### Out of Scope — 상품 옵션 / 변형 (variant)

- 색상·사이즈 등 상품 옵션 선택 UI는 제공하지 않는다. 도메인 모델 자체가 variant를 갖지 않기 때문이다(REQ-CATALOG-002에서 이미 제외됨).

### Out of Scope — 리뷰 및 관련 상품

- 상세 응답에 애초에 포함되지 않는 데이터다(REQ-CATALOG-015). 리뷰 작성/조회 UI, 관련 상품 추천 영역은 각각 별도 도메인 SPEC 대상이다.

### Out of Scope — 카탈로그 API 및 도메인 계층 변경

- `src/features/catalog/**`, `src/app/api/products/**`, `prisma/schema.prisma`는 이 SPEC에서 수정하지 않는다. 상세 화면은 기존 계약을 소비만 한다.
- 상세 응답에 새 필드를 추가하는 일(예: 이미지 대체 텍스트 전용 필드)은 카탈로그 SPEC의 개정 대상이지 이 SPEC의 작업이 아니다.

### Out of Scope — 디자인 시스템 및 SEO 심화

- 재사용 가능한 UI 컴포넌트 라이브러리(`src/components/ui/`), 디자인 토큰 체계, 다크 모드는 이번에 만들지 않는다.
- 상품별 동적 메타데이터(오픈그래프 이미지, JSON-LD 구조화 데이터, canonical URL)는 제외한다. 이 SPEC은 사이트 기본 메타데이터까지만 다룬다(REQ-STOREFRONT-002).

### Out of Scope — 성능 측정 및 E2E 자동화

- 카탈로그 p95 300ms 목표(REQ-CATALOG-016)의 렌더링 측면 측정 방법론은 `product.md` 로드맵의 "카탈로그 성능 검증 SPEC" 대상이다.
- Playwright 등 브라우저 E2E 테스트 하네스 도입은 제외한다. 이번 검증은 컴포넌트 단위 테스트까지다.
- 이 제외의 직접적 귀결로, **브라우저 레이아웃 엔진이 있어야 관측 가능한 항목은 자동 검증하지 않는다** — REQ-STOREFRONT-015의 375px 뷰포트 가로 스크롤 조건이 여기 해당한다. 해당 항목은 acceptance.md §5의 수동 시각 확인 체크리스트로 분리되며, 자동 Definition of Done의 통과 조건에 포함되지 않는다. 요구사항 자체는 유지되고, 판정 수단만 수동으로 남는다.
- HTTP 응답 상태 코드(404/200) 자체를 응답 계층에서 관측하는 검증도 같은 이유로 제외한다. 이 SPEC의 테스트가 판정하는 것은 페이지 컴포넌트가 제어하는 지점(`notFound()` 호출 여부)까지이며, 그 호출이 HTTP 404로 번역되는 것은 Next.js 런타임의 보증이다(plan.md §H-5).

---

## §4. 참고 — 홈 라우트에 대한 최소 예외

`/` 경로에 페이지가 없으면 개발 서버 첫 화면이 404가 되어, 상세 화면을 손으로 확인할 진입점이 사라진다. 이 때문에 **콘텐츠 설계 없는 최소 스텁 홈 페이지 한 장**만 예외적으로 포함한다. 홈 화면의 구성·디자인·상품 노출 로직은 위 Out of Scope에 명시한 대로 이번 범위가 아니다.

---

## §5. 교차 참조

- SPEC-CATALOG-001 — 상품 도메인 모델과 상세 조회 계약(`ProductDetail`, 404 의미). 이 SPEC의 데이터 공급원.
- SPEC-CATALOG-002 — 목록 검색. 상세 화면과 무관(AC-CATALOG-028에서 이미 확인됨).
- SPEC-CART-001 — 장바구니 API. 상세 화면과의 연결은 §3에서 제외.
- `.moai/project/product.md` — 모바일 우선, 사용 사례 #1.
- `.moai/project/structure.md` — `app/` / `features/` / `components/` 레이어링 원칙.
- `.moai/project/tech.md` — Next.js 15 App Router 확정. 스타일링은 이 SPEC에서 `tech.md`의 추천안인 **Tailwind CSS**로 확정됐다(plan.md §C).
