# Progress: SPEC-CATALOG-002 — 상품 목록 API 키워드 검색 (이름 기반 부분 일치)

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-28T00:00:00+09:00
- plan_status: audit-ready

## §E.2 Run-phase Evidence

### AC 매트릭스 (AC-CATALOG-017 ~ 030, 14개)

| AC | 내용 | 검증 방법 | Actual Output | Status |
|---|---|---|---|---|
| AC-CATALOG-017 | 부분 문자열, 대소문자 무관 일치 | `vitest run tests/integration/catalog/search.test.ts` — `search=denim/DENIM/Denim/DeNiM` 4종 + 중간 부분 일치 + 완전 일치 | 6 tests passed | PASS |
| AC-CATALOG-018 | description은 검색 대상 아님 | 동 파일 — description에만 있는 `limited-edition-tag-xyz` 검색 | `items: []`, `totalCount: 0`; 같은 상품을 name(`Linen`)으로는 검색 성공 (2 tests passed) | PASS |
| AC-CATALOG-019 | 빈 문자열 → 파라미터 부재 | `product-service.test.ts` + `search.test.ts` — `?search=` | 200, `search: undefined`, 필터 미적용, 400 아님 | PASS |
| AC-CATALOG-020 | 공백만 → 파라미터 부재 | 동 — `%20`, `%20%20%20`, `%09` | 200, 전부 `search: undefined`, 결과가 무파라미터 요청과 동일 | PASS |
| AC-CATALOG-021 | search + category AND 결합 | `search.test.ts` + `product-repository.test.ts` | `?search=denim&category=tops` → `Denim Shirt` 포함, `Denim Jeans`(bottoms) 제외; where = `{categoryId, name:{contains,mode}}` | PASS |
| AC-CATALOG-022 | search + sort=price_asc | `search.test.ts` | `["Denim Shirt","denim overshirt","Denim Jeans","Classic Denim Jacket"]` (49000<59000<69000<89000) | PASS |
| AC-CATALOG-023 | search + sort 생략 → newest | 동 | `["Classic Denim Jacket","Denim Shirt","Denim Jeans","denim overshirt"]` (08-24>08-23>08-22>08-20) | PASS |
| AC-CATALOG-024 | search + 페이지네이션 메타데이터 | 동 | 5개 카탈로그 중 4개 매치 → `totalCount: 4`(5 아님), `totalPages: 2`; page 1/2 합집합 4개, 중복·누락 0 | PASS |
| AC-CATALOG-025 | 매치 없음 → 빈 결과 | 동 | `?search=zzz-no-match-zzz` → 200, `{items:[],totalCount:0,totalPages:0}` | PASS |
| AC-CATALOG-026 | 관련도 정렬 옵션 부재 (정적) | `query-surface.test.ts` | `PRODUCT_SORTS` = `["newest","price_asc","price_desc"]` 정확히 3개; `relevance`/`rank`/`score`/`best_match` 전부 미포함 | PASS |
| AC-CATALOG-027 | 전문 검색 미사용 (정적) | `query-surface.test.ts` + `grep -rn '\$queryRaw\|\$executeRaw\|tsvector\|to_tsquery\|plainto_tsquery' src/features/catalog` | grep exit 1 (매치 0건); 소스에 `contains:` + `mode: "insensitive"` 존재 확인 | PASS |
| AC-CATALOG-028 | 상세 API는 검색과 무관 | `search.test.ts` | `?search=anything` 유무의 응답 body가 `toEqual`로 동일; 조회 키는 라우트 세그먼트(`{id:"p-shirt"}`) 유지 | PASS |
| AC-CATALOG-029 | 기존 요청 회귀 없음 | 전체 스위트 + `search.test.ts` 회귀 블록 | SPEC-CATALOG-001 기준 222 tests → 304 tests, 실패 0. search 부재 시 where가 `{}` / `{categoryId}`로 이전과 동일 | PASS |
| AC-CATALOG-030 | 검색 포함 요청 p95 ≤ 300ms | `search-response-time.test.ts` (N=50, 최근접 순위) | `search` p95 = **0.50ms**; `search+category+sort` p95 = **0.35ms**; 예산 300ms — **단, DB 시간 제외** | **PARTIAL** (G1) |

### 불변 조건 (PRESERVE)

| 항목 | 검증 | Actual Output | Status |
|---|---|---|---|
| SPEC-AUTH-001 코드 미변경 | `git diff --stat` 범위 확인 | `src/lib/auth/**`, `src/app/api/auth/**`, `src/middleware.ts` 변경 0건 | PASS |
| 기존 3개 인덱스 유지 | `schema.test.ts` + `search-schema.test.ts` | `@@index([categoryId])`, `@@index([createdAt])`, `@@index([price])` 전부 존재 | PASS |
| `route.ts` 무변경 (plan.md §3) | 직접 확인 후 코드 검사 | 핸들러가 `searchParams`를 통째로 `listProducts()`에 전달 → 변경 불필요. **주장 검증 완료, 참임** | PASS |
| 서브에이전트 사용자 질의 없음 | `grep -rn 'AskUserQuestion' src/features/catalog src/app/api/products` | exit 1 (매치 0건) | PASS |

### 품질 게이트

| 게이트 | 명령 | Actual Output |
|---|---|---|
| 타입 검사 | `npx tsc --noEmit` | exit 0, 출력 없음 |
| 린트 | `npx eslint .` | exit 0, 출력 없음 |
| 스키마 유효성 | `npx prisma validate` | `The schema at prisma/schema.prisma is valid 🚀` |
| 전체 테스트 | `npx vitest run` | `Test Files 28 passed (28)` / `Tests 304 passed (304)` |
| 커버리지 | `npx vitest run --coverage` | 변경 4개 파일 전부 **100%** (stmt/branch/func/line); 전체 96.69% |

변경 파일 커버리지 상세: `types/product.ts` 100%, `services/product-service.ts` 100%,
`repositories/product-repository.ts` 100%, `app/api/products/route.ts` 100% — 기준 85% 충족.

### 테스트가 실제로 구속하는지 확인 (mutation check)

새 테스트가 통과하는 것만으로는 그 테스트가 구현을 구속한다는 증거가 되지 않으므로,
구현을 의도적으로 훼손해 테스트가 잡아내는지 확인했다.

| 변이 | 결과 |
|---|---|
| repository의 `mode: "insensitive"` → `"default"` | integration 12건 + repository 3건 + 정적 1건 RED |
| service의 빈 문자열 정규화 제거 (`return trimmed`) | service 5건 RED |

**이 확인 과정에서 결함 하나를 발견해 수정했다.** `search.test.ts` 초안은
repository seam(`findProductsPage`)을 모킹해서 where 절을 테스트가 직접 재구성하고
있었고, 그 결과 첫 번째 변이를 **전혀 잡지 못했다**(29건 전부 통과). Prisma seam
(`@/lib/db`) 모킹으로 내려서 실제 repository가 where를 만들고 테스트는 그것을 해석하도록
재배선한 뒤에야 변이가 RED가 된다. 이 재배선은 M4 커밋에 포함되어 있다.

### 갭 (명시적 기록 — 조용한 생략 없음)

- **G1 — DB 부재로 AC-CATALOG-030은 PARTIAL.** 이 환경에는 PostgreSQL이 없어
  (`.env` 없음, 서버 없음 — SPEC-CATALOG-001 G2/G5/G6과 동일 제약) 예산의 **DB 절반을
  측정할 수 없다.** 그리고 그쪽이 더 중요한 절반이다: REQ-CATALOG-016B가 실제로 안고 있는
  위험은 카탈로그가 커질 때의 순차 스캔인데, 이 테스트는 그것을 볼 수 없다. 측정된 0.50ms는
  애플리케이션 계층(파싱·정규화·where 조립·DTO 조립·직렬화)만의 값이다.
- **G2 — 트라이그램 인덱스 사용 여부(`EXPLAIN`) 미검증.** 스키마와 마이그레이션이 확장과
  인덱스를 올바르게 **선언**한다는 것은 검증했지만, 확장이 실제로 설치되는지, 인덱스가
  생성되는지, 플래너가 그것을 **선택**하는지는 라이브 DB가 필요하다. plan.md §2.3의
  성능 근거는 이 지점에서 아직 미검증 상태다.
- **G3 — 마이그레이션 미적용.** `20260828120000_add_product_name_trgm_index`는
  SPEC-CATALOG-001 선례대로 수작업 작성했으며(`prisma migrate dev`는 shadow DB 필요),
  어떤 데이터베이스에도 적용된 적이 없다. SQL의 구조적 정확성만 검증됨.
- **G4 — `pg_trgm` 확장 권한 미확인.** plan.md §6이 지적한 관리형 DB(Neon/Supabase)의
  `CREATE EXTENSION` 권한 문제는 실제 배포 대상 DB가 있어야 확인 가능하다. 지원되지 않으면
  plan.md §2.3 대안 B(인덱스 없이 진행)로 폴백해야 하며, 그 판단은 아직 내려지지 않았다.
- **G5 — 유니코드 대소문자 폴딩.** integration 테스트의 평가기는 `toLowerCase()`로
  대소문자를 접는데, 이는 ASCII 픽스처에 대해서는 PostgreSQL `ILIKE`와 일치하지만
  전체 유니코드 폴딩은 collation 의존적이다. 한글은 대소문자가 없어 이 SPEC의 주 사용
  사례에는 영향이 없으나, 라틴 확장 문자에 대한 동작은 미검증이다.

### 범위 밖 변경 (SPEC이 요구한 기존 테스트 수정)

SPEC-CATALOG-002는 `search`에 한해 REQ-CATALOG-012를 **대체(supersede)** 하므로,
"검색 파라미터를 읽지 않는다"고 못박은 기존 테스트 2곳을 수정했다 — 편의를 위한 삭제가
아니라 SPEC이 요구한 계약 변경이다.

- `tests/unit/catalog/query-surface.test.ts` — 화이트리스트에 `search` 추가(4개 → 5개).
  원래 assertion이 지키던 것(**닫힌 질의 표면**)은 그대로 유지되며, `q`/`keyword`/`query`는
  여전히 읽지 않는다(plan.md §2.1이 별칭을 명시적으로 거부).
- `tests/unit/catalog/product-service.test.ts` — "ignores q and search entirely" 블록을
  SPEC-CATALOG-002의 동작 명세로 교체. `q` 미지원은 별도 테스트로 보존.

SPEC-CATALOG-001은 §3에서 키워드 검색을 **연기된 범위**로 기록했지 영구 금지로 두지
않았으므로, 이 수정은 그 SPEC의 의도와 충돌하지 않는다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-08-28T20:45:00+09:00
run_commit_sha: 7d11df8  # M4; M5 커밋 SHA는 이 문서 커밋 시점에 확정
run_status: complete-with-documented-gaps
ac_pass_count: 13
ac_fail_count: 0
ac_partial_count: 1        # AC-CATALOG-030 (G1 — DB 부재)
preserve_list_post_run_count: 4
l44_pre_commit_fetch: not-applicable    # 카드 워크트리, 원격 푸시 없음
l44_post_push_fetch: not-applicable     # 푸시 수행하지 않음 (B9)
new_warnings_or_lints_introduced: 0
cross_platform_build:
  typecheck: pass          # npx tsc --noEmit, exit 0
  lint: pass               # npx eslint ., exit 0
  schema: pass             # npx prisma validate, exit 0
  test: pass               # 28 files / 304 tests, 실패 0
  coverage: pass           # 변경 4개 파일 100%, 기준 85%
total_run_phase_files: 9   # 소스 3, 스키마 1, 마이그레이션 1, 테스트 4(신규 3 + 수정 2 중 순증)
m1_to_mN_commit_strategy: milestone-per-commit  # M1..M5, 로컬 전용, 푸시 없음
baseline_attribution:
  before: 25 files / 222 tests (dc0283b, 별도 실행으로 관측)
  after: 28 files / 304 tests
  regressions: 0
```

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-08-28T00:00:00+09:00
sync_commit_sha: pending-backfill-sync   # 이 커밋 자신의 SHA — 착지 후 후속 커밋에서 backfill
sync_status: complete
changelog_entry_position: "CHANGELOG.md [Unreleased] — '### 추가 — SPEC-CATALOG-002' + '### 알려진 한계 — SPEC-CATALOG-002' (SPEC-CATALOG-001 섹션 뒤에 추가)"
b12_self_test_a: pass    # grep -c "SPEC-CATALOG-002" CHANGELOG.md → 0 (중복 없음, 작성 전 확인)
b12_self_test_b: pass    # acceptance.md AC 고유 식별자 16건 중 AC-CATALOG-001/016은 SPEC-CATALOG-001 상호참조 → 이 SPEC 소유 AC는 AC-CATALOG-017~030 = 14건, CHANGELOG 기재 수치와 일치
b12_self_test_c: pass    # CHANGELOG/README에 기재한 경로 전부 ls 확인 (migrations/20260828120000_add_product_name_trgm_index/, src/features/catalog/{repositories,services,types}/, src/app/api/products/route.ts)

frontmatter_status_transitions:
  spec_md: in-progress → implemented → completed   # 단일 sync 커밋에 병합
  plan_md: in-progress → implemented → completed
  acceptance_md: n/a    # frontmatter 블록 없음 (SPEC-CATALOG-001과 동일 패턴) — 미변경
  progress_md: n/a      # frontmatter 블록 없음 — 본문 §E.4만 추가

ac_disposition:
  ac_catalog_030: PASS-with-debt
  rationale: >-
    사용자 승인 하에 부분 인정. 애플리케이션 계층 p95는 search 단독 0.50ms,
    search+category+sort 조합 0.35ms(N=50)로 300ms 예산을 크게 밑돈다. 제외된
    부분은 DB 왕복이며, 여기에는 SPEC-CATALOG-001 AC-CATALOG-016에 없던 새 미검증
    항목이 하나 더 있다 — M1이 추가한 트라이그램 GIN 인덱스를 쿼리 플래너가 실제로
    선택하는지(EXPLAIN)는 라이브 DB 없이 확인할 수 없다. 실제 DB를 대상으로 한
    재측정은 후속 작업이며, 종료된 항목이 아니다.
  precedent: SPEC-CATALOG-001 AC-CATALOG-016 (동일 처분 패턴)

files_touched:
  - CHANGELOG.md                                   # 추가 + 알려진 한계 섹션 신규
  - README.md                                      # 카탈로그 API 섹션에 search 파라미터 반영
  - .moai/specs/SPEC-CATALOG-002/spec.md           # frontmatter status만
  - .moai/specs/SPEC-CATALOG-002/plan.md           # frontmatter status만
  - .moai/specs/SPEC-CATALOG-002/progress.md       # 본 §E.4 섹션

gaps:
  - 이 커밋은 원격에 푸시하지 않는다 (카드 워크트리 브랜치 WT-catalog-search-filter).
  - sync_commit_sha는 placeholder다. 커밋은 자기 해시를 알 수 없으므로 후속 커밋에서 backfill한다.
  - 소스·테스트·스키마는 sync 범위 밖이므로 재실행하지 않았다. 품질 게이트 수치는
    §E.2의 run-phase 측정을 인용한 것이며, 이 커밋에서 새로 관측한 값이 아니다.
```
