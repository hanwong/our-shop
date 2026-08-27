---
id: SPEC-AUTH-001
title: "회원 가입·로그인 및 JWT 세션 관리"
version: "0.1.1"
status: completed
created: 2026-08-26
updated: 2026-08-27
author: snake
priority: P1
phase: "v0.1.0 MVP"
module: "src/lib/auth"
lifecycle: spec-anchored
tags: "auth, jwt, oauth, security"
tier: L
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-08-26 | 0.1.0 | draft | plan-phase 완료. interview.md + research.md 기반, plan-review 인간 검토 게이트 통과. 사용자 확정 사항: (1) Google 계정 연결 정책 = auto-link, (2) SPEC Tier = L. Tier L 5-파일 아티팩트 세트(spec/plan/acceptance/design/research) 생성. |
| 2026-08-26 | 0.1.1 | draft | plan-audit iteration 1 리뷰(D1-D13) 반영. GEARS Where→When 재라벨링(구 REQ-AUTH-018/019/023), REQ-AUTH-001 라벨 정정(Ubiquitous+When). REQ-AUTH-021을 rate-limiting 대상 엔드포인트까지 흡수하는 복합 절로 통합하고 구체적 수치(분당 5회, 15분 소프트 락아웃)를 확정해 REQ 슬롯 1개를 확보했다. 사용자 확정: 관리자 라우트 RBAC 미들웨어(role 확인)를 이번 SPEC 범위에 포함 — 확보한 슬롯에 **REQ-AUTH-022(신규)**로 추가. 세분화된(fine-grained) 액션별 관리자 권한은 여전히 범위 밖. Out of Scope §3 갱신. |

---

## §1. 개요

`our-shop`(모바일 우선 B2C 패션 이커머스)의 회원 인증 계층을 정의한다. 이메일/비밀번호 회원가입·로그인, JWT 액세스/리프레시 토큰 발급·재발급·로그아웃, Google OAuth 소셜 로그인(계정 auto-link 포함)을 다룬다. `jose`(JWT)와 `bcrypt`(비밀번호 해싱)로 직접 구현하며, NextAuth.js 등 인증 프레임워크는 사용하지 않는다.

이 SPEC은 회원가입 없이도 구매 가능한 `product.md`의 게스트 구매 우선 원칙을 깨지 않는다 — 인증은 재구매·주문 이력 조회·관리자 화면을 위한 선택적 계층이다.

핵심 설계 원칙(research.md §2): 이메일/비밀번호 로그인과 Google OAuth 로그인은 확정된 `userId`에 대해 **하나의 공유된 세션 발급 함수**(`issueSession`)로 수렴하는 두 개의 서로 다른 진입 경로다. 상세 아키텍처는 design.md 참고.

## §2. 요구사항 (GEARS, REQ-AUTH-001 ~ REQ-AUTH-025)

> Tier L 요구사항 상한(25개) 이내로 압축했다. plan.md §2에 원본 27개 후보 항목과의 매핑 기록이 있다.

### 회원가입

- **REQ-AUTH-001** (Ubiquitous + When): 인증 서비스는 회원가입 요청의 이메일 형식과 비밀번호 길이(최소 8자)를 서버 사이드에서 검증해야 하며(클라이언트 검증만으로 신뢰하지 않음), 이메일 형식이 유효하지 않거나 비밀번호 길이가 최소 기준 미달이면 요청을 거부(400)해야 한다. **When** 비밀번호 바이트 길이가 72바이트(bcrypt 절단 한계)를 초과하면, 인증 서비스는 요청을 거부하거나 SHA-256으로 사전 해시한 뒤 bcrypt를 적용해야 한다.
- **REQ-AUTH-002** (When): 사용자가 유효한 이메일+비밀번호로 회원가입을 요청하면, 인증 서비스는 bcrypt(cost factor 12)로 비밀번호를 해싱해 `User` 레코드를 생성해야 한다.
- **REQ-AUTH-003** (When — 이벤트 탐지형): 이미 가입된 이메일로 회원가입이 시도되면, 인증 서비스는 중복 가입 오류를 반환해야 한다.

### 로그인 (이메일/비밀번호)

- **REQ-AUTH-004** (When): 사용자가 이메일+비밀번호로 로그인을 요청하고 자격 증명이 유효하면, 인증 서비스는 §REQ-AUTH-006~009의 공유 세션 발급 함수를 통해 액세스+리프레시 토큰 쌍을 발급해야 한다.
- **REQ-AUTH-005** (When — 이벤트 탐지형 + Unwanted): 존재하지 않는 이메일 또는 불일치하는 비밀번호로 로그인이 시도되면, 인증 서비스는 더미 bcrypt 비교(또는 동등한 지연)를 수행해 응답 시간을 유사하게 유지해야 하며, 로그인 실패 사유(이메일 미존재 vs 비밀번호 불일치)를 클라이언트가 구분할 수 있는 형태로 노출해서는 안 된다(SHALL NOT).

### JWT 발급 — 공유 세션 발급 경로

- **REQ-AUTH-006** (Ubiquitous): 공유 세션 발급 함수는 액세스 토큰에 `sub`(내부 user id) · `iat`/`exp` · `iss`/`aud` · `jti` · 최소 `role` 클레임만 포함해야 하며, 이메일·이름·주소 등 PII 또는 외부 제공자 시크릿을 포함해서는 안 된다.
- **REQ-AUTH-007** (Ubiquitous): 액세스 토큰의 기본 만료는 15분이며 환경변수(`JWT_ACCESS_TOKEN_EXPIRY`)로 조정 가능해야 한다.
- **REQ-AUTH-008** (Ubiquitous): 리프레시 토큰은 opaque random string으로 발급되어야 하며, DB에는 해시값만 저장(원문 미저장)하고, httpOnly + Secure + SameSite 쿠키로 클라이언트에 전달해야 한다. 기본 만료는 30일이며 환경변수(`JWT_REFRESH_TOKEN_EXPIRY`)로 조정 가능해야 한다.
- **REQ-AUTH-009** (Ubiquitous + Unwanted): 액세스 토큰은 클라이언트 메모리에만 보관되어야 하며, `localStorage`/`sessionStorage`에 저장되어서는 안 된다.

### 리프레시 + 로테이션

- **REQ-AUTH-010** (When): `/auth/refresh` 요청이 유효한 리프레시 토큰과 함께 도착하면, 인증 서비스는 새 리프레시 토큰을 발급하고 기존 토큰을 동일 트랜잭션 내에서 무효화해야 한다.
- **REQ-AUTH-011** (When — 이벤트 탐지형): 이미 로테이션되어 무효화된 리프레시 토큰이 재사용되면, 인증 서비스는 해당 토큰이 속한 전체 token family를 즉시 폐기하고 재인증을 요구해야 한다.
- **REQ-AUTH-012** (When — 이벤트 탐지형): 만료된 리프레시 토큰으로 `/auth/refresh` 요청이 오면, 인증 서비스는 401을 반환하고 새 토큰을 발급해서는 안 된다.

### 로그아웃

- **REQ-AUTH-013** (When): 사용자가 로그아웃을 요청하면, 인증 서비스는 해당 리프레시 토큰을 DB에서 폐기(revoke)하고 쿠키를 만료시켜야 한다. ("모든 기기에서 로그아웃"은 이번 범위 밖 — §3 Out of Scope 참고.)

### Google OAuth 로그인 / 계정 연결

- **REQ-AUTH-014** (When): 사용자가 `/api/auth/google` 진입점을 호출하면, 인증 서비스는 CSRF 방지용 서명된 `state`와 함께 Google 동의 화면 URL(`scope: openid,email,profile`)을 생성해야 한다.
- **REQ-AUTH-015** (When — 이벤트 탐지형): Google 콜백이 유효하지 않거나 위조된 `state`와 함께 도착하면, 인증 서비스는 요청을 거부해야 한다.
- **REQ-AUTH-016** (When): Google 콜백에서 authorization code 교환이 성공하면, 인증 서비스는 Google ID 토큰을 검증해야 한다 — 서명(JWKS), `iss === https://accounts.google.com`, `aud`가 클라이언트 ID와 일치, `email_verified === true`를 모두 확인한다.
- **REQ-AUTH-017** (When): 검증된 Google 계정이 기존 `OAuthAccount(provider="google", providerAccountId=<google sub>)`와 매칭되면, 인증 서비스는 매칭된 `User`에 대해 공유 세션 발급 함수로 세션을 발급해야 한다.
- **REQ-AUTH-018** (When — 이벤트 탐지형): 매칭되는 `OAuthAccount`가 없고 해당 이메일의 기존 `User`도 없는 경우가 탐지되면, 인증 서비스는 새 `User`(`passwordHash: null`) + `OAuthAccount`를 하나의 트랜잭션으로 생성한 뒤 세션을 발급해야 한다.
- **REQ-AUTH-019** (When — 이벤트 탐지형 + auto-link, 확정): 매칭되는 `OAuthAccount`는 없지만 검증된 Google 로그인 이메일(`email_verified === true`)이 기존 이메일/비밀번호 `User`의 이메일과 일치하는 경우가 탐지되면, 인증 서비스는 별도 확인 단계 없이 자동으로 해당 `User`에 `OAuthAccount`를 연결(link)한 뒤 세션을 발급해야 한다.

### 보안 공통

- **REQ-AUTH-020** (Ubiquitous): 인증 서비스는 JWT 검증 시 허용 알고리즘을 화이트리스트로 명시적으로 고정해야 하며(토큰 헤더의 `alg` 값을 신뢰하지 않음), 모든 토큰 발급 시 `exp`/`iss`/`aud`를 설정하고 모든 검증 시 이 세 값을 확인해야 한다.
- **REQ-AUTH-021** (Where + While — `/auth/refresh`·Google OAuth 콜백 통합, 수치 확정): **Where** `/auth/login`, `/auth/refresh`, Google OAuth 콜백(`/api/auth/google/callback`) 엔드포인트에서, **While** 동일 IP 또는 동일 계정의 요청이 분당 5회를 초과하는 동안, 인증 서비스는 후속 요청에 429(Too Many Requests)를 반환하고 15분간 임시 소프트 락아웃을 적용해야 한다(영구 잠금 금지). (구 REQ-AUTH-022의 엔드포인트 확장 범위를 본 REQ로 흡수 — plan.md §5.5/HISTORY 참고. 15분 경과 후에는 재시도가 다시 허용되어야 한다.)
- **REQ-AUTH-022** (When — 관리자 라우트 RBAC 미들웨어, 신규): `/admin`으로 시작하는 라우트에 요청이 도착하면, 미들웨어는 세션(액세스 토큰)의 `role` 클레임이 `admin`인지 확인해야 하며, 유효한 세션이 없거나 `role`이 `admin`이 아니면 요청을 거부해야 한다(리다이렉트 또는 403 — 구체적 응답 형태는 구현 재량). 액션 단위의 세분화된(fine-grained) 관리자 권한 체계는 이번 REQ의 범위 밖이다(§3 Out of Scope 참고).
- **REQ-AUTH-023** (When — 이벤트 탐지형): 쿠키 기반 `/auth/refresh` 또는 `/auth/logout` 요청이 도착하면, 인증 서비스는 `SameSite=Lax`(또는 `Strict`) 쿠키 속성에 더해 CSRF 방지 메커니즘(double-submit 또는 synchronizer 토큰)을 적용해야 한다.
- **REQ-AUTH-024** (Unwanted): JWT 서명 시크릿, Google client secret 등 어떤 시크릿도 `NEXT_PUBLIC_` 접두사가 붙은 환경변수로 노출되어서는 안 된다.
- **REQ-AUTH-025** (Unwanted): 인증 서비스는 원문 비밀번호 또는 해시값을 로그로 남겨서는 안 된다.

## §3. What NOT to Build (Out of Scope)

### Out of Scope — 비밀번호 재설정

- 이메일을 통한 비밀번호 찾기/재설정(reset-via-email) 플로우는 이번 SPEC 범위 밖이다. interview.md에서 명시적으로 별도 후속 카드로 분리했다.

### Out of Scope — 이메일 인증 링크 플로우

- 회원가입 후 "인증 메일 발송 → 링크 클릭 확인" 이메일 검증 플로우는 이번 범위 밖이다. `User.emailVerified` 필드는 스키마에 존재하지만, 이메일/비밀번호 가입 시 기본값 `false`로만 생성하고 검증 플로우 자체는 구현하지 않는다(별도 SPEC 후보).

### Out of Scope — 전체 기기 로그아웃 UI

- "모든 기기에서 로그아웃"(전체 token family 폐기) 기능 및 관련 UI는 이번 범위 밖이다. `RefreshToken` 스키마의 `familyId`가 향후 확장을 지원하므로 스키마 변경 없이 후속 SPEC에서 추가 가능하다.

### Out of Scope — 관리자 세분화(per-action) 권한

- `/admin` 라우트에 대한 미들웨어 수준의 role 기반 접근 제어(세션의 `role` 클레임이 `admin`인지 확인 후 허용/거부)는 REQ-AUTH-022로 **이번 SPEC 범위에 포함**되었다(2026-08-26 사용자 확정). 이번 범위 밖인 것은 액션 단위로 세분화된(fine-grained) 관리자 권한 체계(예: 상품 편집 권한과 주문 취소 권한을 별도로 구분하는 세밀한 RBAC, 역할 계층/커스텀 퍼미션)이며, 이는 별도 SPEC에서 구체화한다.

### Out of Scope — Redis 기반 분산 rate limiting

- 다중 인스턴스 배포를 전제로 한 Redis 기반 rate limiting은 이번 범위 밖이다. 단일 인스턴스 in-memory sliding-window 방식으로 시작하고, 다중 인스턴스 배포가 확정되는 시점에 별도 SPEC으로 전환한다.

## §4. 영향받는 파일/모듈

세부 목록은 plan.md §4 및 §7(Milestone 분해) 참고. 신규 생성: `prisma/schema.prisma` 확장, `src/lib/auth/*`(password, jwt, session, google-oauth, rate-limit, cookies), `src/app/api/auth/*`(signup, login, refresh, logout, google, google/callback), `src/middleware.ts`, `src/types/auth.ts`, `tests/unit/auth/*`, `tests/integration/auth/*`.

## §5. 참고 문서

- `research.md` — 보안 연구 결과 (JWT/OAuth/bcrypt 베스트 프랙티스)
- `plan.md` — 구현 계획, Milestone 분해 (M1~M6)
- `design.md` — 아키텍처, Prisma 스키마, threat model 요약
- `acceptance.md` — Given-When-Then 수락 기준
