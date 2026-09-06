# progress.md — SPEC-ADDRESS-001

## §E.1 Plan-phase Audit-Ready Signal

plan_status: audit-ready
plan_complete_at: 2026-09-07
plan_audit_verdict: PASS (iteration 2/3 — confirming re-audit, defect-delta scoped)
plan_audit_score: 0.99 (Tier M 임계값 0.80 초과. iteration 1은 0.92 PASS이나 blocking 결함 4건(D1-D4) 미해소로 재감사 필요)
plan_audit_report: .moai/reports/plan-audit/SPEC-ADDRESS-001-2026-09-07.md

plan-phase 산출물 4종(`spec.md`, `plan.md`, `acceptance.md`, `spec-compact.md`) 작성 완료. 착수 전 사용자가 AskUserQuestion 라운드로 두 가지 범위 결정을 이미 확정한 상태로 위임되어, 별도 명료화 라운드 없이 진행했다:

1. **CSRF 적용 여부** — 모든 상태 변경 주소록 엔드포인트에 적용(확정).
2. **체크아웃 통합 범위** — 마이페이지 관리 전용, 체크아웃 연동 제외(확정).

## §F Phase 4 Mode Selection

**Input parameters**: tier=M; scope≈14 files (1 migration, `features/addresses/{types,repositories,services}` 3, API 라우트 3, 페이지 1, 컴포넌트 2, 신규 테스트 3, `prisma/schema.prisma` 1); domain count=4(DB/마이그레이션, API+CSRF+소유권 보안, 프런트엔드 게이트+화면, 테스트); file language mix=TypeScript + Prisma; concurrency benefit=LOW(마일스톤이 순차 의존 — M1 스키마가 M2/M3의 전제, M4 게이트가 M5 화면의 전제).

**Mode evaluation**:
- `direct` — 선택 안 함(타이포/단순 변경 범위를 크게 초과).
- `fanout` — 선택 안 함(코딩 중심 작업이라 Anthropic의 coding-task parallelism caveat에 해당, 마일스톤 간 순차 의존).
- `sweep` — 선택 안 함(균일 기계적 변환 1개가 아니라 도메인마다 다른 5개 변환 규칙).
- `serial`(manager-develop 직접 위임) — **선택**. Tier M, 6마일스톤, ~14파일 — SPEC-ORDER-004(Tier L, 7마일스톤, 15+파일)보다 작은 규모라 manager-lead 조율 없이 manager-develop 단일 위임으로 충분(orchestration-mode-selection.md §B.2 tie-breaker: 문턱 근접 시 더 단순한 모드 우선).

**Decision: serial**

**Justification**: Tier M SPEC로 6개 마일스톤이 M1(스키마)→M6(테스트)까지 순차 의존한다. Anthropic의 coding-task parallelism caveat에 따라 코딩 중심 작업은 병렬화 이득이 낮으므로 serial이 정답이며, 규모(Tier M, ~14파일)가 manager-lead의 진입 문턱(≥3마일스톤 AND ≥10파일 AND 교차 도메인)을 명목상 넘지만 SPEC-ORDER-004 대비 작은 범위라 조율 오버헤드 없이 manager-develop 단일 위임이 더 단순하고 적절하다.

미해결 명료화 마커 없음. REQ-ADDRESS-001~015(15개), AC-ADDRESS-001~015(15개) — Tier M 예산 16/16 이내이며 각 1칸 여유.

### plan-auditor iteration 1 — PASS 0.92, 7건 조치 완료

독립 감사 결과 **PASS**(0.92 ≥ Tier M 임계값 0.80). must-pass 7개 전부 PASS. 지적된 7건(blocking 4 + optional 3)은 전부 **국소적 텍스트 수정**이었고 요구사항·AC·설계 결정을 하나도 바꾸지 않았다. 전건 조치 완료:

| ID | 등급 | 내용 | 조치 |
|---|---|---|---|
| D1 | major, blocking | `plan.md`·`acceptance.md`가 기본 배송지 안전 장치를 트랜잭션 "롤백"으로 잘못 귀속. 실제 코드는 `return false`이고 Prisma는 반환 시 커밋·throw 시에만 롤백 — 진짜 안전 장치는 **첫 `updateMany`가 0건 매치**라는 사실이다 | 두 위치를 `@MX:WARN`의 올바른 표현으로 통일하고, "롤백으로 읽고 대칭성 맞추려 `throw`를 넣으면 404가 500이 된다"는 위험을 명시 |
| D2 | minor, blocking | AC-ADDRESS-014의 `grep` 경로 `src/app/(shop)/mypage`가 인용되지 않아 셸 파싱 오류 — "0건 PASS"가 아니라 실행 실패 | 두 명령 전체를 따옴표 인용 형태의 코드 블록으로 재작성하고, 판정을 exit 코드가 아닌 출력 공백으로 명시 |
| D3 | minor, blocking | CSRF 적용 경로 수를 6으로 기재(실제 7) | `spec.md`·`progress.md` 두 곳을 7로 정정. 근거 명령을 `grep -rln … \| wc -l`로 교체. 결정(다수 선례 추종)은 불변이며 7 대 1로 오히려 강화 |
| D4 | minor, blocking | `plan.md` "수정 (2)"인데 열거는 1개, `spec-compact.md`는 "1 수정" — 상호 모순. "11 신규 구현"도 실제 열거는 10 | 3개 위치를 **수정 1 / 신규 구현 10 / 신규 테스트 3**으로 통일하고 항목별 개수를 병기 |
| D5 | optional | AC-ADDRESS-015에 상위 REQ 없음 | REQ를 새로 만들지 않고, **의도된 공통 회귀 게이트**임을 매핑 표에 명시적으로 공시(승격 시 SPEC마다 중복 선언되는 문제를 근거로) |
| D6 | optional | `spec.md`의 "`/mypage`를 회원 영역 루트로 열되"가 존재하지 않는 라우트를 암시 | "`/mypage`는 이름 공간으로 예약만 하고 라우트는 만들지 않는다 — 직접 열면 404"로 재서술 |
| D7 | optional | `plan.md`가 `:86-89`를 인용문 출처로 기재(실제 주석은 `:84`) | `:84-89`로 정정하고 주석(`:84`)과 게이트 코드(`:86-89`)를 분리 표기. 코드 span을 인용한 나머지 3개 위치는 정확하므로 미변경 |

**감사 지적의 실측 재확인** — 조치 전 7건을 전부 직접 검증했다: `grep -rln "verifyCsrfRequest" src/app | wc -l` → `7`(D3 확인), 괄호 미인용 경로는 셸이 파싱 자체를 거부(D2 확인), `sed -n '84,89p' src/app/staff/products/page.tsx` → 주석은 `:84`·코드는 `:86-89`(D7 확인, 부분 지적임이 드러나 plan.md만 수정), 파일 열거 재계수 → 신규 구현 10·수정 1(D4 확인).

### Phase 1 SKIP Rationale (research.md 미작성 근거)

Tier M이므로 `research.md`는 필수 산출물이 아니다. 대신 착수 전 정찰에서 확인한 사실을 **이 세션이 직접 재검증**한 뒤 `spec.md` §1.2/§1.3/§1.5와 `plan.md` §B에 근거와 함께 인라인으로 기록했다. 재검증 명령과 관측 결과:

| 주장 | 검증 방법 | 관측 결과 |
|---|---|---|
| SPEC ID 충돌 없음 | `ls -d .moai/specs/SPEC-ADDRESS-001` | `No such file or directory` — 충돌 없음 |
| SPEC ID 형식 적합 | Bash 정규식 `^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$` | `PASS` |
| 후보 ID가 카드에 선기록됨 | `grep -rn "SPEC-ADDRESS-001" .moai/specs/` | `SPEC-ORDER-003/spec.md:96`, `SPEC-ORDER-003/plan.md:19` 2건 |
| SPEC-ORDER-004 병합됨 | `git log --oneline` | `f10155d feat(SPEC-ORDER-004) … (#30)` |
| ORDER-004가 선행 조건 해소를 명시 | `sed -n '185,195p' SPEC-ORDER-004/spec.md` | `:191` "이 SPEC이 그 선행 조건을 해소한다" 확인 |
| `resolveSession()` 호출부 | `grep -rn "resolveSession" src/` | 구현부 1 + 호출부 **6곳**(SiteHeader:30, products/[productId]:49, checkout:53, checkout/complete:88, api/orders:51, api/reviews:29). 위임 프롬프트는 7곳이라 했으나 실측은 6곳 — 리다이렉트하는 곳이 하나도 없다는 결론은 동일 |
| 고객용 리다이렉트 게이트 부재 | 위 6곳 개별 확인 | 전부 `null`을 익명으로 취급(UI 분기·게스트 폴백·401 JSON). 리다이렉트 0건 |
| staff 리다이렉트 선례 | `sed -n '70,110p' src/app/staff/products/page.tsx` | `:86-89` `resolveAdminSession` → `redirect("/staff/login")` 확인 |
| CSRF 선례 분포 | `grep -rln "verifyCsrfRequest" src/app \| wc -l` | **7개 파일** 적용(orders 회원분기 1 · staff 4 · auth refresh/logout 2 = 7), `api/reviews`에는 import 자체 없음 |
| ORDER-004 CSRF 순서 교훈 | `sed -n '1,80p' src/app/api/orders/route.ts` | `:26-35` 주석에 순환과 해법("CSRF before the STATE-CHANGING operation") 원문 확인 |
| `CheckoutForm`에 회원 통로 없음 | `sed -n '60,85p' src/components/checkout/CheckoutForm.tsx` | props가 `idempotencyKey`/`confirmedTotal`/`couponCode` 3개뿐 — `isLoggedIn`/`userId` 없음 |
| 로그인 복귀 파라미터 금지 | `grep -n "REQ-AUTH-029" SPEC-AUTH-002/spec.md` | `:75` Unwanted "…구현해서는 안 된다 — 성공 시 이동 대상은 항상 고정된 `/`" 확인. `login/page.tsx` 주석도 동일 |
| onDelete 분류 근거 | `cat prisma/schema.prisma` | Cascade(Review·Cart·RefreshToken·CartItem) vs Restrict(Order.user·OrderItem.product) 및 스키마 자체 주석의 사유 확인 |
| 마이그레이션 관행 | `ls prisma/migrations/` + 최신 헤더 | 11개, 전부 손 작성. 헤더에 사유 명시 확인 |
| 기본 지정 선례 부재 | 스키마 전수 확인 | `isDefault`/`isPrimary` 계열 컬럼 0건 — greenfield 확정 |
| 단일 boolean 전환 라우트 선례 | `grep -rn "verifyCsrfRequest" src/` | `staff/api/products/[productId]/active/route.ts` 존재 확인 |

**위임 프롬프트와 실측이 어긋난 지점 1건**: `resolveSession()` 호출부가 프롬프트에는 7곳으로 적혔으나 실측은 6곳이다(구현부 `session-resolver.ts:54`를 포함하면 7). 결론("어느 곳도 `null`에 리다이렉트하지 않는다")은 영향을 받지 않으며, `spec.md` §1.3은 실측치 6곳으로 기록했다.

## §E.2 Run-phase Evidence

### 마일스톤별 완료 근거

| M | 내용 | 커밋 | 근거 |
|---|---|---|---|
| M1 | `Address` 모델 + 손 작성 마이그레이션 | `4d9a06c` | `prisma migrate deploy` 성공(로컬 데모 Postgres `localhost:5433`), `prisma migrate status` clean, `prisma migrate diff` 빈 결과(스키마-마이그레이션 무drift) |
| M2 | API 계약 5개 엔드포인트 | `29e83dc` | 3개 라우트 파일, CSRF-first 순서, 15개 라우트 테스트 PASS |
| M3 | 소유권 조건부 쓰기 + 기본 배송지 트랜잭션 | `29e83dc` | `address-repository.test.ts` 8개 테스트 — set-먼저/unset-나중 순서와 소유권 실패 시 0회 unset 직접 검증 |
| M4 | `/mypage/addresses` 페이지 게이트 | `17efdff` | `mypage-addresses-page.test.tsx` 5개 테스트 — 게이트가 데이터 읽기보다 먼저(mock 호출 0회), `next=`/`redirect=`/`returnUrl=` 파라미터 부재 |
| M5 | `AddressList`/`AddressForm` 컴포넌트 | `17efdff` | `address-form.test.tsx` 6개 + `address-list.test.tsx` 8개 — CSRF 헤더, 인라인 수정 토글, 기본 지정/삭제 액션 |
| M6 | 테스트·회귀 확인 | 위 3개 커밋에 포함(개별 M6 커밋 없음 — 구현과 동일 커밋에 테스트 포함) | 전체 스위트 124 files/1634 tests all pass (기준선 116/1572 대비 +8 files/+62 tests, 실패 0건) |

### AC-ADDRESS-001~015 PASS/FAIL 매트릭스

| AC | 검증 명령 | 실제 출력 | 상태 |
|---|---|---|---|
| AC-ADDRESS-001 | `prisma/schema.prisma`의 `Address` 모델 직접 열람 | `userId` FK `onDelete: Cascade`, `@unique` 없음, `@@index([userId])` 존재 확인 | PASS |
| AC-ADDRESS-002 | 동일 | 4개 필드(recipientName/recipientPhone/postalCode/address) + isDefault 존재, `deliveryMemo` 없음 | PASS |
| AC-ADDRESS-003 | `route.test.ts` "POST /api/addresses — AC-ADDRESS-003" | PASS — 201 + `createAddress`가 올바른 userId·body로 호출됨 | PASS |
| AC-ADDRESS-004 | `address-id-route.test.ts` + `address-service.test.ts` "updateAddress — AC-ADDRESS-004" | PASS — 200 + 갱신된 필드 반환 | PASS |
| AC-ADDRESS-005 | `address-id-route.test.ts`/`address-service.test.ts` "DELETE — AC-ADDRESS-005" | PASS — 성공 응답, count 0 → 404로 이후 조회 안 됨(서비스 레벨 확인) | PASS |
| AC-ADDRESS-006 | `address-repository.test.ts` "setDefault — AC-ADDRESS-006" + `default-route.test.ts` | PASS — 대상 true, 기존 기본값 false로 전환(2회 updateMany 호출·순서 확인) | PASS |
| AC-ADDRESS-007 | `address-repository.test.ts` "setDefault — AC-ADDRESS-007" | PASS — 소유권 실패 시 `updateMany` **정확히 1회만** 호출(2번째 미도달) → 기존 기본값 불변 | PASS |
| AC-ADDRESS-008 | `address-repository.test.ts` "createForUser — AC-ADDRESS-008" | PASS — 첫 주소 `isDefault: true`, 두 번째는 `false` | PASS |
| AC-ADDRESS-009 | `address-service.test.ts`/`route.test.ts` 검증 케이스 6개 | PASS — 4개 필드 각각의 빈 문자열/공백/비문자열 입력이 400, 저장소 미호출 | PASS |
| AC-ADDRESS-010 | `route.test.ts`/`address-id-route.test.ts`/`default-route.test.ts`의 "CSRF first" describe 4개(4개 엔드포인트) | PASS — 403, `resolveSession`/서비스 함수 호출 횟수 0 | PASS |
| AC-ADDRESS-011 | 동일 파일들의 "AC-ADDRESS-011" describe(GET 포함 5개 엔드포인트) | PASS — 401, 서비스 함수 미호출 | PASS |
| AC-ADDRESS-012 | `address-id-route.test.ts`/`default-route.test.ts`의 "not owned → 404" + `address-service.test.ts` "AC-ADDRESS-012" | PASS — 3개 엔드포인트 전부 404, count 0 매핑 | PASS |
| AC-ADDRESS-013 | `mypage-addresses-page.test.tsx` 5개 테스트 | PASS — 미로그인 시 리다이렉트 + `listAddresses` 미호출(0회); 로그인 시 목록·기본 배지·추가 폼 렌더링 확인 | PASS |
| AC-ADDRESS-014 | `git diff --stat main...HEAD -- <8개 PRESERVE 경로>` + `grep -rn "next=\|redirect=\|returnUrl" "src/app/(shop)/mypage" "src/features/addresses"` | 둘 다 **빈 출력**(첫 명령 exit 0, 둘째 exit 1=매치없음) | PASS |
| AC-ADDRESS-015 | `npx vitest run` 전체 스위트 + `npx tsc --noEmit` + `npx eslint .` | 스위트 124 files/1634 tests all pass(기준선 대비 +8/+62, 실패 0); tsc는 src/ 신규 오류 0건(기존 e2e/playwright 41건 불변, 근거는 §E.3); eslint 전체 clean(exit 0) | PASS |

**15/15 PASS. FAIL 0건.**

### M1 마이그레이션 — migration.sql ↔ schema.prisma 수기 대조 기록

**도달 가능한 데이터베이스가 발견되었다** (`.env`의 `DATABASE_URL=postgresql://postgres:demo@localhost:5433/our_shop`, `nc -z localhost 5433` 성공) — plan.md 작성 시점의 "도달 불가 가정"과 달리, 이 run-phase 세션에서는 로컬 데모 Postgres가 실제로 살아 있었다.

- `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`로 Prisma가 자체 생성할 SQL을 먼저 뽑아, 손으로 쓴 `migration.sql`과 **필드 단위로 동일함**을 확인(CREATE TABLE 9개 컬럼, 1개 인덱스, 1개 FK — 완전 일치).
- `npx prisma migrate deploy` 성공 → `npx prisma migrate status` "Database schema is up to date!" → `npx prisma migrate diff`(동일 명령 재실행) **빈 결과**("This is an empty migration.") — schema.prisma와 실제 DB 사이에 drift 없음을 3중으로 확인.
- 추가로 실제 데이터를 넣어 두 불변식을 직접 관측: (a) Cascade — 임시 User 생성 → Address 1건 연결 → User 삭제 → Address count `1`→`0` 확인(스크립트 실행 후 즉시 삭제, 커밋되지 않음). (b) `userId`에 `@unique` 없음 — 동일 User에 Address 2건 연속 생성이 P2002 없이 성공(`{"secondAddressSucceeded":true}`).
- 이 두 스크립트는 검증 전용 임시 파일로, 실행 직후 `rm`으로 제거했고 `git status --short`로 워킹 트리에 흔적이 없음을 확인했다 — 커밋된 산출물에는 포함되지 않는다.

### `git diff --stat` — 전체 변경 범위 (baseline `5731187` 대비)

```
 .moai/specs/SPEC-ADDRESS-001/spec.md               |   2 +-
 .../20260906160000_add_address_model/migration.sql |  36 ++++
 prisma/schema.prisma                               |  48 +++++
 src/app/(shop)/mypage/addresses/page.tsx           |  62 ++++++
 src/app/api/addresses/[addressId]/default/route.ts |  55 ++++++
 src/app/api/addresses/[addressId]/route.ts         |  84 ++++++++
 src/app/api/addresses/route.ts                     |  70 +++++++
 src/components/address/AddressForm.tsx             | 165 ++++++++++++++++
 src/components/address/AddressList.tsx             | 156 +++++++++++++++
 .../addresses/repositories/address-repository.ts   | 114 +++++++++++
 src/features/addresses/services/address-service.ts | 153 +++++++++++++++
 src/features/addresses/types/address.ts            |  42 ++++
 tests/unit/api/addresses/address-id-route.test.ts  | 154 +++++++++++++++
 tests/unit/api/addresses/default-route.test.ts     |  84 ++++++++
 tests/unit/api/addresses/route.test.ts             | 136 +++++++++++++
 tests/unit/app/mypage-addresses-page.test.tsx      | 106 ++++++++++
 tests/unit/components/address-form.test.tsx        | 126 ++++++++++++
 tests/unit/components/address-list.test.tsx        | 122 ++++++++++++
 .../features/addresses/address-repository.test.ts  | 212 ++++++++++++++++++++
 .../features/addresses/address-service.test.ts     | 215 +++++++++++++++++++++
 20 files changed, 2141 insertions(+), 1 deletion(-)
```

plan.md §F가 예정한 "수정 1 + 신규 구현 10 + 신규 테스트 3"과 실제 구현 파일 수는 정확히 일치(수정 1: `schema.prisma`, 신규 구현 10: 마이그레이션 1 + types/repositories/services 3 + 라우트 3 + 페이지 1 + 컴포넌트 2). 테스트는 plan.md가 예정한 3개 파일보다 **8개 파일로 분할**했다 — 저장소의 실제 관행(`tests/unit/api/<domain>/route.test.ts`처럼 라우트별 분리, `tests/unit/app/<name>-page.test.tsx` 페이지 전용 디렉터리)을 그대로 따른 판단이며, AC 커버리지 총량은 동일하다.

### `spec.md` frontmatter 전이

`status: draft → in-progress`를 M1 첫 커밋(`4d9a06c`)에서 수행(`updated:`는 이미 오늘 날짜라 갱신 불필요). body 내용은 변경하지 않았다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-09-07
run_commit_sha: 17efdff
run_status: PASS
ac_pass_count: 15
ac_fail_count: 0
preserve_list_post_run_count: 0   # git diff --stat의 8개 PRESERVE 경로, 변경 0건
l44_pre_commit_fetch: "git fetch origin main → 0 behind, 2 ahead (plan-phase 커밋 2개, 계획된 상태)"
l44_post_push_fetch: "N/A — 이 세션은 push하지 않음(오케스트레이터가 독립 재검증 후 merge/PR 라우팅)"
new_warnings_or_lints_introduced: 0
cross_platform_build:
  npm_run_build: "실패 — 원인은 이 SPEC과 무관한 사전 존재 환경 결함(아래 상술). typescript.ignoreBuildErrors를 임시로 켠 진단 빌드에서 4개 신규 라우트(/api/addresses, /api/addresses/[addressId], /api/addresses/[addressId]/default, /mypage/addresses) 전부 빌드 산출물에 등장 확인 후 next.config.ts를 즉시 원복(git diff 없음)"
  tsc_noEmit: "src/ 전역 신규 오류 0건. 41건은 기준선과 완전 동일(e2e/*.ts 8건 + playwright.config.ts 1건 — @playwright/test가 package.json/lock에는 있으나 공유 node_modules(원본 체크아웃)에 실제 설치돼 있지 않음, 이 SPEC과 무관한 환경 결함)"
total_run_phase_files: 20   # 수정 1(spec.md) + 신규 19(구현 10: migration.sql/schema 변경분 제외한 신규 파일 9 + schema.prisma는 수정으로 카운트했으므로 마이그레이션 1 포함 구현 10, 테스트 8 + spec.md 1) — 위 git diff --stat의 20파일과 정확히 일치
m1_to_mN_commit_strategy: "M1(4d9a06c) → M2/M3 합본(29e83dc) → M4/M5 합본(17efdff), 3개 점진 커밋. M6은 별도 커밋 없이 M2-M5 구현 커밋에 테스트 동봉(각 커밋이 자기 마일스톤의 구현+테스트를 함께 포함)"
```

### Gaps (미검증)

- **동시 첫-주소 생성 경합** — acceptance.md §E가 이미 잔여 위험으로 명시. `address-repository.ts`의 `@MX:TODO`로 코드에도 표시했다. 검증하지 않음(의도적, AC 없음).
- **`npm run build`의 정식 통과** — 위 `cross_platform_build.npm_run_build` 참고. 이 SPEC이 원인이 아님을 (a) `tsc --noEmit`의 41건 오류가 M1 착수 전 baseline capture(Step 2.5, `Prisma generate` 재생성 직후)에서도 동일하게 41건이었고, (b) 실패 파일이 전부 `e2e/**`·`playwright.config.ts`(이 SPEC이 손대지 않은 디렉터리)이며, (c) `@playwright/test`가 `package.json`/`package-lock.json`에는 선언돼 있으나 공유 `node_modules`(원본 체크아웃)에 실제로는 설치돼 있지 않다는 사실로 3중 확인했다. 이 gap을 해소하는 것(playwright 재설치)은 이 SPEC의 범위 밖이라 손대지 않았다.
- **실제 동시성 부하 하에서의 기본 배송지 트랜잭션** — 유닛 테스트는 mock으로 호출 순서만 검증했다. 실제 DB 트랜잭션 격리 수준 하의 동시 요청 테스트는 수행하지 않음(M3가 이미 이 트레이드오프를 인지하고 애플리케이션 트랜잭션을 선택).

### Residual-risk (잔여 위험)

- 위 Gaps의 동시 첫-주소 경합과 build 환경 결함은 그대로 잔여 위험으로 이어진다.
- `AddressForm`/`AddressList`의 클라이언트 fetch 오류 처리는 유닛 테스트로 커버했으나, 실제 브라우저 네트워크 실패(타임아웃, CORS 등)의 엣지 케이스는 검증하지 않았다 — 기존 `ReviewForm`/`CancelOrderButton`과 동일한 처리 수준으로 맞췄을 뿐, 이 SPEC이 새로운 위험을 추가하지는 않는다.

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
