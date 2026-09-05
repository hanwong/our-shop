---
id: SPEC-AUTH-003
title: "서버 렌더링 로그인 상태 확인 방식의 정본화 및 공유 사이트 헤더 — 구현 계획"
version: "0.1.0"
status: draft
created: 2026-09-05
updated: 2026-09-05
author: snake
priority: P2
phase: "v0.2.0 target"
module: "src/components/layout"
lifecycle: spec-anchored
tags: "auth, ui, header, ssr, session"
tier: M
---

# 구현 계획: SPEC-AUTH-003

## §A. 배경 및 근거

### §A.1 정정된 전제 (corrected premise) — 이 절을 건너뛰면 SPEC 전체를 오해한다

이 SPEC을 낳은 카드는 "SSR 로그인 상태 확인이 SPEC-AUTH-001의 메모리 전용 토큰과 **구조적으로 충돌한다**"는 전제로 열렸다. 착수 전 정찰(Explore, 읽기 전용)에서 **그 충돌이 실재하지 않음**이 확인되었다. 아래는 그 정찰이 실제로 읽은 파일과 줄 번호다 — 서술이 아니라 인용이다.

**증거 1 — 서버가 읽을 수 있는 신원 채널이 이미 있다.**
`src/lib/auth/cookies.ts`의 `buildRefreshTokenCookie()`가 `httpOnly: true`, `sameSite: "lax"`, `path: "/"`로 `refresh_token` 쿠키를 발급한다(REQ-AUTH-008). `sameSite: "lax"` + `path: "/"` 조합은 **최상위 내비게이션(top-level navigation)에 쿠키가 실려 가는** 설정이다. 즉 SSR 렌더 요청 시점에 서버가 읽을 수 있는 신원 정보가 처음부터 존재했다.

**증거 2 — 그 채널을 읽는 함수가 이미 구현되어 있다.**

```
src/lib/auth/session-resolver.ts:54
  export async function resolveSession(cookieStore: SessionCookieStore): Promise<Session | null>
```

쿠키를 읽고(`REFRESH_TOKEN_COOKIE_NAME = "refresh_token"`), `hashRefreshToken()`으로 해싱하고, `prisma.refreshToken.findFirst({ where: { tokenHash }, include: { user: true } })`로 조회한 뒤 `revokedAt !== null || expiresAt <= new Date()`이면 `null`, 아니면 `{ userId, role }`을 반환한다. **쓰기 호출이 하나도 없다**(REQ-AUTH-034).

**증거 3 — 프로덕션 호출자가 이미 둘 있다.** (저장소 전역 `grep -rn 'resolveSession(' src/`로 확인 — 단일 파일 grep은 저장소 전역 배타성 주장의 근거가 될 수 없다.)

```
src/app/products/[productId]/page.tsx:49
  resolveSession(await cookies()),
src/app/api/reviews/route.ts:29
  const session = await resolveSession(jar);
```

- **페이지 레벨** (`products/[productId]/page.tsx`): `Promise.all`로 리뷰 요약과 함께 해석한 뒤 `isLoggedIn={session !== null}`로 `ProductDetailView`에 넘긴다. 리뷰 작성 폼과 로그인 유도 링크를 가르는 표시 게이트다(SPEC-REVIEW-001).
- **API 라우트 레벨** (`api/reviews/route.ts`): 리뷰 작성 요청의 인증 게이트. `session === null`이면 `401 "Not authorized"`로 즉시 반환하며, 역할 검사는 하지 않는다(REQ-REVIEW-003 / REQ-REVIEW-012).

**둘 다 리뷰 도메인 하나의 양면(표시 게이트 + 쓰기 인증)이고, 레이아웃 레벨 소비자는 없다.** 이 사실은 §B.6의 결정(기존 호출 지점을 독립 유지)을 바꾸지 않는다 — 오히려 강화한다. 둘 다 페이지·라우트 스코프의 도메인 게이트이므로 레이아웃 레벨 전역 지표와 합칠 대상이 애초에 아니다.

**결론**: 메모리 전용 제약은 **액세스 토큰에만** 걸린 것이고(REQ-AUTH-009), 로그인 상태 판정은 그 토큰을 전혀 경유하지 않는 **별도 쿠키 채널**로 이미 해결되어 있다. `src/middleware.ts:18-31`의 주석이 말하는 "top-level navigation carries no custom request headers" 한계는 **액세스 토큰을 `Authorization` 헤더로 실어 보내는 경로**에 대한 것이지, refresh_token 쿠키 경로에 대한 것이 아니다. 두 문장을 겹쳐 읽으면 존재하지 않는 충돌이 만들어진다 — 원 카드가 정확히 그렇게 읽었다.

따라서 이 SPEC의 일은 **재설계가 아니라 정본화 + 최초 레이아웃 소비자 구축**이다.

### §A.2 이 SPEC이 손대지 않는 인접 문제

`src/middleware.ts`(PRESERVE 고정, matcher `["/admin/:path*"]`), REQ-AUTH-009(액세스 토큰 전송), `src/lib/auth/guest-identity.ts`(게스트 장바구니 신원 — 직교), 쓰기 측 회원 체크아웃(SPEC-ORDER-001 §3). 각 항목의 제외 근거는 spec.md §1.2 / §3에 있다.

---

## §B. 기술 접근

### §B.1 컴포넌트 배치 — 저장소 관례 확인 결과

현재 `src/components/` 아래 디렉터리는 `cart/`, `checkout/`, `orders/`, `product/` 4개이며, 전부 **도메인 이름 = 디렉터리 이름** 관례다. 재사용 UI 프리미티브 디렉터리(`src/components/ui/`)는 없다(SPEC-STOREFRONT-001 §3이 명시적으로 제외).

따라서 신규 헤더는 `src/components/layout/`에 둔다 — 기존 관례와 충돌하지 않는 새 도메인 디렉터리다.

### §B.2 서버/클라이언트 경계 — 두 파일로 나누는 이유

`resolveSession()`은 `prisma`를 직접 쓰는 **서버 전용 비동기 함수**다. 반면 로그아웃은 `document.cookie`에서 `csrf_token`을 읽어야 하므로 **클라이언트 전용**이다. 한 파일로 합칠 수 없다.

| 파일 | 종류 | 책임 |
|---|---|---|
| `src/components/layout/SiteHeader.tsx` | 서버 컴포넌트 (`async`) | `resolveSession()` 호출 → 로그인/비로그인 분기 렌더 |
| `src/components/layout/LogoutButton.tsx` | 클라이언트 컴포넌트 (`"use client"`) | csrf 쿠키 읽기 → `POST /api/auth/logout` → 화면 갱신 |

`SiteHeader`가 로그인 상태일 때만 `<LogoutButton />`을 렌더한다. `LogoutButton`은 **세션을 전혀 알지 못한다** — props도 받지 않는다. 상태 판정은 전부 서버 쪽에 남는다(REQ-AUTH-048: 클라이언트 인증 상태 저장소 미도입).

### §B.3 CSRF 처리 — 새로 발명하지 않고 선례를 그대로 따른다

`POST /api/auth/logout`은 DB 접근 **이전에** `verifyCsrfRequest()`를 검사한다(`src/app/api/auth/logout/route.ts`, REQ-AUTH-023). `csrf_token` 쿠키는 `httpOnly: false`로 발급되므로 클라이언트 JS가 읽을 수 있다(`src/lib/auth/csrf.ts`의 `buildCsrfCookie()`).

저장소에 이미 동일 패턴 소비 선례가 두 곳 있다:

```
src/app/staff/orders/[orderId]/CancelOrderButton.tsx:29
src/app/staff/products/ProductForm.tsx:38
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
```

`LogoutButton`은 **이 인라인 파싱을 그대로 쓴다.** 공유 유틸(`readCsrfToken()`)로 추출하지 않는다 — 그 리팩터는 세 번째 소비자가 생긴 지금이 적기로 보일 수 있으나, 두 선례 파일을 수정하는 순간 이 SPEC의 PRESERVE 경계가 관리자 영역까지 번진다. §G 안티패턴에 명시적으로 기록한다.

### §B.4 로그아웃 성공 후 화면 갱신 — 결정과 근거

로그아웃 200 이후 헤더는 게스트 상태로 바뀌어야 한다. `SiteHeader`는 서버 컴포넌트이므로 클라이언트 상태로는 바뀌지 않는다. 선택지는 둘이다.

- **채택**: `router.refresh()` 호출 — 서버 컴포넌트 트리를 재요청해 헤더가 새 쿠키 상태(만료됨)로 다시 렌더된다. 현재 경로를 유지하므로 방문자가 보던 화면이 사라지지 않는다.
- 기각: `router.push("/")` — 홈으로 강제 이동. 로그아웃이 화면 이동을 겸하는 것은 방문자가 요청하지 않은 부작용이다. SPEC-AUTH-002가 로그인 성공 시 `/`로 이동시키는 것과는 다른 상황(그쪽은 로그인 화면에 남을 이유가 없다).

**보호 라우트에서 로그아웃한 경우**: 현재 이 헤더가 붙는 고객 영역에는 보호 라우트가 없다(middleware matcher는 `/admin/:path*` 하나뿐). 따라서 `router.refresh()`가 접근 거부 화면을 만들 경로가 존재하지 않는다.

### §B.5 루트 레이아웃 변경과 그 귀결 — 반드시 인지하고 진행할 것

`src/app/layout.tsx`는 현재 완전히 정적이다. 여기에 `resolveSession(await cookies())`를 호출하는 `<SiteHeader />`를 넣으면 **`cookies()` 사용으로 인해 모든 라우트가 동적 렌더링으로 전환된다** (Next.js App Router의 동적 API 규칙).

이것은 이 SPEC이 감수하기로 하는 **의도된 트레이드오프**이며, 숨기지 않고 여기 적는다.

- 현재 이 저장소의 라우트 중 정적 생성 이점을 실제로 취하고 있는 것은 홈(`src/app/page.tsx`)과 상품 상세다. 그런데 **상품 상세는 이미 `cookies()`를 호출하므로 이미 동적**이다(SPEC-REVIEW-001 M3). 새로 동적으로 전환되는 것은 사실상 홈과 잔여 정적 라우트다.
- 대안(헤더를 클라이언트 컴포넌트로 만들고 별도 세션 조회 API를 호출)은 **명시적으로 기각한다**: 새 공개 엔드포인트를 만들어야 하고, 최초 렌더에 로그인 상태가 없어 깜빡임이 생기며, 무엇보다 `project_admin-routes-middleware-bypass.md`가 기록한 실패 패턴(클라이언트에서 인증 상태를 따로 조회하려다 미들웨어 경계와 어긋남)으로 다시 들어간다.
- 성능 측정과 정적 생성 전략 재검토는 이 SPEC의 범위가 아니다(spec.md §3의 E2E/성능 제외와 같은 선).

### §B.6 기존 임시 호출 지점의 처분 — 명시적 결정

`src/app/products/[productId]/page.tsx:49`의 `resolveSession()` 호출을 어떻게 할 것인가.

**결정: 그대로 둔다(독립 유지). 헤더가 해석한 상태를 소비하도록 리팩터하지 않는다.**

근거:

1. **다른 관심사다.** 페이지 레벨의 "이 방문자가 이 상품에 리뷰를 쓸 수 있는가"는 도메인 게이트이고, 레이아웃 레벨의 "이 방문자가 로그인했는가"는 전역 지표다. 지금은 둘 다 `session !== null`로 같은 값이 나오지만, 리뷰 게이트가 나중에 구매 검증(구매한 사람만 리뷰 가능)으로 좁아지면 두 조건은 즉시 갈라진다.
2. **기술적으로 연결할 수단이 깔끔하지 않다.** 레이아웃에서 페이지로 값을 내려보내려면 React context(클라이언트 경계 필요)나 별도 상태 공유 장치가 필요한데, 둘 다 REQ-AUTH-048이 금지한다.
3. **중복 호출 비용은 실질적으로 없다.** 같은 요청 안의 두 번의 `resolveSession()`은 Next.js 요청 스코프에서 각각 한 번의 `findFirst`를 낸다. 이 비용이 문제가 될 증거가 없는 상태에서 결합을 만드는 것은 성급한 최적화다.

이 결정은 REQ-AUTH-049(보존 요구사항)와 AC-AUTH-047(특성화 회귀 가드)로 코드에 고정된다.

### §B.7 레이아웃 배치를 어떻게 검증할 것인가 — 결정 (plan-audit D2)

**문제**: "헤더가 `children`보다 앞에 있다"를 확인하려면 `RootLayout`을 렌더해야 하는데, 세 제약이 동시에 걸린다.

1. `SiteHeader`는 **동기 `RootLayout` 안에 중첩된 async 서버 컴포넌트**다. 저장소의 async 컴포넌트 테스트 선례(`product-detail-page.test.tsx:130`의 `render(await ProductDetailPage({...}))`)는 **최상위** async 컴포넌트에만 적용된다 — 중첩된 것은 await할 대상이 없다.
2. `shell.test.tsx:33-40`은 `RootLayout`을 **의도적으로 마운트하지 않는다**. 주석이 이유를 밝히고 있다 — jsdom 컨테이너 `<div>` 안에 `<html>`/`<body>`가 중첩되면 React가 경고한다.
3. 새 테스트 하네스 도입은 금지다(§D, acceptance.md §서두).

**결정: 관심사를 둘로 쪼개고, 각각 이미 있는 선례로 판정한다.** 새 하네스 없음.

| 관심사 | 판정 대상 | 하네스 | 선례 |
|---|---|---|---|
| 헤더의 **내용**(로그인/게스트 분기) | `SiteHeader` 단독 | 패턴 A — `render(await SiteHeader())` | `product-detail-page.test.tsx:130` |
| 헤더의 **배치**(children보다 앞) | `RootLayout`의 반환 element 트리 | 패턴 B — 호출만 하고 마운트 없이 트리 검사 | `shell.test.tsx:33-40` |

패턴 B가 성립하는 이유: `RootLayout({ children: MARKER })`을 호출하면 `<SiteHeader />`는 **아직 호출되지 않은 element**로 트리에 남는다. 그 `type` 필드는 `SiteHeader` 함수 참조 그 자체이므로, `body.props.children[0].type === SiteHeader`를 동일 참조 비교로 확인할 수 있다 — **async 여부와 무관하고, prisma도 쿠키도 건드리지 않으며, 마운트도 필요 없다.** `shell.test.tsx`가 이미 `tree.props.children?.type === "body"`로 같은 종류의 비교를 하고 있으므로 새로운 관례가 아니다.

구현 시 유의: 현재 `<body>`의 children은 `{children}` 단일 노드라 `props.children`이 배열이 아니다. 헤더를 추가하면 배열이 되므로, 테스트는 `Array.isArray(...)`를 먼저 확인한 뒤 `[0]`/`[1]`을 검사한다.

이 결정은 AC-AUTH-040에 그대로 반영되어 있고, M3이 이 형태로 구현한다. **run-phase에서 다시 판단할 필요가 없다.**

### §B.8 @MX 태그 계획

`.claude/rules/moai/workflow/mx-tag-protocol.md` 기준으로 신규 산출물을 사전 점검했다.

| 대상 | 태그 | 사유 |
|---|---|---|
| `SiteHeader.tsx` (기본 내보내기) | **`@MX:ANCHOR` 부여** | 루트 레이아웃이 모든 라우트에서 렌더하는 단일 진입점이다. fan_in을 호출자 수로 세면 1(layout.tsx)이지만, **실효 영향 범위는 전 라우트**다. 여기서의 회귀는 사이트 전체의 로그인 상태 표시가 깨지는 것이므로 앵커 표시가 임계값의 취지에 부합한다. `@MX:REASON`으로 "layout.tsx를 통해 모든 라우트에 렌더된다"를 함께 고정한다. |
| `SiteHeader.tsx` (같은 헤더 주석) | **`@MX:NOTE` 부여** | 이 파일이 `resolveSession()`을 재구현하지 않고 호출만 한다는 사실과 그 이유(REQ-AUTH-039), 그리고 §B.5의 동적 렌더링 귀결을 소스에 고정한다. 소스만 읽어서는 "왜 여기서 쿠키를 읽는가"가 드러나지 않는다. |
| `LogoutButton.tsx` | **`@MX:NOTE` 부여** | `csrf_token` 쿠키를 인라인 파싱하는 이유(double-submit의 클라이언트 절반)와 **공유 유틸로 추출하지 않기로 한 결정**(§B.3)을 고정한다. 이 주석이 없으면 다음 독자가 "중복이니 합치자"로 되돌린다. CancelOrderButton.tsx가 이미 같은 성격의 주석을 달고 있는 선례를 따른다. |
| `layout.tsx` 수정분 | **`@MX:NOTE` 갱신** | 기존 주석이 "header, footer, global navigation, search, and the cart icon are all excluded by spec.md §3"라고 적고 있다. 이 문장은 이 SPEC 이후 **부분적으로 거짓**이 된다. 헤더만 추가되었고 나머지는 여전히 제외임을 명시하도록 갱신한다(spec.md §1.4의 좁은 개정 표를 가리킨다). |
| `session-resolver.ts`의 기존 `@MX:NOTE` | **갱신 대상 — 단, 이 SPEC에서는 손대지 않음** | 현재 "No caller exists in this repository yet"라고 적혀 있는데 이미 거짓이다(SPEC-REVIEW-001이 호출자를 만들었다). 다만 REQ-AUTH-047이 이 파일 무변경을 요구하므로 **이 SPEC에서 고치지 않는다.** 후속 정리 후보로 여기 기록만 남긴다. |
| `@MX:WARN` / `@MX:TODO` | **부여 없음** | 신규 파일 둘 다 순환복잡도 15 미만, 전역 상태 변경 없음, 동시성 구조 없음 → WARN 사유 없음. 각각 전용 테스트 파일을 가지므로 TODO 사유 없음. |

---

## §C. Pre-flight 체크

착수 전 아래를 **실행해 확인**한다(가정 금지).

```bash
# 1. 헤더가 정말 없는지 — 매치 0건이어야 함
grep -rn "SiteHeader\|<header" src/app/layout.tsx src/components/

# 2. 로그아웃 엔드포인트 존재 및 CSRF 선행 검사 확인
grep -n "verifyCsrfRequest" src/app/api/auth/logout/route.ts

# 3. resolveSession 시그니처 무변경 확인
grep -n "export async function resolveSession" src/lib/auth/session-resolver.ts

# 4. middleware matcher 무변경 baseline
grep -n "matcher" src/middleware.ts

# 5. 기존 레이아웃 스모크 테스트 위치 확인 (수정 대상)
ls tests/unit/app/shell.test.tsx

# 6. [D9] AC-AUTH-047(b) 회귀 baseline 캡처 — 구현 착수 전에 실행할 것
npx vitest run tests/unit/app/product-detail-page.test.tsx \
              tests/unit/components/product-detail-view.test.tsx
```

**§C-6 실측 결과 (plan-phase에서 이미 캡처됨, 2026-09-05).** AC-AUTH-047(b)는 "구현 이전과 동일한 통과 개수"를 요구하는데 비교 대상 숫자가 없으면 판정할 수 없다(plan-audit D9). 아래는 plan-phase에서 위 명령을 실제 실행해 관측한 출력이다.

```
 ✓ tests/unit/components/product-detail-view.test.tsx (7 tests) 118ms
 ✓ tests/unit/app/product-detail-page.test.tsx (12 tests) 129ms

 Test Files  2 passed (2)
      Tests  19 passed (19)
```

**baseline = 12 + 7 = 19 passed / 2 files.** 이 값이 AC-AUTH-047(b)의 판정 기준값이다. run-phase는 구현 후 같은 명령을 재실행해 이 숫자와 정확히 일치하는지 확인한다 — 증가도 감소도 FAIL이다(증가는 리뷰 게이트에 테스트가 추가되었다는 뜻이고, 그것은 이 SPEC이 그 파일을 건드렸다는 신호다).

---

## §D. 제약

- **PRESERVE (수정 금지)**: `src/middleware.ts`, `src/lib/auth/session-resolver.ts`, `src/lib/auth/csrf.ts`, `src/lib/auth/cookies.ts`, `src/app/api/auth/logout/route.ts`, `src/app/products/[productId]/page.tsx`, `src/components/product/ProductDetailView.tsx`, `src/app/staff/**`, `prisma/schema.prisma`.
- **수정 허용**: `src/app/layout.tsx`(헤더 배선 + 주석 갱신), `tests/unit/app/shell.test.tsx`(헤더 존재 반영).
- **신규 의존성 없음**: `package.json`을 변경하지 않는다. 필요한 것은 전부 이미 있다(Next.js `next/headers`, `next/link`, `next/navigation`).
- **언어**: 코드 주석 영문(`code_comments: en`), 사용자 노출 문구 한국어("로그인", "내 정보", "로그아웃") — 기존 화면들과 동일.
- **테스트 하네스**: 기존 vitest + jsdom + Testing Library. 새 하네스를 도입하지 않는다.
- **시간 추정 금지**: 마일스톤은 우선순위와 순서로만 표기한다.

---

## §E. Tier 및 Route 판정

**Tier M.** 근거:

- 파일 수 7개(신규 소스 2 + 신규 테스트 3 + 기존 수정 2) — Tier M 범위(5~15) 이내.
- LOC 추정 300~500 — Tier M 범위(300~1000) 하단.
- REQ 12건 / AC 11건 — Tier M 상한(각 16) 이내, 여유 4~5건.
- 사용자가 `acceptance.md`를 별도 산출물로 명시 요구했다(Tier S는 AC를 spec.md §3에 인라인한다).

**plan-auditor PASS 임계값**: 0.80.

**Conditional Design Route**: 적용됨(`plan → design → run`). `acceptance.md`가 화면 컴포넌트를 명시적 산출물로 검증하므로 판정 기준의 첫 번째가 만족된다 — SPEC-STOREFRONT-001/002/003, SPEC-AUTH-002가 동일 기준으로 적용한 선례를 따른다. design phase가 헤더의 배치·간격·텍스트 문구 확정을 이어받는다. **이 plan-phase에서는 판정만 기록하고 design phase를 실행하지 않는다.**

**SPEC lifecycle Route**: Tier M이므로 Route A(Hybrid Trunk main-direct) 대상 — PR 없이 커밋/푸시 이벤트로 phase가 전이된다.

---

## §F. 마일스톤

바뀔 가능성이 높은 결정부터 배치했다. M1·M2는 사용자에게 보이는 동작과 새 컴포넌트 계약을 정하므로 리뷰가 여기에 집중되어야 하고, M3·M4는 기계적이다.

### M1 — 헤더의 상태 표현 (가장 되돌리기 어려운 결정)

- `src/components/layout/SiteHeader.tsx` 신규. `async` 서버 컴포넌트, `resolveSession(await cookies())` 1회 호출.
- 비로그인: `/login`으로 가는 "로그인" 링크(`next/link`). 로그인: "내 정보" 표시 + `<LogoutButton />`.
- `null` 반환 사유를 구분하지 않는다(REQ-AUTH-040) — 분기는 `session !== null` 단 하나.
- 장바구니·검색·내비 메뉴 없음(REQ-AUTH-046).
- 테스트: `tests/unit/components/site-header.test.tsx` — `resolveSession`을 모킹해 게스트/회원/무효세션 3분기 렌더 검증.
- 검증 대상 AC: AC-AUTH-037, AC-AUTH-038, AC-AUTH-039, AC-AUTH-044.

### M2 — 로그아웃 어포던스 (두 번째로 되돌리기 어려운 결정)

- `src/components/layout/LogoutButton.tsx` 신규. `"use client"`, props 없음.
- `document.cookie`에서 `csrf_token` 인라인 파싱(§B.3 선례 그대로) → `fetch("/api/auth/logout", { method: "POST", headers: { "X-CSRF-Token": ... }, credentials: "same-origin" })`.
- 200 → `router.refresh()`(§B.4). 비-200 → 이동/갱신 없음, 로그인 표시 유지(REQ-AUTH-045).
- 테스트: `tests/unit/components/logout-button.test.tsx` — 요청 형태(1회 호출, 헤더 값이 쿠키 값과 일치), 200 경로, 실패 경로.
- 검증 대상 AC: AC-AUTH-041, AC-AUTH-042, AC-AUTH-043.

### M3 — 루트 레이아웃 배선

- `src/app/layout.tsx` 수정: `<body>` 안, `{children}` 위에 `<SiteHeader />` 삽입.
- 기존 헤더 주석을 §B.8 표대로 갱신 — 헤더만 추가되고 푸터·검색·장바구니 아이콘·내비는 여전히 제외임을 명시.
- `tests/unit/app/shell.test.tsx` 수정: **§B.7 패턴 B**로 배치를 검증하는 `it` 하나 추가 — `RootLayout({ children: MARKER })`을 호출만 하고(마운트 없음), `<html>` → `<body>`의 `props.children`이 배열인지 확인한 뒤 `[0].type === SiteHeader`(동일 참조)와 `[1] === MARKER`를 단정한다. 기존 `RootLayout` describe 블록의 단정은 **제거하지 않고 추가만** 한다(`tree.props.children?.type === "body"`는 그대로 통과한다 — `<body>` 자체는 여전히 `<html>`의 단일 자식이다).
- 검증 대상 AC: AC-AUTH-040. **판정 방법은 §B.7에서 이미 확정했으므로 run-phase에서 재결정하지 않는다.**

### M4 — 경계 회귀 가드 (기계적)

- `tests/unit/components/site-header-boundary-static.test.ts` 신규 — 신규 소스 2종에 대한 정적 스캔: `Authorization` / `Bearer` / `localStorage` / `sessionStorage` / `createContext` / `useAuth` / 장바구니·검색 관련 식별자 매치 0건.
- PRESERVE 확인: `git diff --stat`으로 `src/middleware.ts`, `src/lib/auth/session-resolver.ts`, `src/app/products/[productId]/page.tsx` 무변경 확인 + `tests/unit/middleware.test.ts`, `tests/unit/auth/session-resolver.test.ts`, `tests/unit/app/product-detail-page.test.tsx` 무회귀 확인.
- 검증 대상 AC: AC-AUTH-045, AC-AUTH-046, AC-AUTH-047.

---

## §G. 안티패턴 (범하지 말 것)

1. **csrf 쿠키 파서를 공유 유틸로 추출하기.** 세 번째 소비자가 생겼으니 합치고 싶어지지만, 그러려면 `CancelOrderButton.tsx`와 `ProductForm.tsx`(둘 다 PRESERVE)를 수정해야 한다. §B.3.
2. **헤더를 클라이언트 컴포넌트로 만들고 `/api/auth/me` 같은 세션 조회 엔드포인트를 새로 만들기.** 새 공개 표면 + 깜빡임 + `project_admin-routes-middleware-bypass.md`가 기록한 실패 패턴 재진입. §B.5.
3. **액세스 토큰을 `Authorization` 헤더로 실어 상태를 조회하기.** 이 저장소에서 `/staff/*`가 조용히 깨졌던 바로 그 경로다. 정본은 언제나 "httpOnly 쿠키를 서버에서 해석"이다. REQ-AUTH-048.
4. **리뷰 게이트를 헤더 상태 소비로 리팩터하기.** §B.6에서 명시적으로 기각했다. REQ-AUTH-049.
5. **"이왕 헤더 만드는 김에" 장바구니 배지·검색창·푸터 추가하기.** SPEC-STOREFRONT-001/002/003이 의도적으로 이연한 결정이다. spec.md §3.
6. **`middleware.ts`의 matcher를 확장해 고객 라우트를 보호하기.** 이 SPEC은 어떤 라우트도 보호하지 않는다 — 헤더는 표시만 한다. REQ-AUTH-047.
7. **`session-resolver.ts`의 낡은 `@MX:NOTE`("No caller exists yet")를 고치기.** 실제로 낡았지만 그 파일은 PRESERVE다. §B.8에 후속 후보로 기록해 두는 선까지다.
8. **로그아웃 성공 시 `router.push("/")`로 홈 이동시키기.** §B.4에서 기각했다 — 방문자가 요청하지 않은 이동이다.

---

## §H. 교차 참조

- `spec.md` §1.1 — 정정된 전제 (요약본). 이 문서 §A.1이 근거 인용을 포함한 상세본.
- `spec.md` §1.2 — 쓰기 측 회원 체크아웃과의 구분.
- `spec.md` §1.4 — 좁은 범위의 선행 결정 개정 표.
- `acceptance.md` — AC-AUTH-037~047 및 REQ↔AC 매핑 표.
- SPEC-AUTH-001 — `refresh_token` 쿠키(REQ-AUTH-008), 액세스 토큰 메모리 전용(REQ-AUTH-009), CSRF double-submit(REQ-AUTH-023), 로그아웃 라우트(REQ-AUTH-013).
- SPEC-AUTH-002 — `resolveSession()`(REQ-AUTH-033~035), 로그아웃 UI·공통 헤더 제외 결정(§3, 이 SPEC이 좁게 개정).
- SPEC-REVIEW-001 — 기존 호출자 2곳 모두의 소유 SPEC: 페이지 레벨 표시 게이트(REQ-REVIEW-008)와 API 라우트 인증 게이트(REQ-REVIEW-003/012).
- SPEC-STOREFRONT-001 §3 — 헤더/푸터/내비/검색/장바구니 아이콘 제외(이 SPEC이 헤더 부분만 좁게 개정).
- SPEC-STOREFRONT-002 §3 / SPEC-STOREFRONT-003 §3 — 장바구니 배지·전역 내비 이연 결정(유지).
- SPEC-ORDER-001 §3 — 쓰기 측 회원 체크아웃 제외 및 읽기 측 대안 2건의 기각 이력.
- SPEC-ADMIN-001 — `resolveAdminSession()` 선례(공유 쿠키 리졸버가 다수 호출자에서 동작함을 보인 근거).
- `project_admin-routes-middleware-bypass.md` (메모리) — 클라이언트에서 인증 상태를 따로 조회하려다 미들웨어 경계와 어긋난 실패 기록. §G-2/§G-3의 근거.

**미해결 명료화 항목: 없음 (clarification 마커 0건).** 이 SPEC의 모든 범위 결정(헤더 내용을 로그인 상태로 한정, 장바구니·검색 제외, `resolveSession()` 재사용, `middleware.ts`·REQ-AUTH-009·guest-identity 불가침, 쓰기 측 체크아웃 제외, 좁은 개정 범위)은 착수 전 사용자 AskUserQuestion 라운드로 확정된 상태로 위임되었다. plan-phase 중 새로 발견된 미해결 모호성이 없다.
