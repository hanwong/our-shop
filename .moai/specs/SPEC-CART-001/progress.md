# Progress: SPEC-CART-001 — 장바구니 및 게스트→회원 카트 병합

## §E.1 Plan-phase Audit-Ready Signal

- `plan_status: audit-ready`
- `plan_complete_at: 2026-08-29`
- Tier: M (3-file artifact set: spec.md + plan.md + acceptance.md — design.md/research.md 미해당)
- 아티팩트: `spec.md`(REQ-CART-001~015, GEARS), `plan.md`(§2 결정사항 6개, §6 SPEC-AUTH-001 통합 지점 문서화), `acceptance.md`(AC-CART-001~015, §4 REQ↔AC 매핑 표로 전체 커버리지 확인)
- REQ 개수: 15 / 16(Tier M 상한) — 여유 1
- AC 개수: 15 / 16(Tier M 상한) — 여유 1
- Clarification status: 미해결 항목 없음(spec.md HISTORY, plan.md §9 참고)
- plan-phase 범위: docs-only, additive — `prisma/schema.prisma`, `src/**`, 기존 SPEC 파일(SPEC-AUTH-001/CATALOG-001/CATALOG-002) 미수정

## §E.2 Run-phase Evidence

### 기준선 (baseline, base commit `cab1cdb`)

| 측정 | 명령 | 관측값 |
|---|---|---|
| 전체 테스트 | `npx vitest run` | `Test Files 28 passed (28)` / `Tests 304 passed (304)` |
| 인증 스위트 | `npx vitest run tests/unit/auth tests/unit/api/auth/* tests/unit/lib/auth tests/unit/middleware.test.ts tests/integration/auth` | `Test Files 16 passed (16)` / `Tests 132 passed (132)` |
| 카탈로그 스위트 | `npx vitest run tests/unit/catalog tests/unit/api/products tests/integration/catalog` | `Test Files 9 passed (9)` / `Tests 164 passed (164)` |
| 타입 검사 | `npx tsc --noEmit` | exit 0 (무출력) |
| 린트 | `npx eslint .` | exit 0 (무출력) |

132 + 164 + 8(`tests/unit/db/**`) = 304 으로 기준선 총계가 정확히 분해된다.

### AC 매트릭스 (AC-CART-001 ~ 016)

전 16개 PASS. 각 행의 근거는 아래 명령 하나로 재현된다:
`DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx vitest run` → `Test Files 36 passed (36)` / `Tests 437 passed (437)`.

| AC | 검증 위치 | Actual Output | Status |
|---|---|---|---|
| AC-CART-001 | `tests/unit/api/cart/route.test.ts` — "adds an item and answers with the whole cart including the subtotal" | 응답 `items[0]`이 `{productId:"p1", quantity:2}`와 일치 | PASS |
| AC-CART-002 | `tests/unit/api/cart/route.test.ts` — "routes a valid Bearer token to the member cart"; `cart-service.test.ts` — 신원 해석 | `findCartByUserId("user-7")` 호출, `findCartByGuestId` 미호출 | PASS |
| AC-CART-003 | `route.test.ts` — "sets a httpOnly guest_cart_id cookie"; `tests/integration/cart/guest-merge.test.ts` — "carries a cart across requests using only the issued cookie" | 최초 요청에 `Set-Cookie: guest_cart_id=…`, 그 쿠키로 담기 후 재조회 시 `itemCount: 2` | PASS |
| AC-CART-004 | `tests/unit/cart/guest-identity.test.ts` (14 tests); `route.test.ts` 쿠키 속성 | `httpOnly:true`, `Max-Age=1209600`(14일) ≠ 30일, 이름이 `refresh_token`/`csrf_token`/`oauth_state`와 불일치 | PASS |
| AC-CART-005 | `route.test.ts` — "creates NO cart row while issuing that cookie"; `cart-service.test.ts` — 지연 생성 | 본문 `{items:[],subtotal:0,itemCount:0}`, `createGuestCart`/`createUserCart` 모두 미호출 | PASS |
| AC-CART-006 | `route.test.ts`; `cart-service.test.ts` — "computes subtotal … from the product's CURRENT price" | `quantity:2`, `subtotal:78000` (2 × 39000) | PASS |
| AC-CART-007 | `cart-service.test.ts` — "increments an existing line rather than creating a second one" | `incrementItemQuantity("cart-1","p1",3)` 1회, 신규 행 생성 없음 | PASS |
| AC-CART-008 | `cart-service.test.ts`; `route.test.ts` — 재고 초과 담기 | HTTP 400, `incrementItemQuantity` 미호출, `createGuestCart` 미호출(빈 카트 잔존 없음) | PASS |
| AC-CART-009 | `cart-service.test.ts` — "sets the quantity absolutely"; `route.test.ts` PATCH | `setItemQuantity("i1", 5)` — 2+5=7 아님 | PASS |
| AC-CART-010 | `route.test.ts` — DELETE "removes the addressed line and answers with what remains" | 200, `deleteItem("i1")` 1회, 잔여 `items` 길이 1 (`productId:"p2"`) | PASS |
| AC-CART-011 | `cart-service.test.ts` (미존재/타인 카트/카트 없음 3케이스); `route.test.ts` PATCH·DELETE | 모두 404, `setItemQuantity`/`deleteItem` 미호출 | PASS |
| AC-CART-012 | `tests/integration/cart/guest-merge.test.ts` — "sums the overlap, clamps it to stock, and carries the rest across" | A=4(3+2=5→재고 4로 클램프), B=1(불변), C=1(이관), `items` 길이 3 | PASS |
| AC-CART-013 | `guest-merge.test.ts` — "omits a sold-out product entirely"; `cart-service.test.ts` omit-zero 2케이스 | 병합 후 `items`가 `["B"]`만, 모든 `quantity >= 1` | PASS |
| AC-CART-014 | `guest-merge.test.ts` — "adds nothing on a second login replaying the same guest cookie" | 1차 병합 후 `quantity:3`, 동일 쿠키 재로그인 후에도 `quantity:3` / `itemCount` 동일 | PASS |
| AC-CART-015 | `guest-merge.test.ts` — "leaves Product.stock identical after add, change and delete"; `route.test.ts` — 4개 작업 무인증 | 상태코드 `[200,200,200,200]`(401/403 없음), 담기·수량변경·삭제 후 `stock` 배열이 이전과 완전 일치 | PASS |
| AC-CART-016 | `cart-service.test.ts` — "rejects a quantity above stock"; `route.test.ts` PATCH 재고 초과 | 400, `setItemQuantity` 미호출 | PASS |

AC-CART-015 관측 지점 주석: 재고 불변은 `GET /api/products/:id` 대신 데이터 계층(가짜 DB의 `products` 배열)에서 관측했다 — 카트 코드가 `Product` 쓰기 경로를 아예 호출하지 않음을 보이는 것이 동일 명제의 더 직접적인 증거이기 때문이며, 카탈로그 엔드포인트를 경유하면 카탈로그 조회 코드가 관측을 한 겹 가린다.

### 불변식

| 불변식 | Actual Output | Status |
|---|---|---|
| 기존 인증 API 회귀 0건 (plan.md §8 최대 리스크) | `Test Files 16 passed (16)` / `Tests 132 passed (132)` — 기준선과 파일별 개수까지 동일 | PASS |
| 기존 카탈로그 API 회귀 0건 | `Test Files 9 passed (9)` / `Tests 164 passed (164)` — 기준선과 동일 | PASS |
| PRESERVE 경계 (`src/lib/auth/**`, `src/middleware.ts`) | `git diff cab1cdb..HEAD --name-only -- src/lib/auth src/middleware.ts` → `src/lib/auth/guest-identity.ts` (신규 파일) 1건뿐 | PASS |
| 두 인증 라우트는 추가만 | `git diff`상 삭제는 `getCookieValue` 이전(§6 step 1 승인 항목) 한 곳뿐, 나머지는 전부 `+` | PASS |
| 커버리지 ≥85% (신규/변경 카트 파일) | 카트 전 파일 100% lines/functions/statements; 전체 `98.02 / 95.29 / 100 / 98.02` | PASS |

### 환경 제약으로 검증 불가 (조용한 생략 아님)

- **마이그레이션 실제 적용**: PostgreSQL 미가용(`prisma migrate diff --from-migrations` → `P1001 Can't reach database server`). 마이그레이션 SQL은 `prisma migrate diff --from-empty --to-schema-datamodel` 출력에서 발췌한 것이며 구조적 정합성(테이블 2개만 생성, DROP 없음, 제약 이름)은 `tests/unit/cart/schema.test.ts`가 텍스트로 검증한다. 실제 서버 적용·롤백은 미검증.
- **DB 제약 실제 동작**: `@@unique([cartId, productId])` 충돌 시 upsert 원자성, `onDelete: Cascade` 실제 전파는 미검증 — 통합 테스트의 가짜 DB가 cascade를 흉내낼 뿐이다.
- **동시 담기 경합 (plan.md §8)**: 같은 게스트 쿠키의 병렬 요청이 `{increment}`로 올바르게 합산되는지는 실제 Postgres 없이는 검증 불가. 코드는 read-modify-write 대신 원자적 `{increment}`를 사용하도록 작성됐고 그 사실은 단위 테스트가 확인하지만, 경합 자체는 미관측.
- **병합 실패의 관측 가능성**: 두 로그인 경로의 merge 실패는 의도적으로 삼켜진다(로그인 보전). 이 저장소에 로깅 인프라가 없어 실패가 어디에도 기록되지 않는다 — 알려진 관측성 공백.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-08-29
run_commit_sha: a2e66a5   # M6; M1..M6 = eec8aae, e1aa99e, dcdbe48, 219cc3d, 64e1c17, a2e66a5
run_status: complete
ac_pass_count: 16
ac_fail_count: 0
preserve_list_violations: 0       # 기존 PRESERVE 파일 수정 0건
preserve_list_post_run_count: 1   # src/lib/auth/ 에 추가된 신규 파일 1개(guest-identity.ts) — 기존 파일 수정 아님
l44_pre_commit_fetch: not-applicable   # 카드 워크트리 로컬 커밋 전용, 원격 push 없음
l44_post_push_fetch: not-applicable    # push 미수행
new_warnings_or_lints_introduced: 0    # npx eslint . exit 0, npx tsc --noEmit exit 0
cross_platform_build:
  typecheck: pass        # npx tsc --noEmit exit 0
  lint: pass             # npx eslint . exit 0
  schema_validate: pass  # npx prisma validate exit 0
  test: pass             # 437 passed (436 + 1 추가 duration 케이스), 36 files
  runtime_build: not-run # next build 미실행 (DB 미가용 환경, 이번 마일스톤 범위 밖)
total_run_phase_files: 20   # SPEC 아티팩트 3개 제외한 소스/테스트/스키마 파일 수
m1_to_mN_commit_strategy: milestone-per-commit   # M1..M6 각 1커밋, amend/force-push 없음
```

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
