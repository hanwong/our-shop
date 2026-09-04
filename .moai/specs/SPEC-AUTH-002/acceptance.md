# Acceptance Criteria: SPEC-AUTH-002 — 고객용 로그인·회원가입 화면 및 범용 세션 조회 헬퍼

Tier M — AC 상한 16개 이내(현재 12개). `AUTH` 도메인 번호를 SPEC-AUTH-001(AC-AUTH-001~024, 서브레터 포함)에서 이어받아 AC-AUTH-025부터 시작한다.

## §1. Given-When-Then 시나리오

**AC-AUTH-025** — 로그인 화면 렌더 및 표준 요청 바디 (REQ-AUTH-026)
- Given: `/login` 화면
- When: 이메일 `customer@example.com`, 비밀번호 `correct horse battery staple`을 입력하고 제출한다
- Then: `POST /api/auth/login`이 `content-type: application/json` 헤더와 `{email: "customer@example.com", password: "correct horse battery staple"}` JSON 바디로 정확히 한 번 호출된다.

**AC-AUTH-026** — 로그인 성공 시 홈으로 이동 (REQ-AUTH-027)
- Given: `/login` 화면
- When: 제출 후 `POST /api/auth/login`이 200 (`{accessToken: "tok"}`)을 반환한다
- Then: `router.push("/")`가 호출된다.

**AC-AUTH-027** — 로그인 실패 시 서버 오류 메시지 표시, 이동 없음 (REQ-AUTH-028)
- Given: `/login` 화면
- When: 제출 후 `POST /api/auth/login`이 401 (`{error: "Invalid email or password"}`)을 반환한다
- Then: `role="alert"` 요소의 텍스트가 정확히 `"Invalid email or password"`이고, `router.push`는 호출되지 않는다.

**AC-AUTH-028** — 로그인 화면에 redirect/next 파라미터 처리 부재 (REQ-AUTH-029)
- Given: `src/app/login/page.tsx` 소스
- When: 정적 소스를 검사한다
- Then: `useSearchParams`, `redirect`, `?next=` 등 쿼리 파라미터를 읽어 이동 대상을 결정하는 코드 패턴이 매치 0건이다 — `router.push` 호출 인자는 리터럴 `"/"` 하나뿐이다.

**AC-AUTH-029** — 회원가입 화면 렌더 및 표준 요청 바디 (REQ-AUTH-030)
- Given: `/signup` 화면
- When: 이메일 `new@example.com`, 비밀번호 `correct horse battery staple`을 입력하고 제출한다
- Then: `POST /api/auth/signup`이 `content-type: application/json` 헤더와 `{email: "new@example.com", password: "correct horse battery staple"}` JSON 바디로 정확히 한 번 호출된다.

**AC-AUTH-030** — 회원가입 성공 시 자동 로그인 없이 로그인 화면으로 이동 (REQ-AUTH-031)
- Given: `/signup` 화면
- When: 제출 후 `POST /api/auth/signup`이 201 (`{id: "u-1", email: "new@example.com"}`)을 반환한다
- Then: `router.push("/login")`가 호출되고, `POST /api/auth/login`은 호출되지 않는다(fetch 호출이 signup 엔드포인트 1회뿐임을 확인).

**AC-AUTH-031** — 회원가입 실패 시 정확한 서버 오류 메시지 3종 표시 (REQ-AUTH-032)
- Given: `/signup` 화면
- (a) When: 잘못된 이메일 형식으로 제출 후 400 (`{error: "Invalid email format"}`) 응답 → Then: alert 텍스트가 정확히 `"Invalid email format"`, 이동 없음.
- (b) When: 7자 비밀번호로 제출 후 400 (`{error: "Password must be at least 8 characters"}`) 응답 → Then: alert 텍스트가 정확히 `"Password must be at least 8 characters"`, 이동 없음.
- (c) When: 이미 가입된 이메일로 제출 후 409 (`{error: "Email already registered"}`) 응답 → Then: alert 텍스트가 정확히 `"Email already registered"`, 이동 없음.

**AC-AUTH-032** — `resolveSession`이 역할 무관 유효 세션을 해석 (REQ-AUTH-033)
- Given: `RefreshToken` 레코드가 `revokedAt: null`, `expiresAt`이 미래, `user.role`이 각각 `"customer"`/`"admin"`인 두 케이스
- When: 유효한 원문 토큰을 담은 쿠키 스토어로 `resolveSession(cookieStore)`를 호출한다
- Then: (a) customer 케이스 → `{userId: "u-cust", role: "customer"}` 반환. (b) admin 케이스 → `{userId: "u-admin", role: "admin"}` 반환 — 두 역할 모두 동일 함수로 해석된다(admin 전용 필터가 없음을 증명).

**AC-AUTH-033** — `resolveSession`은 읽기 전용, 회전·재발급 없음 (REQ-AUTH-034)
- Given: 유효한 `RefreshToken` 레코드
- When: `resolveSession(cookieStore)`를 호출한다
- Then: `prisma.refreshToken.findFirst`가 정확히 1회 호출되고, `create`/`update`/`updateMany`는 호출되지 않는다.

**AC-AUTH-034** — `resolveSession`의 모든 실패 경로가 동일한 `null` (REQ-AUTH-035)
- Given: 네 가지 케이스 — (a) 쿠키 부재, (b) 매칭 레코드 없음, (c) `revokedAt`이 설정됨(폐기), (d) `expiresAt`이 과거(만료)
- When: 각 케이스에서 `resolveSession(cookieStore)`를 호출한다
- Then: 네 경우 모두 `null`을 반환하고, (a)의 경우 `prisma.refreshToken.findFirst`가 호출되지 않는다(쿠키 부재는 DB 조회 전에 단락).

**AC-AUTH-035** — 경계 보존: `resolveAdminSession`·`middleware.ts` 무변경 (REQ-AUTH-036)
- Given: 이 SPEC 구현 완료 후의 작업 트리
- When: `git diff --stat`(base 대비)을 확인한다
- Then: `src/features/admin/services/admin-session.ts`와 `src/middleware.ts`가 변경 파일 목록에 없다. 또한 `tests/unit/admin/admin-session.test.ts`를 재실행하면 전부 PASS(무회귀)다.

**AC-AUTH-036** — 클라이언트 측 인증 상태 저장소 부재 (REQ-AUTH-037)
- Given: `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/lib/auth/session-resolver.ts` 소스
- When: 세 파일의 소스를 정적 스캔한다
- Then: `createContext`, `useContext`, `useAuth`, `localStorage`, `sessionStorage` 패턴이 매치 0건이다.

## §2. 엣지 케이스

| 케이스 | 기대 동작 |
|---|---|
| 로그인/회원가입 화면 제출 중 `fetch`가 네트워크 예외를 던짐(파싱 불가 응답 포함) | `staff/login` 선례와 동일하게, `try/catch`로 잡아 일반 안내 메시지를 `role="alert"`에 표시하고 이동하지 않는다 |
| `resolveSession` 호출 시 `refreshToken.findFirst`가 여러 필드를 포함한 `include: {user: true}` 레코드를 반환하되 `user.role`이 `"customer"`/`"admin"` 이외 값 | 이 저장소의 `Role` 타입은 두 값만 갖도록 이미 제약되어 있다(Prisma 스키마) — 런타임에서 별도 방어 분기를 추가하지 않는다(plan.md §I 안티패턴: 도달 불가능한 방어 코드 금지) |
| 회원가입 폼에 이메일/비밀번호를 비운 채 제출 | 서버 사이드 검증(REQ-AUTH-030이 위임하는 기존 `/api/auth/signup` 로직)이 400을 반환하며, 클라이언트는 그 응답의 `error` 메시지를 그대로 표시한다 — 클라이언트 측 `required` 검증을 별도로 추가하지 않는다(staff/login이 `noValidate`를 쓰는 것과 동일 관례) |
| `resolveSession`을 호출하는 코드가 이 SPEC 안에 없음(§1) | REQ-AUTH-033은 함수의 존재와 정확한 동작만 요구한다 — 이 SPEC의 화면들이 실제로 그 함수를 소비할 필요는 없다(§4 전방 포인터: 소비자는 후속 리뷰 SPEC) |

## §3. 품질 게이트

- 전체 테스트 통과(`npm run test:coverage`), 회귀 0건 — 특히 `tests/unit/admin/admin-session.test.ts`는 이 SPEC에서 수정하지 않으며 통과 상태를 유지해야 한다(plan.md §H R2, AC-AUTH-035).
- 신규 `.ts`/`.tsx` 파일 커버리지 ≥85%(lines/functions/statements), ≥80%(branches) — `coverage_exemptions.enabled: false`로 면제 경로 없음.
- 타입 검사(`npx tsc --noEmit`) exit 0.
- 린트(`npm run lint`) exit 0, 신규 이슈 0건.
- Definition of Done: REQ-AUTH-026~037 전체가 아래 §4 매핑 표의 AC로 커버되고 PASS 또는 (환경 제약에 한해) 명시적으로 기록된 PARTIAL 상태로 종결된다 — 조용한 생략 없음.

## §4. REQ ↔ AC 매핑 표 (명시적 커버리지 확인)

| REQ | AC |
|---|---|
| REQ-AUTH-026 | AC-AUTH-025 |
| REQ-AUTH-027 | AC-AUTH-026 |
| REQ-AUTH-028 | AC-AUTH-027 |
| REQ-AUTH-029 | AC-AUTH-028 |
| REQ-AUTH-030 | AC-AUTH-029 |
| REQ-AUTH-031 | AC-AUTH-030 |
| REQ-AUTH-032 | AC-AUTH-031 (a/b/c) |
| REQ-AUTH-033 | AC-AUTH-032 (a/b) |
| REQ-AUTH-034 | AC-AUTH-033 |
| REQ-AUTH-035 | AC-AUTH-034 |
| REQ-AUTH-036 | AC-AUTH-035 |
| REQ-AUTH-037 | AC-AUTH-036 |

## §5. 관측 불가 항목 (수동 확인 또는 플랫폼 보증으로 분류)

- 없음 — 이 SPEC의 모든 AC는 jsdom + Testing Library 컴포넌트 테스트 또는 Prisma 모킹 단위 테스트로 자동 관측 가능하다(브라우저 레이아웃 의존 항목 없음).
