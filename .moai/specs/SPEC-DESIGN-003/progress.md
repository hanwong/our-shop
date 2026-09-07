# SPEC-DESIGN-003 — 진행 기록

카드: t67 · 워크트리: `.claude/worktrees/t67` · 브랜치: `WT-neutral-500-contrast` · 분기점: `origin/main` = `5b2881e`

---

## §E.1 Plan-phase Audit-Ready Signal

**상태**: plan-phase 산출물 작성 완료. **plan-audit 수행 완료 — verdict PASS(0.90, iteration 1/3). audit-ready 신호 발행.**

**감사 경위**: 이 SPEC을 저작한 `manager-spec` 에이전트는 `Agent` 도구를 갖지 않아 `plan-auditor`를 스스로 스폰할 수 없으므로, 독립 감사는 오케스트레이터가 위임했다. 자기 감사로 대체하지 않았다 — 아래 verdict는 `plan-auditor`가 독립적으로 실행한 감사의 결과이며, 보고서 전문은 `.moai/reports/plan-audit/SPEC-DESIGN-003-review-1.md`에 있다.

감사 결과: must-pass 7건 전부 PASS/N/A(MP-4는 단일 언어 저장소이므로 N/A), 카테고리 조화평균 **0.90**(Clarity 0.90 · Completeness 1.00 · Testability 0.75 · Traceability 1.00)으로 Tier M 임계 **0.80**을 상회. 감사자가 SPEC의 사실 주장 18건을 독립 재측정한 결과 **불일치 0건**.

```yaml
plan_status: audit-ready
plan_complete_at: 2026-09-07
plan_audit_verdict: PASS
plan_audit_score: 0.90
plan_audit_iterations: 1
plan_audit_report: .moai/reports/plan-audit/SPEC-DESIGN-003-review-1.md
blocker: null
```

**감사 후 반영한 수정 (D1·D2 — 둘 다 감사자가 non-blocking으로 분류했고 PASS를 뒤집지 않는다)**:

감사 보고서 §Defects Found는 결함 7건을 기록했고, 그중 `blocking` 등급 2건(D1 major · D2 minor)을 run-phase 진입 전 처리 권고했다. 두 건 모두 `acceptance.md`에 반영했다(`spec.md`·`plan.md` 본문은 손대지 않았다).

| 결함 | 조치 | 반영 위치 |
|---|---|---|
| **D1** `AC-GITDIFF-BASELINE` (major) — AC-003·AC-005가 기준점 없는 맨 `git diff`를 써서, run-phase가 마일스톤 단위로 커밋하면 빈 출력 → 위양성 FAIL | 실행 가능한 `git diff` **6곳 전부**를 plan-phase baseline `5b2881e`에 고정(`git diff 5b2881e -- <path>`). 문서 서두에 «`git diff` 기준점» 공통 전제를 추가 | `acceptance.md` 서두 + AC-003 (a)(b)(c) + AC-004 (a) + AC-005 2곳 |
| **D2** `AC-008-NONBINARY` (minor) — AC-008 (a)가 이진 판정이 아니고 기대 출력값이 없음 | grep 범위를 §2.2의 10개 대상 파일로 한정(AC-002 (c)와 동일 목록)해 이진성 회복, 기대 출력 **`0`** 명시. 전역 검색 시 나오는 잡음 `2`건과 그 `file:line`(`src/app/staff/orders/page.tsx:120,128`)을 «범위 한정 근거»로 함께 기록 | `acceptance.md` AC-008 (a) + 기대 출력 + PASS 조건 |

감사자가 `optional`로 분류한 5건(D3 lint baseline 미기재 · D4 `mkdir -p` 위치 · D5 `SPEC-A11Y-001` 전방 포인터 · D6 REQ-005 GEARS 라벨 · D7 REQ-002 구체 유틸리티 지정)은 **이번 수정 범위 밖**이며 미조치로 남는다 — 감사자 스스로 D5·D6·D7은 조치 불필요로 기록했다.

**수정 후 실제 실행한 검증** (미관측 주장 방지):

```
$ git rev-parse 5b2881e
5b2881e061ed447ee9ff8589a764ec85c0855490

$ git diff --name-only 5b2881e -- src/ ; echo "exit=$?"
exit=0        (현재 트리 == baseline이므로 빈 출력이 정상)

$ grep -n "text-neutral-600" <10개 대상 파일> | grep -c "font-bold\|font-semibold\|font-medium"
0             (AC-008 (a) 새 형태의 기대 출력과 일치)

$ grep -rn "text-neutral-600" --include="*.tsx" src/ | grep -c "font-bold\|font-semibold\|font-medium"
2             (전역 검색 시 잡음 — 두 행 모두 src/app/staff/orders/page.tsx:120,128, 10개 대상 밖)
```

**이 수정이 PASS 판정에 미치는 영향**: 없음(상향만 가능). 감사 보고서 §Recommendation은 "D1·D2를 반영하면 Testability가 0.75 → 1.0으로 올라 조화평균은 약 0.97"이라고 기록했으나, **재감사를 수행하지 않았으므로 0.97은 감사자의 예측이지 측정값이 아니다.** 위 `plan_audit_score: 0.90`은 실제로 실행된 iteration 1의 측정값을 그대로 유지한다.

**기계적 검사는 수행했다** (독립 감사를 대체하지 않으며, 그 전제 조건만 확인한다):

```
$ moai spec lint
✓ No findings — all SPEC documents are valid

$ moai spec drift    (SPEC-DESIGN-003 행만 발췌)
SPEC-DESIGN-003                draft                era-exempt           aligned
```

`aligned` — 이 SPEC에 대한 status drift 0건. 같은 출력의 다른 25개 SPEC DRIFT 행은 이 카드 이전부터 존재하던 저장소 전역 상태이며(frontmatter 파서가 본문 표의 «비고» 셀을 읽는 형태), 이 카드가 만든 것이 아니고 이 카드의 범위도 아니다.

`moai spec audit`은 이 SPEC을 **V3R5**로 분류한다(자매 SPEC 대부분은 V3R6). 이는 결함이 아니라 **plan-phase의 정상 상태**다 — V3R6 판정은 `progress.md`의 `§E.4` 표제와 `sync_commit_sha` 필드를 함께 요구하는데, `sync_commit_sha`는 sync-phase 커밋이 발생해야 채워진다. 같은 저장소의 `SPEC-ORDER-003`도 V3R5로 분류된다. sync 완료 시 V3R6으로 전환된다.

**산출물** (Tier M — 판정 근거는 `plan.md` §A.1):

| 파일 | 상태 |
|---|---|
| `spec.md` | 작성 완료 — GEARS 요구사항 7건(REQ-DESIGN3-001..007), Out of Scope 7개 항목, §2 지점별 배경 전수 측정 |
| `plan.md` | 작성 완료 — 마일스톤 3개(M1 판단 지점 격리, M2·M3 기계적) |
| `acceptance.md` | 작성 완료 — AC-001..AC-009, 전부 명령 기반 이진 판정 |
| `progress.md` | 이 파일 |

**plan-phase에서 실제 실행한 검증**:

1. SPEC ID 정규식 자기 검사
   ```
   $ ID="SPEC-DESIGN-003"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
   PASS
   ```

2. SPEC ID 중복 검사
   ```
   $ grep -rl "SPEC-DESIGN-003" .moai/
   exit=1   (기존 사용 0건)
   ```

3. 대상 지점 총량 재측정 (SPEC-DESIGN-002가 기록한 17건/10파일이 여전히 유효한지)
   ```
   $ grep -rln "text-neutral-500" --include="*.tsx" src/ | wc -l
   10
   $ grep -rn  "text-neutral-500" --include="*.tsx" src/ | wc -l
   17
   $ grep -rn "text-neutral-500" --include="*.ts" --include="*.css" --include="*.js" src/
   exit=1   (.tsx 외 사용 0건)
   ```

4. `neutral-500`이 텍스트 색으로만 쓰이는지 (유틸리티 종류 집계)
   ```
   $ grep -rho "\(text\|border\|bg\|ring\|placeholder\|divide\|decoration\|from\|to\|via\|fill\|stroke\|shadow\|outline\|accent\|caret\)-neutral-500" --include="*.tsx" --include="*.ts" --include="*.css" src/ | sort | uniq -c
     17 text-neutral-500
   ```
   → `border-`/`bg-`/`ring-` 등 0건. 대비 미달이 전부 텍스트 렌더 결함이다.

5. `bg-*` 전수 인벤토리 (균일 교체 전제의 근거 — spec.md §2.1)
   ```
   $ grep -rno "bg-[a-z0-9-]*" --include="*.tsx" src/
   src/app/(shop)/checkout/complete/[orderId]/page.tsx:127 bg-red-50
   src/app/(shop)/checkout/complete/[orderId]/page.tsx:140 bg-amber-50
   src/app/(shop)/checkout/complete/[orderId]/page.tsx:147 bg-emerald-50
   src/app/(shop)/checkout/complete/[orderId]/page.tsx:154 bg-neutral-100
   src/app/(shop)/shop/page.tsx:33 bg-accent
   src/app/(shop)/shop/page.tsx:34 bg-neutral-200
   src/app/(shop)/shop/page.tsx:34 bg-neutral-300
   src/app/layout.tsx:119 bg-white          (주석 산문 안 인용)
   src/app/layout.tsx:122 bg-bg             (주석 산문 안 인용)
   src/app/layout.tsx:126 bg-bg             ← <body> 실제 적용
   src/app/staff/orders/[orderId]/CancelOrderButton.tsx:88 bg-red-600
   src/app/staff/products/ProductForm.tsx:352 bg-red-600
   src/app/staff/products/ProductForm.tsx:353 bg-green-700
   src/app/staff/products/page.tsx:218 bg-green-100
   src/app/staff/products/page.tsx:219 bg-neutral-200
   src/components/address/AddressList.tsx:96 bg-accent
   src/components/cart/CartView.tsx:128 bg-neutral-100
   src/components/layout/SiteHeader.tsx:66 bg-surface
   src/components/orders/OrderLookupResultView.tsx:52 bg-amber-50
   src/components/orders/OrderLookupResultView.tsx:59 bg-emerald-50
   src/components/orders/OrderLookupResultView.tsx:66 bg-neutral-100
   src/components/product/ProductCard.tsx:19 bg-neutral-100   (주석 산문 안 인용)
   src/components/product/ProductCard.tsx:48 bg-surface
   src/components/product/ProductCard.tsx:52 bg-neutral-100
   src/components/product/ProductCard.tsx:58 bg-neutral-100
   src/components/product/ProductGallery.tsx:42 bg-neutral-100
   src/components/product/ProductGallery.tsx:52 bg-neutral-100
   src/components/ui/Button.tsx:54 bg-transparent
   src/components/ui/FormField.tsx:74 bg-red-600
   ```
   레이아웃은 둘뿐이며 배경을 선언하는 것은 `src/app/layout.tsx:126`(`<body className="bg-bg text-text">`) 하나다. `src/app/(shop)/layout.tsx`는 `SiteHeader` + `{children}`만 렌더하고 배경을 선언하지 않는다.

6. 명도 대비 매트릭스 (Node 스크립트, 실행 후 삭제)
   ```
   neutral-500 #989898 on --color-bg      #f2f2f2 => 2.577:1  AA-normal(4.5) FAIL
   neutral-600 #6b6b6b on --color-bg      #f2f2f2 => 4.760:1  AA-normal(4.5) PASS
   neutral-700 #5e5e5e on --color-bg      #f2f2f2 => 5.792:1  AA-normal(4.5) PASS
   neutral-800 #424242 on --color-bg      #f2f2f2 => 8.977:1  AA-normal(4.5) PASS

   neutral-500 #989898 on neutral-100     #f5f5f5 => 2.646:1  AA-normal(4.5) FAIL
   neutral-600 #6b6b6b on neutral-100     #f5f5f5 => 4.888:1  AA-normal(4.5) PASS
   neutral-700 #5e5e5e on neutral-100     #f5f5f5 => 5.948:1  AA-normal(4.5) PASS
   neutral-800 #424242 on neutral-100     #f5f5f5 => 9.218:1  AA-normal(4.5) PASS

   neutral-500 #989898 on --color-surface #e9e9e9 => 2.376:1  AA-normal(4.5) FAIL
   neutral-600 #6b6b6b on --color-surface #e9e9e9 => 4.389:1  AA-normal(4.5) FAIL
   neutral-700 #5e5e5e on --color-surface #e9e9e9 => 5.341:1  AA-normal(4.5) PASS
   neutral-800 #424242 on --color-surface #e9e9e9 => 8.278:1  AA-normal(4.5) PASS
   ```
   → 17개 지점이 실제로 렌더되는 두 배경(`#f2f2f2` 15건 · `#f5f5f5` 2건) 모두에서 `neutral-600`이 AA를 통과한다. `text-neutral-700`이 필요한 지점은 **0건**.

7. `ProductCard.tsx`의 `bg-surface` 조상 판정 (유일한 비균일 후보)
   ```
   $ sed -n '48,56p' src/components/product/ProductCard.tsx
         className="group block overflow-hidden rounded-md border border-divider bg-surface shadow-sm ..."
       >
         {image === undefined ? (
           <div
             className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500"
   ```
   → 52행 요소가 **자기 자신의 불투명 배경 `bg-neutral-100`을 선언**하므로 48행의 `bg-surface`는 가려진다. 실효 배경은 `#f5f5f5`(4.888:1 PASS). 같은 파일 72행의 `text-neutral-700`은 배경 선언 없는 `<div className="p-3">` 안이라 실제로 surface 위에 렌더되지만 5.341:1로 AA를 통과하며 이 SPEC의 대상이 아니다.

8. 대형 텍스트 예외 미해당 확인 (인용이 아닌 직접 측정)
   ```
   $ grep -rn "text-neutral-500" --include="*.tsx" src/ | grep -c "font-bold\|font-semibold\|font-medium"
   0
   $ grep -rn "text-neutral-500" --include="*.tsx" src/ | grep -o "text-xs\|text-sm\|text-base\|text-lg\|text-xl\|text-2xl" | sort | uniq -c
      3 text-sm
     11 text-xs
   $ grep -n "<address" "src/app/(shop)/checkout/complete/[orderId]/page.tsx" "src/app/staff/orders/[orderId]/page.tsx" src/components/orders/OrderLookupResultView.tsx
   src/app/(shop)/checkout/complete/[orderId]/page.tsx:216:        <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-neutral-800">
   src/app/staff/orders/[orderId]/page.tsx:139:        <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-neutral-800">
   src/components/orders/OrderLookupResultView.tsx:123:        <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-neutral-800">
   ```
   → 굵기 클래스 0건, 최대 14px(상속 3건의 조상도 전부 `text-sm`). WCAG 대형 텍스트 예외(≥18.66px bold 또는 ≥24px) 해당 0건 → 17건 전부에 AA 일반 4.5:1이 적용된다.

9. 교체 후 기대값의 근거 (AC-002)
   ```
   $ grep -rn  "text-neutral-600" --include="*.tsx" src/ | wc -l
   36
   $ grep -rln "text-neutral-600" --include="*.tsx" src/ | wc -l
   17
   $ comm -12 <(grep -rln "text-neutral-500" --include="*.tsx" src/ | sort) <(grep -rln "text-neutral-600" --include="*.tsx" src/ | sort)
   src/app/(shop)/checkout/complete/[orderId]/page.tsx
   src/app/staff/orders/[orderId]/page.tsx
   src/components/checkout/OrderSummary.tsx
   src/components/orders/OrderLookupResultView.tsx
   src/components/product/ProductDetailView.tsx
   ```
   → 파일 교집합 5개. 교체 후 기대: 총량 36+17 = **53건**, 파일 17+(10−5) = **22개**.

10. SPEC-DESIGN-002 AC-005(c)의 교체 전 상태 (무효화 판정의 baseline)
    ```
    $ grep -n "neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
    exit=1   (출력 없음 — 현재는 통과)
    ```
    → 이 카드가 `ProductCard.tsx:52`를 교체하면 이 검사는 매치하게 된다. 실제 결함이 아니라 **검사 입도의 문제**이며, 대체 검사는 AC-007이다(spec.md §4.1).

11. 테스트 결합 확인
    ```
    $ grep -rn "neutral-500" tests/ e2e/
    exit=1
    $ grep -rn "neutral-600" tests/ e2e/
    exit=1
    ```
    → 클래스 문자열을 단언하는 테스트 0건. `tests/unit/components/product-card.test.tsx:96`은 `product-card-placeholder` testid의 **존재만** 단언한다.

**미검증 (Gaps)**:
- 빌드·린트·타입체크·테스트를 plan-phase에서 실행하지 않았다 — run-phase AC-009 대상이다.
- 17개 지점의 **실제 브라우저 렌더 결과**(스크린샷)를 확인하지 않았다. 배경 판정은 CSS 페인팅 규칙과 전수 `bg-*` 인벤토리(검증 5)에 근거한 정적 분석이다.
- `@media (prefers-contrast)` / 강제 색 모드 / 다크 모드에서의 렌더는 검사하지 않았다 — 저장소에 해당 분기가 존재하지 않는다.

**잔여 위험**:
1. `neutral-600` on `#f2f2f2` = 4.760:1은 AA 기준(4.5) 대비 여유가 0.26에 불과하다. 배경 토큰이 조금이라도 어두워지면 17개 지점이 한꺼번에 미달로 돌아선다.
2. 어떤 지점이든 장래에 `bg-surface` 컨테이너 안으로 옮겨지면 4.389:1로 조용히 미달한다. AC-007이 이 회귀를 감시하되, 그 검사는 "같은 행에 자기 배경이 있는가"만 보므로 중간 조상이 배경을 선언하는 형태는 잡지 못한다(acceptance.md AC-007 «검사의 한계»).
3. `text-neutral-500` 재도입을 기계적으로 막는 장치가 없다(범위 제외). 후속 카드 권고 대상이다.

---

## §E.2 Run-phase Evidence

_<pending run-phase>_

---

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
