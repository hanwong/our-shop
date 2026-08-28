# Progress: SPEC-CATALOG-001 — 상품 카탈로그 도메인 모델 및 목록/상세 조회 API

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-27T00:00:00+09:00
- plan_status: audit-ready

## §E.2 Run-phase Evidence

### E.2.0 실행 환경 편차 (run-phase 시작 시점에 발견)

디스패치는 작업 디렉터리가 `WT-catalog-plan` 브랜치의 카드 워크트리(HEAD `8336501`)라고 명시했으나,
실제 배정된 워크트리는 `.claude/worktrees/agent-a6bc936c2517a5326`(브랜치
`worktree-agent-a6bc936c2517a5326`, HEAD `b551c2d`)였고 SPEC-CATALOG-001 산출물이 존재하지 않았다.

- 확인 근거: `git branch --show-current` → `worktree-agent-a6bc936c2517a5326`,
  `git rev-parse HEAD` → `b551c2dae1b29a47cd3391cc0a1dbbffd07fcb18`,
  `ls .moai/specs/SPEC-CATALOG-001/` → `No such file or directory`.
- `WT-catalog-plan`(8336501)은 별도 워크트리 `.claude/worktrees/catalog-plan`에 이미 체크아웃되어 있어
  같은 브랜치를 이 워크트리에서 다시 체크아웃할 수 없었다(git은 한 브랜치를 한 워크트리에만 체크아웃한다).
- 조치: `b551c2d`가 `8336501`의 조상임을 확인한 뒤(`git merge-base --is-ancestor` → 참)
  `git merge --ff-only WT-catalog-plan`으로 **fast-forward만** 수행했다. 병합 커밋 없음, 히스토리
  재작성 없음, 다른 워크트리 미변경.
- **미해결 사항 — lead 세션 확인 필요**: 구현 커밋 6개가 `WT-catalog-plan`이 아니라
  `worktree-agent-a6bc936c2517a5326` 브랜치에 올라가 있다. 이 브랜치는 `WT-catalog-plan`의 순수
  descendant이므로 `git branch -f WT-catalog-plan 387c88d` 또는 fast-forward 병합으로 손실 없이
  통합 가능하다.
- 부수 효과 1건: 의존성이 상위 프라이머리 체크아웃의 `node_modules`에서 해석되므로
  `prisma generate`가 `/Users/samuel/projects/our-shop/node_modules`의 생성 클라이언트를 갱신했다.
  생성물은 빌드 산출물이며 기존 모델의 상위집합이라 다른 세션의 테스트를 깨지 않는다.

### E.2.1 AC 검증 매트릭스 (AC-CATALOG-001 ~ 016)

전체 명령: `npx vitest run --coverage` → **Test Files 25 passed (25) / Tests 222 passed (222)**
(run-phase 진입 전 베이스라인: 19 files / 140 tests — 회귀 0건, 신규 82건).

| AC | 요구 | 검증 명령 / 테스트 | 실제 결과 | 상태 |
|---|---|---|---|---|
| AC-CATALOG-001 | 상품 필드 완전성 | `tests/unit/catalog/schema.test.ts` + `query-surface.test.ts` (스키마 텍스트 + 생성 Prisma 타입 컴파일 단언) | `name/price:Int/description/images:String[]/stock:Int/categoryId` 전부 선언 확인, `Product` 타입 9필드 일치 | PASS (프록시 — 아래 G1) |
| AC-CATALOG-002 | variant 필드 부재 | `schema.test.ts` — color/size/variant 부재 + 모델 목록 완전 일치 | 모델 목록 = `[User, OAuthAccount, RefreshToken, Category, Product]` | PASS |
| AC-CATALOG-003 | 목록 API 공개 접근 | `tests/unit/api/products/route.test.ts` — 인증 헤더 없이 GET | `status === 200`, 401/403 아님. 잘못된 Bearer 토큰이 있어도 200 | PASS |
| AC-CATALOG-004 | 상세 API 공개 접근 | 동 파일 — 인증 없이 존재 id 조회 | `status === 200` | PASS |
| AC-CATALOG-005 | 기본 페이지네이션 | `product-service.test.ts` — 파라미터 없는 요청 | `page=1, pageSize=20`, items 최대 20개 | PASS |
| AC-CATALOG-006 | 잘못된 page/pageSize 거부 | `product-service.test.ts` (7 케이스) + `route.test.ts` | `page=0/-1/abc/1.5`, `pageSize=0/-5/xyz` 모두 400이며 `findProductsPage`/`findCategoryIdBySlug` **미호출**(DB 조회 없음) | PASS |
| AC-CATALOG-007 | pageSize 상한 클램프 | `product-service.test.ts` + `route.test.ts` | `pageSize=500` → 400 아닌 200, 응답 `pageSize=100`, items 100개. 경계값 100은 그대로 통과 | PASS |
| AC-CATALOG-008 | 페이지네이션 메타데이터 | `product-service.test.ts` + `route.test.ts` | `totalCount=43, pageSize=20` → `totalPages=3, page=1`. 빈 카탈로그 → `totalPages=0` | PASS |
| AC-CATALOG-009 | 정렬 4분기 전체 | `product-service.test.ts` + `product-repository.test.ts` | `price_asc→[{price:asc},{id:asc}]`, `price_desc→[{price:desc},{id:asc}]`, 생략→`newest→[{createdAt:desc},{id:asc}]`, `sort=popularity`→400(DB 미조회) | PASS |
| AC-CATALOG-010 | 존재 카테고리 필터 | `product-service.test.ts` + `route.test.ts` | slug→id 해석 후 `findMany`/`count` 양쪽에 동일 `where:{categoryId}` 적용, 결과 전원 `category.slug==="tops"` | PASS |
| AC-CATALOG-011 | 미존재 카테고리 = 빈 결과 | `product-service.test.ts` + `route.test.ts` | `status 200`, `items: []`, `totalCount: 0` (400/404 아님). 상품 쿼리 자체를 건너뜀 | PASS |
| AC-CATALOG-012 | 검색 파라미터 미지원 (정적 검사) | `query-surface.test.ts` — 화이트리스트 단언 | 카탈로그 소스가 읽는 파라미터 집합 = `[category, page, pageSize, sort]` 정확히 일치. `q/search/keyword/query` 0건. **반증 확인 완료**(G4) | PASS |
| AC-CATALOG-013 | 상세 전체 표현 | `route.test.ts` + `product-service.test.ts` | `name/price/description(전체)/images/category/stock` 전부 포함, `createdAt`/`updatedAt` ISO-8601 | PASS |
| AC-CATALOG-014 | 미존재 상품 404 | `route.test.ts` + `product-service.test.ts` | `status === 404`, 본문 `error` 문자열 | PASS |
| AC-CATALOG-015 | 리뷰/관련상품 부재 | `route.test.ts` + `product-service.test.ts` | row에 `reviews`/`relatedProducts`를 주입해도 응답 키는 정확히 9개(`category/createdAt/description/id/images/name/price/stock/updatedAt`) — 명시적 화이트리스트 매핑 | PASS |
| AC-CATALOG-016 | p95 300ms | `tests/integration/catalog/response-time.test.ts` (N=50, 최근접 순위 p95) | 목록 p95 **0.41ms**, 상세 p95 **0.06ms** — **단, DB 시간 제외**. 조립 비용 선형성 확인(10행 0.08ms → 100행 0.29ms) | **PARTIAL — G2** |

집계: **PASS 15 / PARTIAL 1 / FAIL 0**.

### E.2.2 §9 엣지 케이스

| 케이스 | 결과 | 근거 |
|---|---|---|
| 상품 0개 목록 조회 | 200, `items: []`, `totalCount: 0`, `totalPages: 0` | `product-service.test.ts` |
| 범위 초과 페이지(`page=99`) | 200, `items: []`, `page=99` (400 아님) | `product-service.test.ts` |
| `images: []` 상품 | 오류 없이 빈 배열 그대로 반환 | `product-service.test.ts` |
| `stock: 0` 상품 | 목록/상세에서 제외하지 않고 노출 | `product-service.test.ts` |

### E.2.3 품질 게이트 (acceptance.md §10)

| 게이트 | 명령 | 결과 |
|---|---|---|
| 테스트 전체 통과 | `npx vitest run --coverage` | `Test Files 25 passed (25)` / `Tests 222 passed (222)` |
| 카탈로그 커버리지 ≥85% | 동상 | `src/features/catalog/**` 4파일 + `src/app/api/products/**` 2파일 = **전부 100% Stmts/Branch/Funcs/Lines**. 전체 96.65% |
| 타입 검사 | `npx tsc --noEmit` | exit **0**, 출력 없음 |
| 린트 | `npx eslint .` | exit **0**, 출력 없음 (베이스라인도 exit 0 — 신규 이슈 0건) |
| 스키마 유효성 | `npx prisma validate` | exit **0** — `The schema at prisma/schema.prisma is valid` |
| p95 측정 기록 | `response-time.test.ts` | 측정·기록 완료. DB 제외 한계는 G2에 명시(조용한 생략 없음) |
| 기존 3모델 무diff | `git diff 8336501 HEAD -- prisma/schema.prisma \| grep -c "^-[^-]"` | **0** (삭제/수정 라인 0, 추가 44줄만) |

### E.2.4 PRESERVE 검증

| 대상 | 명령 | 결과 |
|---|---|---|
| `prisma/schema.prisma` 기존 3모델 | `git diff 8336501 HEAD -- prisma/schema.prisma` | 44 insertions, **0 deletions** |
| `src/lib/auth/**`, `src/lib/db/**`, `src/app/api/auth/**`, `src/middleware.ts` | `git diff --stat 8336501 HEAD -- <경로들>` | **출력 없음 = 무변경** |
| SPEC 본문 | — | `spec.md`/`plan.md` frontmatter의 `status`/`updated`만 변경. 본문 §·REQ·AC 미변경. `acceptance.md`는 frontmatter가 없어 변경 대상 없음(G3) |

### E.2.5 미검증 항목 (Gaps) — 명시적 기록

- **G1 — AC-CATALOG-001은 프록시 검증**: AC 원문은 "레코드를 생성하면 필드를 모두 갖는다"이나, 이 환경에는
  PostgreSQL이 없고 `.env`도 없어 실제 INSERT를 수행할 수 없다. 대신 (a) 스키마 텍스트가 모든 필드를
  선언하는지, (b) 생성된 Prisma `Product` 타입이 9개 필드를 정확히 갖는지(tsc 강제)를 검증했다.
  **런타임 레코드 생성 경로는 미검증**이다.
- **G2 — AC-CATALOG-016은 부분 검증**: 측정값(목록 0.41ms / 상세 0.06ms)은 **DB 왕복 시간을 제외한**
  애플리케이션 계층 경로만의 수치다. AC가 요구하는 "50개 이상 시드된 DB에 대한 p95"는 이 환경에서
  측정 불가하다. 통과가 AC를 충족시키지 않으며, 테스트 이름·주석·콘솔 출력 모두에 이 한계를 명시했다.
  실제 DB 대상 p95 측정은 sync/배포 단계 또는 DB가 있는 CI에서 재측정이 필요하다.
- **G3 — `acceptance.md` frontmatter 부재**: 디스패치는 3개 문서의 `status: draft → in-progress`
  전환을 지시했으나 `acceptance.md`에는 frontmatter 블록 자체가 없다(파일이 `# Acceptance Criteria:`로
  시작). `spec.md`/`plan.md` 2개만 전환했다. 없는 블록을 새로 만드는 것은 본문 변경이므로 수행하지 않았다.
- **G4 — 반증 절차를 거친 단언과 거치지 않은 단언**: AC-CATALOG-012 화이트리스트 가드는 서비스에
  `searchParams.get("q")`를 임시 삽입해 실제로 실패함을 확인한 뒤 되돌렸다(2건 실패 → 복원 후 8건 통과).
  나머지 테스트는 RED 단계를 통해 실패를 확인했다(E.2.6).
- **G5 — 마이그레이션 미적용**: `prisma/migrations/20260828015400_add_catalog_models/migration.sql`은
  `prisma migrate dev`가 아니라 수작업으로 작성했다(섀도 DB 부재). DDL 객체 집합이 스키마와 정확히
  일치함은 확인했으나(`migrate diff --from-empty` 결과와 set 비교 → 차이 0), **실제 DB에 적용해본 적은 없다**.
- **G6 — 시드 스크립트 미작성**: plan.md M1이 언급한 시드 스크립트는 작성하지 않았다. DB가 없어
  어떤 테스트로도 실행·검증할 수 없는 코드가 되고, 디스패치의 EXTEND 경로 목록에도 없다. AC-CATALOG-016의
  실제 측정과 함께 후속 작업으로 남긴다.
- **G7 — 단일 플랫폼**: 모든 검증은 darwin(macOS)에서만 수행했다. 리눅스/윈도우 미검증.
- **G8 — plan-audit 보고서 미확인**: 디스패치가 인용한
  `.moai/reports/plan-audit/SPEC-CATALOG-001-review-2.md`는 `WT-catalog-plan` 브랜치에 존재하지 않는다
  (`git ls-tree` 결과 해당 디렉터리에는 `.gitkeep`뿐). PASS 0.97 판정은 디스패치의 진술을 신뢰해
  진행했으며, 이 세션에서 직접 확인하지 못했다.

### E.2.6 TDD RED 증거 (밀스톤별)

| 밀스톤 | RED 확인 | 관측 출력 |
|---|---|---|
| M1 | `npx vitest run tests/unit/catalog/schema.test.ts` | `7 tests \| 6 failed` — `Error: model Product not found in prisma/schema.prisma` (PRESERVE 테스트 1건만 정상 통과) |
| M2 | 동 명령(repository) | `17 tests \| 17 failed` — `Cannot find module '@/features/catalog/repositories/product-repository'` |
| M3 | 동 명령(service) | `31 tests \| 31 failed` — `Cannot find module '@/features/catalog/services/product-service'` |
| M4 | 동 명령(routes) | `16 tests \| 16 failed` — `Cannot find module '@/app/api/products/route'` |
| M5 | 반증 절차로 대체 | 이미 작성된 코드에 대한 특성화 단언이라 RED가 자연 발생하지 않음 → `get("q")` 주입으로 `2 failed \| 6 passed` 확인 후 복원 |
| M6 | 반증 절차 미적용 | 측정 하니스이며 임계값 대비 여유가 3자릿수라 실패 유도 의미가 낮음 — 한계는 G2에 기록 |

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-08-28T11:05:00+09:00
run_commit_sha: 387c88d   # M6 = 최종 구현 커밋. 본 progress.md 커밋이 그 뒤에 이어짐(백필 필요)
run_branch: worktree-agent-a6bc936c2517a5326   # 주의: WT-catalog-plan 아님 — §E.2.0 참조
run_base_commit: 8336501
run_status: complete-with-gaps

ac_pass_count: 15
ac_partial_count: 1      # AC-CATALOG-016 (G2)
ac_fail_count: 0

preserve_list_post_run_count: 4   # schema.prisma 기존 3모델 / lib/auth / lib/db / api/auth (+ middleware.ts) 전부 무변경
preserve_violations: 0

l44_pre_commit_fetch: not-performed
l44_post_push_fetch: not-performed
l44_reason: >-
  칸반 카드 워크트리 브랜치로 원격 푸시가 금지되어(디스패치 B9) push를 수행하지 않았고,
  따라서 push 전후 fetch 단계도 실행하지 않았다. 원격과의 동기화 판정은 lead 세션 통합 시점 책임.

new_warnings_or_lints_introduced: 0
lint_baseline: "npx eslint . → exit 0 (run-phase 진입 전)"
lint_final: "npx eslint . → exit 0"
typecheck_final: "npx tsc --noEmit → exit 0"
prisma_validate_final: "npx prisma validate → exit 0"

test_files_before: 19
test_files_after: 25
tests_before: 140
tests_after: 222
test_regressions: 0
catalog_coverage: "100% stmts / 100% branch / 100% funcs / 100% lines (6개 파일 전부)"
overall_coverage: "96.65%"

cross_platform_build:
  darwin: verified      # 전체 검증이 macOS(Darwin 25.5.0)에서 수행됨
  linux: not-verified
  windows: not-verified
  note: 단일 플랫폼 검증 — G7 참조

total_run_phase_files: 16   # 신규 12 + 수정 4(schema.prisma, spec.md, plan.md, progress.md)
m1_to_mN_commit_strategy: >-
  밀스톤당 로컬 커밋 1개, Conventional Commits, 총 6개(M1 9ad8b93, M2 54f9e63, M3 0acb698,
  M4 aa2ad34, M5 26e3089, M6 387c88d). --no-verify / --amend / force-push 미사용, 원격 푸시 없음.
  status: draft → in-progress 전환은 M1 커밋에 포함.
```

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## §F Phase 4 Mode Selection

**Input parameters**: tier=M; scope≈7-8 core files (prisma/schema.prisma + 5 new files under src/features/catalog + 2 new route.ts files); domain count=1 (backend/DB, single feature slice); file language mix=100% TypeScript + 1 Prisma schema; concurrency benefit=LOW (coding-heavy, sequential milestone dependencies M1→M2→M3→M4).

**Mode evaluation**:
| Mode | Selected? | Rationale |
|---|---|---|
| direct | No | Non-trivial multi-file feature implementation |
| serial | **YES** | Coding-heavy work, single domain, <10 files — Anthropic's coding-task parallelism caveat applies |
| fanout | No | Below the ≥3 domains / ≥10 files threshold |
| sweep | No | Not mechanical/high-volume |

**Decision: serial**

**Justification**: Tier M SPEC with a single backend/database domain and strict milestone dependencies (schema → repository → service → route handlers) — a sequential `manager-develop` delegation per the standard Section A-E template is the correct envelope.

### Boundary case — worktree materialization mismatch

The spawned `manager-develop` invocation was auto-materialized into a **new** L1 worktree (`.claude/worktrees/agent-a6bc936c2517a5326`, branched from `origin/HEAD` per `worktree.baseRef: fresh`) rather than inheriting this session's already-entered `.claude/worktrees/catalog-plan` (branch `WT-catalog-plan`). This is the documented L1-ephemeral-vs-re-entry distinction (`worktree-integration.md` § L1 ephemeral vs L2 persistent — `isolation: worktree` is NOT a re-entry mechanism): `manager-develop`'s own agent definition carries `isolation: worktree` (write-heavy retained agent, per the HARD rule), so a plain `Agent()` spawn without an explicit re-entry mechanism gets a fresh tree regardless of the parent session's CWD.

**Resolution** (performed by the orchestrator after the agent self-detected and reported the mismatch): verified `8336501` (WT-catalog-plan HEAD at spawn time) is an ancestor of the agent's final HEAD `83041ef` (`git merge-base --is-ancestor`, exit 0), then fast-forwarded `WT-catalog-plan` onto it from within `.claude/worktrees/catalog-plan` (`git merge --ff-only worktree-agent-a6bc936c2517a5326`) — no merge commit, no history rewrite, no other worktree touched. All 7 run-phase commits now live on `WT-catalog-plan` as intended.

**Follow-up for future dispatches**: a run-phase delegation into an existing card worktree should either avoid `Agent()` auto-isolation for `manager-develop` (spawn without further isolation once the orchestrator's own session is already inside the target worktree — isolation is redundant there) or explicitly pass the target worktree path if the runtime supports it. Recorded here as a process note, not a code change.
