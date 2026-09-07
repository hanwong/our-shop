# SPEC-DESIGN-003 — 구현 계획

> `spec.md`가 SSOT. 이 문서는 파생 산출물이며 요구사항을 재정의하지 않는다.

---

## §A. 맥락

카드 t67. 워크트리 `.claude/worktrees/t67`, 브랜치 `WT-neutral-500-contrast`, 분기점 `origin/main` = `5b2881e`(SPEC-DESIGN-002 머지 완료 상태).

10개 `.tsx` 파일 17개 지점에서 `text-neutral-500` → `text-neutral-600` 토큰을 치환한다. **소비처 교체이며 토큰 값 변경이 아니다** — `src/app/globals.css`는 한 바이트도 건드리지 않는다.

이 카드는 SPEC-DESIGN-002 §4.1 후속 카드 권고 3번의 이행이다. 접근 방식(토큰 값 변경이 아닌 소비처 교체)은 그 SPEC에서 이미 검토·확정되었으므로 재론하지 않는다. 이 카드의 plan-phase 실질 작업은 **"17개 지점이 정말 같은 배경 위에 있는가"를 전수 확인하는 것**이었고, 그 결과가 spec.md §2다.

### A.1 Tier 판정 근거 (경계 사례 — 명시 기록)

이 카드는 Tier S와 M 사이 경계에 있고, 두 신호가 **서로 다른 방향을 가리킨다**:

| 신호 | 측정값 | Tier S 기준 | Tier M 기준 | 가리키는 Tier |
|---|---|---|---|---|
| 변경 LOC | 17행 (지점당 토큰 1개) | < 300 | 300–1000 | **S** |
| 변경 파일 수 | 10개 | < 5 | 5–15 | **M** |

임계값 ±1의 경계가 아니라 **신호 간 충돌**이다(LOC는 S 구간의 아래쪽 끝, 파일 수는 M 구간의 한가운데). 따라서 "경계에서는 단순한 쪽" 규칙이 그대로 적용되지 않으며, 판단이 필요하다. **Tier M으로 분류한다.** 근거 셋:

1. **LOC가 위험을 과소평가한다.** 이 변경의 위험은 분량이 아니라 **분포**에 있다 — 결제 완료·주문서·장바구니·상품 상세·상품 목록·관리자 주문·관리자 상품 폼까지 7개 사용자 화면에 걸친 10개 독립 렌더 표면이다. 17행이라는 숫자는 그 폭을 담지 못한다.
2. **AC가 지점별 표를 요구한다.** spec.md §2.2의 17행 배경·크기 매트릭스와 AC-002/AC-007의 지점별 판정은 Tier S가 요구하는 "spec.md §3 인라인 AC" 형식에 담기 어렵다. 독립 `acceptance.md`가 필요하다.
3. **동일 도메인 선례와의 정합.** 자매 카드 SPEC-DESIGN-002는 **1파일 1행** 변경이면서 Tier M이었다. 10파일 17행 카드를 그보다 낮은 Tier로 분류하는 것은 저장소 안에서 일관되지 않는다.

`tier: M` → 산출물 3종(spec.md · plan.md · acceptance.md) + progress.md, plan-auditor PASS 임계 **0.80**, REQ 상한 16 / AC 상한 16(실제: REQ 7건 · AC 9건).

---

## §B. 알려진 이슈

### B.1 이 SPEC이 SPEC-DESIGN-002의 회귀 검사를 무효화한다

SPEC-DESIGN-002 `acceptance.md` AC-005(c)는 파일 단위 grep이다:

```bash
grep -n "neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
# PASS 조건: 출력 없음 + exit=1
```

`ProductCard.tsx:52`를 교체하는 순간 이 검사는 매치한다 — 같은 파일 48행에 `bg-surface`가 있기 때문이다. **실제 대비 결함은 아니다**(52행은 자기 `bg-neutral-100` 위에 렌더). 원인은 검사의 입도다.

**대응**: SPEC-DESIGN-002를 소급 수정하지 않고(그 SPEC은 `completed`, `completed → in-progress (amendment)` 전이를 개시하지 않는다), 이 SPEC의 AC-007이 **행/요소 입도**의 대체 검사를 정의한다. 자세한 서술은 spec.md §4.1.

### B.2 `neutral-500`/`neutral-600`을 단언하는 기존 테스트는 없다 (측정 확인)

```
$ grep -rn "neutral-500" tests/ e2e/   → exit=1 (0건)
$ grep -rn "neutral-600" tests/ e2e/   → exit=1 (0건)
```

클래스 문자열 치환이 테스트를 깨뜨릴 경로가 없다는 뜻이다. `tests/unit/components/product-card.test.tsx:96`이 `product-card-placeholder` testid를 쓰지만 **존재 여부만** 단언하며 클래스는 보지 않는다.

### B.3 `typecheck` 사전 존재 baseline

`npm run typecheck`는 `e2e/` 아래에서 28건의 오류(`@playwright/test` 타입 선언 누락 TS2307, 암묵적 any TS7031/TS7006)를 이미 낸다 — SPEC-DESIGN-002 progress.md §E.2가 기록한 사전 존재 상태다. 이 카드의 diff는 `src/` 아래뿐이므로 `e2e/` 오류는 pre-existing으로 분류하고 **`src/` 오류만 신규로 판정**한다(AC-009).

### B.4 병렬 세션 경합

이 워크트리는 `origin/main` `5b2881e`에서 분기했다. AC-002의 기대값(53건 / 22파일)은 그 시점 측정에 근거하므로, 다른 세션이 `src/`에 `text-neutral-600`을 추가하면 어긋난다. 어긋나면 숫자를 조정하지 말고 **경합 신호로 보고 재측정**한다.

---

## §C. 사전 확인 (Pre-flight)

착수 전 아래를 실행하고 출력을 인용한다. 전부 plan-phase에서 이미 1회 실행했으며, run-phase에서 재실행해 baseline이 유지되는지 확인한다.

```bash
# 1. 대상 지점 총량 (기대: 10파일 / 17건)
grep -rln "text-neutral-500" --include="*.tsx" src/ | wc -l
grep -rn  "text-neutral-500" --include="*.tsx" src/ | wc -l

# 2. neutral-500이 텍스트 색으로만 쓰이는지 (기대: text-neutral-500 17건이 전부)
grep -rho "\(text\|border\|bg\|ring\|placeholder\|divide\|decoration\|from\|to\|via\|fill\|stroke\|shadow\|outline\|accent\|caret\)-neutral-500" \
  --include="*.tsx" --include="*.ts" --include="*.css" src/ | sort | uniq -c

# 3. 교체 전 neutral-600 baseline (기대: 36건 / 17파일)
grep -rn  "text-neutral-600" --include="*.tsx" src/ | wc -l
grep -rln "text-neutral-600" --include="*.tsx" src/ | wc -l

# 4. bg-* 전수 인벤토리 (spec.md §2.1 표와 대조 — 새 bg가 생겼는지)
grep -rno "bg-[a-z0-9-]*" --include="*.tsx" src/

# 5. SPEC-DESIGN-002 AC-005(c)의 교체 전 상태 (기대: 출력 없음 exit=1)
grep -n "neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
echo "exit=$?"

# 6. 테스트 결합 확인 (기대: 양쪽 0건)
grep -rn "neutral-500\|neutral-600" tests/ e2e/
echo "exit=$?"

# 7. 토큰 정의 baseline
grep -n "color-neutral-500\|color-neutral-600\|color-bg\|color-surface" src/app/globals.css
```

4번에서 spec.md §2.1 인벤토리에 없는 새 `bg-*` 지점이 발견되면 **교체를 진행하지 말고** 해당 지점이 17개 대상의 조상인지 먼저 판정한다 — 균일 교체의 전제가 그 인벤토리이기 때문이다.

---

## §D. 제약

1. `src/app/globals.css`는 **읽기 전용**이다. `@theme` 블록의 어떤 값도, 어떤 주석도 변경하지 않는다(REQ-DESIGN3-004).
2. 변경은 `className` 문자열 안 `text-neutral-500` → `text-neutral-600` **토큰 치환뿐**이다. 같은 `className`의 다른 유틸리티 순서·공백을 건드리지 않는다(REQ-DESIGN3-006, AC-005가 직접 판정).
3. 마크업 구조·컴포넌트 로직·주석 산문을 변경하지 않는다. 지점 옆 주석에 `neutral-500`이 언급되어도 그대로 둔다.
4. `.moai/design/tokens.json`, `globals.css` 4-11행 헤더 주석, `SPEC-DESIGN-002` 산출물을 건드리지 않는다.
5. 신규 테스트를 추가하지 않는다(사유: acceptance.md AC-009 말미 — 클래스 문자열 단언은 구현 결합).
6. `hover:`/`focus:` 등 상태 접두 유틸리티는 대상이 아니다.
7. 17개 지점 전부 **동일하게** `text-neutral-600`으로 간다. 지점별로 다른 단계를 고르지 않는다(REQ-DESIGN3-002).

---

## §E. 자기 검증

`acceptance.md` §D의 **AC-001..AC-009** 전부를 실행하고 각 명령의 축자 출력을 `progress.md` §E.2에 기록한다. 요약이나 "통과함" 서술은 증적이 아니다.

증적 파일(`AC-003` / `AC-005`가 생성)은 `.moai/state/verify/SPEC-DESIGN-003/` 아래에 남긴다.

---

## §F. 마일스톤

> **가변성 높은 결정을 먼저.** M1은 이 카드에서 **유일하게 판단이 틀릴 수 있는 지점**을 격리해 먼저 검증한다. M2·M3은 그 판단이 확인된 뒤의 기계적 작업이다.

### M1 — `ProductCard.tsx` 단독 교체 + AC-007 즉시 실행 (유일한 판단 지점)

**대상**: `src/components/product/ProductCard.tsx` 52행 **1건만**

```diff
-          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500"
+          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-600"
```

**왜 이 한 건을 먼저 분리하는가**: `ProductCard.tsx`는 17개 지점 중 **유일하게 `bg-surface`를 조상으로 갖는** 파일이다. "자식의 불투명 배경이 조상 surface를 가리므로 안전하다"는 판단(spec.md §2.3(b))이 이 카드에서 유일하게 틀릴 수 있는 명제이고, 동시에 SPEC-DESIGN-002 회귀 검사를 무효화하는 원인이다(§B.1). 이 한 건을 먼저 넣고 **AC-007을 즉시 실행**하면, 나머지 16건을 건드리기 전에 그 판단과 대체 검사 설계가 함께 검증된다.

**M1 직후 실행**:

```bash
# AC-007 (c) — 대체 회귀 검사가 실제로 통과하는가
grep -n "text-neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/) \
  | grep -v "bg-neutral-\|bg-bg\|bg-white"
echo "exit=$?"
```

**게이트**: 출력이 있으면 **M2로 진행하지 않는다**. 출력된 행이 정말 surface 위에 렌더되는지 재검토하고, 그렇다면 그 지점은 `text-neutral-700`으로 가야 하므로 REQ-DESIGN3-002의 균일 교체 전제가 깨진다 — spec.md §2로 돌아가 blocker report를 낸다.

### M2 — 나머지 9개 파일 16개 지점 교체 (기계적)

M1의 게이트를 통과한 뒤 실행한다. spec.md §2.2 표의 나머지 16개 지점을 파일 단위로 교체한다.

| 파일 | 지점 (행) | 건수 |
|---|---|---|
| `src/app/(shop)/checkout/complete/[orderId]/page.tsx` | 187, 224 | 2 |
| `src/app/(shop)/checkout/page.tsx` | 122 | 1 |
| `src/app/staff/orders/[orderId]/page.tsx` | 110, 147 | 2 |
| `src/app/staff/products/ProductForm.tsx` | 264, 288, 341 | 3 |
| `src/components/cart/CartView.tsx` | 140, 175 | 2 |
| `src/components/checkout/OrderSummary.tsx` | 87 | 1 |
| `src/components/orders/OrderLookupResultView.tsx` | 84, 131 | 2 |
| `src/components/product/ProductDetailView.tsx` | 72, 124 | 2 |
| `src/components/product/ProductGallery.tsx` | 42 | 1 |
| — | **합계** | **16** |

각 지점은 `text-neutral-500`을 `text-neutral-600`으로 바꾸는 것뿐이다. 같은 `className`의 다른 토큰·공백·순서는 그대로 둔다.

**행 번호 주의**: in-place 토큰 치환이므로 행 수가 변하지 않는다 — 위 행 번호는 교체 후에도 유효하며, AC-002 (c)가 그 전제를 확인한다.

### M3 — 전체 검증 + 증적 기록 (기계적)

`acceptance.md` §D의 AC-001..AC-009를 순서대로 실행하고 축자 출력을 수집해 `progress.md` §E.2에 기록한 뒤 §E.3 audit-ready 신호를 작성한다.

AC-003·AC-005가 생성하는 증적 파일을 위해 먼저:

```bash
mkdir -p .moai/state/verify/SPEC-DESIGN-003
```

완료 보고에는 `acceptance.md` §D.3의 마지막 세 항목(SPEC-DESIGN-002 AC-005(c) 무효화 명시 · 미해소 후속 카드 3건 · 신규 후속 카드 권고 1건)을 반드시 포함한다.

---

## §G. 안티패턴 (하지 말 것)

| 안티패턴 | 왜 금지인가 |
|---|---|
| `--color-neutral-500` 값을 낮춰 "한 곳만 고치기" | SPEC-DESIGN-002 §3이 두 근거로 기각한 대안이다(REQ-BRAND-008 되돌림 + 램프 양측 재계산). 사용자 확인으로도 소비처 교체가 확정되어 있다. AC-004가 직접 차단한다 |
| 안전 여유를 이유로 전부 `text-neutral-700`으로 상향 | 측정상 불필요하고(17건 전부 `neutral-600`이 AA 통과), §1.3의 계층을 한 단계 더 무너뜨린다. spec.md §4 두 번째 Out of Scope 항목 |
| `ProductCard.tsx:52`를 `neutral-700`으로 올려 DESIGN-002 AC-005(c)를 "통과시키기" | 존재하지 않는 결함을 피하려고 실제 렌더 색을 바꾸는 것이다. 그 AC는 **검사가 부정확**한 것이지 코드가 틀린 것이 아니다(spec.md §4.1). AC-007이 올바른 입도의 대체 검사다 |
| SPEC-DESIGN-002 `acceptance.md`를 열어 AC-005(c)를 고치기 | 그 SPEC은 `completed`다. 소급 수정은 `completed → in-progress (amendment)` 전이를 요구하며 이 카드가 개시하지 않는다 |
| 교체하는 김에 근처 클래스 정리·공백 정돈 | AC-005의 diff 대조가 즉시 FAIL한다. 범위 규율 위반이며, 이 카드의 diff가 "토큰 치환뿐"이라는 성질이 유일한 리뷰 보증이다 |
| 클래스 문자열을 단언하는 회귀 테스트 추가 | `quality.yaml`의 `test_quality.avoid_implementation_coupling: true`에 어긋난다. 검증은 명령 기반 AC가 담당한다 |
| 소비처에 색상 리터럴 하드코딩 | 토큰 체계의 존재 이유를 무효화한다 |
| M1 게이트를 건너뛰고 10개 파일을 한 번에 교체 | 판단이 틀렸을 경우 16건을 되돌려야 한다. M1 분리는 그 되돌림 비용을 1건으로 묶는 장치다 |

---

## §H. 상호 참조

- `spec.md` — 요구사항 SSOT (§2 지점별 배경 측정, §4.1 DESIGN-002 무효화)
- `acceptance.md` — AC-001..AC-009 및 검증 명령
- `.moai/specs/SPEC-DESIGN-002/spec.md` §3 · §4.1 — 이 카드의 발주 근거와 기각된 대안
- `.moai/specs/SPEC-DESIGN-002/acceptance.md` AC-005 (c) — 이 카드가 무효화하는 검사
- `.moai/specs/SPEC-DESIGN-002/progress.md` §E.2 — `typecheck` 사전 존재 baseline의 원 기록
- `src/app/globals.css` `@theme` — 무변경 대상
- `src/app/layout.tsx:126` — `<body className="bg-bg text-text">`, 기본 배경 단일 출처
