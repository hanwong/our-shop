---
id: SPEC-AUTH-004
title: "staff 화면에서 고객용 사이트 헤더 노출 제거 — (shop) 라우트 그룹 분리"
version: "0.1.0"
status: draft
created: 2026-09-05
updated: 2026-09-05
author: snake
priority: P1
phase: "v0.2.0 target"
module: "src/app"
lifecycle: spec-anchored
tags: "auth, ui, header, layout, route-group, bugfix"
tier: M
depends_on: [SPEC-AUTH-003]
related_specs: [SPEC-AUTH-001, SPEC-AUTH-002, SPEC-ADMIN-001, SPEC-ADMIN-002, SPEC-ADMIN-003, SPEC-STOREFRONT-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-05 | 0.1.0 | draft | plan-phase 최초 작성. SPEC-AUTH-003(머지 완료, `completed`) 위에 올라가는 버그픽스 SPEC. 원 버그 리포트의 증상 서술("staff 화면이 로그아웃된 것처럼 보인다")은 **사실이 아님**이 확인되어 §1.1에 정정 기록을 남겼다 — 실제 위험은 반대 방향이며 더 심각하다. 착수 전 사용자 라운드에서 수정 **결정**(헤더를 숨긴다 / 관리자 전용 헤더를 만들지 않는다)이 확정됐고, 그 결정을 실현하는 **메커니즘**은 plan-phase 검증 과정에서 두 차례 정정됐다(§1.3). 미해결 명료화 항목 없음(0건). |

---

## §1. 배경 — 무엇이 실제로 잘못됐는가

### §1.1 원 리포트의 증상 서술 정정

원 버그 리포트는 "staff 화면이 **로그아웃된 것처럼** 보인다(로그인하지 않은 것처럼 '로그인'이 표시된다)"고 기술했다. **이 서술은 사실이 아니다.** 코드를 직접 확인한 결과는 정반대다.

- `resolveSession()`(`src/lib/auth/session-resolver.ts:54-72`)과 `resolveAdminSession()`(`src/features/admin/services/admin-session.ts:50-77`)은 **같은 쿠키**(`refresh_token`)와 **같은 테이블**(`prisma.refreshToken`)을 읽는다. 둘의 유일한 차이는 역할 필터의 유무다 — `resolveSession()`에는 역할 필터가 **없고**(`session-resolver.ts:67-71`), `resolveAdminSession()`만 `role !== "admin"`을 `null`로 접는다(`admin-session.ts:72-74`).
- staff 구성원은 고객과 **동일한** `POST /api/auth/login` 엔드포인트로 로그인한다 — `src/app/staff/login/page.tsx:50`이 그 경로를 직접 호출하며, 별도의 관리자 로그인 라우트는 이 저장소에 존재하지 않는다. 따라서 staff는 고객이 받는 것과 같은 쿠키를 받는다.
- 그러므로 유효한 staff 세션에 대해 `resolveSession()`은 **`null`이 아닌** `{userId, role: "admin"}`을 반환한다. `SiteHeader`(`src/components/layout/SiteHeader.tsx:34-41`)는 그 분기에서 "로그인"이 아니라 **"내 정보" + 로그아웃 버튼**을 렌더한다.

### §1.2 실제 위험 — 관리자 세션의 무자각 종료

정정된 사실이 원 서술보다 **더 심각하다**. staff 화면에 표시되는 그 로그아웃 버튼은 `POST /api/auth/logout`(`src/app/api/auth/logout/route.ts:36-64`)에 연결되어 있고, 이 라우트의 폐기 경로에는 **역할 검사가 없다**. 쿠키에서 얻은 `tokenHash`로 행을 찾아 그대로 `revokedAt`을 찍는다(`logout/route.ts:43-58`).

결과: staff 구성원이 화면 상단의 평범한 고객용 "로그아웃" 버튼으로 보이는 것을 누르면, **자신의 유효한 관리자 세션이 종료된다.** 그것이 관리자 세션에 영향을 주는 동작이라는 UI 단서는 어디에도 없다.

### §1.3 근인(root cause)

`src/app/staff/`에는 자체 `layout.tsx`가 없다. 저장소 전체에서 레이아웃 파일은 `src/app/layout.tsx` 하나뿐이며, 그 루트 레이아웃이 `<SiteHeader />`를 **무조건** 렌더한다(`src/app/layout.tsx:51`). Next.js App Router의 레이아웃은 라우트 세그먼트를 따라 **중첩**되므로, `/staff/**`도 이 헤더를 그대로 상속한다.

핵심 제약 — **중첩 레이아웃은 부모 레이아웃이 이미 렌더한 UI를 제거할 수 없다.** Next.js 공식 문서는 `layout.js`를 "route segment 안에서 가장 바깥 컴포넌트"로 정의하며, 부모 레이아웃 위에 겹쳐지는 것이 아니라 그 `{children}` **안쪽에** 놓인다. 따라서 `src/app/staff/layout.tsx`를 새로 만들어 `{children}`만 렌더하는 방식으로는 이 결함이 **해결되지 않는다**(no-op). 이 SPEC은 그 접근을 채택하지 않는다.

성립하는 유일한 구조적 해법은 **헤더를 상속 경로에서 내리는 것**이다 — 헤더를 루트 레이아웃에서 떼어내 고객 라우트만 감싸는 라우트 그룹 레이아웃으로 옮기고, `/staff/**`는 그 그룹 밖에 두어 애초에 헤더를 만나지 않게 한다.

### §1.4 SPEC-AUTH-003이 남긴 미집행 의도

SPEC-AUTH-003 `spec.md` §3은 이미 이렇게 적었다 — "`/staff/*` 관리자 화면에 이 헤더를 적용하거나 관리자 전용 헤더를 만들지 않는다." 그 문장은 **두 개의 약속**이다. 뒤쪽 절반(관리자 전용 헤더를 만들지 않는다)은 지켜졌지만, 앞쪽 절반(이 헤더를 staff에 적용하지 않는다)은 **의도로만 적혔고 기계적으로 집행되지 않았다** — 루트 레이아웃에 무조건 배선하는 순간 staff는 자동으로 헤더를 상속받았기 때문이다. 이 SPEC은 그 앞쪽 절반을 집행한다.

---

## §2. 요구사항 (GEARS)

### 레이아웃 구조

- **REQ-AUTH-050** (Ubiquitous): 루트 레이아웃(`src/app/layout.tsx`)은 `<html>`/`<body>` 문서 셸과 `{children}`만 렌더해야 하며, `SiteHeader`를 렌더해서는 안 된다.

- **REQ-AUTH-051** (Ubiquitous): 신규 `src/app/(shop)/layout.tsx`는 `{children}`보다 앞서 `SiteHeader`를 정확히 1회 렌더해야 한다.

- **REQ-AUTH-052** (Ubiquitous): 모든 고객 대면 라우트 세그먼트는 `(shop)` 라우트 그룹 안에 위치해야 한다.

### staff 화면의 헤더 부재

- **REQ-AUTH-053** (While — staff 라우트 렌더 중): `/staff/**` 아래 라우트가 렌더되는 동안, 그 렌더 출력은 `SiteHeader`의 어떤 콘텐츠도 포함해서는 안 된다 — "로그인" 링크, "내 정보" 표시, 로그아웃 어포던스 전부.

- **REQ-AUTH-054** (Unwanted): `resolveSession()`이 staff 요청에 대해 유효 세션을 반환하더라도(관리자 역할 포함), staff 화면은 헤더를 렌더해서는 안 된다. 숨김은 **무조건**이며 세션 상태에 조건부가 아니다 — 게스트·유효 staff 세션·만료/폐기 세션 세 경우 모두 동일하게 헤더가 없어야 한다.

### 회귀 방지

- **REQ-AUTH-055** (Ubiquitous): 고객 라우트의 URL 경로는 이동 전후로 동일해야 한다 — 라우트 그룹 디렉터리명은 URL에 포함되지 않는다.

- **REQ-AUTH-056** (While — 고객 라우트 렌더 중): 고객 라우트가 렌더되는 동안, 렌더 출력은 SPEC-AUTH-003이 확립한 로그인 상태 표시(비로그인 시 "로그인" 링크 / 로그인 시 "내 정보" + 로그아웃)를 이전과 동일하게 포함해야 한다.

### 경계 (Unwanted)

- **REQ-AUTH-057** (Unwanted): 이 SPEC은 관리자 전용 헤더·관리자 전용 로그아웃 UI·역할 인지 헤더 분기를 만들어서는 안 되며, `src/app/staff/**`의 기존 파일을 수정하거나 그 아래에 새 파일을 추가해서는 안 된다.

- **REQ-AUTH-058** (Unwanted): 이 SPEC은 `src/middleware.ts`(matcher `["/admin/:path*"]` 포함), `src/lib/auth/session-resolver.ts`, `src/features/admin/services/admin-session.ts`, `src/app/api/auth/logout/route.ts`, `src/components/layout/SiteHeader.tsx`, `src/components/layout/LogoutButton.tsx`, `prisma/schema.prisma`를 변경해서는 안 된다.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다. 결함의 성격상 "이왕 고치는 김에 관리자 화면을 제대로 만들자"로 번지기 가장 쉬운 자리라 경계를 촘촘히 못 박는다.

### Out of Scope — 관리자 전용 헤더 및 관리자 로그아웃 동선

- 관리자용 헤더 컴포넌트, 관리자 전용 로그아웃 버튼, 관리자 세션임을 알리는 배너·표시를 만들지 않는다.
- 이것은 누락이 아니라 착수 전 사용자 라운드에서 **명시적으로 선택된 범위**다. 이 SPEC의 결정은 "숨긴다"이지 "관리자용으로 다시 만든다"가 아니다.
- 전방 포인터: 관리자 화면에 로그아웃 동선이 실제로 필요해지면 그것은 별도 SPEC의 본체다. 이 SPEC은 그 화면의 설계를 앞질러 정하지 않으며, 자리를 예약하지도 않는다.

### Out of Scope — `logout/route.ts`의 역할 비인지 폐기 동작 수정

- `POST /api/auth/logout`이 역할을 구분하지 않고 토큰을 폐기하는 동작(§1.2)을 변경하지 않는다.
- 이 SPEC은 **그 버튼이 staff 화면에 노출되는 문제**를 없앤다. 라우트 자체의 동작은 SPEC-AUTH-001 REQ-AUTH-013이 정한 설계이며, 고객 로그아웃 동선에서는 정상이다. 노출 경로가 사라지면 이 SPEC이 다루는 위험은 해소된다.

### Out of Scope — `resolveSession` / `resolveAdminSession` 통합 리팩터

- 두 함수를 합치거나 위임 관계로 바꾸지 않는다. SPEC-AUTH-002 §3과 SPEC-AUTH-003 §3이 이미 후속 후보로만 기록했고, 이 SPEC도 그대로 둔다.

### Out of Scope — 미들웨어 matcher 확장 및 라우트 보호

- `src/middleware.ts`의 matcher를 확장하지 않는다. 여전히 `/admin/:path*` 하나뿐이다.
- 경로 인지 헤더(미들웨어가 `x-pathname` 헤더를 주입하고 헤더 컴포넌트가 스스로 숨는 방식)는 **검토 후 기각한 대안**이다 — matcher 확장을 요구하며, 그것은 SPEC-AUTH-003 REQ-AUTH-047이 금지한다.

### Out of Scope — staff 화면의 레이아웃·디자인 개선

- staff 화면에 자체 헤더·내비게이션·브레드크럼·공통 셸을 만들지 않는다. 이 SPEC이 staff 화면에 하는 일은 **헤더가 사라지는 것**뿐이며, `src/app/staff/**`에는 파일 한 개도 추가하지 않는다.

### Out of Scope — 고객 헤더의 내용 변경

- `SiteHeader`·`LogoutButton`의 **내용**(표시 문구, 링크, CSRF 처리, 로그아웃 호출 흐름)을 일절 변경하지 않는다. 이 SPEC이 바꾸는 것은 그 컴포넌트가 **어느 레이아웃에서 렌더되는가**뿐이다.
- 장바구니 배지·검색창·푸터·카테고리 내비게이션은 SPEC-STOREFRONT-001 §3 / SPEC-AUTH-003 §3이 이연한 결정 그대로 두며 다시 열지 않는다.

### Out of Scope — E2E 브라우저 검증

- Playwright 등 브라우저 E2E로 이 결함을 검증하지 않는다. 검증은 기존 vitest + jsdom 단위 테스트와 정적 구조 스캔까지다 — SPEC-AUTH-003 §3이 확립한 동일 경계를 따른다.

---

## §4. 후속 SPEC을 위한 전방 포인터

- **관리자 화면 셸 SPEC** — staff 화면에 로그아웃 동선·관리자 내비게이션이 필요해지면 그것을 소유한다. 이 SPEC이 만드는 `(shop)` 경계는 그 SPEC이 `src/app/staff/layout.tsx`를 자유롭게 도입할 여지를 남겨 둔다(그때는 **부모가 헤더를 렌더하지 않으므로** 중첩 레이아웃으로 관리자 셸을 얹는 것이 실제로 성립한다).
- **로그아웃 역할 인지 SPEC** — §1.2의 라우트 측 문제를 다루려면 그 SPEC이 소유한다. 이 SPEC은 노출 경로만 없앤다.
