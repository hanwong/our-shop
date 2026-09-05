---
id: SPEC-DESIGN-001
status: in-progress
updated: 2026-09-05
tier: M
---

# Acceptance Criteria: SPEC-DESIGN-001

## §A. 형식 규약

각 항목은 `AC-DESIGN-XXX` 라벨과 Given-When-Then 문장, 그리고 **이진 판정 가능한 검증 수단**을 갖는다. GEARS 요구사항 문장은 `spec.md` §2가 소유한다 — 이 파일은 검증 계층이며 요구사항을 재진술하지 않는다.

---

## §B. 인수 기준

### 토큰 체계

**AC-DESIGN-001** — `@theme` 블록 존재 + Classical 값 축자 일치
Given `src/app/globals.css`와 `plan.md` §D.1의 Classical 토큰 블록,
When 파일을 읽으면,
Then `@theme` 블록이 존재하고, 색상·타이포그래피·간격·라운드 반경 네 카테고리의 토큰이 **§D.1 값과 축자로 일치**한다(의역·재계산·반올림 없음).
검증: `grep -c "@theme" src/app/globals.css` → 1 이상. 표본 대조 — `#f3f2f2`(bg), `#b68235`(accent), `#201f1d`(text), `4.6px`(space-1), `2px/4px/7px`(radius), `Cormorant Garamond`·`Lora`가 각각 존재. 간격 값이 정수로 반올림되지 않았을 것(`4.6px`이지 `5px`가 아님).

**AC-DESIGN-002** — 낡은 주석 제거
Given 이 SPEC 이전 `globals.css`에 있던 "No `@theme` block: a design-token system is excluded by spec.md §3" 주석,
When 롤아웃이 끝나면,
Then 해당 문장이 파일에 남아 있지 않다.
검증: `grep -c "No \`@theme\` block" src/app/globals.css` → 0.

**AC-DESIGN-003** — 토큰 원천 명시 + 폰트 로딩 동작
Given 완료된 `@theme` 블록과 `src/app/layout.tsx`,
When 파일을 읽고 앱을 렌더하면,
Then (a) `@theme` 주석이 원천을 "Classical (plan.md §D.1)"로 명시하고, (b) Cormorant Garamond(제목)·Lora(본문)가 §B.5가 확정한 방식으로 로드되며, (c) `layout.tsx`의 "Typography comes from the system font stack ... rather than `next/font/google`" 주석이 남아 있지 않다.
검증: `grep -c "rather than" src/app/layout.tsx` → 해당 문장 0건. 폰트 로딩 코드 존재. §B.5 후보 2로 되돌린 경우 그 사유가 주석에 기록되어 있을 것.

### 공유 프리미티브

**AC-DESIGN-004** — 프리미티브 디렉터리와 구성
Given `src/components/ui/`,
When 디렉터리를 나열하면,
Then 버튼 프리미티브 1개와 폼 필드 프리미티브(입력·라벨·오류 텍스트)가 존재한다.
검증: `ls src/components/ui/` 결과에 해당 모듈 파일 존재.

**AC-DESIGN-005** — 프리미티브의 토큰 경유 + 포커스 링 통일
Given `src/components/ui/`의 각 프리미티브와 `src/components/product/ProductCard.tsx`,
When 소스를 정적 스캔하면,
Then (a) 프리미티브가 원시 팔레트 리터럴이 아니라 `@theme` 토큰 역할을 참조하고, (b) 포커스 표시가 Classical 규칙(`:focus-visible` + `outline` + `outline-offset`)을 따르며, (c) `ProductCard.tsx:40`이 하드코딩하고 있던 `focus-visible:ring-*` 방식이 남아 있지 않다.
검증:
- (a) `grep -rn "neutral-900\|neutral-300\|#[0-9a-fA-F]\{6\}" src/components/ui/` → 0건
- (c) `grep -rn "focus-visible:ring" src/` → 0건 (이 SPEC 이전에는 `ProductCard.tsx:40` 1건 존재 — 실측 확인됨)

**AC-DESIGN-006** — 신규 의존성 없음
Given 롤아웃 완료 시점의 `package.json`,
When 이 SPEC 이전과 비교하면,
Then `dependencies` / `devDependencies`에 추가된 항목이 0건이다.
검증: `git diff --stat -- package.json package-lock.json` → 의존성 추가 0건.

### 반영 범위

**AC-DESIGN-007** — LogoutButton 구체 결함 수정 (회귀 고정)
Given 이 SPEC 이전 `src/components/layout/LogoutButton.tsx:48`의 `<button type="button" onClick={handleLogout}>` — `className`이 전무한 상태,
When 롤아웃이 끝나면,
Then 해당 버튼이 공유 버튼 프리미티브를 경유해 렌더되며 브라우저 기본 버튼 스타일로 남지 않는다.
검증: `LogoutButton.tsx`가 `src/components/ui/` 버튼 프리미티브를 import하고, 렌더 결과에 스타일 클래스가 부여됨을 단위 테스트로 확인.

**AC-DESIGN-008** — 버튼 복제 문자열 소거 **+ 아웃라인 전환**
Given 이 SPEC 이전 13개 파일에 복제되어 있던 솔리드 채움 버튼 `rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white`,
When 롤아웃이 끝나면,
Then (a) 그 문자열을 직접 갖는 파일이 `src/components/ui/` 밖에 남아 있지 않고, (b) 버튼 프리미티브가 **Classical 아웃라인 스타일**로 렌더된다 — 투명 배경 + `--color-accent` 테두리 + accent 색 글자 — 그리고 (c) accent 색으로 솔리드 채움된 버튼이 존재하지 않는다.
검증:
- (a) `grep -rl "rounded-md bg-neutral-900" src/ | grep -v "src/components/ui/"` → 0건
- (b) 버튼 프리미티브 단위 테스트가 투명 배경 + accent 테두리·글자를 단언
- (c) **채움 금지 — 세 가지 표기 형태를 모두 거부한다.** 버튼 프리미티브에서 `bg-transparent` 이외의 배경 지정이 0건:
  ```bash
  grep -rnE 'bg-(accent|surface|bg|text|neutral)(-[0-9]{3})?\b|bg-\[var\(--color-|background(-color)?:\s*var\(--color-' src/components/ui/ | grep -v 'bg-transparent'
  ```
  → 0건

> **(c)가 세 형태를 모두 잡아야 하는 이유 — Tailwind v4 자동 생성 유틸리티.** 이 저장소는 `tailwindcss ^4.3.3`(`package.json` 실측)을 쓰며, v4는 `@theme`에 선언된 **모든 색상 토큰에서 유틸리티 클래스를 자동 생성**한다 — `--color-accent` → `bg-accent`/`text-accent`/`border-accent`, `--color-accent-500` → `bg-accent-500`, `--color-surface` → `bg-surface` 등.
>
> 따라서 구현자가 새 accent 색으로 버튼을 채우려 할 때 **가장 자연스럽게 손이 가는 표기는 `bg-accent`**이지, `bg-[var(--color-accent)]`가 아니다. 이전 판의 (c) 패턴은 CSS 변수 명시 형태 두 가지만 검사했으므로 **가장 유력한 실제 위반을 통과시켰다.** 위 패턴은 (i) 자동 생성 유틸리티(`bg-accent`, `bg-accent-500`, `bg-surface`, `bg-neutral-800` …), (ii) 임의값 CSS 변수(`bg-[var(--color-…)]`), (iii) 직접 CSS 선언(`background: var(--color-…)`)을 모두 거부한다. `bg-transparent`만 예외로 허용한다 — 그것이 Classical 아웃라인 버튼의 정답이기 때문이다.

> **이 AC는 시각적 회귀를 막는 핵심 지점이다.** 현재 코드의 13개 파일 수렴은 **보존 대상이 아니라 교체 대상**이다(`spec.md` §1.2). (b)/(c) 없이 (a)만 검증하면, 구현자가 현재의 솔리드 스타일을 그대로 프리미티브에 굳혀 놓고도 이 AC를 통과시킬 수 있다 — 목표와 정반대인 결과가 "합격"으로 기록되는 상태다. Classical readme 원문: *"Do not fill cards or buttons with solid accent color."*

**AC-DESIGN-009** — 폼 필드 복제 문자열 소거
Given 이 SPEC 이전의 폼 입력 소비자 8개 파일 — 정확 일치 **7건**(`mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm`: `(shop)/login`, `(shop)/signup`, `staff/login`, `staff/products/ProductForm.tsx`, `checkout/CheckoutForm.tsx`, `orders/OrderLookupForm.tsx`, `product/ReviewForm.tsx`) + **근접 변형 1건**(`checkout/CheckoutInteractive.tsx:138` — 선행 `mt-1`이 없는 동일 패턴),
When 롤아웃이 끝나면,
Then 8개 파일 전부가 폼 필드 프리미티브를 경유하며, 해당 클래스 문자열을 직접 갖는 파일이 `src/components/ui/` 밖에 남아 있지 않다.
검증: `grep -rl "w-full rounded-md border border-neutral-300" src/ | grep -v "src/components/ui/"` → 0건. 이 느슨한 패턴은 정확 일치 7건과 근접 변형 1건을 **모두** 포착하므로 Given의 8개 파일 목록과 판정 기준이 일치한다(엄격 7 / 느슨 8 불일치 없음).

**AC-DESIGN-010** — 15개 페이지 전수 커버
Given `src/app` 아래 15개 `page.tsx`(고객 9 + 스태프 6),
When 각 페이지가 렌더하는 기본 액션 버튼과 폼 필드를 조사하면,
Then 그 요소들이 전부 `src/components/ui/` 프리미티브를 경유하고(직접 또는 하위 컴포넌트를 통해), 15개 페이지 전부가 Classical 타이포그래피(`--font-heading`/`--font-body`)와 배경(`--color-bg`)을 상속한다.
검증: 15개 페이지 목록(plan.md §F.3/§F.4)을 기준으로 페이지별 확인. 버튼/폼 필드를 갖지 않는 페이지는 그 항목을 "해당 없음"으로 명시 기록 — 누락과 구분한다. 타이포·배경 상속은 `layout.tsx` 단일 지점에서 오므로 페이지별 개별 확인 불필요.

**AC-DESIGN-011** — 동작 불변
Given 롤아웃이 건드린 모든 페이지·컴포넌트,
When 기존 테스트를 실행하면,
Then 접근성 이름·폼 제출 동작·라우팅에 관한 기존 단언이 하나도 깨지지 않는다.
검증: AC-DESIGN-012의 전체 스위트 결과에 포함.

### 회귀 가드

**AC-DESIGN-012** — 테스트 베이스라인 대비 무회귀
Given 첫 롤아웃 편집 **이전에** 캡처한 전체 스위트 베이스라인(통과/실패 건수),
When 롤아웃 완료 후 동일 명령을 재실행하면,
Then 통과 건수가 베이스라인 이상이고, 베이스라인에 없던 신규 실패가 0건이다.
검증: `npm test` 결과를 베이스라인과 대조. 기존 알려진 플레이크(예: `AC-AUTH-005`)는 베이스라인에 기록해 신규 실패와 구분한다. SPEC-AUTH-003/004가 쓴 것과 동일한 패턴.

### DesignSync 폴백

**AC-DESIGN-013** — design phase가 DesignSync 부재에도 진행 가능
Given design phase 실행 시점의 DesignSync 접근 가능 여부,
When DesignSync에 접근할 수 없으면,
Then design 산출물이 (a) 도구 부재 사실, (b) `plan.md` §D.1을 오프라인 SSOT로 사용했다는 기록, (c) 라이브 재검증이 수행되지 않았다는 명시를 담고, 그럼에도 롤아웃이 진행 가능한 상태로 완료된다.
검증: design 산출물에 세 항목 존재. DesignSync 접근 가능했던 경우 "해당 없음(재검증 수행)"으로 명시 기록.

> 이전 판의 "로컬 등가 토큰 도출"은 삭제됐다 — Classical 실제 값을 이미 확보했으므로 코드에서 값을 역산할 필요가 없다(`plan.md` §B.3).

**AC-DESIGN-014** — 재검증 결과 기록
Given design phase가 DesignSync에 접근할 수 있었던 경우,
When `plan.md` §D.1 블록을 라이브 Classical 프로젝트와 대조하면,
Then 일치 여부가 design 산출물에 기록되고, 불일치가 있으면 각 항목이 구현 착수 전에 열거된다.
검증: 산출물에 대조 결과 존재. 접근 불가였던 경우 "해당 없음(AC-DESIGN-013 경로)".

### 경계 보존

**AC-DESIGN-015** — 스태프 코로케이션 보존 + PRESERVE 상호작용 명시
Given `src/app/staff/**`의 라우트 코로케이션 컴포넌트,
When 롤아웃이 끝나면,
Then 그 파일들이 `src/components/`로 이동하지 않았고, 이 SPEC이 수정한 스태프 파일 집합이 plan.md §C.2가 사전에 열거한 허용 목록의 **부분집합**이다 — 즉 목록 밖 파일 수정이 0건이다.
검증: `git diff --name-only -- src/app/staff/` 결과의 모든 항목이 plan.md §C.2 목록에 존재(부분집합 판정). 삭제/이동 0건.

> **부분집합인 이유(정확 일치가 아니라)**: §C.2 열거 파일 중 일부는 실제로 손댈 대상이 없다 — `staff/products/new`, `staff/products/[productId]`, `staff/orders`, `staff/orders/[orderId]` 4개 파일은 이 SPEC 범위의 버튼·링크·`rounded-md` 사용이 **0건**임을 실측 확인했다(폼은 `ProductForm.tsx`가, 취소 버튼은 범위 밖 `CancelOrderButton.tsx`가 소유). 정확 일치를 요구하면 이 AC는 **구조적으로 달성 불가능**해지고, 억지로 맞추려면 AUTH-003 PRESERVE 핀 경로에 의미 없는 편집을 가해야 한다. 목록에 있으나 변경되지 않은 파일은 **정상이며 실패가 아니다.** 이 AC가 막으려는 것은 "목록에 없는 스태프 파일을 건드리는 것"이다.

### @MX 주석

**AC-DESIGN-016** — 프리미티브 @MX 주석
Given `src/components/ui/`의 신규 프리미티브 모듈,
When 호출자 수(fan-in)를 세면,
Then 호출자 3건 이상인 프리미티브는 `@MX:ANCHOR`를 갖고, 나머지는 역할을 설명하는 `@MX:NOTE`를 갖는다.
검증: `grep -rn "@MX:" src/components/ui/` + fan-in 실측 대조.

---

## §C. 요구사항 ↔ 인수 기준 추적표

| 요구사항 | 인수 기준 |
|---|---|
| REQ-DESIGN-001 | AC-DESIGN-001 |
| REQ-DESIGN-002 | AC-DESIGN-002, AC-DESIGN-003 |
| REQ-DESIGN-003 | AC-DESIGN-004 |
| REQ-DESIGN-004 | AC-DESIGN-005, AC-DESIGN-006 |
| REQ-DESIGN-005 | AC-DESIGN-008, AC-DESIGN-009, AC-DESIGN-010 |
| REQ-DESIGN-006 | AC-DESIGN-007 |
| REQ-DESIGN-007 | AC-DESIGN-011 |
| REQ-DESIGN-008 | AC-DESIGN-001 (축자 일치), AC-DESIGN-003 |
| REQ-DESIGN-009 | AC-DESIGN-014 (재검증) |
| REQ-DESIGN-010 | AC-DESIGN-013 (오프라인 진행) |
| REQ-DESIGN-011 | AC-DESIGN-015 |
| REQ-DESIGN-012 | AC-DESIGN-012 |
| REQ-DESIGN-013 | AC-DESIGN-016 |

미대응 요구사항 0건 — REQ-DESIGN-001~013 전부가 최소 1개 AC로 덮인다.

---

## §D. 완료 정의 (Definition of Done)

- AC-DESIGN-001 ~ 016 전부 PASS 또는 명시적 "해당 없음" 판정(누락 없음).
- `npx tsc --noEmit` exit 0.
- `npm run lint` 신규 이슈 0건.
- AC-DESIGN-012 베이스라인 대비 신규 실패 0건.
- 실제 스태프 diff가 plan.md §C.2 허용 목록의 **부분집합**(목록 밖 파일 수정 0건). 목록에 있으나 변경되지 않은 파일은 정상이다 — AC-DESIGN-015 참조.
