---
id: SPEC-AUTH-002
status: completed
updated: 2026-09-04
tier: M
---

# Progress: SPEC-AUTH-002 — 고객용 로그인·회원가입 화면 및 범용 세션 조회 헬퍼

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-04
plan_status: audit-ready

plan-phase 산출물 4종(spec.md, plan.md, acceptance.md, spec-compact.md) 작성 완료. Tier M.

**SPEC ID 검사**: 정규식 검사를 Bash로 실행해 관측했다.

```
$ ID="SPEC-AUTH-002"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

동일 ID 부재도 확인했다 — 생성 직전 `ls .moai/specs/ | grep -c "^SPEC-AUTH-002$"` → `0`, `grep -rl "SPEC-AUTH-002" .moai/specs/` → `0`건(자기 자신 제외).

**프론트매터**: 정본 12필드 전부 존재(`id`/`title`/`version`/`status`/`created`/`updated`/`author`/`priority`/`phase`/`module`/`lifecycle`/`tags`) + 선택 필드 `tier: M`·`depends_on: [SPEC-AUTH-001]`·`related_specs: [SPEC-ADMIN-001]`. `phase: "v0.2.0 target"`(SPEC-ADMIN-001~003/SPEC-STOREFRONT-002~003과 동일한 최신 미출시 릴리스 타깃 표기), `status: draft`.

**REQ/AC 대응**: REQ 12건(REQ-AUTH-026~037) / AC 12건(AC-AUTH-025~036), acceptance.md §4 매핑 표로 1:1(일부 서브레터 a/b/c 포함) 대응까지 명시. Tier M 상한(REQ 16 / AC 16) 이내, 각각 여유 4건.

**번호 이어받기**: `AUTH` 도메인 기존 번호를 잇는다 — SPEC-AUTH-001이 REQ-AUTH-025 / AC-AUTH-024(서브레터 포함 최대 024b)까지 사용했음을 직접 확인했다.

```
$ grep -rhoE "REQ-AUTH-[0-9]+" .moai/specs/SPEC-AUTH-001/*.md | sort -u | tail -3
REQ-AUTH-023
REQ-AUTH-024
REQ-AUTH-025
$ grep -rhoE "AC-AUTH-[0-9]+[a-z]?" .moai/specs/SPEC-AUTH-001/*.md | sort -u | tail -5
AC-AUTH-020
AC-AUTH-021
AC-AUTH-022
AC-AUTH-023
AC-AUTH-024
```

이 SPEC은 REQ-AUTH-026 / AC-AUTH-025부터 시작한다.

**grounding 검증**: 사용자가 제공한 조사 사실(SPEC-AUTH-001의 signup/login route.ts 정확한 응답 바디·상태코드·오류 메시지 리터럴, `staff/login/page.tsx`의 정확한 UI 관례, `resolveAdminSession`의 7단계 알고리즘과 그 테스트 파일, `middleware.ts` matcher, `Order` 스키마의 `userId` 부재) 전부를 Read/Bash로 직접 재확인한 뒤 spec.md·plan.md·acceptance.md에 반영했다 — 사용자 제공 사실을 그대로 받아쓰지 않고 근거 파일을 직접 읽어 검증했다:

```
$ find src/app -iname "*login*" -o -iname "*signup*"
src/app/api/auth/signup
src/app/api/auth/login
src/app/staff/login
$ grep -n "matcher" src/middleware.ts
matcher: ["/admin/:path*"],
```

Read로 직접 확인한 파일: `src/app/staff/login/page.tsx`, `src/features/admin/services/admin-session.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/auth/login/route.ts`, `src/lib/auth/cookies.ts`, `tests/unit/admin/admin-session.test.ts`, `tests/unit/app/staff-login-page.test.tsx`, `prisma/schema.prisma`(Order/RefreshToken 모델).

**의존 SPEC 상태 확인**: `depends_on`/`related_specs`에 인용한 2개 SPEC 모두 `status: completed`를 각 SPEC의 spec.md 프론트매터를 직접 grep해 확인했다.

```
$ for s in AUTH-001 ADMIN-001; do echo -n "$s: "; grep "^status:" .moai/specs/SPEC-$s/spec.md; done
AUTH-001: status: completed
ADMIN-001: status: completed
```

**Tier 판정**: M. 파일 수(6개 — 신규 소스 3 + 신규 테스트 3, 기존 파일 수정 0건, plan.md §E) · LOC(약 400~600, Tier M 범위 중간) · REQ/AC(각 12건) 모두 Tier M 가이드 이내다. 사용자가 명시적으로 `acceptance.md`를 별도 산출물로 요구했고(Tier S는 AC를 spec.md §3에 인라인함), Conditional Design Route가 적용되어(§E) design phase가 폼 레이아웃·상호 이동 링크 등 시각 세부를 이어받는다는 두 근거로 M을 유지했다(plan.md §E에 상세 기록).

**Conditional Design Route**: 적용됨(`plan → design → run`) — `acceptance.md`가 화면(`/login`, `/signup`)과 프런트엔드 컴포넌트를 명시적 산출물로 검증하므로 두 갈래 판정 기준의 첫 번째가 만족된다(plan.md §E). SPEC-ADMIN-001(`staff/login`)·SPEC-STOREFRONT-001/002/003이 동일 기준으로 이미 이 경로를 적용한 선례를 따랐다. 이 plan-phase에서는 판정만 기록했고 design phase 자체는 실행하지 않았다.

**[NEEDS CLARIFICATION] 마커**: 없음. 이 SPEC의 모든 범위 결정(redirect 파라미터 제외, 로그아웃 UI 제외, 공유 헤더 제외, 리뷰/구매검증/스키마 변경 제외, OAuth UI 제외, "로그인 유지" 부가 UX 제외, `resolveAdminSession` 리팩터 제외, 클라이언트 인증 상태 저장소 미도입)는 착수 전 사용자와의 Socratic AskUserQuestion 라운드로 이미 승인된 상태로 위임되었다 — plan-phase 중 새로 발견된 미해결 모호성이 없다.

**Route (SPEC lifecycle)**: 이 SPEC은 Tier M이므로 Route A(Hybrid Trunk main-direct) 대상이다 — PR 없이 커밋/푸시 이벤트로 phase 전이가 트리거된다(spec-workflow.md).

**run-phase 진입을 막는 항목은 이제 plan-audit + Implementation Kickoff Approval(사용자 승인) 둘뿐이다.** 이 문서 작성 시점에는 아직 어느 쪽도 수행되지 않았다.

## §E.1a Plan-Audit Result (iteration 1)

**Verdict: PASS** (score 0.97, Tier M 임계값 0.80 대비 큰 폭 초과). 감사자: plan-auditor (독립 adversarial 감사, Claude-only — 프로젝트 설정에 `audit_model` 오버라이드 없음). 보고서: `.moai/reports/plan-audit/SPEC-AUTH-002-review-1.md`.

Must-pass 7항목 전부 PASS (MP-4/MP-7은 해당 조건상 자연스러운 N/A 사유로 PASS 처리 — MP-4는 단일 언어 프로젝트라 N/A, MP-7은 plan.md에 `[NEEDS CLARIFICATION]` 마커 0건으로 PASS). REQ/AC 번호 이어받기(REQ-AUTH-026~037, AC-AUTH-025~036) 독립 재검증 완료, 갭·중복 없음. spec.md/plan.md의 모든 코드 인용(로그인/회원가입 API 응답 바디·오류 문자열, `resolveAdminSession` 7단계, `staff/login` UI 관례, 테스트 선례 2건, `middleware.ts` matcher, `Order` 스키마)을 실제 소스 파일 직접 Read로 재검증 — 날조되거나 드리프트된 인용 없음. "클라이언트 측 인증 상태 저장소 미도입" 결정이 spec.md/plan.md/acceptance.md 전체에서 모순 없이 일관됨을 확인. 보안 스코프 점검(신규 공격 표면 없음, 제네릭 로그인 오류 메시지가 코드 레벨에서 단일 상수로 강제됨을 재확인, XSS/CSRF 신규 취약점 없음) 통과.

경미/선택적(optional) 결함 3건 기록(D1: REQ-026/028/032의 shall+shall-not 복합절 스타일, D2: progress.md의 "AC-AUTH-024b" 표현 부정확, D3: `resolveSession` 미소비 — SPEC 스스로 명시적으로 정당화한 선제 구축). 셋 다 PASS 판정을 막지 않으며 차단(blocking) 아님.

**run-phase 진입을 막는 항목은 이제 Implementation Kickoff Approval(사용자 승인) 하나뿐이다.**

## §E.2 Run-phase Evidence

TDD로 M1~M5 전부 구현 완료. design-notes.md의 결정(`staff/login` 시각 관례 재사용, 상호 이동
링크 추가)을 그대로 따랐다.

**신규 파일**: `src/lib/auth/session-resolver.ts`(M1), `src/app/login/page.tsx`(M2),
`src/app/signup/page.tsx`(M3), 테스트 4종(`tests/unit/auth/session-resolver.test.ts`,
`tests/unit/app/login-page.test.tsx`, `tests/unit/app/signup-page.test.tsx`,
`tests/unit/auth/auth-boundary-static.test.ts`). 기존 파일 수정 0건(PRESERVE 완전 준수).

**AC PASS 매트릭스** (AC-AUTH-025~036, 12건 전부 PASS):

```
$ npx vitest run tests/unit/auth/session-resolver.test.ts tests/unit/app/login-page.test.tsx tests/unit/app/signup-page.test.tsx tests/unit/auth/auth-boundary-static.test.ts
 ✓ tests/unit/auth/auth-boundary-static.test.ts (3 tests)
 ✓ tests/unit/auth/session-resolver.test.ts (7 tests)
 ✓ tests/unit/app/login-page.test.tsx (5 tests)
 ✓ tests/unit/app/signup-page.test.tsx (6 tests)
 Test Files  4 passed (4) / Tests  21 passed (21)
```

- AC-AUTH-025~028 — `login-page.test.tsx`: 표준 요청 바디, 성공 시 `/` 이동, 실패 시 서버
  메시지 표시(파싱 불가 폴백 포함), redirect/next 파라미터 정적 부재 — PASS
- AC-AUTH-029~031 — `signup-page.test.tsx`: 표준 요청 바디, 201 시 자동 로그인 없이 `/login`
  이동, 실패 메시지 3종(a/b/c) 정확히 표시 — PASS
- AC-AUTH-032~034 — `session-resolver.test.ts`: customer/admin 둘 다 해석(REQ-033), 읽기
  전용(findFirst 1회, create/update/updateMany 0회), 4가지 실패 경로 전부 동일 null — PASS
- AC-AUTH-035 — `git diff --stat main...HEAD -- src/features/admin/services/admin-session.ts
  src/middleware.ts` → 출력 없음(무변경 확인) + `admin-session.test.ts` 재실행 7/7 PASS(무회귀)
- AC-AUTH-036 — `auth-boundary-static.test.ts`: 3개 파일 모두 `createContext`/`useContext`/
  `useAuth`/`localStorage`/`sessionStorage` 매치 0건 — PASS

**독립 재검증**(오케스트레이터가 t13에서 직접 재실행):
```
$ npx tsc --noEmit          → exit 0
$ npm run lint              → exit 0, 신규 이슈 0건
$ npx vitest run --coverage (신규 파일 3종 대상)
  session-resolver.ts        → 100% stmts/branch/funcs/lines
  login/page.tsx              → 100% stmts/lines, 85.71% branch
  signup/page.tsx             → 100% stmts/lines, 86.66% branch
  (전부 ≥85%/≥80% 임계값 충족)
$ npm test (전체 스위트)     → Test Files 106 passed / Tests 1438 passed, 0 failed
```

**subagent 경계 grep**: `grep -rn 'AskUserQuestion' src/app/login src/app/signup
src/lib/auth/session-resolver.ts` → 매치 0건.

**환경 참고**: t34/t20 카드에서 확인된 것과 동일하게, 이 SPEC의 plan-phase 산출물도 커밋되지
않은 상태로 발견되어 오케스트레이터가 plan-phase 커밋을 대신 남겼다(§E.1과 동일 상황).

## §E.3 Run-phase Audit-Ready Signal

run_status: audit-ready

- M1~M5 전부 완료, AC-AUTH-025~036 12건 전부 PASS
- `npx tsc --noEmit` exit 0 / `npm run lint` exit 0 신규 이슈 0건 / 신규 파일 3종 커버리지
  100% lines·stmts, ≥85% branch
- 전체 스위트 1438/1438 통과(회귀 0건)
- PRESERVE 준수: `src/features/admin/services/admin-session.ts`, `src/middleware.ts` 무변경
  확인(git diff --stat), `admin-session.test.ts` 무회귀
- plan.md §I 안티패턴(공유 유틸 추출, 방어적 역할 분기, `resolveAdminSession` 리팩터, 헤더/
  내비 추가) 전부 미범함
- sync-phase 진입을 막는 항목 없음

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_status: audit-ready
sync_complete_at: 2026-09-04
sync_commit_sha: 6cf4f4e
b12_self_test_a: "grep -c 'SPEC-AUTH-002' CHANGELOG.md → 0 (중복 없음, 발행 진행)"
b12_self_test_b: "AC 12건 — acceptance.md(SSOT) 직접 검사. grep 원시 결과는 13건이나 AC-AUTH-001은 3행 산문의 범위 표기('AC-AUTH-001~024')에서 온 것이고, 실제 AC는 AC-AUTH-025~036 12건. CHANGELOG 인용 12건과 일치"
b12_self_test_c: "CHANGELOG·README가 인용한 모든 경로를 git show --stat / ls로 실재 확인 — 신규 7개(src 3 + tests 4) 전부 존재"
changelog_entry_position: "[Unreleased] 최상단 — '### 추가 — SPEC-AUTH-002' (기존 t20 수정 항목 바로 위)"
frontmatter_status_transitions:
  spec.md: "in-progress → completed"
  plan.md: "draft → completed"
  acceptance.md: "N/A — 이 파일은 프론트매터 블록이 없음(본문이 h1으로 시작)"
  progress.md: "in-progress → completed"
canary_compliance_check: "N/A — 이 SPEC은 전방 정책을 정의하지 않음"
```

**동기화 산출물.**

- `CHANGELOG.md` — `[Unreleased]` 최상단에 `### 추가 — SPEC-AUTH-002` 절과 `### 알려진 한계 — SPEC-AUTH-002` 절 추가. 신규 파일 3종의 **소스를 직접 Read한 뒤** 작성했다(plan.md 서술 재사용 아님) — 인용한 리터럴(쿠키명 `refresh_token`, `router.push("/")`/`router.push("/login")`, 오류 문구 3종, `findFirst` 단일 호출)은 전부 소스에서 확인한 값이다.
- `README.md` — (1) 상단 구현 목록에 `SPEC-AUTH-002` 항목 1줄 추가(`SPEC-ADMIN-002` 바로 위), (2) `## 고객용 로그인·회원가입 화면 (SPEC-AUTH-002)` 절 신설(`SPEC-STOREFRONT-003` 절과 `SPEC-ORDER-001` 절 사이). 기존 SPEC 절들의 서술 관례(경로 표, 결정의 근거, **알려진 한계** 문단)를 그대로 따랐다.
- docs-site 동기화 — 해당 없음. 이 저장소에 `docs/`·`docs-site/` 디렉터리가 존재하지 않음(`ls` 확인).

**MX 태그 검증.** 신규 소스 3종을 mx-tag-protocol 기준으로 점검했다.

- `src/lib/auth/session-resolver.ts` — `@MX:NOTE` 1건 **추가**. 근거: `resolveSession`이 이 SPEC 안에 소비자가 없어 fan_in 0인데, 그것이 죽은 코드가 아니라 의도된 선제 구축이라는 사실이 소스만 읽어서는 드러나지 않는다(plan-audit D3이 같은 지점을 지적). `resolveAdminSession`과 공유하지 않는 이유도 함께 고정했다. `code_comments: en` 설정에 따라 영문, 에이전트 생성이므로 `[AUTO]` 접두.
- `src/app/login/page.tsx` · `src/app/signup/page.tsx` — 태그 추가 **없음**. 두 파일 모두 라우트 기본 내보내기(fan_in 0)라 `@MX:ANCHOR` 임계값(fan_in ≥ 3) 미달, 순환복잡도 15 미만·분기 8개 미만·전역 상태 변경 없음·goroutine 상당 구조 없음이라 `@MX:WARN` 사유 없음, 공개 함수 미테스트 없음(각각 전용 테스트 파일 보유)이라 `@MX:TODO` 사유 없음. 기존 JSDoc 헤더가 이미 REQ 추적·설계 근거를 담고 있어 `@MX:NOTE` 중복 사유도 없다.
- 제거·갱신 대상 태그 없음(이 SPEC이 만든 파일 이전에 태그가 존재하지 않았고, 기존 파일 수정 0건).

**sync-audit 진입을 막는 항목 없음.**
