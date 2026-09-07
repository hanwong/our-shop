---
id: SPEC-DESIGN-002
title: "neutral-600 WCAG AA 명도 대비 확보 (단일 토큰 값 교정)"
version: "0.1.0"
status: completed
created: 2026-09-07
updated: 2026-09-07
author: snake
priority: P2
phase: "v0.4.0 target"
module: "src/app/globals.css"
lifecycle: spec-anchored
tags: "design-tokens, accessibility, wcag, contrast, grayscale, brand"
tier: M
depends_on: [SPEC-BRAND-001]
related_specs: [SPEC-DESIGN-001]
---

## HISTORY

### v0.1.0 (2026-09-07)
- 최초 작성. 카드 t62.
- **선행 조사에서 최초 전제가 반증됨**: 이 SPEC의 초안은 `neutral-400/500/600`이 실수로 achromatic하게 "평탄화"되었다고 보고 warm 값 복원을 계획했다. 조사 결과 현재 값은 SPEC-BRAND-001 REQ-BRAND-008이 의도적으로 저작한 OUR 그레이스케일 팔레트였고, 복원은 출시된 브랜드 작업을 되돌리는 행위였다. 해당 접근은 폐기되고 범위가 **`--color-neutral-600` 단일 값의 WCAG AA 교정**으로 축소되었다. 근거: `.moai/specs/SPEC-BRAND-001/research.md` §4.1, 커밋 `b1c2862`.
- **plan-audit iteration 1 반영 (FAIL 0.79)**: 핵심 설계 결정(`#6b6b6b`)은 감사자 독립 측정으로 전부 뒷받침되어 변경 없음. 서술 결함 6건을 교정했다 — §3 첫 항목의 "본문 텍스트가 아니다"라는 반증된 사실 주장을 측정값으로 교체(`text-neutral-500` 17건/10파일, 2.577:1), plan.md의 AC 실행 범위를 `AC-001..AC-006`으로 정정, §2.1의 `border-neutral-600` 미측정 주장 삭제(36건 전부 `text-neutral-600`), `#7a7a7a` 리터럴 출처를 `acceptance.md:69`/`research.md:147`로 정확히 귀속, AC-005(a)에 9단계 램프 축자 스크립트 추가, §4-3을 "AC 노후화"에서 "REQ-BRAND-008로부터의 의도적 이탈"로 격상하고 후속 카드 권고를 4건으로 확장. 감사 보고서: `.moai/reports/plan-audit/SPEC-DESIGN-002-review-1.md`.

---

## §1. 배경과 문제

### 1.1 문제

`--color-neutral-600`(`#7a7a7a`)은 사이트 기본 배경 `--color-bg`(`#f2f2f2`) 위에서 명도 대비가 **3.834:1**로, WCAG 2.1 AA 일반 텍스트 기준 **4.5:1을 충족하지 못한다**.

이 토큰은 Tailwind 유틸리티 `text-neutral-600`을 통해 저장소 전역에서 소비되고 있으며, 대부분 보조 설명문·정의 목록 레이블·플레이스홀더 문구처럼 **일반 크기 본문 텍스트**에 쓰인다. 즉 대비 미달이 실제 렌더 결과에 그대로 노출된다.

### 1.2 이 값이 어디서 왔는가 (SSOT 확인 결과)

`globals.css` 파일 상단 주석은 `@theme` 블록의 값이 "SPEC-DESIGN-001 plan.md §D.1과 바이트 단위로 동일"하다고 주장하지만 **이 주장은 SPEC-BRAND-001 이후 사실이 아니다**. 실제 계보:

```
$ git log -L 53,53:src/app/globals.css --oneline --no-patch
b1c2862 feat(SPEC-BRAND-001): 우리샵 → OUR 브랜드 전환 (#32)
e8c4ef3 feat(SPEC-DESIGN-001): 공통 디자인 토큰 체계 수립과 전체 사이트 반영 (#28)
```

현재 `#7a7a7a`를 저작한 것은 **SPEC-BRAND-001**(`b1c2862`)이며, 그 근거는 REQ-BRAND-008과 `SPEC-BRAND-001/research.md` §4.1이다. SPEC-DESIGN-001 plan.md §D.1(Classical warm 팔레트)은 **대체된 SSOT**다.

따라서 이 SPEC은 "실수를 되돌리는" SPEC이 **아니다**. 의도적으로 저작된 브랜드 값 하나가 접근성 기준을 통과하지 못한다는 사실을 근거로, 그 값 하나를 램프 정합성을 유지한 채 교정하는 SPEC이다.

### 1.3 왜 `#6b6b6b`인가

| 후보 | `#f2f2f2` 대비 | 판정 |
|---|---|---|
| `#7a7a7a` (현행) | 3.834:1 | AA 미달 |
| **`#6b6b6b` (채택)** | **4.760:1** | **AA 충족** |
| `#5e5e5e` | 5.792:1 | AA 충족이나 `neutral-700`과 값 충돌 |

`#6b6b6b`은 세 가지 성질을 동시에 만족한다.

1. **완전 achromatic** (`R=G=B=6b`) — OUR 그레이스케일 체계의 나머지 8단계와 같은 성질.
2. **램프 단조성 유지** — `neutral-500`(`#989898`, L=0.3140)과 `neutral-700`(`#5e5e5e`, L=0.1119) 사이에 L=0.1470으로 안착. 100→900 전 구간 휘도 단조 감소가 깨지지 않는다.
3. **신규 색상 도입 없음** — `#6b6b6b`은 같은 `@theme` 블록의 `--color-accent-500`으로 이미 존재한다. 디자인 시스템의 색상 집합이 늘어나지 않는다.

`#5e5e5e`는 대비가 더 여유롭지만 `neutral-700`과 값이 같아져 램프의 단계 구분을 무너뜨린다. 채택하지 않는다.

---

## §2. 요구사항 (GEARS)

- **REQ-DESIGN2-001** (Ubiquitous): `src/app/globals.css`의 `@theme` 블록은 `--color-neutral-600` 값으로 `#6b6b6b`을 선언해야 한다(shall).

- **REQ-DESIGN2-002** (Ubiquitous): `--color-neutral-600` 값은 `--color-bg`(`#f2f2f2`) 위에서 WCAG 2.1 AA 일반 텍스트 기준 명도 대비 4.5:1 이상을 만족해야 한다(shall).

- **REQ-DESIGN2-003** (Ubiquitous): `--color-neutral-*` 램프는 `neutral-100`부터 `neutral-900`까지 상대 휘도가 단조 감소해야 하며(shall), 어느 두 단계도 같은 값을 가져서는 안 된다(shall not).

- **REQ-DESIGN2-004** (Ubiquitous): `--color-neutral-600` 선언부는 이 값이 SPEC-BRAND-001 REQ-BRAND-008이 규정하고 그 `acceptance.md:69`·`research.md:147`이 리터럴로 못 박은 `#7a7a7a`에서 **의도적으로 이탈**했음을 기록하는 주석을 수반해야 한다(shall). 주석은 이탈 사유(WCAG AA), 근거 SPEC ID(SPEC-DESIGN-002), 그리고 교정 전후 대비 수치를 포함해야 한다(shall).

  > **귀속 주의**: REQ-BRAND-008 본문(`SPEC-BRAND-001/spec.md:165-167`)은 "`@theme` 블록의 색상 토큰 값이 OUR 그레이스케일 팔레트와 일치할 것"을 **참조로만** 규정하며 램프 리터럴을 열거하지 않는다. `#7a7a7a`라는 리터럴이 실제로 못 박힌 곳은 `SPEC-BRAND-001/acceptance.md:69`와 `research.md:147`이다. 이 SPEC이 이탈하는 **규율 요구사항**은 REQ-BRAND-008이고, 이탈 대상 **리터럴의 출처**는 그 두 파일이다.

- **REQ-DESIGN2-005** (Ubiquitous): 이 SPEC의 변경은 `@theme` 블록 안에서 `--color-neutral-600` 선언 한 곳과 REQ-DESIGN2-004가 요구하는 주석 삽입에만 국한되어야 하며(shall), 다른 어떤 토큰 값도 변경해서는 안 된다(shall not).

- **REQ-DESIGN2-006** (Ubiquitous): 저장소의 **실행 코드**(`src/**`)에는 리터럴 문자열 `#7a7a7a`가 남아 있어서는 안 된다(shall not). SPEC 문서(`.moai/specs/**`)와 에이전트 메모리의 역사적 기록은 이 요구의 대상이 아니다.

- **REQ-DESIGN2-007** (Ubiquitous): 이 SPEC은 `text-neutral-600`을 소비하는 어떤 컴포넌트·페이지 파일도 수정해서는 안 된다(shall not). 소비처는 CSS 변수를 Tailwind 유틸리티를 통해 간접 참조하므로 토큰 값 교정만으로 전부 자동 반영된다.

### 2.1 소비처 측정 결과 (파일 수정이 왜 불필요한가)

```
$ grep -rn "neutral-600" --include="*.tsx" --include="*.ts" --include="*.css" src/ | wc -l
37
$ grep -rln "neutral-600" --include="*.tsx" src/ | wc -l
17
```

37건 중 1건은 `src/app/globals.css:53`의 **토큰 정의 자체**이고, 나머지 36건은 17개 `.tsx` 파일에 흩어진 유틸리티 **사용처**다. 유틸리티 종류를 집계하면 **36건 전부 `text-neutral-600`**이고 `border-neutral-600`은 0건이다.

```
$ grep -rho "\(text\|border\|bg\|ring\)-neutral-600" --include="*.tsx" --include="*.ts" src/ | sort | uniq -c
     36 text-neutral-600
```

유틸리티 클래스는 `--color-neutral-600` 변수를 참조하므로, 정의 1곳을 바꾸면 36곳이 함께 바뀐다. **소비처 파일은 한 건도 열지 않는다.**

---

## §3. 범위 제외 (Out of Scope)

### Out of Scope — `neutral-400` / `neutral-500` 및 나머지 램프 단계

- `--color-neutral-100/200/300/400/500/700/800/900`과 `--color-accent-*` 전 단계의 값을 변경하지 않는다.
- 이 값들은 SPEC-BRAND-001 REQ-BRAND-008이 의도적으로 저작한 현행 브랜드 값이다. 변경은 출시된 브랜드 작업의 되돌림이 된다.
- **측정 결과 (실제로 실행한 grep)**:

  ```
  $ grep -rn "text-neutral-400" --include="*.tsx" --include="*.ts" --include="*.css" src/
  (출력 없음, exit=1) → 0건
  $ grep -rn "text-neutral-500" --include="*.tsx" --include="*.ts" --include="*.css" src/
  → 17건 / 10개 파일 (text-xs 11 · text-sm 3 · 크기 미지정 상속 3)
  ```

  `neutral-400`은 텍스트 색으로 전혀 쓰이지 않는다. 그러나 **`neutral-500`(`#989898`)은 10개 파일 17개 지점에서 텍스트 색으로 쓰이고 있으며, 17건 전부 일반 크기 본문 텍스트다** — WCAG 대형 텍스트 예외(≥18.66px bold 또는 ≥24px)에 해당하는 건은 하나도 없다. `#989898` on `#f2f2f2` = **2.577:1**로 AA 일반(4.5:1)은 물론 AA 대형(3.0:1)과 비텍스트 기준(3:1)에도 미달한다. 대표 사례: `src/components/product/ProductCard.tsx:52`(`text-sm`, "이미지 준비 중"), `src/components/product/ProductDetailView.tsx:72`(`text-sm`, 카테고리명), `src/app/(shop)/checkout/complete/[orderId]/page.tsx:224`(크기 미지정, "요청사항: …").

- **제외 사유 (범위 규율)**: 위 측정이 보여주듯 `neutral-500`의 대비 미달은 **실재하는 접근성 결함**이다. 그럼에도 이 카드에서 다루지 않는 이유는 "텍스트가 아니라서"가 아니라 **이 카드가 단일 토큰 교정 카드이기 때문**이다. `neutral-500` 해소는 성격이 다른 작업이다 — 토큰 값을 낮추면 램프 단조성과 `neutral-600`과의 간격을 다시 계산해야 하고, 소비처를 옮기면 10개 파일 17개 지점을 편집해야 한다. 어느 쪽이든 이 카드의 변경 파일 1개·변경 라인 1줄이라는 범위를 벗어나며, 두 작업을 한 카드에 묶으면 diff 범위 가드(AC-002)가 무의미해진다.

- **전방 포인터 (확정)**: `neutral-500`의 본문 텍스트 사용은 **이미 발견되었으므로**(위 17건) 후속 카드가 **필수**다. 그 카드는 소비처 17개 지점을 `neutral-600` 이하로 옮기는 방향(토큰 값 변경이 아니라 소비처 교체)으로 다룬다 — 토큰 값 변경은 REQ-BRAND-008 되돌림이 되므로 채택하지 않는다. `neutral-400`은 텍스트 사용 0건이므로 이 후속 카드의 대상이 아니다.

### Out of Scope — `--color-surface`(`#e9e9e9`) 위 대비

- `#6b6b6b`은 `--color-surface`(`#e9e9e9`) 위에서 **4.389:1**로 AA에 미달한다. 이 SPEC은 이 경우를 해결하지 않는다.
- **판단 근거(측정된 사실, 누락 아님)**: `bg-surface` 소비처는 저장소 전체에서 정확히 2곳(`src/components/layout/SiteHeader.tsx:66`, `src/components/product/ProductCard.tsx:48`)이며, **두 파일 모두 `neutral-600`을 사용하지 않는다**(grep 결과 no match). 즉 이 대비 조합은 현재 코드에서 **도달 불가능**하다. 존재하지 않는 렌더 결과를 위해 램프를 더 어둡게 밀면 `neutral-700`과의 간격만 좁아진다.
- **전방 포인터**: 향후 `bg-surface` 영역 안에 `text-neutral-600` 본문이 도입되는 시점에, 해당 카드가 그 사용처를 `neutral-700`으로 올리거나 surface 값을 재검토한다. 이 SPEC의 acceptance는 그 회귀를 감시하는 검사를 포함한다(§D AC-005).

### Out of Scope — `.moai/design/tokens.json` 갱신

- `tokens.json`은 SPEC-BRAND-001 이전의 Classical 팔레트 전체(`bg #f3f2f2`, `accent #b68235`, `neutral-600 #7d7979`)를 그대로 담고 있어 현재 출시 상태와 **전면적으로** 어긋나 있다. 이 사실은 확인했다.
- 그럼에도 이 SPEC에서 갱신하지 **않는다**. 어긋남의 범위가 이 SPEC의 단일 토큰 교정과 비교할 수 없이 넓고(팔레트 전체), 원인이 다르며(BRAND-001 전환 시 미동기화), 무엇보다 **런타임 소비처가 0건**인 문서 전용 산출물이다. 단일 값 교정 카드에 팔레트 전면 재동기화를 끼워 넣는 것은 범위 규율 위반이다.
- **전방 포인터**: `tokens.json`을 SPEC-BRAND-001 REQ-BRAND-008 기준으로 전면 재동기화하는 별도 카드를 권고한다. 그 카드가 이 항목을 해소한다.

### Out of Scope — `globals.css` 상단 주석(4-11행)의 전면 교정

- 4-11행 주석의 "plan.md §D.1과 바이트 단위로 동일" 주장은 SPEC-BRAND-001 이후 거짓이다. 이 사실도 확인했다.
- 그럼에도 주석 전체를 다시 쓰지 **않는다**. 그 주석은 `@theme` 블록 전체의 계보를 서술하며, 올바르게 고치려면 BRAND-001이 무엇을 대체했는지를 블록 전 범위에 걸쳐 다시 서술해야 한다 — 단일 토큰 카드의 범위를 넘어선다.
- **다만** 이 SPEC은 `--color-neutral-600` 선언 지점에 국소 주석 하나를 추가한다(REQ-DESIGN2-004). 이는 주석 교정이 아니라, **이 SPEC이 만드는 이탈을 이 SPEC이 스스로 기록하는 것**이다. 파일에 이미 존재하는 `t51` 주석(58-66행)이 동일한 선례다.
- **전방 포인터**: 상단 주석 전체를 BRAND-001 계보로 재작성하는 별도 카드를 권고한다. 위 `tokens.json` 항목과 한 카드로 묶는 것이 자연스럽다.

### Out of Scope — 소비처 컴포넌트·페이지 파일 수정

- `text-neutral-600`을 쓰는 17개 `.tsx` 파일을 한 건도 수정하지 않는다(REQ-DESIGN2-007).
- 근거는 §2.1의 측정 결과다. 유틸리티 클래스가 CSS 변수를 간접 참조하므로 정의부 교정만으로 전부 반영된다.

### Out of Scope — 사이트 전역 접근성 감사

- 이 SPEC은 `neutral-600` 단일 토큰의 대비만 다룬다. 포커스 인디케이터, 키보드 조작성, 대체 텍스트, ARIA 속성, 그 밖의 WCAG 항목은 다루지 않는다.
- **전방 포인터**: 전역 접근성 감사는 별도 SPEC(가칭 `SPEC-A11Y-001`)의 범위다.

---

## §4. 배경 관찰 (이 SPEC의 요구사항 아님)

아래는 조사 과정에서 확인된 사실이며, 후속 카드 판단을 돕기 위해 기록한다. **이 SPEC의 완료 조건이 아니다.**

1. **`.moai/design/tokens.json` 전면 노후화** — Classical 팔레트 전체가 남아 있고, 파일 헤더는 "이 파일의 어떤 값도 지어내지 않았다"고 주장한다. 런타임 소비처 0건. 후속 카드 권고.
2. **`globals.css` 4-11행 주석 노후화** — SPEC-DESIGN-001 plan.md §D.1을 SSOT로 지목하나 실제 SSOT는 SPEC-BRAND-001 REQ-BRAND-008이다. 후속 카드 권고.
3. **REQ-BRAND-008로부터의 의도적 이탈** (그 결과로 `acceptance.md:69`도 거짓이 됨) — 이것은 AC 한 줄의 노후화가 아니라 **완료된 SPEC의 현행 요구사항 하나로부터의 이탈**이다.

   - **이탈 대상**: `SPEC-BRAND-001/spec.md:165-167`의 REQ-BRAND-008은 "`--color-neutral-*` / `--color-accent-*` 램프 **전체**가 OUR 그레이스케일 팔레트와 일치할 것"을 요구하는 **현행 요구사항**이며, 해당 SPEC은 `status: completed`다. 이 SPEC의 frontmatter는 `depends_on: [SPEC-BRAND-001]`으로 그 의존을 명시적으로 선언하고 있으므로 이탈의 무게는 더 크다. 이 SPEC이 완료되면 `--color-neutral-600`은 더 이상 그 요구사항을 만족하지 않는다.
   - **다운스트림 결과**: `SPEC-BRAND-001/acceptance.md:69`(및 `research.md:147`)가 못 박은 리터럴 `#7a7a7a` 단언이 거짓이 된다. 이는 이탈의 **결과**이지 이탈 그 자체가 아니다.
   - **소급 수정하지 않는 판단과 그 근거**: SPEC-BRAND-001은 `status: completed`이며, 이 카드는 그 SPEC에 대해 `completed → in-progress (amendment)` 전이를 **개시하지 않는다**. 단일 토큰 교정 카드가 완료된 브랜드 SPEC의 amendment 절차(`amendment_of` 필드 + HISTORY `## Amendments` 하위 절 + plan-audit 캐시 무효화)를 함께 짊어지는 것은 범위 규율 위반이며, amendment의 적정 범위 판단(REQ-BRAND-008 문안을 어떻게 재규정할 것인가)은 브랜드 팔레트 전체를 보는 카드의 몫이다.
   - **추적 가능성 보전**: REQ-DESIGN2-004가 요구하는 국소 주석이 이탈 사유·근거 SPEC ID·전후 대비 수치를 코드 옆에 남긴다. 다만 이것은 **완화책**이지 해소가 아니다 — BRAND-001 쪽에는 아무 기록도 남지 않으므로, 아래 후속 카드 권고 4번이 그 간극을 닫는다.

### 4.1 후속 카드 권고 (이 SPEC의 완료 조건 아님)

| # | 후속 카드 | 해소 대상 |
|---|---|---|
| 1 | `.moai/design/tokens.json` 전면 재동기화 | §4-1 (팔레트 전체 노후화) |
| 2 | `globals.css` 상단 주석을 BRAND-001 계보로 재작성 | §4-2 (SSOT 오지목). 1번과 한 카드로 묶는 것이 자연스럽다 |
| 3 | `text-neutral-500` 소비처 17개 지점을 `neutral-600` 이하로 교체 | §3 첫 항목 (측정으로 확인된 AA 미달 본문 텍스트 17건/10파일, 2.577:1) |
| 4 | **SPEC-BRAND-001 amendment 검토** — REQ-BRAND-008 문안을 이 이탈과 화해시킬지(램프 전체 일치 요구에 접근성 예외를 명시할지) 판단하고, 필요하면 `completed → in-progress (amendment)` 전이를 개시 | §4-3 (요구사항 이탈이 BRAND-001 쪽에 무기록으로 남는 문제) |

---

## §5. 참조

- `.moai/specs/SPEC-BRAND-001/spec.md:165-167` REQ-BRAND-008 — 현행 팔레트를 저작한 **요구사항**(램프 전체를 참조로 규정; 리터럴 열거 없음). 이 SPEC이 이탈하는 대상
- `.moai/specs/SPEC-BRAND-001/acceptance.md:69`, `.moai/specs/SPEC-BRAND-001/research.md:147` — 리터럴 `#7a7a7a`가 실제로 못 박힌 곳
- `.moai/specs/SPEC-BRAND-001/research.md` §4.1 — 출시 값의 축자 원천
- 커밋 `b1c2862` — `--color-neutral-600: #7a7a7a`를 저작한 커밋
- `src/app/globals.css:58-66` — `t51` 주석, 국소 이탈 기록의 파일 내 선례
- WCAG 2.1 SC 1.4.3 (Contrast Minimum, Level AA)
