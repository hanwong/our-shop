# SPEC-AUTH-003 (Compact) — SSR 로그인 상태 확인 정본화 + 공유 사이트 헤더

> Run-phase 로딩용 압축본. 정정된 전제·기술 근거·교차 참조는 spec.md/plan.md 참고. ~30% 토큰 절감 목적.

## 한 줄 전제 정정 (반드시 읽을 것)

원 카드의 "SSR 로그인 확인이 메모리 전용 토큰과 구조적으로 충돌한다"는 **틀렸다**. 메모리 전용은 *액세스 토큰*뿐이고(REQ-AUTH-009), 로그인 판정은 httpOnly `refresh_token` 쿠키를 읽는 `resolveSession()`(`src/lib/auth/session-resolver.ts:54`)으로 **이미 해결되어 동작 중**이다. 기존 호출자는 **2곳**(`grep -rn 'resolveSession(' src/`) — `src/app/products/[productId]/page.tsx:49`(페이지 레벨 표시 게이트)와 `src/app/api/reviews/route.ts:29`(API 라우트 인증 게이트). **둘 다 리뷰 도메인이고 레이아웃 레벨 소비자는 없다.** 이 SPEC은 그것을 정본으로 고정하고 최초 레이아웃 소비자(헤더)를 만든다. 재설계가 아니다.

## Requirements (GEARS, REQ-AUTH-038 ~ 049)

- **REQ-AUTH-038** (Ubiquitous): SSR 로그인 상태 확인의 정본 수단은 `resolveSession()`이며 헤더는 그것을 그대로 호출해야 한다.
- **REQ-AUTH-039** (Unwanted): 헤더는 세션 해석 로직을 자체 구현하거나 `resolveSession()` 본문을 수정해서는 안 된다.
- **REQ-AUTH-040** (When-이벤트탐지): `resolveSession()`이 `null`이면 사유 불문 동일한 게스트 상태를 렌더해야 하며 사유를 노출해서는 안 된다.
- **REQ-AUTH-041** (Ubiquitous): 루트 레이아웃이 모든 라우트의 본문 위에 헤더를 렌더해야 한다.
- **REQ-AUTH-042** (While-비로그인): `/login`으로 향하는 "로그인" 링크를 표시해야 한다.
- **REQ-AUTH-043** (While-로그인): "내 정보" + 로그아웃 어포던스를 표시하고 "로그인" 링크를 표시해서는 안 된다.
- **REQ-AUTH-044** (When-이벤트구동): 로그아웃 활성화 시 `csrf_token` 쿠키 값을 `X-CSRF-Token`에 실어 `POST /api/auth/logout` 호출, 200이면 화면 갱신.
- **REQ-AUTH-045** (When-이벤트탐지): 로그아웃 비-200 시 이동 없이 로그인 표시를 유지해야 한다.
- **REQ-AUTH-046** (Unwanted): 장바구니 아이콘·배지·검색창·카테고리 내비·푸터를 포함해서는 안 된다.
- **REQ-AUTH-047** (Unwanted): `src/middleware.ts`(matcher 포함)·`session-resolver.ts`·`guest-identity.ts`·REQ-AUTH-009를 변경해서는 안 된다.
- **REQ-AUTH-048** (Unwanted): `Authorization` 헤더로 보호 라우트를 조회하거나 클라이언트 인증 상태 저장소를 도입해서는 안 된다.
- **REQ-AUTH-049** (Ubiquitous-보존): 상품 상세 리뷰 게이트는 무변경 유지, 헤더 상태를 소비하도록 리팩터하지 않는다.

## Acceptance Criteria (Given-When-Then, AC-AUTH-037 ~ 047)

- **AC-AUTH-037**: Given `resolveSession()`→`null` / When 헤더 렌더 / Then "로그인" 링크 1개, `href="/login"`.
- **AC-AUTH-038**: Given `{userId,role:"customer"}` / When 헤더 렌더 / Then "내 정보" + "로그아웃" 버튼 존재, "로그인" 링크 부재.
- **AC-AUTH-039**: Given null 3사유(쿠키부재/폐기/만료, a·b·c) / When 헤더 렌더 / Then 세 출력이 서로 동일한 게스트 상태.
- **AC-AUTH-040**: Given `RootLayout({children: MARKER})` 호출만(마운트 없음, `shell.test.tsx:33-40` 관례) / When `<body>.props.children` 검사 / Then 배열이고 `[0].type === SiteHeader`(동일 참조), `[1] === MARKER`.
- **AC-AUTH-041**: Given `csrf_token=<v>` 쿠키 / When 로그아웃 클릭 / Then `POST /api/auth/logout` 1회 + `X-CSRF-Token === <v>`.
- **AC-AUTH-042**: Given 로그아웃 클릭 / When 200 / Then `router.refresh()` 1회, `router.push` 0회.
- **AC-AUTH-043**: Given 로그아웃 클릭 / When 403(a) / 500(b) / Then `refresh`·`push` 둘 다 0회, 버튼 유지.
- **AC-AUTH-044**: Given 신규 소스 2종 / When 정적 스캔 / Then `cart`/`장바구니`/`search`/`검색`/`<footer` 매치 0건 + 렌더 출력에 `/cart`·카테고리 링크 0개. **`<nav>` 태그 자체는 허용**(REQ-046이 금지하는 건 카테고리 내비 콘텐츠지 태그가 아님).
- **AC-AUTH-045**: Given 완료 트리 / When PRESERVE 6파일 `git diff --stat` / Then 무변경 + `middleware.test.ts`·`session-resolver.test.ts` 무회귀.
- **AC-AUTH-046**: Given 신규 소스 2종 / When 정적 스캔 / Then `Authorization`/`Bearer`/`localStorage`/`sessionStorage`/`createContext`/`useContext`/`useAuth` 매치 0건.
- **AC-AUTH-047**: Given 완료 트리 / When (a) 리뷰 게이트 2파일 `git diff --stat`, (b) 관련 테스트 2종 실행 / Then (a) 무변경, (b) **실측 baseline 19 passed / 2 files**(page 12 + view 7, plan.md §C-6에서 캡처)와 정확히 일치.

## Files to Modify / Create

| 파일 | 종류 |
|---|---|
| `src/components/layout/SiteHeader.tsx` | 신규(NEW) — async 서버 컴포넌트 |
| `src/components/layout/LogoutButton.tsx` | 신규(NEW) — `"use client"`, props 없음 |
| `src/app/layout.tsx` | 수정(MODIFY) — 헤더 배선 + 기존 제외 주석 갱신 |
| `tests/unit/components/site-header.test.tsx` | 신규(NEW) |
| `tests/unit/components/logout-button.test.tsx` | 신규(NEW) |
| `tests/unit/components/site-header-boundary-static.test.ts` | 신규(NEW) |
| `tests/unit/app/shell.test.tsx` | 수정(MODIFY) — §B.7 패턴 B 배치 검증 `it` 추가(기존 단정 제거 없음) |

**PRESERVE (수정 금지)**: `src/middleware.ts`, `src/lib/auth/{session-resolver,csrf,cookies,guest-identity}.ts`, `src/app/api/auth/logout/route.ts`, `src/app/products/[productId]/page.tsx`, `src/components/product/ProductDetailView.tsx`, `src/app/staff/**`, `prisma/schema.prisma`, `package.json`.

## 핵심 구현 결정 (plan.md 요약)

- **CSRF**: `document.cookie` 인라인 파싱 — `CancelOrderButton.tsx:29` / `ProductForm.tsx:38` 선례 그대로. **공유 유틸로 추출하지 않는다**(두 선례 파일이 PRESERVE).
- **로그아웃 성공 후**: `router.refresh()` (홈 이동 아님 — `router.push("/")`는 기각).
- **리뷰 게이트**: 그대로 둔다(독립 유지). 레이아웃 지표와 페이지 도메인 게이트는 다른 관심사.
- **동적 렌더링 전환**: `layout.tsx`가 `cookies()`를 경유하므로 전 라우트가 동적이 된다 — 의도된 트레이드오프(plan.md §B.5).
- **테스트 판정 하네스**: 패턴 A `render(await SiteHeader())`(내용 검증) + 패턴 B `RootLayout()` 호출 후 마운트 없이 element 트리 검사(배치 검증). 둘 다 기존 선례 존재, 새 하네스 없음 — plan.md §B.7에서 확정했으므로 run-phase 재결정 불필요.
- **@MX**: `SiteHeader`에 `@MX:ANCHOR`+`@MX:REASON`+`@MX:NOTE`, `LogoutButton`에 `@MX:NOTE`, `layout.tsx` 기존 제외 주석 갱신.

## Exclusions (What NOT to Build)

- 장바구니 아이콘/배지, 검색창 — SPEC-STOREFRONT-001 §3 / -002 §3의 의도된 이연 승계.
- 푸터, 카테고리 내비, 햄버거 메뉴, 브레드크럼 — 헤더 존재만 좁게 개정.
- 회원 체크아웃, `Order.userId`, `prisma/schema.prisma` — 쓰기 측 별개 문제(SPEC-ORDER-001 §3).
- 액세스 토큰 전송 재설계, middleware matcher 확장 — REQ-AUTH-009/022 불가침.
- 게스트 신원(`guest-identity.ts`) 연동 — 직교 관심사.
- 마이페이지/회원정보 화면, `resolveAdminSession` 리팩터, 관리자 헤더.
- 디자인 시스템/다크모드/sticky, Playwright E2E.

## Anti-Patterns (plan.md §G)

csrf 파서 공유 유틸 추출 · 클라이언트 헤더 + `/api/auth/me` 신설 · `Authorization` 헤더 조회 · 리뷰 게이트 리팩터 · "이왕이면" 배지/검색/푸터 추가 · matcher 확장 · `session-resolver.ts`의 낡은 `@MX:NOTE` 수정 · 로그아웃 후 홈 강제 이동.
