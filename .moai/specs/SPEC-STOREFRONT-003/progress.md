---
id: SPEC-STOREFRONT-003
status: draft
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

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
