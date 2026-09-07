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

**실행 환경 (기록)**: run-phase를 위임받은 에이전트는 런타임에 의해 자기 전용 워크트리 `.claude/worktrees/agent-afb3ef428bbc6c0cb`로 격리되었다(`t67`은 `WT-neutral-500-contrast`를 잠근 상태로 점유 중). 따라서 부모 SHA `48ab0d2`에서 로컬 브랜치 `run-design-003`을 분기해 작업하고, 완료 후 `origin/WT-neutral-500-contrast`로 fast-forward push 했다. `src/` 트리는 두 지점에서 동일하므로(`48ab0d2`는 plan-phase 문서만 추가) AC의 baseline 고정 `5b2881e`는 그대로 유효하다.

**마일스톤 커밋**:

| 마일스톤 | 커밋 | 내용 |
|---|---|---|
| M1 | `274bf4e` | `ProductCard.tsx:52` 단독 교체 + `spec.md` frontmatter `draft → in-progress` |
| M2 | `99e4b9a` | 나머지 9파일 16지점 교체 |
| M3 | (아래 §E.3 참조) | 검증 증적 기록 |

### 사전 확인 (plan.md §C) — 착수 전 실제 출력

```
$ grep -rln "text-neutral-500" --include="*.tsx" src/ | wc -l
      10
$ grep -rn  "text-neutral-500" --include="*.tsx" src/ | wc -l
      17

$ grep -rho "\(text\|border\|bg\|...\)-neutral-500" --include="*.tsx" --include="*.ts" --include="*.css" src/ | sort | uniq -c
  17 text-neutral-500

$ grep -rn  "text-neutral-600" --include="*.tsx" src/ | wc -l
      36
$ grep -rln "text-neutral-600" --include="*.tsx" src/ | wc -l
      17

$ grep -n "neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
exit=1        (SPEC-DESIGN-002 AC-005(c) 교체 전 통과 상태 확인)

$ grep -rn "neutral-500\|neutral-600" tests/ e2e/
exit=1        (테스트 결합 0건)

$ grep -n "color-neutral-500\|color-neutral-600\|color-bg\|color-surface" src/app/globals.css
46:  --color-bg: #f2f2f2;
47:  --color-surface: #e9e9e9;
59:  --color-neutral-400: #b7b7b7; --color-neutral-500: #989898; --color-neutral-600: #6b6b6b;
```

plan-phase 측정치와 **전부 일치**. 병렬 세션 경합(plan.md §B.4) 신호 없음.

**§C 4번 게이트 판정 (새 `bg-*` 지점의 조상 여부)**: `bg-*` 전수 재측정에서 spec.md §2.1 표에 개별 행으로 열거되지 않은 지점이 나왔으나, 전부 §2.1의 «그 외» 행에 포섭되거나 **주석 산문 안 인용**이었다. 실제 적용 클래스가 아님을 파일을 열어 직접 확인했다:

```
$ (src/app/layout.tsx 110-131행 확인)
117-125행: 주석 블록 — 그 안의 bg-white(119) / bg-bg(122)는 산문 인용
126행:     <body className="bg-bg text-text antialiased">   ← 유일한 실제 적용

$ (src/components/product/ProductCard.tsx 10-24행 확인)
19행: 파일 헤더 docblock 안 "same aspect-square + bg-neutral-100 treatment" — 산문 인용
```

→ 17개 대상의 새로운 조상 배경 **0건**. 균일 교체의 전제(spec.md §2.1 인벤토리)가 유지되므로 M1으로 진행했다.

### M1 게이트 — AC-007 (M2 착수 전 실행)

```
$ grep -rln "bg-surface" --include="*.tsx" src/
src/components/layout/SiteHeader.tsx
src/components/product/ProductCard.tsx

$ grep -n "text-neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
src/components/product/ProductCard.tsx:52:          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-600"

$ grep -n "text-neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/) | grep -v "bg-neutral-\|bg-bg\|bg-white"
exit=1        (출력 없음 — 게이트 통과)
```

게이트 통과. `bg-surface` 조상 판정(spec.md §2.3(b))이 요소 입도 검사로 확인되었으므로 M2를 진행했다.

---

### AC 판정 매트릭스

| AC | 판정 | 검증 명령 | 실제 출력 |
|---|---|---|---|
| AC-001 | **PASS** | `grep -rn "text-neutral-500" --include=*.tsx --include=*.ts --include=*.css --include=*.js src/` | 출력 없음, `exit=1` |
| AC-002 | **PASS** | (a) 총량 / (b) 파일 수 / (c) 지점별 행 열거 | (a) `53` · (b) `22` · (c) 17개 `file:line` 전부 존재 |
| AC-003 | **PASS** | `git diff --name-only 5b2881e -- src/` | 10개 파일, `diff` 출력 없음 `exit=0` |
| AC-004 | **PASS** | `git diff --name-only 5b2881e -- src/app/globals.css` | 출력 없음 + 토큰 3개 원값 유지 |
| AC-005 | **PASS** | 제거행(치환 적용) vs 추가행 `diff` | 출력 없음 `exit=0`, 양쪽 `17`행 |
| AC-006 | **PASS** | WCAG 2.1 상대 휘도 계산 (Node) | `#6b6b6b` 두 배경 모두 PASS |
| AC-007 | **PASS** | 요소 입도 회귀 검사 (c) | 출력 없음, `exit=1` |
| AC-008 | **PASS** | (a) 굵기 클래스 수 / (b) `<address>` 크기 | (a) `0` · (b) 세 곳 모두 `text-sm` |
| AC-009 | **PASS** | lint / typecheck / test | `src/` 신규 오류 `0`, 테스트 1665건 전원 통과 |

#### AC-001 — `text-neutral-500` 잔존 0건

```
$ grep -rn "text-neutral-500" --include="*.tsx" --include="*.ts" --include="*.css" --include="*.js" src/
$ echo "exit=$?"
exit=1
```

#### AC-002 — 17개 지점이 전부 `text-neutral-600`

```
$ grep -rn "text-neutral-600" --include="*.tsx" src/ | wc -l
      53
$ grep -rln "text-neutral-600" --include="*.tsx" src/ | wc -l
      22
```

(c) 10개 대상 파일의 행 열거 — spec.md §2.2 표의 17개 행 번호가 **전부** 포함됨(교체 전부터 있던 `text-neutral-600` 행도 함께 나타나며 정상):

```
src/app/(shop)/checkout/complete/[orderId]/page.tsx:169:        <dt className="text-neutral-600">주문 번호</dt>
src/app/(shop)/checkout/complete/[orderId]/page.tsx:187:                <p className="mt-1 text-xs text-neutral-600">          ← §2.2 #1
src/app/(shop)/checkout/complete/[orderId]/page.tsx:198:            <dt className="text-neutral-600">상품 합계</dt>
src/app/(shop)/checkout/complete/[orderId]/page.tsx:202:            <dt className="text-neutral-600">배송비</dt>
src/app/(shop)/checkout/complete/[orderId]/page.tsx:224:            <p className="text-neutral-600">요청사항: {order.shipping.deliveryMemo}</p>   ← #2
src/app/(shop)/checkout/page.tsx:122:      <p className="mt-8 text-xs text-neutral-600">                                      ← #3
src/app/staff/orders/[orderId]/page.tsx:92:        <dt className="text-neutral-600">주문 번호</dt>
src/app/staff/orders/[orderId]/page.tsx:94:        <dt className="mt-2 text-neutral-600">상태</dt>
src/app/staff/orders/[orderId]/page.tsx:110:                <p className="mt-1 text-xs text-neutral-600">                          ← #4
src/app/staff/orders/[orderId]/page.tsx:121:            <dt className="text-neutral-600">상품 합계</dt>
src/app/staff/orders/[orderId]/page.tsx:125:            <dt className="text-neutral-600">배송비</dt>
src/app/staff/orders/[orderId]/page.tsx:147:            <p className="text-neutral-600">요청사항: {order.shipping.deliveryMemo}</p>  ← #5
src/app/staff/products/ProductForm.tsx:264:          <p id="stock-hint" className="mt-1 text-xs text-neutral-600">                ← #6
src/app/staff/products/ProductForm.tsx:288:          <p className="mt-1 text-xs text-neutral-600">                                 ← #7
src/app/staff/products/ProductForm.tsx:341:          <p className="mt-1 text-xs text-neutral-600">                                 ← #8
src/components/cart/CartView.tsx:140:                <p className="mt-1 text-xs text-neutral-600">{formatWon(item.price)}</p>  ← #9
src/components/cart/CartView.tsx:175:                  className="text-xs text-neutral-600 hover:text-red-600"                ← #10
src/components/checkout/OrderSummary.tsx:87:                <p className="mt-1 text-xs text-neutral-600">                          ← #11
src/components/checkout/OrderSummary.tsx:102:          <dt className="text-neutral-600">상품 합계</dt>
src/components/checkout/OrderSummary.tsx:109:            <dt className="text-neutral-600">
src/components/checkout/OrderSummary.tsx:116:          <dt className="text-neutral-600">배송비</dt>
src/components/orders/OrderLookupResultView.tsx:40:        <dt className="text-neutral-600">주문 번호</dt>
src/components/orders/OrderLookupResultView.tsx:42:        <dt className="mt-2 text-neutral-600">주문 일시</dt>
src/components/orders/OrderLookupResultView.tsx:84:                <p className="mt-1 text-xs text-neutral-600">                          ← #12
src/components/orders/OrderLookupResultView.tsx:95:            <dt className="text-neutral-600">상품 합계</dt>
src/components/orders/OrderLookupResultView.tsx:99:            <dt className="text-neutral-600">배송비</dt>
src/components/orders/OrderLookupResultView.tsx:106:              <dt className="text-neutral-600">
src/components/orders/OrderLookupResultView.tsx:131:            <p className="text-neutral-600">요청사항: {order.shipping.deliveryMemo}</p> ← #13
src/components/product/ProductCard.tsx:52:          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-600"   ← #14
src/components/product/ProductDetailView.tsx:72:      <p className="mt-2 text-sm text-neutral-600">{product.category.name}</p>          ← #15
src/components/product/ProductDetailView.tsx:80:          <span className="text-neutral-600">재고 {product.stock}개 남음</span>
src/components/product/ProductDetailView.tsx:102:        <p className="mt-1 text-sm text-neutral-600">
src/components/product/ProductDetailView.tsx:124:                <p className="mt-1 text-xs text-neutral-600">                          ← #16
src/components/product/ProductGallery.tsx:42:        className="flex aspect-square w-full items-center justify-center rounded bg-neutral-100 text-sm text-neutral-600"   ← #17
```

§2.2 표의 17개 행 번호(187·224 / 122 / 110·147 / 264·288·341 / 140·175 / 87 / 84·131 / 52 / 72·124 / 42)가 하나도 빠짐없이 존재한다. 행 번호는 in-place 치환이므로 이동하지 않았다.

#### AC-003 — 변경 파일이 정확히 그 10개

```
$ git diff --name-only 5b2881e -- src/
src/app/(shop)/checkout/complete/[orderId]/page.tsx
src/app/(shop)/checkout/page.tsx
src/app/staff/orders/[orderId]/page.tsx
src/app/staff/products/ProductForm.tsx
src/components/cart/CartView.tsx
src/components/checkout/OrderSummary.tsx
src/components/orders/OrderLookupResultView.tsx
src/components/product/ProductCard.tsx
src/components/product/ProductDetailView.tsx
src/components/product/ProductGallery.tsx

$ git diff --name-only 5b2881e -- src/ | wc -l
      10

$ diff .moai/state/verify/SPEC-DESIGN-003/expected-files.txt .moai/state/verify/SPEC-DESIGN-003/actual-files.txt
$ echo "exit=$?"
exit=0
```

#### AC-004 — `globals.css` 무변경

```
$ git diff --name-only 5b2881e -- src/app/globals.css
(출력 없음)

$ grep -n "color-neutral-400\|color-neutral-500\|color-neutral-600" src/app/globals.css
53:  /* SPEC-DESIGN-002 (2026-09-07) — --color-neutral-600 corrected to #6b6b6b.
59:  --color-neutral-400: #b7b7b7; --color-neutral-500: #989898; --color-neutral-600: #6b6b6b;
```

`--color-neutral-500: #989898` 보존 확인. 판정은 종료 코드가 아니라 **출력 유무**로 했다(acceptance.md AC-004 PASS 조건).

#### AC-005 — diff가 토큰 치환만 (범위 가드)

```
$ diff .moai/state/verify/SPEC-DESIGN-003/removed-substituted.txt \
       .moai/state/verify/SPEC-DESIGN-003/added.txt
$ echo "exit=$?"
exit=0

$ wc -l < .moai/state/verify/SPEC-DESIGN-003/removed-substituted.txt
      17
$ wc -l < .moai/state/verify/SPEC-DESIGN-003/added.txt
      17
```

제거된 17행에 `text-neutral-500` → `text-neutral-600` 치환을 적용한 결과가 추가된 17행과 **정확히 일치**한다. 공백·클래스 순서·주석을 포함해 토큰 하나 외의 변경은 0건이다.

#### AC-006 — 지점별 실효 배경 위 대비 (재측정)

```
$ node .moai/state/verify/SPEC-DESIGN-003/ac006-contrast.js
#989898 on --color-bg(15 sites)        #f2f2f2 => 2.577:1 FAIL
#6b6b6b on --color-bg(15 sites)        #f2f2f2 => 4.760:1 PASS
#989898 on bg-neutral-100(2 sites)     #f5f5f5 => 2.646:1 FAIL
#6b6b6b on bg-neutral-100(2 sites)     #f5f5f5 => 4.888:1 PASS
#989898 on --color-surface(unreachable)#e9e9e9 => 2.376:1 FAIL
#6b6b6b on --color-surface(unreachable)#e9e9e9 => 4.389:1 FAIL
```

plan-phase 사전 측정치와 소수점 셋째 자리까지 일치. `#6b6b6b` on `#e9e9e9`의 FAIL은 **기대된 결과**이며(도달 불가능 조합), AC-007이 별도로 판정한다. 스크립트는 실행 후 삭제했다:

```
$ test -e .moai/state/verify/SPEC-DESIGN-003/ac006-contrast.js && echo PRESENT || echo REMOVED
REMOVED
```

#### AC-007 — surface 위 `neutral-600` 0건 (요소 입도 회귀 검사)

```
$ grep -rln "bg-surface" --include="*.tsx" src/
src/components/layout/SiteHeader.tsx
src/components/product/ProductCard.tsx

$ grep -n "text-neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
src/components/product/ProductCard.tsx:52:          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-600"

$ grep -n "text-neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/) | grep -v "bg-neutral-\|bg-bg\|bg-white"
$ echo "exit=$?"
exit=1
```

acceptance.md의 기대 출력과 (a)(b)(c) 전부 일치.

#### AC-008 — 대형 텍스트 예외 미해당 재확인

```
$ grep -n "text-neutral-600" <10개 대상 파일> | grep -c "font-bold\|font-semibold\|font-medium"
0

$ grep -n "<address" "src/app/(shop)/checkout/complete/[orderId]/page.tsx" "src/app/staff/orders/[orderId]/page.tsx" src/components/orders/OrderLookupResultView.tsx
src/app/(shop)/checkout/complete/[orderId]/page.tsx:216:        <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-neutral-800">
src/app/staff/orders/[orderId]/page.tsx:139:        <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-neutral-800">
src/components/orders/OrderLookupResultView.tsx:123:        <address className="mt-3 space-y-1 text-sm not-italic leading-relaxed text-neutral-800">
```

(a) 정확히 `0` — 이진 판정 성립. (b) 세 `<address>`가 각각 216 / 139 / 123행에서 모두 `text-sm` 보유. 최대 14px · 전부 normal weight → 대형 텍스트 예외 미해당 → 17건 전부에 AA 일반 4.5:1 적용.

> `grep -n "<address"` 출력에는 `OrderLookupResultView.tsx:9`(파일 헤더 주석의 `<dl>/<ul>/<address>` 산문 인용)이 함께 나온다. 실제 `<address>` 요소가 아니므로 판정 대상이 아니다.

#### AC-009 — 품질 게이트 회귀 0건

**lint**:

```
$ unset MOAI_KANBAN ... && npm run lint
> our@0.1.0 lint
> eslint .
(오류 출력 없음)
```

**typecheck — 사전 존재 baseline을 추정하지 않고 실제로 측정했다.** 이 워크트리를 baseline SHA `5b2881e`로 detach 하여 교체 전 상태의 타입체크를 직접 실행하고, 교체 후 결과와 오류 집합을 대조했다:

```
$ git checkout 5b2881e && npm run typecheck | grep -c "error TS"
41                    ← 교체 전 baseline
$ grep -c "^src/" (baseline 출력)
0                     ← baseline의 src/ 오류

$ git checkout run-design-003 && npm run typecheck | grep -c "error TS"
41                    ← 교체 후
$ grep -c "^src/" (교체 후 출력)
0                     ← 교체 후 src/ 오류

$ diff <(baseline 오류 정렬) <(교체 후 오류 정렬)
$ echo "exit=$?"
exit=0                ← 오류 집합이 바이트 단위로 동일
```

경로별 분류(교체 후):

```
  40 e2e
   1 playwright.config.ts
```

`src/` 아래 오류 **0건**, 오류 집합 델타 **0**. 41건 전부 `e2e/*.spec.ts` · `e2e/support/*.ts` · `playwright.config.ts`의 `@playwright/test` 타입 선언 누락(TS2307)과 암묵적 any(TS7031/TS7006)이며, 교체 전부터 동일하게 존재했다.

> **plan.md §B.3의 `28건`과 실측 `41건`의 차이 (정직한 기록)**: `28`은 SPEC-DESIGN-002 progress.md §E.2가 **그 시점에** 기록한 값을 인용한 것이고, 현재 트리에는 그 이후 추가된 e2e 스펙 파일(`m2-toss-stub` · `m3-happy-path` · `m4-edge-cases` 등)이 더 있어 오류 수가 늘었다. 이 카드가 만든 차이가 아니다 — 위 baseline 직접 측정이 그것을 보인다(교체 전에도 41건). AC-009의 판정 기준은 절대 건수가 아니라 «`src/` 신규 오류 0건»이며, 그 기준은 충족되었다.

**test**:

```
$ unset MOAI_KANBAN ... && npm test
 Test Files  130 passed (130)
      Tests  1665 passed (1665)
   Duration  36.39s
```

기존 스위트 전원 통과. 예상 밖 결합 없음.

---

### 부수 확인

**AskUserQuestion 미도입 (E4)**:

```
$ git diff 5b2881e -- src/ | grep -i "AskUserQuestion\|mcp__askuser"
exit=1        (이 SPEC의 diff에 해당 참조 0건)
```

**증적 파일** — `.moai/state/verify/SPEC-DESIGN-003/`:

```
actual-files.txt  added.txt  expected-files.txt  removed-substituted.txt
```

(AC-006 스크립트는 acceptance.md 지시대로 실행 후 삭제)

> **증적 경로의 지속성에 대한 정직한 기록**: 이 디렉터리는 `.gitignore:209`(`.moai/state/`)로 **커밋되지 않는다**. 확인:
> ```
> $ git check-ignore -v .moai/state/verify/SPEC-DESIGN-003/added.txt
> .gitignore:209:.moai/state/	.moai/state/verify/SPEC-DESIGN-003/added.txt
> ```
> 게다가 이 파일들은 run-phase가 실행된 에이전트 전용 워크트리 안에 있어 세션 종료 시 사라질 수 있다. 따라서 **감사 시점에 해석되는 증적은 위 §E.2에 인라인으로 인용된 축자 출력**이며, `.moai/state/` 경로는 실행 당시의 중간 산출물이다. AC-003·AC-005의 판정 자체는 두 파일의 `diff` 결과(`exit=0`)와 행 수(`17`/`17`)로 §E.2에 축자 보존되어 있으므로, 파일이 사라져도 판정 근거는 남는다. 재현이 필요하면 acceptance.md AC-003/AC-005의 명령을 baseline `5b2881e` 고정 그대로 다시 실행하면 된다.

### 미검증 (Gaps)

- **실제 브라우저 렌더 결과를 확인하지 않았다.** 배경 판정은 CSS 페인팅 규칙 + `bg-*` 전수 인벤토리에 근거한 정적 분석이며, 스크린샷 대조나 실행 중인 페이지의 computed style 측정은 하지 않았다.
- **E2E 테스트를 실행하지 않았다.** `npm test`(vitest 단위·통합 1665건)는 실행했으나 Playwright E2E는 실행하지 않았다 — 이 워크트리에 `@playwright/test`가 설치되어 있지 않다(위 typecheck 오류의 원인이기도 하다). E2E는 `text-neutral-500/600`을 단언하지 않으므로(사전 확인 6번) 이 변경이 깨뜨릴 경로는 없다고 판단하나, **실행하지 않았다는 사실 자체가 gap이다**.
- **`prefers-contrast` / 강제 색 모드 / 다크 모드 렌더를 검사하지 않았다** — 저장소에 해당 분기가 없다.
- **`build`를 실행하지 않았다.** AC-009는 lint · typecheck · test 세 가지만 요구한다.

### 잔여 위험

1. `#6b6b6b` on `#f2f2f2` = 4.760:1은 AA 기준 4.5 대비 여유가 **0.26**뿐이다. `--color-bg`가 조금이라도 어두워지면 15개 지점이 한꺼번에 미달로 돌아선다.
2. AC-007의 검사 입도 한계 — «같은 행에 자기 배경 선언이 있는가»만 보므로, **중간 조상 요소**가 배경을 선언하는 형태는 잡지 못한다(acceptance.md AC-007 «검사의 한계»). 현재 트리에 그런 형태는 없으나 장래 도입 시 조용히 통과한다.
3. `text-neutral-500` 재도입을 기계적으로 막는 장치가 여전히 없다(범위 제외 — 후속 카드 권고 대상).
4. 시각적 계층이 5단계 → 4단계로 병합되었다(spec.md §1.3). 램프의 제약상 불가피하나, 3차 보조 정보와 정의 목록 레이블이 이제 같은 색이다.

---

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_status: audit-ready
run_complete_at: 2026-09-07
run_commits:
  m1: 274bf4e
  m2: 99e4b9a
  m3: pending-backfill-progress-commit
run_branch: WT-neutral-500-contrast
run_baseline_sha: 5b2881e061ed447ee9ff8589a764ec85c0855490
ac_pass_count: 9
ac_fail_count: 0
ac_pass_with_debt_count: 0
total_run_phase_files: 11        # src/ 10개 .tsx + spec.md frontmatter
src_files_changed: 10
globals_css_changed: false
new_warnings_or_lints_introduced: 0
typecheck_src_errors: 0
typecheck_error_set_delta: 0     # baseline 41건과 바이트 단위 동일
test_files_passed: 130
tests_passed: 1665
tests_failed: 0
m1_to_mN_commit_strategy: per-milestone   # M1은 AC-007 게이트로 분리
blocker: null
```

**SPEC-DESIGN-002 AC-005(c) 무효화 (acceptance.md §D.3 필수 명시 항목)**: 이 SPEC이 `ProductCard.tsx:52`를 `text-neutral-600`으로 교체함으로써, SPEC-DESIGN-002 `acceptance.md` AC-005(c)의 **파일 단위** grep(`grep -n "neutral-600" $(grep -rln "bg-surface" ...)`)은 이제 매치한다 — 같은 파일 48행에 `bg-surface`가 있기 때문이다. **실제 대비 결함이 아니다**: 52행 요소는 자기 자신의 불투명 `bg-neutral-100`(`#f5f5f5`) 위에 렌더되어 4.888:1로 AA를 통과한다(AC-006·AC-007로 확인). 원인은 검사의 입도다. SPEC-DESIGN-002는 `completed`이므로 **소급 수정하지 않았고**, 이 SPEC의 **AC-007이 요소/행 입도의 대체 검사**로 그 감시 의도를 계승한다(spec.md §4.1).

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
