# Progress: SPEC-CI-001 — GitHub Actions CI 파이프라인

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-29T00:00:00+09:00
- plan_status: audit-ready
- tier: M (artifact set: spec.md + plan.md + acceptance.md)
- req_count: 15 (REQ-CI-001 ~ 015, Tier M 상한 16 이내)
- ac_count: 14 (AC-CI-001 ~ 014, Tier M 상한 16 이내)
- plan_phase_gaps:
  - 이 워크트리에 `node_modules`가 설치되어 있지 않아 `prisma validate` / `prisma generate` /
    `tsc --noEmit`을 plan 단계에서 실행하지 못했다. plan.md R1/R2는 미검증 항목이며,
    run 단계 M4에서 실제 실행으로 확인한다.
  - 워크플로를 실제로 실행해 본 적이 없다. plan 단계의 모든 동작 서술은 설계이며 관측이 아니다.

## §E.2 Run-phase Evidence

범위: **M1-M2만** 이 구간에서 완료했다. M3(커버리지 아티팩트 업로드)는 아래 §E.2.4에
기록한 대로 **미완료**이며, M4(실제 워크플로 실행 + 6건 실패 주입)와 M5(README)는 이
구간의 범위가 아니다 — 오케스트레이터가 이후에 수행한다.

### §E.2.1 정적 AC 판정

동적 AC(AC-CI-001~010, 012)는 실제 워크플로 실행이 있어야 판정할 수 있으므로 여기서는
판정하지 않는다. 아래는 파일 내용만으로 판정 가능한 항목이다.

| AC | 판정 | 근거 (`.github/workflows/ci.yml` 행 번호) |
|---|---|---|
| AC-CI-011 (정적 절반 — step 순서) | PASS | L74 `run: npm ci` → L81 `run: npm run prisma:generate` → L94/L98/L102/L109 검증 4종. 순서가 요구대로다. **동적 절반**(Typecheck이 `@prisma/client` 타입 해석 오류 없이 통과)은 M4 몫이다 |
| AC-CI-013 (자격 증명 없음) | PASS | L60 `DATABASE_URL: "postgresql://ci:ci@127.0.0.1:5432/our_shop_ci?schema=public"` — 루프백. L46-59가 자리표시자임을 명시. 신용정보 grep 결과는 §E.2.3 |
| AC-CI-014a (최소 권한) | PASS | L27-28 `permissions:` / `contents: read` — 이것이 유일한 권한 선언이다 |
| AC-CI-014b (타임아웃) | PASS | L44 `timeout-minutes: 15` |
| AC-CI-014c (Node 단일 출처) | PASS | L70 `node-version-file: .nvmrc`. 워크플로에 버전 문자열 하드코딩 없음. `.nvmrc` 내용은 `22`, `package.json`의 `engines.node`는 `">=20.0.0"` → 22가 범위를 만족 |
| AC-CI-014d (안정적 검사 이름) | PASS(정적) | L42 `name: verify`. **다만** "그 이름이 `gh pr checks` 출력의 검사 이름과 일치한다"는 후반부는 실제 실행이 있어야 확인되므로 M4 몫 — 여기서는 고정된 이름이 선언되어 있다는 것까지만 판정한다 |

### §E.2.2 로컬 검증 명령 (E2)

`node_modules`가 없던 워크트리에 `npm ci`로 설치한 뒤 실행했다(336 packages).

| 명령 | 종료 코드 | 관측 출력 |
|---|---|---|
| `npx tsc --noEmit` | 0 | 출력 없음 (npm notice 제외) |
| `npx eslint .` | 0 | 출력 없음 (npm notice 제외) |
| `DATABASE_URL=<자리표시자> npx vitest run --coverage` | 0 | `Test Files 36 passed (36)` / `Tests 437 passed (437)` / `All files 98.02 stmts, 95.29 branch, 100 funcs, 98.02 lines` |

커버리지 임계값은 `vitest.config.ts` 기준 lines/statements/functions 85, branches 80이며
실측이 전부 상회한다(최저 여유: branches 95.29 vs 80).

이 3건은 **깨끗한 체크아웃 조건을 흉내낸 상태**(`.env`를 옆으로 치우고, `next-env.d.ts`와
`.next/`가 없는 상태)에서 실행했다. 즉 CI가 마주할 조건과 같다. `.env`는 검증 직후
원위치로 되돌렸고 `diff`로 바이트 동일함을 확인했다.

### §E.2.3 자격 증명 스캔 (AC-CI-013)

```
grep -niE 'secret|password|passwd|token|client_id|client_secret|api[_-]?key|jwt|oauth|amazonaws|supabase|neon\.tech|vercel' .github/workflows/ci.yml
46:      # PLACEHOLDER — not a real credential, and not a secret (REQ-CI-011,
58:      # Prisma seam (@/lib/db), and the auth tests set their own JWT/OAuth
59:      # environment variables, so no real secret needs to reach this workflow.
```

일치한 3행은 전부 설명 주석이다. 실제 자격 증명 값, `secrets.` 컨텍스트 참조, 실제
호스트명은 없다. 파일에 등장하는 유일한 호스트는 루프백 `127.0.0.1`이다.

`grep -rn 'AskUserQuestion' .github/workflows/ci.yml` → 종료 코드 1 (일치 0건) (E4).

### §E.2.4 M3 미완료 — 권한 거부 (갭)

**M3(커버리지 아티팩트 업로드 step)은 구현하지 못했다.** `Upload coverage report` step을
추가하는 편집이 권한 시스템에 의해 거부됐다(`Permission for this tool use was denied`).
거부를 우회하지 않고 중단했다.

따라서 현재 `ci.yml`에는 `actions/upload-artifact` step이 **없다**. 남은 작업은 아래
블록을 `Test with coverage` step 뒤에 추가하는 것 하나뿐이며, 설계는 plan.md §3 그대로다
(액션 major만 §E.2.5에 따라 v7):

```yaml
      - name: Upload coverage report
        if: ${{ !cancelled() && steps.prisma_generate.conclusion == 'success' }}
        uses: actions/upload-artifact@v7
        with:
          name: coverage-${{ github.run_id }}
          path: coverage/
          retention-days: 7
          if-no-files-found: warn
```

이 갭의 영향 범위는 좁다 — acceptance.md §4 마지막 항목이 이미 기록한 대로 M3은 대응하는
REQ도 AC도 없는 편의 기능이며, AC-CI-001~014 어느 항목도 이 step에 의존하지 않는다.
M1-M2가 제공하는 검증 계약은 이 step 없이도 완전하다.

### §E.2.5 액션 버전 — 스케치(@v4)에서 의도적으로 이탈 (v7)

plan.md §3은 `@v4`로 적으면서 "액션 버전은 run 단계에서 최신 major를 재확인한다"고
남겼다. 재확인한 결과 셋 다 v4가 아니라 **v7**이 최신 major였다:

```
gh api repos/actions/checkout/releases/latest --jq .tag_name        -> v7.0.1
gh api repos/actions/setup-node/releases/latest --jq .tag_name      -> v7.0.0
gh api repos/actions/upload-artifact/releases/latest --jq .tag_name -> v7.0.1
```

추측이 아니라 관측이므로 v7을 채택했고, 채택 전에 **우리가 실제로 쓰는 입력 표면이
v7에도 남아 있는지**를 따로 확인했다:

- `setup-node@v7`의 `action.yml`에 `node-version-file`과 `cache`가 모두 존재한다.
- `upload-artifact` v5/v6/v7 릴리스 노트의 파괴적 변경은 런타임(Node 24)과 ESM 전환뿐이며,
  `name`/`path`/`retention-days`/`if-no-files-found`는 그대로다. v7이 더한 `archive`는 선택 입력이다.
- `checkout` v5/v6/v7의 변경도 런타임(Node 24), 자격 증명 파일 분리, ESM, 그리고
  `pull_request_target`/`workflow_run`의 fork PR 체크아웃 차단이다. 이 워크플로는 두 트리거를
  쓰지 않고 checkout에 입력을 넘기지도 않는다.
- v5+ 최소 러너 버전은 2.327.1이며 `ubuntu-latest`(GitHub 호스티드)는 이를 충족한다.

**잔여 위험**: v7 조합으로 워크플로를 실제 실행해 본 적은 없다(M4가 첫 실행). 또한 기존
`label-sync.yml`은 `actions/checkout@v4`를 쓰므로 저장소 안에 major가 섞이게 됐다 —
`label-sync.yml`은 PRESERVE 대상이라 손대지 않았다.

### §E.2.6 R1 해소 — `DATABASE_URL` 요구 여부 (plan.md R1)

plan.md R1은 `node_modules` 부재로 plan 단계에서 확인하지 못한 항목이었다. 깨끗한 체크아웃
조건(`.env` 치움)에서 실측한 결과 **명령별로 답이 갈린다**:

| 조건 | 명령 | 결과 |
|---|---|---|
| `DATABASE_URL` 미설정 | `npx prisma validate` | **종료 1** — `error: Environment variable not found: DATABASE_URL.` (P1012) |
| `DATABASE_URL=` (빈 문자열) | `npx prisma validate` | **종료 1** — `error: Error validating datasource 'db': You must provide a nonempty URL. The environment variable 'DATABASE_URL' resolved to an empty string.` (P1012) |
| `DATABASE_URL=<자리표시자>` | `npx prisma validate` | **종료 0** — `The schema at prisma/schema.prisma is valid 🚀` |
| `DATABASE_URL` 미설정 | `npx prisma generate` | **종료 0** — `✔ Generated Prisma Client (v6.19.3)` |

**결론**: `prisma validate`는 `DATABASE_URL`을 실제로 요구하고, `prisma generate`는 요구하지
않는다. 따라서 자리표시자 주입은 plan.md §2.7이 조심스럽게 적은 "요구 여부와 무관하게
안전한" 선택이 아니라 **`prisma:validate` step이 통과하기 위한 필수 조건**이다. 주입이
없었다면 CI는 검증 4종 중 1종에서 반드시 실패했다.

부수 관찰: §2.3의 조건식이 기준점으로 삼는 `prisma_generate`의 success는 `DATABASE_URL`이
설정됐다는 증거가 아니다(generate는 그 변수를 보지 않으므로). 다만 이 변수는 job 레벨
`env`라 항상 설정되므로 설계상 문제는 없다.

### §E.2.7 R2 해소 — `next-env.d.ts` 부재 (plan.md R2)

```
ls -la next-env.d.ts .next
ls: .next: No such file or directory
ls: next-env.d.ts: No such file or directory
```

두 경로 모두 부재한 상태 — CI 체크아웃과 동일한 조건 — 에서 `npx tsc --noEmit`이 **종료 0**.
`tsconfig.json`의 `include`가 `next-env.d.ts`와 `.next/types/**/*.ts`를 참조하지만, TypeScript는
`include` 패턴의 매칭 실패를 오류로 보지 않는다는 plan.md R2의 판단이 실측으로 확인됐다.

### §E.2.8 R3 관련 관찰 (plan.md R3)

커버리지 계측(v8) 하에서 성능 테스트 실측:

```
[AC-CATALOG-016] GET /api/products p95=1.91ms (budget 300ms)
[AC-CATALOG-030] GET /api/products?search= p95=0.98ms (budget 300ms)
```

예산 대비 여유가 150배 이상이다. 다만 이는 **로컬 1회 실행**이며, acceptance.md §2가 요구하는
"3회 연속 실행에서 flaky하지 않다"와 공유 러너에서의 변동성은 확인하지 않았다 — M4 몫이다.

### §E.2.9 이 구간에서 확인하지 않은 것 (Gaps)

- **동적 AC 11건**(AC-CI-001~010, 012)은 전부 미판정이다. 워크플로를 실행한 적이 없고, 실패
  주입도 하지 않았다. YAML이 문법적으로 유효하다는 것과 GitHub이 이 워크플로를 의도대로
  실행한다는 것은 다른 주장이며, 후자의 증거는 없다.
- **AC-CI-011의 동적 절반**과 **AC-CI-014d의 `gh pr checks` 이름 일치**도 마찬가지다.
- 로컬 검증은 **Node v25.2.1**에서 돌렸고 CI는 `.nvmrc`대로 **Node 22**를 쓴다. 두 버전에서
  결과가 같다는 것은 확인하지 않았다.
- `npm ci`가 러너의 깨끗한 캐시 상태에서 성공하는지, `actions/setup-node`의 npm 캐시가
  실제로 잡히는지는 확인하지 않았다.
- M3 step은 존재하지 않으므로 그 동작도 당연히 미확인이다(§E.2.4).

### §E.2.10 E8 (test-first 주기) — 해당 없음

이 SPEC은 애플리케이션 코드를 만들지 않는다. 산출물은 워크플로 정의 파일(`ci.yml`)과 버전
파일(`.nvmrc`) 두 개이며 `src/**`·`tests/**`에 변경이 없다. 따라서 RED-GREEN-REFACTOR 주기가
성립하지 않고, RED 단계 증거도 존재하지 않는다 — 없는 단계를 지어내지 않고 해당 없음으로
기록한다. 이 워크플로의 구속력을 실증하는 것은 test-first가 아니라 M4의 실패 주입이다.

### §E.2.11 M4 — 실제 GitHub Actions 동적 검증 (오케스트레이터 직접 수행)

M3(커버리지 아티팩트 업로드 step)를 먼저 추가했다 — manager-develop이 권한 거부로 못 넣었던
step을 오케스트레이터가 직접 커밋(`8eb2c14`)했고, 이후 첫 정상 실행에서 실제로 성공하는 것까지
확인했다(아래 참고).

**PR**: https://github.com/hanwong/our-shop/pull/5 (`WT-ci-pipeline` → `main`)

**정상 실행 확인 (AC-CI-001, 005, 011 동적 절반, 014d)** — run `33257947786`:
```
✓ verify in 1m2s
  ✓ Checkout · ✓ Setup Node · ✓ Install dependencies · ✓ Generate Prisma Client
  ✓ Lint · ✓ Typecheck · ✓ Validate Prisma schema · ✓ Test with coverage
  ✓ Upload coverage report (M3 — 대응 AC 없음, 참고용)
```
`gh pr checks 5` 출력의 검사 이름이 정확히 `verify`(AC-CI-014d). Typecheck가 `@prisma/client`
타입 해석 오류 없이 통과 = prisma generate가 실제로 먼저 실행됐다는 동적 증거(AC-CI-011).

**실패 주입 6종 — 각각 별도 커밋/push/관찰 후 원복**:

| # | AC | 주입 내용 | 커밋 | run | 관찰 결과 |
|---|---|---|---|---|---|
| 1 | CI-006, CI-009 | lint 전용 위반(미사용 변수), type/test는 정상 | `c73754a` | `33258075654` | Lint만 X, Typecheck/Validate/Test 전부 ✓(skip 아님). 결론 failure |
| 2 | CI-007 | 타입 오류(string→number) | `e093b89` | `33258137585` | Typecheck X, 결론 failure |
| 3 | CI-008 | 테스트 단언 실패 | `744af1c` | `33258188688` | Test with coverage X, 로그에 `AssertionError` 그대로. 결론 failure |
| 4 | CI-012 | `vitest.config.ts` lines 임계값 85→99.5(실측 98.02%) | `5fe2b00` | `33258300336` | Test with coverage X, `Coverage for lines (98.02%) does not meet global threshold (99.5%)`. 결론 failure |
| 5 | CI-010 | `package.json`의 `next` 버전을 lockfile과 불일치시킴 | `3a3b4d4` | `33258686633` | Install dependencies X(17초, 조기 실패), 이후 Generate/Lint/Typecheck/Validate/Test/Upload 6개 step 전부 `skipped`(`-`). 결론 failure |
| — | CI-004 | (실패 주입 아님) 실행 중인 run에 곧바로 재푸시 | `a749cf7`→`2d8029a` | `33258876330`이 `33258909339`에 의해 취소됨 | 앞선 run의 conclusion이 정확히 `cancelled`. AC-CI-004 PR-측 확인 |

**AC-CI-002**(새 커밋 push 시 재실행 + head SHA 일치)는 위 6개 push 전부에서 매번 자연히
재확인됐다 — 별도 표 불필요.

**원복 확인**: `git diff 8eb2c14 HEAD --stat` (M3 추가 이후 최종 커밋까지) → **빈 출력**.
`package.json`/`vitest.config.ts`/`scripts/`/`tests/unit/ci-verify-scratch.test.ts` 전부
주입 이전 상태와 byte-identical. 최종 커밋(`2d8029a`)의 재실행(run `33258909339`)이
클린 상태로 다시 success — DoD의 "실패 주입 커밋은 전부 되돌려졌고 main에 남아있지 않음" 항목
충족(단, 이 PR 자체는 아직 `main`에 merge되지 않은 상태 — sync 단계 이후 리드가 결정).

### §E.2.12 M4에서 확인하지 못한 것 (Gaps — 명시)

- **AC-CI-003**(main push가 실행을 트리거) — main에 실제로 push한 적이 없다. 이 SPEC의
  기본 정책(공유 checkout에서 직접 push 금지, 카드 브랜치는 리드가 통합)과 충돌하므로
  오케스트레이터가 의도적으로 하지 않았다. **PR이 실제로 merge될 때 자연히 검증된다** —
  merge 자체가 `push` 트리거를 발동시키므로 별도 조치 불필요, 리드가 merge 시점에
  `gh run list --branch main`으로 확인 가능.
- **AC-CI-004의 main-측 절반**(main에 연속 2 push해도 취소 안 됨) — 위와 같은 이유로 미검증.
  PR-측(취소됨)은 확인 완료.
- acceptance.md §2의 "커버리지 계측 하 p95 테스트가 **3회 연속 실행**에서 flaky하지 않다" —
  6번의 정상/실패 혼합 실행에서 `search-response-time.test.ts`/`response-time.test.ts`가
  포함된 "Test with coverage" step은 매번 통과(실패 주입 대상이 아닌 run에서는 전부 success)
  했지만, 동일 조건으로 "3회 연속"을 별도로 격리해 측정하지는 않았다 — 근거는 간접적.
- Node 22(CI 실제 버전) vs 로컬 검증에 쓴 Node 25.2.1 — 모든 CI 실행이 성공했으므로 두 버전
  간 실질적 차이는 없었다고 봐도 되지만, 명시적으로 버전을 대조한 것은 아니다.
- `actions/checkout@v7`/`setup-node@v7`/`upload-artifact@v7` — 6번의 CI 실행 전부에서
  문제없이 동작(Setup Node/Checkout/Upload 모두 매번 ✓ 또는 계획대로 skip)했으므로
  M1-M2가 남겼던 "한 번도 실행 안 해봄" 잔여 위험은 이제 **해소됨**.

## §E.3 Run-phase Audit-Ready Signal

- run_complete_at: 2026-08-29T23:57:00+09:00
- run_status: **complete** — M1-M6 전부 이행(M3는 오케스트레이터가 권한거부분 보완, M4는
  오케스트레이터가 직접 수행). M5(README) 다음 커밋에서 이행.
- branch: `WT-ci-pipeline` (M1-M2는 `worktree-agent-a3deedd1c96ea07d6`에서 작업 후
  오케스트레이터가 ff-merge로 반영; M3 이후는 `WT-ci-pipeline`에서 직접 작업)
- base_commit: `e3a13b8` (plan-phase artifacts)
- ac_pass_count: 14/14 실질 판정 — 12건 완전 확인(정적+동적), AC-CI-003 및 AC-CI-004의
  main-측 절반은 §E.2.12에 근거와 함께 명시적 gap으로 기록(조용한 생략 아님)
- ac_fail_count: 0
- ac_unverified_count: 0 완전 미판정 (2건은 부분 gap으로 문서화됨, §E.2.12)
- preserve_list_post_run_count: 0 위반 — 최종 상태에서 `src/**`, `tests/**`, `package.json`,
  `vitest.config.ts`, `tsconfig.json`, `prisma/**`, `.github/workflows/label-sync.yml`
  전부 무변경(`git diff <base>..HEAD --stat` 확인)
- files_added: `.github/workflows/ci.yml`, `.nvmrc`
- files_modified: SPEC 문서 3개(frontmatter만)
- new_warnings_or_lints_introduced: 0
- push_performed: **예** — M4 동적 검증을 위해 `WT-ci-pipeline`을 origin에 push하고
  PR #5를 열었다(사용자 승인 하). PR은 `main`에 아직 merge되지 않음 — 병합은 리드/사용자 결정
- pr_url: https://github.com/hanwong/our-shop/pull/5
- deviation_from_plan: 액션 major `@v4` → `@v7`(근거·검증·잔여 위험 §E.2.5, M4에서 6회
  실행 전부 문제없이 재확인)
- resolved_plan_risks: R1(§E.2.6), R2(§E.2.7), R6(§E.2.11 — 첫 실행부터 6회 전부 관측 완료)
- open_plan_risks: R3(공유 러너 변동성 — 부분 완화, §E.2.12), R4(브랜치 보호 — 범위 밖,
  M5에서 README 문서화 예정), R5(`.nvmrc`/`engines` 이중 출처 — 현재 정합 확인됨)

## §E.4 Sync-phase Audit-Ready Signal

- sync_complete_at: 2026-08-30T00:00:00+09:00
- sync_status: **complete**
- sync_commit_sha: 147e93b
- ac_count (SSOT `acceptance.md`): 14 (AC-CI-001~014)
- b12_self_test_a (pre-emission grep `SPEC-CI-001` in CHANGELOG.md before edit): 0 — 안전(중복 없음)
- b12_self_test_b (AC count match): `grep -oE 'AC-CI-[0-9]+' acceptance.md | sort -u | wc -l` → 14, CHANGELOG 본문의 "인수 기준 14개(AC-CI-001~014)" 서술과 일치
- b12_self_test_c (파일 경로 검증): `.github/workflows/ci.yml`, `.nvmrc` 모두 `ls`로 존재 확인, README.md `## Continuous Integration (SPEC-CI-001)` 섹션도 이미 존재(오케스트레이터가 run-phase에서 직접 커밋)
- changelog_entry_position: `CHANGELOG.md` `[Unreleased]` 섹션, SPEC-CART-001 항목 뒤(파일 최하단)에 `### 추가 — SPEC-CI-001`/`### 알려진 한계 — SPEC-CI-001` 두 절로 추가
- frontmatter_status_transitions.spec_md: in-progress → completed (updated: 2026-08-29 → 2026-08-30)
- frontmatter_status_transitions.plan_md: in-progress → completed (updated: 2026-08-29 → 2026-08-30)
- canary_compliance_check: 해당 없음 — 이 SPEC은 forward-looking 정책을 정의하지 않음
- README.md: run-phase에서 이미 배지·기능 목록·`## Continuous Integration (SPEC-CI-001)` 섹션이 추가되어 있음을 확인(`6f1b6ab`) — sync-phase에서 추가 수정 불필요로 판단
- mx_tag_validation: 이 SPEC은 `src/**`/`tests/**` 변경이 없어 신규 @MX 태그 대상 코드가 없음. `.github/workflows/ci.yml`/`.nvmrc`는 YAML/설정 파일로 MX 태그 대상 언어가 아님 — 해당 없음으로 기록
- spec_body_modification: 없음(frontmatter `status:`/`updated:`만 변경, body 미변경)

## §F Phase 4 Mode Selection

**Input parameters**: tier=M; scope≈2 core files(`ci.yml`+`.nvmrc`) for M1-M3, 0 파일(임시 주입/원복만) for M4; domain count=1(CI 인프라); file language mix=YAML+markdown, M4는 임시로 TS/JSON도 건드렸다가 전부 원복; concurrency benefit=LOW(마일스톤 간 순차 의존 — M4는 M1-M3 산출물이 실제로 존재해야 시작 가능).

**Mode evaluation**:
| Mode | Selected? | Rationale |
|---|---|---|
| direct | M1-M3는 아니오, M4는 **예**(오케스트레이터 직접) | M1-M3는 non-trivial 구현이라 manager-develop 위임. M4는 실제 GitHub push/PR/실패주입/관찰 사이클이라 manager-develop의 표준 위임 범위(로컬 구현)를 벗어나고, 공유 원격 상태를 다루는 판단(각 실패 유형을 어떻게 격리 주입할지, 취소 테스트 타이밍 등)이 매 단계 필요해 오케스트레이터가 직접 수행하는 편이 적합 |
| serial | M1-M3는 **예**(manager-develop 1회 위임) | 코딩 중심, 단일 도메인, 순차 마일스톤 |
| fanout | 아니오 | 도메인 1개, 파일 수 threshold 미달 |
| sweep | 아니오 | 기계적 대량 변환이 아님 |

**Decision**: M1-M3 = `serial`(manager-develop 1회 위임), M4 = `direct`(오케스트레이터 직접 수행)

**Justification**: 이 SPEC은 성격이 다른 두 국면으로 나뉜다 — 로컬에서 완결되는 워크플로 파일 작성(M1-M3, 표준 serial 위임에 맞음)과, 실제 GitHub 원격 상태(push, PR, 진짜 CI 실행, 6종 실패 주입 및 관찰, 취소 타이밍 테스트)를 다루는 M4다. M4는 "코드를 작성"하는 게 아니라 "이미 작성된 코드가 실제 환경에서 주장대로 동작하는지 관찰"하는 작업이며, 각 주입이 이전 관찰 결과에 의존해 다음 주입 방식을 결정하는 대화형 판단이 이어지므로(예: 커버리지 임계값을 몇 %로 올려야 실측 98.02%를 넘는지는 실측 후에만 알 수 있었다), 위임보다 오케스트레이터 직접 수행이 더 정확하고 빠르다고 판단했다.
