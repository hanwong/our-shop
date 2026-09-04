# Acceptance Criteria: SPEC-STOREFRONT-003 — 홈 화면 상품 목록 그리드

Tier M — AC 상한 16개 이내(현재 11개). `STOREFRONT` 도메인 번호를 SPEC-STOREFRONT-002(AC-STOREFRONT-001~030)에서 이어받아 AC-STOREFRONT-031부터 시작한다.

## §1. Given-When-Then 시나리오

**AC-STOREFRONT-031** — 홈 화면 서버 렌더, 첫 페이지 기본값 (REQ-STOREFRONT-031)
- Given: 등록된 상품이 3개 이상 있다
- When: `/`를 요청한다
- Then: 응답 HTML에 이미 각 상품의 이름·가격이 채워져 있고, `listProducts`가 `page=1`/`pageSize=20`/`sort="newest"`(빈 `URLSearchParams`의 기본값)로 호출되었으며, 최초 화면을 그리기 위한 브라우저 측 추가 데이터 요청이 없다(정적 소스 검사).

**AC-STOREFRONT-032** — `listProducts` 직접 호출, 자체 API 재호출 없음 (REQ-STOREFRONT-032)
- Given: 홈 화면과 그 컴포넌트(`page.tsx`, `ProductGrid.tsx`, `ProductCard.tsx`)의 소스
- When: 정적 소스를 검사한다
- Then: `@/features/catalog/services/product-service`의 `listProducts` import가 존재하고, `fetch("/api/products"...)` 또는 그 밖의 `/api/products` 경로 문자열 호출 패턴이 매치 0건이다.

**AC-STOREFRONT-033** — 카드 표시 내용 (REQ-STOREFRONT-033, 034, 035)
- Given: 이미지 1장 이상을 가진 상품 A(가격 89,000원, id `p-1`)
- When: 그리드를 렌더한다
- Then: 상품 A의 카드에 대표 이미지(첫 번째 이미지), 상품명, `89,000원`(천 단위 구분 기호 + `원`)이 표시되고, 카드가 `/products/p-1`로 이동하는 링크다.

**AC-STOREFRONT-034** — 등록된 상품이 없을 때 빈 상태 (REQ-STOREFRONT-036)
- Given: `listProducts`가 `totalCount: 0`인 빈 목록을 반환한다
- When: `/`를 렌더한다
- Then: 상품 카드가 하나도 렌더되지 않고, 대신 상품이 아직 없다는 안내 문구가 표시된다.

**AC-STOREFRONT-035** — 이미지가 없는 상품의 카드 placeholder (REQ-STOREFRONT-037)
- Given: `images: []`인 상품 B
- When: 상품 B의 카드를 렌더한다
- Then: 오류 없이 렌더되고(`expect(() => render(...)).not.toThrow()`), `next/image` 대신 대체 표시(placeholder)가 나타나며, 상품명·가격은 정상 표시된다.

**AC-STOREFRONT-036** — 페이지네이션·정렬·필터 UI 부재 (REQ-STOREFRONT-038)
- Given: 홈 화면과 그 컴포넌트의 소스
- When: 정적 소스를 검사한다
- Then: 페이지 번호/다음-이전 이동, 정렬 드롭다운(`newest`/`price_asc`/`price_desc` 옵션), 카테고리 필터 목록, 검색 입력 폼 어느 것과도 매치되는 UI 요소·이벤트 핸들러가 없다(`page=`/`pageSize=`/`sort=`/`category=`/`search=` 등의 쿼리 파라미터를 조작하는 코드가 없음을 소스 스캔으로 확인).

**AC-STOREFRONT-037** — 초기 렌더에서 클라이언트 데이터 로딩 부재 (REQ-STOREFRONT-039)
- Given: `src/app/page.tsx`, `src/components/product/ProductGrid.tsx`, `src/components/product/ProductCard.tsx`
- When: 세 파일의 소스를 스캔한다
- Then: `fetch(` 및 `useEffect` 패턴이 매치 0건이다. 셋 다 `"use client"` 지시어가 없다(§A 설계 확인).

**AC-STOREFRONT-038** — 카드는 이미지·이름·가격만 표시 (REQ-STOREFRONT-040)
- Given: 설명·재고·카테고리 정보를 가진 상품 A
- When: 그리드를 렌더한다
- Then: 상품 A의 카드 텍스트에 상품 설명 문자열, 재고 수량 표현("재고 N개"/"품절" 등), 카테고리명이 나타나지 않는다.

**AC-STOREFRONT-039** — 다중 상품 그리드 나열 (REQ-STOREFRONT-033 보강)
- Given: 상품 A·B·C 3개를 담은 첫 페이지 결과
- When: 그리드를 렌더한다
- Then: 정확히 3개의 카드가 렌더되고, 각 카드의 링크 대상이 서로 다른 상품 id를 가리킨다(순서는 API가 반환한 배열 순서를 보존).

**AC-STOREFRONT-040** — 접근성 (REQ-STOREFRONT-041)
- Given: 렌더된 상품 그리드
- (a) When: 카드 이미지의 `alt` 속성을 조회한다 → Then: 모든 카드 이미지의 `alt`가 비어 있지 않고 해당 상품명을 포함한다.
- (b) When: Tab 키로 첫 번째 카드 링크에 포커스를 이동한다 → Then: 포커스가 도달하고(`document.activeElement`로 확인), 네이티브 링크 요소이므로 Enter로 활성화 가능하다(플랫폼 보증 — §5 참고).

**AC-STOREFRONT-041** — `ProductCard`/`ProductGrid` 순수 표시 계층 단위 테스트 (REQ-STOREFRONT-033~035, 037, 040)
- Given: `ProductListItem[]` 배열을 props로 직접 구성한다 (서비스 모킹 없이)
- When: `ProductGrid`/`ProductCard`를 단독으로 렌더한다(`product-gallery.test.tsx`의 props-in/DOM-out 격리 패턴)
- Then: props에 담긴 값만으로 이름·가격·이미지·링크가 정확히 재현되고, 서비스 계층 모킹이 전혀 필요 없다(컴포넌트가 데이터 접근을 하지 않음을 구조적으로 증명).

## §2. 엣지 케이스

| 케이스 | 기대 동작 |
|---|---|
| `listProducts`가 400(잘못된 쿼리)을 반환 | 빈 `URLSearchParams`로 호출하므로 이 경로는 정상 동작에서 도달 불가능하다(`parseListQuery`가 부재 파라미터에 항상 기본값으로 폴백 — REQ-CATALOG-004). 방어 코드를 추가하지 않는다(plan.md §J) |
| 상품이 정확히 1개만 등록됨 | 카드 1개짜리 그리드로 정상 렌더(빈 상태 아님 — `totalCount` 1 ≠ 0) |
| 20개 초과 상품이 등록되어 있음(총 21개 이상) | 첫 페이지(`pageSize=20`) 20개만 표시, 21번째 이후는 이 SPEC의 화면에 나타나지 않음 — 페이지네이션 부재는 REQ-STOREFRONT-038이 의도한 동작이지 결함이 아니다 |
| 상품명에 HTML 특수문자(`<`, `&` 등)가 포함됨 | React의 기본 이스케이프에 의해 안전하게 텍스트로 렌더됨(별도 처리 불필요) |
| `next/image`에 넘기는 이미지 URL이 `next.config.ts`의 `remotePatterns`에 없는 호스트 | 이 SPEC의 범위가 아니다 — 기존 placeholder 호스트(`picsum.photos`)는 이미 허용 목록에 있으며(SPEC-STOREFRONT-001 M1), 새 호스트 등록은 실제 이미지 호스팅이 정해질 때의 별도 작업이다(spec.md §3) |

## §3. 품질 게이트

- 전체 테스트 통과(`npm run test:coverage`), 회귀 0건 — 특히 `tests/unit/app/shell.test.tsx`의 `RootLayout — AC-STOREFRONT-001 / 002` describe 블록은 이 SPEC에서 수정하지 않으며 통과 상태를 유지해야 한다(plan.md §I R2).
- 신규/수정 `.tsx` 파일 커버리지 ≥85%(lines/functions/statements), ≥80%(branches) — `coverage_exemptions.enabled: false`로 면제 경로 없음.
- 타입 검사(`npx tsc --noEmit`) exit 0.
- 린트(`npm run lint`) exit 0, 신규 이슈 0건.
- Definition of Done: REQ-STOREFRONT-031~041 전체가 아래 §4 매핑 표의 AC로 커버되고 PASS 또는 (환경 제약에 한해) 명시적으로 기록된 PARTIAL 상태로 종결된다 — 조용한 생략 없음.

## §4. REQ ↔ AC 매핑 표 (명시적 커버리지 확인)

| REQ | AC |
|---|---|
| REQ-STOREFRONT-031 | AC-STOREFRONT-031 |
| REQ-STOREFRONT-032 | AC-STOREFRONT-032 |
| REQ-STOREFRONT-033 | AC-STOREFRONT-033, AC-STOREFRONT-039, AC-STOREFRONT-041 |
| REQ-STOREFRONT-034 | AC-STOREFRONT-033 |
| REQ-STOREFRONT-035 | AC-STOREFRONT-033, AC-STOREFRONT-039 |
| REQ-STOREFRONT-036 | AC-STOREFRONT-034 |
| REQ-STOREFRONT-037 | AC-STOREFRONT-035 |
| REQ-STOREFRONT-038 | AC-STOREFRONT-036 |
| REQ-STOREFRONT-039 | AC-STOREFRONT-037 |
| REQ-STOREFRONT-040 | AC-STOREFRONT-038 |
| REQ-STOREFRONT-041 | AC-STOREFRONT-040 (a/b) |

## §5. 관측 불가 항목 (수동 확인 또는 플랫폼 보증으로 분류)

- AC-STOREFRONT-040(b)의 "네이티브 링크가 Enter로 활성화된다"는 브라우저 표준 동작이며, jsdom 컴포넌트 테스트가 검증하는 것은 포커스 도달까지다 — 활성화 자체는 SPEC-STOREFRONT-001 plan.md §H-5와 동일하게 플랫폼 보증으로 분류하고 자동 Definition of Done 판정 대상에서 제외한다.
- 그리드의 반응형 레이아웃(컬럼 수 변화, 375px 뷰포트 가로 스크롤 없음)은 jsdom에 레이아웃 엔진이 없어 자동 관측이 불가능하다 — SPEC-STOREFRONT-001 §3(REQ-STOREFRONT-015 판정 방식)과 동일하게 수동 시각 확인 체크리스트로 분리하며, 자동 DoD 통과 조건에 포함되지 않는다.
