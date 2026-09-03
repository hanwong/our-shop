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

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
