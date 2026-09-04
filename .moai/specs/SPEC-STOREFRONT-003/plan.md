---
id: SPEC-STOREFRONT-003
status: completed
updated: 2026-09-04
tier: M
---

# Plan: SPEC-STOREFRONT-003 — 홈 화면 상품 목록 그리드

> 섹션 순서는 **되돌리기 어려운 결정 순**이다. §A~§E는 나중에 바꾸면 비용이 큰 결정(컴포넌트/클라이언트 경계, prop 계약, 빈 상태 배치, 이미지 부재 처리, 가격 포맷 관례)이고, §F 이후는 구조·마일스톤·잔여 위험이다.

---

## §A. 컴포넌트 경계 — 전부 서버 컴포넌트, 클라이언트 경계 없음

가장 되돌리기 어려운 결정이다. SPEC-STOREFRONT-001의 `ProductGallery`(썸네일 선택 상태)와 SPEC-STOREFRONT-002의 `CartView`(수량/삭제 상호작용)는 둘 다 사용자 상호작용 때문에 `"use client"` 경계가 필요했다. 이 SPEC의 그리드는 그런 상호작용이 없다 — 카드는 링크일 뿐이고, 클릭 시 브라우저가 기본 내비게이션으로 처리한다(React 상태가 전혀 관여하지 않는다).

**결정: `HomePage`(`src/app/page.tsx`), `ProductGrid`, `ProductCard` 셋 다 서버 컴포넌트로 유지한다. `"use client"` 지시어를 어디에도 추가하지 않는다.** 이것이 REQ-STOREFRONT-039("초기 렌더링 경로에서 브라우저 측 `fetch`/`useEffect` 금지")를 구조적으로 충족하는 가장 단순한 방법이다 — 애초에 클라이언트 컴포넌트가 없으면 `useEffect` 자체가 코드에 존재할 수 없다(constitution Enforce Simplicity: "이게 애초에 필요한가?").

## §B. 데이터 계약 — `listProducts`를 빈 쿼리로 직접 호출, prop은 기존 타입 그대로

**결정: `HomePage`는 `listProducts(new URLSearchParams())`를 직접 호출한다.** `product-service.ts`의 `parseListQuery`를 직접 읽어 확인한 사실 — `page`/`pageSize`/`sort` 파라미터가 전부 부재(`null`)일 때 각각 `DEFAULT_PAGE(1)`/`DEFAULT_PAGE_SIZE(20)`/`DEFAULT_SORT("newest")`로 폴백하고, `category`/`search`도 부재 시 필터 없이 통과한다(§1의 확정 결정 1이 요구하는 정확한 기본값 조합). 별도의 쿼리 객체를 조립하지 않는다 — 빈 `URLSearchParams`가 이미 원하는 기본값과 정확히 일치하므로, 파라미터를 명시적으로 채우는 코드는 존재하지 않는 분기를 방어하는 코드가 된다.

**결정: `ProductGrid`는 `products: ProductListItem[]` prop을, `ProductCard`는 `product: ProductListItem` prop을 받는다.** `@/features/catalog/types/product`에서 기존 `ProductListItem` 타입을 그대로 import해 재사용한다 — 이 SPEC은 새 타입 인터페이스를 하나도 도입하지 않는다(simplicity 사다리: 이미 있는 타입을 쓴다). `ProductDetail`이 아니라 `ProductListItem`을 쓰는 이유는 `listProducts`가 원래 그 타입을 반환하기 때문이며, `description`이 빠진 것은 데이터 계약이 이미 정한 사실이지 이 SPEC의 새 결정이 아니다(spec.md §1).

## §C. 빈 상태 처리 — `HomePage` 안에서 인라인 분기, 별도 컴포넌트 없음

`EmptyCart`(SPEC-STOREFRONT-002)는 "장바구니가 비어 있다"는 상태를 별도 컴포넌트로 분리했다 — 그 컴포넌트가 "상품 목록으로 이동" CTA 링크까지 갖고 있어 재사용 가능한 단위였기 때문이다. 이 SPEC의 빈 상태는 다르다: 이미 `/`(상품 목록 그 자체)에 있으므로 갈 곳을 안내하는 CTA가 필요 없고, 다른 화면에서 재사용될 일도 없다.

**결정: `totalCount === 0` 분기를 `HomePage` 함수 본문에 직접 인라인으로 작성한다.** 별도 `EmptyProductGrid` 컴포넌트 파일을 만들지 않는다 — 재사용 지점이 하나도 없는 한 문단짜리 안내 문구를 위해 파일을 새로 여는 것은 이 저장소의 확립된 절제 기준(SPEC-STOREFRONT-001/002 "재사용 라이브러리 미도입")과 맞지 않는다.

## §D. 카드별 이미지 부재 처리 — `ProductGallery`의 placeholder 패턴을 그대로 재사용

`ProductGallery.tsx`가 이미 정확히 같은 문제(이미지 배열이 비어 있을 때 `next/image`에 빈 `src`를 넘기면 런타임 오류)를 풀어 두었다 — `images[0]`이 `undefined`면 `next/image` 대신 회색 배경의 텍스트 placeholder `<div>`를 렌더한다.

**결정: `ProductCard`도 `product.images[0]`이 `undefined`일 때 동일한 모양(배경색 placeholder + 안내 텍스트)의 자체 분기를 갖는다.** 컴포넌트 자체를 공유하지는 않는다 — `ProductGallery`는 "use client" 갤러리 전용(썸네일 선택 상태를 포함)이라 그대로 가져다 쓸 수 없고, 이 저장소는 재사용 UI 라이브러리를 만들지 않기로 이미 결정했다(§1). 대신 **패턴**(빈 배열 → 오류 대신 placeholder)만 재사용한다.

## §E. 가격 포맷 — `formatWon` 사설 중복 관례를 따른다 (공유 유틸 추출 금지)

저장소 전체를 확인한 결과, `formatWon(amount: number): string { return `${new Intl.NumberFormat("ko-KR").format(amount)}원`; }`은 이미 최소 7개 파일(`ProductDetailView.tsx`, `OrderSummary.tsx`, `CartView.tsx`, `OrderLookupResultView.tsx`, `checkout/complete/[orderId]/page.tsx`, `staff/products/page.tsx`, `staff/orders/**`)에 **의도적으로 중복** 정의되어 있다. `CartView.tsx`의 주석이 그 결정을 명시한다 — "A third copy of ProductDetailView.formatWon / OrderSummary.formatWon ... this SPEC deliberately did not extract a shared util".

**결정: `ProductCard.tsx`(또는 `ProductGrid.tsx`, §F에서 확정)에 같은 2줄짜리 `formatWon`을 그대로 복제한다.** 공유 유틸(`src/lib/format.ts` 등)로 추출하지 않는다 — 이미 7군데가 중복을 선택한 저장소에서 8번째 사본만 홀로 추출하면 일관성이 오히려 깨지고, 이 SPEC의 위임 범위를 벗어나는 리팩터가 된다(§J 안티패턴).

---

## §F. 컴포넌트 구조와 파일 배치

| 컴포넌트/파일 | 위치 | 종류 | 책임 |
|---|---|---|---|
| `HomePage` | `src/app/page.tsx` | 서버(async) | `listProducts(new URLSearchParams())` 직접 호출(§B) → 빈 상태 분기(§C) → `ProductGrid`에 위임. 얇은 데이터 어댑터 |
| `ProductGrid` | `src/components/product/ProductGrid.tsx` | 서버(순수) | `products: ProductListItem[]`를 받아 그리드 레이아웃으로 `ProductCard` 나열 |
| `ProductCard` | `src/components/product/ProductCard.tsx` | 서버(순수) | `product: ProductListItem` 하나를 받아 이미지·이름·가격을 카드로 렌더, `/products/{id}` 링크. 이미지 부재(§D)·가격 포맷(§E) 처리 |

교체 대상(기존 파일, 본문 전체 교체):

| 파일 | 변경 내용 |
|---|---|
| `src/app/page.tsx` | SPEC-STOREFRONT-001 §4 스텁 본문(안내 문구 + 하드코딩 링크)을 §A~§C 설계대로 완전히 교체. 서버 컴포넌트라는 성격은 유지 |

`src/components/product/` 배치는 SPEC-STOREFRONT-001이 세운 도메인별 컴포넌트 배치 원칙을 그대로 따른다 — 새 디렉터리를 열지 않는다.

## §G. Tier 및 Conditional Design Route 판정

### Tier: M

| 축 | 추정 | 근거 |
|---|---|---|
| 변경 파일 수 | 5~6개 (신규 2 + 교체 1 + 테스트 2~3) | Tier M 가이드(5~15) 하단 |
| LOC | 약 150~300 | Tier S 상단 ~ Tier M 하단 경계 |
| 요구사항 수 | 11개 | Tier M 상한(16) 이내, 여유 5건 |
| 수락 기준 수 | 11개 (아래 acceptance.md) | Tier M 상한(16) 이내 |

경계에 가깝지만 M을 유지하는 근거: (1) `acceptance.md`를 별도 파일로 두라는 사용자의 명시적 산출물 요구가 이미 Tier M 산출물 세트(spec.md+plan.md+acceptance.md)를 전제한다. (2) 아래 Conditional Design Route가 적용되어, 그리드 컬럼 수·간격·카드 종횡비 같은 시각 세부는 design phase가 이어받는다 — Tier S로 낮춰 acceptance.md를 spec.md §3에 인라인하면 그 산출물 요구와 충돌한다.

### Route: `plan → design → run` (Conditional Design Route 적용)

`spec-workflow.md` § Conditional Design Route의 UI-surface 판정 기준(두 갈래 중 하나만 만족하면 된다)의 첫 갈래가 만족된다 — 이 SPEC의 `acceptance.md`가 화면(`/`)과 프런트엔드 컴포넌트(`ProductGrid`, `ProductCard`)를 명시적 산출물로 검증한다. SPEC-STOREFRONT-001/002가 같은 기준으로 이미 이 경로를 적용한 선례를 따른다.

**이 SPEC 위임 범위에서 design phase는 실행하지 않는다.** design phase는 plan-audit PASS + Implementation Kickoff Approval 이후, run-phase 첫 구현 커밋 이전에 `manager-design`이 수행한다. 여기서는 판정만 기록한다.

design phase가 다룰 것으로 예상되는 항목: 그리드의 반응형 컬럼 수(뷰포트별 breakpoint), 카드 간 간격, 카드 이미지의 종횡비(`ProductGallery`의 `aspect-square` 관례를 그대로 따를지), `next/image`의 `sizes` 속성값(그리드 컬럼 수에 맞춘 뷰포트 비율).

## §H. 마일스톤 (우선순위 기준, 시간 추정 없음)

`quality.yaml`의 `development_mode: tdd` + `test_first_required: true`에 따라 각 마일스톤은 RED → GREEN → REFACTOR로 진행한다.

| # | 우선순위 | 내용 | 완료 신호 |
|---|---|---|---|
| **M1** | High | `ProductCard` 단독(§D/§E) — 이미지 있음/없음, 가격 포맷, `/products/{id}` 링크, alt 텍스트. REQ-033~035, 037, 040, 041 | `product-card.test.tsx`(순수 표시 테스트, props in / DOM out) 통과 |
| **M2** | High | `ProductGrid`(§F) — `ProductCard` 나열, 빈 배열 시 빈 그리드(빈 상태 문구는 M3에서 `HomePage`가 담당). REQ-033 (목록화) | `product-grid.test.tsx` 통과 |
| **M3** | High | `HomePage` 재작성(§A~§C) — `listProducts` 직접 호출, `totalCount===0` 분기, `ProductGrid` 조립. REQ-031, 032, 036 | `tests/unit/app/shell.test.tsx`의 옛 스텁 스위트를 새 그리드 동작 검증으로 교체, 통과 |
| **M4** | Medium | 정적 범위 검사(§3 이월 대상 부재 확인) — 페이지네이션/정렬/필터 UI 부재, 초기 렌더 `fetch`/`useEffect` 부재. REQ-038, 039 | 소스 스캔 테스트(`firstRenderSources()` 패턴, `product-detail-page.test.tsx`/`cart-page.test.tsx` 선례) 통과 |
| **M5** | Medium | 접근성 마감(REQ-041 키보드 포커스 확인), 커버리지 임계값 충족 | `npm run lint`/`typecheck`/`test:coverage` 전부 통과 |

M1→M2→M3는 조립 의존 순서다(카드 없이 그리드를 테스트할 수 없고, 그리드 없이 페이지를 조립할 수 없다). M4/M5는 M1~M3 완료 후 전체 소스에 대해 수행한다.

## §I. 리스크

| # | 리스크 | 영향 | 완화 |
|---|---|---|---|
| R1 | 신규 `.tsx` 산출물에 테스트 없이는 85% 커버리지 게이트를 통과할 수 없음(`coverage_exemptions.enabled: false`) | 높음 | §H M1/M2/M3 각각에 테스트를 배정. STOREFRONT-001/002의 동일 리스크와 같은 완화 |
| R2 | `tests/unit/app/shell.test.tsx`가 `RootLayout`(SPEC-STOREFRONT-001 AC-001/002) 테스트도 함께 갖고 있어, 홈 스텁 부분만 교체하다가 실수로 레이아웃 테스트를 건드릴 수 있음 | 중간 | `describe("HomePage stub — §4 minimal exception")` 블록만 교체 대상으로 명시(§F). `describe("RootLayout — AC-STOREFRONT-001 / 002")` 블록은 PRESERVE — run-phase 델리게이션에 명시적으로 기록 |
| R3 | `EmptyCart.tsx`의 "상품 목록으로 이동" 링크가 이 SPEC 완료 후 처음으로 실제 목록 화면을 가리키게 되지만, 그 파일 자체를 수정하지 않으므로 회귀 검증이 이 SPEC 안에 없음 | 낮음 | 링크 대상 경로(`/`)가 바뀌지 않으므로 `EmptyCart.tsx`의 기존 테스트(`empty-cart.test.tsx`)는 이 SPEC과 무관하게 계속 통과한다 — 수용된 잔여 위험(spec.md §4) |
| R4 | design phase(§G)가 정할 그리드 컬럼 수·종횡비가 이 plan의 가정(§D placeholder 모양)과 다르게 나올 수 있음 | 낮음 | §D는 구조(placeholder 유무)만 결정하고 시각 세부(정확한 색상·크기)는 design phase로 열어 둔다 — STOREFRONT-001 plan.md §I와 동일한 절제 |

## §J. 안티패턴 — 하지 말 것

- **`formatWon`을 공유 유틸로 추출하기.** §E가 명시적으로 금지한다 — 이미 7군데가 중복을 선택한 저장소에서 8번째만 홀로 추출하는 것은 일관성을 깨는 리팩터다.
- **`ProductGrid`/`ProductCard`에 정렬·필터·페이지네이션 props를 "나중을 위해" 미리 준비하기.** REQ-STOREFRONT-038이 금지한다 — 다음 SPEC의 범위이며, 지금 도달 불가능한 props는 방어 코드다.
- **`ProductCard`에 담기 버튼을 얹기.** spec.md §3이 명시적으로 제외했다 — 상세 화면 진입(REQ-035)까지가 이 SPEC의 몫이다.
- **`src/features/catalog/**`를 수정하거나 자체 `/api/products` 호출 계층 추가.** REQ-STOREFRONT-032가 금지한다 — `listProducts`를 직접 호출하는 기존 관례(§B)를 따른다.
- **`ProductGallery`를 그리드 카드 이미지에 재사용.** `ProductGallery`는 클라이언트 컴포넌트(썸네일 상태 포함)라 성격이 다르다 — §D는 패턴만 재사용하라고 결정했다.
- **홈 화면에 헤더·전역 내비게이션·검색창을 "이왕 만드는 김에" 추가.** spec.md §3 Out of Scope에서 명시적으로 제외했다.

## §K. 교차 참조

- `.moai/specs/SPEC-STOREFRONT-003/spec.md` — 요구사항(REQ-STOREFRONT-031~041), 확정 범위 축소 결정, Out of Scope
- `.moai/specs/SPEC-STOREFRONT-003/acceptance.md` — 수락 기준(AC-STOREFRONT-031~041)
- `.moai/specs/SPEC-STOREFRONT-001/plan.md` §I — Conditional Design Route 판정 선례, `ProductGallery` placeholder 패턴의 출처
- `.moai/specs/SPEC-STOREFRONT-001/spec.md` §3, §4 — 이 SPEC이 이어받는 "목록 화면" 이월 결정
- `.moai/specs/SPEC-STOREFRONT-002/plan.md` §F — `src/components/<domain>/` 배치 원칙, 재사용 라이브러리 미도입 결정
- `src/components/cart/CartView.tsx` (주석) — `formatWon` 의도적 중복 관례의 명시적 근거
- `src/features/catalog/services/product-service.ts` — `listProducts`/`parseListQuery` 기본값 조합의 출처
- `.claude/rules/moai/workflow/spec-workflow.md` § SPEC Complexity Tier, § Conditional Design Route — §G 판정 근거
