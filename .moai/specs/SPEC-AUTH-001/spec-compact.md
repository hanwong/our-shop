# SPEC-AUTH-001 — Compact

> v0.1.1 — plan-audit iteration 1 리뷰(D1-D13) 반영판. 각 REQ/AC의 상세 GEARS 라벨·Given/When/Then·Traces는 spec.md / acceptance.md가 SSOT다.

## REQ

- REQ-AUTH-001: 서버사이드 이메일 형식/비밀번호 길이(최소 8자) 검증 + 72바이트 초과 처리(Ubiquitous+When)
- REQ-AUTH-002: 유효 가입 → bcrypt(12) 해싱 → User 생성
- REQ-AUTH-003: 중복 이메일 가입 → 오류
- REQ-AUTH-004: 유효 로그인 → 공유 세션 발급
- REQ-AUTH-005: 로그인 실패 시 더미 비교 + 오류 사유 비노출
- REQ-AUTH-006: 액세스 토큰 클레임 최소화(sub/iat/exp/iss/aud/jti/role), PII 금지
- REQ-AUTH-007: 액세스 토큰 만료 15분(env 조정 가능)
- REQ-AUTH-008: 리프레시 토큰 opaque + DB 해시 + httpOnly/Secure/SameSite 쿠키, 만료 30일(env 조정 가능)
- REQ-AUTH-009: 액세스 토큰 클라이언트 메모리 전용, localStorage/sessionStorage 금지
- REQ-AUTH-010: 리프레시 시 로테이션(신규 발급 + 기존 무효화, 동일 트랜잭션)
- REQ-AUTH-011: 재사용된 리프레시 토큰 → family 전체 폐기
- REQ-AUTH-012: 만료된 리프레시 토큰 → 401, 재발급 없음
- REQ-AUTH-013: 로그아웃 → 토큰 폐기 + 쿠키 만료
- REQ-AUTH-014: /api/auth/google → state 서명 + 동의 URL
- REQ-AUTH-015: 위조 state → 거부
- REQ-AUTH-016: code 교환 성공 → Google ID 토큰 검증(서명/iss/aud/email_verified)
- REQ-AUTH-017: 매칭 OAuthAccount 존재 → 세션 발급
- REQ-AUTH-018: 매칭 없음 + 기존 User 없음 → 신규 User+OAuthAccount 생성 → 세션 발급(When — 이벤트 탐지형)
- REQ-AUTH-019: 매칭 없음 + 기존 email/password User 존재 → auto-link(자동 연결) → 세션 발급 [확정 정책, When — 이벤트 탐지형]
- REQ-AUTH-020: JWT 알고리즘 화이트리스트 + exp/iss/aud 발급·검증
- REQ-AUTH-021: **[수치 확정]** 로그인+refresh+Google OAuth 콜백 통합 rate limiting — 분당 5회 초과 시 15분 소프트 락아웃(구 REQ-AUTH-022의 엔드포인트 확장 범위를 흡수)
- REQ-AUTH-022: **[신규]** 관리자 라우트(`/admin`) RBAC 미들웨어 — `role === admin` 확인, 아니면 거부(리다이렉트/403). 세분화된 액션별 권한은 범위 밖
- REQ-AUTH-023: 쿠키 기반 refresh/logout CSRF 방지(SameSite + double-submit)
- REQ-AUTH-024: 시크릿 NEXT_PUBLIC_ 노출 금지
- REQ-AUTH-025: 비밀번호/해시 로깅 금지

## AC

> 각 AC는 acceptance.md에 `Traces: REQ-AUTH-NNN`을 명시적으로 보유한다. 소문자 접미사(a/b/c)는 동일 논리적 AC의 하위 기준이다.

- AC-AUTH-001: Given 미가입 이메일+유효 비밀번호 / When POST /api/auth/signup / Then 201 + bcrypt 해시 저장, 응답에 원문/해시 미노출 [Traces: REQ-AUTH-001,002]
- AC-AUTH-002: Given 기존 가입 이메일 / When 동일 이메일 재가입 요청 / Then 409, 신규 User 미생성 [Traces: REQ-AUTH-003]
- AC-AUTH-003a: Given 72바이트 초과 비밀번호 / When 회원가입 요청 / Then 400 거부 또는 SHA-256 사전해시 처리, 재로그인 가능 [Traces: REQ-AUTH-001]
- AC-AUTH-003b (신규): Given 잘못된 이메일 형식 / When 회원가입 요청 / Then 400 [Traces: REQ-AUTH-001]
- AC-AUTH-003c (신규): Given 8자 미만 비밀번호 / When 회원가입 요청 / Then 400 [Traces: REQ-AUTH-001]
- AC-AUTH-004: Given 올바른 이메일+비밀번호 / When POST /api/auth/login / Then 액세스 토큰 + httpOnly 리프레시 쿠키 발급, 클레임 최소화 확인 [Traces: REQ-AUTH-004,006]
- AC-AUTH-004b (신규): Given 액세스/리프레시 토큰 만료 env 미설정·설정 / When 토큰 디코드·DB 확인 / Then 기본값(15분/30일) 및 env 값 반영 확인 [Traces: REQ-AUTH-007,008]
- AC-AUTH-005: Given 미존재 이메일 vs 오답 비밀번호 / When 각 N≥30회 로그인 요청, 응답시간 측정 / Then 동일 401 + 구분 불가 오류 메시지 + 중앙값 차이 <20ms 또는 <15% [Traces: REQ-AUTH-005]
- AC-AUTH-006: Given 잘못된 비밀번호 / When 로그인 요청 / Then 토큰 미발급 [Traces: REQ-AUTH-005]
- AC-AUTH-006b (신규): Given 로그인 성공, 액세스 토큰 수신 / When 브라우저 storage 검사 / Then localStorage/sessionStorage에 미존재 [Traces: REQ-AUTH-009]
- AC-AUTH-007: Given 유효 리프레시 토큰 / When POST /api/auth/refresh / Then 신규 토큰 발급 + 기존 토큰 revokedAt 설정 [Traces: REQ-AUTH-010]
- AC-AUTH-007b (신규): Given 리프레시 토큰 발급 직후 / When 원문 쿠키값 vs DB tokenHash 비교 / Then 불일치(해시 전용 저장) + 라운드트립 일치 [Traces: REQ-AUTH-008]
- AC-AUTH-008: Given 이미 로테이션된 토큰 재사용 / When refresh 요청 / Then 401 + family 전체 폐기 [Traces: REQ-AUTH-011]
- AC-AUTH-009: Given 만료된 리프레시 토큰 / When refresh 요청 / Then 401, 재발급 없음 [Traces: REQ-AUTH-012]
- AC-AUTH-010: Given 로테이션 중 DB 오류 강제 / When refresh 처리 / Then 부분 반영 없이 전체 롤백 또는 전체 성공 [Traces: REQ-AUTH-010]
- AC-AUTH-011: Given 유효 세션 / When POST /api/auth/logout / Then 토큰 폐기 + 쿠키 즉시 만료 [Traces: REQ-AUTH-013]
- AC-AUTH-012: Given 로그아웃된 토큰 / When refresh 재시도 / Then 401 [Traces: REQ-AUTH-013]
- AC-AUTH-013: Given Google 로그인 시작 / When GET /api/auth/google / Then 302 + state 포함 동의 URL [Traces: REQ-AUTH-014]
- AC-AUTH-014: Given 위조된 state / When OAuth 콜백 요청 / Then 400/401, 세션 미발급 [Traces: REQ-AUTH-015]
- AC-AUTH-015: Given email_verified=false / When OAuth 콜백 처리 / Then 로그인 거부, User/OAuthAccount 미생성 [Traces: REQ-AUTH-016]
- AC-AUTH-015b (신규): Given 서명 위조/잘못된 iss/잘못된 aud (3개 하위 케이스) / When OAuth 콜백 처리 / Then 각각 거부 [Traces: REQ-AUTH-016]
- AC-AUTH-016: Given 기존 OAuthAccount 매칭 / When OAuth 콜백 완료 / Then 매칭 User로 세션 발급 [Traces: REQ-AUTH-017]
- AC-AUTH-017: Given 매칭 없음 + 기존 User 없음 / When OAuth 콜백 완료 / Then 신규 User+OAuthAccount 트랜잭션 생성 + 세션 발급 [Traces: REQ-AUTH-018]
- AC-AUTH-018: Given 기존 email/password User + 미연결 + email_verified=true / When OAuth 콜백 완료 / Then auto-link(자동 연결) + 세션 발급, 이후 두 로그인 경로 모두 유효 [Traces: REQ-AUTH-019]
- AC-AUTH-019: Given alg:none 또는 미허용 알고리즘 토큰 / When 검증 요청 / Then 401 [Traces: REQ-AUTH-020]
- AC-AUTH-020: Given exp/iss/aud 불일치 토큰(각각) / When 검증 요청 / Then 개별 실패(3개 이상 케이스) [Traces: REQ-AUTH-020]
- AC-AUTH-021 (수치 확정 + 엔드포인트 통합): Given 로그인/refresh/OAuth 콜백 중 분당 5회 초과 / When 다음 요청 도착 / Then 429 + 정확히 15분 소프트 락아웃(영구 아님, 15분 후 재허용) [Traces: REQ-AUTH-021]
- AC-AUTH-022 (신규 — 재배정): Given role=admin 세션 vs 세션 없음/role≠admin / When /admin 라우트 요청 / Then 통과 vs 거부(리다이렉트/403) [Traces: REQ-AUTH-022]
- AC-AUTH-023: Given CSRF 토큰 불일치 + 유효 리프레시 쿠키 / When refresh/logout 요청 / Then 403 + SameSite 속성 확인 [Traces: REQ-AUTH-023]
- AC-AUTH-024: Given 소스/로그 출력 / When NEXT_PUBLIC_ 스캔 + 로그 검사 / Then 시크릿 노출 0건, 비밀번호/해시 로깅 0건 [Traces: REQ-AUTH-024,025]

## Files to Modify (신규 생성)

- `prisma/schema.prisma`
- `src/lib/auth/password.ts`
- `src/lib/auth/jwt.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/google-oauth.ts`
- `src/lib/auth/rate-limit.ts`
- `src/lib/auth/cookies.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/refresh/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/google/route.ts`
- `src/app/api/auth/google/callback/route.ts`
- `src/middleware.ts` (인증 라우트 보호 + `/admin` RBAC 게이트 — REQ-AUTH-022)
- `src/types/auth.ts`
- `tests/unit/auth/*`
- `tests/integration/auth/*`

## Exclusions (Out of Scope)

- 이메일을 통한 비밀번호 재설정(reset-via-email)
- 회원가입 후 이메일 인증 링크 플로우
- 전체 기기 로그아웃(전체 token family 폐기) UI/API
- 관리자 세분화(per-action) 권한 — `/admin` 라우트 role 기반 미들웨어 자체는 REQ-AUTH-022로 **범위에 포함**됨(2026-08-26 확정); 액션 단위 세분화 권한만 범위 밖
- Redis 기반 분산 rate limiting(단일 인스턴스 in-memory로 시작)
