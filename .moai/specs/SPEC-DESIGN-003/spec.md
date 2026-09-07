---
id: SPEC-DESIGN-003
title: "text-neutral-500 소비처 17개 지점을 neutral-600으로 교체 (WCAG AA 확보)"
version: "0.1.0"
status: completed
created: 2026-09-07
updated: 2026-09-07
author: snake
priority: P2
phase: "v0.4.0 target"
module: "src/components, src/app"
lifecycle: spec-anchored
tags: "accessibility, wcag, contrast, design-tokens, consumer-swap, tailwind"
tier: M
depends_on: [SPEC-DESIGN-002]
related_specs: [SPEC-BRAND-001, SPEC-DESIGN-001]
---

## HISTORY

### v0.1.0 (2026-09-07)
- 최초 작성. 카드 t67.
- **이 SPEC은 SPEC-DESIGN-002가 명시적으로 예약한 후속 카드다.** SPEC-DESIGN-002 §4.1 후속 카드 권고 표의 3번 항목("`text-neutral-500` 소비처 17개 지점을 `neutral-600` 이하로 교체")이 곧 이 카드이며, 그 권고는 `.moai/specs/SPEC-DESIGN-002/spec.md` §3 첫 항목(`### Out of Scope — neutral-400 / neutral-500 및 나머지 램프 단계`)의 **전방 포인터**로 확정되어 있다. 그 항목은 "`neutral-500`의 본문 텍스트 사용은 이미 발견되었으므로 후속 카드가 **필수**"라고 못 박았다.
- **토큰 값 변경 대안은 이미 검토·기각되었다** (재론하지 않음). SPEC-DESIGN-002 §3 첫 항목이 두 가지 근거로 기각했다: (a) `--color-neutral-500`(`#989898`)은 SPEC-BRAND-001 REQ-BRAND-008이 **의도적으로 저작한 브랜드 값**이며 값을 낮추는 것은 출시된 브랜드 작업의 되돌림이다 — 같은 SPEC이 `neutral-400`/`neutral-500`을 건드리지 않은 이유와 동일하다; (b) 값을 낮추면 램프 단조성과 `neutral-400`·`neutral-600` **양쪽**에 대한 간격을 다시 계산해야 하므로 단일 값 수정으로 끝나지 않는다. 이 SPEC은 그 판단을 계승하며 **소비처 교체(consumer swap)** 만 수행한다.
- **선행 조사에서 SPEC-DESIGN-002의 회귀 감시 AC가 이 SPEC에 의해 무효화됨을 발견**했다 (§4.1). 대체 검사를 REQ-DESIGN3-005 / AC-007이 정의한다.

---

## §1. 배경과 문제

### 1.1 측정된 결함

`--color-neutral-500`(`#989898`)은 사이트 기본 배경 `--color-bg`(`#f2f2f2`) 위에서 명도 대비가 **2.577:1**이다. WCAG 2.1 AA 일반 텍스트 기준 4.5:1은 물론, AA 대형 텍스트 기준(3.0:1)과 비텍스트 기준(3:1)에도 미달한다.

이 값은 Tailwind 유틸리티 `text-neutral-500`을 통해 **10개 `.tsx` 파일 17개 지점**에서 소비되고 있다. 측정(2026-09-07, 이 워크트리 HEAD `5b2881e`):

```
$ grep -rln "text-neutral-500" --include="*.tsx" src/ | wc -l
10
$ grep -rn "text-neutral-500" --include="*.tsx" src/ | wc -l
17
$ grep -rho "\(text\|border\|bg\|ring\|placeholder\|divide\|decoration\|from\|to\|via\|fill\|stroke\|shadow\|outline\|accent\|caret\)-neutral-500" --include="*.tsx" --include="*.ts" --include="*.css" src/ | sort | uniq -c
  17 text-neutral-500
```

`neutral-500`은 **텍스트 색으로만** 쓰인다 — `border-`/`bg-`/`ring-` 등 다른 유틸리티는 0건이다. `.ts`/`.css`/`.js`에서의 사용도 0건이다(`exit=1`). 즉 대비 미달이 전부 **본문 텍스트로 렌더되는 결함**이다.

### 1.2 왜 `text-neutral-600`인가

SPEC-DESIGN-002가 `--color-neutral-600`을 `#7a7a7a` → `#6b6b6b`으로 교정하면서, 이 램프에서 **AA를 통과하는 가장 밝은 단계**가 `neutral-600`이 되었다. 실제 측정:

```
neutral-500 #989898 on --color-bg      #f2f2f2 => 2.577:1  AA-normal(4.5) FAIL
neutral-600 #6b6b6b on --color-bg      #f2f2f2 => 4.760:1  AA-normal(4.5) PASS
neutral-700 #5e5e5e on --color-bg      #f2f2f2 => 5.792:1  AA-normal(4.5) PASS
neutral-800 #424242 on --color-bg      #f2f2f2 => 8.977:1  AA-normal(4.5) PASS
```

`neutral-600`은 **결함을 해소하는 최소 변경**이다. 더 어두운 단계를 고르면 시각적 계층이 불필요하게 무너진다(§3 참조).

### 1.3 시각적 계층이 한 단계 병합되는 것은 불가피하다 (기록)

현재 저장소의 텍스트 색 계층은 5단계다:

| 단계 | 용도 (실제 코드에서 관찰) |
|---|---|
| `text-neutral-900` | 제목·금액·상품명 등 1차 정보 |
| `text-neutral-800` | 설명문·배송지 본문 |
| `text-neutral-700` | 2차 강조 (카드 가격, 수량 버튼) |
| `text-neutral-600` | 정의 목록 레이블 (`주문 번호`, `상품 합계`, `배송비`) |
| `text-neutral-500` | 3차 보조 (단가×수량, 힌트, 플레이스홀더, 요청사항) |

이 SPEC은 5단계를 4단계로 병합한다. **이것은 선택이 아니라 램프의 제약이다**: `neutral-500`(2.577:1, FAIL)과 `neutral-600`(4.760:1, PASS) 사이에 AA를 통과하는 중간 단계가 램프에 존재하지 않는다. 3차 보조 계층을 별도 색으로 보존하려면 램프에 새 값을 도입해야 하고, 그것은 토큰 변경이므로 이 카드의 범위 밖이다(§3).

병합 후에도 계층은 4단계로 남으며(`900 > 800 > 700 > 600`), 정보 구조를 읽는 데 필요한 대비는 유지된다.

---

## §2. 소비처 배경 측정 (지점별, 균일성 검증)

이 SPEC의 핵심 조사는 **"17개 지점이 정말 같은 배경 위에 렌더되는가"** 다. `text-neutral-600`은 `--color-surface`(`#e9e9e9`) 위에서 **4.389:1로 AA에 미달**하므로(SPEC-DESIGN-002 §3 두 번째 Out of Scope 항목), 어느 한 지점이라도 `bg-surface` 컨테이너 안에 있으면 그 지점만 `text-neutral-700`으로 올려야 한다. 추정하지 않고 전수 확인했다.

### 2.1 저장소 전체 `bg-*` 인벤토리 (전수)

```
$ grep -rno "bg-[a-z0-9-]*" --include="*.tsx" src/
```

주석 인용을 제외한 실제 `bg-*` 적용 지점은 다음이 전부다:

| 파일:행 | 유틸리티 | 해석 |
|---|---|---|
| `src/app/layout.tsx:126` | `bg-bg` | `<body>` — **사이트 기본 배경 `#f2f2f2`** |
| `src/components/layout/SiteHeader.tsx:66` | `bg-surface` | `<header>` — 헤더 전용 |
| `src/components/product/ProductCard.tsx:48` | `bg-surface` | 카드 바깥 `<a>` |
| `src/components/product/ProductCard.tsx:52` `:58` | `bg-neutral-100` | 카드 내부 이미지 영역 |
| `src/components/product/ProductGallery.tsx:42` `:52` | `bg-neutral-100` | 갤러리 이미지 영역 |
| `src/components/cart/CartView.tsx:128` | `bg-neutral-100` | 썸네일 박스 |
| `src/app/(shop)/checkout/complete/[orderId]/page.tsx:127` `:140` `:147` `:154` | `bg-red-50` / `bg-amber-50` / `bg-emerald-50` / `bg-neutral-100` | 상태 배너 (형제 요소) |
| `src/components/orders/OrderLookupResultView.tsx:52` `:59` `:66` | 동일 | 상태 배너 (형제 요소) |
| 그 외 (`bg-accent`, `bg-red-600`, `bg-green-*`, `bg-neutral-200/300`, `bg-transparent`) | — | 버튼·배지·구분자. 17개 지점의 조상 아님 |

레이아웃은 `src/app/layout.tsx`(`<body className="bg-bg text-text">`)와 `src/app/(shop)/layout.tsx`(배경 선언 없음, `SiteHeader` + `{children}`) 둘뿐이다. `/staff/**`는 `(shop)` 라우트 그룹 밖이라 `SiteHeader`를 상속하지 않는다.

### 2.2 지점별 배경·크기 매트릭스 (17건 전수)

| # | 지점 | 크기 | 실효 배경 | 배경 값 | `neutral-600` 대비 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `src/app/(shop)/checkout/complete/[orderId]/page.tsx:187` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 2 | `src/app/(shop)/checkout/complete/[orderId]/page.tsx:224` | 상속 `text-sm` (`<address>` 216행) | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 3 | `src/app/(shop)/checkout/page.tsx:122` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 4 | `src/app/staff/orders/[orderId]/page.tsx:110` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 5 | `src/app/staff/orders/[orderId]/page.tsx:147` | 상속 `text-sm` (`<address>` 139행) | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 6 | `src/app/staff/products/ProductForm.tsx:264` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 7 | `src/app/staff/products/ProductForm.tsx:288` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 8 | `src/app/staff/products/ProductForm.tsx:341` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 9 | `src/components/cart/CartView.tsx:140` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 10 | `src/components/cart/CartView.tsx:175` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 11 | `src/components/checkout/OrderSummary.tsx:87` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 12 | `src/components/orders/OrderLookupResultView.tsx:84` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 13 | `src/components/orders/OrderLookupResultView.tsx:131` | 상속 `text-sm` (`<address>` 123행) | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 14 | `src/components/product/ProductCard.tsx:52` | `text-sm` | **같은 요소의 `bg-neutral-100`** | `#f5f5f5` | **4.888:1** | PASS |
| 15 | `src/components/product/ProductDetailView.tsx:72` | `text-sm` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 16 | `src/components/product/ProductDetailView.tsx:124` | `text-xs` | 페이지 | `#f2f2f2` | 4.760:1 | PASS |
| 17 | `src/components/product/ProductGallery.tsx:42` | `text-sm` | **같은 요소의 `bg-neutral-100`** | `#f5f5f5` | **4.888:1** | PASS |

크기 집계: `text-xs` 11건 · `text-sm` 명시 3건 · 상속 3건 = 17건.

### 2.3 두 가지 비균일성과 그 판정

**(a) `bg-neutral-100` 위 2건 (#14, #17)** — 페이지 배경이 아니라 `#f5f5f5` 위에 렌더된다. 이 배경은 `#f2f2f2`보다 **밝으므로** 대비가 오히려 **더 좋다**(4.888:1 > 4.760:1). 별도 처리 불필요.

**(b) `ProductCard.tsx`는 `bg-surface` 조상을 가진다 — 그럼에도 안전하다** — 이 파일은 17개 지점 중 유일하게 `bg-surface`(48행 바깥 `<a>`)를 조상으로 갖는다. 그럼에도 52행의 텍스트가 surface 위에 렌더되지 **않는** 이유는, 52행 요소가 **자기 자신의 불투명 배경 `bg-neutral-100`을 선언**하기 때문이다. CSS 배경은 상속되지 않고 페인팅되므로, 자식의 불투명 배경이 조상의 배경을 완전히 가린다.

```
$ sed -n '48,56p' src/components/product/ProductCard.tsx
      className="group block overflow-hidden rounded-md border border-divider bg-surface shadow-sm ..."
    >
      {image === undefined ? (
        <div
          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500"
```

같은 파일의 72행(`text-neutral-700`)은 배경 선언이 없는 `<div className="p-3">` 안이므로 **실제로 surface 위에 렌더된다** — `neutral-700` on `#e9e9e9` = 5.341:1로 AA를 통과한다. 이 SPEC의 대상이 아니며 변경하지 않는다.

**결론: 17개 지점 전부 `text-neutral-600`으로 균일 교체하는 것이 옳다.** `text-neutral-700`이 필요한 지점은 **한 건도 없다**.

### 2.4 WCAG 대형 텍스트 예외 재확인 (인용이 아닌 직접 측정)

```
$ grep -rn "text-neutral-500" --include="*.tsx" src/ | grep -c "font-bold\|font-semibold\|font-medium"
0
$ grep -rn "text-neutral-500" --include="*.tsx" src/ | grep -o "text-xs\|text-sm\|text-base\|text-lg\|text-xl\|text-2xl" | sort | uniq -c
   3 text-sm
  11 text-xs
```

17개 지점 중 굵기 클래스를 가진 것은 **0건**이다. 크기는 `text-xs`(12px) 11건, `text-sm`(14px) 3건, 상속 3건이며 상속 3건의 조상은 전부 `text-sm`(14px)이다(§2.2 #2·#5·#13). 최대 14px, 전부 normal weight이므로 WCAG 대형 텍스트 예외(≥18.66px bold 또는 ≥24px)에 해당하는 건은 **없다**. AA 일반 텍스트 4.5:1이 17건 전부에 적용된다.

---

## §3. 요구사항 (GEARS)

- **REQ-DESIGN3-001** (Ubiquitous): 저장소의 실행 코드(`src/**`)에는 Tailwind 유틸리티 클래스 `text-neutral-500`이 남아 있어서는 안 된다(shall not).

- **REQ-DESIGN3-002** (Ubiquitous): §2.2가 열거한 17개 지점은 각각 `text-neutral-600`을 사용해야 한다(shall). 지점마다 다른 단계를 쓰는 비균일 교체를 해서는 안 된다(shall not) — §2.3이 균일 교체의 타당성을 측정으로 확정했다.

- **REQ-DESIGN3-003** (Ubiquitous): 교체된 각 지점의 전경색은 **그 지점이 실제로 렌더되는 배경** 위에서 WCAG 2.1 AA 일반 텍스트 명도 대비 4.5:1 이상을 만족해야 한다(shall). "실제로 렌더되는 배경"은 조상의 배경이 아니라, 해당 요소 또는 그 요소를 가리지 않는 가장 가까운 배경 선언을 뜻한다.

- **REQ-DESIGN3-004** (Ubiquitous): `src/app/globals.css`의 `@theme` 블록은 이 SPEC에 의해 변경되어서는 안 된다(shall not). `--color-neutral-500`(`#989898`)을 포함해 어떤 토큰 값도, 어떤 주석도 그대로 유지되어야 한다(shall).

- **REQ-DESIGN3-005** (Where — capability gate): `--color-surface`를 배경으로 실제 렌더되는 텍스트 지점에서는, 그 지점이 `text-neutral-600`을 사용해서는 안 된다(shall not). `#6b6b6b` on `#e9e9e9`는 4.389:1로 AA에 미달하므로 해당 지점은 `text-neutral-700` 이상을 사용해야 한다(shall).

- **REQ-DESIGN3-006** (Ubiquitous): 이 SPEC의 변경은 `className` 문자열 안의 `text-neutral-500` 토큰을 `text-neutral-600`으로 치환하는 것에만 국한되어야 한다(shall). 마크업 구조, 다른 유틸리티 클래스, 컴포넌트 로직, 테스트, 주석 산문을 변경해서는 안 된다(shall not).

- **REQ-DESIGN3-007** (Ubiquitous): 이 변경으로 인해 기존 테스트 스위트·린트·타입체크에 신규 실패가 발생해서는 안 된다(shall not).

---

## §4. 범위 제외 (Out of Scope)

### Out of Scope — `--color-neutral-500` 토큰 값 변경

- `src/app/globals.css`의 `--color-neutral-500: #989898`을 포함해 `@theme` 블록의 어떤 값도 변경하지 않는다(REQ-DESIGN3-004).
- **이 대안은 SPEC-DESIGN-002 §3 첫 항목에서 이미 검토되고 기각되었으며, 이 카드는 그 판단을 재론하지 않는다.** 기각 근거 두 가지: (a) `#989898`은 SPEC-BRAND-001 REQ-BRAND-008이 의도적으로 저작한 OUR 그레이스케일 브랜드 값이므로 값을 낮추는 것은 출시된 브랜드 작업의 되돌림이다; (b) 값을 낮추면 `neutral-400`(`#b7b7b7`)과 `neutral-600`(`#6b6b6b`) **양쪽**에 대한 램프 간격과 단조성을 재계산해야 하므로 단일 값 수정으로 끝나지 않는다.
- 사용자 확인(피어 세션 경유)으로도 "토큰 값은 그대로 두고 소비처만 교체"가 확정되어 있다.

### Out of Scope — `text-neutral-700` 이상으로의 상향

- 17개 지점 중 어느 것도 `neutral-700` 이상으로 올리지 않는다.
- **근거**: §2.2의 전수 측정에서 17개 지점 전부가 `#f2f2f2`(15건) 또는 `#f5f5f5`(2건) 위에 렌더되며, `neutral-600`이 각각 4.760:1·4.888:1로 AA를 통과한다. `neutral-700`은 결함 해소에 불필요한 추가 대비이고, §1.3의 계층을 한 단계 더 무너뜨린다.

### Out of Scope — `--color-surface` 위 `neutral-600` 대비 미달의 해소

- `#6b6b6b` on `#e9e9e9` = 4.389:1의 AA 미달 자체는 이 SPEC이 해결하지 않는다.
- **근거**: §2.3(b)의 측정대로 이 조합은 교체 후에도 코드에서 **도달 불가능**하다. `bg-surface` 소비처는 `SiteHeader.tsx:66`과 `ProductCard.tsx:48` 두 곳뿐이며, 전자는 `text-neutral-600`을 쓰지 않고 후자의 52행은 자기 자신의 불투명 `bg-neutral-100`으로 surface를 가린다.
- 해소하려면 `--color-surface` 값 자체 또는 램프를 손대야 하므로 토큰 변경이며 위 첫 항목과 같은 이유로 제외된다.
- **전방 포인터**: REQ-DESIGN3-005와 AC-007이 이 조합의 장래 도입을 감시한다.

### Out of Scope — 시각적 계층 재설계

- §1.3이 기록한 5단계 → 4단계 병합을 되돌리기 위한 새 중간 색 도입, 계층 재배치, 타이포그래피 조정을 하지 않는다.
- **근거**: 램프에 AA를 통과하는 중간 단계가 없으므로 계층 보존은 토큰 추가를 요구하고, 이는 별개 성격의 디자인 작업이다.

### Out of Scope — `.moai/design/tokens.json` 및 `globals.css` 헤더 주석

- 두 산출물 모두 SPEC-BRAND-001 이전 Classical 팔레트로 노후화되어 있으나 이 SPEC에서 갱신하지 않는다.
- **근거**: SPEC-DESIGN-002 §4.1 후속 카드 권고 1번·2번의 범위이며 이 카드와 원인·범위가 다르다. 이 카드는 실행 코드 소비처만 다룬다.

### Out of Scope — 회귀 방지 린트 규칙 도입

- `text-neutral-500` 재도입을 기계적으로 차단하는 ESLint 규칙·CI 가드를 추가하지 않는다.
- **근거**: 린트 규칙 도입은 툴체인 설정 변경이며 이 카드의 소비처 교체와 성격이 다르다. AC-001이 이 SPEC 시점의 0건을 확정하고, REQ-DESIGN3-005/AC-007이 더 위험한 조합(surface 위 `neutral-600`)을 감시한다.
- **전방 포인터**: 색상 유틸리티 사용 규율을 기계적으로 강제하는 별도 카드를 권고한다.

### Out of Scope — 사이트 전역 접근성 감사

- 포커스 인디케이터, 키보드 조작성, 대체 텍스트, ARIA 속성, hover/active 상태 대비, 그 밖의 WCAG 항목은 다루지 않는다.
- 특히 `CartView.tsx:175`의 `hover:text-red-600` 같은 상태 색 대비는 이 SPEC의 대상이 아니다.
- **전방 포인터**: SPEC-DESIGN-002 §3 마지막 항목과 동일하게 별도 SPEC(가칭 `SPEC-A11Y-001`)의 범위다.

---

## §4.1 배경 관찰 — SPEC-DESIGN-002 AC-005(c)의 무효화 (이 SPEC이 만드는 결과)

**이 SPEC은 SPEC-DESIGN-002가 남긴 회귀 감시 검사를 통과 불가 상태로 만든다.** 요구사항이 아니라, 인지하고 대체 검사를 마련해야 할 **결과**다.

SPEC-DESIGN-002 `acceptance.md` AC-005(c)의 검사는 다음과 같다:

```bash
grep -n "neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
# PASS 조건: 출력 없음 + exit=1
```

현재 상태에서는 통과한다(측정: `exit=1`, 출력 없음). 그러나 이 SPEC이 `ProductCard.tsx:52`를 `text-neutral-600`으로 바꾸면, `ProductCard.tsx`는 `bg-surface`(48행)와 `neutral-600`(52행)을 **같은 파일 안에** 갖게 되어 이 grep이 매치한다.

- **이것은 실제 대비 결함이 아니다.** §2.3(b)가 측정으로 보인 대로 52행 텍스트는 자기 자신의 `bg-neutral-100` 위에 렌더된다.
- **원인은 검사의 입도(granularity)다.** AC-005(c)는 **파일 단위** grep이라 "같은 파일에 둘 다 있다"와 "같은 요소 배경 위에 렌더된다"를 구분하지 못한다. 파일 안에 `bg-surface` 영역과 비-surface 영역이 공존하는 순간 위양성(false positive)을 낸다.
- **SPEC-DESIGN-002를 소급 수정하지 않는다.** 해당 SPEC은 `status: completed`이며, 이 카드는 그 SPEC에 대해 `completed → in-progress (amendment)` 전이를 개시하지 않는다. 대신 이 SPEC이 **더 정확한 후속 검사**(AC-007, 요소 입도)를 정의해 감시 의도를 계승한다.
- 이 사실은 이 SPEC의 완료 보고에 명시된다(`acceptance.md` §D.3).

---

## §5. 참조

- `.moai/specs/SPEC-DESIGN-002/spec.md` §3 `### Out of Scope — neutral-400 / neutral-500 및 나머지 램프 단계` — 토큰 값 변경 대안의 검토·기각 근거, 17건/10파일·2.577:1 최초 측정, 소비처 교체 방향의 전방 포인터
- `.moai/specs/SPEC-DESIGN-002/spec.md` §4.1 후속 카드 권고 3번 — 이 카드의 발주 근거
- `.moai/specs/SPEC-DESIGN-002/spec.md` §3 `### Out of Scope — --color-surface(#e9e9e9) 위 대비` — `neutral-600` × surface = 4.389:1 및 회귀 감시 의도
- `.moai/specs/SPEC-DESIGN-002/acceptance.md` AC-001 — `#6b6b6b` on `#f2f2f2` = 4.760:1의 축자 측정 근거
- `.moai/specs/SPEC-DESIGN-002/acceptance.md` AC-005 (c) — 이 SPEC이 무효화하는 회귀 검사(§4.1)
- `.moai/specs/SPEC-BRAND-001/spec.md:165-167` REQ-BRAND-008 — `neutral-500` 값을 저작한 요구사항. 이 SPEC은 이 값을 건드리지 않으므로 **이탈하지 않는다**
- `src/app/globals.css` `@theme` 블록 — 토큰 정의 (이 SPEC의 무변경 대상)
- `src/app/layout.tsx:126` — `<body className="bg-bg text-text">`, 사이트 기본 배경의 단일 출처
- WCAG 2.1 SC 1.4.3 (Contrast Minimum, Level AA)
