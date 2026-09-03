# Progress: SPEC-ADMIN-002 — 관리자 상품 등록/수정 백오피스

## §E.1 Plan-phase Audit-Ready Signal

```yaml
spec_id: SPEC-ADMIN-002
tier: L
card: t11
plan_complete_at: 2026-09-04
plan_status: audit-ready
artifacts:
  - .moai/specs/SPEC-ADMIN-002/spec.md
  - .moai/specs/SPEC-ADMIN-002/plan.md
  - .moai/specs/SPEC-ADMIN-002/acceptance.md
  - .moai/specs/SPEC-ADMIN-002/design.md
  - .moai/specs/SPEC-ADMIN-002/research.md
requirements: 23   # REQ-ADMIN-019 ~ 041 (Tier L 상한 25 이내)
acceptance_criteria: 24   # AC-ADMIN-019 ~ 041, 23개 REQ에 1:1 대응 (021만 a/b 하위 ID로 분할 → 항목 24개)
needs_clarification: 0
```

**plan-phase 요약**: 백로그 카드 `t11`을 다룬다. `SPEC-ADMIN-001`의 관리자 세션 판정·CSRF·경로 관례를 그대로 재사용하며, 상품 CRUD와 소프트 삭제(`Product.isActive`)를 추가한다. 조사에서 드러난 이 SPEC 고유의 난점은 소프트 삭제 컬럼이 이미 완료된 고객 대면 카탈로그(SPEC-CATALOG-001/002)에 미치는 연쇄 효과이며(research.md §5), `findProductsPage`/`findProductById`를 최소 범위로 EXTEND해 닫는다(REQ-ADMIN-034~036). 장바구니에 이미 담긴 판매 중단 상품이 결제까지 통과하는 공백은 진짜 새 공백으로 확인되었으나 이 SPEC이 떠안지 않고 신규 백로그 카드로 넘긴다(spec.md §3).

**Implementation Kickoff Approval에서 확인할 결정 1건**: plan.md §0 결정 1 — 완료된 SPEC(CATALOG-001/002)이 소유한 구현 파일과 테스트 **9건**을 건드리는 것에 대한 승인. 미해결 명확화 항목이 아니라(근거와 대안이 모두 확보됨) 승인 대상 결정이다.

**plan-audit 이력**:

- **iteration 1 — FAIL** (집계 0.75 / Tier L 기준 0.85 미달, 보고서 `.moai/reports/plan-audit/SPEC-ADMIN-002-2026-09-04.md`). must-pass 7개 항목은 전부 통과했고, blocking 결함 4건이 지적되었다: **D1**(critical — 깨지는 기존 테스트 수가 6건이 아니라 9건. 누락된 3건은 모두 `SPEC-CATALOG-002` 소유 검색 테스트이며, 잘못된 비용이 승인 게이트 입력으로 쓰이고 있었다), **D3**(major — `REQ-ADMIN-041`의 "세 지점"과 `AC-ADMIN-041`의 "4개 항목"이 서로 다른 경계를 서로 다른 단위(계약 vs 파일)로 말했고, `types/admin.ts`와 카탈로그 테스트 파일이 §1 표에서 누락, 금지 목록에 `SPEC-CATALOG-001/002` 부재), **D2**(major — 장바구니 공백의 노출 창을 "남는 경로는 단 하나"로 과소 평가. 공개 엔드포인트 `POST /api/cart/items`를 통한 중단 이후 신규 담기 경로가 실재), **D4**(minor — `acceptance.md`가 자기 AC 개수를 23으로 잘못 셈, 실제 24).
- **iteration 2 — 위 4건을 모두 반영**. D1: 여섯 산출물의 "6건"을 "9건"으로 정정하고 design.md §3을 무리 A(6건)/무리 B(3건) 두 표로 재작성하며 9건을 개별 열거, 첫 두 행의 줄 번호를 실제 위치(`:111~112`·`:119~120`)로 교정. D3: spec.md §1 "확장하는 계약" 표를 **파일 단위 4개 행**으로 재구성해 plan.md §3 EXTEND 표와 같은 경계·같은 단위로 맞추고, REQ-ADMIN-041의 예외를 "4개 파일"로, 금지 목록에 `SPEC-CATALOG-001/002`를 추가, `AC-ADMIN-041`이 같은 표를 검증하도록 문구 정렬. D2: spec.md §3·§4와 research.md §5.3의 노출 창 서술을 (a) 중단 이전 카트 + (b) 공개 엔드포인트를 통한 중단 이후 담기 **두 경로**로 정정(넘김 결정 자체는 유지 — 근거를 창의 크기가 아니라 범위 번짐으로 명시). D4: `acceptance.md` 헤더를 24개로 정정. 선택 항목 D5(`related_specs`에 `SPEC-ORDER-002`·`SPEC-STOREFRONT-001`·`SPEC-STOREFRONT-002` 추가, `SPEC-CATALOG-002`를 `depends_on`으로 승격)·D6(실패 사유 은닉 속성을 REQ-ADMIN-037/039 본문에 명시해 `AC-ADMIN-021b`·`AC-ADMIN-039`의 대응을 직접화)·D7(선례 비대칭 문구 정련)도 함께 반영했다. 요구사항 수는 23개로 불변, AC 수는 24개로 불변.
- **iteration 2 — PASS** (집계 1.00 / Tier L 기준 0.85 충족, 보고서 `.moai/reports/plan-audit/SPEC-ADMIN-002-2026-09-04-iter2.md`). D1~D4 네 건 모두 해소 확인. 감사자가 `tests/unit/catalog/product-repository.test.ts`(242줄)를 직접 재판독해 인용된 14개 줄 위치가 모두 실제 내용과 일치함을 확인했고(드리프트 0건), 깨지는 테스트 9건을 독립적으로 재도출했다. D2의 근거 코드(`order-service.ts` 전체 852줄에 `isActive` 0건, `cart-repository.ts:131~138`이 `{id, price, stock}`만 조회)도 직접 재확인. 새 결함 유입 없음. 잔여 optional 3건(D5 `order-service.ts:474~510` 인용 범위가 실제 `:473~617`을 못 덮음, D6 두 건의 줄 범위 off-by-one, D7 `plan.md:113`의 소유 SPEC 표기 누락)은 blocking이 아니며 iteration 3을 정당화하지 않는다.
- **plan-phase 종료 상태**: audit-ready. Implementation Kickoff Approval에 올릴 결정 1건(plan.md §0 결정 1 — CATALOG-001/002 소유 구현 파일 + 테스트 9건 수정 승인)은 run-phase 진입 전 사용자 확인 대상으로 남아 있다.
- **2026-09-04 — plan-audit 이후 국소 정정(재감사 아님): EXTEND 봉투 4개 파일 → 5개 파일**. plan-phase가 놓친 다섯 번째 `SPEC-CATALOG-001` 소유 파일 `tests/unit/catalog/query-surface.test.ts`를 spec.md §1 표·REQ-ADMIN-041·plan.md §3 EXTEND 표·AC-ADMIN-041에 추가했다. 근거: 같은 파일 `:110~148`의 `AC-CATALOG-001` 블록이 명시 타입 주석 + `satisfies Product` 타입 가드로 `Product`의 **모든** 필드를 요구하므로, REQ-ADMIN-019가 `Product.isActive`를 추가하는 순간 `npm run typecheck`가 깨진다. 실측 증거(격리 probe에 `tsc --noEmit --strict`): 필드 미추가 시 `error TS1360: ... Property 'isActive' is missing in type ... but required in type 'Product'`, 리터럴에만 추가하고 타입 주석을 두지 않으면 `error TS2353: ... 'isActive' does not exist in type ...` — 따라서 이 파일의 최소 변경은 주석·리터럴·`Object.keys().sort()` 기대값 **3곳**이다. 선례: `tests/unit/catalog/schema.test.ts:79`의 `[AUTO] SPEC-CART-001 M1` 주석이 동일한 상황(가산적 스키마 변경이 완료된 카탈로그 테스트의 정확 일치 단언을 깨뜨림)을 범위 축소가 아니라 **해당 카탈로그 테스트의 단언 갱신**으로 해소했다. 요구사항·AC 개수 불변(23 / 24), plan-audit 판정(iteration 2 PASS, 집계 1.00) 불변.

## §E.2 Run-phase Evidence

**진행 상태: BLOCKED (부분 완료).** M1~M6의 구현은 전부 착지했고 24개 AC 중 23개가 PASS 증거를 가진다. 남은 1건(AC-ADMIN-041)은 **plan-phase가 놓친 여섯 번째 EXTEND 대상 파일** 때문에 판정 불가이며, 그 결정 권한은 이 에이전트에 없다 — 아래 "블로커" 절 참조.

### 블로커 — EXTEND 봉투 5개 파일 → 6개 파일 (판정 대기)

`§E.1`의 2026-09-04 국소 정정이 봉투를 4→5로 늘렸으나, **실측 결과 여섯 번째 파일이 더 있다**: `tests/integration/catalog/search.test.ts`(`SPEC-CATALOG-002` 소유). REQ-ADMIN-034/035가 승인된 대로 적용되는 순간 이 파일의 4개 테스트가 깨진다.

이 파일을 고치지 않은 이유는 판단이 아니라 경계다. `REQ-ADMIN-041`과 `AC-ADMIN-041`이 봉투를 **이름까지 열거해 정확히 5개 파일**로 못박고 있으므로, 여섯 번째를 건드리는 순간 `AC-ADMIN-041`이 문언 그대로 FAIL한다. AC를 위반하는 방식으로 AC를 통과시킬 수는 없다. SPEC 본문 수정은 manager-spec의 소유이므로 블로커로 반환한다.

실측 실패 4건 (`npm test`, 상세는 아래 명령 출력):

```
FAIL tests/integration/catalog/search.test.ts
  × AC-CATALOG-021 > builds a where clause carrying BOTH filters
    → expected { isActive: true, …(2) } to deeply equal { categoryId: 'cat-tops', …(1) }
  × AC-CATALOG-028 > answers 200 and the same body whether or not ?search= is appended
    → TypeError: prisma.product.findFirst is not a function
  × AC-CATALOG-029 > issues a where clause with no name filter when search is absent
    → expected { isActive: true, …(1) } to deeply equal { categoryId: 'cat-tops' }
  × AC-CATALOG-029 > issues a completely empty where clause for an unparameterised request
    → expected { isActive: true } to deeply equal {}
```

승인 시 필요한 변경은 5곳, 전부 `tests/unit/catalog/product-repository.test.ts`에 이미 적용한 것과 **같은 종류의 기댓값 갱신**이다(요구사항 변경 아님): ① `findFirst` 모킹 등록(`:45`·`:53` 부근)과 `beforeEach` 리셋(`:213` 부근), ② `:309` `toEqual`에 `isActive: true` 추가, ③ `:457` 동일, ④ `:463` `{}` → `{ isActive: true }`, ⑤ `:429` `findUnique.mock.calls` → `findFirst.mock.calls` + `where`를 `{ id: "p-shirt", isActive: true }`로.

**봉투 완전성은 실측으로 확인했다** — 전체 스위트 95개 파일 중 이 SPEC 변경에 기인해 실패하는 파일은 이 하나뿐이고, `npm run typecheck`는 exit 0이므로 `satisfies Product` 계열의 추가 파손도 없다.

### AC별 판정 (24건 중 23 PASS / 1 BLOCKED)

| AC | 판정 | 실제 출력 근거 |
|---|---|---|
| AC-ADMIN-019 | PASS | 라이브 DB 조회: `isActive \| boolean \| nullable=NO \| default=true`, `rows total=10 isActive=true=10 isActive=false=0` — 마이그레이션 이전 10개 행 전부 판매 가능 유지, 다른 컬럼 값 무변경 |
| AC-ADMIN-020 | PASS | `tests/unit/admin/product-boundaries.test.ts` — 이 SPEC이 추가·확장한 12개 파일 전부에 `product.delete`/`deleteMany` 0건. 라이브 DB FK: `CartItem.productId -> CASCADE`, `OrderItem.productId -> RESTRICT` (무변경) |
| AC-ADMIN-021a | PASS | `staff-products-page.test.tsx` — 판매중 2 + 중단 1 = 3행 모두 렌더, 배지 `판매 중`×2 / `판매 중단`×1 |
| AC-ADMIN-021b | PASS | 같은 파일 — 세션 `null`이면 `redirect("/staff/login")` 발생 + `listProductsForAdmin` 미호출(데이터를 읽고 버리는 것이 아니라 아예 읽지 않음) |
| AC-ADMIN-022 | PASS | `admin-product-repository.test.ts` — category/search/양자 AND, `count`의 `where`가 `findMany`의 `where`와 동일 |
| AC-ADMIN-023 | PASS | `staff-products-page.test.tsx` — 기본 `page=1/pageSize=20`, 잘못된 page 5종 모두 1로 보정, `pageSize=5000` → 100 클램프. 상수는 `types/admin.ts`에서 import |
| AC-ADMIN-024 | PASS | `product-routes.test.ts` — 201 + `createProduct`가 제출값 그대로 수신. `admin-product-repository.test.ts` — `isActive: true`로 생성 |
| AC-ADMIN-025 | PASS | `product-routes.test.ts` — 200 + `updateProduct("p1", 6개 필드)`. 행 개수 불변(`updateMany` 단일 id), `isActive` 미포함 |
| AC-ADMIN-026 | PASS | `product-validation.test.ts` — 가격 0/음수/소수/문자열/NaN/Infinity 거부, 1 허용; 재고 음수/소수 거부, 0 허용; 이름·설명 공백 거부 |
| AC-ADMIN-027 | PASS | 같은 파일 — 빈 배열 허용, 순서 보존, 상대경로·비문자열·`ftp:`·`javascript:` 거부, 1개만 불량이어도 전체 거부 |
| AC-ADMIN-028 | PASS | `product-boundaries.test.ts` — 12개 파일에 multipart/`formData()`/`type="file"` 0건, `package.json` dependencies 7개로 불변 |
| AC-ADMIN-029 | PASS | `staff-product-form.test.tsx` — 카테고리는 `<select>`(자유 입력 없음). `product-routes.test.ts` — `P2003`을 `errors.categoryId`로 변환, 행 생성·갱신 0건 |
| AC-ADMIN-030 | PASS | `product-routes.test.ts` — 8종 불량 입력 × 2라우트 전부 400 + 필드명 지목 + 쓰기 0건. `product-validation.test.ts` — 6개 필드 동시 보고, 멀쩡한 필드는 미지목 |
| AC-ADMIN-031 | PASS | `admin-product-repository.test.ts` — `setProductActive`의 `data`가 `toEqual({ isActive })`. 이름·가격·재고·이미지·카테고리는 write 대상에 없음(구조적 보장) |
| AC-ADMIN-032 | PASS | 같은 파일 + `product-routes.test.ts` — `isActive: true` 전달 경로 확인 |
| AC-ADMIN-033 | PASS | `admin-product-repository.test.ts` — 중단 시 `updateMany` 1회 외 write 없음. 소프트 삭제이므로 DELETE 자체가 없어 `CartItem` CASCADE 미발동(구조적) |
| AC-ADMIN-034 | PASS | `product-repository.test.ts` — `where.isActive === true`가 무조건, `count`의 `where`가 `findMany`와 동일 |
| AC-ADMIN-035 | PASS | 같은 파일 — `findFirst`의 `where`가 `{ id, isActive: true }`, 중단 상품은 `null`(찾을 수 없음) |
| AC-ADMIN-036 | PASS | `product-boundaries.test.ts` — `LIST_SELECT`/`DETAIL_SELECT`에 `isActive` 0건, `product-service.ts` diff 0줄, 3개 정렬 키·`skip`/`take` 산술 무변경 |
| AC-ADMIN-037 | PASS | `product-boundaries.test.ts` — 화면·API 전부 `resolveAdminSession` 사용, `refresh_token`/`hashRefreshToken`/`prisma.user`/`prisma.refreshToken` 0건, `admin-session.ts`에 `SPEC-ADMIN-002` 흔적 0건 |
| AC-ADMIN-038 | PASS | `product-routes.test.ts` — 3개 라우트 각각 세션 `null`이면 403 + 쓰기 0건, 요청마다 `resolveAdminSession` 1회 호출 |
| AC-ADMIN-039 | PASS | `product-routes.test.ts` — CSRF 실패 시 `resolveAdminSession` 미호출·쓰기 0건, CSRF 실패와 세션 실패의 status·body가 동일. `product-boundaries.test.ts` — 소스 순서상 CSRF가 세션보다 앞 |
| AC-ADMIN-040 | PASS | `product-boundaries.test.ts` — 화면 3장 전부 `/staff/products` 하위, 쓰기 API 3개 전부 `/admin/api/products` 하위, `/admin` 아래 `page.tsx` 0건 |
| **AC-ADMIN-041** | **BLOCKED** | PRESERVE 목록 8개 파일 diff 0줄은 확인(`product-boundaries.test.ts`). 그러나 완료 SPEC 소유 변경 파일이 선언된 5개가 아니라 **6개여야 한다**(위 블로커). 봉투 정정 전에는 판정 불가 |

### 마일스톤별 실행 기록 (RED 증거 포함)

| M | 내용 | RED 증거 (구현 전) | GREEN |
|---|---|---|---|
| M1 | 스키마 + 고객 대면 필터 | `npx vitest run tests/unit/catalog/product-repository.test.ts` → `Tests 12 failed \| 16 passed (28)`. 이어서 스키마 추가 후 `npm run typecheck` → `exit=2`, `error TS1360: ... does not satisfy the expected type '{ ... isActive: boolean ... }'` (예측된 TS1360, 그리고 이것이 **유일한** 오류 — 6번째 파일이 타입 계열이 아님을 증명) | 카탈로그 5파일 115/115, typecheck exit 0 |
| M2 | 검증 + 관리자 저장소 + 타입 | `npx vitest run tests/unit/admin/product-validation.test.ts tests/unit/admin/admin-product-repository.test.ts` → `Tests 89 failed (89)`, `Cannot find module '@/features/admin/repositories/admin-product-repository'` | 89/89 |
| M3~M5 | 목록 화면 + 3개 쓰기 라우트 | `npx vitest run tests/unit/app/staff-products-page.test.tsx tests/unit/api/admin/product-routes.test.ts` → `Tests 62 failed (62)`, 4개 모듈 `Cannot find module` | 라우트 46/46, 화면 17/17 |
| M4/M5 | `ProductForm` + 등록/수정 화면 | `npx vitest run tests/unit/app/staff-product-form.test.tsx` → `Failed to resolve import "@/app/staff/products/ProductForm". Does the file exist?` | 27/27 |
| M6 | 경계 가드 + 접근성 | 해당 없음 — **구현 이후 작성된 회귀 가드이므로 RED 단계가 없다**(명세가 아니라 부재를 고정하는 그물). 대신 변이 검사로 falsifiability를 실증: `admin-product-repository.ts`에 `void prisma.product.delete;`를 일시 삽입 → `× [AC-ADMIN-020] ... issues no product delete`, `Tests 1 failed \| 65 passed (66)`. 즉시 되돌림 | 경계 66/66, 접근성 19/19 |

### 최종 검증 명령과 출력 (verbatim)

```
$ npm run typecheck
typecheck exit=0        # 오류 0건

$ npm run lint
lint exit=0             # 오류·경고 0건

$ npm test
 Test Files  2 failed | 93 passed (95)
      Tests  5 failed | 1317 passed (1322)
=== FAILING FILES ===
 FAIL  tests/integration/auth/login.test.ts          # 알려진 flake (백로그 t20)
 FAIL  tests/integration/catalog/search.test.ts      # 위 블로커 4건

$ npx vitest run tests/integration/auth/login.test.ts     # flake 단독 재실행
 ✓ AC-AUTH-005 — response-time similarity ... 22126ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
exit=0
```

`login.test.ts`는 단독 실행 시 통과하므로 이 SPEC의 회귀가 아니라 부하 하에서만 나타나는 알려진 타이밍 flake다(백로그 `t20`). 착수 전 baseline에서도 동일하게 1건 실패했다(`Tests 1 failed | 1053 passed (1054)`).

**증거 파일**: `.moai/state/verify/spec-admin-002/` (baseline-*, m1-red, m1-typecheck-red, m2-red, m3m4m5-red, m4-form-red, final-*).

### 잔여 위험 (해결하지 않음, 설계상 수용)

- **재고 편집과 주문 취소 복원의 경합** — 폼 저장은 절대값 덮어쓰기, `cancelOrderAsAdmin()`은 상대 `increment`. spec.md §4의 수용된 잔여 위험이며, 완화는 폼의 안내 문구 하나뿐이다(`ProductForm.tsx`의 `stock-hint`, 테스트로 존재를 고정).
- **장바구니에 담긴 판매 중단 상품의 결제 통과** — 범위 밖(결정 2). sync-phase에서 백로그 카드 등재 필요.
- **마이그레이션은 로컬 DB에만 적용됨** — `npx prisma migrate deploy`로 `localhost:5433`에 적용해 `All migrations have been successfully applied.` 확인. 다른 환경 반영은 배포 절차의 몫이다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
spec_id: SPEC-ADMIN-002
card: t11
run_complete_at: 2026-09-04
run_status: blocked            # 구현은 완료, AC-ADMIN-041만 봉투 정정 대기
run_commit_sha: <backfill>     # M1=3b16ded, M2~M6은 후속 커밋
blocker:
  kind: scope-envelope-expansion
  detail: >-
    tests/integration/catalog/search.test.ts (SPEC-CATALOG-002 소유)가
    REQ-ADMIN-034/035의 승인된 변경에 의해 4건 깨진다. REQ-ADMIN-041과
    AC-ADMIN-041이 봉투를 이름까지 열거해 정확히 5개 파일로 고정하고 있어
    여섯 번째를 건드리면 AC-ADMIN-041이 문언대로 FAIL한다. SPEC 본문 수정은
    manager-spec 소유이므로 반환한다.
  required_edit_sites: 5
  envelope_completeness_verified: true   # 전체 스위트 + typecheck exit 0으로 실측
ac_total: 24
ac_pass_count: 23
ac_fail_count: 0
ac_blocked_count: 1            # AC-ADMIN-041
preserve_list_post_run_count: 8   # 전부 diff 0줄, product-boundaries.test.ts가 고정
new_warnings_or_lints_introduced: 0
typecheck_exit_code: 0
lint_exit_code: 0
test_suite:
  files_passed: 93
  files_failed: 2
  tests_passed: 1317
  tests_failed: 5
  attributable_to_blocker: 4
  known_flake: 1               # AC-AUTH-005, 백로그 t20, 단독 실행 시 통과
tests_added: 268               # 신규 7파일 263건 + product-repository.test.ts 신규 5건.
                               # 실측 대조: 착수 baseline 1054 → 최종 1322 = +268 (일치)
total_run_phase_files: 23      # 신규 18(구현 10 + 마이그레이션 1 + 테스트 7) + EXTEND 5
m1_to_mN_commit_strategy: milestone-scoped
```

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
