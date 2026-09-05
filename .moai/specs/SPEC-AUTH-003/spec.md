---
id: SPEC-AUTH-003
title: "서버 렌더링 로그인 상태 확인 방식의 정본화 및 공유 사이트 헤더"
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
depends_on: [SPEC-AUTH-002]
related_specs: [SPEC-AUTH-001, SPEC-REVIEW-001, SPEC-STOREFRONT-001, SPEC-STOREFRONT-002, SPEC-STOREFRONT-003, SPEC-ADMIN-001, SPEC-ORDER-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-05 | 0.1.0 | draft | plan-phase 최초 작성. 착수 전 Explore 정찰 1회 + 사용자 Socratic AskUserQuestion 라운드로 범위가 확정된 상태로 위임됨. 원 카드의 전제("SPEC-AUTH-001의 메모리 전용 토큰과 구조적으로 충돌한다")가 **사실이 아님**이 정찰로 확인되어, §1에 정정 기록을 남기고 SPEC의 목적 자체를 "해결"에서 "정본화 + 최초 소비자 구축"으로 재정의했다. 미해결 명료화 항목 없음. |

---

## §1. 개요

이 SPEC은 두 가지를 한다.

1. **정본화** — 서버 렌더링(SSR) 화면이 로그인 상태를 확인하는 방식으로 `resolveSession()`(`src/lib/auth/session-resolver.ts`)을 **이 저장소의 정본 설계 결정으로 문서에 고정**한다. 새 메커니즘을 발명하지 않는다.
2. **최초 소비자 구축** — 이 저장소에 아직 하나도 없는 **공유 사이트 헤더**를 만들고, 그 헤더가 위 정본 방식의 첫 레이아웃 레벨 소비자가 된다. 헤더가 표시하는 것은 **로그인 상태 하나뿐**이다.

### §1.1 정정된 전제 — 읽기 측 충돌은 존재하지 않는다 (가장 중요한 절)

이 SPEC을 낳은 원래 카드는 다음과 같이 적혀 있었다.

> "서버 렌더링 화면에서 로그인 상태를 확인할 방법이 SPEC-AUTH-001의 메모리 전용 토큰과 **구조적으로 충돌한다**."

**이 전제는 틀렸다.** 착수 전 정찰(Explore, 읽기 전용)로 확인한 사실은 다음과 같다. 이 정정을 여기 남기는 이유는, 근거가 없으면 다음 독자가 같은 혼동을 처음부터 다시 유도해 내기 때문이다.

1. **메모리 전용인 것은 액세스 토큰 하나뿐이다.** REQ-AUTH-009는 *액세스 토큰*을 클라이언트 메모리에만 두기로 했다(XSS 완화). 이 결정은 사실이고, 이 SPEC은 이것을 **전혀 건드리지 않는다**.
2. **로그인은 액세스 토큰 말고도 httpOnly `refresh_token` 쿠키를 따로 발급한다.** REQ-AUTH-008 / `src/lib/auth/cookies.ts`의 `buildRefreshTokenCookie()` — 회전·폐기의 원본(source of truth)이며, `httpOnly: true`, `sameSite: "lax"`, `path: "/"`이다. 브라우저는 이 쿠키를 **최상위 SSR 내비게이션을 포함한 모든 요청에 자동으로 실어 보낸다.** 즉 서버 렌더 시점에 읽을 수 있는 신원 채널이 처음부터 존재했다.
3. **그 채널을 읽는 함수는 이미 만들어져 있고 동작한다.** `resolveSession(cookieStore)` — `src/lib/auth/session-resolver.ts:54`. 쿠키를 읽고, 해시하고, `RefreshToken` 레코드를 조회해 `{userId, role} | null`을 돌려준다. **읽기 전용**이다(REQ-AUTH-034: 회전·재발급·레코드 변형 없음).
4. **실사용 호출자도 이미 있다.** `src/app/products/[productId]/page.tsx:49` — SPEC-REVIEW-001이 리뷰 작성 폼과 로그인 유도 링크를 가르는 게이트로 쓰고 있으며, 프로덕션에서 동작 중이다.

**결론**: 읽기 측(SSR 화면이 "이 방문자가 로그인했는가"를 아는 문제)은 **이미 풀려 있다**. 이 SPEC의 일은 그것을 다시 푸는 것이 아니라, **리뷰 도메인 안에서만 쓰이던**(§1.3의 호출자 2곳 — 페이지 레벨 표시 게이트와 API 라우트 인증 게이트) 그 결정을 문서로 고정하고 **최초의 레이아웃 레벨 소비자**를 세우는 것이다.

### §1.2 이 SPEC이 해결하지 **않는** 다른 충돌 — 쓰기 측 회원 체크아웃

혼동이 잦은 지점이라 명시적으로 갈라 둔다. **읽기 측(이 SPEC)과 쓰기 측(회원 체크아웃)은 이름만 비슷할 뿐 서로 다른 문제다.**

| | 읽기 측 (이 SPEC) | 쓰기 측 (여전히 미해결) |
|---|---|---|
| 질문 | 이 SSR 요청의 방문자는 로그인했는가? | 이 주문을 어느 회원의 것으로 기록하는가? |
| 상태 | **해결됨** — `resolveSession()`이 refresh_token 쿠키로 판정 | **미해결** — SPEC-ORDER-001 §3 |
| 막는 것 | 없음 | `Order`에 `userId` 컬럼이 없음 + `POST /api/orders`가 유효한 회원 자격 증명을 제시하는 요청을 거부(REQ-ORDER-021) |
| 필요한 작업 | 없음(이 SPEC은 소비만) | `prisma/schema.prisma` 마이그레이션 + 주문 생성 경로 재설계 |

**이 SPEC의 정본화는 회원 체크아웃을 뚫어 주지 않는다.** 회원 주문이 막힌 이유는 "서버가 회원을 식별할 수 없어서"가 아니라(그건 `resolveSession()`으로 가능하다), **데이터 모델이 주문을 회원에 귀속시킬 수 없고 API가 그것을 코드로 강제 거부하기 때문**이다. SPEC-ORDER-001 §3이 이미 그 경계를 상세히 기록했고, 그 SPEC이 **읽기 측 대안 두 가지**(서버가 읽을 수 있는 세션 쿠키 도입 / 체크아웃을 클라이언트 주도로 반전)를 명시적으로 기각한 이력도 함께 남겼다. 그 기각 이력이 있다는 사실 자체가, 두 문제가 서로 다른 역사를 가진 별개의 질문임을 보여 준다 — 이 SPEC은 그 기각된 대안 중 어느 것도 되살리지 않는다(refresh_token 쿠키는 SPEC-AUTH-001이 이미 발급하던 것이고, 새 쿠키를 도입하는 것이 아니다).

### §1.3 왜 지금 헤더인가 — 소비자가 둘 다 페이지·라우트 레벨이라는 사실

`resolveSession()`은 현재 저장소 전체에서 **호출자가 둘**이다(`grep -rn 'resolveSession(' src/`로 확인).

| 호출자 | 레벨 | 용도 |
|---|---|---|
| `src/app/products/[productId]/page.tsx:49` | 페이지 | 리뷰 작성 폼 vs 로그인 유도 링크 게이트(SPEC-REVIEW-001) |
| `src/app/api/reviews/route.ts:29` | API 라우트 | 리뷰 작성 요청의 인증 게이트 — `null`이면 401(REQ-REVIEW-003) |

**둘 다 "리뷰를 쓸 수 있는가"라는 단일 도메인 관심사의 양면이며, 레이아웃 레벨 소비자는 아직 하나도 없다.** 즉 "SSR에서 로그인 상태를 확인하는 정본 방식"이라는 주장은 지금까지 리뷰 기능 하나의 요구로만 뒷받침되고 있고, 전역 표시 목적으로 쓰인 적이 없다. 이 저장소에는 **공유 사이트 헤더가 존재하지 않으며**(`src/app/layout.tsx`가 헤더·푸터·내비게이션·검색창·장바구니 아이콘을 전부 명시적으로 제외했다 — SPEC-STOREFRONT-001 §3), 그 결과 방문자는 어느 화면에서도 자신이 로그인했는지 알 수 없고 로그아웃할 방법도 없다.

선례는 이미 있다. `resolveAdminSession()`(`src/features/admin/services/admin-session.ts`)은 **같은 쿠키 기반 서버 사이드 해석 패턴**을 관리자 영역에서 5곳 이상의 페이지·라우트가 공유해 쓰고 있으며(SPEC-ADMIN-001~003), `resolveSession()`은 그 함수에서 `role !== "admin"` 필터만 제거해 일반화한 것이다. 공유 리졸버가 다수 호출자에 걸쳐 end-to-end로 동작한다는 것은 이미 검증된 사실이다 — 이 SPEC은 그 검증된 패턴을 고객 영역 레이아웃으로 확장한다.

### §1.4 좁은 범위의 선행 결정 개정 (narrow supersession)

이 SPEC은 SPEC-STOREFRONT-001 §3의 "공통 레이아웃 UI (헤더 / 푸터 / 내비게이션)" 제외 결정 중 **헤더의 존재 여부 부분만** 좁게 개정한다.

| 선행 결정 | 이 SPEC의 처분 |
|---|---|
| SPEC-STOREFRONT-001 §3 — 헤더 없음 | **개정함** — 로그인 상태 표시 전용 헤더를 추가 |
| SPEC-STOREFRONT-001 §3 — 푸터 없음 | **유지** — 이 SPEC도 만들지 않음 |
| SPEC-STOREFRONT-001 §3 — 검색창 없음 | **유지** — SPEC-CATALOG-002의 검색 UI SPEC 대상 |
| SPEC-STOREFRONT-001/002 §3 — 장바구니 아이콘·배지 없음 | **유지** — SPEC-STOREFRONT-002가 의도적으로 이연한 결정을 그대로 둠 |
| SPEC-STOREFRONT-003 §3 — 전역 내비게이션 메뉴 없음 | **유지** — 카테고리/메뉴 링크 없음 |
| SPEC-AUTH-002 §3 — 로그아웃 UI 없음 | **개정함** — 헤더 안의 로그아웃 어포던스로 한정해 추가 |
| SPEC-AUTH-002 §3 — 공통 헤더/내비게이션 없음 | **개정함** — 헤더만, 내비게이션은 아님 |

**이것은 내비게이션 범위 전체를 다시 여는 것이 아니다.** 개정 대상은 위 표에서 "개정함"으로 표시된 세 줄뿐이고, 나머지는 선행 SPEC이 남긴 그대로다.

### §1.5 소비하는 기존 계약 (변경하지 않음)

- **`resolveSession(cookieStore)`** — `src/lib/auth/session-resolver.ts:54`. `SessionCookieStore`(`get(name)`만 있는 덕 타이핑 인터페이스)를 받아 `Promise<Session | null>`을 반환. 실패 사유(쿠키 부재 / 미일치 / 폐기 / 만료)는 전부 동일한 `null`로 붕괴한다(REQ-AUTH-035).
- **`POST /api/auth/logout`** — `src/app/api/auth/logout/route.ts`. 이미 존재한다. **DB 접근 이전에 `verifyCsrfRequest()`를 먼저 검사**하며(REQ-AUTH-023), 통과하지 못하면 403 `"Invalid or missing CSRF token"`. 통과하면 이 세션의 refresh 토큰만 폐기하고 `buildExpiredRefreshTokenCookie()`로 쿠키를 만료시킨 뒤 200을 반환한다. 쿠키가 없거나 토큰을 못 찾아도 200이다(멱등).
- **`csrf_token` 쿠키** — `src/lib/auth/csrf.ts`의 `buildCsrfCookie()`가 **의도적으로 `httpOnly: false`**로 발급한다. 클라이언트 JS가 값을 읽어 `X-CSRF-Token` 헤더로 되돌려 보내는 double-submit 패턴의 절반이다. 이 저장소에는 이미 그 소비 선례가 두 곳 있다 — `src/app/staff/orders/[orderId]/CancelOrderButton.tsx:29`와 `src/app/staff/products/ProductForm.tsx:38`이 동일한 인라인 `document.cookie` 파싱을 쓴다.

세 계약 모두 이 SPEC에서 **수정하지 않는다**.

---

## §2. 요구사항 (GEARS)

### 정본화 — SSR 로그인 상태 확인

- **REQ-AUTH-038** (Ubiquitous): 서버 렌더링 화면에서 로그인 상태를 확인하는 정본 수단은 `resolveSession()`(`src/lib/auth/session-resolver.ts`)이어야 하며, 사이트 헤더는 그 함수를 **있는 그대로 호출**해 상태를 판정해야 한다.

- **REQ-AUTH-039** (Unwanted): 사이트 헤더는 세션 해석 로직(쿠키 읽기, 토큰 해싱, `RefreshToken` 조회)을 **자체 구현해서는 안 되며**, `resolveSession()`의 본문을 수정해서도 안 된다.

- **REQ-AUTH-040** (When — 이벤트 탐지): `resolveSession()`이 `null`을 반환하면(쿠키 부재 / 미일치 / 폐기 / 만료 중 어느 사유이든), 사이트 헤더는 **동일한 게스트 상태**를 렌더해야 하며 사유를 구분하거나 노출해서는 안 된다 — REQ-AUTH-035가 정한 붕괴 동작을 그대로 존중한다.

### 공유 사이트 헤더

- **REQ-AUTH-041** (Ubiquitous): 루트 레이아웃(`src/app/layout.tsx`)은 모든 라우트의 본문 콘텐츠 위에 공유 사이트 헤더를 렌더해야 한다.

- **REQ-AUTH-042** (While — 비로그인 상태): 방문자가 로그인하지 않은 동안, 헤더는 `/login`으로 향하는 "로그인" 링크를 표시해야 한다.

- **REQ-AUTH-043** (While — 로그인 상태): 방문자가 로그인한 동안, 헤더는 "내 정보" 표시와 로그아웃 어포던스를 표시해야 하고 "로그인" 링크를 표시해서는 안 된다.

- **REQ-AUTH-044** (When — 이벤트 구동): 방문자가 로그아웃 어포던스를 활성화하면, 헤더는 `csrf_token` 쿠키 값을 `X-CSRF-Token` 헤더에 실어 `POST /api/auth/logout`을 호출하고, 200 응답을 받으면 게스트 상태가 반영되도록 화면을 갱신해야 한다.

- **REQ-AUTH-045** (When — 이벤트 탐지): 로그아웃 요청이 비-200 응답으로 실패하면, 헤더는 화면을 이동시키지 않고 로그인 상태 표시를 유지해야 한다.

### 경계 (Unwanted)

- **REQ-AUTH-046** (Unwanted): 사이트 헤더는 장바구니 아이콘·장바구니 개수 배지·검색 입력창·카테고리 내비게이션 메뉴·푸터를 포함해서는 안 된다.

- **REQ-AUTH-047** (Unwanted): 이 SPEC은 `src/middleware.ts`(matcher `["/admin/:path*"]` 포함), `src/lib/auth/session-resolver.ts`, `src/lib/auth/guest-identity.ts`, REQ-AUTH-009의 액세스 토큰 전송 설계를 변경해서는 안 된다.

- **REQ-AUTH-048** (Unwanted): 사이트 헤더는 액세스 토큰을 `Authorization` 헤더로 실어 보호 라우트를 조회해서는 안 되며, 클라이언트 측 인증 상태 저장소(React context / `useAuth` / `localStorage` / `sessionStorage`)를 도입해서도 안 된다.

- **REQ-AUTH-049** (Ubiquitous — 보존): 상품 상세 화면의 리뷰 작성 게이트(`src/app/products/[productId]/page.tsx`의 `resolveSession()` 호출과 `ProductDetailView`의 `isLoggedIn` prop)는 기존 동작 그대로 유지되어야 하며, 헤더가 해석한 상태를 소비하도록 리팩터되어서는 안 된다.

> REQ 12건 — Tier M 상한(16) 이내, 여유 4건.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다. "이왕 헤더 만드는 김에"로 번지기 가장 쉬운 자리라 경계를 촘촘히 못 박는다.

### Out of Scope — 장바구니 아이콘 및 장바구니 개수 배지

- 헤더에 장바구니 아이콘, 장바구니로 가는 전역 링크, 담긴 개수 배지를 넣지 않는다.
- 이것은 누락이 아니라 **의도된 경계의 승계**다. SPEC-STOREFRONT-001 §3이 "장바구니 아이콘"을 명시적으로 제외했고, SPEC-STOREFRONT-002 §3이 "헤더·푸터·전역 내비게이션·장바구니 배지" 절에서 그 결정을 다시 확인하며 `/cart` 진입 수단을 담기 성공 후 링크(REQ-STOREFRONT-025)와 주소 직접 입력으로 한정했다. 이 SPEC은 그 이연 결정을 **다시 열지 않는다**.

### Out of Scope — 검색창

- 헤더에 검색 입력창을 넣지 않는다. 같은 이유다 — SPEC-STOREFRONT-001 §3이 검색창을 제외했고, 키워드 검색 UI는 SPEC-CATALOG-002를 드러내는 별도 화면 SPEC의 대상이다.

### Out of Scope — 푸터 및 전역 내비게이션 메뉴

- 푸터, 카테고리 메뉴, 드롭다운 내비게이션, 모바일 햄버거 메뉴, 브레드크럼을 만들지 않는다. §1.4의 개정 대상은 **헤더의 존재와 그 안의 로그인 상태 표시**로 한정된다.

### Out of Scope — 회원 체크아웃 및 `Order`-`User` 귀속 (쓰기 측 충돌)

- `prisma/schema.prisma`를 수정하지 않으며 `Order`에 `userId`를 추가하지 않는다. `POST /api/orders`의 회원 자격 증명 거부 동작(REQ-ORDER-021)도 건드리지 않는다.
- 근거는 §1.2에 전부 적었다 — 그 문제는 이 SPEC이 다루는 읽기 측 문제와 **다른 문제**이며, SPEC-ORDER-001 §3이 소유자를 이미 후속 SPEC으로 지정해 두었다.

### Out of Scope — 액세스 토큰 전송 설계 재개정

- REQ-AUTH-009(액세스 토큰 메모리 전용)를 재검토하거나 우회하지 않는다. 헤더는 액세스 토큰을 전혀 다루지 않는다.
- `src/middleware.ts`의 matcher를 확장하지 않는다 — 여전히 `/admin/:path*` 하나뿐이며, 이 SPEC이 만드는 화면은 어느 것도 보호 라우트가 아니다.

### Out of Scope — 게스트 신원(guest-identity) 연동

- `src/lib/auth/guest-identity.ts`는 게스트 장바구니 신원을 다루는 **직교하는 별개 관심사**다. 헤더는 게스트 쿠키를 읽지 않고, 로그인 상태와 게스트 장바구니 상태를 연결하지 않는다.

### Out of Scope — 마이페이지 / 회원 정보 화면

- 헤더의 "내 정보" 표시는 **로그인했다는 사실의 지표**이지 마이페이지로 가는 완성된 동선이 아니다. `/mypage`·`/account` 같은 회원 정보 화면, 주문 내역 화면, 프로필 수정은 만들지 않는다.

### Out of Scope — `resolveAdminSession` 리팩터 및 관리자 헤더

- `resolveAdminSession()`이 `resolveSession()`에 위임하도록 리팩터하는 일은 SPEC-AUTH-002 §3이 이미 후속 후보로만 기록했다. 이 SPEC도 그대로 둔다.
- `/staff/*` 관리자 화면에 이 헤더를 적용하거나 관리자 전용 헤더를 만들지 않는다.

### Out of Scope — 디자인 시스템 및 반응형 심화

- 재사용 UI 컴포넌트 라이브러리(`src/components/ui/`), 디자인 토큰 체계, 다크 모드, 스크롤 고정(sticky) 동작, 진입 애니메이션은 만들지 않는다. 헤더의 시각 처리는 기존 화면들이 이미 쓰는 Tailwind 유틸리티 관례를 따르는 선까지다.

### Out of Scope — E2E 및 브라우저 레이아웃 검증

- Playwright 등 브라우저 E2E 하네스를 도입하지 않는다. 검증은 기존 vitest + jsdom 컴포넌트 단위 테스트까지다. 브라우저 레이아웃 엔진이 있어야만 관측 가능한 항목(실제 뷰포트에서의 줄바꿈 등)은 자동 검증 대상이 아니다 — SPEC-STOREFRONT-001 §3이 확립한 동일 경계를 따른다.

---

## §4. 후속 SPEC을 위한 전방 포인터

- **회원 체크아웃 SPEC** — §1.2의 쓰기 측 문제를 소유한다. 이 SPEC이 정본화한 `resolveSession()`을 **읽기 수단으로 재사용**할 수 있으나, 그것만으로는 충분하지 않다. `Order` 귀속 컬럼 마이그레이션과 `POST /api/orders`의 거부 동작 개정이 그 SPEC의 본체다.
- **마이페이지 SPEC** — 헤더의 "내 정보"가 실제로 향할 화면. 이 SPEC은 그 화면의 설계를 앞질러 정하지 않는다.
- **헤더 확장 SPEC(장바구니 배지 / 검색)** — SPEC-STOREFRONT-002가 이연한 장바구니 배지와 SPEC-CATALOG-002의 검색 UI가 헤더에 붙을 자리. 이 SPEC이 만드는 헤더는 그 확장을 막지 않되, 미리 자리를 예약하지도 않는다.
