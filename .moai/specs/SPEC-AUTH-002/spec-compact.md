# SPEC-AUTH-002 (Compact) — 고객용 로그인·회원가입 화면 및 범용 세션 조회 헬퍼

> Run-phase 로딩용 압축본. 개요·기술 접근·교차 참조 근거는 spec.md/plan.md 참고. ~30% 토큰 절감 목적.

## Requirements (GEARS, REQ-AUTH-026 ~ 037)

- **REQ-AUTH-026** (Ubiquitous): `/login` 화면은 이메일/비밀번호 폼을 표시하고 `POST /api/auth/login`에 표준 `{email, password}` JSON 바디로 요청해야 한다.
- **REQ-AUTH-027** (When): 200 응답 시 `/`(홈)으로 이동해야 한다.
- **REQ-AUTH-028** (When-이벤트탐지): 실패 응답 시 `error` 메시지를 `role="alert"`로 표시, 이동 없음.
- **REQ-AUTH-029** (Unwanted): redirect/next 쿼리 파라미터 처리를 구현해서는 안 된다 — 이동 대상은 항상 `/`.
- **REQ-AUTH-030** (Ubiquitous): `/signup` 화면은 이메일/비밀번호 폼을 표시하고 `POST /api/auth/signup`에 표준 바디로 요청해야 한다.
- **REQ-AUTH-031** (When): 201 응답 시 자동 로그인 없이 `/login`으로 이동해야 한다.
- **REQ-AUTH-032** (When-이벤트탐지): 실패 응답 시 `error` 메시지를 `role="alert"`로 표시, 이동 없음.
- **REQ-AUTH-033** (Ubiquitous): `src/lib/auth/session-resolver.ts`에 역할 무관 `resolveSession(cookieStore)`를 제공해야 한다.
- **REQ-AUTH-034** (Unwanted): 읽기 전용이어야 하며 토큰 회전·재발급·레코드 변형을 해서는 안 된다.
- **REQ-AUTH-035** (When-이벤트탐지): 모든 실패 사유(쿠키 부재/미일치/폐기/만료)가 동일하게 `null`을 반환해야 한다.
- **REQ-AUTH-036** (Unwanted): `resolveAdminSession`과 `src/middleware.ts`를 수정해서는 안 된다.
- **REQ-AUTH-037** (Unwanted): 클라이언트 측 인증 상태 저장소(context/useAuth/localStorage 등)를 도입해서는 안 된다.

## Acceptance Criteria (Given-When-Then, AC-AUTH-025 ~ 036)

- **AC-AUTH-025**: Given `/login` / When 이메일+비밀번호 제출 / Then `POST /api/auth/login`이 표준 JSON 바디로 정확히 1회 호출.
- **AC-AUTH-026**: Given `/login` 제출 / When 200 응답 / Then `router.push("/")`.
- **AC-AUTH-027**: Given `/login` 제출 / When 401(`Invalid email or password`) / Then alert 텍스트 일치, 이동 없음.
- **AC-AUTH-028**: Given `login/page.tsx` 소스 / When 정적 스캔 / Then redirect/next 파라미터 처리 코드 매치 0건, `router.push` 인자는 리터럴 `"/"`뿐.
- **AC-AUTH-029**: Given `/signup` / When 이메일+비밀번호 제출 / Then `POST /api/auth/signup`이 표준 JSON 바디로 정확히 1회 호출.
- **AC-AUTH-030**: Given `/signup` 제출 / When 201 응답 / Then `router.push("/login")`, `POST /api/auth/login` 미호출.
- **AC-AUTH-031**: Given `/signup` 제출 / When 400(email)/400(password)/409(duplicate) 각각 / Then 정확한 서버 메시지 표시(3개 서브케이스 a/b/c), 이동 없음.
- **AC-AUTH-032**: Given customer/admin 각 유효 `RefreshToken` / When `resolveSession` 호출 / Then 역할 그대로 `{userId, role}` 반환(a/b).
- **AC-AUTH-033**: Given 유효 토큰 / When `resolveSession` 호출 / Then `findFirst` 1회, `create`/`update`/`updateMany` 미호출.
- **AC-AUTH-034**: Given 쿠키 부재/미일치/폐기/만료 4케이스 / When `resolveSession` 호출 / Then 전부 `null`, (a) DB 조회 없음.
- **AC-AUTH-035**: Given 구현 완료 후 트리 / When `git diff --stat` / Then `admin-session.ts`·`middleware.ts` 무변경, `admin-session.test.ts` 무회귀.
- **AC-AUTH-036**: Given 3개 신규 파일 소스 / When 정적 스캔 / Then `createContext`/`useContext`/`useAuth`/`localStorage`/`sessionStorage` 매치 0건.

## Files to Modify / Create

| 파일 | 종류 |
|---|---|
| `src/app/login/page.tsx` | 신규(NEW) |
| `src/app/signup/page.tsx` | 신규(NEW) |
| `src/lib/auth/session-resolver.ts` | 신규(NEW) |
| `tests/unit/app/login-page.test.tsx` | 신규(NEW) |
| `tests/unit/app/signup-page.test.tsx` | 신규(NEW) |
| `tests/unit/auth/session-resolver.test.ts` | 신규(NEW) |

## Exclusions (What NOT to Build)

- redirect/next 쿼리 파라미터 기반 로그인 후 복귀 — spec.md §3.
- 로그아웃 UI(버튼/링크), 공유 헤더/내비게이션 — spec.md §3.
- 리뷰, 구매 검증, `Order`-`User` 연결, `prisma/schema.prisma` 변경 — spec.md §3.
- Google OAuth UI, "로그인 유지" 부가 UX — spec.md §3.
- `resolveAdminSession` 위임 리팩터 — spec.md §3(후속 후보로만 기록).
- 클라이언트 측 인증 상태 저장소(React context, `useAuth`, 인메모리 토큰) — spec.md §1/§2, plan.md §A.
