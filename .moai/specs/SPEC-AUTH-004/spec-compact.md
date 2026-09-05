# SPEC-AUTH-004 (Compact) — staff 화면 고객 헤더 제거 + (shop) 라우트 그룹 분리

> Run-phase 로딩용 압축본. 정정된 전제·기각된 메커니즘·PRESERVE 상호작용 전문은 spec.md/plan.md 참고.

## 한 줄 전제 정정 (반드시 읽을 것)

원 리포트의 "staff 화면이 **로그아웃된 것처럼** 보인다"는 **틀렸다.** `resolveSession()`(`src/lib/auth/session-resolver.ts:67-71`)에는 역할 필터가 없고, staff는 고객과 같은 `POST /api/auth/login`으로 로그인해(`src/app/staff/login/page.tsx:50`) 같은 `refresh_token` 쿠키를 받는다. 따라서 유효한 staff 세션에서 헤더는 **"내 정보" + 로그아웃 버튼**을 렌더한다(`SiteHeader.tsx:34-41`). 그 버튼이 연결된 `POST /api/auth/logout`은 **역할을 검사하지 않고** 폐기하므로(`logout/route.ts:43-58`), 관리자가 고객용 버튼으로 **자기 관리자 세션을 종료**한다. 원 서술보다 심각하다.

## 한 줄 메커니즘 정정 (반드시 읽을 것)

"`src/app/staff/layout.tsx`를 만들어 `{children}`만 렌더하면 헤더가 사라진다"는 **틀렸다 — no-op이다.** Next.js 중첩 레이아웃은 부모 레이아웃이 렌더한 UI를 제거할 수 없다(`layout.js` = "route segment 안에서 가장 바깥"; 루트 레이아웃 = "위에 `layout.js`가 없는" 레이아웃). **staff 쪽에는 파일을 만들지 않는다.** 대신 헤더를 상속 경로에서 내린다.

## 설계 (R1 — (shop) 라우트 그룹)

```
src/app/layout.tsx          수정: <html><body>{children}</body></html>   ← SiteHeader 제거
src/app/(shop)/layout.tsx   신규: <SiteHeader />{children}
src/app/(shop)/{page.tsx, cart, checkout, login, orders, products, signup}  ← git mv
src/app/staff/**            무변경 (13개 파일 그대로, layout.tsx 추가 없음)
src/app/api/**              무변경 (라우트 핸들러는 레이아웃 미통과)
```

라우트 그룹은 URL에 포함되지 않는다(Next.js 문서: "should not be included in the route's URL path") → 고객 URL 9개 전부 불변. full-page-load 캐비엇은 **multiple root layouts에만** 적용되며, 최상위 `layout.tsx`를 유지하므로 해당 없음.

## Requirements (GEARS, REQ-AUTH-050 ~ 058)

- **REQ-AUTH-050** (Ubiquitous): 루트 레이아웃은 문서 셸과 `{children}`만 렌더하고 `SiteHeader`를 렌더해서는 안 된다.
- **REQ-AUTH-051** (Ubiquitous): `(shop)/layout.tsx`가 `{children}` 앞에 `SiteHeader`를 정확히 1회 렌더해야 한다.
- **REQ-AUTH-052** (Ubiquitous): 모든 고객 대면 라우트 세그먼트가 `(shop)` 그룹 안에 있어야 한다.
- **REQ-AUTH-053** (While-staff렌더): staff 렌더 출력에 헤더 콘텐츠("로그인"/"내 정보"/로그아웃)가 없어야 한다.
- **REQ-AUTH-054** (Unwanted): 유효 관리자 세션이어도 헤더를 렌더해서는 안 된다 — 숨김은 **무조건**이며 세션 조건부가 아니다.
- **REQ-AUTH-055** (Ubiquitous): 고객 라우트 URL이 이동 전후 동일해야 한다.
- **REQ-AUTH-056** (While-고객렌더): 고객 라우트의 로그인 상태 표시가 SPEC-AUTH-003과 동일해야 한다.
- **REQ-AUTH-057** (Unwanted): 관리자 전용 헤더/로그아웃 UI를 만들지 않고, `src/app/staff/**`를 수정·추가하지 않는다.
- **REQ-AUTH-058** (Unwanted): `middleware.ts`·`session-resolver.ts`·`admin-session.ts`·`logout/route.ts`·`SiteHeader.tsx`·`LogoutButton.tsx`·`schema.prisma` 변경 금지.

## Acceptance Criteria (Given-When-Then, AC-AUTH-048 ~ 056)

> 판정 노트: staff 페이지를 렌더해 헤더 부재를 보는 테스트는 **수정 전에도 통과**하므로 판정력이 0이다. REQ-AUTH-053/054는 **구조 합성 증명**(AC-048+049+050+051)으로 판정한다. 레이아웃 검증은 패턴 B(마운트 없는 element 트리 검사, `shell.test.tsx:33-40` 관례).

- **AC-AUTH-048**: Given 이동 후 트리 / When staff 경로 열거 / Then `staff/products/page.tsx`·`staff/orders/page.tsx`가 `src/app/staff/`에 그대로 있고, `(shop)/`로 시작하는 staff 경로 0건, `src/app/staff/layout.tsx` **부재**.
- **AC-AUTH-049**: Given `RootLayout({children:MARKER})` 호출만 / When `<body>.props.children` 검사 / Then `MARKER`와 동일, `SiteHeader` 참조 없음 + `layout.tsx` 소스에 `SiteHeader` 문자열 0건.
- **AC-AUTH-050**: Given `ShopLayout({children:MARKER})` 호출만 / When children 배열 검사 / Then `[0].type === SiteHeader`(동일 참조), `[1] === MARKER`, 출현 정확히 1회, `<html>`/`<body>` 미선언.
- **AC-AUTH-051**: Given `src/app` 아래 모든 `layout.tsx` / When `SiteHeader` 참조 검색 / Then `(shop)/layout.tsx` **단 하나만** 매치.
- **AC-AUTH-052**: Given 이동 전 URL 9개 / When 이동 후 경로에서 `(shop)` 제거해 재구성 / Then 9개 완전 일치.
- **AC-AUTH-053**: Given `(shop)` 통과 렌더 / When `resolveSession()` null / 비-null 각각 / Then "로그인" 링크 / "내 정보"+로그아웃.
- **AC-AUTH-054**: Given 구현 완료 트리 / When `vitest run` + `git diff --stat -- tests/` / Then **113 files / 1489 tests 전부 통과**, 변경 테스트 **정확히 12개**, `shell.test.tsx` 제외 **11개 diff에 경로 문자열 외 변경 0건**.
- **AC-AUTH-055**: Given `git mv`한 소스 10개 / When `git diff --stat` / Then rename(0 insertions/0 deletions). 미충족 시 실패 아님 — 대체 해시 검증 + `progress.md` 명시 기록 **의무**.
- **AC-AUTH-056**: Given 구현 완료 트리 / When REQ-AUTH-058 대상 + `src/app/staff/` diff 확인 / Then 전부 무변경, staff 파일 수 **13개 동일**, 관리자 헤더 신규 파일 0건.

## 변경 파일 전수 (재계수, 총 24개)

- **소스 이동 10개** = `page.tsx`(1) + `cart`(1) + `checkout`(2) + `login`(1) + `orders`(2) + `products`(2, `not-found.tsx` 포함) + `signup`(1)
- **레이아웃 2개** = `layout.tsx`(수정) + `(shop)/layout.tsx`(신규)
- **테스트 12개** = 경로 전용 11 + 구조 1(`shell.test.tsx`)
  - 경로 전용 11: `cart-page`, `checkout-complete-page-payment`, `checkout-complete-page`, `checkout-page`, `home-page`, `login-page`, `order-lookup-by-number-page`, `order-lookup-page`, `product-detail-page`, `signup-page` (모두 `tests/unit/app/`) + `tests/unit/auth/auth-boundary-static.test.ts`
  - **`product-detail-page.test.tsx`**(SPEC-AUTH-003 무회귀 가드)와 **`auth-boundary-static.test.ts`**(보안 경계 스캔)는 경로 문자열만 바뀌고 단언·금지 토큰·기대값 **불변** → 원 SPEC의 보장 그대로 유효.

## @MX 계획

- `(shop)/layout.tsx`: `@MX:ANCHOR`(고객 라우트 전체 통과) + `@MX:NOTE`(존재 자체가 결함 수정 — 헤더를 루트로 되돌리면 재발)
- `layout.tsx`: `@MX:WARN`(여기에 `SiteHeader` 재추가 시 SPEC-AUTH-004 결함 재발) + 기존 `@MX:NOTE` 갱신

## 안티패턴 (하지 말 것)

1. `staff/layout.tsx` 추가 — no-op. 2. tsconfig 별칭으로 임포트 살리기. 3. `git mv` 대신 삭제+재생성. 4. 경로 전용 11개에서 단언 손보기. 5. `middleware.ts` matcher 확장. 6. 관리자 헤더 "이왕이면" 만들기. 7. `logout/route.ts`에 역할 검사 추가. 8. `src/app/api/`를 `(shop)`으로 이동.

**9. `SiteHeader.tsx`의 주석을 고치기 — 어떤 주석이든. 가장 빠지기 쉬운 함정.** 이 SPEC이 끝나면 그 파일의 `@MX:` 주석 **3개가 전부** 거짓이 된다 — `@MX:ANCHOR`(`:11` "on **every route**"), `@MX:REASON`(`:14` "via the **root layout**"), `@MX:NOTE`(`:24-27` "the tree rooted at the **root layout**, so **every route** … dynamically rendered"). 눈에 띄면 고치고 싶어지지만, `SiteHeader.tsx`는 REQ-AUTH-058의 PRESERVE 대상이고 **AC-AUTH-056이 그 파일 diff가 비어 있을 것을 요구한다** — 주석 한 줄만 고쳐도 인수 조건이 깨진다.

> **규칙은 파일 단위다: `SiteHeader.tsx`의 주석은 하나도 건드리지 않는다.** 위 3개는 예시일 뿐이며, 목록에 없는 낡은 문장을 새로 발견해도 똑같이 두고 간다. 낡은 채로 두는 것이 정답이다(SPEC-AUTH-003이 `session-resolver.ts`에 내린 것과 동일한 처리).
