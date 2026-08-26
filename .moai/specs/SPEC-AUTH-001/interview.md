# Interview: 회원 가입·로그인 및 JWT 세션 관리 (SPEC-AUTH-001)

## Interview Round 1: Scope
Question: 이번 SPEC에 포함할 범위를 정해볼까요?
Answer: 소셜 로그인(구글)까지 한번에 — 이메일/비밀번호 회원가입·로그인 + JWT 액세스/리프레시 토큰 발급·재발급·로그아웃 + Google OAuth 소셜 로그인까지 이번 SPEC 범위에 포함한다. 비밀번호 찾기(이메일 재설정)는 이번 범위 밖(별도 후속 카드).

## Interview Round 2: Constraints
Question: 인증(로그인 상태 유지) 방식은 어떻게 구현할까요?
Answer: 직접 구현 (jose + bcrypt) — 경량 JWT 라이브러리(jose)로 액세스 토큰(짧은 만료)·리프레시 토큰(긴 만료, DB 저장)을 직접 발급/검증하고, bcrypt로 비밀번호를 해싱한다. NextAuth.js 등 프레임워크 통합 라이브러리는 사용하지 않는다.

## Clarity Score
Initial: 4/10 (도메인 용어는 명확했으나 소셜 로그인 포함 여부·구현 라이브러리가 미정이었음)
Final: 8/10 (범위와 구현 방식이 모두 확정됨)
Rounds completed: 2
