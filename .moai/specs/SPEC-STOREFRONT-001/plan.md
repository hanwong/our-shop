# Implementation Plan: SPEC-STOREFRONT-001 — 상품 상세 페이지 UI 및 이미지 갤러리

> 섹션 순서는 **되돌리기 어려운 결정 순**이다. §A~§E는 나중에 바꾸면 비용이 큰 결정(선행 의존성, 데이터 소비 방식, 스타일링, 이미지 렌더링, 화면 상호작용)이고, §F 이후는 구조·기계적 작업이다. 검토 시간을 앞쪽에 쓰면 된다.

---

## §A. 선행 의존성 — 루트 문서 셸이 없다 (검증된 사실)

이 SPEC의 가장 중요한 전제이며, 추정이 아니라 저장소를 직접 확인한 결과다.

| 확인 항목 | 명령 | 관측된 출력 |
|---|---|---|
| 루트 레이아웃 | `ls -la src/app/layout.tsx` | `No such file or directory` |
| 루트 페이지 | `ls -la src/app/page.tsx` | `No such file or directory` |
| 모든 `.tsx` | `find src -name "*.tsx"` | 출력 없음 (0건) |
| 모든 CSS | `find . -name "*.css" -not -path "./node_modules/*"` | 출력 없음 (0건) |
| Next 설정 | `ls next.config.*` | `no matches found` (부재) |
| `src/app` 하위 | `ls -R src/app` | `api` 디렉터리만 존재 |

**결론: 루트 문서 셸 구축은 이 SPEC의 선행 산출물이다(M1).** Next.js App Router는 루트 레이아웃 없이 어떤 라우트 세그먼트도 렌더링하지 못하므로, 상세 페이지만 만들어서는 화면이 뜨지 않는다.

셸의 최소 구성(REQ-STOREFRONT-001/002 대응):

| 산출물 | 역할 | 최소 범위 |
|---|---|---|
| `src/app/layout.tsx` | `<html lang="ko">` + `<body>`, 폰트 적용, 전역 스타일 import, `export const metadata` | 헤더·푸터·내비게이션 **없음** |
| `src/app/globals.css` | Tailwind 진입점(`@import "tailwindcss";`) + 최소 기본 타이포그래피 | 디자인 토큰 체계 **없음** (`@theme` 커스터마이즈 안 함) |
| `postcss.config.mjs` | Tailwind v4 PostCSS 플러그인 등록 (§C 결정) | 플러그인 한 줄만 |
| `src/app/page.tsx` | 홈 스텁 — 상세 화면 진입 링크 한 줄 | 콘텐츠 설계 **없음** (spec.md §4의 명시적 예외) |
| `next.config.ts` | `next/image` 원격 호스트 허용 목록 (§D 결정 — 확정) | `images.remotePatterns`만 |

폰트는 `next/font/local` 대신 `next/font/google`을 쓰되, 추가 의존성은 없다(`next` 패키지에 내장). 한국어 본문 가독성을 위해 라틴 폰트 + 시스템 한글 폰트 폴백 스택으로 충분하며, 웹폰트 서브셋 최적화는 이번 범위가 아니다.

---

## §B. 데이터 소비 방식 — 서버 컴포넌트가 서비스 계층을 직접 호출한다

가장 되돌리기 어려운 결정이다. 세 가지 후보를 비교했다.

| 후보 | 방식 | 판정 |
|---|---|---|
| B-1 **(채택)** | 서버 컴포넌트에서 `getProductDetail(productId)` 직접 호출 | 채택 |
| B-2 | 서버 컴포넌트에서 `fetch("http://localhost:3000/api/products/:id")` | 기각 |
| B-3 | 클라이언트 컴포넌트에서 `useEffect` + `fetch` | 기각 |

**B-2 기각 근거**: 자기 자신의 HTTP 엔드포인트를 서버에서 다시 호출하는 것은 프로세스 안에서 끝날 일에 네트워크 왕복을 한 번 더 얹는다. 절대 URL을 만들기 위한 환경변수(`NEXT_PUBLIC_BASE_URL` 등)가 새로 필요해지고, 타입이 `any`/`unknown`으로 떨어져 `ProductDetail` 계약을 컴파일 타임에 잃는다. `product.md`의 카탈로그 p95 300ms 제약에도 불리하다.

**B-3 기각 근거**: REQ-STOREFRONT-003(서버 렌더링된 완성 HTML)을 정면으로 위반한다. 모바일 우선 제품에서 최초 화면에 로딩 스피너를 먼저 보여주는 선택은 근거가 없다.

**B-1의 계층 정합성**: `structure.md`의 레이어링 원칙은 `app/`이 "라우팅과 화면 조립"을, `features/`가 도메인 로직을 담당한다고 규정한다. `app/ → features/` 방향 호출은 허용된 방향이다. 또한 `src/features/catalog/services/product-service.ts`의 `@MX:ANCHOR`는 "app 계층은 리포지토리를 직접 호출하지 않고 `listProducts()` / `getProductDetail()`로만 카탈로그 도메인에 진입한다"는 불변 조건을 선언하고 있으며, B-1은 이 불변 조건을 **지키는** 진입 방식이다.

호출 형태(Next.js 15에서 `params`는 Promise):

```
async function Page({ params }: { params: Promise<{ productId: string }> })
  → const { productId } = await params
  → const result = await getProductDetail(productId)
  → result.ok === false 이면 notFound()
  → result.data(ProductDetail)를 프레젠테이션 컴포넌트에 전달
```

`getProductDetail`은 `{ ok: false, status: 404, error: "Product not found" }` 만 실패로 반환한다(400 분기는 도달 불가 — 라우트 세그먼트는 항상 문자열). 따라서 실패 분기는 404 하나뿐이고, `error` 문자열은 **화면에 노출하지 않는다**(REQ-STOREFRONT-004).

**기존 API는 그대로 둔다.** `GET /api/products/:id`(SPEC-CATALOG-001 M4)는 삭제도 수정도 하지 않는다. 페이지와 API가 같은 서비스 함수를 공유하므로 404 의미가 두 곳에서 갈라질 수 없다.

**run-phase에서 갱신할 것**: `product-service.ts`의 `@MX:ANCHOR` 주석은 현재 fan-in 대상을 "두 개의 공개 라우트 핸들러"로만 기술하고 있다. 상세 페이지가 세 번째 진입점이 되므로 주석을 갱신해야 한다(mx-tag-protocol.md — ANCHOR는 호출자 구성이 바뀌면 갱신 대상).

---

## §C. 스타일링 방식 — **Tailwind CSS로 확정**

사용자 결정으로 **Tailwind CSS**를 채택한다. `tech.md`의 "프런트엔드 스타일링 — 추천(선택): Tailwind CSS" 항목이 이 SPEC에서 확정 상태로 승격된다. CSS Modules 대안은 **더 이상 검토 대상이 아니며** 이 계획에서 제거한다.

이 결정은 프로젝트 전체의 스타일링 방향을 고정한다(두 번째, 세 번째 화면이 첫 화면의 방식을 따라간다). 그래서 첫 UI SPEC인 이 SPEC에서 사용자가 직접 확정했다.

### C-1. 설치 구성 — Tailwind v4 (CSS-first)

Tailwind v4의 Next.js 통합 절차를 따른다. **v3 시절의 `npx tailwindcss init` + `tailwind.config.js` + `@tailwind base/components/utilities` 3종 디렉티브 패턴은 사용하지 않는다** — v4에서 대체된 방식이다.

| 항목 | 내용 |
|---|---|
| 추가 devDependency | `tailwindcss`, `@tailwindcss/postcss`, `postcss` (3개) |
| 설정 파일 | `postcss.config.mjs` **1개뿐** — `{ plugins: { "@tailwindcss/postcss": {} } }` |
| `tailwind.config.js` | **생성하지 않는다.** v4는 CSS-first 설정이라 config 파일이 필수가 아니며, 이 SPEC은 `@theme` 커스터마이즈도 하지 않는다 |
| CSS 진입점 | `src/app/globals.css` 최상단에 `@import "tailwindcss";` 한 줄 |
| content/purge 설정 | **불필요** — v4는 소스 파일을 자동 탐지한다 |

`globals.css`는 이 진입 한 줄 + 한국어 본문 가독성을 위한 최소한의 기본 스타일까지만 담는다. 디자인 토큰 체계(`@theme` 블록)는 spec.md §3에서 제외했으므로 만들지 않는다.

### C-2. 계획에 미치는 영향

M1(루트 문서 셸)에 Tailwind 설치 + `postcss.config.mjs` 생성이 포함된다. 나머지 계획(§B 데이터 소비, §E 갤러리 상호작용, §F 컴포넌트 경계, §H 테스트 하네스)은 이 결정에 영향받지 않는다 — 화면 마크업의 클래스 표기만 달라진다.

§H의 "추가 devDependency는 2개로 제한한다"는 **테스트 하네스 한정** 제약이며(`jsdom`, `@testing-library/react`), 여기의 Tailwind 3개는 그 제약과 별개인 M1 스타일링 의존성이다.

---

## §D. 이미지 렌더링 방식 — **`next/image` + 플레이스홀더 호스트 허용 목록으로 확정**

사용자 결정으로 **`next/image`** 를 채택하고, `images.remotePatterns` 허용 목록은 당장 **무료 플레이스홀더 이미지 서비스**로 채운다. 일반 `<img>` 대안은 제거한다.

`Product.images`는 `String[]`(이미지 URL)이지만 이 저장소에는 시드 데이터가 없고(`prisma/` 하위에 `seed` 파일 없음) 실제 상품 이미지 호스팅도 아직 정해지지 않았다. 그렇다고 `<img>`로 시작해 나중에 교체하는 방안을 택하지는 않는다 — `next/image`는 `width`/`height` 또는 `fill` + 부모 `position` 요구사항 때문에 마크업이 달라져 나중 교체가 단순 치환이 아니고, 실제 호스트가 정해질 때까지 그 비용을 미룰 이유가 없다. 자동 리사이즈·`srcset`·lazy loading은 모바일 우선 + p95 목표에 직접 기여한다.

### D-1. `next.config.ts` 설계

```
next.config.ts
  → images.remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
    ]
```

`remotePatterns`만 담고 다른 Next 설정은 넣지 않는다. 미등록 호스트의 URL을 `next/image`에 넘기면 런타임 오류가 나므로, 개발·테스트에 쓰는 샘플 이미지 URL은 반드시 이 허용 목록 안의 호스트여야 한다.

### D-2. 이것은 **플레이스홀더 허용 목록**이다 (임시 상태 명시)

`picsum.photos`는 실제 상품 이미지 호스트가 아니라, **실제 호스팅이 정해질 때까지 화면이 굴러가게 하는 임시 허용 목록**이다. 실제 상품 이미지 호스팅(자체 S3/CDN, 이미지 서비스 등)이 정해지면 이 목록은 **교체 또는 확장**된다.

**후속 항목 (별도 SPEC 불필요)**: 실제 상품 이미지 호스팅이 확정되는 시점에 `next.config.ts`의 `images.remotePatterns`에 해당 호스트를 추가하거나 `picsum.photos`를 대체한다. 설정 몇 줄 수준의 변경이므로 별도 SPEC 없이 그 시점의 작업에 포함하면 된다. 다만 **그 변경 전에 실제 상품 이미지 URL을 데이터에 넣으면 화면이 깨진다**는 사실을 이 문서가 기록으로 남긴다.

### D-3. 샘플 / 시드 데이터 스토리

이 SPEC은 시드 데이터를 만들지 않는다(스키마·도메인 미변경은 §L의 제약이다). 개발 중 손으로 확인할 때나 테스트 픽스처를 만들 때 쓰는 이미지 URL은 **`https://picsum.photos/...` 형태의 플레이스홀더 URL**로 통일한다. `acceptance.md` §1의 갤러리 시나리오도 같은 형태의 URL을 픽스처로 사용한다.

---

## §E. 이미지 갤러리 상호작용 설계

의도적으로 작다. REQ-STOREFRONT-014가 확대·라이트박스·스와이프·자동재생을 전부 금지하고 있으므로, 남는 것은 **"큰 이미지 한 장 + 썸네일로 전환"** 하나다.

```
┌─────────────────────────┐
│                         │
│      대표 이미지         │   ← images[selectedIndex]
│                         │
└─────────────────────────┘
┌───┐ ┌───┐ ┌───┐ ┌───┐
│ 1 │ │ 2 │ │ 3 │ │ 4 │      ← <button> 목록, 선택된 것에 aria-current="true"
└───┘ └───┘ └───┘ └───┘
  ▲ 선택됨(테두리 강조)
```

동작 규칙:

| 상황 | 화면 | 대응 요구사항 |
|---|---|---|
| `images.length === 0` | 대체 표시 박스("이미지 준비 중"), 썸네일 없음 | REQ-013 |
| `images.length === 1` | 대표 이미지만, 썸네일 목록 **렌더 안 함** | REQ-011 |
| `images.length >= 2` | 대표 이미지 + 썸네일 n개 | REQ-011 |
| 썸네일 선택 | 대표 이미지 교체, 선택 썸네일에 `aria-current="true"` + 시각적 강조 | REQ-012 |

상태는 `useState<number>(0)` 하나뿐이다. URL 쿼리 파라미터로 선택 인덱스를 동기화하지 않는다 — 이미지 선택은 공유·북마크 대상이 아니고, 라우터 왕복만 늘린다.

**키보드 접근성은 네이티브 `<button>`으로 해결한다**(REQ-015). 썸네일마다 arrow-key 로빙 tabindex 위젯을 직접 구현하는 방안은 채택하지 않는다: 4~5개짜리 목록에 ARIA 탭 패턴을 손으로 구현하면 코드가 몇 배로 늘고 그 자체가 접근성 버그의 출처가 된다. `<button>`은 Tab 이동, Enter/Space 활성화, 포커스 링을 브라우저에서 그대로 받는다.

**타입 주의사항**: `tsconfig.json`에 `noUncheckedIndexedAccess: true`가 켜져 있다. `images[selectedIndex]`의 타입은 `string | undefined`이므로 비단언(non-null assertion) 없이 분기 처리해야 한다. 이 제약이 오히려 REQ-013(빈 배열)의 처리를 컴파일러가 강제해 준다.

개별 이미지의 로드 실패(URL은 있으나 404)에 대한 대체 처리는 이번 범위에 넣지 않는다. REQ-013이 다루는 것은 "이미지가 없는 상품"이지 "깨진 URL"이 아니다 — 잔여 위험으로 §K에 기록한다.

---

## §F. 컴포넌트 구조와 서버/클라이언트 경계

세 조각으로 나눈다. 나누는 이유는 재사용이 아니라 **테스트 가능성**이다(§K R2 참고).

| 컴포넌트 | 위치 | 종류 | 책임 | 테스트 |
|---|---|---|---|---|
| `Page` | `src/app/products/[productId]/page.tsx` | 서버(async) | `params` 해제 → 서비스 호출 → 404 분기 → 뷰에 전달. **얇은 데이터 어댑터** | 서비스 모킹 + `notFound` 스파이. 성공 시 미호출·상품명 렌더, 실패 시 호출 (AC-003/004/005) |
| `ProductDetailView` | `src/components/product/ProductDetailView.tsx` | 서버(순수) | `ProductDetail`을 받아 이름·가격·설명·카테고리·재고를 렌더. 데이터 접근 없음 | props 주입 후 `render()` + `screen` 단언 (AC-006~009) |
| `ProductGallery` | `src/components/product/ProductGallery.tsx` | **클라이언트**(`"use client"`) | 선택 상태를 가진 갤러리. `images: string[]`, `productName: string`만 받음 | 0장/1장/n장 + 썸네일 전환 + role/alt/focus 단언 (AC-010~013, 015a/b) |
| `NotFound` | `src/app/products/[productId]/not-found.tsx` | 서버 | 404 안내 화면 | `render()` 후 안내 문구 존재 + 내부 오류 문자열 미노출 (AC-004) |
| `RootLayout` | `src/app/layout.tsx` | 서버 | `<html lang="ko">` + `<body>` + `globals.css` import + `export const metadata` | **최소 스모크 1개** — 반환 엘리먼트 트리의 `html` prop `lang === "ko"`, `body` 존재, `metadata.title`/`.description` 비어 있지 않음 (AC-001/002) |
| `HomePage`(스텁) | `src/app/page.tsx` | 서버 | 상세 화면 진입 링크 한 줄 | **최소 스모크 1개** — `render()` 후 링크가 1개 이상 존재하고 `href`가 `/products/`로 시작 |

**셸 두 파일(`layout.tsx` / 홈 스텁 `page.tsx`)의 테스트는 의도적으로 최소다.** 각각 테스트 1개, 단언 2~3줄까지다. 두 파일은 로직이 없는 얇은 셸이라 그 이상 설계할 것이 없고, 커버리지 임계값을 통과시키는 데도 그 정도면 충분하다(§K R1). "이왕 테스트 쓰는 김에" 스냅샷·메타데이터 전 필드·접근성 감사를 붙이는 것은 이 SPEC의 §L 안티패턴에 해당한다.

`RootLayout`은 DOM에 마운트하지 않고 **반환 엘리먼트 트리를 직접 검사**한다 — `<html>`/`<body>`를 jsdom 컨테이너(`div`) 안에 중첩 마운트하면 React가 경고를 내며, 이 AC가 확인하려는 것은 마운트 결과가 아니라 셸이 선언한 속성이기 때문이다.

경계를 이렇게 그은 이유:

- **클라이언트 경계를 갤러리로 좁힌다.** 상태를 가진 것은 갤러리뿐이다. 페이지 전체에 `"use client"`를 붙이면 설명 텍스트까지 클라이언트 번들에 들어간다.
- **서버→클라이언트 props는 직렬화 가능해야 한다.** `string[]`과 `string`만 넘기므로 문제없다. `ProductDetail` 객체 전체를 넘기지 않는 것도 같은 이유 + 갤러리가 알 필요 없는 정보를 주지 않기 위해서다.
- **`ProductDetailView`를 분리하면 순수 함수로 테스트할 수 있다.** async 서버 컴포넌트는 Testing Library로 직접 렌더하기 까다롭지만, props를 받아 JSX를 반환하는 순수 컴포넌트는 그냥 렌더된다.

`src/components/product/` 디렉터리는 `structure.md`가 제안한 `components/product/`(상품 도메인 UI) 위치를 그대로 따른다.

---

## §G. 라우트 위치 — `(shop)` 그룹은 지금 만들지 않는다

`structure.md`는 `app/(shop)/products/[productId]/page.tsx`를 제안한다. 이번에는 **`src/app/products/[productId]/page.tsx`** 로 만든다.

라우트 그룹 `(shop)`의 존재 이유는 그룹 전용 레이아웃(쇼핑몰 공통 헤더/푸터)을 붙이는 것인데, 그 레이아웃은 spec.md §3에서 명시적으로 제외했다. 지금 빈 그룹을 만들면 아무 것도 하지 않는 디렉터리 한 겹만 남는다.

**나중 이전 비용은 0에 가깝다**: 라우트 그룹은 괄호 이름이 URL에 반영되지 않으므로, 공통 레이아웃을 도입하는 SPEC에서 디렉터리를 `(shop)/` 아래로 옮겨도 `/products/{id}` 주소는 그대로다. 되돌리기 쉬운 결정이라 지금 결정을 미룬다.

---

## §H. 테스트 하네스 확장 (기계적 작업)

현재 `vitest.config.ts`는 컴포넌트 테스트를 실행할 수 없다. 확인된 제약:

| 현재 설정 | 문제 |
|---|---|
| `environment: "node"` | DOM 없음 → 렌더 불가 |
| `include: ["tests/**/*.test.ts"]` | `.tsx` 테스트 파일이 수집되지 않음 |
| `coverage.include: ["src/**/*.ts"]` | `.tsx` 소스가 커버리지에서 누락 |

변경 계획 — **기존 노드 테스트에 영향을 주지 않는 방향으로만** 바꾼다.

1. `environment`는 `"node"`로 **유지한다.** 컴포넌트 테스트 파일 상단에 파일 단위 지시자 `// @vitest-environment jsdom`를 붙인다. 전역 환경을 jsdom으로 바꾸면 기존 300여 개 노드 테스트 전부가 다른 환경에서 돌게 되며, 그건 이 SPEC이 건드릴 범위가 아니다.
2. `include`에 `tests/**/*.test.tsx`를 추가한다.
3. `coverage.include`에 `src/**/*.tsx`를 추가한다.
4. `esbuild: { jsx: "automatic" }`를 추가해 JSX를 변환한다. `@vitejs/plugin-react`는 **도입하지 않는다** — Fast Refresh는 테스트에서 쓸모가 없고, vitest 내장 esbuild가 JSX 변환을 처리한다.

추가 devDependency는 **2개로 제한한다**: `jsdom`, `@testing-library/react`. `@testing-library/jest-dom`은 넣지 않는다 — `getByRole` 계열은 대상이 없으면 스스로 예외를 던지므로 별도 매처 없이도 단언이 성립한다.

⚠️ 3번의 부수 효과: `.tsx`가 커버리지 대상이 되면 기존 임계값(lines 85 / functions 85 / branches 80 / statements 85)이 신규 컴포넌트에도 적용된다. 이건 의도된 것이며(TRUST 5 Tested), §F의 컴포넌트 분리 + §F 표의 **6개 산출물 전부에 테스트를 붙인 것**이 이 임계값을 달성 가능하게 만드는 장치다. `quality.yaml`의 `constitution.coverage_exemptions.enabled: false`이므로 커버리지 면제 경로는 없다 — 셸 파일이라고 테스트를 생략할 수 없고, 그래서 `layout.tsx`와 홈 스텁도 §F 표에 산출물로 올라가 있다.

### H-5. 검증 수단 선언 — 각 AC를 무엇으로 판정하는가

이 하네스로 **관측 가능한 것과 불가능한 것의 경계**를 여기서 못 박는다. acceptance.md가 요구하는 판정을 이 하네스가 실제로 수행할 수 있어야 하기 때문이다.

이 SPEC이 갖는 판정 수단은 정확히 넷이다.

| # | 수단 | 관측 가능한 것 | 관측 불가능한 것 |
|---|---|---|---|
| V1 | jsdom + `@testing-library/react` `render()` / `screen` / `fireEvent` | 렌더된 엘리먼트 트리, 텍스트, role, `alt`, `className` 문자열, `document.activeElement`, 상태 변화 후 재렌더 결과 | **계산된 CSS**, 요소 폭·높이, 스크롤 발생 여부 (레이아웃 엔진 없음) |
| V2 | 반환 엘리먼트 트리 / export 객체 직접 검사 | `RootLayout`이 반환한 `html`의 props, `export const metadata`의 필드 | HTML 직렬화 결과 |
| V3 | 정적 소스 검사(grep / 소스 읽기) | 금지 패턴 부재(`fetch(`, `useEffect`, zoom/lightbox/swipe/autoplay), 설정 파일 존재·내용, 의존성 목록 | 런타임 동작 |
| V4 | `npm run build` / `typecheck` / `lint` / `test:coverage` 종료 코드 | 빌드·타입·린트·커버리지 통과 여부 | HTTP 응답 상태 코드, 렌더 픽셀 |

**HTTP 응답 계층은 어떤 수단으로도 관측하지 않는다.** 브라우저 E2E 하네스를 도입하지 않기로 spec.md §3에서 확정했기 때문이다. 그래서 HTTP 상태를 요구하던 AC들은 **페이지 컴포넌트가 실제로 제어하는 지점**으로 판정 위치를 옮겼다:

| AC | 원래 요구 | 이 하네스에서의 판정 지점 | 수단 |
|---|---|---|---|
| AC-004 | HTTP 404 | 페이지가 `notFound()`를 **호출한다** (`vi.mock("next/navigation")` 스파이) + `not-found.tsx`가 안내 문구를 렌더한다 | V1 + V3 |
| AC-005 | HTTP 200 + 리다이렉트 없음 | 페이지가 `notFound()`를 **호출하지 않고** 상품명을 렌더한다 + 인증 조회·`redirect()` 코드 경로 부재 | V1 + V3 |
| AC-003 | 자바스크립트 실행 전 원본 HTML | 서버 컴포넌트가 반환한 트리를 `render()` 했을 때 상품명이 이미 존재 + 클라이언트 데이터 로딩 코드 부재 | V1 + V3 |
| AC-001 | Tailwind가 "실제 스타일로 적용" | 렌더 출력의 `className`에 의도한 유틸리티 토큰 존재 + `npm run build` 성공 | V1 + V4 |
| AC-015(c) | 375px 뷰포트 가로 스크롤 없음 | **자동 판정 불가** → 수동 시각 확인 항목으로 이관 | — |

**프레임워크 보증으로 남기는 것**: `notFound()` → 404, 정상 렌더 → 200, `metadata` 객체 → `<title>`/`<meta>` 직렬화, 네이티브 `<button>`의 Enter/Space → click. 이들은 Next.js·브라우저가 보증하며 이 SPEC의 테스트가 재검증하지 않는다. 페이지 컴포넌트가 HTTP 상태 코드를 직접 정하지 않기 때문에, 그것을 이 SPEC의 통과 조건으로 두면 "선언은 했는데 판정할 수단이 없는" 상태가 된다.

**수동 확인으로 남기는 것**: AC-015(c) 하나뿐이다. 이것을 자동화하려면 브라우저 하네스(Playwright 등)가 필요하고 그것은 spec.md §3의 명시적 제외 항목이므로, **자동 커버리지가 있는 척하지 않고 acceptance.md §5의 수동 체크리스트에 정직하게 남긴다.** 자동 Definition of Done의 PASS 조건에는 들어가지 않는다.

**빌드 게이트는 CI에 없다**: `.github/workflows/ci.yml`의 실행 단계는 `npm ci` / `prisma:generate` / `lint` / `typecheck` / `prisma:validate` / `test:coverage` 여섯 개이고 `npm run build`가 없다. 이 SPEC이 처음 들여오는 빌드 타임 툴체인(PostCSS + Tailwind v4 + `next/font/google` 웹폰트 페치)의 회귀는 CI가 잡아주지 않으므로, V4의 빌드 게이트는 **수동 실행**임을 acceptance.md §3에도 함께 적었다. 잔여 위험으로 §K R7에 등재한다.

---

## §I. Tier 판정 및 Conditional Design Route 판정

### Tier: M

`spec-workflow.md` § SPEC Complexity Tier 기준으로 판정했다.

| 축 | 추정 | Tier |
|---|---|---|
| 변경 파일 수 | 16개 (아래 분해) | M 상한(15) **+1 — 경계 초과, 아래 판단 근거 참고** |
| LOC | 400~700 | M (300~1000) |
| 요구사항 수 | 15개 | M 상한 16 이내 |
| 수락 기준 수 | 15개 | M 상한 16 이내 |

파일 분해(§A 표 5개 셸 산출물 + §F 표 6개 컴포넌트와 정합):

| 구분 | 파일 | 수 |
|---|---|---|
| 셸·설정 (M1) | `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `postcss.config.mjs`, `next.config.ts` | 5 |
| 라우트 (M3) | `src/app/products/[productId]/page.tsx`, `.../not-found.tsx` | 2 |
| 컴포넌트 (M3·M4) | `ProductDetailView.tsx`, `ProductGallery.tsx` | 2 |
| 테스트 | 셸(레이아웃+홈) / 상세 페이지+not-found / `ProductDetailView` / `ProductGallery` — **4개 파일로 묶어 작성** | 4 |
| 기존 파일 수정 | `package.json`(M1 Tailwind 3종 + M2 테스트 2종), `vitest.config.ts`(§H), `product-service.ts`(M5 `@MX:ANCHOR` 주석) | 3 |
| **합계** | | **16** |

**M/L 경계에 대한 솔직한 기록**: 보정된 파일 수 16개는 Tier M 가이드(5~15)를 하나 넘는다. 그럼에도 M을 유지하는 판단 근거는 셋이다. (1) `spec-workflow.md`가 이 수치를 "scope guidance"로 규정하며 강제 기준이 아니고, LOC(400~700)는 M 구간 한가운데다. (2) 16개 중 3개는 신규 산출이 아니라 기존 파일의 소규모 수정(의존성 3줄, vitest 설정 3줄, 주석 1문단)이고, 4개는 테스트 파일이다 — 신규 구현 산출물은 9개다. (3) 아래 design route가 적용되므로 Tier L의 `design.md`가 담당했을 설계 심화를 design phase 산출물이 대신 수행한다. 즉 L로 올려도 얻는 것이 중복된다. 이 SPEC이 프로젝트의 스타일링 방식·컴포넌트 배치·테스트 하네스를 처음 정한다는 "constitutional" 성격까지 더하면 L 주장이 불가능하지는 않으나, 위 셋을 근거로 M을 유지하고 그 경계성을 여기 기록으로 남긴다.

### Route: `plan → design → run` (Conditional Design Route 적용)

`spec-workflow.md` § Conditional Design Route의 UI-surface 판정 기준은 **두 갈래 중 하나만 만족하면 된다**:

> explicit frontend-component / view / page deliverable in `acceptance.md`, **OR** `tier: L` + a frontend module

**첫 번째 갈래가 만족된다.** `acceptance.md`가 페이지(`/products/{productId}`)와 프런트엔드 컴포넌트(`ProductGallery`, `ProductDetailView`)를 명시적 산출물로 검증하기 때문이다. 따라서 Tier가 M이어도 design route는 적용된다 — 두 번째 갈래(`tier: L` + frontend module)는 만족하지 않지만, 판정에 필요하지 않다.

**이 SPEC 위임 범위에서 design phase는 실행하지 않는다.** design phase는 plan-audit PASS + Implementation Kickoff Approval 이후, run-phase 첫 구현 커밋 이전에 `manager-design`이 수행한다. 여기서는 판정만 기록한다.

design phase가 다룰 것으로 예상되는 항목(§C 스타일링 = Tailwind, §D 이미지 = `next/image` 확정을 전제로): Tailwind 유틸리티 기준의 상세 화면 레이아웃 그리드(모바일/데스크톱 분기점), 갤러리 대표 이미지의 종횡비, 품절 상태의 시각적 처리, 로딩 상태(`loading.tsx`) 도입 여부.

---

## §J. 마일스톤 (우선순위 기준, 소요 시간 없음)

의존성 순서다. `quality.yaml`의 `development_mode: tdd` + `test_first_required: true`에 따라 각 마일스톤은 RED → GREEN → REFACTOR로 진행한다. 그래서 하네스(M2)가 화면 구현(M3)보다 앞선다.

| # | 우선순위 | 내용 | 완료 신호 |
|---|---|---|---|
| **M1** | High | 루트 문서 셸 — Tailwind v4 설치(`tailwindcss`/`@tailwindcss/postcss`/`postcss`) + `postcss.config.mjs`, `globals.css`(`@import "tailwindcss";`), `layout.tsx`(lang/폰트/전역 스타일/메타데이터), 홈 스텁 `page.tsx`, `next.config.ts`(`images.remotePatterns` = `picsum.photos`) | `npm run build` exit 0 (V4). `RootLayout` 반환 트리의 `html` prop `lang === "ko"` + `metadata.title`/`.description` 비어 있지 않음 (V2). 홈 스텁 렌더 시 `/products/`로 시작하는 링크 1개 이상 (V1). 렌더 출력 `className`에 의도한 Tailwind 유틸리티 토큰 포함 (V1) |
| **M2** | High | 테스트 하네스 확장 — `jsdom` + `@testing-library/react` 설치, `vitest.config.ts`의 include/coverage/esbuild 조정 | 기존 테스트 전량 통과(회귀 0), `.tsx` 테스트 1개가 수집·실행됨. M1의 셸 테스트 2개가 이 하네스에서 돌아간다 |
| **M3** | High | 상세 라우트 — `page.tsx`(데이터 어댑터), `ProductDetailView`, `not-found.tsx`. REQ-003~009 | **AC별 수단 명시(§H-5)**: 서비스 성공 모킹 시 `notFound` 스파이 **미호출** + `screen`에 상품명 존재 (AC-003/005, V1). 서비스 404 모킹 시 `notFound` 스파이 **호출됨** (AC-004, V1). `not-found.tsx` 렌더에 안내 문구 존재 + `Product not found` 원문 미노출 (AC-004, V1). `fetch(`/`useEffect` grep 매치 0건 (AC-003, V3). 표시 항목·가격 포맷·품절·범위 밖 데이터 단언 통과 (AC-006~009, V1+V3) |
| **M4** | High | `ProductGallery` 클라이언트 컴포넌트. REQ-010~014 | 0장/1장/n장 세 경로 + 썸네일 전환 테스트 통과 (V1), 금지 기능 정적 검사 매치 0건 (V3) |
| **M5** | Medium | 접근성 마감(REQ-015 a/b), `product-service.ts`의 `@MX:ANCHOR` fan-in 주석 갱신, 커버리지 임계값 충족 | `npm run lint` / `npm run typecheck` / `npm run test:coverage` 전부 통과 (V4). 썸네일 `button` role + `focus()` 후 `document.activeElement` 일치 + `alt` 텍스트 단언 통과 (AC-015 a/b, V1). **AC-015(c)는 이 마일스톤의 자동 완료 신호가 아니다** — 수동 시각 확인 결과를 `progress.md` §E.2에 기록하는 것으로 갈음한다(§H-5) |

M1과 M2는 서로 독립적이라 순서를 바꿔도 된다. M3는 M1·M2 둘 다에 의존한다. 완료 신호의 V1~V4는 §H-5의 검증 수단 번호다.

---

## §K. 리스크 및 잔여 위험

| # | 리스크 | 영향 | 완화 |
|---|---|---|---|
| R1 | `.tsx`를 커버리지 대상에 넣으면 85% 임계값이 신규 컴포넌트에 적용돼 게이트가 막힐 수 있음. `quality.yaml`의 `coverage_exemptions.enabled: false`라 면제 경로가 없고, `test_first_required: true`이므로 테스트 없는 `.tsx` 산출물은 허용되지 않는다 | 높음 | **§F 표에 `.tsx` 산출물 6개를 전부 올리고 각각에 테스트를 배정했다** — 로직이 있는 4개(`Page` / `ProductDetailView` / `ProductGallery` / `NotFound`)는 AC 단위 테스트로, 얇은 셸 2개(`layout.tsx` / 홈 스텁 `page.tsx`)는 최소 스모크 테스트 1개씩으로 덮는다. 즉 커버리지 대상 중 테스트 없는 파일이 0개다. `coverage.exclude` 등재나 면제는 쓰지 않는다(설정상 불가). M5에서 `npm run test:coverage`로 실제 수치를 확인한다 |
| R2 | async 서버 컴포넌트는 Testing Library로 직접 렌더하기 어려움 | 중간 | 표시 로직을 `ProductDetailView`(순수)로 분리해 그것을 테스트하고, `page.tsx`는 서비스 모킹 후 반환 엘리먼트를 검사하는 얇은 테스트로 커버 |
| R3 | 허용 목록에 없는 호스트의 이미지 URL을 `next/image`에 넘기면 런타임 오류 | 중간 | §D 확정으로 완화됨 — 허용 호스트는 `picsum.photos` 하나이고, 개발·테스트 픽스처 URL을 이 호스트로 통일한다(§D-3). 실제 호스팅 확정 시 `remotePatterns` 갱신이 **선행 조건**임을 §D-2에 후속 항목으로 기록 |
| R4 | Tailwind 도입이 프로젝트 전체 스타일링 방향을 고정 | 낮음 | §C 확정으로 해소됨 — 사용자 결정이며 `tech.md` 추천안과 일치. M1 범위 안에서 흡수됨 |
| R5 | 개별 이미지 URL이 깨져 있어도 대체 표시가 없음 | 낮음 | **수용된 잔여 위험.** REQ-013은 "이미지가 없는 상품"만 다룸. 로드 실패 대체 처리는 후속 SPEC 대상 |
| R6 | `next/image`를 쓸 경우 jsdom 테스트에서 이미지 컴포넌트 동작이 실제와 다를 수 있음 | 낮음 | 테스트는 `role="img"` / alt 텍스트 기준으로 단언해 구현 세부에 결합하지 않음 |
| R7 | 빌드 타임 툴체인(PostCSS + Tailwind v4 + `next/font/google` 웹폰트 페치)의 회귀를 CI가 잡지 못함. `.github/workflows/ci.yml`에 `npm run build` 단계가 없고, `next/font/google`은 패키지 의존성은 없지만 **빌드 시점 네트워크 의존성**을 새로 만든다(오프라인·CI 네트워크 제약 시 빌드 실패 가능) | 중간 | **수용된 잔여 위험 + 명시.** 빌드 게이트가 수동 실행임을 §H-5와 acceptance.md §3에 적었다. CI 워크플로 수정은 이 SPEC의 범위 밖이다(§L의 "하는 김에" 확장 금지). 폰트 페치가 실제로 문제가 되면 `globals.css`의 시스템 폰트 스택으로 낮추는 것이 되돌리기 쉬운 대안이며, REQ-STOREFRONT-001이 요구하는 "기본 타이포그래피"는 그것으로도 충족된다 |
| R8 | AC-015(c)(375px 가로 스크롤)에 자동 검증 수단이 없음 | 낮음 | **수용된 검증 공백 + 명시.** 자동 커버리지가 있는 척하지 않고 acceptance.md §5의 수동 시각 확인 체크리스트로 분리했으며, 자동 DoD의 PASS 조건에서 제외했다(§H-5). 자동화하려면 브라우저 E2E 하네스가 필요하고 그것은 spec.md §3의 명시적 제외 항목이다 |

---

## §L. 안티패턴 — 하지 말 것

- **자기 API를 HTTP로 되부르기.** 서버 컴포넌트에서 `fetch("/api/products/...")` 금지(§B).
- **페이지 전체에 `"use client"` 붙이기.** 클라이언트 경계는 갤러리까지다(§F).
- **카탈로그 도메인 수정.** `src/features/catalog/**`, `src/app/api/products/**`, `prisma/schema.prisma`는 이 SPEC에서 읽기만 한다.
- **전역 `environment`를 jsdom으로 전환.** 기존 노드 테스트 전량의 실행 환경을 바꾸는 변경이다(§H).
- **범위 밖 UI를 "하는 김에" 추가.** 헤더·푸터·장바구니 담기 버튼·목록 화면은 전부 spec.md §3에서 제외했다.
- **`images[i]`에 non-null 단언(`!`) 사용.** `noUncheckedIndexedAccess`가 잡아주는 안전망을 끄는 행위다(§E).
- **Tailwind v3 방식 설정.** `tailwind.config.js` 생성, `npx tailwindcss init`, `@tailwind base/components/utilities` 3종 디렉티브는 v4에서 대체된 패턴이다. `postcss.config.mjs` 1개 + `@import "tailwindcss";` 1줄만 쓴다(§C-1).
- **CSS Modules 병행 도입.** 스타일링은 Tailwind 하나로 간다. `.module.css` 파일을 섞지 않는다(§C).
- **`remotePatterns`에 호스트 임의 추가.** 지금 허용된 호스트는 `picsum.photos` 하나다. 실제 상품 이미지 호스팅이 정해지기 전에 추측으로 호스트를 늘리지 않는다(§D-2).

---

## §M. 교차 참조

- `.moai/specs/SPEC-STOREFRONT-001/spec.md` — 요구사항(REQ-STOREFRONT-001~015)
- `.moai/specs/SPEC-STOREFRONT-001/acceptance.md` — 수락 기준(AC-STOREFRONT-001~015)
- `.moai/specs/SPEC-CATALOG-001/` — `ProductDetail` 계약, 404 의미, p95 300ms NFR
- `src/features/catalog/services/product-service.ts` — `getProductDetail()`, `@MX:ANCHOR`(M5에서 갱신 대상)
- `src/features/catalog/types/product.ts` — `ProductDetail` 타입 정의
- `src/app/api/products/[productId]/route.ts` — 같은 서비스를 쓰는 기존 HTTP 진입점(변경 없음)
- `.claude/rules/moai/workflow/spec-workflow.md` § SPEC Complexity Tier, § Conditional Design Route — §I 판정 근거
- `.moai/config/sections/quality.yaml` — TDD 모드, 커버리지 임계값
- `.moai/project/tech.md` § 프런트엔드 스타일링 — Tailwind CSS 추천안. 이 SPEC의 §C 결정으로 확정 상태가 됨
