# SPEC-DESIGN-003 — 인수 조건

> 각 AC는 이진 판정 가능하다. 판정 근거는 **실제로 실행한 명령의 축자 출력**이며, 추론이나 요약은 증적이 아니다.
> 증적 파일은 `.moai/state/verify/SPEC-DESIGN-003/` 아래에 남긴다(감사 시점에 경로가 해석되어야 한다).
>
> **`git diff` 기준점 (plan-phase baseline)**: 이 문서의 모든 `git diff`는 plan-phase baseline 커밋 **`5b2881e`**(전체 SHA `5b2881e061ed447ee9ff8589a764ec85c0855490` — 이 워크트리의 분기점 `origin/main`)에 **명시적으로 고정**한다. 기준점 없는 맨 `git diff`는 작업 트리와 인덱스만 비교하므로, run-phase가 마일스톤 단위로 커밋한 뒤(`plan.md` §F는 M1을 게이트로 분리해 커밋 지점을 만든다) 실행하면 **빈 출력**이 되어 AC-003·AC-005는 위양성 FAIL(기대 `10`/`17` 대신 `0`)하고 AC-004는 위양성 PASS한다. `git diff 5b2881e -- <path>`는 커밋 여부와 무관하게 baseline 대비 **누적** 변경을 보므로 실행 시점에 의존하지 않는다. AC 실행이 커밋보다 앞서야 한다는 암묵 전제를 두지 않는 것이 이 고정의 목적이다.

---

## §D. AC 매트릭스

| AC | 요약 | 대응 REQ | 심각도 |
|---|---|---|---|
| AC-001 | `src/**`에 `text-neutral-500` 잔존 0건 | REQ-DESIGN3-001 | blocking |
| AC-002 | 17개 지점이 전부 `text-neutral-600`, 총량 36→53 · 파일 17→22 | REQ-DESIGN3-002 | blocking |
| AC-003 | 변경 파일이 정확히 그 10개 `.tsx` | REQ-DESIGN3-006 | blocking |
| AC-004 | `src/app/globals.css` 무변경 (`@theme` 전체) | REQ-DESIGN3-004 | blocking |
| AC-005 | diff가 `text-neutral-500`→`text-neutral-600` 토큰 치환**만** | REQ-DESIGN3-006 | blocking |
| AC-006 | 지점별 실효 배경 위 대비 4.5:1 이상 (재측정) | REQ-DESIGN3-003 | blocking |
| AC-007 | surface 위 `neutral-600` 0건 — **요소 입도** 회귀 검사 | REQ-DESIGN3-005 | blocking |
| AC-008 | 대형 텍스트 예외 미해당 재확인 | REQ-DESIGN3-003 | blocking |
| AC-009 | 린트·타입체크·테스트 신규 실패 0건 | REQ-DESIGN3-007 | blocking |

---

### AC-001 — `text-neutral-500` 잔존 0건

**Given** 17개 지점 교체가 완료된 상태에서,
**When** 실행 코드 트리 전체에서 `text-neutral-500`을 검색하면,
**Then** 일치 건수가 **0**이어야 한다.

**검증 방법**:

```bash
grep -rn "text-neutral-500" --include="*.tsx" --include="*.ts" --include="*.css" --include="*.js" src/
echo "exit=$?"
```

**PASS 조건**: 출력 없음 + `exit=1`.

**범위 주의**: `.moai/specs/**`(이 SPEC 자신의 문서 포함)와 `.claude/agent-memory/**`에는 `text-neutral-500`이 **역사적·서술적 기록**으로 남는다. REQ-DESIGN3-001의 대상이 아니며 제거하지 않는다. 검색 범위를 `src/`로 한정하는 이유다.

---

### AC-002 — 17개 지점이 전부 `text-neutral-600`

**Given** 교체 전 `text-neutral-600`이 36건 / 17파일, `text-neutral-500`이 17건 / 10파일이었고 두 집합의 파일 교집합이 5개인 상태에서,
**When** 교체 후 `text-neutral-600` 사용처를 집계하고 spec.md §2.2 표의 17개 `file:line`과 대조하면,
**Then** 총량이 **53건**(36+17), 파일 수가 **22개**(17+10−5)여야 하고, §2.2 표의 17개 지점이 **하나도 빠짐없이** `text-neutral-600` 행으로 나타나야 한다.

**검증 방법**:

```bash
# (a) 총량
grep -rn "text-neutral-600" --include="*.tsx" src/ | wc -l

# (b) 파일 수
grep -rln "text-neutral-600" --include="*.tsx" src/ | wc -l

# (c) spec.md §2.2가 지목한 10개 파일 각각의 text-neutral-600 행 번호 열거.
#     행 단위 in-place 토큰 치환이므로 행 번호는 이동하지 않는다 — §2.2 표의
#     17개 행 번호가 이 출력에 전부 포함되어야 한다.
grep -n "text-neutral-600" \
  "src/app/(shop)/checkout/complete/[orderId]/page.tsx" \
  "src/app/(shop)/checkout/page.tsx" \
  "src/app/staff/orders/[orderId]/page.tsx" \
  "src/app/staff/products/ProductForm.tsx" \
  "src/components/cart/CartView.tsx" \
  "src/components/checkout/OrderSummary.tsx" \
  "src/components/orders/OrderLookupResultView.tsx" \
  "src/components/product/ProductCard.tsx" \
  "src/components/product/ProductDetailView.tsx" \
  "src/components/product/ProductGallery.tsx"
```

**기대 출력** (plan-phase 사전 측정 기반 — run-phase에서 재실행해 확인할 것):

```
(a) 53
(b) 22
(c) 아래 17개 행 번호가 모두 포함:
    checkout/complete/[orderId]/page.tsx  187, 224
    checkout/page.tsx                     122
    staff/orders/[orderId]/page.tsx       110, 147
    staff/products/ProductForm.tsx        264, 288, 341
    cart/CartView.tsx                     140, 175
    checkout/OrderSummary.tsx             87
    orders/OrderLookupResultView.tsx      84, 131
    product/ProductCard.tsx               52
    product/ProductDetailView.tsx         72, 124
    product/ProductGallery.tsx            42
```

**PASS 조건**: (a) `53`, (b) `22`, (c) 위 17개 `file:line`이 전부 출력에 존재. (c)의 출력에는 교체 전부터 있던 `text-neutral-600` 행도 함께 나타나며(5개 파일), 그것은 정상이다 — 판정 기준은 "17개가 모두 있는가"이지 "17개뿐인가"가 아니다.

---

### AC-003 — 변경 파일이 정확히 그 10개

**Given** 이 SPEC의 대상이 10개 `.tsx` 파일인 상태에서,
**When** 변경된 파일 목록을 확인하면,
**Then** `src/` 아래 변경 파일이 정확히 그 10개여야 하고, 그 외 `src/` 파일은 한 건도 변경되지 않아야 한다.

**검증 방법**:

```bash
# (a) src/ 아래 변경 파일 전체 (plan-phase baseline 5b2881e 대비 — 문서 서두 «git diff 기준점»)
git diff --name-only 5b2881e -- src/

# (b) 개수
git diff --name-only 5b2881e -- src/ | wc -l

# (c) 기대 목록과의 차집합 (양방향)
git diff --name-only 5b2881e -- src/ | sort > .moai/state/verify/SPEC-DESIGN-003/actual-files.txt
printf '%s\n' \
  'src/app/(shop)/checkout/complete/[orderId]/page.tsx' \
  'src/app/(shop)/checkout/page.tsx' \
  'src/app/staff/orders/[orderId]/page.tsx' \
  'src/app/staff/products/ProductForm.tsx' \
  'src/components/cart/CartView.tsx' \
  'src/components/checkout/OrderSummary.tsx' \
  'src/components/orders/OrderLookupResultView.tsx' \
  'src/components/product/ProductCard.tsx' \
  'src/components/product/ProductDetailView.tsx' \
  'src/components/product/ProductGallery.tsx' | sort > .moai/state/verify/SPEC-DESIGN-003/expected-files.txt
diff .moai/state/verify/SPEC-DESIGN-003/expected-files.txt .moai/state/verify/SPEC-DESIGN-003/actual-files.txt
echo "exit=$?"
```

**PASS 조건**: (b) `10`, (c) 출력 없음 + `exit=0`.

---

### AC-004 — `globals.css` 무변경

**Given** 이 SPEC이 소비처 교체 카드이고 토큰 값 변경을 명시적으로 배제한 상태에서(REQ-DESIGN3-004),
**When** `src/app/globals.css`의 변경 여부를 확인하면,
**Then** 이 파일은 **한 바이트도** 변경되지 않아야 하고, `--color-neutral-500`은 여전히 `#989898`이어야 한다.

**검증 방법**:

```bash
# (a) 변경 목록에 없어야 함 (plan-phase baseline 5b2881e 대비 — 문서 서두 «git diff 기준점»)
git diff --name-only 5b2881e -- src/app/globals.css
echo "exit=$?"

# (b) 토큰 값 직접 확인 (SPEC-DESIGN-002가 남긴 값 그대로)
grep -n "color-neutral-400\|color-neutral-500\|color-neutral-600" src/app/globals.css
```

**PASS 조건**:
- (a) 출력 없음 (`git diff --name-only`는 대상 없으면 `exit=0`이므로 **출력 유무로 판정**한다 — 종료 코드로 판정하지 않는다). 기준점 `5b2881e` 고정이 여기서 특히 중요하다: 맨 `git diff`는 run-phase 커밋 이후 항상 빈 출력이 되므로 `globals.css`가 실제로 변경되었더라도 이 AC가 **위양성 PASS**한다.
- (b) `--color-neutral-400: #b7b7b7; --color-neutral-500: #989898; --color-neutral-600: #6b6b6b;` 행이 그대로 존재

---

### AC-005 — diff가 토큰 치환만 (범위 가드)

**Given** 이 SPEC의 변경이 `className` 문자열 안 토큰 하나의 치환뿐이어야 하는 상태에서(REQ-DESIGN3-006),
**When** 제거된 행 전체에 `text-neutral-500`→`text-neutral-600` 치환을 적용한 결과를 추가된 행 전체와 대조하면,
**Then** 두 집합이 **정확히 일치**해야 한다. 일치하지 않는 행이 하나라도 있으면 그것은 토큰 치환 이외의 변경이다.

**검증 방법**:

```bash
mkdir -p .moai/state/verify/SPEC-DESIGN-003

# 제거된 행 → 토큰 치환 적용 (plan-phase baseline 5b2881e 대비 — 문서 서두 «git diff 기준점»)
git diff -U0 5b2881e -- src/ | grep '^-' | grep -v '^---' | sed 's/^-//' \
  | sed 's/text-neutral-500/text-neutral-600/g' \
  > .moai/state/verify/SPEC-DESIGN-003/removed-substituted.txt

# 추가된 행
git diff -U0 5b2881e -- src/ | grep '^+' | grep -v '^+++' | sed 's/^+//' \
  > .moai/state/verify/SPEC-DESIGN-003/added.txt

diff .moai/state/verify/SPEC-DESIGN-003/removed-substituted.txt .moai/state/verify/SPEC-DESIGN-003/added.txt
echo "exit=$?"

# 보조: 제거·추가 행 수가 각각 17인지
wc -l < .moai/state/verify/SPEC-DESIGN-003/removed-substituted.txt
wc -l < .moai/state/verify/SPEC-DESIGN-003/added.txt
```

**PASS 조건**: `diff` 출력 없음 + `exit=0`, 그리고 두 `wc -l`이 각각 **17**.

**이 검사가 강한 이유**: 파일 목록(AC-003)이나 토큰 개수(AC-002)와 달리, 이 검사는 "바뀐 것이 **오직** 그 토큰인가"를 직접 판정한다. 공백 조정, 클래스 순서 변경, 주석 손질 같은 부수 변경이 한 건이라도 섞이면 `diff`가 그 행을 출력한다.

---

### AC-006 — 지점별 실효 배경 위 대비 (재측정)

**Given** 17개 지점 중 15건이 `--color-bg`(`#f2f2f2`), 2건이 `bg-neutral-100`(`#f5f5f5`) 위에 렌더되는 상태에서(spec.md §2.2),
**When** WCAG 2.1 상대 휘도 공식으로 `#6b6b6b`의 두 배경 대비를 실제로 계산하면,
**Then** **두 값 모두 4.5:1 이상**이어야 하고, 교체 전 값 `#989898`은 같은 계산에서 두 배경 모두 4.5:1 **미만**임이 함께 확인되어야 한다.

**검증 방법**: 아래 스크립트를 저장소 안 임시 경로에 작성해 `node`로 실행하고, 출력 전문을 `progress.md` §E.2에 인용한다. 실행 후 스크립트는 삭제한다(저장소에 남기지 않는다).

```js
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function ratio(a, b) { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); }
// 17개 지점이 실제로 렌더되는 배경은 이 둘뿐이다(spec.md §2.1 전수 인벤토리).
const bgs = [['--color-bg(15 sites)', '#f2f2f2'], ['bg-neutral-100(2 sites)', '#f5f5f5']];
// surface는 도달 불가능하지만 AC-007의 근거 수치로 함께 출력한다.
const ref = ['--color-surface(unreachable)', '#e9e9e9'];
for (const be of bgs.concat([ref])) {
  for (const fg of ['#989898', '#6b6b6b']) {
    const r = ratio(fg, be[1]);
    console.log(fg + ' on ' + be[0].padEnd(28) + be[1] + ' => ' + r.toFixed(3) + ':1 ' + (r >= 4.5 ? 'PASS' : 'FAIL'));
  }
}
```

**기대 출력** (plan-phase 사전 측정치 — run-phase에서 재실행해 확인할 것):

```
#989898 on --color-bg(15 sites)         #f2f2f2 => 2.577:1 FAIL
#6b6b6b on --color-bg(15 sites)         #f2f2f2 => 4.760:1 PASS
#989898 on bg-neutral-100(2 sites)      #f5f5f5 => 2.646:1 FAIL
#6b6b6b on bg-neutral-100(2 sites)      #f5f5f5 => 4.888:1 PASS
#989898 on --color-surface(unreachable) #e9e9e9 => 2.376:1 FAIL
#6b6b6b on --color-surface(unreachable) #e9e9e9 => 4.389:1 FAIL
```

**PASS 조건**: `#6b6b6b` on `#f2f2f2` 행과 `#6b6b6b` on `#f5f5f5` 행이 **둘 다 `PASS`**. `#6b6b6b` on `#e9e9e9`의 `FAIL`은 **기대된 결과**이며 이 AC를 실패시키지 않는다 — 그 조합의 도달 불가능성은 AC-007이 별도로 판정한다.

---

### AC-007 — surface 위 `neutral-600` 0건 (요소 입도 회귀 검사)

**Given** `#6b6b6b` on `#e9e9e9`가 4.389:1로 AA에 미달하고(AC-006), 이 SPEC이 `ProductCard.tsx`(`bg-surface`를 조상으로 갖는 유일한 대상 파일)에 `text-neutral-600`을 도입하는 상태에서,
**When** `bg-surface`를 쓰는 파일들 안의 모든 `text-neutral-600` 행이 **자기 자신의 불투명 배경을 선언하는지** 검사하면,
**Then** 자기 배경 없이 `text-neutral-600`을 쓰는 행이 **0건**이어야 한다.

**검증 방법**:

```bash
# (a) bg-surface 소비처 열거
grep -rln "bg-surface" --include="*.tsx" src/

# (b) 그 파일들 안의 text-neutral-600 행 열거 (정보용 — 이 자체는 판정이 아니다)
grep -n "text-neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)

# (c) 판정: (b)의 행 중 같은 행에서 자기 불투명 배경을 선언하지 않는 행
grep -n "text-neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/) \
  | grep -v "bg-neutral-\|bg-bg\|bg-white"
echo "exit=$?"
```

**기대 출력**:

```
(a) src/components/layout/SiteHeader.tsx
    src/components/product/ProductCard.tsx
(b) src/components/product/ProductCard.tsx:52:          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-600"
(c) (출력 없음) exit=1
```

**PASS 조건**: (c) 출력 없음 + `exit=1`.

**이 AC가 SPEC-DESIGN-002 AC-005(c)를 대체한다**: SPEC-DESIGN-002의 검사는 **파일 단위** grep(`grep -n "neutral-600" $(grep -rln "bg-surface" ...)`)이라, 이 SPEC이 `ProductCard.tsx:52`를 교체하는 순간 위양성으로 FAIL한다 — 같은 파일에 `bg-surface`와 `neutral-600`이 공존하지만, 52행 텍스트는 자기 자신의 `bg-neutral-100` 위에 렌더되므로 실제 결함이 아니다(spec.md §2.3(b), §4.1). 위 (c)는 판정 입도를 **행/요소 단위**로 낮춰 그 구분을 기계적으로 수행한다. SPEC-DESIGN-002는 `completed`이므로 소급 수정하지 않고, 이 AC가 감시 의도를 계승한다.

**검사의 한계 (정직한 기술)**: (c)는 "같은 `className` 문자열에 자기 배경이 있는가"를 본다. 배경 선언이 **중간 조상 요소**에 있는 경우(같은 행이 아닌)는 잡아내지 못하므로 위양성을 낼 수 있다. 현재 트리에서는 그런 형태가 존재하지 않는다(spec.md §2.1 전수 인벤토리로 확인). 위양성이 발생하면 그것은 검사 실패가 아니라 **사람이 §2.1 인벤토리를 갱신해 판단할 신호**다.

---

### AC-008 — 대형 텍스트 예외 미해당 재확인

**Given** WCAG 대형 텍스트 예외(≥18.66px bold 또는 ≥24px)에 해당하면 3.0:1 기준이 적용되어 판정이 달라지는 상태에서,
**When** 교체된 17개 지점의 굵기·크기 클래스를 검사하면,
**Then** 굵기 클래스를 가진 지점이 **0건**이어야 하고, 크기는 `text-xs`(12px) 11건 · `text-sm`(14px) 3건 · 상속 3건이어야 하며, 상속 3건의 조상이 `text-sm`이어야 한다.

**검증 방법**:

```bash
# (a) 굵기 클래스 보유 건수 — 검색 범위를 §2.2가 지목한 10개 대상 파일로 한정한다(AC-002 (c)와 동일 목록).
#     전역 검색은 교체 전부터 있던 text-neutral-600 36건의 잡음을 포함해 이진 판정을 깨뜨린다 — 아래 «범위 한정 근거» 참조.
grep -n "text-neutral-600" \
  "src/app/(shop)/checkout/complete/[orderId]/page.tsx" \
  "src/app/(shop)/checkout/page.tsx" \
  "src/app/staff/orders/[orderId]/page.tsx" \
  "src/app/staff/products/ProductForm.tsx" \
  "src/components/cart/CartView.tsx" \
  "src/components/checkout/OrderSummary.tsx" \
  "src/components/orders/OrderLookupResultView.tsx" \
  "src/components/product/ProductCard.tsx" \
  "src/components/product/ProductDetailView.tsx" \
  "src/components/product/ProductGallery.tsx" \
  | grep -c "font-bold\|font-semibold\|font-medium"

# (b) 상속 3건(#2 #5 #13)의 조상 <address> 크기 클래스
grep -n "<address" \
  "src/app/(shop)/checkout/complete/[orderId]/page.tsx" \
  "src/app/staff/orders/[orderId]/page.tsx" \
  src/components/orders/OrderLookupResultView.tsx
```

**기대 출력**:

```
(a) 0
(b) checkout/complete/[orderId]/page.tsx:216 / staff/orders/[orderId]/page.tsx:139 / OrderLookupResultView.tsx:123 — 세 행 모두 text-sm 포함
```

**PASS 조건**:
- (a) 출력이 정확히 **`0`**. 이진 판정이며 수동 대조 단계가 없다. `0`이 아니면 FAIL — 그 행은 10개 대상 파일 안에 있으므로 정의상 이 SPEC의 범위이고, 대형 텍스트 예외 판정을 다시 해야 한다.
- (b) 세 `<address>`가 모두 `text-sm`을 포함 (기대: 각각 216행 / 139행 / 123행)

**범위 한정 근거 (plan-phase 사전 측정)**: 전역 검색(`grep -rn ... src/`)으로 같은 판정을 하면 출력이 `0`이 아니라 **`2`**가 된다. 두 행은 모두 10개 대상 파일 **밖**이다:

```
src/app/staff/orders/page.tsx:120:          className={!status ? "font-semibold text-neutral-900" : "text-neutral-600"}
src/app/staff/orders/page.tsx:128:            className={status === s ? "font-semibold text-neutral-900" : "text-neutral-600"}
```

`src/app/staff/orders/page.tsx`는 이 SPEC의 10개 대상(`src/app/staff/orders/[orderId]/page.tsx`와 다른 파일)이 아니며, 두 행 모두 삼항 표현이라 `font-semibold`는 `text-neutral-900` 분기에 붙는다 — `text-neutral-600` 분기는 굵기 클래스를 갖지 않는다. 행 단위 grep이 한 줄에 공존하는 두 분기를 구분하지 못해 생기는 잡음이므로, 범위를 10개 파일로 한정해 이진성을 회복한다.

**근거**: 최대 14px, 전부 normal weight → 예외 미해당 → AA 일반 텍스트 4.5:1이 17건 전부에 적용된다. AC-006의 판정 기준이 4.5:1인 이유다.

---

### AC-009 — 품질 게이트 회귀 0건

**Given** 이 변경이 `className` 문자열 토큰 치환뿐인 상태에서,
**When** 린트·타입체크·테스트를 실행하면,
**Then** 이 변경으로 인한 **신규** 실패가 0건이어야 한다.

**검증 방법** (워크트리 환경 스크럽 — 한 번의 compound invocation):

```bash
unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm run lint
unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm run typecheck
unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm test
```

**PASS 조건**:
- `npm run lint` — 신규 오류 0건
- `npm run typecheck` — **사전 존재 baseline 분류 필수**: SPEC-DESIGN-002 §E.2가 기록한 대로 `e2e/*.spec.ts` · `e2e/support/*.ts` · `playwright.config.ts`에서 `@playwright/test` 타입 선언 누락(TS2307)·암묵적 any(TS7031/TS7006) 오류가 사전 존재한다. 이 카드의 diff는 `src/` 아래 10개 `.tsx`뿐이므로 `e2e/` 오류는 pre-existing으로 분류하고, **`src/` 아래에서 발생한 오류만** 신규로 판정한다. `src/` 오류가 1건이라도 있으면 FAIL.
- `npm test` — 기존 스위트 전부 통과. 사전 확인 결과 `tests/`·`e2e/`에 `neutral-500`/`neutral-600`을 참조하는 단언은 **0건**이므로(plan.md §C), 클래스 치환이 테스트를 깨뜨릴 경로는 없다. 깨진다면 그것은 예상 밖 결합이며 조사 대상이다.

**신규 테스트를 추가하지 않는 이유**: 이 변경은 Tailwind 유틸리티 클래스 문자열 치환이며, 렌더 결과의 색상은 CSS 빌드 산출물이 결정한다. 클래스 문자열을 단언하는 테스트는 구현 결합(implementation coupling)이 되어 `quality.yaml`의 `test_quality.avoid_implementation_coupling: true`에 어긋난다. 검증은 AC-001~AC-008의 명령 기반 판정이 담당한다.

---

## §D.1 엣지 케이스

| 케이스 | 처리 |
|---|---|
| `ProductCard.tsx`가 `bg-surface`와 `text-neutral-600`을 같은 파일에 갖게 됨 | **의도된 것이며 결함이 아니다.** 52행 요소가 자기 불투명 배경(`bg-neutral-100`)을 선언하므로 surface 위에 렌더되지 않는다(spec.md §2.3(b)). AC-007 (c)가 행 단위로 구분해 판정한다 |
| SPEC-DESIGN-002 AC-005(c)가 이제 FAIL함 | 인지된 결과(spec.md §4.1). SPEC-DESIGN-002는 `completed`이므로 소급 수정하지 않는다. AC-007이 더 정확한 입도로 감시 의도를 계승하며, 이 사실은 완료 보고에 명시한다(§D.3) |
| 5단계 텍스트 계층이 4단계로 병합됨 | **불가피하다.** 램프에 `neutral-500`과 `neutral-600` 사이 AA 통과 단계가 없다(spec.md §1.3). 계층 보존은 토큰 추가를 요구하므로 범위 밖 |
| `text-neutral-600` 총량 AC(53건)가 다른 카드의 병렬 변경으로 어긋남 | 이 워크트리는 `origin/main`(`5b2881e`)에서 분기했고 이 카드만 `src/`를 건드린다. 어긋나면 병렬 세션 경합 신호이므로 **재측정 후 판정**하며, 숫자를 임의로 조정하지 않는다 |
| `bg-neutral-100` 위 2건의 대비가 페이지 배경보다 높음 | 정상. `#f5f5f5`가 `#f2f2f2`보다 밝아 대비가 4.888:1로 더 여유롭다. 별도 처리 불필요 |
| `CartView.tsx:175`의 `hover:text-red-600` 상태 색 | 범위 밖(spec.md §4 마지막 항목). 이 SPEC은 기본 상태의 `text-neutral-500`만 교체하며 `hover:` 접두 유틸리티는 건드리지 않는다 |

---

## §D.2 품질 게이트

- 린트 통과 (`npm run lint`)
- 타입체크 — `src/` 아래 신규 오류 0건 (`e2e/` 사전 존재 baseline 제외, AC-009)
- 기존 테스트 스위트 회귀 0건 (`npm test`)

신규 테스트는 추가하지 않는다(사유: AC-009 말미).

---

## §D.3 Definition of Done

- [ ] AC-001 ~ AC-009 전부 PASS, 각 판정의 축자 명령 출력이 `progress.md` §E.2에 인용됨
- [ ] `src/` 아래 변경 파일이 정확히 10개 `.tsx` (AC-003)
- [ ] `src/app/globals.css` 무변경 — `--color-neutral-500: #989898` 보존 확인 (AC-004)
- [ ] `.moai/design/tokens.json` 무변경 (범위 제외 준수 확인)
- [ ] 린트·타입체크·테스트 통과, `e2e/` 타입 오류는 pre-existing baseline으로 명시 분류 (AC-009)
- [ ] **SPEC-DESIGN-002 AC-005(c)가 이 SPEC에 의해 무효화되었다는 사실이 완료 보고에 명시됨** — 대체 검사는 이 문서의 AC-007이며, SPEC-DESIGN-002는 소급 수정하지 않는다 (spec.md §4.1)
- [ ] SPEC-DESIGN-002 §4.1 후속 카드 권고 중 **미해소로 남는 3건**(1번 `tokens.json` 재동기화 · 2번 `globals.css` 헤더 주석 재작성 · 4번 SPEC-BRAND-001 amendment 검토)이 완료 보고에 명시됨 — 이 카드는 3번만 해소한다
- [ ] 이 SPEC이 새로 권고하는 후속 카드(색상 유틸리티 사용 규율의 기계적 강제 — spec.md §4 `### Out of Scope — 회귀 방지 린트 규칙 도입`)가 완료 보고에 명시됨
