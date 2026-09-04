---
id: SPEC-AUTH-002
title: "고객용 로그인·회원가입 화면 및 범용 세션 조회 헬퍼"
version: "0.1.0"
status: in-progress
created: 2026-09-04
updated: 2026-09-04
author: snake
priority: P2
phase: "v0.2.0 target"
module: "src/lib/auth"
lifecycle: spec-anchored
tags: "auth, ui, login, signup, session"
tier: M
depends_on: [SPEC-AUTH-001]
related_specs: [SPEC-ADMIN-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-04 | 0.1.0 | draft | plan-phase 최초 작성. 착수 전 사용자가 이미 Socratic AskUserQuestion 라운드로 범위를 확정한 상태로 위임됨 — 별도 명료화 라운드 없이 진행. `[NEEDS CLARIFICATION]` 마커 없음. |

---

## §1. 개요

`our-shop`에 **고객용 로그인/회원가입 화면**과, 역할(customer/admin)에 무관하게 동작하는 **범용 서버 사이드 세션 조회 헬퍼**를 추가한다. SPEC-AUTH-001이 이미 만든 백엔드 인증 API(`POST /api/auth/signup`, `POST /api/auth/login`)를 그대로 소비하는 **순수 UI 레이어 + 세션 조회 프리미티브** SPEC이며, 새로운 백엔드 인증 로직·엔드포인트·데이터 모델은 추가하지 않는다.

### 이 SPEC이 잇는 경계 — 지금까지 고객용 인증 UI가 하나도 없었다

`find src/app -iname "*login*" -o -iname "*signup*"`로 직접 확인한 사실: 현재 이 저장소에 존재하는 로그인 화면은 `src/app/staff/login`(관리자 전용, SPEC-ADMIN-001) 하나뿐이며, 회원가입 화면은 어디에도 없다. 이 SPEC이 **최초의 고객용 인증 UI**다.

### 소비하는 기존 API 계약 (SPEC-AUTH-001에서 확정됨, 변경하지 않음)

- **`POST /api/auth/signup`** (`src/app/api/auth/signup/route.ts`) — 이메일 형식 + 비밀번호 8자 이상 서버 검증, `User{role: "customer"}` 생성, 세션/쿠키를 발급하지 않음, 성공 시 `{id, email}` + 201. 실패 시 `{error}` 메시지: `"Invalid email format"`, `"Password must be at least 8 characters"`, `"Email already registered"`(각각 400/400/409) — 모두 route.ts 소스를 직접 읽어 확인한 리터럴 문자열이다.
- **`POST /api/auth/login`** (`src/app/api/auth/login/route.ts`) — 이메일+비밀번호, 성공 시 `issueSession(user.id, user.role)` 호출 후 httpOnly `refresh_token` 쿠키(`buildRefreshTokenCookie()`) + `csrf_token` 쿠키를 설정, 역할 무관 동일 처리(admin과 customer가 동일한 쿠키 발급 경로를 탄다), 응답 바디는 `{accessToken}`뿐(200). 실패 시 모든 경로가 동일한 제네릭 메시지 `"Invalid email or password"`(401, 타이밍 균등화)를 반환한다.

두 엔드포인트 모두 이 SPEC에서 **수정하지 않는다** — 이 SPEC은 두 API의 순수 UI 소비자다.

### 로그인 화면 — 기존 관례를 그대로 모델링

`src/app/staff/login/page.tsx`(SPEC-ADMIN-001 M2)가 이미 검증된 선례다: `"use client"` 컴포넌트, `useState`로 `email`/`password`/`formError`/`submitting` 관리, `useId()`로 label/input id 페어링, `fetch("/api/auth/login", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({email, password})})`, `response.ok`면 `router.push(...)`, 아니면 `{error}`를 `role="alert"` 요소에 표시. 새 고객용 로그인 화면은 이 모양을 그대로 따르되 두 가지만 다르다: (a) 경로가 `/staff/login`이 아니라 `/login`, (b) 성공 시 이동 대상이 `/staff/orders`가 아니라 `/`(홈).

### 회원가입 화면 — 신규 설계 (선례 없음)

회원가입 UI는 이 저장소에 선례가 없다 — 로그인 화면과 동일한 `"use client"` 구조(`useState` email/password/formError/submitting, `useId()`)로 `POST /api/auth/signup`에 요청하고, `201`이면 `/login`으로 이동한다(가입 API가 세션을 발급하지 않으므로 **자동 로그인하지 않는다**). 실패 시 응답 JSON `{error}`의 메시지를 그대로 표시한다.

### 세션 조회 헬퍼 — 이번 SPEC의 핵심 신규 백엔드 조각

`src/features/admin/services/admin-session.ts`의 `resolveAdminSession(cookieStore): Promise<AdminSession | null>`이 일반화할 정확한 대상이다. 그 함수는: `refresh_token` 쿠키(`REFRESH_TOKEN_COOKIE_NAME`, `cookies.ts`의 `buildRefreshTokenCookie()`가 설정하는 이름과 일치)를 읽고, `hashRefreshToken()`(`src/lib/auth/session.ts`에서 import, 재구현하지 않음)으로 해시한 뒤 `prisma.refreshToken.findFirst({where: {tokenHash}, include: {user: true}})`로 조회하며, 쿠키 부재/미일치 레코드/`revokedAt !== null`/`expiresAt <= now`/(admin 버전 한정) `role !== "admin"` 중 어느 경로든 동일하게 `null`을 반환한다 — 호출자는 실패 사유를 구분해서는 안 된다.

이 SPEC은 `src/lib/auth/session-resolver.ts`에 **역할 무관** 버전 `resolveSession(cookieStore): Promise<{userId: string; role: "customer" | "admin"} | null>`을 신설한다 — `role !== "admin"` 필터만 제거한, `resolveAdminSession`과 동일한 알고리즘이다. `resolveAdminSession` 자체는 수정하지 않는다(향후 `resolveAdminSession`이 이 함수로 위임하도록 리팩터하는 것은 이번 범위 밖이며, §3에 후속 후보로만 기록한다). 쿠키 스토어 매개변수는 `resolveAdminSession`과 동일하게 덕 타이핑(`{get(name): {value: string} | undefined}`)해, `next/headers`의 `cookies()`가 어댑터 없이 그대로 만족하고 단위 테스트는 평범한 mock을 넘길 수 있게 한다.

### 클라이언트 측 인증 상태 저장소를 만들지 않는다 — 근거가 있는 설계 결정

이 SPEC은 React context, `useAuth` 훅, 인메모리 액세스 토큰 저장소 등 **어떤 클라이언트 측 인증 상태 관리도 도입하지 않는다**. "로그인했는가"는 오직 서버 사이드(서버 컴포넌트 또는 라우트 핸들러가 `resolveSession()`을 호출)로만 판정한다. 근거: (1) 이 저장소에는 현재 어떤 클라이언트 측 fetch 래퍼도 인증 상태 저장소도 존재하지 않는다. (2) `resolveAdminSession` 기반의 관리자 측 설계가 순수 서버 쿠키 판독 방식으로 이미 이 저장소 전체에서 end-to-end로 동작함을 증명하고 있다 — 같은 패턴을 그대로 확장하는 것이 새 개념을 도입하는 것보다 단순하다(constitution Enforce Simplicity). 상세 설계 근거는 plan.md §A에 기록한다.

### 미들웨어는 변경하지 않는다

`src/middleware.ts`의 `matcher: ["/admin/:path*"]`는 이 SPEC에서 건드리지 않는다 — `/login`, `/signup`은 그 매처 밖의 신규 공개 라우트이며, 이 SPEC이 만드는 어떤 라우트도 RBAC 게이팅이 필요하지 않다.

---

## §2. 요구사항 (GEARS, REQ-AUTH-026 ~ 037)

Tier M — 요구사항 상한 16개 이내(현재 12개). `AUTH` 도메인 기존 번호(SPEC-AUTH-001이 REQ-AUTH-025까지 사용)를 이어받아 REQ-AUTH-026부터 시작한다.

### 로그인 화면

- **REQ-AUTH-026** (Ubiquitous): 신규 로그인 화면(`/login`)은 이메일/비밀번호 입력 폼을 표시해야 하며, 제출 시 기존 `POST /api/auth/login`(SPEC-AUTH-001)에 표준 JSON 바디(`{email, password}`)로 요청해야 한다 — 새로운 엔드포인트나 새로운 요청 형태를 도입해서는 안 된다.
- **REQ-AUTH-027** (When): 로그인 화면이 `POST /api/auth/login`으로부터 200 응답을 받으면, 화면은 `/`(홈)으로 이동해야 한다.
- **REQ-AUTH-028** (When — 이벤트 탐지형): 로그인 화면이 실패 응답을 받으면, 화면은 응답 JSON 바디의 `error` 필드 값을 `role="alert"` 요소로 표시해야 하며 이동해서는 안 된다.
- **REQ-AUTH-029** (Unwanted, shall not): 로그인 화면은 이전 페이지로의 복귀(`redirect`/`next` 쿼리 파라미터 처리)를 구현해서는 안 된다 — 성공 시 이동 대상은 항상 고정된 `/`다.

### 회원가입 화면

- **REQ-AUTH-030** (Ubiquitous): 신규 회원가입 화면(`/signup`)은 이메일/비밀번호 입력 폼을 표시해야 하며, 제출 시 기존 `POST /api/auth/signup`(SPEC-AUTH-001)에 표준 JSON 바디로 요청해야 한다.
- **REQ-AUTH-031** (When): 회원가입 화면이 201 응답을 받으면, 화면은 자동 로그인을 시도하지 않고 `/login`으로 이동해야 한다.
- **REQ-AUTH-032** (When — 이벤트 탐지형): 회원가입 화면이 실패 응답을 받으면, 화면은 응답 JSON 바디의 `error` 필드 값을 `role="alert"` 요소로 표시해야 하며 이동해서는 안 된다.

### 범용 세션 조회 헬퍼

- **REQ-AUTH-033** (Ubiquitous): 인증 서비스는 역할(customer/admin)에 무관하게 유효한 refresh-token 쿠키를 세션으로 해석하는 범용 세션 조회 함수(`resolveSession`)를 `src/lib/auth/session-resolver.ts`에 제공해야 한다.
- **REQ-AUTH-034** (Unwanted, shall not): `resolveSession`은 refresh-token의 조회·해시 비교만 수행하는 읽기 전용 동작이어야 하며, 토큰을 회전·재발급하거나 `RefreshToken` 레코드를 생성·수정해서는 안 된다.
- **REQ-AUTH-035** (When — 이벤트 탐지형): `resolveSession`이 쿠키 부재, 미일치 레코드, 폐기됨(revoked), 만료됨 중 어느 사유로도 유효한 세션을 확인할 수 없으면, 이유를 구분하지 않고 동일하게 `null`을 반환해야 한다.

### 경계 보존

- **REQ-AUTH-036** (Unwanted, shall not): 이 SPEC은 `resolveAdminSession`(SPEC-ADMIN-001)의 동작을 수정하거나 제거해서는 안 되며, `src/middleware.ts`의 라우트 매처를 변경해서는 안 된다.
- **REQ-AUTH-037** (Unwanted, shall not): 로그인/회원가입 화면과 `resolveSession`은 클라이언트 측 인증 상태 저장소(React context, `useAuth` 훅, 인메모리 액세스 토큰 저장소 등)를 도입해서는 안 된다 — 인증 여부 판정은 서버 사이드 쿠키 판독으로만 수행해야 한다.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다.

### Out of Scope — 로그인 후 원래 페이지로의 복귀
- `redirect`/`next` 쿼리 파라미터 처리는 이번 범위 밖이다. 로그인 성공 시 이동 대상은 하드코딩된 `/` 하나로 고정한다(REQ-AUTH-029).

### Out of Scope — 로그아웃 UI
- 로그아웃 버튼/링크는 앱 어디에도 추가하지 않는다. `POST /api/auth/logout` 라우트의 존재 여부는 이 SPEC의 관심사가 아니며, 신규 추가하거나 연결하지 않는다.

### Out of Scope — 공통 헤더/내비게이션
- 이 저장소는 아직 공유 사이트 헤더/내비게이션 컴포넌트를 만든 적이 없다(SPEC-STOREFRONT-001/002가 동일하게 이연했다). 이 SPEC도 그 결정을 바꾸지 않는다.

### Out of Scope — 리뷰·구매 검증·`Order`-`User` 연결
- 향후 리뷰 기능, 구매 검증, `Order`를 `User` 계정에 연결하는 작업은 이 SPEC의 대상이 아니다. `Order`는 현재 `userId` 필드를 갖지 않으며(스키마 주석에 의도적으로 명시됨), 이 SPEC은 `prisma/schema.prisma`를 전혀 건드리지 않는다.

### Out of Scope — Google OAuth UI
- SPEC-AUTH-001이 이미 OAuth 백엔드 콜백을 구현했다. 이 SPEC이 만드는 신규 로그인 화면에는 OAuth 버튼/플로우를 추가하지 않는다 — 이메일/비밀번호 전용이다.

### Out of Scope — "로그인 유지" 등 영속 로그인 UX
- 기존 30일 리프레시 토큰 쿠키가 이미 제공하는 것 이상의 "로그인 상태 유지" UX 부가 기능은 이번 범위 밖이다.

### Out of Scope — `resolveAdminSession` 리팩터
- `resolveAdminSession`이 `resolveSession`에 위임하도록 리팩터하는 것은 이번 SPEC 범위 밖이다 — 두 함수는 이번 범위에서 독립적으로 존재한다. 후속 정리 후보로만 기록한다(§1).

---

## §4. 후속 SPEC을 위한 전방 포인터

**리뷰(review) 기능은 별도 SPEC 대상이다.** 이 SPEC은 리뷰와 무관하지만, 향후 "로그인한 사용자만 리뷰 작성 가능 + 구매 검증"을 다룰 후속 리뷰 SPEC이 이 SPEC이 만드는 `resolveSession()`(§2 REQ-AUTH-033)에 직접 의존하게 될 것으로 예상한다 — 그 SPEC이 착수될 때, 이 SPEC이 만든 로그인/회원가입 화면과 세션 조회 헬퍼가 이미 존재하는 전제로 설계될 수 있다.

---

## §5. 교차 참조

- SPEC-AUTH-001 — 이 SPEC이 그대로 소비하는 `POST /api/auth/signup`/`POST /api/auth/login` API, `issueSession`/`buildRefreshTokenCookie`/`hashRefreshToken` 세션 발급 원시 함수의 출처.
- SPEC-ADMIN-001 — 이 SPEC이 일반화하는 `resolveAdminSession` 7단계 알고리즘의 출처(`src/features/admin/services/admin-session.ts`), `src/app/staff/login/page.tsx`가 제공하는 로그인 화면 UI 관례의 선례.
- `.moai/project/tech.md` — Next.js 15(App Router), React 19, TypeScript, PostgreSQL + Prisma 6 확정. §"인증(Authentication) — 신규 확정" 절.
