---
id: SPEC-E2E-001
title: "결제·주문 경로 E2E 테스트 시나리오 (게스트 전용)"
version: "0.1.0"
status: draft
created: 2026-09-05
updated: 2026-09-05
author: snake
priority: P1
phase: "v0.2.0 target"
module: "e2e"
lifecycle: spec-anchored
tags: "e2e, playwright, checkout, payment, browser-test, guest"
tier: M
depends_on: [SPEC-ORDER-001, SPEC-PAYMENT-001]
related_specs: [SPEC-CART-001, SPEC-DISCOUNT-001, SPEC-STOREFRONT-001, SPEC-STOREFRONT-002, SPEC-STOREFRONT-003, SPEC-CI-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-05 | 0.1.0 | draft | plan-phase 최초 작성. 저장소에 브라우저 레벨 E2E 테스트가 **하나도 없는** 상태를 해소한다. SPEC-STOREFRONT-001/002/003이 각각 "Playwright E2E는 별도 SPEC"으로 미뤄둔 작업이 이 SPEC이다. 범위 경계 4건(결제 모킹 방식, 동시성 제외, 여정 구간, 게스트 전용)은 plan-phase 진입 전 사용자와 확정했다 — §3에 그대로 기록한다. |

---

## §1. 개요

### 1.1 무엇을 만드는가

이 SPEC은 두 가지를 한 번에 세운다.

1. **E2E 도구 기반** — 이 저장소에 없는 브라우저 자동화 하네스(Playwright)를 도입한다. 현재 `playwright.config.*`도, `e2e/` 디렉터리도, `test:e2e` 스크립트도, CI의 브라우저 잡도 존재하지 않는다.
2. **첫 번째 여정 스위트** — 실제 결제·주문 경로(장바구니 → `/checkout` → 결제 → 주문 완료)를 실제 브라우저·실제 HTTP·실제 서버로 훑는 시나리오를 작성한다.

### 1.2 왜 지금 필요한가 — 기존 스위트가 구조적으로 못 보는 층

현재 검증 스위트는 110개 테스트 파일의 Vitest(node/jsdom) 단위·통합 테스트다. 이 스위트는 **핸들러 함수를 직접 호출**하거나 **컴포넌트를 jsdom에 마운트**한다. 두 방식 모두 **실제 HTTP 요청을 만들지 않는다.**

그 결과 다음 층이 통째로 검증되지 않은 채 남는다.

| 검증되지 않는 층 | 이유 |
|---|---|
| `src/middleware.ts` | 핸들러 직접 호출은 미들웨어를 경유하지 않는다 |
| Next.js 라우팅 · 리다이렉트 체인 | `NextResponse.redirect()`의 실제 추종은 브라우저만 한다 |
| 서버 컴포넌트 렌더 → 클라이언트 하이드레이션 경계 | jsdom 마운트는 서버 렌더 단계를 건너뛴다 |
| 쿠키의 실제 왕복(`Set-Cookie` → 후속 요청 첨부) | 테스트는 쿠키 값을 직접 주입한다 |
| 최상위 내비게이션이 커스텀 헤더를 못 싣는다는 사실 | fetch 모킹으로는 재현되지 않는다 |

**구체적 선례.** `/admin/*` 라우트가 미들웨어에 막혀 실제로는 도달 불가능한 상태였는데, 당시 전체 단위·통합 스위트와 plan-audit을 모두 통과했다. 핸들러를 직접 호출하는 테스트는 `src/middleware.ts`를 지나가지 않기 때문이다 — 초록색 스위트가 "라우트가 동작한다"를 증명하지 못한 사례다.

이 사례는 **이 SPEC의 동기**이지 검증 대상이 아니다. `/admin/*`은 별개의 표면이며 이 SPEC의 여정에 포함되지 않는다(§3.4). 여기서 끌어오는 교훈은 하나뿐이다 — *실제 브라우저가 실제 서버를 때리지 않으면 도달 가능성 자체가 미검증으로 남는다.*

### 1.3 이 SPEC이 만들지 않는 것

기존 SPEC들이 단위·통합 레벨에서 이미 검증한 로직은 **다시 검증하지 않는다.** 이 스위트는 도메인 규칙의 재확인이 아니라 **경로의 도달 가능성과 연결**을 확인한다. 테스트 피라미드에서 E2E는 전체의 10% 수준을 넘지 않아야 하며, 이 SPEC은 그 상한 안에서 여정 하나를 덮는다.

| 이미 덮여 있는 것 | 소유 SPEC |
|---|---|
| 장바구니 CRUD · 게스트 쿠키 | SPEC-CART-001 |
| `/checkout` 폼 검증 · 주문 생성 | SPEC-ORDER-001 |
| 재고 차감 동시성 | SPEC-ORDER-002 |
| 주문 조회 | SPEC-ORDER-003 |
| Toss 연동 · 웹훅 · 멱등성 | SPEC-PAYMENT-001 |
| 쿠폰 검증 로직 | SPEC-DISCOUNT-001 |
| 화면 렌더 | SPEC-STOREFRONT-001/002/003 |

---

## §2. 요구사항 (GEARS)

### 2.1 하네스 기반 (REQ-E2E-001 ~ 004)

**REQ-E2E-001** (Ubiquitous)
The E2E suite shall drive the storefront through a real browser against a running Next.js server, so that every navigation traverses `src/middleware.ts` and the real routing chain.

**REQ-E2E-002** (Ubiquitous — 하네스 격리)
The E2E harness shall reside under `e2e/`, shall be invoked by a dedicated npm script separate from the existing `test` script, and shall leave the existing Vitest suite's behaviour, environment, and file layout unchanged, so that `npm test` keeps collecting exactly the files it collects today.

**REQ-E2E-003** (Where — capability gate)
Where the E2E harness starts the application under test, the harness shall wait for the server to become ready before the first scenario runs.

**REQ-E2E-004** (When — event-detected)
When a required E2E environment variable is absent at suite start, the harness shall fail with a message naming the missing variable, rather than starting a run that would silently reach an external host.

### 2.2 Toss 결제 모킹 (REQ-E2E-005 ~ 007)

**REQ-E2E-005** (Unwanted — 최우선 제약)
The E2E suite shall not transmit any request to a Toss Payments host — neither `js.tosspayments.com` nor `api.tosspayments.com` — in any run, and the harness shall secure this by intercepting both the browser-side SDK load and the server-side payment-confirm and payment-query calls, so that the confirm route's own logic still executes against a stubbed approval response instead of being bypassed.

**REQ-E2E-006** (When)
When the browser requests the Toss SDK script `https://js.tosspayments.com/v2/standard`, the E2E harness shall fulfil the request with a stub script that defines `window.TossPayments` with the same call shape the application's loader expects.

**REQ-E2E-007** (While + When 복합절 — 성공/실패 모드)
While the stub SDK is in success mode, when the application invokes `requestPayment`, the stub shall navigate the browser to the `successUrl` the application supplied, carrying a `paymentKey`, the `orderId`, and the `amount` as query parameters; while the stub SDK is in failure mode, the stub shall instead navigate the browser to the `failUrl` the application supplied.

### 2.3 여정 시나리오 (REQ-E2E-008 ~ 014)

**REQ-E2E-008** (When)
When a shopper adds a product to the cart from the product detail page, the cart page shall display that product as a cart line.

**REQ-E2E-009** (When)
When a shopper submits the checkout form with valid values for every required field, the application shall create an order and place the browser on `/checkout/complete/{orderId}`.

**REQ-E2E-010** (When)
When a shopper completes payment through the stub SDK in success mode, the completion screen shall present the order in its paid state and shall no longer present the payment trigger.

**REQ-E2E-011** (When — event-detected)
When payment through the stub SDK fails, the application shall return the shopper to `/checkout/complete/{orderId}?payment_failed=1` with a retry-capable state, and a subsequent success-mode attempt shall reach the paid state.

**REQ-E2E-012** (While — empty cart)
While the guest cart holds no item, when a shopper navigates to `/checkout`, the application shall present the checkout-unavailable screen rather than the order form.

**REQ-E2E-013** (When — event-detected)
When a shopper submits the checkout form with a required field left empty, the application shall refuse the submission and keep the shopper on the checkout screen.

**REQ-E2E-014** (When)
When a shopper applies a valid coupon code on the checkout screen, the order summary shall reflect the discount before the order is submitted.

### 2.4 스위트 품질 (REQ-E2E-015 ~ 016)

**REQ-E2E-015** (Ubiquitous — 스위트 품질)
Each E2E scenario shall establish its own cart and order state without depending on state left behind by another scenario, and shall assert only on shopper-observable outcomes — rendered text, URL, and control availability — rather than on internal module state.

**REQ-E2E-016** (Unwanted)
The E2E suite shall not contain a scenario whose outcome depends on the interleaving of two concurrent actors.

---

## §3. 범위 밖 (out of scope)

아래 네 항목은 **누락이 아니라 확정된 제외**다. plan-phase 진입 전에 사용자와 합의했고, 이후 독자가 "빠뜨린 것"으로 오해하지 않도록 근거와 함께 남긴다.

### Out of Scope — 동시성 및 데이터베이스 경합 시나리오

- 재고 경합(두 구매자가 마지막 재고를 동시에 주문), 롤백 관찰, 트랜잭션 직렬화 검증은 포함하지 않는다.
- 이 스위트의 모든 시나리오는 **단일 행위자의 순차 경로**만 다룬다(REQ-E2E-016, AC-E2E-015가 판정).
- 근거: 동시성 검증은 살아 있는 데이터베이스를 요구하는데, 현재 CI에는 도달 가능한 데이터베이스가 없다 — `.github/workflows/ci.yml`의 `DATABASE_URL`은 루프백을 가리키는 자리표시자이며 테스트 스위트는 Prisma 이음매를 모킹한다. 재고 차감 동시성 자체는 SPEC-ORDER-002가 단위·통합 레벨에서 이미 소유한다.

### Out of Scope — 주문 조회 재방문 화면

- `/orders/lookup` 및 그 파생 화면은 이 여정에 포함하지 않는다.
- 이 SPEC의 여정은 장바구니 → `/checkout` → 결제 → `/checkout/complete/{orderId}` 에서 **끝난다**.
- 근거: 주문 조회는 SPEC-ORDER-003의 표면이며, 그 화면의 재방문 경로는 별도의 신원 조건(쿠키 만료 이후 접근)을 갖는다. 하나의 여정 스위트에 두 신원 모델을 섞지 않는다.

### Out of Scope — 로그인 회원 결제 경로

- "회원으로 로그인한 상태의 결제" 시나리오는 작성하지 않는다.
- 근거: 이 애플리케이션에는 **동작하는 회원 결제 경로가 존재하지 않는다.** SPEC-ORDER-001 §3이 이를 범위에서 제외했고, `409 MEMBER_CHECKOUT_UNSUPPORTED` 가드가 그 결정을 코드로 고정하고 있다. 접근 토큰은 클라이언트 메모리에만 있어(REQ-AUTH-009) 최상위 내비게이션에 실릴 수 없으므로, 결제 화면들은 저장소 전체에서 게스트 전용이다. 따라서 이것은 이 SPEC이 다루지 않기로 한 **구현 불가능한 경로**이지, 지적해야 할 공백이 아니다.

### Out of Scope — `/admin/*` 표면

- 관리자 라우트의 도달 가능성 검증은 이 SPEC에 포함하지 않는다.
- 근거: §1.2의 미들웨어 우회 사례는 이 SPEC의 **동기**로 인용될 뿐 검증 대상이 아니다. `/admin/*`은 결제 여정과 무관한 별개의 표면이고, 그 신원 모델(Bearer 헤더)은 이 스위트가 세우는 게스트 쿠키 모델과 다르다.

### Out of Scope — CI에서의 E2E 실행

- 이 SPEC은 `.github/workflows/ci.yml`을 수정하지 않으며, E2E 잡을 CI에 추가하지 않는다.
- 근거: 브라우저 E2E는 시드 데이터를 담은 실제 데이터베이스를 요구한다. 현재 CI에는 없다(위 동시성 항목과 같은 사실). CI에 데이터베이스 서비스를 세우는 일은 이 SPEC의 도구·시나리오 범위를 넘어서며, SPEC-CI-001은 **이미 완료된 상태**로 CD와 데이터베이스를 명시적으로 범위 밖에 둔 채 닫혔다. 따라서 CI 통합은 후속 SPEC의 몫이다.

### Out of Scope — 테스트 코드 작성

- 이 문서는 plan-phase 산출물이다. Playwright 설정 파일과 시나리오 코드는 run-phase에서 작성한다.

---

## §4. 제약과 전제

### 4.1 실행 환경

- **데이터베이스**: 시드된 상품이 있는 로컬 PostgreSQL이 필요하다. 스위트는 로컬에서 실행된다(§3 CI 항목).
- **필수 환경 변수**: `DATABASE_URL`, `NEXT_PUBLIC_PG_CLIENT_KEY`(없으면 `loadTossPaymentClient`가 스크립트 로드 이전에 던진다), `PG_SECRET_KEY`. 값은 모두 스텁이어도 무방하나 **존재해야** 한다(REQ-E2E-005).
- **Node**: `.nvmrc` = 22.

### 4.2 확정된 코드 표면 (recon 재검증 완료 — 2026-09-05)

위임 프롬프트의 경로 지도 중 두 건이 실제와 달랐다. 아래가 검증된 실제 경로다.

| 대상 | 실제 경로 |
|---|---|
| 홈 / 상품 상세 | `src/app/page.tsx`, `src/app/products/[productId]/page.tsx` |
| 장바구니 | `src/app/cart/page.tsx` → `src/components/cart/CartView.tsx`, `EmptyCart.tsx` |
| 체크아웃 | `src/app/checkout/page.tsx` → `src/components/checkout/CheckoutInteractive.tsx`, `CheckoutForm.tsx`, `OrderSummary.tsx`, `CheckoutUnavailable.tsx` |
| 주문 완료 | `src/app/checkout/complete/[orderId]/page.tsx` → **`src/components/checkout/PayButton.tsx`** (라우트 디렉터리에 동거하지 않음) |
| API | `POST /api/orders`, `GET /api/payments/confirm`, `POST /api/payments/webhook`, `POST /api/discounts/validate` |
| 게스트 신원 | `GUEST_CART_COOKIE_NAME` (`src/lib/auth/guest-identity`) |
| 결제 어댑터 | `src/lib/payment/toss-client.ts`(브라우저), `src/lib/payment/toss-server.ts`(서버) |

### 4.3 체크아웃 폼 필드

`CheckoutForm.tsx`가 수집하는 필드는 정확히 다섯 개다. 라벨은 `htmlFor`/`useId`로 연결되어 있어 접근성 이름으로 선택 가능하다.

| 필드 | 라벨 | 필수 |
|---|---|---|
| `recipientName` | 수령인 이름 | 예 |
| `recipientPhone` | 연락처 | 예 |
| `postalCode` | 우편번호 | 예 |
| `address` | 주소 | 예 |
| `deliveryMemo` | 배송 요청사항 (선택) | 아니오 |

---

## §5. 참고

- 여정 상의 선행 SPEC: SPEC-CART-001, SPEC-ORDER-001, SPEC-PAYMENT-001, SPEC-DISCOUNT-001, SPEC-STOREFRONT-001/002/003
- 명시적으로 범위 밖에 둔 인접 SPEC: SPEC-ORDER-002(동시성), SPEC-ORDER-003(주문 조회)
- CI 현황: SPEC-CI-001(completed) — CI 전용, 배포·데이터베이스 제외
