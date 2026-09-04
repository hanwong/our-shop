---
id: SPEC-AUTH-002
status: draft
updated: 2026-09-04
tier: M
---

# Plan: SPEC-AUTH-002 — 고객용 로그인·회원가입 화면 및 범용 세션 조회 헬퍼

> 섹션 순서는 **되돌리기 어려운 결정 순**이다. §A~§C는 나중에 바꾸면 비용이 큰 결정(클라이언트 인증 상태 저장소 도입 여부, 세션 조회 헬퍼의 API 모양, 회원가입 성공 후 자동 로그인 여부)이고, §D 이후는 구조·마일스톤·잔여 위험이다.

---

## §A. 클라이언트 측 인증 상태 저장소를 만들지 않는다 — 가장 되돌리기 어려운 결정

**결정: React context, `useAuth` 훅, 인메모리 액세스 토큰 저장소를 이 SPEC에서 도입하지 않는다. "로그인했는가"는 서버 사이드 쿠키 판독(`resolveSession()`)으로만 판정한다.**

근거:
1. 이 저장소에는 현재 클라이언트 측 fetch 래퍼도, 인증 상태 저장소도 어디에도 없다 — 도입 자체가 새로운 아키텍처 축이다.
2. 관리자 측 설계(`resolveAdminSession`, SPEC-ADMIN-001)가 순수 서버 쿠키 판독 방식만으로 `/staff/orders`의 서버 컴포넌트 게이트까지 end-to-end로 이미 동작하고 있음을 증명한다 — 같은 패턴을 역할 무관으로 확장하는 것이, 별도의 클라이언트 상태 계층을 새로 설계하는 것보다 명백히 단순하다(constitution Enforce Simplicity 사다리: "이미 있는 패턴을 재사용하라").
3. 이 SPEC이 만드는 두 화면(로그인/회원가입) 자체는 인증 여부를 판정할 필요가 없다 — 폼을 제출하고 성공/실패에 따라 고정된 경로로 이동할 뿐이다. "이미 로그인된 사용자가 `/login`에 접근하면 어떻게 되는가"와 같은 판정은 이번 SPEC의 요구사항에 없다(§2에 그런 REQ가 없음을 spec.md에서 직접 확인).

이 결정을 뒤집으면(클라이언트 상태 저장소 도입) 이후의 모든 화면(리뷰 작성 폼 등)이 그 저장소에 의존하게 되므로, 지금 결정하지 않으면 나중에 전면 재작업이 필요하다 — 그래서 §A로 최상단에 둔다.

## §B. 세션 조회 헬퍼의 API 모양 — `resolveAdminSession`을 그대로 일반화, 위임 리팩터는 하지 않는다

**결정: `src/lib/auth/session-resolver.ts`에 `resolveSession(cookieStore: SessionCookieStore): Promise<{userId: string; role: "customer" | "admin"} | null>`을 신설한다.** 알고리즘은 `resolveAdminSession`(`src/features/admin/services/admin-session.ts`)을 직접 읽어 확인한 7단계와 동일하되, `role !== "admin"` 필터(6번째 단계)만 제거한다:

1. 쿠키 스토어에서 `refresh_token` 쿠키 값을 읽는다(부재 시 `null` 반환, DB 조회 없음).
2. `hashRefreshToken()`(`src/lib/auth/session.ts`에서 import — **재구현하지 않는다**)으로 해시한다.
3. `prisma.refreshToken.findFirst({where: {tokenHash}, include: {user: true}})`로 조회한다.
4. 레코드가 없으면 `null`.
5. `revokedAt !== null` 또는 `expiresAt <= new Date()`면 `null`.
6. (제거됨 — `resolveAdminSession`에만 있던 `role !== "admin"` 필터)
7. `{userId: record.user.id, role: record.user.role}`을 반환한다.

**결정: `resolveAdminSession`은 수정하지 않는다.** `resolveAdminSession`이 `resolveSession`을 호출하도록 리팩터하는 것(중복 제거)은 이번 범위 밖으로 명시적으로 미룬다 — 이유는 두 가지다. (1) `resolveAdminSession`은 PRESERVE 대상이며 이미 완결된 SPEC-ADMIN-001의 산출물이다 — 이 SPEC에서 건드리면 REQ-AUTH-036(경계 보존)을 스스로 위반하는 셈이다. (2) 위임 리팩터는 `resolveAdminSession`의 기존 테스트 스위트(`tests/unit/admin/admin-session.test.ts`)에 회귀 위험을 만드는데, 이 SPEC의 위임 범위(로그인/회원가입 화면 + 신규 헬퍼)를 벗어나는 별도 작업이다(§H 안티패턴).

**쿠키 스토어 타입**: `resolveAdminSession`의 `AdminCookieStore`와 동일한 모양(`{get(name: string): {value: string} | undefined}`)으로 `SessionCookieStore`를 독립 정의한다(공유 타입으로 추출하지 않는다 — 두 파일이 이미 각자 이 최소 인터페이스를 인라인 정의하고 있고, 지금 추출하면 `admin-session.ts`(PRESERVE 대상)를 건드려야 한다).

## §C. 회원가입 성공 후 자동 로그인하지 않는다

**결정: 회원가입 화면은 201 응답에서 `/login`으로 이동할 뿐, 별도로 `POST /api/auth/login`을 호출하지 않는다.** `POST /api/auth/signup`(SPEC-AUTH-001)의 응답 바디를 직접 읽어 확인한 사실 — 성공 응답은 `{id, email}`뿐이며 세션/쿠키를 전혀 발급하지 않는다. 자동 로그인을 구현하려면 이 SPEC이 회원가입 화면 안에서 로그인 API까지 체이닝 호출해야 하는데, 이는 spec.md §1에서 사용자가 이미 확정한 범위(가입과 로그인은 별개 흐름)를 벗어난다. `/login`으로 이동시키면 사용자는 방금 입력한 이메일로 다시 로그인하면 된다 — 폼 값을 쿼리 파라미터 등으로 미리 채워 넣는 것도 이번 범위가 아니다(스코프 절제).

---

## §D. 컴포넌트/파일 구조

| 파일 | 위치 | 종류 | 책임 |
|---|---|---|---|
| `LoginPage` | `src/app/login/page.tsx` | 신규, 클라이언트(`"use client"`) | 이메일/비밀번호 폼 → `POST /api/auth/login` → 200 시 `/` 이동, 실패 시 `role="alert"` 표시(§A~§C 결정 없이 순수 폼 UI) |
| `SignupPage` | `src/app/signup/page.tsx` | 신규, 클라이언트(`"use client"`) | 이메일/비밀번호 폼 → `POST /api/auth/signup` → 201 시 `/login` 이동(자동 로그인 없음, §C), 실패 시 `role="alert"` 표시 |
| `resolveSession` | `src/lib/auth/session-resolver.ts` | 신규 | 범용 세션 조회(§B) |

`src/app/staff/login/page.tsx`(SPEC-ADMIN-001)는 **수정하지 않는다** — 그대로 존재하는 독립된 관리자 화면이며, 새 `/login`은 완전히 별도 파일이다.

## §E. Conditional Design Route 판정

### Tier: M

| 축 | 추정 | 근거 |
|---|---|---|
| 변경 파일 수 | 6개 (신규 3 소스 + 신규 3 테스트, 기존 파일 수정 0건) | Tier M 가이드(5~15) 하단 |
| LOC | 약 400~600 (소스 ~250 + 테스트 ~350) | Tier M 범위 중간 |
| 요구사항 수 | 12개 | Tier M 상한(16) 이내, 여유 4건 |
| 수락 기준 수 | 12개 (acceptance.md) | Tier M 상한(16) 이내 |

### Route: `plan → design → run` (Conditional Design Route 적용)

`spec-workflow.md` § Conditional Design Route의 UI-surface 판정 기준(두 갈래 중 하나만 만족하면 됨)의 첫 갈래가 만족된다 — `acceptance.md`가 화면(`/login`, `/signup`)과 프런트엔드 컴포넌트를 명시적 산출물로 검증한다. SPEC-ADMIN-001(관리자 로그인 화면), SPEC-STOREFRONT-001/002/003이 동일 기준으로 이미 이 경로를 적용한 선례를 따른다.

**이 SPEC 위임 범위에서 design phase는 실행하지 않는다.** plan-audit PASS + Implementation Kickoff Approval 이후, run-phase 첫 구현 커밋 이전에 `manager-design`이 수행할 예정이며, 여기서는 판정만 기록한다.

design phase가 다룰 것으로 예상되는 항목: 폼 레이아웃과 여백, `/login`↔`/signup` 상호 이동 링크(예: "계정이 없으신가요? 회원가입" — 요구사항으로 확정되지 않았으므로 UX 추가 여부는 design phase 판단), 버튼/입력 필드의 Tailwind 스타일이 `staff/login`과 시각적으로 얼마나 통일될지.

## §F. 마일스톤 (우선순위 기준, 시간 추정 없음)

`quality.yaml`의 `development_mode: tdd` + `test_first_required: true`에 따라 각 마일스톤은 RED → GREEN → REFACTOR로 진행한다.

| # | 우선순위 | 내용 | 완료 신호 |
|---|---|---|---|
| **M1** | High | `resolveSession`(§B) — 유효 세션(customer/admin 둘 다), 읽기 전용(create/update 미호출), 4가지 실패 경로 전부 동일 `null`. REQ-033~035 | `session-resolver.test.ts` 통과, `tests/unit/admin/admin-session.test.ts` 무변경·무회귀 |
| **M2** | High | `LoginPage`(§D, staff/login 모델링) — 표준 요청 바디, 200→`/` 이동, 실패 시 alert, redirect 파라미터 미구현. REQ-026~029 | `login-page.test.tsx` 통과 |
| **M3** | High | `SignupPage`(§D, 신규 설계) — 표준 요청 바디, 201→`/login` 이동(자동 로그인 없음), 실패 시 정확한 서버 메시지 표시. REQ-030~032 | `signup-page.test.tsx` 통과 |
| **M4** | Medium | 경계 보존 정적 검사 — `resolveAdminSession`/`middleware.ts` 무변경(git diff 확인), 클라이언트 인증 상태 저장소 부재(소스 스캔: `useContext`/`useAuth`/`localStorage`/`sessionStorage` 매치 0건). REQ-036, 037 | 정적 스캔 테스트 통과 + `git diff --stat`으로 `src/features/admin/**`, `src/middleware.ts` 무변경 확인 |
| **M5** | Medium | 커버리지 임계값 충족, 린트/타입체크 통과 | `npm run lint`/`npx tsc --noEmit`/`npm run test:coverage` 전부 통과 |

M1은 M2/M3와 독립이다(세션 헬퍼는 두 화면 어디에서도 직접 소비되지 않는다 — REQ-033은 함수 존재/동작만 요구하며, 이 SPEC의 화면 자체가 `resolveSession`을 호출할 필요는 없다). M4/M5는 M1~M3 완료 후 전체 소스에 대해 수행한다.

## §G. 테스트 파일 배치 결정

`src/lib/auth/*.ts`의 테스트는 이 저장소에서 두 디렉터리에 걸쳐 있다(`tests/unit/auth/`에 `session.ts`/`cookies.ts`/`jwt.ts`/`password.ts`/`google-oauth.ts`, `tests/unit/lib/auth/`에 `csrf.ts`/`rate-limit.ts`) — 확립된 단일 관례가 없다. **결정: `session-resolver.ts`는 가장 밀접한 의존 관계(직접 import하는 `hashRefreshToken`)를 가진 `session.ts`의 테스트가 있는 `tests/unit/auth/session-resolver.test.ts`에 배치한다.** 화면 테스트는 `tests/unit/app/staff-login-page.test.tsx` 선례를 그대로 따라 `tests/unit/app/login-page.test.tsx`, `tests/unit/app/signup-page.test.tsx`에 배치한다.

`resolveAdminSession`의 테스트(`tests/unit/admin/admin-session.test.ts`)가 `@/lib/db`를 `vi.mock`하고 `hashRefreshToken`은 실제 함수를 호출해 기대 해시를 계산하는 패턴을 그대로 재사용한다 — 새 모킹 전략을 고안하지 않는다.

## §H. 리스크

| # | 리스크 | 영향 | 완화 |
|---|---|---|---|
| R1 | 신규 `.ts`/`.tsx` 산출물에 테스트 없이는 85% 커버리지 게이트를 통과할 수 없음(`coverage_exemptions.enabled: false`) | 높음 | §F M1/M2/M3 각각에 테스트를 배정. STOREFRONT/ADMIN 계열 SPEC과 동일한 완화 |
| R2 | `resolveSession`과 `resolveAdminSession`이 알고리즘을 중복 보유하게 됨(§B에서 의도적으로 위임 리팩터를 미룸) | 낮음(의도된 트레이드오프) | §3(Out of Scope)에 후속 정리 후보로 명시적으로 기록 — 조용한 부채가 아니라 문서화된 부채 |
| R3 | `LoginPage`/`SignupPage`가 `staff/login`과 시각적으로 크게 달라 보일 수 있음(design phase 이전이라 스타일 세부 미확정) | 낮음 | §E에서 design phase가 시각 세부(레이아웃, 상호 이동 링크)를 이어받도록 명시적으로 열어 둠 |
| R4 | 회원가입 실패 메시지 3종(`"Invalid email format"`, `"Password must be at least 8 characters"`, `"Email already registered"`)이 향후 signup/route.ts 변경 시 이 SPEC의 acceptance.md와 어긋날 수 있음 | 낮음 | acceptance.md가 정확한 리터럴 문자열을 route.ts 소스 직접 인용으로 고정(§ grounding). 문자열이 바뀌면 이 SPEC의 테스트가 즉시 실패해 드리프트를 잡는다 |

## §I. 안티패턴 — 하지 말 것

- **클라이언트 측 인증 상태 저장소를 "나중에 필요할 것 같아서" 미리 만들기.** §A가 명시적으로 금지한다 — REQ-AUTH-037이 요구사항으로도 금지한다.
- **`resolveAdminSession`을 수정하거나 `resolveSession`에 위임하도록 리팩터하기.** §B/REQ-AUTH-036이 금지한다 — 이번 범위 밖의 별도 작업이다.
- **회원가입 성공 후 자동으로 로그인 API를 호출하기.** §C가 금지한다 — 가입 API는 세션을 발급하지 않으며, 이 SPEC은 그 사실을 존중한다.
- **로그인 화면에 `redirect`/`next` 쿼리 파라미터 처리를 "당연히 필요하니까" 추가하기.** REQ-AUTH-029가 명시적으로 금지한다.
- **`src/middleware.ts`의 매처를 `/login`·`/signup`까지 포함하도록 넓히기.** REQ-AUTH-036이 금지한다 — 이 라우트들은 공개 라우트다.
- **로그인/회원가입 화면에 헤더·전역 내비게이션을 "이왕 만드는 김에" 추가하기.** spec.md §3이 명시적으로 제외했다.

## §J. 교차 참조

- `.moai/specs/SPEC-AUTH-002/spec.md` — 요구사항(REQ-AUTH-026~037), Out of Scope, 후속 SPEC 전방 포인터
- `.moai/specs/SPEC-AUTH-002/acceptance.md` — 수락 기준(AC-AUTH-025~036)
- `.moai/specs/SPEC-ADMIN-001/` — `resolveAdminSession` 7단계 알고리즘 출처, `staff/login` UI 관례 선례, Conditional Design Route 판정 선례
- `.moai/specs/SPEC-AUTH-001/` — 소비하는 API 계약(`signup`/`login` route.ts), `issueSession`/`hashRefreshToken`/`buildRefreshTokenCookie` 출처
- `.claude/rules/moai/workflow/spec-workflow.md` § SPEC Complexity Tier, § Conditional Design Route — §E 판정 근거
