# Progress: SPEC-STOREFRONT-001 — 상품 상세 페이지 UI 및 이미지 갤러리

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-30
- plan_status: audit-ready
- tier: M (spec.md + plan.md + acceptance.md)
- route: `plan → design → run` (Conditional Design Route 적용 — 근거는 plan.md §I)
- open_clarifications: 0 (2026-08-30 사용자 결정으로 2건 모두 해소 — 아래 참고)
- resolved_clarifications:
  - plan.md §C 스타일링 방식 → **Tailwind CSS v4** 확정 (`tailwindcss` + `@tailwindcss/postcss` + `postcss`, `postcss.config.mjs` 1개, `globals.css`에 `@import "tailwindcss";`, `tailwind.config.js` 미생성). CSS Modules 대안은 계획에서 제거됨
  - plan.md §D 이미지 호스트 허용 목록 → **`next/image` + `images.remotePatterns` = `picsum.photos`** 확정. 실제 상품 이미지 호스팅 미정 상태의 **임시 플레이스홀더 허용 목록**이며, 호스팅 확정 시 교체·확장하는 후속 설정 변경으로 처리(별도 SPEC 불필요 — plan.md §D-2)

## §E.2 Run-phase Evidence

### 마일스톤 순서

plan.md §J가 "M1과 M2는 서로 독립적이라 순서를 바꿔도 된다"고 명시했고, TDD는 실패하는 `.tsx`
테스트를 쓰기 전에 하네스가 존재할 것을 요구하므로 **M2 → M1 → M3 → M4 → M5** 순으로 진행했다.

| 마일스톤 | 커밋 | 내용 |
|---|---|---|
| M2 | `65de822` | vitest 하네스 확장 (jsdom, Testing Library, `.tsx` 수집, 커버리지) |
| M1 | `1b9e27d` | 루트 문서 셸 + Tailwind v4 + `next.config.ts` |
| M3 | `986eb44` | 상세 라우트, `ProductDetailView`, `not-found.tsx` |
| M4 | `09afbe5` | `ProductGallery` 및 뷰 연결 |
| M5 | (이 커밋) | 커버리지 확인, 관측 결과 기록 |

### AC 판정 결과

| AC | 판정 | 근거 |
|---|---|---|
| AC-001 (a)(b) | PASS | `RootLayout` 반환 트리 `html` prop `lang === "ko"`, `body` 존재. `layout.tsx`가 `globals.css` import, `globals.css` 첫 줄 `@import "tailwindcss";`. 홈 링크 `className`에 유틸리티 토큰 존재 |
| AC-001 (c) | **BLOCKED** | `npm run build` 실패. 원인은 이 SPEC 밖의 기존 결함 — 아래 "빌드 게이트" 참고 |
| AC-002 | PASS | `metadata.title` / `metadata.description` 모두 비어 있지 않음 |
| AC-003 | PASS | 서비스 성공 모킹 시 `screen.getByText("Classic Denim Jacket")` 매치. `fetch(` / `useEffect` 정적 검사 매치 0건 |
| AC-004 | PASS | 404 모킹 시 `notFound` 스파이 호출됨. `not-found.tsx`에 안내 문구 존재, `Product not found` 원문·스택·DB 정보 미노출 |
| AC-005 | PASS | 성공 경로에서 `notFound` 미호출 + 상품명 렌더. `redirect(` / 세션 조회 매치 0건. `src/middleware.ts` 매처에 `/products` 없음(파일 변경 0건) |
| AC-006 | PASS | 이름·가격·설명 전문·카테고리명·재고 상태 모두 렌더 |
| AC-007 | PASS | `89,000원` 표시. `price: 0` → `0원` |
| AC-008 | PASS | `stock: 0` → "품절" 포함, `stock: 10` → 미포함 |
| AC-009 | PASS | `category.id`, `createdAt`, `updatedAt` 원문 및 리뷰·관련 상품·재고 변동 영역 미노출 |
| AC-010 | PASS | 이미지 3장 최초 렌더 시 대표 이미지 `src`가 `IMG_A` |
| AC-011 | PASS | 3장 → 버튼 정확히 3개, 1장 → 버튼 0개 |
| AC-012 | PASS | 3번째 썸네일 클릭 후 대표 이미지 `IMG_C`, 해당 썸네일만 `aria-current="true"` |
| AC-013 | PASS | `images: []` 렌더 시 예외 없음, "이미지 준비 중" 대체 표시, 썸네일 0개 |
| AC-014 | PASS | zoom / lightbox / swipe / autoplay 패턴 매치 0건. 캐러셀·라이트박스 런타임 의존성 추가 0건 |
| AC-015 (a)(b) | PASS | 썸네일이 `button` 역할로 조회되고 `focus()` 후 `document.activeElement` 일치, 활성화 시 대표 이미지 교체. 모든 이미지 `alt`에 상품명 포함 |
| AC-015 (c) | **미확인 (수동 항목)** | acceptance.md §5가 자동 DoD에서 제외한 수동 시각 확인 항목. 이 run-phase에서 확인하지 않았다 — 아래 참고 |

### 품질 게이트 실측

| 게이트 | 명령 | 관측 결과 |
|---|---|---|
| 테스트 | `npm run test` | `Test Files 40 passed (40)` / `Tests 459 passed (459)` |
| 회귀 | 동일 | 착수 시점 기준선 36 파일 / 437 테스트 → 40 / 459. 기존 테스트 실패 0건 |
| 커버리지 | `npm run test:coverage` | `All files 98.2 stmts / 95.5 branch / 100 funcs / 98.2 lines`. 임계값 85/85/80/85 충족. 신규 `.tsx` 6개 전부 100% |
| 린트 | `npm run lint` | 출력 없음 (오류 0) |
| 타입 검사 | `npm run typecheck` | 오류 13건 — **전부 이 SPEC 이전부터 존재**. 아래 참고 |
| 빌드 | `npm run build` | **실패** — 아래 참고 |

### 자동 게이트를 통과하지 못한 항목 (이 SPEC의 결함이 아님)

**빌드 게이트 (AC-001c)** — `npm run build`가 다음으로 실패한다.

```
Module build failed: UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
Import trace for requested module:
node:crypto
./src/lib/auth/jwt.ts
```

경로는 `src/middleware.ts` → `@/lib/auth/jwt` → `node:crypto`이며, Edge 런타임은
`node:crypto`를 번들할 수 없다. **이 SPEC의 산출물을 전부 제거한 상태에서 빌드해도 동일하게
실패함을 확인했다** — 즉 기존 결함이며, 이 SPEC이 프로젝트에 처음으로 빌드를 도입하면서
드러났을 뿐이다. `src/lib/auth/**`와 `src/middleware.ts`는 acceptance.md §4의 "변경 0건"
불변 조건 대상이므로 이 SPEC에서 고치지 않았다.

**타입 검사** — 오류 13건은 모두 기존 테스트 파일 6개(`tests/unit/auth/cookies.test.ts`,
`tests/unit/db/db-singleton.test.ts`, `tests/unit/cart/guest-identity.test.ts`,
`tests/unit/api/cart/route.test.ts`, `tests/unit/api/auth/cart-merge.test.ts`,
`tests/integration/cart/guest-merge.test.ts`)의 `NODE_ENV` 읽기 전용 할당(TS2540)이다.
이 SPEC의 산출물을 전부 제거하고 실행해도 13건으로 동일했고, `@types/node`는 착수 전후
모두 22.20.1로 변하지 않았다. 이 SPEC이 기여한 타입 오류는 0건이다.

### 수동 시각 확인 (자동 DoD 대상 아님)

- AC-015(c) — 375px 뷰포트 가로 스크롤 없음: **미확인.** 이 run-phase는 브라우저를 띄우지
  않았으므로 관측 결과가 없다. acceptance.md §5는 이 항목을 자동 DoD의 통과 조건에서
  제외하고 있으며, "자동으로 통과했다"고 적지 않는 것이 그 절의 취지다.
- 썸네일 포커스 링 실제 렌더: **미확인.** 같은 이유.

### §4 불변 조건 확인

`git diff --stat 4b32dd2..HEAD -- src/features/catalog src/app/api prisma src/lib/auth src/features/cart src/middleware.ts`
→ 출력 없음 (변경 0건).

`grep -rn 'AskUserQuestion' src/` → 매치 0건.

`vitest.config.ts`의 `test.environment`는 `"node"` 유지. jsdom은 컴포넌트 테스트 파일
상단의 `// @vitest-environment jsdom` 지시자로만 적용된다.

### acceptance.md §4 / §5 충돌과 그 처리

`product-service.ts`의 `@MX:ANCHOR` fan-in 주석에 대해 acceptance.md §5 DoD와
plan.md §B/M5는 갱신을 요구하는 반면, acceptance.md §4는 같은 파일이 속한
`src/features/catalog/**`에 "변경 0건"을 요구해 두 조건이 동시에 성립하지 않았다.

**orchestrator 판정(2026-08-30): 주석을 갱신한다.** §4의 취지는 동작 보존이지 주석
동결이 아니며, mx-tag-protocol에 따라 MX 주석은 에이전트가 자율적으로 갱신하는 대상이다.

갱신 결과는 **주석 전용 변경**이며(M5 다음의 `docs(SPEC-STOREFRONT-001)` 커밋),
다음으로 확인했다.

- 주석이 아닌 변경 줄 수: 0
- 주석 블록을 제거한 두 버전의 코드 비교: 완전히 동일
- 갱신 후 `npm run test` 40 파일 / 459 테스트 통과, `npm run lint` 오류 0,
  `npm run typecheck` 오류 13건(기존과 동일, 증감 없음)

따라서 `src/features/catalog/**`의 변경은 1개 파일 / 주석 5줄이며, 동작·로직 변경은 없다.
그 외 PRESERVE 경로(`src/app/api`, `prisma`, `src/lib/auth`, `src/features/cart`,
`src/middleware.ts`)는 변경 0건을 유지한다.

### 후속 카드로 분리된 항목

- `npm run build` 실패(`node:crypto` / Edge 런타임, `src/middleware.ts` → `jwt.ts`)는
  orchestrator 판정(2026-08-30)에 따라 **별도 백로그 카드**로 분리됐다. 이 SPEC에서
  `middleware.ts` / `jwt.ts`는 손대지 않는다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-08-30
run_commit_sha: pending-backfill-m5
run_status: partial
ac_pass_count: 15
ac_fail_count: 0
ac_blocked_count: 1          # AC-001(c) 빌드 게이트 — 기존 결함이 원인
ac_manual_pending_count: 1   # AC-015(c) — acceptance.md §5의 수동 확인 항목
preserve_list_post_run_count: 1   # product-service.ts, 주석 전용 (orchestrator 승인)
new_warnings_or_lints_introduced: 0
new_type_errors_introduced: 0
pre_existing_type_errors: 13
test_files: 40
tests_passed: 459
regression_count: 0
coverage_lines: 98.2
coverage_branches: 95.5
coverage_functions: 100
coverage_statements: 98.2
total_run_phase_files: 16
m1_to_mN_commit_strategy: "마일스톤별 개별 커밋 (M2 → M1 → M3 → M4 → M5), 푸시하지 않음"
```

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-08-30
sync_commit_sha: pending-backfill-sync
sync_status: complete-with-known-gaps
b12_self_test_a: "grep -c 'SPEC-STOREFRONT-001' CHANGELOG.md → 0 (pre-emission); 1 (post-emission, no duplicate)"
b12_self_test_b: "grep -oE 'AC-STOREFRONT-[0-9]+' acceptance.md | sort -u | wc -l → 15; CHANGELOG entry states 15 (14 PASS + 1 unverified manual). Non-zero, matches acceptance.md §1 header (현재 15개)"
b12_self_test_c: "모든 파일 경로 실재 확인 — layout.tsx / globals.css / page.tsx / products/[productId]/{page,not-found}.tsx / components/product/{ProductDetailView,ProductGallery}.tsx / next.config.ts / postcss.config.mjs / vitest.config.ts / tests/unit/{app,components}/*.test.tsx 전부 존재"
changelog_entry_position: "CHANGELOG.md [Unreleased] 섹션 말미, SPEC-CI-001 항목 다음 (### 추가 — SPEC-STOREFRONT-001 + ### 알려진 한계 — SPEC-STOREFRONT-001)"
frontmatter_status_transitions:
  spec_md: "in-progress → completed (updated: 2026-08-30)"
  plan_md: "N/A — 이 파일에는 YAML frontmatter 블록이 없다(본문 `# Implementation Plan:` 헤딩으로 시작). 없는 블록을 새로 만들지 않았다"
  acceptance_md: "N/A — 이 파일에도 YAML frontmatter 블록이 없다(본문 `# Acceptance Criteria:` 헤딩으로 시작)"
  body_content_touched: false
docs_synchronized:
  - "CHANGELOG.md — [Unreleased]에 추가 항목 + 알려진 한계 항목"
  - "README.md — 구현 목록에 SPEC-STOREFRONT-001 한 줄, `## 스토어프론트 화면` 섹션 신설, 프로젝트 문서 목록에 SPEC 디렉터리 추가"
known_gaps:
  - id: AC-STOREFRONT-001c
    status: BLOCKED
    detail: "`npm run build` 실패. 원인은 이 SPEC 밖의 기존 결함(`src/middleware.ts` → `@/lib/auth/jwt` → `node:crypto`, Edge 런타임 번들 불가). 이 SPEC 산출물을 전부 제거해도 동일하게 실패함을 run-phase에서 확인. `src/lib/auth/**`·`src/middleware.ts`는 acceptance.md §4의 변경 0건 불변 조건 대상이라 손대지 않았다"
    tracking: "칸반 백로그의 별도 카드로 분리(카드 id 미발급). 이 SPEC의 결함이 아니며 이 SPEC의 sync를 막지 않는다"
  - id: AC-STOREFRONT-015c
    status: UNVERIFIED-MANUAL
    detail: "폭 375px 뷰포트 가로 스크롤 없음 — 관측 결과 없음. acceptance.md §5가 자동 DoD의 PASS 조건에서 명시적으로 제외한 수동 시각 확인 항목이며, jsdom에 레이아웃 엔진이 없고 브라우저 E2E 하네스는 spec.md §3에서 제외했다. **통과했다는 뜻이 아니라 아직 아무도 확인하지 않았다는 뜻이다**"
    tracking: "수동 확인 시 확인자·확인 일자·관측 결과를 §E.2 수동 시각 확인 절에 기록"
mx_tag_validation:
  scope: "sync 하위 단계로 수행(별도 Mx phase 아님)"
  result: "신규 산출물의 @MX 주석 확인 — ProductDetailView.tsx / ProductGallery.tsx에 @MX:NOTE 각 1건(명시적 필드 나열의 이유, 네이티브 button 선택의 이유). product-service.ts의 @MX:ANCHOR fan-in은 run-phase M5 이후 커밋에서 이미 갱신됨. 누락 태그 추가 0건"
sync_phase_files_changed: 4
sync_phase_src_or_tests_touched: false
```

### 이 sync 커밋이 하지 않은 것

- `src/**` / `tests/**` 무변경 — sync는 문서·CHANGELOG·SPEC frontmatter·progress.md만 다룬다.
- `spec.md` / `plan.md` / `acceptance.md`의 **본문**은 한 글자도 바꾸지 않았다. `spec.md`는 frontmatter의 `status:`와 `updated:` 두 필드만 갱신했다.
- `src/middleware.ts` / `src/lib/auth/jwt.ts`의 빌드 결함은 고치지 않았다(위 known_gaps 참고).
