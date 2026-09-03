---
id: SPEC-STOREFRONT-002
status: completed
updated: 2026-09-03
tier: M
---

# Progress: SPEC-STOREFRONT-002 — 장바구니 화면·담기 UI 및 체크아웃 스타일 정리

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-03
plan_status: audit-ready

plan-phase 산출물 3종(spec.md, plan.md, acceptance.md) 작성 완료. Tier M.

**SPEC ID 검사**: 정규식 검사를 Bash로 실행해 관측했다.

```
$ ID="SPEC-STOREFRONT-002"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

동일 ID 부재도 확인했다 — `.moai/specs/SPEC-STOREFRONT-002` 디렉터리는 이 plan-phase가 생성하기 전까지 없었고, 생성 직전 `ls .moai/specs/ | grep -c "^SPEC-STOREFRONT-002$"` → `0`, `grep -rl "SPEC-STOREFRONT-002" .moai/specs/` → `0`건(자기 자신 제외).

**프론트매터**: 정본 12필드 전부 존재(`id`/`title`/`version`/`status`/`created`/`updated`/`author`/`priority`/`phase`/`module`/`lifecycle`/`tags`) + 선택 필드 `tier: M`·`depends_on`·`related_specs`. `phase: "v0.2.0 target"`(SPEC-ORDER-003·SPEC-DISCOUNT-001과 동일한 최신 릴리스 타깃 표기를 따름), `status: draft`.

**REQ/AC 대응**: REQ 15건(REQ-STOREFRONT-016 ~ 030) / AC 15건(AC-STOREFRONT-016 ~ 030), 1:1 대응(REQ-STOREFRONT-030만 세 하위 관측 a/b/c로 묶임 — acceptance.md §1 참고). Tier M 상한(REQ 16 / AC 16) 이내, 각각 여유 1건.

**번호 이어받기**: `STOREFRONT` 도메인의 기존 번호를 잇는다 — SPEC-STOREFRONT-001이 REQ 001~015 / AC 001~015를 사용했음을 각 문서에서 직접 확인했다(`grep -oE "AC-STOREFRONT-[0-9]+" .moai/specs/SPEC-STOREFRONT-001/acceptance.md | sort -u | tail -5` → `AC-STOREFRONT-011~015`). 이 SPEC은 REQ 016 / AC 016부터 시작한다. SPEC-ORDER-002/003이 SPEC-ORDER-001을 이어받은 선례, SPEC-CATALOG-002가 SPEC-CATALOG-001을 이어받은 선례와 동일한 규칙을 따랐다.

**SPEC ID 선택 근거 (spec.md §1에 전문 기록)**: 세 후보(`SPEC-CART-002`, 신규 `SPEC-CHECKOUT-001`, `SPEC-STOREFRONT-002`) 중 `SPEC-STOREFRONT-002`를 채택했다.
- `SPEC-CART-002` 기각: `src/features/cart/**`(SPEC-CART-001의 module)를 이 SPEC이 한 줄도 수정하지 않는다 — 백엔드 도메인 확장이 아니라 UI 신설이므로 CART 번호를 이으면 소유권이 왜곡된다.
- `SPEC-CHECKOUT-001`(신규 도메인) 기각: 체크아웃 로직(폼·트랜잭션·쿠폰·결제)은 이미 SPEC-ORDER-001·SPEC-PAYMENT-001·SPEC-DISCOUNT-001에 걸쳐 완성되어 있고, 이 SPEC이 그 화면에서 하는 일은 스타일 정리뿐이다. 새 도메인을 여는 것은 "체크아웃이 여기서 처음 만들어진다"는 잘못된 인상을 남긴다.
- `SPEC-STOREFRONT-002` 채택: SPEC-STOREFRONT-001이 이미 "고객 대면 UI" 도메인(루트 셸·Tailwind v4·App Router 컨벤션)으로 확립되어 있고, 이 SPEC은 스키마·백엔드 변경 없이 그 컨벤션 위에 화면을 하나 더 추가하는 정확히 같은 성격의 작업이다. 이는 사용자가 제시한 "CATALOG=백엔드 / STOREFRONT=UI" 분리 선례와 정확히 대응한다.

**착수 전 조사로 확인한 범위 정정 (사용자 원 지시와의 차이, spec.md §1에 근거 전문)**: 사용자가 제시한 카드 `t10` 설명과 범위 가이드는 체크아웃 화면이 아직 없다고 전제했으나, 실제로는 `src/app/checkout/page.tsx` + 5개 하위 컴포넌트(`CheckoutForm`/`OrderSummary`/`CheckoutInteractive`/`CheckoutUnavailable`/`PayButton`)가 이미 완성되어 동작 중임을 직접 파일을 읽어 확인했다. 반대로 `/cart` 라우트와 상품 상세의 담기 버튼은 `find`/`grep`으로 각각 부재를 확인했다. SPEC-DISCOUNT-001의 spec.md §4(REQ-DISCOUNT-023/024 주석) + plan.md §0 확정 #1을 직접 읽어, 체크아웃 화면의 "스타일링/레이아웃 정리"가 이미 이 카드(t10)로 소유권이 명시적으로 넘어와 있음을 확인했다. 이에 따라 이 SPEC의 체크아웃 관련 요구사항(REQ-STOREFRONT-028/029)은 재구현이 아니라 스타일 정리로 범위를 좁혔다.

**회원 신원 부재 재확인 (신규 조사)**: `grep -rn "accessToken\|AuthProvider\|useAuth\b" src`와 `grep -rn "localStorage\|sessionStorage\|AuthContext" src`를 직접 실행해, 클라이언트 측에 액세스 토큰을 보관하는 컨텍스트/스토어/훅이 저장소 전체에 아직 구현되어 있지 않음을 확인했다(매치는 서버 측 라우트 핸들러와 미보관을 설명하는 주석뿐). SPEC-AUTH-001의 "액세스 토큰은 클라이언트 메모리에" 설계는 있으나 그 메모리 저장소 자체를 구현한 SPEC이 없다는 뜻이다. 그 결과 이 SPEC이 만드는 `/cart`·담기 버튼도 SPEC-ORDER-001과 동일하게 게스트 전용으로 범위를 좁혔다(spec.md §3).

**depends_on 근거**: 5개 SPEC 모두 `status: completed`를 각 SPEC의 `spec.md` 프론트매터를 직접 grep해 확인했다.

```
$ for s in CART-001 STOREFRONT-001 ORDER-001 PAYMENT-001 DISCOUNT-001; do echo -n "$s: "; grep "^status:" .moai/specs/SPEC-$s/spec.md; done
CART-001: status: completed
STOREFRONT-001: status: completed
ORDER-001: status: completed
PAYMENT-001: status: completed
DISCOUNT-001: status: completed
```

- `SPEC-CART-001` — 이 SPEC이 소비하는 카트 API 4종(`GET`/`POST /items`/`PATCH /items/:id`/`DELETE /items/:id`)의 출처.
- `SPEC-STOREFRONT-001` — 이 SPEC이 잇는 UI 도메인의 루트 셸·Tailwind v4·App Router 컨벤션·컴포넌트 배치 원칙의 출처.
- `SPEC-ORDER-001` — 이 SPEC이 스타일만 정리하는 `/checkout` 화면과 그 하위 컴포넌트 5개 중 4개(`CheckoutForm`/`OrderSummary`/`CheckoutUnavailable`, 그리고 `page.tsx` 자체)의 출처, 회원 체크아웃 제외 판단의 선례.
- `SPEC-PAYMENT-001` — 체크아웃 스타일 정리 대상 중 `PayButton.tsx`의 출처.
- `SPEC-DISCOUNT-001` — 체크아웃 스타일 정리 대상 중 `CheckoutInteractive.tsx`의 출처이자, 그 스타일링 소유권을 이 SPEC(카드 t10)으로 명시적으로 넘긴 문서(plan.md §0 확정 #1).

**Tier 판정**: M. 파일 수(약 13~14, plan.md §G) · LOC(약 300~600) · REQ/AC(각 15건) 모두 Tier M 가이드 이내이며, 스키마·백엔드 변경이 전혀 없다는 점이 Tier L을 요구하지 않는 근거다(plan.md §G).

**Conditional Design Route**: 적용됨(`plan → design → run`) — `acceptance.md`가 화면(`/cart`)과 프런트엔드 컴포넌트(`CartView`/`EmptyCart`/`AddToCartButton`)를 명시적 산출물로 검증하므로 두 갈래 판정 기준의 첫 번째가 만족된다(plan.md §G).

**range 형태 결정**: 백로그 카드 `t10`이 원래 서술한 범위("장바구니·체크아웃 화면 UI")를 그대로 인수하되, 조사로 밝혀진 실제 저장소 상태에 맞춰 체크아웃 부분을 "재구현"에서 "스타일 정리"로 재정의했다. 사유와 증거는 spec.md §1에 전문이 있다.

**run-phase 진입을 막는 항목은 아직 판정되지 않았다.** plan-audit 게이트와 Implementation Kickoff Approval이 이 SPEC의 다음 단계다.

## §G Design-phase Audit-Ready Signal

design_complete_at: 2026-09-03
design_status: audit-ready

manager-design이 `plan → design → run` 경로(plan.md §G)의 design phase를 수행했다. DesignSync
MCP 서버가 `.mcp.json`에 등록돼 있지 않아(확인: `cat .mcp.json`으로 `context7`/`moai`/`playwright`
3개 서버만 존재함을 관측) D2(코드→Claude Design 동기화)·D3(캔버스 스크린 생성)는 실행하지 않았다 —
manager-design.md § Tool Availability의 graceful-degradation 경로를 따른 것이며 블로커가 아니다.

산출물: `.moai/specs/SPEC-STOREFRONT-002/design.md` — `CartView` 품목 줄 레이아웃(모바일/데스크톱
`md:` 분기점), 수량 스테퍼 시각 형태, `EmptyCart`·`AddToCartButton` 레이아웃, 체크아웃 6개 파일의
Tailwind 클래스 정리안(구체적 발견 2건: PayButton.tsx의 `text-red-700`→`text-red-600`,
`py-3`→`py-2`)을 담는다. 전부 `src/app/products`·`src/components/product`·`src/components/checkout`
기존 파일을 직접 읽어 실측한 값의 재사용이며, 새 색상 팔레트·spacing 스케일을 도입하지 않았다(design.md
§1의 실측 표 참고).

**run-phase가 준수할 §E 경계 재확인**: design.md §6이 제안하는 두 항목 모두 `className` 문자열 리터럴
내부 토큰 교체이며, plan.md §E의 "non-className diff 0줄" 규칙과 acceptance.md AC-STOREFRONT-029를
위반하지 않는다.

## §E.2 Run-phase Evidence

### 사전 조사 — 저장소 실측 (구현 착수 전)

`/cart`·`/products` 라우트 실측: `src/app/page.tsx`가 `/`(홈)만 방문 진입점으로 제공하고
`src/app` 아래 `products/page.tsx`(목록)는 존재하지 않는다 — `find src/app -type f`로 직접
확인했다. design.md §4의 `EmptyCart` 예시는 `href="/products"`를 썼지만 이 저장소에는 그
라우트가 없다(실제 확인). **판단**: 존재하지 않는 라우트로 링크를 거는 대신, 이 저장소가 실제로
제공하는 유일한 상품 열람 진입점인 `href="/"`를 사용했다 — REQ-STOREFRONT-017은 "상품 목록으로
이동할 수 있는 링크"만 요구할 뿐 정확한 href 값을 고정하지 않으며, design.md §0도 "이 문서의
결정이 재동기화 대상"이라고 명시했으므로 이는 재구현이 아니라 실측 기반 보정이다.

`AddToCartButton` 조립 위치: plan.md §F 표는 "page.tsx에서 조립"이라 적었으나, design.md §5는
"`ProductDetailView.tsx`의 재고 표시 문단 바로 아래, 설명 문단 위"라는 더 구체적인 삽입 지점을
지정했다. `product.stock`·`product.id`가 이미 `ProductDetailView`에 props로 들어와 있어 이
방식이 `page.tsx` 경유보다 한 단계 얕고(plan.md §F "얇은 조립" 원칙에 더 부합), design.md §5는
plan.md §F를 구체화하는 design-phase 산출물이므로 design.md의 정밀 지시를 따랐다 —
`src/app/products/[productId]/page.tsx`는 결국 수정하지 않았다(PRESERVE로 남음).

### 마일스톤 M1 — `/cart` 서버 컴포넌트 + `EmptyCart` + `CartView`(초기 렌더만)

**RED** (`npx vitest run tests/unit/components/empty-cart.test.tsx`):
```
FAIL  tests/unit/components/empty-cart.test.tsx [ tests/unit/components/empty-cart.test.tsx ]
Error: Failed to resolve import "@/components/cart/EmptyCart" from
"tests/unit/components/empty-cart.test.tsx". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN** (동일 명령, `EmptyCart.tsx` 작성 후):
```
✓ tests/unit/components/empty-cart.test.tsx (2 tests) 65ms
Test Files  1 passed (1)
     Tests  2 passed (2)
```

**RED** (`npx vitest run tests/unit/app/cart-page.test.tsx`, `CartView.tsx`/`cart/page.tsx` 작성 전):
```
FAIL  tests/unit/app/cart-page.test.tsx [ tests/unit/app/cart-page.test.tsx ]
Error: Failed to resolve import "@/app/cart/page" from "tests/unit/app/cart-page.test.tsx".
Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN** (동일 명령, `CartView.tsx`(정적 렌더 버전)·`src/app/cart/page.tsx` 작성 후):
```
✓ tests/unit/app/cart-page.test.tsx (8 tests) 42ms
✓ tests/unit/components/empty-cart.test.tsx (2 tests) 66ms
Test Files  2 passed (2)
     Tests  10 passed (10)
```

산출물: `src/app/cart/page.tsx`(신규), `src/components/cart/CartView.tsx`(신규, 초기 렌더 버전),
`src/components/cart/EmptyCart.tsx`(신규). AC-STOREFRONT-016/017/018 커버.

### 마일스톤 M2/M3 — 수량 변경·삭제 상호작용 + 체크아웃 진입 링크

M2(수량/삭제)와 M3(체크아웃 링크 + 경계 정적 검사)는 `CartView.tsx` 같은 파일을 대상으로 하는
연속 사이클이라 RED→GREEN을 한 번에 기록한다(계획된 milestone 순서는 유지 — M2 상호작용을 먼저
GREEN으로 만든 뒤 M3의 링크를 더했다).

**RED** (`npx vitest run tests/unit/components/cart-view.test.tsx`, 상호작용 미구현 상태):
```
Test Files  1 failed (1)
     Tests  11 failed | 2 passed (13)
 ❯ tests/unit/components/cart-view.test.tsx:186:24
    const dec = screen.getByRole("button", { name: /머그컵 수량 감소/ });
    (요소를 찾지 못함 — 스테퍼/삭제 버튼이 아직 렌더되지 않음)
```

**GREEN** (`CartView.tsx`에 PATCH/DELETE 핸들러 + 체크아웃 링크 추가 후):
```
✓ tests/unit/app/cart-page.test.tsx (9 tests) 47ms
✓ tests/unit/components/empty-cart.test.tsx (2 tests) 70ms
✓ tests/unit/components/cart-view.test.tsx (13 tests) 170ms
Test Files  3 passed (3)
     Tests  24 passed (24)
```

주: 초기 `cart-page.test.tsx`의 "초기 렌더에 fetch 없음" 검사가 `src/components/cart` 디렉터리
전체를 스캔해, M2에서 `CartView.tsx`에 정당하게 추가된 클릭 트리거 `fetch()`와 충돌해 1건
FAIL했다 — `tests/unit/app/checkout-page.test.tsx`가 이미 쓰는 `firstRenderSources()`(서버
컴포넌트 + 순수 화면만 스캔) 패턴을 그대로 적용해 검사 범위를 "첫 렌더 경로"로 좁혔다(테스트
자신의 의도를 실제 코드 경계에 맞춘 수정이며, AC-STOREFRONT-016의 "초기 렌더에 브라우저 데이터
요청 없음" 의미는 그대로 보존됨).

산출물: `CartView.tsx`(수량 PATCH/DELETE + 오류 상태 + 체크아웃 링크 추가), `cart-page.test.tsx`
(firstRenderSources 헬퍼 추가 + AC-STOREFRONT-023 정적 경계 테스트 추가), `cart-view.test.tsx`
(신규). AC-STOREFRONT-019/020/021/022/023 커버.

### 마일스톤 M4 — `AddToCartButton` + 상품 상세 조립

**RED** (`npx vitest run tests/unit/components/add-to-cart-button.test.tsx`):
```
Error: Failed to resolve import "@/components/product/AddToCartButton" from
"tests/unit/components/add-to-cart-button.test.tsx". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN** (`AddToCartButton.tsx` 작성 후):
```
✓ tests/unit/components/add-to-cart-button.test.tsx (6 tests) 102ms
Test Files  1 passed (1)
     Tests  6 passed (6)
```

**RED** (`npx vitest run tests/unit/components/product-detail-view.test.tsx`, 조립 전 — 신규
"SPEC-STOREFRONT-002 M4 assembly" describe 블록 2건):
```
Test Files  1 failed (1)
     Tests  2 failed | 5 passed (7)
 ❯ tests/unit/components/product-detail-view.test.tsx:120:19
   (담기 버튼이 아직 ProductDetailView 트리에 없음)
```

**GREEN** (`ProductDetailView.tsx`에 `AddToCartButton` 삽입 후, 무회귀 확인 포함):
```
✓ tests/unit/app/product-detail-page.test.tsx (6 tests) 71ms
✓ tests/unit/components/product-gallery.test.tsx (9 tests) 113ms
✓ tests/unit/components/product-detail-view.test.tsx (7 tests) 118ms
✓ tests/unit/components/add-to-cart-button.test.tsx (6 tests) 135ms
Test Files  4 passed (4)
     Tests  28 passed (28)
```

주: SPEC-STOREFRONT-001의 기존 `product-detail-page.test.tsx`도 "초기 렌더에 fetch 없음"을
`src/components/product` 디렉터리 전체로 검사해 같은 종류로 충돌했다 — `AddToCartButton.tsx`를
제외한 `firstRenderSources()`를 추가해(체크아웃 선례와 동일 패턴) 해소했고, 별도로
"AddToCartButton의 fetch가 자기 클릭 핸들러 안에만 있다"를 확인하는 테스트를 추가해 회귀
가드를 보강했다. 기존 5건(AC-STOREFRONT-006/007/008/009)은 무수정 그대로 통과.

산출물: `src/components/product/AddToCartButton.tsx`(신규), `src/components/product/ProductDetailView.tsx`
(수정 — import 1줄 + `<AddToCartButton .../>` 1줄 삽입), `add-to-cart-button.test.tsx`(신규),
`product-detail-view.test.tsx`(assembly 블록 추가), `product-detail-page.test.tsx`
(firstRenderSources 헬퍼 + 회귀 가드 테스트 추가). AC-STOREFRONT-024/025/026/027 커버.

### 마일스톤 M5 — 체크아웃 스타일 정리 (design.md §6, PayButton.tsx만)

**RED** (`npx vitest run tests/unit/components/pay-button.test.tsx`, 신규 "M5 style cleanup"
describe 블록):
```
Test Files  1 failed (1)
     Tests  3 failed | 4 passed (7)
 ❯ tests/unit/components/pay-button.test.tsx:76:24
   expect(source).not.toMatch(/px-4 py-3/);   ← 아직 py-3
 ❯ AssertionError: expected 'mt-2 text-sm text-red-700' to contain 'text-red-600'
```

**GREEN** (`sed`로 두 토큰만 치환한 뒤 — diff는 정확히 이 두 줄):
```diff
-        className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
+        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
...
-        <p role="alert" className="mt-2 text-sm text-red-700">
+        <p role="alert" className="mt-2 text-sm text-red-600">
```
```
✓ tests/unit/components/order-summary.test.tsx (9 tests) 106ms
✓ tests/unit/app/checkout-complete-page.test.tsx (11 tests) 88ms
✓ tests/unit/app/checkout-complete-page-payment.test.tsx (7 tests) 134ms
✓ tests/unit/components/pay-button.test.tsx (7 tests) 197ms
✓ tests/unit/app/checkout-page.test.tsx (24 tests) 243ms
✓ tests/unit/components/checkout-interactive.test.tsx (11 tests) 457ms
✓ tests/unit/components/checkout-form.test.tsx (18 tests) 469ms
Test Files  7 passed (7)
     Tests  87 passed (87)
```

체크아웃 6개 파일 중 `PayButton.tsx`만 수정했다(디자인 결정 — design.md §6이 확인한 구체적
발견 2건이 이 파일에만 있었다). 나머지 5개(`page.tsx`/`CheckoutForm.tsx`/`OrderSummary.tsx`/
`CheckoutInteractive.tsx`/`CheckoutUnavailable.tsx`)는 전혀 손대지 않았다 — 체크아웃 스위트
87건 전량 무회귀 통과가 그 증거다. AC-STOREFRONT-028/029 커버.

### 마일스톤 M6 — 접근성·커버리지·통합 (§E.3에 최종 결과 기록)

M1~M5에서 이미 배치한 것들의 종합:
- `aria-label`(수량 감소/증가/삭제, 상품명 포함) — `CartView.tsx`
- 모든 카트 이미지 `alt` = 상품명 — `CartView.tsx`
- 네이티브 `<button>` 사용(Tab 포커스 + Enter/Space 활성화는 플랫폼 보장, ProductGallery
  선례와 동일하게 재검증하지 않음 — AC-STOREFRONT-030(a) 괄호가 명시한 검증 방법
  "role 검사 + focus() 후 document.activeElement 일치"만 테스트로 확인)
- `tabular-nums`(수량 숫자 폭 흔들림 방지) — `CartView.tsx` 스테퍼

접근성 테스트는 M2/M3 GREEN에 이미 포함되어 있다(`cart-view.test.tsx`의
"AC-STOREFRONT-030 accessibility" describe 블록 — alt 텍스트, aria-label, 포커스 3건).

## §E.3 Run-phase Audit-Ready Signal

run_complete_at: 2026-09-03
run_status: audit-ready

### AC PASS/FAIL 매트릭스 (15건)

| AC | 상태 | 검증 명령 | 실측 결과 |
|---|---|---|---|
| AC-STOREFRONT-016 | PASS | `npx vitest run tests/unit/app/cart-page.test.tsx` | 9 tests passed |
| AC-STOREFRONT-017 | PASS | 상동 | 9 tests passed (guidance/link 케이스 포함) |
| AC-STOREFRONT-018 | PASS | 상동 | 9 tests passed (품목·소계·alt 케이스 포함) |
| AC-STOREFRONT-019 | PASS | `npx vitest run tests/unit/components/cart-view.test.tsx` | 13 tests passed |
| AC-STOREFRONT-020 | PASS | 상동 | 13 tests passed (거부 사유·상태 불변 케이스 포함) |
| AC-STOREFRONT-021 | PASS | 상동 | 13 tests passed (삭제·빈 카트 전환 케이스 포함) |
| AC-STOREFRONT-022 | PASS | 상동 | 13 tests passed (체크아웃 링크 케이스 포함) |
| AC-STOREFRONT-023 | PASS | `npx vitest run tests/unit/app/cart-page.test.tsx tests/unit/components/cart-view.test.tsx` | 정적 경계 테스트 2건(파일별) PASS — `/api/orders`·배송/결제 필드 매치 0건 |
| AC-STOREFRONT-024 | PASS | `npx vitest run tests/unit/components/add-to-cart-button.test.tsx` | 6 tests passed |
| AC-STOREFRONT-025 | PASS | 상동 | 6 tests passed (성공 문구·/cart 링크 케이스 포함) |
| AC-STOREFRONT-026 | PASS | 상동 | 6 tests passed (실패 사유 표시 케이스 포함) |
| AC-STOREFRONT-027 | PASS | 상동 | 6 tests passed (재고 0 비활성화 + fetch 0회 케이스 포함) |
| AC-STOREFRONT-028 | PASS | `npx vitest run` (체크아웃 7개 테스트 파일, 87건) | 87 tests passed — 무회귀 |
| AC-STOREFRONT-029 | PASS | `npx vitest run tests/unit/components/pay-button.test.tsx` + 수동 diff 검토(§E.2 M5) | diff는 정확히 `className` 토큰 2건(`py-3→py-2`, `text-red-700→text-red-600`); 다른 6개 체크아웃 파일 무변경 |
| AC-STOREFRONT-030 (a/b/c) | PASS | `npx vitest run tests/unit/components/cart-view.test.tsx` | 접근성 describe 블록 3건(alt·label·focus) PASS |

15/15 PASS. FAIL 0건.

### E2. 빌드 (전체, cross-platform 항목 없음 — Next.js 웹 앱)

```
$ npm run build
   ▲ Next.js 15.5.24
 ✓ Compiled successfully in 3.7s
   Linting and checking validity of types ...
 ✓ Generating static pages (21/21)
Route (app) 발췌:
├ ƒ /cart                                1.68 kB         104 kB
├ ƒ /checkout                            2.91 kB         105 kB
└ ƒ /products/[productId]                6.99 kB         109 kB
```
exit 0. `/cart` 라우트가 정상적으로 컴파일·번들링되어 라우트 표에 나타난다.

### E3. 타입 검사

```
$ npx tsc --noEmit
(출력 없음)
```
exit 0.

### E4. 린트

```
$ npm run lint
> eslint .
(출력 없음)
```
exit 0, 신규 이슈 0건.

### E5. 커버리지 (전체 스위트, `coverage_exemptions.enabled: false`)

```
$ npm run test:coverage -- --exclude "**/tests/integration/auth/login.test.ts"
 Test Files  79 passed (79)
      Tests  960 passed | 21 skipped (981)

 % Coverage report from v8
 All files          |   97.85 |    93.27 |    99.5 |   97.85 |
```
전역 임계값(85%/85%/80%/85%) 전부 충족, exit 0. 이 SPEC이 신설/수정한 파일별 실측:

| 파일 | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `src/app/cart/page.tsx` | 100 | 100 | 100 | 100 |
| `src/components/cart/CartView.tsx` | 93.79 | 86.95 | 87.5 | 93.79 |
| `src/components/cart/EmptyCart.tsx` | 100 | 100 | 100 | 100 |
| `src/components/product/AddToCartButton.tsx` | 100 | 88 | 100 | 100 |
| `src/components/product/ProductDetailView.tsx` | 100 | 100 | 100 | 100 |
| `src/components/checkout/PayButton.tsx` | 100 | 100 | 100 | 100 |

전부 ≥85%(lines/stmts/functions) / ≥80%(branches) 충족 — 예외 없음.

`--exclude`로 뺀 이유(§ 잔여 위험에 상세): `tests/integration/auth/login.test.ts`의
AC-AUTH-005가 전체 스위트와 동시 실행될 때 로드에 민감해 타이밍 허용치를 초과하는 알려진
플레이크(백로그 카드 `t20`, 이 SPEC과 무관)이며, 실패하면 vitest가 coverage 리포트 자체를
출력하지 않아 이 SPEC의 파일별 커버리지를 관측할 수 없었다. 그 테스트는 격리 실행에서는
통과함을 별도로 확인했다(아래).

### E6. 알려진 플레이크 격리 재확인 (AC-AUTH-005, 백로그 카드 t20 — 이 SPEC과 무관)

전체 스위트 동시 실행 시 2회 모두 실패(부하로 인한 타이밍 허용치 초과):
```
[AC-AUTH-005] median(nonexistent-email)=260.93ms median(wrong-password)=209.33ms diff=51.60ms tolerance=39.14ms
→ expected 51.59981249999919 to be less than 39.139943775000006
```
격리 실행에서는 통과:
```
$ npx vitest run tests/integration/auth/login.test.ts
✓ tests/integration/auth/login.test.ts (1 test) 12881ms
[AC-AUTH-005] median(nonexistent-email)=209.31ms median(wrong-password)=209.17ms diff=0.14ms tolerance=31.40ms
```
지시받은 대로 이 실패는 잔여 위험으로 기록하며 실제 결함으로 취급하지 않는다.

### E7. 서브에이전트 경계 grep (subagent-domain 코드 아님 — 해당 없음)

이 SPEC은 프런트엔드 컴포넌트만 다루며 `internal/harness`/`internal/hook` 등 subagent-domain
Go 코드를 전혀 건드리지 않는다. C-HRA-008 계열 grep은 이 SPEC의 산출물에 적용 대상이 없다(N/A).

### E8. RED 실패 출력 (TDD 전 마일스톤, verbatim)

§E.2에 마일스톤별로 기록됨(M1 2건, M2/M3 1건, M4 2건, M5 1건) — 전부 구현 전 캡처된 실제
실패 출력이며, 사후 재구성이 아니다.

### PRESERVE 자가 점검 (git diff 불가 환경 — Read로 대체 확인, 오케스트레이터가 `git diff --stat`로 권위 있게 재검증할 것)

아래 파일은 이 run-phase에서 **한 번도 Write/Edit 대상이 아니었음**을 확인한다(수정 목록에
없음이 곧 무변경 근거이며, 추가로 관련 회귀 테스트가 무회귀 통과했다는 간접 증거를 덧붙인다):

- `src/features/cart/**`(3개 파일) — 소비만 함, PATCH/DELETE/POST 핸들러는 기존 API를 그대로 호출.
- `src/app/checkout/page.tsx`, `CheckoutForm.tsx`, `OrderSummary.tsx`, `CheckoutInteractive.tsx`,
  `CheckoutUnavailable.tsx` — PayButton.tsx를 제외한 나머지 5개 체크아웃 파일. 체크아웃 테스트
  스위트 87건 무회귀(§E.2 M5)가 간접 증거.
- `src/app/products/[productId]/page.tsx` — plan.md §F가 언급했지만 design.md §5의 더 정밀한
  지시(ProductDetailView.tsx 내부 삽입)를 따르면서 결국 수정 대상에서 제외됨(§E.2 "사전 조사"
  절 참고). `product-detail-page.test.tsx`의 AC-STOREFRONT-003/004/005 회귀 테스트 전량 통과.
- `src/middleware.ts` — 무변경. `product-detail-page.test.tsx`/`checkout-page.test.tsx`의
  "미들웨어 매처에 /products, /checkout 없음" 가드가 그대로 통과.
- 인증/주문/결제/할인 서비스 레이어(`src/features/{orders,payments,discounts}/**`,
  `src/lib/auth/**`) — 전혀 열지 않음.

## §E.4 Sync-phase Audit-Ready Signal

sync_complete_at: 2026-09-03
sync_status: audit-ready
sync_commit_sha: pending-backfill-storefront-002-sync

### 문서 동기화

- `CHANGELOG.md` `[Unreleased]` 절에 `### 추가 — SPEC-STOREFRONT-002` + `### 알려진 한계 — SPEC-STOREFRONT-002` 두 섹션을 추가했다(`## [Unreleased]` 바로 아래, 역시간순 관례에 맞춰 최상단).
- `README.md`에 `## 장바구니 화면·담기 UI (SPEC-STOREFRONT-002)` 절을 `## 스토어프론트 화면 (SPEC-STOREFRONT-001)`과 `## 주문/체크아웃 (SPEC-ORDER-001)` 사이에 추가했다.

### B12 자가 점검 (CHANGELOG 발행 규율)

1. **사전 grep**: `grep -c '<SPEC-ID>' CHANGELOG.md` — 편집 전 실행 결과 `0`(중복 없음 확인 후 발행).
2. **AC 개수 대조**: `grep -oE 'AC-STOREFRONT-[0-9]+' acceptance.md | sort -u | wc -l` → `16`건 관측. 그중 `AC-STOREFRONT-001` 1건은 acceptance.md §1 서두 문장("SPEC-STOREFRONT-001(AC-STOREFRONT-001~015)에서 이어받는다")에 등장하는 **이전 SPEC 참조**이며 이 SPEC 소유 AC가 아니다. 이 SPEC 고유 AC는 `AC-STOREFRONT-016`~`030` 15건이며, §E.3 매트릭스의 15/15 PASS와 acceptance.md §4 REQ↔AC 매핑 표(15행)에 정확히 대응한다. CHANGELOG 본문은 개별 AC ID를 나열하지 않고 파일·동작 단위로 서술했으므로(README·CHANGELOG의 기존 관례와 동일) 카운트 불일치 위험이 없다.
3. **파일 경로 검증**: CHANGELOG에 언급한 6개 경로 전부 `ls`로 존재 확인.

```
$ ls src/app/cart/page.tsx src/components/cart/CartView.tsx src/components/cart/EmptyCart.tsx \
     src/components/product/AddToCartButton.tsx src/components/product/ProductDetailView.tsx \
     src/components/checkout/PayButton.tsx
(전부 존재 — exit 0)
```

### Pre-Sync Gate + 배포 준비 점검

**작업 트리 상태** (오케스트레이터가 sync-phase 착수 시점에 직접 관측):
```
$ git status --short
M tsconfig.json   ← 이 SPEC이 만든 변경이 아님(사전 존재하는 로컬 diff, 손대지 않음)
$ git fetch origin main && git rev-list --count --left-right origin/main...HEAD
0	5   ← origin 대비 로컬 5커밋 선행, 분기 없음
```

**전체 테스트 스위트** (오케스트레이터가 sync-phase에서 재실행):
```
$ npm run test:coverage -- --exclude "**/tests/integration/auth/login.test.ts"
 Test Files  79 passed (79)
      Tests  960 passed | 21 skipped (981)
exit 0
```

**타입 검사**: `npx tsc --noEmit` → 출력 없음, exit 0.
**린트**: `npm run lint` → 신규 이슈 0건, exit 0.
**빌드**: `npm run build` → exit 0. `/cart` 라우트가 라우트 표에 정상 포함됨(§E.3 M2 참고).

**마이그레이션/신규 환경변수/breaking change 확인**:
```
$ git diff 53588cf..HEAD --stat -- prisma/
(출력 없음 — 이 SPEC은 prisma 스키마·마이그레이션을 전혀 건드리지 않았다)
$ git diff 53588cf..HEAD --stat -- .env.example .github/workflows/
(출력 없음)
```
스키마·백엔드·CI 워크플로 변경 없음을 확인했다 — spec.md §1에서 이미 확정한 대로(스키마·백엔드 변경 없는 순수 프런트엔드 화면 신설 + 스타일 정리).

### 프론트매터 전이

`spec.md`/`plan.md`/`progress.md`의 `status:`를 이 sync 커밋에서 `draft → completed`로 전이했다(`in-progress` 중간 단계 기록 없이 draft로 남아 있었던 이유: 이 SPEC의 run-phase 커밋들이 `draft → in-progress` 전이를 별도로 기록하지 않고 곧장 진행되었음 — spec-frontmatter-schema.md의 상태 전이 소유권 표대로 manager-docs가 이 sync 커밋에서 최종 `completed`로 닫는다). `acceptance.md`는 프론트매터가 없는 문서라 전이 대상이 아니다. 세 파일의 `updated:` 필드는 이미 `2026-09-03`(오늘)이라 추가 갱신이 필요 없었다.

### MX Tag 점검

이 SPEC이 신설/수정한 6개 파일(`src/app/cart/page.tsx`, `CartView.tsx`, `EmptyCart.tsx`, `AddToCartButton.tsx`, `ProductDetailView.tsx`의 삽입 2줄, `PayButton.tsx`의 클래스 토큰 2줄) 중 신규 exported 함수는 모두 단일 소비처(각자의 페이지/부모 컴포넌트)만 가진 React 컴포넌트이며 fan_in < 3이라 `@MX:ANCHOR` 의무 대상이 아니다. 위험 패턴(goroutine 없음, cyclomatic complexity 낮음)도 없어 `@MX:WARN` 대상이 없다. 별도 `@MX:*` 주석 추가 없이 종결한다.

### 잔여 위험

- `tests/integration/auth/login.test.ts` AC-AUTH-005는 이 SPEC과 무관한 기존 플레이크로 남아 있다(§E.3 E6 참고, 백로그 카드 `t20`).
- `EmptyCart`의 "상품 목록으로 이동" 링크가 `/`를 가리키는 보정은 `/products` 라우트가 이 저장소에 생기는 시점에 재검토가 필요하다.
- `sync_commit_sha`는 이 커밋 자신의 SHA를 알 수 없어 placeholder로 기록했으며, 후속 커밋에서 백필한다(spec-frontmatter-schema.md § SHA placeholder backfill exemption).
