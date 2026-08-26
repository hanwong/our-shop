# Acceptance Criteria: SPEC-AUTH-001 — 회원 가입·로그인 및 JWT 세션 관리

> Given-When-Then 형식의 수락 기준(AC-AUTH-NNN). Tier L 상한(25개) 이내 — 아래는 24개의 최상위 번호(001~024)로 구성되며, 밀접하게 연관된 검증을 하나의 논리적 AC로 묶기 위한 소문자 접미사 하위 기준(예: AC-AUTH-003a/b/c)을 사용한다(SPEC Builder AC sub-ID 컨벤션). spec.md의 REQ-AUTH-NNN 요구사항을 검증 가능한 형태로 구체화한다 — GEARS 요구사항의 재진술이 아니라 각 요구사항의 이진(binary) 검증 시나리오다. 각 AC는 **Traces** 줄로 대상 REQ-AUTH-NNN을 명시적으로 표기한다(plan-audit D3).
>
> **개정 이력**: plan-audit iteration 1 리뷰(D1-D13) 반영 — 모든 AC에 Traces 태그 추가(D3), REQ-AUTH-007/009/008/001/016 커버리지 보강(D4-D8), DoD 오기재 정정(D8/D9), AC-AUTH-005/021 이진 검증 가능성 강화(D10/D11), REQ-AUTH-022(관리자 RBAC, 신규) 대응 AC-AUTH-022 추가.

## §1. 회원가입 (Signup)

**AC-AUTH-001** — 유효한 회원가입
- **Given** 아직 가입되지 않은 이메일 `user@example.com`과 8자 이상 비밀번호가 주어졌을 때
- **When** `POST /api/auth/signup`을 요청하면
- **Then** 응답은 201이며, DB의 `User.passwordHash`는 bcrypt(cost 12) 해시값이고 원문 비밀번호와 다르며, 응답 바디에 원문 비밀번호나 해시값이 포함되지 않는다.
- **Traces**: REQ-AUTH-001, REQ-AUTH-002

**AC-AUTH-002** — 중복 이메일 가입 거부
- **Given** 이미 `user@example.com`으로 가입된 `User`가 존재할 때
- **When** 동일 이메일로 `POST /api/auth/signup`을 다시 요청하면
- **Then** 응답은 409(Conflict)이며 새 `User` 레코드가 생성되지 않는다.
- **Traces**: REQ-AUTH-003

**AC-AUTH-003a** — 72바이트 초과 비밀번호 처리
- **Given** 73바이트 이상(UTF-8 기준)인 비밀번호가 주어졌을 때
- **When** `POST /api/auth/signup`을 요청하면
- **Then** 요청이 거부(400)되거나, SHA-256 사전 해시 후 bcrypt가 적용되어 72바이트 절단으로 인한 유효 비밀번호 축소가 발생하지 않는다(둘 중 하나가 구현되어야 하며, 어느 쪽이든 동일 원문 비밀번호로 재로그인이 성공해야 한다).
- **Traces**: REQ-AUTH-001

**AC-AUTH-003b** — 잘못된 이메일 형식 거부 (D6)
- **Given** 이메일 형식이 아닌 문자열(예: `not-an-email`, `@example.com`, `user@`)이 주어졌을 때
- **When** 해당 값으로 `POST /api/auth/signup`을 요청하면
- **Then** 응답은 400이며 `User` 레코드가 생성되지 않는다.
- **Traces**: REQ-AUTH-001

**AC-AUTH-003c** — 비밀번호 최소 길이 미달 거부 (D6)
- **Given** 유효한 이메일과 8자 미만(예: 7자)의 비밀번호가 주어졌을 때
- **When** `POST /api/auth/signup`을 요청하면
- **Then** 응답은 400이며 `User` 레코드가 생성되지 않는다.
- **Traces**: REQ-AUTH-001

## §2. 로그인 (이메일/비밀번호)

**AC-AUTH-004** — 유효한 로그인 시 토큰 쌍 발급
- **Given** 가입된 `User`의 올바른 이메일+비밀번호가 주어졌을 때
- **When** `POST /api/auth/login`을 요청하면
- **Then** 응답 바디에 액세스 토큰(JWT)이 포함되고, `Set-Cookie` 헤더에 httpOnly+Secure+SameSite 속성을 가진 리프레시 토큰 쿠키가 설정되며, 액세스 토큰을 디코드하면 `sub`/`iat`/`exp`/`iss`/`aud`/`jti`/`role` 클레임만 존재하고 이메일·이름 등 PII는 없다.
- **Traces**: REQ-AUTH-004, REQ-AUTH-006

**AC-AUTH-004b** — 토큰 만료 시간 기본값 및 환경변수 설정 (D4, 신규)
- **Given (a)** `JWT_ACCESS_TOKEN_EXPIRY` 환경변수가 설정되지 않은 상태에서 로그인이 성공했을 때
- **When (a)** 발급된 액세스 토큰을 디코드하면
- **Then (a)** `exp - iat`가 15분(900초)이다.
- **Given (b)** `JWT_ACCESS_TOKEN_EXPIRY=5m`으로 설정된 상태에서 로그인이 성공했을 때
- **When (b)** 발급된 액세스 토큰을 디코드하면
- **Then (b)** `exp - iat`가 5분(300초)으로, 기본값이 아닌 환경변수 값을 반영한다.
- **Given (c)** `JWT_REFRESH_TOKEN_EXPIRY` 환경변수가 설정되지 않은 상태에서 로그인이 성공했을 때
- **When (c)** 발급된 리프레시 토큰의 DB `expiresAt`을 확인하면
- **Then (c)** 발급 시각으로부터 30일 후로 설정되어 있다. 환경변수가 설정된 경우(예: `7d`) 해당 값을 반영해야 한다.
- **Traces**: REQ-AUTH-007, REQ-AUTH-008

**AC-AUTH-005** — 존재하지 않는 이메일과 오답 비밀번호의 응답 시간 유사성 (D10, 통계적 절차 확정)
- **Given** 존재하지 않는 이메일 `ghost@example.com`과, 별도로 존재하는 이메일에 틀린 비밀번호가 주어졌을 때
- **When** 각 케이스에 대해 N ≥ 30회씩 `POST /api/auth/login`을 요청하고 서버측 처리 시간을 측정하면
- **Then** 두 케이스 모두 401을 반환하고, 응답 바디의 오류 메시지가 두 케이스에서 클라이언트가 "이메일 미존재"와 "비밀번호 불일치"를 구분할 수 있는 형태로 다르지 않으며, 두 표본 집합의 응답 시간 **중앙값(median)** 차이가 20ms 미만이거나 더 느린 케이스 중앙값의 15% 미만(둘 중 더 큰 값을 허용 오차로 사용) — 이 조건을 만족하지 않으면 FAIL로 판정한다.
- **Traces**: REQ-AUTH-005

**AC-AUTH-006** — 로그인 실패 시 토큰 미발급
- **Given** 잘못된 비밀번호가 주어졌을 때
- **When** `POST /api/auth/login`을 요청하면
- **Then** 응답에 액세스 토큰이나 리프레시 토큰 쿠키가 포함되지 않는다.
- **Traces**: REQ-AUTH-005

**AC-AUTH-006b** — 액세스 토큰의 클라이언트 메모리 전용 보관 (D5, 신규)
- **Given** 클라이언트(브라우저) 애플리케이션이 로그인에 성공해 액세스 토큰을 수신했을 때
- **When** 로그인 완료 직후 및 페이지 상호작용 중 브라우저의 `localStorage`/`sessionStorage`를 검사하면
- **Then** 액세스 토큰 값이 어떤 키로도 `localStorage`/`sessionStorage`에 존재하지 않는다(E2E/통합 테스트로 브라우저 스토리지를 직접 조회해 검증 — 정적 grep(§8 DoD)은 이 AC를 보완하는 2차 방어선이며 대체 수단이 아니다).
- **Traces**: REQ-AUTH-009

## §3. 리프레시 + 로테이션 + 재사용 탐지

**AC-AUTH-007** — 유효한 리프레시 시 토큰 로테이션
- **Given** 유효한(만료되지 않고 무효화되지 않은) 리프레시 토큰이 주어졌을 때
- **When** `POST /api/auth/refresh`를 요청하면
- **Then** 새 액세스 토큰과 새 리프레시 토큰이 발급되고, 기존 리프레시 토큰은 DB에서 `revokedAt`이 설정되어 더 이상 유효하지 않다.
- **Traces**: REQ-AUTH-010

**AC-AUTH-007b** — 리프레시 토큰 DB 해시 전용 저장 (D7, 신규)
- **Given** 로그인 또는 리프레시가 성공해 새 리프레시 토큰이 발급되었을 때
- **When** 응답 쿠키에 설정된 원문(raw) 리프레시 토큰 값과, 동일 시점 `RefreshToken.tokenHash` DB 레코드 값을 비교하면
- **Then** `tokenHash`는 원문 쿠키 값과 **일치하지 않으며**(즉 원문이 그대로 저장되지 않았으며), 원문 값을 동일 해시 함수로 해시했을 때 저장된 `tokenHash`와 일치한다(라운드트립 검증) — 이 AC가 없으면 원문을 그대로 저장하는 회귀가 기존 AC(쿠키 속성만 검증하는 AC-AUTH-004, 로테이션 로직만 검증하는 AC-AUTH-007/008)를 모두 통과하고도 발생할 수 있다.
- **Traces**: REQ-AUTH-008

**AC-AUTH-008** — 재사용된 리프레시 토큰의 전체 family 폐기
- **Given** 이미 로테이션되어 무효화된 리프레시 토큰(`familyId=F`)이 주어졌을 때
- **When** 해당 토큰으로 `POST /api/auth/refresh`를 재요청하면
- **Then** 응답은 401이며, `familyId=F`에 속한 모든 `RefreshToken` 레코드가 즉시 폐기(`revokedAt` 설정)되고, 이후 family 내 어떤 토큰으로도 재발급이 성공하지 않는다.
- **Traces**: REQ-AUTH-011

**AC-AUTH-009** — 만료된 리프레시 토큰 거부
- **Given** `expiresAt`이 현재 시각보다 과거인 리프레시 토큰이 주어졌을 때
- **When** `POST /api/auth/refresh`를 요청하면
- **Then** 응답은 401이며 새 토큰이 발급되지 않는다.
- **Traces**: REQ-AUTH-012

**AC-AUTH-010** — 로테이션의 트랜잭션 원자성
- **Given** 리프레시 로테이션 도중 DB 오류가 강제로 발생하는 상황이 주어졌을 때
- **When** `POST /api/auth/refresh`가 처리되면
- **Then** 신규 토큰 생성과 기존 토큰 무효화가 부분적으로만 반영되는 상태(신규만 생성되고 기존이 무효화되지 않거나, 그 반대)가 존재하지 않는다 — 둘 다 성공하거나 둘 다 롤백된다.
- **Traces**: REQ-AUTH-010

## §4. 로그아웃

**AC-AUTH-011** — 로그아웃 시 토큰 폐기 및 쿠키 만료
- **Given** 유효한 세션(로그인된 상태)이 주어졌을 때
- **When** `POST /api/auth/logout`을 요청하면
- **Then** 해당 리프레시 토큰이 DB에서 폐기되고, 응답의 `Set-Cookie` 헤더가 리프레시 토큰 쿠키를 즉시 만료(`Max-Age=0` 또는 과거 `Expires`)시킨다.
- **Traces**: REQ-AUTH-013

**AC-AUTH-012** — 로그아웃 후 재사용 불가
- **Given** 로그아웃으로 폐기된 리프레시 토큰이 주어졌을 때
- **When** 해당 토큰으로 `POST /api/auth/refresh`를 요청하면
- **Then** 응답은 401이다.
- **Traces**: REQ-AUTH-013

## §5. Google OAuth 로그인 (계정 auto-link 포함)

**AC-AUTH-013** — 동의 URL 생성
- **Given** 사용자가 Google 로그인을 시작할 때
- **When** `GET /api/auth/google`을 요청하면
- **Then** 302 리다이렉트 응답의 `Location`이 Google 동의 화면 URL이며 `scope=openid email profile`과 서명된 `state` 파라미터를 포함한다.
- **Traces**: REQ-AUTH-014

**AC-AUTH-014** — 위조된 state 거부
- **Given** 세션에 저장된 `state`와 일치하지 않는 `state` 파라미터가 주어졌을 때
- **When** `GET /api/auth/google/callback?code=...&state=<위조값>`을 요청하면
- **Then** 응답은 400/401이며 어떤 세션도 발급되지 않는다.
- **Traces**: REQ-AUTH-015

**AC-AUTH-015** — `email_verified=false`인 Google 계정 거부
- **Given** Google ID 토큰의 `email_verified` 클레임이 `false`일 때
- **When** OAuth 콜백이 처리되면
- **Then** 로그인이 거부되고 어떤 `User`/`OAuthAccount`도 생성 또는 연결되지 않는다.
- **Traces**: REQ-AUTH-016

**AC-AUTH-015b** — Google ID 토큰 서명/`iss`/`aud` 검증 (D8, 신규 — REQ-AUTH-016의 나머지 3개 검증 항목)
- **Given (a)** JWKS 공개키로 검증 불가능한(위조되거나 다른 키로 서명된) Google ID 토큰이 주어졌을 때
- **When (a)** OAuth 콜백이 처리되면
- **Then (a)** 서명 검증 실패로 로그인이 거부되고(400/401) 어떤 `User`/`OAuthAccount`도 생성·연결되지 않는다.
- **Given (b)** `iss` 클레임이 `https://accounts.google.com`이 아닌 Google ID 토큰이 주어졌을 때
- **When (b)** OAuth 콜백이 처리되면
- **Then (b)** 로그인이 거부되고 어떤 `User`/`OAuthAccount`도 생성·연결되지 않는다.
- **Given (c)** `aud` 클레임이 이 애플리케이션의 `GOOGLE_CLIENT_ID`와 일치하지 않는 Google ID 토큰이 주어졌을 때
- **When (c)** OAuth 콜백이 처리되면
- **Then (c)** 로그인이 거부되고 어떤 `User`/`OAuthAccount`도 생성·연결되지 않는다.
- **Traces**: REQ-AUTH-016 (AC-AUTH-015와 합쳐 REQ-AUTH-016의 4개 검증 항목 — 서명/`iss`/`aud`/`email_verified` — 전체를 커버한다)

**AC-AUTH-016** — 기존 OAuthAccount 매칭 로그인
- **Given** `OAuthAccount(provider="google", providerAccountId=<sub>)`이 이미 존재하고 어떤 `User`에 연결되어 있을 때
- **When** 동일 Google 계정으로 OAuth 콜백이 완료되면
- **Then** 매칭된 `User`에 대해 이메일/비밀번호 로그인과 동일한 클레임 구조의 세션(액세스+리프레시)이 발급된다.
- **Traces**: REQ-AUTH-017

**AC-AUTH-017** — 신규 사용자 생성 (매칭 없음, 기존 User도 없음)
- **Given** 매칭되는 `OAuthAccount`도, 해당 이메일의 기존 `User`도 없을 때
- **When** OAuth 콜백이 완료되면
- **Then** `passwordHash: null`인 신규 `User`와 신규 `OAuthAccount`가 하나의 트랜잭션으로 생성되고 세션이 발급된다.
- **Traces**: REQ-AUTH-018

**AC-AUTH-018** — auto-link: 기존 이메일/비밀번호 계정과 자동 연결 (확정 정책)
- **Given** 이메일/비밀번호로 가입된 기존 `User`(이메일 `existing@example.com`)가 있고 `OAuthAccount`는 연결되어 있지 않으며, 동일 이메일의 Google 계정이 `email_verified === true`일 때
- **When** 해당 Google 계정으로 OAuth 콜백이 완료되면
- **Then** 별도의 사용자 확인 단계 없이 기존 `User`에 `OAuthAccount(provider="google", providerAccountId=<sub>)`가 자동으로 생성·연결되고, 해당 `User`에 대한 세션이 발급된다. 연결 이후 동일 사용자가 이메일/비밀번호로도 여전히 로그인할 수 있다.
- **Traces**: REQ-AUTH-019

## §6. 보안 하드닝

**AC-AUTH-019** — JWT 알고리즘 화이트리스트
- **Given** `alg: "none"` 또는 허용되지 않은 알고리즘으로 서명된(또는 서명 없는) 토큰이 주어졌을 때
- **When** 해당 토큰으로 인증이 필요한 엔드포인트에 요청하면
- **Then** 검증이 실패하고 401이 반환된다(토큰 헤더의 `alg` 값이 검증 로직의 알고리즘 선택에 영향을 주지 않는다).
- **Traces**: REQ-AUTH-020

**AC-AUTH-020** — exp/iss/aud 검증
- **Given** `exp`가 과거이거나, `iss`/`aud`가 기대값과 다른 토큰이 주어졌을 때
- **When** 해당 토큰으로 검증을 시도하면
- **Then** 각각 개별적으로 검증이 실패한다(세 클레임 모두 독립적으로 확인됨을 3개 이상의 개별 테스트 케이스로 증명).
- **Traces**: REQ-AUTH-020

**AC-AUTH-021** — 로그인 + refresh + OAuth 콜백 rate limiting (D11, 수치 확정 + 엔드포인트 통합)
- **Given** 동일 IP 또는 동일 계정에서 `/api/auth/login`, `/api/auth/refresh`, `/api/auth/google/callback` 중 어느 한 엔드포인트에 분당 **정확히 5회를 초과**하는 요청이 발생했을 때 (즉 분당 6번째 요청부터)
- **When** 임계치를 초과한 다음 요청이 도착하면
- **Then** 세 엔드포인트 모두 동일하게 429(Too Many Requests)가 반환되고, 최초 초과 시점으로부터 **정확히 15분간** 재시도가 계속 차단되며, 15분 경과 후 첫 요청은 다시 허용된다(영구 차단이 아님을 시간 경과 재시도 허용 테스트로 확인). 세 엔드포인트 각각에 대해 독립적으로 검증한다.
- **Traces**: REQ-AUTH-021

**AC-AUTH-022** — 관리자 라우트 RBAC 미들웨어 (신규 — REQ-AUTH-022 대응, 2026-08-26 사용자 확정)
- **Given (a)** 유효한 세션(액세스 토큰)의 `role` 클레임이 `admin`인 사용자가 있을 때
- **When (a)** `/admin`으로 시작하는 라우트에 요청하면
- **Then (a)** 미들웨어가 요청을 통과시킨다(차단하지 않음).
- **Given (b)** 유효한 세션이 없거나, 세션은 있으나 `role` 클레임이 `admin`이 아닌(`customer`) 사용자가 있을 때
- **When (b)** `/admin`으로 시작하는 라우트에 요청하면
- **Then (b)** 미들웨어가 요청을 거부한다(리다이렉트 또는 403 중 구현이 선택한 형태 — 둘 중 하나면 PASS. 액션 단위 세분화 권한은 검증 범위 밖).
- **Traces**: REQ-AUTH-022

**AC-AUTH-023** — CSRF 방지 (쿠키 기반 refresh/logout)
- **Given** 유효한 리프레시 쿠키가 있지만 CSRF 토큰이 없거나 불일치하는 요청이 주어졌을 때
- **When** `POST /api/auth/refresh` 또는 `POST /api/auth/logout`을 요청하면
- **Then** 요청이 거부된다(403 또는 동등한 오류), AND 쿠키의 `SameSite` 속성이 `Lax` 또는 `Strict`로 설정되어 있음을 정적 검사로 확인한다.
- **Traces**: REQ-AUTH-023

**AC-AUTH-024** — 시크릿 미노출 및 비밀번호 미로깅
- **Given** 애플리케이션 소스와 런타임 로그 출력이 주어졌을 때
- **When** 환경변수 스캔(`NEXT_PUBLIC_` 접두사 grep)과 로그 출력 검사를 수행하면
- **Then** `JWT_ACCESS_SECRET`/`GOOGLE_CLIENT_SECRET` 등 시크릿이 `NEXT_PUBLIC_` 접두사로 노출되지 않고, 로그인/회원가입 관련 로그에 원문 비밀번호나 비밀번호 해시가 출력되지 않는다.
- **Traces**: REQ-AUTH-024, REQ-AUTH-025

## §7. Edge Cases (참고 — 위 AC의 부가 시나리오, 별도 AC 번호 없음)

- 동시에 두 개의 유효한 리프레시 토큰으로 거의 동시에 `/auth/refresh`를 요청하는 race condition(둘 중 하나만 성공하고 나머지는 재사용 탐지로 처리되어야 함 — AC-AUTH-008과 연계).
- Google 계정 이메일 대소문자 차이(`User@Example.com` vs `user@example.com`)로 인한 auto-link 매칭 실패 방지 — 이메일 정규화(소문자 변환) 후 비교.
- bcrypt 해싱 지연(250-500ms) 중 동시 다발적 로그인 요청 시 응답 지연이 rate limiting 오탐(false positive)을 유발하지 않는지 확인.
- Google OAuth 콜백에서 code 교환 자체가 실패(네트워크 오류 등)하는 경우 — state 검증과 독립적으로 별도 오류 처리.

## §8. Quality Gate 기준 (Definition of Done)

- **테스트 커버리지**: `src/lib/auth/*` 및 `src/app/api/auth/*` 전체 85% 이상(TRUST 5 Tested 기준).
- **보안 체크리스트 (research.md §5 기반, 모두 테스트로 검증)**:
  - 알고리즘 화이트리스트 고정 (AC-AUTH-019)
  - `exp`/`iss`/`aud` 검증 (AC-AUTH-020)
  - 리프레시 재사용 탐지 + family 폐기 (AC-AUTH-008)
  - 리프레시 토큰 쿠키 속성(httpOnly + Secure + SameSite) (AC-AUTH-004)
  - 리프레시 토큰 DB 해시 전용 저장(원문 미저장) (AC-AUTH-007b) — *plan-audit D7/D9 정정: 이전 버전은 이 항목을 AC-AUTH-004/AC-AUTH-009로 잘못 인용했다(AC-AUTH-009는 만료된 토큰 거부를 검증하며 저장 방식과 무관하다). 정정된 인용은 AC-AUTH-007b다.*
  - 액세스 토큰 localStorage/sessionStorage 미저장 (AC-AUTH-006b, 아래 정적 검사로 보완)
  - CSRF 방지 (AC-AUTH-023)
  - 로그인/리프레시/OAuth 콜백 rate limiting, 분당 5회 초과 시 15분 소프트 락아웃 (AC-AUTH-021)
  - 관리자 라우트 RBAC 미들웨어 — role 확인 (AC-AUTH-022, 신규)
  - 타이밍 공격 완화 — 통계적 절차(N≥30, 중앙값 차이 <20ms 또는 <15%) (AC-AUTH-005)
  - OAuth `state` CSRF 검증 (AC-AUTH-014)
  - Google ID 토큰 완전 검증(서명/`iss`/`aud`/`email_verified`) (AC-AUTH-015 — `email_verified`; AC-AUTH-015b — 서명/`iss`/`aud`) — *plan-audit D8 정정: 이전 버전은 이 항목 전체를 AC-AUTH-015 하나로만 인용했으나, AC-AUTH-015는 `email_verified=false` 거부 1개 검증 항목만 다룬다. 나머지 3개 검증 항목(서명/`iss`/`aud`)은 신규 AC-AUTH-015b가 담당한다.*
  - 시크릿 미노출 + 비밀번호 미로깅 (AC-AUTH-024)
- **정적 검사**: `grep -rn "NEXT_PUBLIC_.*SECRET"` 결과 0건, `grep -rn "localStorage.*accessToken\|sessionStorage.*accessToken"` 결과 0건(AC-AUTH-006b의 2차 방어선).
- **회귀 없음**: 기존 테스트(있을 경우) 전부 통과.
- **Lint/Format**: 프로젝트 표준 도구(ESLint, TypeScript 타입체크) 통과.
