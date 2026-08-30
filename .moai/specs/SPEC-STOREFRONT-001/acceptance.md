# Acceptance Criteria: SPEC-STOREFRONT-001 — 상품 상세 페이지 UI 및 이미지 갤러리

Tier M — AC 상한 16개 이내(현재 15개). 각 항목은 REQ-STOREFRONT-XXX 하나 이상을 검증하며, 통과/실패가 이분법으로 판정 가능해야 한다.

검증 대상 산출물(프런트엔드 페이지·컴포넌트 산출물이 명시된다는 점이 plan.md §I의 design route 판정 근거다):

- 페이지: `/products/{productId}`
- 컴포넌트: `ProductDetailView`(순수 프레젠테이션), `ProductGallery`(클라이언트)
- 문서 셸: 루트 레이아웃 + 전역 스타일

### 검증 수단의 경계 (읽기 전에)

이 SPEC이 도입하는 검증 하네스는 **jsdom + `@testing-library/react` 컴포넌트 테스트 + 정적 소스 검사 + `npm run build`** 까지다(plan.md §H). 브라우저 E2E 하네스는 spec.md §3에서 명시적으로 제외했다. 따라서 아래 각 AC는 **그 하네스로 실제 관측 가능한 것만** Then 절에 담고, 관측 불가능한 것은 두 갈래로 분류해 명시한다.

| 분류 | 의미 | 해당 항목 |
|---|---|---|
| **프레임워크 보증** | 코드가 제어하지 않고 Next.js 런타임이 보증하는 동작. 이 SPEC의 테스트가 재검증하지 않는다 | `notFound()` → HTTP 404 번역(AC-004), 정상 렌더 → HTTP 200(AC-005), 네이티브 `<button>`의 Enter/Space → click 변환(AC-015a) |
| **수동 시각 확인** | 자동 판정 수단이 없어 사람이 브라우저에서 확인하는 항목. **자동 Definition of Done의 PASS 조건에 포함되지 않는다** | 375px 뷰포트 가로 스크롤 없음(AC-015c) |

각 AC의 Then 절 아래에 `검증 수단:` 줄을 두어 무엇으로 판정하는지 한 줄로 밝힌다. plan.md §H-5가 같은 내용을 하네스 관점에서 다시 정리한다.

---

## §1. Given-When-Then 시나리오

### 공통 문서 셸

**AC-STOREFRONT-001** — 문서 셸이 존재하고 한국어로 선언된다 (REQ-STOREFRONT-001)
- Given: 저장소에 루트 레이아웃과 전역 스타일시트가 구축되어 있다
- When: `RootLayout({ children })`이 반환한 엘리먼트 트리를 검사하고, 스토어프론트 컴포넌트를 `render()`로 렌더하고, 별도로 `npm run build`를 실행한다
- Then: (a) 반환 트리 최상위 `html` 엘리먼트의 `lang` prop이 `"ko"`이고 `body`가 존재하며, `layout.tsx` 소스가 `globals.css`를 import하고 `globals.css` 첫 줄이 `@import "tailwindcss";`이다. (b) 렌더된 요소의 `className` 문자열에 마크업이 선언한 Tailwind 유틸리티 클래스 토큰이 그대로 포함되어 있다. (c) 프로덕션 빌드(`npm run build`)가 exit 0으로 성공한다.
- 검증 수단: (a) 반환 엘리먼트 트리 검사 + 정적 소스 검사, (b) jsdom + Testing Library `render()` 후 `className` 토큰 단언, (c) `npm run build` 종료 코드. **브라우저가 실제로 그려낸 시각적 스타일(계산된 CSS)은 판정 대상이 아니다** — jsdom에는 CSS 레이아웃 엔진이 없다. 이 AC가 보장하는 것은 "컴포넌트가 의도한 유틸리티 클래스를 출력한다 + Tailwind 파이프라인이 빌드된다"까지다.

**AC-STOREFRONT-002** — 사이트 기본 메타데이터가 포함된다 (REQ-STOREFRONT-002)
- Given: 루트 레이아웃이 Metadata API로 기본 메타데이터를 선언한다
- When: `layout.tsx`가 export한 `metadata` 객체를 import해 검사한다
- Then: `metadata.title`과 `metadata.description`이 각각 비어 있지 않은 문자열이다.
- 검증 수단: `export const metadata`를 직접 import한 단위 테스트. Metadata 객체가 `<title>` / `<meta name="description">` 태그로 직렬화되는 것은 Next.js Metadata API의 프레임워크 보증이며 재검증하지 않는다.

### 상세 화면 진입과 실패

**AC-STOREFRONT-003** — 상품 정보가 서버 컴포넌트 출력에 이미 들어 있다 (REQ-STOREFRONT-003)
- Given: `getProductDetail("p-1")`이 이름 `"Classic Denim Jacket"`인 `ProductDetail`을 성공 반환하도록 서비스 계층을 모킹했다
- When: 상세 페이지 컴포넌트가 반환한 엘리먼트를 `render()`로 렌더하고, 별도로 상세 화면 컴포넌트 소스를 정적 검사한다
- Then: (a) `screen.getByText("Classic Denim Jacket")`가 매치된다 — 즉 상품명이 서버 컴포넌트가 조립한 출력 안에 이미 들어 있고, 클라이언트 데이터 로딩을 기다리지 않는다. (b) `src/app/products/**` 와 `src/components/product/**` 어디에도 브라우저 측 상품 데이터 요청(`fetch(` 호출 또는 `useEffect` 기반 데이터 로딩)이 존재하지 않는다.
- 검증 수단: (a) jsdom + Testing Library `render()` + `screen`. 서버 컴포넌트가 반환하는 것은 마크업으로 직렬화될 React 엘리먼트 트리이고, Testing Library가 그 트리를 렌더해 검사하는 것이 이 하네스에서의 "서버 렌더 출력 관측"이다. (b) 정적 소스 검사(`fetch(` / `useEffect` grep, 매치 0건). **원본 HTTP 응답 바디 문자열을 직접 단언하지는 않는다** — 그것은 브라우저/HTTP 레이어 관측이라 이 하네스 밖이다.

**AC-STOREFRONT-004** — 존재하지 않는 상품은 `notFound()` 경로로 진입한다 (REQ-STOREFRONT-004)
- Given: `getProductDetail("no-such-product")`가 `{ ok: false, status: 404, error: "Product not found" }`를 반환하도록 서비스 계층을 모킹했다
- When: 상세 페이지 컴포넌트를 `no-such-product` id로 호출하고, 별도로 `not-found.tsx`를 렌더한다
- Then: (a) 페이지가 `next/navigation`의 `notFound()`를 **호출한다**. (b) `not-found.tsx` 렌더 결과에 "상품을 찾을 수 없다"는 취지의 안내 문구가 나타난다. (c) 안내 화면 렌더 출력과 페이지·안내 화면 소스 어디에도 오류 스택, 내부 오류 문자열 `Product not found` 원문, 데이터베이스·ORM 관련 정보가 노출되지 않는다.
- 검증 수단: (a) `vi.mock("next/navigation")`으로 `notFound`를 스파이로 대체한 뒤 호출 여부 단언. (b) jsdom + Testing Library `render()` + `screen`. (c) 렌더 출력 텍스트 단언 + 정적 소스 검사.
- **프레임워크 보증(재검증 안 함)**: `notFound()` 호출이 실제 HTTP 404 상태 코드로 번역되는 것은 Next.js App Router 런타임의 동작이다. 페이지 컴포넌트가 제어하는 것은 "`notFound()`를 호출한다"까지이고, 상태 코드 번역은 이 SPEC의 테스트 대상이 아니다.

**AC-STOREFRONT-005** — 인증 없이 열람 가능 (REQ-STOREFRONT-005)
- Given: 존재하는 상품 id의 조회가 성공(`ok: true`)하도록 서비스 계층을 모킹했다
- When: 상세 페이지 컴포넌트를 해당 id로 호출하고, 별도로 라우트 보호 설정을 정적 검사한다
- Then: (a) 페이지가 `notFound()`를 **호출하지 않고** 상품 정보가 포함된 엘리먼트를 반환하며, 그 렌더 결과에 상품명이 나타난다. (b) 상세 페이지·컴포넌트 소스 어디에도 세션/인증 조회나 `redirect()` 호출이 없다. (c) `src/middleware.ts`의 보호 경로 매처에 `/products` 경로가 포함되지 않는다(§4 불변 조건에 따라 이 파일은 변경 0건이다).
- 검증 수단: (a) `notFound` 스파이 미호출 단언 + jsdom + Testing Library `render()`. (b)/(c) 정적 소스 검사.
- **프레임워크 보증(재검증 안 함)**: 예외 없이 렌더된 페이지가 HTTP 200으로 응답되는 것은 Next.js 런타임의 동작이다. 이 AC가 판정하는 것은 "인증을 요구하거나 리다이렉트하는 코드 경로가 없다"까지다.

### 상세 화면 표시 내용

**AC-STOREFRONT-006** — 필수 표시 항목이 모두 보인다 (REQ-STOREFRONT-006)
- Given: `name`, `price`, `description`, `category.name`, `stock`을 가진 상품이 있다
- When: 상세 화면을 렌더링한다
- Then: 상품명, 가격, **설명 전문**(잘림 없이), 카테고리 이름, 재고 가용 상태가 모두 화면에 나타난다.

**AC-STOREFRONT-007** — 가격이 원화 정수 형식으로 표시된다 (REQ-STOREFRONT-007)
- Given: `price`가 정수 `89000`인 상품이 있다
- When: 상세 화면을 렌더링한다
- Then: 화면에 `89,000원`이 표시된다. 소수점(`.00`)이나 구분 기호 없는 원시 숫자(`89000`)로 표시되지 않는다.

**AC-STOREFRONT-008** — 재고 0이면 품절이 명시된다 (REQ-STOREFRONT-008)
- Given: `stock`이 `0`인 상품과 `stock`이 `10`인 상품이 각각 있다
- When: 두 상품의 상세 화면을 각각 렌더링한다
- Then: `stock: 0` 화면에는 품절을 뜻하는 문구가 나타나고, `stock: 10` 화면에는 나타나지 않는다.

**AC-STOREFRONT-009** — 범위 밖 데이터가 노출되지 않는다 (REQ-STOREFRONT-009)
- Given: 상세 화면이 렌더링되어 있다
- When: 렌더 결과와 컴포넌트 소스를 함께 검사한다
- Then: 리뷰 영역, 관련 상품 영역, 재고 변동 이력이 렌더되지 않는다. 카테고리 내부 식별자(`category.id`)와 상품 내부 타임스탬프(`createdAt`/`updatedAt`) 원문이 화면 텍스트로 노출되지 않는다.

### 이미지 갤러리

> **이미지 픽스처 규약**: 실제 상품 이미지 호스팅이 아직 정해지지 않았으므로(plan.md §D), 아래 시나리오의 이미지 URL은 전부 플레이스홀더 서비스 `picsum.photos`의 URL을 사용한다. 이 호스트는 `next.config.ts`의 `images.remotePatterns`에 등록된 유일한 허용 호스트다. 표기를 짧게 하기 위해 아래에서는 `IMG_A` = `https://picsum.photos/seed/a/600/600`, `IMG_B` = `.../seed/b/600/600`, `IMG_C` = `.../seed/c/600/600`로 줄여 쓴다.

**AC-STOREFRONT-010** — 첫 이미지가 최초 대표 이미지다 (REQ-STOREFRONT-010)
- Given: `images`가 `[IMG_A, IMG_B, IMG_C]`인 상품이 있다
- When: 상세 화면을 최초 렌더링한다(아무 것도 클릭하지 않음)
- Then: 대표 이미지 자리에 `IMG_A`가 표시된다.

**AC-STOREFRONT-011** — 썸네일 목록의 존재 조건 (REQ-STOREFRONT-011)
- Given: 이미지가 3장인 상품과 1장인 상품이 각각 있다
- When: 두 상품의 갤러리를 각각 렌더링한다
- Then: 3장인 경우 썸네일 버튼이 정확히 **3개** 나타난다. 1장인 경우 썸네일 목록이 **전혀 렌더되지 않는다**(버튼 0개).

**AC-STOREFRONT-012** — 썸네일 선택 시 대표 이미지 교체와 선택 표시 (REQ-STOREFRONT-012)
- Given: `images`가 `[IMG_A, IMG_B, IMG_C]`인 상품의 갤러리가 렌더링되어 있다
- When: 세 번째 썸네일을 클릭한다
- Then: 대표 이미지가 `IMG_C`로 교체된다. 세 번째 썸네일이 `aria-current="true"`(또는 동등한 선택 상태 속성)를 갖고, 나머지 썸네일은 갖지 않는다. 클릭 전후로 페이지 전체 이동이나 재요청이 발생하지 않는다.

**AC-STOREFRONT-013** — 이미지가 없는 상품은 대체 표시 (REQ-STOREFRONT-013)
- Given: `images`가 빈 배열 `[]`인 상품이 있다
- When: 상세 화면을 렌더링한다
- Then: 예외가 발생하지 않고 대체 표시(placeholder)가 나타난다. 썸네일은 0개이고, 화면에 빈 영역만 남지 않는다.

**AC-STOREFRONT-014** — 금지된 갤러리 기능이 없다 (REQ-STOREFRONT-014 — 정적 검사)
- Given: 갤러리 컴포넌트 소스
- When: 소스를 검사한다
- Then: 확대(zoom/magnif), 라이트박스(lightbox/modal/dialog), 스와이프(swipe/touchstart/touchmove/pan), 자동 재생(setInterval/autoplay/autoPlay)에 해당하는 구현이 존재하지 않는다. 이를 위해 새로 추가된 캐러셀/라이트박스 런타임 의존성이 `package.json`에 없다.

### 접근성 및 반응형

**AC-STOREFRONT-015** — 키보드 조작, 대체 텍스트, 좁은 뷰포트 (REQ-STOREFRONT-015)
- Given: 이미지가 3장인 상품의 상세 화면이 렌더링되어 있다
- When: (a) 각 썸네일을 `getAllByRole("button")`으로 조회해 `focus()`를 주고 활성화하고, (b) 대표 이미지와 각 썸네일의 `alt` 속성을 확인하고, (c) **[수동]** 실제 브라우저의 폭 375px 뷰포트에서 화면을 확인한다
- Then:
  - (a) 각 썸네일이 `button` 역할로 조회되고, `focus()` 후 `document.activeElement`가 해당 썸네일이며, 활성화 시 대표 이미지가 교체된다. (썸네일이 `tabIndex="-1"`이거나 `div`/`span` 등 비-버튼 요소이면 실패한다.)
  - (b) 대표 이미지와 각 썸네일이 상품명을 포함한 비어 있지 않은 `alt` 텍스트를 갖는다.
  - (c) 가로 스크롤이 발생하지 않는다.
- 검증 수단: (a)/(b) jsdom + Testing Library. (a)에서 **네이티브 `<button>`의 Enter/Space → click 변환과 브라우저 포커스 링 렌더링은 프레임워크·플랫폼 보증**이므로 재검증하지 않는다 — 이 SPEC이 자동 판정하는 것은 "썸네일이 포커스 가능한 네이티브 `button`으로 렌더되고 활성화 시 상태가 바뀐다"까지이며, 그것이 plan.md §E가 로빙 tabindex 위젯 대신 네이티브 `<button>`을 택한 이유다.
- **(c)는 자동 검증 대상이 아니다.** jsdom에는 레이아웃 엔진이 없어 요소 폭·스크롤 폭을 계산하지 못하고, 그것을 관측할 수 있는 브라우저 E2E 하네스 도입은 spec.md §3에서 명시적으로 제외했다. (c)는 §5의 **수동 시각 확인 체크리스트**로 이관되며, 자동화된 Definition of Done의 PASS 조건에 포함되지 않는다. 따라서 **AC-015는 (a)+(b)가 통과하면 자동 게이트 기준으로 PASS**이고, (c)의 확인 결과는 별도로 기록된다.

---

## §2. 엣지 케이스

| 케이스 | 기대 동작 | 관련 AC |
|---|---|---|
| `images: []` (빈 배열) | 대체 표시, 예외 없음, 썸네일 0개 | AC-013 |
| `images` 길이 1 | 대표 이미지만, 썸네일 목록 미렌더 | AC-011 |
| 존재하지 않는 상품 id | 404 + 안내 화면, 내부 오류 문자열 미노출 | AC-004 |
| 빈 문자열 id (`/products/`) | 상세 라우트에 매칭되지 않음 — 이 SPEC의 검증 대상 아님(목록 라우트가 없으므로 Next.js 기본 404) | — |
| `stock: 0` | 품절 문구 표시 | AC-008 |
| 매우 긴 `description` | 잘림 없이 전문 표시(자동 판정). 가로 스크롤 없음은 §5 수동 확인 항목 | AC-006, AC-015(c는 수동) |
| `price: 0` | `0원`으로 표시(음수·소수점 없음) | AC-007 |
| 개별 이미지 URL 깨짐 | **범위 밖** — plan.md §K R5의 수용된 잔여 위험 | — |
| 허용 목록 밖 호스트의 이미지 URL | **범위 밖** — 현재 허용 호스트는 `picsum.photos` 하나이며, 실제 상품 이미지 호스팅 확정 시 `next.config.ts`의 `remotePatterns` 갱신이 선행되어야 한다(plan.md §D-2 후속 항목) | — |

---

## §3. 품질 게이트

| 게이트 | 명령 | 기준 |
|---|---|---|
| 타입 검사 | `npm run typecheck` | 오류 0 |
| 린트 | `npm run lint` | 오류 0 |
| 테스트 | `npm run test` | 전량 통과. **기존 테스트 회귀 0건** |
| 커버리지 | `npm run test:coverage` | lines ≥ 85, functions ≥ 85, branches ≥ 80, statements ≥ 85 (`.tsx` 포함) |
| 빌드 | `npm run build` | 성공 (종료 코드 0) |
| LSP 게이트(run) | `quality.yaml` `lsp_quality_gates.run` | errors 0 / type-errors 0 / lint-errors 0 |

빌드 게이트는 CI가 아닌 **수동 실행**이다 — `.github/workflows/ci.yml`의 실행 단계에 `npm run build`가 없다. 이 SPEC이 처음 도입하는 빌드 타임 툴체인(PostCSS + Tailwind v4)의 회귀는 위 게이트를 손으로 돌려야 잡힌다.

### 자동 게이트 밖의 확인 항목

아래는 위 게이트 명령으로 판정되지 않으며, **자동 Definition of Done의 PASS 조건이 아니다**. §5의 수동 확인 체크리스트에서 결과를 기록한다.

| 항목 | 확인 방법 | 왜 자동화하지 않는가 |
|---|---|---|
| AC-015(c) 375px 뷰포트 가로 스크롤 없음 | 브라우저 개발자 도구에서 뷰포트 폭 375px로 상세 화면 확인 | jsdom에 레이아웃 엔진이 없어 폭·스크롤을 계산하지 못한다. 이를 관측할 브라우저 E2E 하네스는 spec.md §3에서 명시적으로 제외했다 |

---

## §4. 불변 조건 (PRESERVE)

구현이 **바꾸지 않았음**을 증거로 확인해야 하는 항목이다.

| 항목 | 검증 방법 | 기준 |
|---|---|---|
| 카탈로그 도메인 미변경 | `git diff --stat` 범위 확인 | `src/features/catalog/**` 변경 0건 |
| 카탈로그 API 미변경 | 동일 | `src/app/api/products/**` 변경 0건 |
| 데이터 스키마 미변경 | 동일 | `prisma/schema.prisma` 변경 0건 |
| 인증/장바구니 미변경 | 동일 | `src/lib/auth/**`, `src/app/api/auth/**`, `src/features/cart/**`, `src/middleware.ts` 변경 0건 |
| 기존 테스트 환경 유지 | `vitest.config.ts` 확인 | `test.environment`가 여전히 `"node"` (jsdom은 파일 단위 지시자로만 적용) |
| 도메인 진입 경로 유지 | 소스 검사 | 페이지가 리포지토리(`product-repository`)를 직접 호출하지 않고 `getProductDetail()`로만 진입 (`product-service.ts`의 `@MX:ANCHOR` 불변 조건) |
| 서브에이전트 사용자 질의 없음 | `grep -rn 'AskUserQuestion' src/app/products src/components` | 매치 0건 |

---

## §5. Definition of Done

### 자동 판정 (이 목록이 통과 조건이다)

- [ ] AC-STOREFRONT-001 ~ 015 전부 PASS — 각 AC의 `검증 수단:` 줄에 적힌 명령·단언으로 판정한다. **AC-015(c)(375px 가로 스크롤)는 이 목록에서 제외되며**, 아래 수동 확인 체크리스트로 넘어간다. 부분 통과는 근거와 함께 PARTIAL로 기록
- [ ] §3 품질 게이트 전 항목 통과, 각 항목의 실제 명령 출력이 `progress.md` §E.2에 기록됨
- [ ] §4 불변 조건 전 항목 확인
- [ ] plan.md §C(스타일링 = Tailwind CSS v4) 확정 사항이 구현에 반영됨 — `postcss.config.mjs` 존재, `globals.css`에 `@import "tailwindcss";`, `tailwind.config.js` 미생성
- [ ] plan.md §D(이미지 = `next/image`) 확정 사항이 구현에 반영됨 — `next.config.ts`의 `images.remotePatterns`에 `picsum.photos`가 등록되어 있고, 사용된 이미지 URL이 전부 이 허용 호스트 안에 있음
- [ ] `product-service.ts`의 `@MX:ANCHOR` fan-in 주석이 상세 페이지를 포함하도록 갱신됨 (plan.md M5)
- [ ] spec.md §3 Out of Scope 항목이 하나도 구현되지 않았음을 확인

### 수동 시각 확인 (자동 DoD에 포함되지 않음)

이 항목들은 **자동 게이트가 판정하지 않는다**. 결과를 `progress.md` §E.2에 관측 그대로 기록하되, 미확인 상태가 자동 DoD를 막지는 않는다. 여기에 "자동으로 통과했다"고 적는 것이 이 절이 막으려는 실패다.

- [ ] AC-015(c) — 브라우저 뷰포트 폭 375px에서 상세 화면에 가로 스크롤이 생기지 않음 (확인자·확인 일자·관측 결과를 기록)
- [ ] 갤러리 썸네일에 키보드로 Tab 이동 시 포커스 표시가 눈으로 보임 (AC-015(a)의 자동 판정 범위 밖 — 포커스 링의 실제 렌더)

### 프레임워크 보증 (이 SPEC이 재검증하지 않음)

아래는 코드가 아니라 Next.js/브라우저가 보증하는 동작이며, 위 두 목록 어디에도 통과 조건으로 들어가지 않는다. 근거는 각 AC의 해당 절에 기록되어 있다.

- `notFound()` 호출 → HTTP 404 상태 코드 번역 (AC-004)
- 예외 없는 렌더 → HTTP 200 응답 (AC-005)
- `metadata` 객체 → `<title>` / `<meta name="description">` 직렬화 (AC-002)
- 네이티브 `<button>`의 Enter/Space → click 변환 (AC-015(a))
