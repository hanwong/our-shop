# 인수 조건: SPEC-AUTH-003 — 서버 렌더링 로그인 상태 확인 방식의 정본화 및 공유 사이트 헤더

모든 항목은 **이진 판정 가능**하도록 작성했다. 판정 수단은 기존 vitest + jsdom + Testing Library 하네스와 `git diff` / 정적 스캔이며, 새 하네스를 도입하지 않는다.

**두 가지 판정 하네스 패턴** (둘 다 저장소에 이미 선례가 있다 — plan.md §B.7):

- **패턴 A — async 서버 컴포넌트 자체 렌더**: `render(await SiteHeader())`. 최상위 async 컴포넌트를 직접 await한 뒤 그 출력을 마운트한다. 선례: `tests/unit/app/product-detail-page.test.tsx:130`의 `render(await ProductDetailPage({...}))`. AC-AUTH-037/038/039가 이 패턴으로 판정된다.
- **패턴 B — element 트리 검사(마운트 없음)**: `RootLayout({ children }) as ReactElement`를 호출해 **반환된 element 트리를 그대로 검사**한다. 마운트하지 않으므로 `<html>`/`<body>` 중첩 경고가 발생하지 않고, 내부의 `<SiteHeader />`는 **호출되지 않은 element**로 남아 async 여부가 무관해진다. 선례: `tests/unit/app/shell.test.tsx:33-40`이 이미 `tree.type === "html"` / `tree.props.children?.type === "body"`로 동일한 검사를 한다. AC-AUTH-040이 이 패턴으로 판정된다.

---

## §1. 인수 조건 (AC-AUTH-037 ~ AC-AUTH-047)

### 헤더의 로그인 상태 표현

**AC-AUTH-037** — 게스트 방문자에게 로그인 링크가 보인다
- **Given** `resolveSession()`이 `null`을 반환하는 요청 컨텍스트에서
- **When** `SiteHeader`를 렌더하면
- **Then** 접근 가능한 이름이 "로그인"인 링크가 정확히 1개 존재하고, 그 `href`가 리터럴 `"/login"`이어야 한다.

**AC-AUTH-038** — 회원 방문자에게 로그인 상태 지표와 로그아웃 어포던스가 보인다
- **Given** `resolveSession()`이 `{ userId: "u1", role: "customer" }`를 반환하는 요청 컨텍스트에서
- **When** `SiteHeader`를 렌더하면
- **Then** "내 정보" 텍스트와 접근 가능한 이름이 "로그아웃"인 버튼이 각각 존재해야 하고, **"로그인" 링크는 존재하지 않아야** 한다.

**AC-AUTH-039** — 무효 세션의 모든 사유가 동일하게 게스트로 붕괴한다
- **Given** `resolveSession()`이 `null`을 반환하는 세 가지 사유 — (a) 쿠키 부재, (b) 폐기된 토큰, (c) 만료된 토큰 — 각각에 대해
- **When** `SiteHeader`를 렌더하면
- **Then** 세 경우의 렌더 출력이 **서로 동일**해야 하며(사유를 구분하는 텍스트·속성·클래스가 없어야 한다), 전부 AC-AUTH-037의 게스트 상태여야 한다.

**AC-AUTH-040** — 헤더가 레이아웃 레벨에서 children 앞에 배치된다 (판정 하네스 패턴 B)
- **Given** 식별 가능한 마커 children으로 `RootLayout({ children: MARKER })`을 **호출만** 하고 마운트하지 않은 반환 element 트리에서 (`shell.test.tsx:33-40`와 동일한 관례)
- **When** `<html>` → `<body>`로 내려가 `body.props.children`을 검사하면
- **Then** 그것이 배열이어야 하고, `children[0].type`이 `SiteHeader` 컴포넌트 참조와 **동일 참조**여야 하며, `children[1]`이 전달한 `MARKER`여야 한다 — 즉 헤더가 라우트별이 아니라 레이아웃 레벨에서, children보다 앞서 정확히 1회 배치됨이 고정된다.

> **왜 마운트하지 않는가**: `SiteHeader`는 `RootLayout`(동기) 안에 중첩된 async 서버 컴포넌트라 패턴 A(`render(await Component())`)로 도달할 수 없고, `RootLayout`을 마운트하면 `<html>`/`<body>` 중첩으로 React가 경고한다 — `shell.test.tsx`가 이미 그 이유로 마운트를 피한다. 패턴 B는 호출되지 않은 element의 `type` 참조만 비교하므로 `SiteHeader`의 async 여부와 무관하게 동작하며, 새 하네스를 요구하지 않는다. 헤더의 **내용**은 AC-AUTH-037/038/039가 패턴 A로 별도 판정한다 — 이 AC는 **배치**만 판정한다.

### 로그아웃 동작

**AC-AUTH-041** — 로그아웃 요청이 CSRF double-submit 형태로 나간다
- **Given** `document.cookie`에 `csrf_token=<value>`가 존재하는 상태에서
- **When** `LogoutButton`의 로그아웃 버튼을 클릭하면
- **Then** `fetch`가 `"/api/auth/logout"`에 대해 정확히 1회, `method: "POST"`로 호출되어야 하고, 요청 헤더 `X-CSRF-Token`의 값이 쿠키의 `<value>`와 **문자열이 일치**해야 한다.

**AC-AUTH-042** — 로그아웃 성공 시 화면이 게스트 상태로 갱신된다
- **Given** 로그아웃 버튼 클릭 후
- **When** 서버가 `200`을 반환하면
- **Then** `router.refresh()`가 정확히 1회 호출되어야 하고, `router.push`는 호출되지 않아야 한다.

**AC-AUTH-043** — 로그아웃 실패 시 상태가 유지된다
- **Given** 로그아웃 버튼 클릭 후
- **When** 서버가 `403`(CSRF 실패) 또는 `500`을 반환하면 (두 서브케이스 a/b)
- **Then** `router.refresh()`와 `router.push` 둘 다 호출되지 않아야 하고, 버튼이 계속 문서에 존재해야 한다(로그인 표시 유지).

### 경계 및 보존

**AC-AUTH-044** — 헤더가 제외 항목을 포함하지 않는다
- **Given** `src/components/layout/SiteHeader.tsx`와 `src/components/layout/LogoutButton.tsx`의 소스 텍스트에서
- **When** 정적 스캔을 수행하면
- **Then** 대소문자 무시 기준으로 `cart` / `장바구니` / `search` / `검색` / `<footer` 매치가 **0건**이어야 하고, 렌더된 출력에 `/cart`·`/products?…`·카테고리 경로로 향하는 링크가 **0개**여야 한다.

> **`<nav>` 태그 자체는 금지하지 않는다** (plan-audit D3). REQ-AUTH-046이 금지하는 것은 **카테고리 내비게이션 메뉴**라는 콘텐츠이지 `<nav>` 엘리먼트가 아니다. 로그인 상태 영역을 감싸는 시맨틱 래퍼로서의 `<nav>`는 접근성상 타당한 선택일 수 있으므로 허용한다 — 이 AC는 **내비게이션 링크가 실제로 존재하는지**를 판정하지 태그 이름을 판정하지 않는다.

**AC-AUTH-045** — PRESERVE 대상이 변경되지 않았다
- **Given** 구현 완료 후 고정된 베이스 커밋 대비
- **When** `git diff --stat` 을 `src/middleware.ts`, `src/lib/auth/session-resolver.ts`, `src/lib/auth/csrf.ts`, `src/lib/auth/cookies.ts`, `src/app/api/auth/logout/route.ts`, `src/lib/auth/guest-identity.ts`에 대해 수행하면
- **Then** 출력이 비어 있어야 하고(무변경), 추가로 `tests/unit/middleware.test.ts`와 `tests/unit/auth/session-resolver.test.ts`가 무회귀로 통과해야 한다.

**AC-AUTH-046** — 금지된 인증 패턴이 도입되지 않았다
- **Given** 신규 소스 2종(`SiteHeader.tsx`, `LogoutButton.tsx`)의 소스 텍스트에서
- **When** 정적 스캔을 수행하면
- **Then** `Authorization` / `Bearer` / `localStorage` / `sessionStorage` / `createContext` / `useContext` / `useAuth` 매치가 **0건**이어야 한다.

**AC-AUTH-047** — 상품 상세의 리뷰 게이트가 그대로 동작한다 (특성화 회귀 가드)
- **Given** 구현 완료 후 고정된 베이스 커밋 대비
- **When** (a) `git diff --stat`을 `src/app/products/[productId]/page.tsx`와 `src/components/product/ProductDetailView.tsx`에 대해 수행하고, (b) `tests/unit/app/product-detail-page.test.tsx`와 `tests/unit/components/product-detail-view.test.tsx`를 실행하면
- **Then** (a) 출력이 비어 있어야 하고(무변경), (b) 두 테스트 파일이 **plan-phase에서 실측한 baseline과 정확히 동일한 통과 개수**로 통과해야 한다 — 리뷰 게이트가 헤더 상태를 소비하도록 리팩터되지 않았음을 고정한다.

> **실측 baseline (plan.md §C-6에서 캡처, 2026-09-05)**: `product-detail-page.test.tsx` **12 passed**, `product-detail-view.test.tsx` **7 passed**, 합계 **19 passed / 2 files**. 이 숫자가 AC의 판정 기준값이며, 구현 후 재실행 결과가 이 값과 다르면(증가·감소 무관) FAIL이다.

> AC 11건 — Tier M 상한(16) 이내, 여유 5건.

---

## §2. REQ ↔ AC 추적 매트릭스

| 요구사항 | 검증 AC | 판정 수단 |
|---|---|---|
| REQ-AUTH-038 (`resolveSession()`이 정본 수단) | AC-AUTH-037, AC-AUTH-038 | 모킹된 `resolveSession` 반환값에 따라 렌더가 갈리는지 |
| REQ-AUTH-039 (세션 로직 자체 구현 금지) | AC-AUTH-045, AC-AUTH-046 | `session-resolver.ts` 무변경 + 신규 파일에 해싱/DB 조회 부재 |
| REQ-AUTH-040 (`null` 사유 무구분) | AC-AUTH-039 | 3사유 렌더 출력 동일성 |
| REQ-AUTH-041 (루트 레이아웃 렌더) | AC-AUTH-040 | 레이아웃 트리 구조 |
| REQ-AUTH-042 (비로그인 → 로그인 링크) | AC-AUTH-037 | 링크 존재 + href 리터럴 |
| REQ-AUTH-043 (로그인 → 내 정보 + 로그아웃) | AC-AUTH-038 | 두 요소 존재 + 로그인 링크 부재 |
| REQ-AUTH-044 (CSRF 실은 로그아웃 호출 + 갱신) | AC-AUTH-041, AC-AUTH-042 | fetch 인자 검사 + `router.refresh` 호출 |
| REQ-AUTH-045 (실패 시 이동 없음) | AC-AUTH-043 (a/b) | 라우터 미호출 |
| REQ-AUTH-046 (장바구니·검색·내비·푸터 금지) | AC-AUTH-044 | (1) 소스 정적 스캔 0건(`cart`/`장바구니`/`search`/`검색`/`<footer`) + (2) 렌더 출력의 내비 링크 0개(`/cart`·카테고리 경로) |
| REQ-AUTH-047 (middleware / resolver / guest-identity 불가침) | AC-AUTH-045 | `git diff --stat` 무변경 + 무회귀 |
| REQ-AUTH-048 (Authorization 헤더·클라이언트 저장소 금지) | AC-AUTH-046 | 정적 스캔 0건 |
| REQ-AUTH-049 (리뷰 게이트 보존) | AC-AUTH-047 (a/b) | `git diff --stat` 무변경 + 기존 테스트 무회귀 |

**커버리지**: REQ 12건 전부 최소 1개의 AC로 검증된다. 고아 AC(대응 REQ 없음) 없음.

---

## §3. 엣지 케이스

| 케이스 | 기대 동작 | 판정 |
|---|---|---|
| `csrf_token` 쿠키가 아예 없는 상태에서 로그아웃 클릭 | 빈 문자열이 헤더로 나가고 서버가 403 → AC-AUTH-043의 실패 경로 | AC-AUTH-043(a)로 커버 |
| 로그아웃 요청이 네트워크 예외로 reject | 이동/갱신 없음, 버튼 유지 | AC-AUTH-043의 판정 기준(라우터 미호출)에 포함 |
| `role: "admin"`인 세션 | 고객 헤더와 동일하게 로그인 상태로 표시(역할 분기 없음) | AC-AUTH-038과 동일 분기 — 방어적 역할 분기를 넣지 않는 것이 요구사항이다 |
| 리뷰 게이트와 헤더가 같은 요청에서 각각 `resolveSession()` 호출 | 둘 다 정상 동작, 서로 간섭 없음 | AC-AUTH-047(b)의 기존 테스트 무회귀로 커버 |

## §4. 자동 검증에서 제외되는 항목

SPEC-STOREFRONT-001 §3이 확립한 경계를 따른다 — **브라우저 레이아웃 엔진이 있어야만 관측 가능한 항목은 자동 판정하지 않는다.**

- 헤더의 실제 뷰포트별 시각적 배치(375px에서의 줄바꿈, 정렬)는 수동 시각 확인 대상이며 Definition of Done의 자동 통과 조건에 포함되지 않는다.
- `router.refresh()` 이후 서버 컴포넌트가 실제로 재요청되어 게스트 헤더가 그려지는 것은 **Next.js 런타임의 보증**이다. 이 SPEC의 테스트가 판정하는 것은 `router.refresh()`가 호출되었다는 지점까지다(AC-AUTH-042).
- 루트 레이아웃이 동적 렌더링으로 전환되는 것(plan.md §B.5)은 프레임워크 동작이며, 성능 측정은 이 SPEC의 범위가 아니다.

---

## §5. Definition of Done

- [ ] AC-AUTH-037 ~ AC-AUTH-047 **11건 전부 PASS** (서브케이스 포함).
- [ ] `npx tsc --noEmit` exit 0.
- [ ] `npm run lint` exit 0, 신규 이슈 0건.
- [ ] 신규 소스 2종 커버리지 — lines/statements ≥ 85%, branch ≥ 80%.
- [ ] 전체 테스트 스위트 회귀 0건.
- [ ] PRESERVE 목록(plan.md §D) 전부 `git diff --stat` 무변경 확인.
- [ ] plan.md §G 안티패턴 8건 전부 미범.
- [ ] plan.md §B.8의 @MX 태그 계획대로 부여/갱신 완료.
- [ ] `package.json` 무변경(신규 의존성 0건).
