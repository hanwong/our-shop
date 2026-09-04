---
id: SPEC-STOREFRONT-003
status: in-progress
updated: 2026-09-04
tier: M
---

# Progress: SPEC-STOREFRONT-003 — 홈 화면 상품 목록 그리드

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-04
plan_status: audit-ready

plan-phase 산출물 4종(spec.md, plan.md, acceptance.md, spec-compact.md) 작성 완료. Tier M.

**SPEC ID 검사**: 정규식 검사를 Bash로 실행해 관측했다.

```
$ ID="SPEC-STOREFRONT-003"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

동일 ID 부재도 확인했다 — 생성 직전 `ls .moai/specs/ | grep -c "^SPEC-STOREFRONT-003$"` → `0`, `grep -rl "SPEC-STOREFRONT-003" .moai/specs/` → `0`건(자기 자신 제외).

**프론트매터**: 정본 12필드 전부 존재(`id`/`title`/`version`/`status`/`created`/`updated`/`author`/`priority`/`phase`/`module`/`lifecycle`/`tags`) + 선택 필드 `tier: M`·`depends_on`·`related_specs`. `phase: "v0.2.0 target"`(SPEC-STOREFRONT-002와 동일한 최신 미출시 릴리스 타깃 표기), `status: draft`.

**REQ/AC 대응**: REQ 11건(REQ-STOREFRONT-031 ~ 041) / AC 11건(AC-STOREFRONT-031 ~ 041), acceptance.md §4 매핑 표로 1:다 대응까지 명시(예: REQ-STOREFRONT-033 → AC-033/039/041). Tier M 상한(REQ 16 / AC 16) 이내, 각각 여유 5건.

**번호 이어받기**: `STOREFRONT` 도메인 기존 번호를 잇는다 — SPEC-STOREFRONT-002가 REQ/AC 030까지 사용했음을 직접 확인했다(`grep -oE "REQ-STOREFRONT-[0-9]+" .moai/specs/SPEC-STOREFRONT-002/spec.md | sort -u | tail -3` → `028/029/030`, `grep -oE "AC-STOREFRONT-[0-9]+" .moai/specs/SPEC-STOREFRONT-002/acceptance.md | sort -u | tail -5` → `026~030`). 이 SPEC은 REQ/AC 031부터 시작한다.

**범위 축소 결정 반영 확인**: 사용자가 착수 전 이미 승인한 두 결정(페이지네이션/정렬/필터 UI 제외, `next/image` 사용)을 spec.md §1 "확정된 범위 축소 결정"에 원문 그대로 기록하고, §3 Out of Scope에 "다음 SPEC으로 이월" 항목으로 명시했다. `[NEEDS CLARIFICATION]` 마커는 없음 — plan.md/research.md 어디에도 미해결 질문이 없다(research.md는 Tier M이라 별도 생성하지 않음).

**depends_on 근거**: 2개 SPEC 모두 `status: completed`를 각 SPEC의 spec.md 프론트매터를 직접 grep해 확인했다.

```
$ for s in STOREFRONT-001 CATALOG-001; do echo -n "$s: "; grep "^status:" .moai/specs/SPEC-$s/spec.md; done
STOREFRONT-001: status: completed
CATALOG-001: status: completed
```

- `SPEC-STOREFRONT-001` — 이 SPEC이 이어받는 "목록 화면" 이월 결정(spec.md §3/§4)과 루트 문서 셸·Tailwind v4·`next/image`+`picsum.photos` 허용 목록·`ProductGallery` placeholder 패턴의 출처.
- `SPEC-CATALOG-001` — 이 SPEC이 소비하는 `listProducts`/`ProductListItem`/`PaginatedProducts` 계약의 출처.

**Tier 판정**: M. 파일 수(약 5~6, plan.md §G) · LOC(약 150~300, Tier S 상단~M 하단 경계) · REQ/AC(각 11건) 모두 Tier M 가이드 이내다. 경계에 가깝지만, 사용자가 명시적으로 `acceptance.md`를 별도 산출물로 요구했고(Tier S는 AC를 spec.md §3에 인라인함) Conditional Design Route가 적용되어 design phase가 시각 세부를 이어받는다는 두 근거로 M을 유지했다(plan.md §G에 상세 기록).

**Conditional Design Route**: 적용됨(`plan → design → run`) — `acceptance.md`가 화면(`/`)과 프런트엔드 컴포넌트(`ProductGrid`/`ProductCard`)를 명시적 산출물로 검증하므로 두 갈래 판정 기준의 첫 번째가 만족된다(plan.md §G). SPEC-STOREFRONT-001/002가 동일 기준으로 이미 이 경로를 적용한 선례를 따랐다. 이 plan-phase에서는 판정만 기록했고 design phase 자체는 실행하지 않았다.

**grounding 검증**: 사용자가 제공한 조사 사실(재사용 가능한 ProductGrid/ProductCard 컴포넌트 부재, `formatWon`이 이미 7개 파일에 의도적으로 중복 정의됨, `src/app/page.tsx`/`ProductGallery.tsx`/`EmptyCart.tsx`/`product-service.ts`/`product.ts` 현재 내용) 전부를 Read/Bash로 직접 재확인한 뒤 spec.md·plan.md에 반영했다 — 사용자 제공 사실을 그대로 받아쓰지 않고 근거 파일을 직접 읽어 검증했다.

**plan-audit 결과 (iteration 1/3, 2026-09-04)**: **PASS**, 종합 점수 **0.93** (Tier M 통과선 0.80 이상). 독립 감사자(plan-auditor)가 전체 must-pass 7종(MP-1~MP-7) 전부 PASS 또는 N/A로 판정했고, `product-service.ts`/`product.ts`/`page.tsx`/`ProductGallery.tsx`/`EmptyCart.tsx`/`CartView.tsx`/`next.config.ts`/`middleware.ts`/`shell.test.tsx`를 직접 재확인해 SPEC의 모든 코드 인용과 "현재 상태" 전제(스텁 교체 전제 포함)에서 불일치 0건을 확인했다. 두 확정 범위 축소 결정(페이지네이션/정렬/필터 UI 제외, `next/image` 사용)도 spec.md/plan.md/acceptance.md 전반에 일관되게 반영되어 있음을 확인했다. 선택적(optional, non-blocking) 결함 2건만 기록됨 — D1(`next/image` happy-path를 검증하는 AC 부재, minor), D2(REQ-031/032/037의 shall/shall-not 복합 절, minor). 둘 다 must-pass 실패가 아니며 PASS 판정을 막지 않는다. 상세 보고서: `.moai/reports/plan-audit/SPEC-STOREFRONT-003-review-1.md`.

**run-phase 진입을 막는 항목은 이제 Implementation Kickoff Approval(사용자 승인) 하나뿐이다.** plan-audit 게이트는 통과했다.

## §E.2 Run-phase Evidence

TDD로 M1~M5 전부 구현 완료. `design-notes.md`를 그대로 구현 청사진으로 따랐다.

**신규/수정 파일**: `src/components/product/ProductCard.tsx`(신규), `src/components/product/ProductGrid.tsx`(신규), `src/app/page.tsx`(전체 교체), `tests/unit/app/shell.test.tsx`(`HomePage stub` describe 블록만 교체, `RootLayout` 블록은 무수정), `tests/unit/app/home-page.test.tsx`(신규), `tests/unit/components/product-card.test.tsx`(신규), `tests/unit/components/product-grid.test.tsx`(신규).

**AC PASS/FAIL 매트릭스** (AC-STOREFRONT-031~041, 11건 전부 PASS):

```
$ npx vitest run tests/unit/components/product-card.test.tsx tests/unit/components/product-grid.test.tsx tests/unit/app/home-page.test.tsx tests/unit/app/shell.test.tsx
 ✓ tests/unit/components/product-grid.test.tsx (4 tests)
 ✓ tests/unit/components/product-card.test.tsx (9 tests)
 ✓ tests/unit/app/shell.test.tsx (4 tests)
 ✓ tests/unit/app/home-page.test.tsx (8 tests)
 Test Files  4 passed (4) / Tests  25 passed (25)
```

- AC-031/032 — `home-page.test.tsx`: 서버 렌더 + `listProducts` 직접 호출, `/api/products` 재호출 없음 — PASS
- AC-033/034/035/041 — `product-card.test.tsx`: 카드 표시(이미지/이름/가격/링크), 링크 대상, D1 보강(`next/image` import 소스 스캔) — PASS
- AC-036 — `home-page.test.tsx`: `totalCount===0` 빈 상태 문구 — PASS
- AC-037 — `product-card.test.tsx`: 이미지 없음 placeholder(`product-card-placeholder`, "이미지 준비 중"), throw 없음 — PASS
- AC-038 — `home-page.test.tsx` 정적 소스 스캔: 페이지네이션/정렬/필터/검색 UI 부재 — PASS
- AC-039 — `home-page.test.tsx` 정적 소스 스캔: `fetch(`/`useEffect` 0건, `"use client"` 없음 — PASS
- AC-040(카드 필드 제한) — `product-card.test.tsx`: 설명/재고/카테고리 텍스트 미노출 — PASS
- AC-STOREFRONT-039(다중 카드) — `product-grid.test.tsx`: 카드 3개, 서로 다른 링크, 순서 보존 — PASS
- AC-040(a11y) — `product-card.test.tsx`+`home-page.test.tsx`: alt에 상품명 포함, Tab 포커스 도달 — PASS
- AC-041(순수 표시 계층) — `product-grid.test.tsx`+`product-card.test.tsx`: 서비스 모킹 없이 props-in/DOM-out — PASS

**독립 재검증**(오케스트레이터가 직접 재실행, `.claude/worktrees/t34`에서):
```
$ npx tsc --noEmit          → exit 0, 출력 없음
$ npm run lint              → exit 0, 신규 이슈 0건
$ npx vitest run --coverage tests/unit/components/product-card.test.tsx tests/unit/components/product-grid.test.tsx tests/unit/app/home-page.test.tsx tests/unit/app/shell.test.tsx --coverage.include='src/components/product/ProductCard.tsx' --coverage.include='src/components/product/ProductGrid.tsx' --coverage.include='src/app/page.tsx'
  ProductCard.tsx / ProductGrid.tsx / page.tsx  → 100% stmts/branch/funcs/lines
$ npm test (전체 스위트)
  Test Files  1 failed | 101 passed (102) / Tests  1 failed | 1416 passed (1417)
  유일한 실패: tests/integration/auth/login.test.ts AC-AUTH-005 (백로그 t20, 이 SPEC과 무관한 기존 플레이크)
```

**subagent 경계 grep**: `grep -rn 'AskUserQuestion' src/components/product src/app/page.tsx` → 매치 0건.

**환경 이슈 기록**: 이 SPEC의 run-phase manager-develop 위임 도중, 세션이 워크트리(`t34`)에 있는 상태에서 `Agent()`로 서브에이전트를 띄우면 그 서브에이전트가 자신만의 별도 워크트리(`agent-<id>`)에 격리되어 `t34`에 git 명령을 실행할 수 없는 현상을 확인함(파일 Write/비-git Bash는 가능). 최종적으로 구현은 별도 격리 워크트리(`agent-ab813abb7e874dcee`, base `a3a47de`)에서 이뤄졌고, `page.tsx`/`shell.test.tsx`가 두 워크트리 base 사이에 무변경임을 확인한 뒤 오케스트레이터가 파일을 `t34`로 직접 복사·재검증·커밋함. Claude Code에 버그 리포트 제출함(세션 내부, 사용자 승인 대기).

## §E.3 Run-phase Audit-Ready Signal

run_status: audit-ready

- M1~M5 전부 완료, AC-STOREFRONT-031~041 11건 전부 PASS
- `npx tsc --noEmit` exit 0 / `npm run lint` exit 0 신규 이슈 0건 / 신규 파일 3종 커버리지 100%
- 전체 스위트 1416/1417 통과, 유일한 실패는 이 SPEC과 무관한 기존 플레이크(t20)
- PRESERVE 준수: `src/features/catalog/**`, `EmptyCart.tsx`, `next.config.ts` 무변경, `shell.test.tsx`의 `RootLayout` describe 블록 무변경(정확히 `HomePage stub` 블록만 교체)
- plan.md §J 안티패턴(공유 유틸 추출, 방어적 props, 담기 버튼, `ProductGallery` 재사용, 헤더/내비 추가) 전부 미범함
- sync-phase 진입을 막는 항목 없음

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
