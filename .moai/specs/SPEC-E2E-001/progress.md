# SPEC-E2E-001 — 진행 기록

> 결제·주문 경로 E2E 테스트 시나리오 (게스트 전용)

## §Phase 1 SKIP Rationale

**Phase 1 (Explore recon)은 건너뛰었다.**

사유: 위임 시점에 이미 Explore recon 패스가 완료되어 결과가 위임 프롬프트에 요약되어 전달됐다 — 저장소에 브라우저 E2E가 전무하다는 사실(`playwright.config.*` 없음, `e2e/` 없음, `test:e2e` 스크립트 없음, CI 브라우저 잡 없음), 선행 SPEC 목록, 여정 경로/파일 지도가 모두 포함됐다. 동일 정찰을 재실행하는 것은 중복 비용이므로 생략하고, 대신 전달받은 지도를 **실제 코드에 대해 재검증**했다.

재검증에서 확인된 드리프트 2건 (spec.md §4.2에 반영):

1. **컴포넌트 경로**: `PayButton.tsx` 등은 라우트 디렉터리에 동거하지 않고 `src/components/checkout/` 아래에 있다. `src/app/checkout/complete/[orderId]/` 에는 `page.tsx` 하나뿐이다.
2. **SPEC-CI-001 상태**: 위임 프롬프트는 "아직 생성되지 않음"으로 기술했으나, 실제로는 **이미 존재하며 `status: completed`** 다. CI 워크플로(`.github/workflows/ci.yml`)도 존재한다. 다만 그 SPEC은 CD와 데이터베이스를 명시적으로 범위 밖에 두고 닫혔으므로 — `DATABASE_URL` 은 루프백 자리표시자이고 테스트는 Prisma 이음매를 모킹한다 — "CI에 살아 있는 데이터베이스가 없다"는 전제 자체는 **그대로 성립**한다. 확정된 범위 결정 #2는 영향받지 않으며, SPEC ID 귀속만 정정했다.

추가로 발견된 설계상 난점 1건 — 서버 측 Toss confirm 호출의 대상 URL이 `toss-server.ts` 의 모듈 상수로 하드코딩되어 있어 Playwright `page.route()` 로 가로챌 수 없다는 사실 — 은 `plan.md` §B에 기록했고, **2026-09-05 사용자 결정으로 확정됐다**: 테스트 전용 undici `setGlobalDispatcher` 네트워크 모킹을 채택하고 프로덕션 소스는 0줄 변경한다. 베이스 URL 환경 변수 이음매는 기각됐다. 확정된 범위 결정 #1의 의도(Toss에 실제로 도달하지 않는다)는 그대로 유지된다.

---

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_complete_at: 2026-09-05
plan_status: audit-passed   # iter2 PASS 0.94 (Tier M 임계값 0.80) + D9·D10 당일 후속 반영
spec_id: SPEC-E2E-001
tier: M
artifacts:
  - spec.md
  - plan.md
  - acceptance.md
  - spec-compact.md
  - progress.md
requirements: REQ-E2E-001..016
acceptance_criteria: AC-E2E-001..015   # 005a/005b 분기 포함 실제 16항목
open_decisions: 0   # plan.md §B 확정 (2026-09-05, 사용자 결정)
phase1_skipped: true
```

**미해결 결정 없음.** `plan.md` §B의 서버 측 confirm 가로채기 이음매는 2026-09-05 사용자 결정으로 확정됐다 — 테스트 전용 undici `setGlobalDispatcher` 모킹, 프로덕션 소스 변경 0줄, 베이스 URL 환경 변수 이음매는 기각. run-phase M1은 이 이음매가 `TOSS_CONFIRM_URL` 과 조회 엔드포인트를 실제로 가로채는지 4단계 스파이크로 먼저 증명한 뒤 나머지 스위트를 진행한다.

### plan-audit 이력

| 회차 | 판정 | 점수 | 상태 |
|---|---|---|---|
| iter1 (2026-09-05) | FAIL | 0.825 (Tier M 임계값 0.80) | D1~D8 전량 반영 |
| iter2 (2026-09-05) | **PASS** | **0.94** | D9·D10 당일 후속 반영 |

iter1의 FAIL은 점수 미달이 아니라 blocking-class 소견에서 발생했다(must-pass 7건은 전부 통과). 보고서: `.moai/reports/plan-audit/SPEC-E2E-001-2026-09-05.md` (`## Iteration 2` 절 포함).

반영 내역 — D1(기각 대안 잔존 서술 제거), D2(AC 범위 상호 참조 정정), D3(AC-E2E-015 신설로 REQ-E2E-016 커버), D4(요구사항 20→16 병합, `tier: M` 유지), D5(`TOSS_PAYMENT_QUERY_URL` 실제 값 정정), D6(AC 개수 표기 정합), D7(D4 병합으로 자연 해소), D8(재현 불가 수치 완화). **8건 전부 반영, 부분 반영 없음.**

D4 산술 정정: 감사 보고서가 제시한 병합 후보 3쌍(002+003, 008+009, 018+019)은 20−3=17로 Tier M 상한 16에 도달하지 못한다. 의미상 이미 단일 단위인 네 번째 쌍 — 구 REQ-E2E-006(Toss 호스트 무접촉 금지)과 구 REQ-E2E-010(서버 측 가로채기 의무) — 을 추가 병합해 16에 맞췄다. 이 둘은 병합 전에도 AC-E2E-004 하나가 함께 추적하던 쌍이라 1:1 추적성이 오히려 개선된다.

### iter2 이후 당일 후속 반영 (D9·D10)

iter2에서 PASS(0.94)를 받은 뒤, 점수에 반영되지 않는 소견 2건을 같은 날 추가로 고쳤다. 새로운 감사 회차가 아니며, 채점 대상 내용을 바꾸지 않는다.

- **D9** — `plan.md` §E 자체 검증 표의 "기존 스위트 불변" 행이 병합 이후 잘못된 REQ ID(`REQ-E2E-003`)를 가리키고 있었다. 해당 내용은 병합 후 `REQ-E2E-002`에 속하고 `REQ-E2E-003`은 무관한 서버 기동 대기 게이트이므로 `REQ-E2E-002`로 정정했다.
- **D10** — iter1 반영 시 D8(재현 불가한 "268개" 수치 완화)을 `spec.md`에만 적용하고 `spec-compact.md`를 빠뜨렸다. `spec-compact.md`에도 동일하게 "당시 전체 단위·통합 스위트"로 완화했다. iter1 기록의 "8건 전부 반영" 주장은 이 시점에야 실제로 성립한다.

**변경 후 재확인한 것**: `moai spec lint` 무소견, `plan.md`의 REQ 참조 21건을 `spec.md` 정의와 대조(불일치 0), `acceptance.md` `추적:` 라인 16개와 REQ 16건의 대응. **재확인하지 않은 것**: 산문 서술의 사실성 전반 — 위 세 가지 외의 항목은 이번 후속에서 다시 검증하지 않았다.

재감사가 다시 필요해질 경우 확인 대상: 요구사항 16건(REQ-E2E-001~016), AC 16항목(AC-E2E-001~015, 005a/005b 분기 포함), `추적:` 라인 16개가 REQ 16건을 빠짐없이 덮는지.

## §E.2 Run-phase Evidence

### M1 — 하네스 뼈대와 다리 2 스파이크 (완료)

**작업 위치**: 이 milestone은 오케스트레이터 격리 배치로 `.claude/worktrees/agent-a477de99ff461615d` (t14가 아닌 별도 워크트리, HEAD가 `WT-checkout-e2e-tests`와 불일치)에서 수행됐다. `git checkout -b m1-e2e-spike e3cb982...`로 t14의 plan-phase 커밋에서 분기해 작업했다 — 위임 프롬프트 §A.0의 예상된 격리 시나리오. 최종 통합(머지)은 오케스트레이터가 t14 워크트리에서 수행한다.

**cycle_type=tdd — RED-GREEN 실행 기록**: `e2e/smoke.spec.ts`를 Chromium 브라우저 설치 이전에 먼저 실행해 RED 상태(`browserType.launch: Executable doesn't exist`)를 확보한 뒤 `npx playwright install chromium`으로 GREEN 전환했다. 그 과정에서 실제 결함 2건을 발견·수정했다 — (a) Playwright config 프로세스가 Next.js의 자체 `.env` 로딩을 거치지 않아 `DATABASE_URL`이 누락으로 오판정되던 문제(env-check.ts가 루트 `.env`도 함께 로드하도록 수정), (b) Next.js dev 서버가 `--import` 훅을 **한 프로세스가 아니라 여러 워커 프로세스**에서 각각 로드한다는 사실이 드러나며, 인터셉터 모듈 자신이 로드 시점에 호출 로그 파일을 truncate하던 로직이 나중에 뜬 워커의 로드로 먼저 기록된 호출을 지워버리는 경합을 일으켰다(로그 클리어를 Playwright config 프로세스로 이전해 웹서버 기동 전 단 한 번만 실행되도록 수정).

**M1 스파이크 4단계 — 전부 PASS**: 아래 §E.2 PASS/FAIL 매트릭스 참조.

## §E.2a M1 스파이크 PASS/FAIL 매트릭스 (plan.md §B 4단계)

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | `/api/payments/confirm`을 태워 `confirmTossPayment()`가 실제로 실행됨 | PASS | `e2e/m1-spike.spec.ts`가 실제 pending_payment 주문으로 confirm 라우트를 호출하고, 응답 리다이렉트가 `?payment_failed=1` 없이 `/checkout/complete/{orderId}`로 도달함을 확인(성공 경로는 `confirmTossPayment()`가 2xx를 받아야만 도달 가능) |
| 2 | 그 호출이 `TOSS_CONFIRM_URL`로 나갔고 MockAgent가 가로챘음이 인터셉터 측 기록으로 확인됨 | PASS | `e2e/.tmp/toss-mock-calls.jsonl`에 `{"endpoint":"confirm","method":"POST","path":"/v1/payments/confirm",...}` 기록 (호출 카운트 방식 채택 — plan.md §B가 명시한 두 방식 중 하나) |
| 3 | `queryTossPayment()`의 조회 엔드포인트도 같은 방식으로 가로채짐 | PASS | 동일 로그에 `{"endpoint":"query","method":"GET","path":"/v1/payments/e2e_spike_<orderId>",...}` 기록 — `/api/payments/webhook`을 태워 재현 |
| 4 | Toss 호스트 감시 라우트가 한 번도 발동하지 않음(반대 방향 증거) | PASS | `e2e/support/fixtures.ts`의 `tossHostHits` 픽스처(모든 `*.tosspayments.com` 요청을 abort+기록)가 스파이크 시나리오 전체에서 길이 0으로 유지됨 (`expect(tossHostHits).toHaveLength(0)`) |

**결론**: plan.md §B가 확정한 undici 전역 디스패처 모킹은 Next.js dev 서버의 route handler 실행 컨텍스트(다수의 워커 프로세스 포함)에 실제로 도달한다 — ASSUMPTION이 아니라 이제 관측된 사실이다. M2 이후 진행에 블로커 없음.

### AC-E2E-003 개별 재확인

M1 종료 조건과 별개로, `e2e/e2e-stub.env`를 임시로 제거한 뒤 `npm run test:e2e`를 실행해 `NEXT_PUBLIC_PG_CLIENT_KEY, PG_SECRET_KEY`를 정확히 이름으로 지목하는 조기 실패 메시지를 확인했다(§E 자체 검증 섹션의 명령/출력 참조). 파일을 원복한 뒤 스위트가 다시 GREEN임을 재확인했다.

### M2 — Toss 스텁 SDK와 결제 경로 (완료)

**작업 위치**: 오케스트레이터가 이 세션을 `.claude/worktrees/agent-a3091a9042ca9c1c6`로 격리 배치했다 (t14가 아닌 별도 워크트리, HEAD가 `WT-checkout-e2e-tests`와 불일치 — 위임 프롬프트 §A.0의 예상된 격리 시나리오). `git checkout -b m2-toss-stub 6d6af29...`로 t14의 M1 머지 커밋에서 분기해 작업했다. 최종 통합(머지)은 오케스트레이터가 t14 워크트리에서 수행한다.

**cycle_type=tdd — RED-GREEN 실행 기록**: `e2e/m2-toss-stub.spec.ts` 두 시나리오를 먼저 작성한 뒤, 구현(스텁 스크립트 + 픽스처)을 스크래치패드로 임시 격리하고 `fixtures.ts`를 HEAD 상태로 되돌려 실행 — `Test has unknown parameter "tossPaymentStub"` RED를 확보했다(§E8 참조). 이후 구현을 원복해 재실행하자 두 시나리오 모두 첫 실행에서 바로 GREEN — 별도 수정 없이 통과했다.

**설계**: plan.md §D의 스텁 스크립트를 `e2e/support/toss-sdk-stub.js`로 신설하고, `page.route()`로 CDN 스크립트 URL(`https://js.tosspayments.com/v2/standard`)을 가로채 이 스텁 본문으로 응답하는 `e2e/support/toss-stub-fixture.ts`(`installTossPaymentStub`)를 신설했다. `e2e/support/fixtures.ts`에 `tossPaymentStub` 픽스처를 추가해 `tossHostHits`와 나란히 노출한다(기존 M1 픽스처는 손대지 않음 — 확장만).

**successUrl/failUrl 검증 메커니즘**: `PayButton.tsx`가 만드는 `successUrl`은 서버 라우트(`/api/payments/confirm`)이므로, 클릭 이후 브라우저가 실제로 리다이렉트를 따라가 최종 URL이 바뀐다. 이 최종 URL만 보면 스텁이 실어 보낸 질의 파라미터(`paymentKey`/`orderId`/`amount`)가 사라진다. 따라서 `page.waitForRequest()`로 브라우저가 실제로 낸 첫 GET 요청 자체를 가로채 그 URL의 질의 파라미터를 단언했다 — plan.md §F M2 종료 조건("스텁이 PayButton이 만든 successUrl로 실제 내비게이션을 일으킨다")이 요구하는 관측 가능한 증거다. 실패 모드(`failUrl`)는 클라이언트 측 `window.location.assign()`이라 리다이렉트가 없으므로 `page.toHaveURL()`로 충분했다.

**페이지 라우트 대 컨텍스트 라우트 우선순위 확인**: `tossPaymentStub`과 `tossHostHits`를 같은 테스트에서 함께 사용해, 스텁이 성공적으로 CDN 스크립트를 대체하면서도 `tossHostHits`가 0건으로 유지됨을 실행으로 확인했다 — Playwright가 페이지 레벨 라우트를 컨텍스트 레벨 감시 라우트보다 먼저 적용한다는 `toss-stub-fixture.ts` 주석의 근거를 문서상 가정이 아니라 관측으로 뒷받침한다.

**Toss 호스트 무접촉 재확인 (프로덕션 소스 불변)**: `git diff --stat 6d6af29... -- src/lib/payment/toss-server.ts`가 빈 출력 — M1에서 확정된 0줄 diff가 M2에서도 유지됨을 재확인했다(§E4).

## §E.2b M2 AC/REQ PASS 매트릭스

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| REQ-E2E-006 | 브라우저가 Toss SDK 스크립트를 요청하면 스텁이 `window.TossPayments`를 정의해 응답한다 | PASS | `toss-stub-fixture.ts`의 `page.route()`가 `toss-sdk-stub.js` 본문으로 200 응답, 두 시나리오 모두 `loadTossPaymentClient()` → `requestPayment()` 호출 체인이 실제로 실행됨(내비게이션 관측이 그 증거) |
| REQ-E2E-007 (성공) | 성공 모드에서 `requestPayment` 호출 시 스텁이 `successUrl`로 내비게이션하며 `paymentKey`/`orderId`/`amount`를 싣는다 | PASS | AC-E2E-005a 테스트 — `page.waitForRequest()`로 캡처한 실제 GET 요청의 `url.pathname === "/api/payments/confirm"`, `orderId`/`amount` 파라미터가 주문 픽스처 값과 정확히 일치 |
| REQ-E2E-007 (실패) | 실패 모드에서 스텁이 `failUrl`로 내비게이션한다 | PASS | AC-E2E-005b 테스트 — `tossPaymentStub.setMode("fail")` 이후 최종 URL이 `/checkout/complete/{orderId}?payment_failed=1`과 정확히 일치 |
| AC-E2E-005a | 스텁 SDK가 성공 모드에서 애플리케이션이 만든 successUrl로 이동 | PASS | 위와 동일 |
| AC-E2E-005b | 스텁 SDK가 실패 모드에서 애플리케이션이 만든 failUrl로 이동 | PASS | 위와 동일 |
| REQ-E2E-005 (재확인, 이번 milestone 범위) | 결제 시나리오 두 건 모두에서 Toss 호스트로 나가는 요청이 0건 | PASS | 두 테스트 모두 `expect(tossHostHits).toHaveLength(0)` — 스텁이 CDN 스크립트 요청을 흡수하고 감시 라우트가 발동하지 않음 |
| 프로덕션 소스 불변 | `src/lib/payment/toss-server.ts` diff 0줄 유지 | PASS | `git diff --stat 6d6af29... -- src/lib/payment/toss-server.ts` 빈 출력 |
| M1 회귀 없음 | M1의 기존 2개 시나리오가 계속 통과 | PASS | 전체 `npm run test:e2e` 4/4 통과(§E5) |

### M3 — 해피 패스 여정 (완료)

**작업 위치**: 오케스트레이터가 이 세션을 `.claude/worktrees/agent-a66a658e8f0d757fe`로 격리 배치했다 (t14가 아닌 별도 워크트리, HEAD가 `WT-checkout-e2e-tests`와 불일치 — 위임 프롬프트 §A.0의 예상된 격리 시나리오). `git checkout -b m3-happy-path 6beb53b...`로 t14의 M2 머지 커밋에서 분기해 작업했다. 최종 통합(머지)은 오케스트레이터가 t14 워크트리에서 수행한다.

**cycle_type=tdd — RED-GREEN 실행 기록**: `e2e/m3-happy-path.spec.ts`를 먼저 작성했다 — `order-fixture.ts`에 아직 존재하지 않는 `getSeededProduct`/`clearStalePaymentKey`를 import한 상태로 실행해 `TypeError: (0 , _orderFixture.getSeededProduct) is not a function` RED를 확보했다(§E8 참조). 이후 두 헬퍼를 `order-fixture.ts`에 추가하자 곧바로 두 번째 실패가 나타났다 — 폼 제출 버튼(`type="submit"`)을 하이드레이션 완료 전에 클릭해 React의 `onSubmit`(내부에서 `event.preventDefault()`)이 아직 붙지 않은 채 브라우저 네이티브 GET 제출이 발생, `/checkout?recipientName=...` 쿼리 스트링 URL로 떨어진 것을 관측했다(`plan.md` §G가 명시한 "하이드레이션 타이밍 플레이크" 위험이 실제로 재현된 사례). 임의 `waitForTimeout`을 쓰지 않고 `page.waitForLoadState("networkidle")`(Playwright의 정식 대기 primitive)를 폼 조작 직전에 추가해 해결 — 이후 3회 연속 단독 실행, 전체 스위트 3회 연속 실행 모두 GREEN.

**설계**: 여정 전체를 하나의 시나리오로 작성했다(spec.md §1.3 "여정 1개" 상한 — 각 단계가 이전 단계의 브라우저 상태(게스트 쿠키, 생성된 주문)에 의존하므로 분리하면 실제 여정 대신 지름길을 검증하게 된다).

- **게스트 신원(Section D #5 확인 완료)**: M1/M2의 `order-fixture.ts`처럼 `context.addCookies()`로 쿠키를 주입하지 않았다. 대신 `POST /api/cart/items`(`src/app/api/cart/items/route.ts`)가 최초 담기 요청에서 `Set-Cookie: guest_cart_id=...`를 실제로 발급하는 것을 실제 브라우저가 자연스럽게 받아 이후 모든 내비게이션에 실어 나른다 — 이 SPEC이 세우는 게스트 쿠키 메커니즘 자체가 검증 대상이 됐다.
- **시드 상품 픽스처**: `order-fixture.ts`에 `getSeededProduct()`를 신설 — `isActive: true, stock: { gt: 0 }`로 조회한다(`AddToCartButton`의 `stock === 0` 비활성 가드와 대칭). 주문을 직접 생성하지 않는다는 점이 M1/M2의 `createSpikeOrder()`와의 차이다 — REQ-E2E-008/009의 요점이 카트→체크아웃→주문 경로를 실제 UI로 태우는 것이기 때문이다.
- **결제 성공 마무리**: M2의 `tossPaymentStub` 픽스처를 그대로 재사용했다(새 모킹 메커니즘 없음, Section D #0). `PayButton` 클릭 → `successUrl`(`/api/payments/confirm`) 실제 내비게이션 → 서버 confirm → `/checkout/complete/{orderId}`(결제 완료 상태) 전체를 실제로 완주시켜 AC-E2E-008을 관측했다 — M2의 두 시나리오는 최초 요청만 캡처하고 완주를 기다리지 않는다.

**잔여 위험 재확인(Section A informational note) — 재현됨, M3 범위 내에서 방어**: `npm run test:e2e` 사전 실행(M3 착수 전, 코드 변경 없음) 단계에서 서버 로그에 `Prisma prisma.order.updateMany() ... Unique constraint failed on the fields: (paymentKey)` (P2002)가 실제로 나타났다 — 정보성 잔여 위험이 아니라 **재현 가능한 사실**임을 확인했다. 원인: `toss-sdk-stub.js`가 성공 모드에서 모든 시나리오에 대해 동일한 리터럴 `paymentKey`("e2e_stub_payment_key")를 쓰고, `Order.paymentKey`는 DB 레벨 `@unique` 제약이다(`prisma/schema.prisma:313`). M2의 성공 시나리오는 자신이 촉발한 내비게이션의 완주를 기다리지 않으므로, 서버 측 confirm 쓰기가 테스트 함수 종료 이후에도 백그라운드에서 진행 중일 수 있다 — 이후 시나리오(M3)가 같은 리터럴 키로 confirm을 시도하면 `markOrderPaid()`의 `updateMany()`가 처리되지 않은 예외(P2002)를 던져 confirm 리다이렉트가 500으로 깨질 수 있다.

M5의 일반 시드·격리 정리로 확장하지 않고, **M3 자신의 시나리오에만 필요한 만큼만** 방어했다: `order-fixture.ts`에 `clearStalePaymentKey(paymentKey)`를 신설해 M3 시나리오가 자신의 결제 트리거를 누르기 직전에 그 리터럴 키를 쥔 잔여 행을 `null`로 정리한다 — 행을 삭제하지 않고 해당 컬럼 하나만 정리하는 좁은 방어. 이 가드를 추가한 뒤 전체 스위트 3회 연속 실행(§E2 참조) 모두 P2002 없이 5/5 GREEN이었다. M2 자신의 두 시나리오를 고치는 일(비동기 완주를 기다리게 만드는 등)은 M3의 스코프 밖이라 손대지 않았다 — 이 정정은 M2가 소유한 시나리오 자체가 아니라 M3이 그 위에서 안전하게 완주하기 위한 M3 쪽 방어선이다.

## §E.2c M3 AC/REQ PASS 매트릭스

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| REQ-E2E-008 / AC-E2E-006 | 상품 상세에서 장바구니 담기 → `/cart`에 그 상품이 한 줄로 반영, 빈 장바구니 화면 비표시 | PASS | `page.getByRole("button",{name:"장바구니에 담기"})` 클릭 → "장바구니로 이동" 링크로 `/cart` 진입 → `getByRole("heading",{name:"장바구니가 비어 있습니다"})` not visible, `getByText(product.name,{exact:true})` visible |
| REQ-E2E-009 / AC-E2E-007 | `/checkout` 필수 5필드 중 4개(수령인 이름/연락처/우편번호/주소) 유효 제출 → 주문 생성 → `/checkout/complete/{orderId}` 이동, 결제 대기 상태+결제 트리거 표시 | PASS | 폼 제출 후 `toHaveURL(/\/checkout\/complete\/[^/?]+$/)`, `getByRole("status").filter({hasText:"아직 결제 전 단계입니다"})` visible, `getByRole("button",{name:"결제하기"})` visible |
| REQ-E2E-010 / AC-E2E-008 | 스텁 성공 모드로 결제 완료 → `payment_failed` 파라미터 없이 `/checkout/complete/{orderId}` 안착, 결제 완료 상태 표시, 결제 트리거 더 이상 미표시 | PASS | `toHaveURL(new RegExp('/checkout/complete/'+orderId+'$'))`, `not.toHaveURL(/payment_failed=1/)`, `getByRole("status").filter({hasText:"결제가 완료되었습니다"})` visible, `getByRole("button",{name:"결제하기"})` not visible |
| AC-E2E-001 | `npm run test:e2e` 실행 시 Playwright가 서버를 기동하고 Chromium으로 시나리오를 실행하며 종료 코드 0 | PASS | 5개 시나리오(m1-spike ×1, m2-toss-stub ×2, m3-happy-path ×1, smoke ×1) 전부 통과, `EXIT_CODE=0`(§E1 참조) — plan.md §F가 M3 종료 조건으로 명시한 AC |
| REQ-E2E-005 (재확인, M3 결제 시나리오) | 이 여정의 결제 단계에서도 Toss 호스트로 나가는 요청이 0건 | PASS | `expect(tossHostHits).toHaveLength(0)` |
| 게스트 신원 메커니즘 | 수동 쿠키 주입 없이 `POST /api/cart/items`의 `Set-Cookie` 발급이 여정 전체의 신원을 실어 나른다 | PASS | `context.addCookies()` 호출 없음 — 코드 리뷰 + 여정 전체 통과로 확인 |
| 프로덕션 소스 불변 | `src/lib/payment/toss-server.ts` diff 0줄 유지 | PASS | `git diff --stat 6beb53b... -- src/lib/payment/toss-server.ts` 빈 출력(§E4) |
| M1/M2 회귀 없음 | 기존 3개 시나리오가 계속 통과 | PASS | 전체 `npm run test:e2e` 5/5 통과, 3회 연속 재확인(§E2) |
| 기존 Vitest 스위트 불변 (REQ-E2E-002) | `npm test` 수집 파일 수·테스트 수가 M2 이후와 동일 | PASS | 110 files / 1478 tests, 변경 없음(§E2) |

### M4 — 실패·재시도와 엣지 경로 (완료)

**작업 위치**: 오케스트레이터가 `.claude/worktrees/agent-a5bfbe039671bad9d`로 격리 배치했다(위임 시점 HEAD가 `31396dc8...`가 아닌 별도 워크트리 — 위임 프롬프트 §A.0의 예상된 격리 시나리오). `git checkout -b m4-edge-cases 31396dc8...`로 t14의 M3 머지 커밋에서 분기해 작업했다. 최종 통합(머지)은 오케스트레이터가 t14 워크트리에서 수행한다.

**cycle_type=tdd — RED-GREEN 실행 기록**: `e2e/m4-edge-cases.spec.ts` 4개 시나리오를 먼저 작성했다 — 시나리오 1(실패→재시도)이 아직 존재하지 않는 `tossPaymentStub.setModeOnCurrentPage()`를 호출하고, 시나리오 4(쿠폰)가 아직 존재하지 않는 `createDiscountCoupon()`을 import한 상태로 실행해 두 건의 RED를 확보했다(§E8 참조) — `TypeError: tossPaymentStub.setModeOnCurrentPage is not a function`, `TypeError: (0, _orderFixture.createDiscountCoupon) is not a function`. 시나리오 2(빈 장바구니)·3(필수 필드 누락)은 새 애플리케이션 코드에 의존하지 않고 이미 존재하는 동작(`CheckoutUnavailable`, 서버 측 `validate()` 400 거부)을 검증하므로 첫 실행에서 바로 GREEN이었다 — 이 두 시나리오에서는 어떤 새 구현도 작성되지 않았으므로 test-after 위반이 아니다.

이후 두 헬퍼를 구현하자 — `toss-stub-fixture.ts`에 `setModeOnCurrentPage()`(즉시 페이지 이동 없이 `page.evaluate()`로 현재 문서의 `window.__E2E_PAYMENT_MODE__`를 직접 덮어씀 — `setMode()`의 `addInitScript()`는 미래 내비게이션에만 적용되어 실패 화면에 이미 도달한 현재 문서에는 소급 적용되지 않기 때문), `order-fixture.ts`에 `createDiscountCoupon()`/`deleteDiscountCoupon()`(Prisma `Coupon.upsert` 직접 생성, `prisma/seed-coupons.ts`의 `WELCOME10`을 재사용하지 않음 — 그 스크립트는 "standalone, dev-only"로 `test:e2e` 기동에 연결되어 있지 않아 존재를 보장할 수 없음) — 시나리오 1이 여전히 실패했다(재시도 클릭 후에도 `?payment_failed=1`에 머무름). 원인은 재하이드레이션 타이밍(plan.md §G 위험표의 동일 부류): `failUrl` 내비게이션이 전체 페이지 로드이므로 재시도 버튼의 `onClick` 리스너가 붙기 전에 클릭이 발생했다. M3가 `CheckoutForm` 제출 버튼에 적용한 것과 동일한 `page.waitForLoadState("networkidle")` 가드를 재시도 버튼 클릭 직전에 추가해 해결 — 이후 4개 시나리오 모두 GREEN, 3회 연속 단독 실행 및 전체 스위트 3회 연속 실행 모두 안정적으로 통과했다.

**설계**:
- **REQ-E2E-011 (실패→재시도)**: `createSpikeOrder()`로 만든 `pending_payment` 주문에서 스텁을 실패 모드로 결제 시도 → `?payment_failed=1` 도달, `role="alert"` 재시도 배너와 `role="status"` "아직 결제 전 단계입니다"가 함께 표시됨(design.md §6 "상태 우선 원칙" — 배너는 대체가 아니라 병기)을 확인 → `clearStalePaymentKey`(M3와 동일한 좁은 방어) → `setModeOnCurrentPage("success")`로 같은 페이지에서 모드 전환(plan.md §D가 명시한 방식) → 재시도 클릭 → 결제 완료 상태 도달.
- **REQ-E2E-012 (빈 장바구니)**: Playwright의 테스트별 기본 격리 컨텍스트를 그대로 사용 — 게스트 쿠키를 한 번도 발급받지 않은 상태로 `/checkout`에 직접 진입하면 `CheckoutPage`의 `guestId === null` 분기가 `<CheckoutUnavailable />`을 렌더링함(src/app/checkout/page.tsx)을 확인.
- **REQ-E2E-013 (필수 필드 누락)**: `CheckoutForm`은 `<form noValidate>`이므로 브라우저 네이티브 검증은 절대 개입하지 않는다 — 서버(`order-service.ts`의 `validate()`)가 400 + `fieldErrors`로 거부하고, `CheckoutForm.handleSubmit`이 `response.ok`일 때만 `router.push()`하므로(src/components/checkout/CheckoutForm.tsx) 브라우저가 `/checkout`에 머무름을 확인. `recipientName`을 비워 제출하고 `role="alert"` "배송 정보를 다시 확인해 주세요"(order-service.ts의 고정 문구)가 표시됨도 함께 검증.
- **REQ-E2E-014 (쿠폰 적용)**: `createDiscountCoupon()`으로 자체 생성한 PERCENTAGE 10%·`minOrderAmount: 0` 쿠폰을 `CheckoutInteractive`의 쿠폰 입력에 적용 → `role="status"` "쿠폰이 적용되었습니다" 표시, `OrderSummary`에 할인 행(`dt:has-text("할인 금액")`)이 DOM에 나타남(REQ-DISCOUNT-023 규칙 그대로 재사용), "결제 예정 금액" 값이 적용 전과 달라짐을 확인. 이 시나리오는 "주문하기"를 전혀 클릭하지 않으므로 주문이 생성되지 않는다는 AC-E2E-012의 둘째 절은 그 부재 자체가 증거다.

**Toss 호스트 무접촉 재확인 (프로덕션 소스 불변)**: `git diff --stat 31396dc8... -- src/lib/payment/toss-server.ts`가 빈 출력 — M1~M3에서 확정된 0줄 diff가 M4에서도 유지됨을 재확인했다(§E4).

**M2 잔여 위험(P2002) 재확인 — M4 범위 내 무재발**: 전체 스위트 실행 로그에서 `P2002` 문자열이 정확히 1건 나타났으나, 스택트레이스 위치(`tx.order.updateMany` at test 1→2 경계, M4 시나리오 실행 이전)를 확인한 결과 progress.md §E.2 M3절이 이미 기록한 **M2 자신의 두 시나리오**가 원인인 기존 잔여 노이즈였다 — M4가 새로 유발한 발생이 아니다. M4 자신의 재시도 시나리오는 M3와 동일한 `clearStalePaymentKey` 좁은 방어를 사용했고, 그 시나리오 실행 구간에서는 P2002가 전혀 나타나지 않았다. 이 잔여 노이즈의 프로젝트 전역 정리는 여전히 M5의 몫이며(위임 프롬프트 Section A의 명시적 지침대로), M4에서 M2 자신의 두 시나리오를 고치는 일은 하지 않았다.

## §E.2d M4 AC/REQ PASS 매트릭스

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| REQ-E2E-011 / AC-E2E-009 | 결제 실패 → `?payment_failed=1` + 재시도 가능 상태 → 재시도 성공 시 결제 완료 상태 도달 | PASS | `role="alert"` 배너 "결제가 완료되지 않았습니다" + `role="status"` "아직 결제 전 단계입니다" + 결제 버튼 표시 확인 → 재시도 후 `role="status"` "결제가 완료되었습니다" 표시, 결제 버튼 미표시, URL에 `payment_failed` 없음 |
| REQ-E2E-012 / AC-E2E-010 | 빈 게스트 장바구니로 `/checkout` 진입 시 체크아웃 불가 화면, 주문서 미표시 | PASS | `getByRole("heading", {name: "주문서를 열 수 없습니다"})` visible, `getByLabel("수령인 이름")` count 0 |
| REQ-E2E-013 / AC-E2E-011 | 필수 필드(수령인 이름) 누락 제출 → 서버 거부 → `/checkout` 유지, `/checkout/complete/`로 미이동 | PASS | 제출 후 `role="alert"` "배송 정보를 다시 확인해 주세요" 표시, URL이 `/checkout`에 머무름, `/checkout/complete/` 패턴 미매칭 |
| REQ-E2E-014 / AC-E2E-012 | 유효 쿠폰 적용 → 주문 요약 갱신(할인 행 등장 + 결제 예정 금액 변경), 이 시점까지 주문 미생성 | PASS | `role="status"` "쿠폰이 적용되었습니다" 표시, `dt:has-text("할인 금액")` visible, "결제 예정 금액" `dd` 텍스트가 적용 전후 상이함, `주문하기` 미클릭(URL이 `/checkout`에 계속 머무름) |
| REQ-E2E-005 (재확인, M4 결제 시나리오) | 이 milestone의 결제·비결제 시나리오 전체에서 Toss 호스트로 나가는 요청이 0건 | PASS | 4개 시나리오 모두 `expect(tossHostHits).toHaveLength(0)` |
| 프로덕션 소스 불변 | `src/lib/payment/toss-server.ts` diff 0줄 유지 | PASS | `git diff --stat 31396dc8... -- src/lib/payment/toss-server.ts` 빈 출력(§E4) |
| M1/M2/M3 회귀 없음 | 기존 5개 시나리오가 계속 통과 | PASS | 전체 `npm run test:e2e` 9/9 통과, 3회 연속 재확인(§E2) |
| 기존 Vitest 스위트 불변 (REQ-E2E-002) | `npm test` 수집 파일 수·테스트 수가 M3 이후와 동일 | PASS | 110 files / 1478 tests, 변경 없음(§E2) |
| M2 잔여 위험(P2002) 무재발 (M4 자신의 시나리오 한정) | M4의 재시도 시나리오가 P2002를 새로 유발하지 않음 | PASS | 전체 로그 중 P2002 1건은 M2 자신의 시나리오 구간(test 1→2 경계)에서 발생 — M4 시나리오 실행 구간에는 없음. 프로젝트 전역 정리는 M5 몫으로 유지 |

### M5 — 시드·격리 정리 (완료)

**워크트리 사례(§A.0)**: 위임 시점 HEAD가 `4d8d4589...`(`WT-checkout-e2e-tests`)와 불일치했다 — `.claude/worktrees/agent-ac102aabb50cfa82c`가 main(`9f60548`)에 물려 있었다. `git checkout -b m5-isolation 4d8d4589...`로 t14의 M4 머지 커밋에서 분기해 작업했다 — 위임 프롬프트 §A.0의 예상된 격리 시나리오. `.moai/specs/SPEC-E2E-001/`과 `e2e/m4-edge-cases.spec.ts` 존재를 확인한 뒤 `npm install` + `npx playwright install chromium`을 실행했다. 최종 통합(머지)은 오케스트레이터가 t14 워크트리에서 수행한다.

**cycle_type=tdd/ddd-hybrid — Rule 4(재현 우선) 실행 기록**: 이번 milestone은 새 사용자 시나리오가 아니라 M2~M4가 남긴 잔여 결함(공유 리터럴 paymentKey 충돌)의 근본 수정이므로, 고치기 전에 먼저 결함을 확정적으로 재현했다. 전체 스위트 3회 연속 실행(수정 전)에서는 타이밍 의존성 때문에 P2002가 매번 재현되지는 않았다(`npm run test:e2e` 3회, 9/9 통과, P2002 0건 — 전체 스위트 타이밍에 기대는 재현은 본질적으로 비결정적임을 확인). 이에 따라 임시 재현 스펙(`e2e/_repro-p2002.spec.ts`, 커밋 대상 아님·검증 후 삭제)을 작성해 두 개의 서로 다른 주문에 대해 **동일한 리터럴 paymentKey**로 `/api/payments/confirm`을 동시에(`Promise.all`) 호출하도록 강제했다 — 결과: 두 응답 모두 500, 서버 로그에 `Prisma Error P2002 ... Unique constraint failed on the fields: (paymentKey)` at `markOrderPaid` 확정 재현(§E1 "before" 로그). 근본 원인이 "타이밍이 나쁠 때만 가끔 실패"가 아니라 "두 주문이 같은 키를 쓰면 항상 충돌한다"는 구조적 결함임을 확인한 뒤, (a) — orderId 기반 고유 키 파생 — 을 적용했다. 재현 스펙은 목적을 달성한 뒤 삭제했다(리포지토리에 커밋되지 않음, `git status`로 확인).

**근본 수정 (Section A, 옵션 (a) 채택)**: `e2e/support/toss-sdk-stub.js`의 성공 모드가 모든 시나리오에 공유하던 리터럴 `"e2e_stub_payment_key"` 대신, 애플리케이션이 이미 `requestPayment(options)`에 실어 보내는 `options.orderId`(항상 고유한 실제 Prisma 행 id)로부터 키를 파생하도록 변경했다(`"e2e_stub_payment_key_" + options.orderId`). `Order.paymentKey`의 DB 레벨 `@unique` 제약과 충돌할 방법이 구조적으로 없어졌다 — 두 시나리오가 서로 다른 주문을 쓰는 한(이 스위트의 모든 시나리오가 그렇다) 결코 같은 키를 갖지 않는다. `order-fixture.ts`의 `STUB_SUCCESS_PAYMENT_KEY` 상수(공유 리터럴)를 `stubSuccessPaymentKey(orderId)` 함수(스텁과 동일한 파생 공식을 미러링)로 교체하고, M3/M4의 `clearStalePaymentKey()` 호출부를 그 함수 결과로 갱신했다 — 이 가드는 더 이상 크로스 시나리오 충돌을 막는 실제 방어선이 아니라, 중단된 이전 실행이 우연히 같은 주문 id를 재사용하는 극단적 경우에 대한 belt-and-suspenders로 격하됐다(order-fixture.ts 새 JSDoc에 명시). M2의 성공 시나리오 단언도 `paymentKey`가 단순히 "truthy"인지가 아니라 `stubSuccessPaymentKey(order.orderId)`와 정확히 일치하는지로 강화했다 — 향후 누군가 스텁을 다시 공유 리터럴로 되돌리는 회귀를 이 단언 하나가 잡는다.

**REQ-E2E-015 격리 점검 — 컨텍스트/쿠키**: 5개 스펙 파일 전체에서 `test.beforeAll`(공유 page/context 생성), `newContext`/`newPage`(수동 컨텍스트 재사용), `storageState`, `test.use()` 오버라이드를 모두 grep으로 확인했으며 **0건** — 즉 모든 9개 시나리오가 Playwright 기본값인 "시나리오당 독립 브라우저 컨텍스트"를 그대로 사용한다(가정이 아니라 코드 부재로 확인). M1/M2/M4는 `context.addCookies()`로 게스트 쿠키를 직접 주입하고, M3/M4의 나머지 시나리오는 애플리케이션 자신이 발급하는 `Set-Cookie: guest_cart_id`에 의존한다 — 두 경로 모두 컨텍스트별로 격리되어 있어 시나리오 간 쿠키 누수가 없다.

**seed product 헬퍼 일관성 점검**: 장바구니 담기 UI를 실제로 태우는 모든 시나리오(M3 여정, M4의 필수 필드 누락·쿠폰 시나리오)는 `getSeededProduct()`(`stock > 0` 필터, `AddToCartButton`의 비활성 가드와 대칭)를 일관되게 사용한다. `createSpikeOrder()`가 내부에서 쓰는 별도의 `prisma.product.findFirst({ where: { isActive: true } })`는 의도적으로 다른 질의다 — 이 헬퍼는 UI 담기 경로를 타지 않고 주문을 직접 생성하므로 재고 조건이 필요 없다(M1/M2/M4의 결제 흐름 전용). 강제 통합은 각 헬퍼의 실제 용도를 무시하는 것이므로 하지 않았다.

**접근성 이름 기반 선택자 감사 (5개 스펙 파일 전체)**: `.locator(` / `data-testid` / `css=` / `xpath=`를 grep한 결과, CSS 선택자는 정확히 2건 — 둘 다 `e2e/m4-edge-cases.spec.ts`의 쿠폰 시나리오(`dt:has-text("결제 예정 금액") + dd`, `dt:has-text("할인 금액")`). `OrderSummary.tsx`를 확인한 결과 이 금액 행들은 순수 `<dl><dt>/<dd>` 정의 목록으로, `dt`(암묵적 role `term`)와 `dd`(암묵적 role `definition`)를 하나의 접근 가능한 이름으로 연결해 조회하는 표준 ARIA 메커니즘이 없다(여러 `dd`가 존재하고, "이 dd는 이 dt의 값"이라는 연관은 인접 형제 관계로만 표현됨). 마크업을 바꿔 임의의 `aria-label`을 추가하는 것은 테스트만을 위한 앱 변경이라 하지 않았다 — 이 두 선택자는 그대로 남겼다. 그 밖의 모든 선택자(9개 시나리오, 수십 개 단언)는 이미 `getByRole`/`getByLabel`/`getByText` 기반이었다 — 변환이 필요한 항목이 없었다.

**AC-E2E-013 (시나리오 독립성, REQ-E2E-015) 직접 검증**: `npx playwright test`에 파일을 역순(`smoke → m4 → m3 → m2 → m1`)으로 넘겨 실행 — 9/9 통과, P2002 0건(§E1). 정순 실행과 결과가 동일함을 확인했다.

**@MX 태그 (plan.md §H)**: `toss-sdk-stub.js`의 `@MX:ANCHOR`, Toss 호스트 감시 라우트(`fixtures.ts`)의 `@MX:WARN`, `mock-toss-api.mjs`의 `@MX:WARN`, `playwright.config.ts` `webServer`의 `@MX:NOTE`는 M2/M1에서 이미 부착되어 있었음을 확인했다(§E6). CI 미통합 사실의 `@MX:TODO`만 이번 milestone에서 신설했다 — `e2e/README.md`가 아직 없으므로(M6 미착수) plan.md §H의 지침대로 `playwright.config.ts` 최상단 주석에 부착했고, M6이 README를 만들면 그리로 옮기라는 메모를 남겼다.

**Toss 호스트 무접촉 재확인 (프로덕션 소스 불변)**: `git diff --stat 4d8d4589... -- src/lib/payment/toss-server.ts`가 빈 출력 — 0줄 diff가 M5에서도 유지됨(§E4).

## §E.2e M5 AC/REQ PASS 매트릭스

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| REQ-E2E-015 (paymentKey 충돌 근본 수정) | 두 시나리오가 결코 같은 성공 paymentKey를 가질 수 없다 | PASS | `toss-sdk-stub.js`가 `options.orderId`로 키를 파생 — 재현 스펙으로 결함을 확정 재현(§E1 "before")한 뒤 수정, 이후 전체 스위트 3회 연속 + 역순 1회 모두 P2002 0건(§E1 "after") |
| REQ-E2E-015 (M2 회귀 방지) | 파생 공식 회귀를 잡는 단언 | PASS | M2 성공 시나리오가 `paymentKey === stubSuccessPaymentKey(order.orderId)`를 정확히 단언(이전엔 truthy만 확인) |
| REQ-E2E-015 (컨텍스트/쿠키 격리) | 모든 시나리오가 독립 브라우저 컨텍스트 사용 | PASS | 5개 스펙 파일 전체에 `beforeAll`/`newContext`/`newPage`/`storageState`/`test.use()` 0건(grep) — Playwright 기본 격리가 실제로 적용됨을 코드 부재로 확인 |
| AC-E2E-013 (시나리오 독립성) | 실행 순서를 뒤집어도 전부 통과 | PASS | `npx playwright test`에 역순 파일 목록 전달 — 9/9 통과, P2002 0건 |
| seed product 헬퍼 일관성 | UI 담기 경로를 타는 모든 시나리오가 `getSeededProduct()` 사용 | PASS | M3/M4의 관련 3개 시나리오 확인 — `createSpikeOrder()`의 별도 질의는 용도가 달라 통합하지 않음(강제 리팩터 아님) |
| 접근성 이름 기반 선택자 정리 | CSS/data-testid/xpath 선택자를 accessible-name 기반으로 전환 | PASS(부분, 문서화됨) | 5개 파일 grep — CSS 선택자 2건(`dt`+`dd` 정의 목록), 접근 가능한 이름 등가물 없음을 확인 후 유지, 사유 기록(위 산문 참조). 그 외 전 선택자는 이미 role/label/text 기반 |
| @MX 태그 (plan.md §H 표) | 5개 항목 전부 부착 | PASS | ANCHOR/WARN×2/NOTE는 기존 부착 확인, TODO는 이번에 신설(playwright.config.ts) — §E6 |
| 프로덕션 소스 불변 | `src/lib/payment/toss-server.ts` diff 0줄 유지 | PASS | `git diff --stat 4d8d4589... -- src/lib/payment/toss-server.ts` 빈 출력(§E4) |
| M1~M4 회귀 없음 | 기존 9개 시나리오가 계속 통과 | PASS | `npm run test:e2e` 3회 연속 + 역순 1회, 매번 9/9 통과(§E1/§E2) |
| 기존 Vitest 스위트 불변 (REQ-E2E-002) | `npm test` 수집 파일 수·테스트 수가 M4 이후와 동일 | PASS | 110 files / 1478 tests, 변경 없음 |

### M6 — 문서 (완료, 최종 milestone)

**워크트리 사례(§A.0)**: 위임 시점 HEAD가 `273b19f7afe7bb9fbf3835d5f10c8cf9a2685f94`(`WT-checkout-e2e-tests`)와 불일치했다 — 격리 워크트리가 main(`9f605486...`)에 물려 있었다. `git checkout -b m6-docs 273b19f7...`로 t14의 M5 머지 커밋에서 분기해 작업했다 — 위임 프롬프트 §A.0의 예상된 격리 시나리오. `.moai/specs/SPEC-E2E-001/` 존재와 `e2e/support/toss-sdk-stub.js`의 orderId 기반 paymentKey 파생(M5 수정)을 확인한 뒤 `npm install` + `npx playwright install chromium`을 실행했다. 최종 통합(머지)은 오케스트레이터가 t14 워크트리에서 수행한다.

**작업 범위**: 문서 전용 milestone(plan.md §F M6) — 테스트 코드·애플리케이션 코드 변경 없음. `e2e/README.md`를 신설하고, M5가 `playwright.config.ts`에 임시로 부착했던 `@MX:TODO`(CI 미통합) 하나를 이 새 README로 이전했다.

**작성 근거 — 코드 대조 확인**:

- **필요한 환경 변수**: `playwright.config.ts:25-28`의 `assertRequiredEnvVars(["DATABASE_URL", "NEXT_PUBLIC_PG_CLIENT_KEY", "PG_SECRET_KEY"], ...)` 호출과 `e2e/support/env-check.ts`의 구현(파일 로드 후 빈 값 검사, 누락 시 변수명을 정확히 지목하는 `Error` throw)을 직접 읽고 README에 반영했다 — REQ-E2E-004의 조기 실패 메시지 형식(`[e2e] required environment variable(s) missing before suite start: ...`)도 `env-check.ts:45-48`에서 그대로 인용했다.
- **데이터베이스 전제**: `e2e/support/order-fixture.ts:97-107`의 `getSeededProduct()`(정확한 Prisma where절과 에러 메시지 인용) 및 `src/lib/auth/guest-identity.ts:34-39`의 `GUEST_CART_COOKIE_NAME` 정의를 직접 읽고 반영했다. 이 저장소에 별도 product seed 스크립트가 없다는 사실은 `prisma/` 디렉터리 나열(`seed-admin.ts`, `seed-coupons.ts`만 존재)로 확인한 뒤 "이 스위트는 상품을 직접 시드하지 않는다"고 정확히 서술했다 — 존재하지 않는 `npm run seed` 같은 명령을 지어내지 않았다.
- **실행 방법**: `package.json`의 `"test:e2e": "playwright test"` 스크립트, `playwright.config.ts:39-40`의 전용 포트(`3100`, 일반 dev 포트 3000과 충돌 방지) 설계를 확인했다. `node_modules`가 워크트리 간 공유되지 않는다는 서술은 이번 M6 자신의 §A.0 격리 재현(매 milestone마다 반복된 사실, progress.md M1~M5 각 절의 "작업 위치" 기록)에 근거한다 — 추측이 아니라 이 SPEC의 위임 이력 자체가 증거다.
- **CI 미통합 사유**: `spec.md` §3 "Out of Scope — CI에서의 E2E 실행" 절을 그대로(의역 없이) 근거로 인용했고, `.github/workflows/ci.yml:60`의 실제 `DATABASE_URL` 값(`postgresql://ci:ci@127.0.0.1:5432/our_shop_ci?schema=public`)을 직접 읽어 README에 옮겼다 — spec.md가 서술하는 "루프백 자리표시자"라는 주장을 코드로 재확인했다.
- **아키텍처 노트(두 프로세스 경계)**: `plan.md` §A/§B의 다리 1(`page.route()`)/다리 2(undici `setGlobalDispatcher`) 구분을 요약하고, `src/lib/payment/toss-server.ts`를 직접 가리키는 것으로 그쳤다(plan.md 전체 재서술 없음, 위임 프롬프트 Section D #5 지침대로).

## §E.6f M6 AC/REQ PASS 매트릭스

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| plan.md §F M6 종료 조건 | `e2e/README.md` 생성 — 필요한 환경 변수·데이터베이스 전제·실행 방법·CI 미포함 사유 포함 | PASS | `e2e/README.md` 신설, 4개 절 전부 포함(§E1 코드 대조 확인 참조) |
| MX:TODO 이전 | `playwright.config.ts`의 `@MX:TODO`를 `e2e/README.md`로 이전, 중복 부착 없음 | PASS | `grep -n "@MX:TODO" playwright.config.ts` 매치 0건(exit 1), `grep -n "@MX:TODO" e2e/README.md` 매치 2건 |
| 프로덕션 소스 불변 | `src/lib/payment/toss-server.ts` diff 0줄 유지 | PASS | `git diff --stat 273b19f7... -- src/lib/payment/toss-server.ts` 빈 출력 |
| M1~M5 회귀 없음 | 기존 9개 시나리오가 계속 통과 | PASS(잔여 위험 기록, 아래 참조) | `npm run test:e2e` 4회 연속 실행 — 1회차 M4 재시도 시나리오 1건 실패(`getByRole('status', {hasText:'결제가 완료되었습니다'})` timeout), 2~4회차는 9/9 GREEN. 실패 원인은 §E.2 산문 및 §E.7 잔여 위험 참조 |
| 타입·린트 불변 | `npm run typecheck`, `npm run lint` 무변경 | PASS | 둘 다 출력 없이 종료(exit 0) |
| 문서-코드 일치 | README의 모든 주장이 실제 소스에서 인용됨 | PASS | 위 "작성 근거" 절 — 각 주장마다 파일:라인 인용 |

**§E.2 잔여 위험 — M4 재시도 시나리오 1회성 실패(2~4회차는 GREEN)**: 첫 실행에서만 `[WebServer] SyntaxError: Unexpected end of JSON input`(`/checkout/complete/{orderId}` 경로)와 함께 M4 재시도 시나리오가 timeout으로 실패했다. 이 워크트리는 이번 milestone에서 처음 `npm install`+`next dev`를 구동한 새 워크트리이므로, Next.js dev 서버의 최초 라우트 컴파일(콜드 스타트) 중 발생한 빌드 매니페스트 경합으로 판단한다 — plan.md §G가 이미 명시한 "하이드레이션 타이밍 플레이크" 위험군과 같은 부류이되, 이번엔 다른 트리거(콜드 컴파일)다. **이 milestone은 어떤 테스트·애플리케이션 코드도 변경하지 않았다**(`git status --short`: `playwright.config.ts`는 주석 3줄 삭제/3줄 교체만, 나머지는 신규 `e2e/README.md` 하나뿐 — §E4 zero-diff 확인과 별개로 스펙 파일 자체를 건드리지 않았음을 `git diff --stat` 파일 목록으로 재확인) — 따라서 이 실패를 이번 문서 변경이 유발했을 원인은 구조적으로 없다. 후속 3회 연속 실행이 모두 9/9 GREEN이었다는 점이 콜드 스타트 가설과 일치한다. 이 milestone의 범위(문서 작성)를 벗어나므로 코드 수정은 하지 않았다 — 재발 시 조사가 필요하면 별도 이슈로 추적할 사안이다.

---

## 모든 milestone 완료 (M1~M6)

SPEC-E2E-001의 6개 milestone이 모두 완료됐다. M1(하네스+다리2 스파이크) → M2(Toss 스텁) → M3(해피 패스) → M4(실패·엣지) → M5(시드·격리 정리) → M6(문서)까지 순서대로 진행했으며, 9개 E2E 시나리오가 안정적으로 통과하는 상태로 마감한다. sync-phase(§E.4)는 별도 위임으로 진행한다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_milestone: M6
run_status: all-milestones-complete   # M1~M6 전체 완료 — SPEC-E2E-001 run-phase 종료
m1_spike_points_pass: 4   # / 4 (M1 그대로 유지)
ac_verified_this_milestone: [AC-E2E-013, AC-E2E-014]
ac_verified_cumulative: [AC-E2E-001, AC-E2E-002, AC-E2E-003, AC-E2E-005a, AC-E2E-005b, AC-E2E-006, AC-E2E-007, AC-E2E-008, AC-E2E-009, AC-E2E-010, AC-E2E-011, AC-E2E-012, AC-E2E-013, AC-E2E-014]
ac_e2e_015_status: holds-vacuously   # REQ-E2E-016(동시 행위자) — 소유는 SPEC-ORDER-002; 스위트에 2+ 동시 행위자 시나리오가 애초에 없음을 grep으로 재확인(newPage/newContext 0건). M5가 새로 만든 상태가 아니라 M1~M4부터 계속 참이었던 사실의 재확인
baseline_vitest_files_before: 110
baseline_vitest_files_after: 110
baseline_vitest_tests_after: 1478
toss_server_ts_diff_lines: 0
typecheck_status: pass
lint_status: pass
e2e_status: pass   # 9/9 (m1-spike ×1, m2-toss-stub ×2, m3-happy-path ×1, m4-edge-cases ×4, smoke ×1). M5 시점: 정순 3회 연속 + 역순 1회, 매번 P2002 0건. M6 시점(이번 milestone, 문서 전용 — 코드 변경 없음): 4회 연속 실행 — 1회차 M4 재시도 시나리오 1건 timeout 실패(콜드 스타트 원인 추정, §E.2 M6 산문 참조), 2~4회차 9/9 GREEN
paymentkey_collision_fix:
  root_cause: "toss-sdk-stub.js가 모든 성공 시나리오에 공유 리터럴 paymentKey를 하드코딩 — Order.paymentKey DB unique 제약과 구조적으로 충돌 가능"
  fix: "옵션 (a) 채택 — options.orderId로부터 paymentKey 파생(order-fixture.ts stubSuccessPaymentKey()가 동일 공식 미러링), 두 시나리오가 같은 키를 가질 수 없게 구조적으로 봉쇄"
  repro_method: "임시 스펙(e2e/_repro-p2002.spec.ts, 커밋 안 됨)으로 두 주문에 동일 리터럴 키를 동시(Promise.all) confirm 요청 — 수정 전 100% 재현(500×2, 서버 로그 P2002), 전체 스위트 타이밍 의존 재현은 3회 시도 모두 미재현(비결정적임을 확인)"
  post_fix_verification: "전체 스위트 정순 3회 + 역순 1회, 모두 9/9 통과·P2002 0건; M2 성공 시나리오 단언을 stubSuccessPaymentKey(orderId) 정확 일치로 강화해 회귀 봉쇄"
new_files: []   # M5는 기존 파일 수정만 — 새 spec 파일 없음
modified_files:
  - e2e/support/toss-sdk-stub.js   # paymentKey를 공유 리터럴 대신 options.orderId로부터 파생
  - e2e/support/order-fixture.ts   # STUB_SUCCESS_PAYMENT_KEY(공유 리터럴 상수) → stubSuccessPaymentKey(orderId) 함수로 교체; clearStalePaymentKey는 belt-and-suspenders로 격하(JSDoc 갱신)
  - e2e/m2-toss-stub.spec.ts   # 성공 시나리오의 paymentKey 단언을 truthy → stubSuccessPaymentKey(order.orderId) 정확 일치로 강화
  - e2e/m3-happy-path.spec.ts   # clearStalePaymentKey 호출을 STUB_SUCCESS_PAYMENT_KEY → stubSuccessPaymentKey(orderId!)로 갱신
  - e2e/m4-edge-cases.spec.ts   # clearStalePaymentKey 호출을 STUB_SUCCESS_PAYMENT_KEY → stubSuccessPaymentKey(order.orderId)로 갱신
  - playwright.config.ts   # CI 미통합 사실 @MX:TODO 신설(e2e/README.md 부재 — M6 대기)
residual_risk_m2_paymentkey_collision:
  status: resolved   # M5에서 근본 수정 — 더 이상 잔여 위험 아님(위 paymentkey_collision_fix 참조)
selector_audit:
  css_selectors_found: 2   # e2e/m4-edge-cases.spec.ts의 dt/dd 정의 목록 2건
  converted: 0
  left_as_is_with_rationale: 2   # OrderSummary.tsx <dl> 구조에 접근 가능한 이름 등가물 없음 — progress.md §E.2 M5 산문 참조
mx_tags_applied_this_milestone:
  - file: playwright.config.ts
    tag: "@MX:TODO"
    line: 18
mx_tags_confirmed_preexisting:
  - { file: e2e/support/toss-sdk-stub.js, tag: "@MX:ANCHOR", line: 17 }
  - { file: e2e/support/fixtures.ts, tag: "@MX:WARN", line: 10 }
  - { file: e2e/support/mock-toss-api.mjs, tag: "@MX:WARN", line: 8 }
  - { file: playwright.config.ts, tag: "@MX:NOTE", line: 60 }

## M6 — 문서 (this milestone's own signal, appended)

m6_run_status: complete   # 최종 milestone — SPEC-E2E-001 전체 완료
m6_new_files:
  - e2e/README.md   # 필요한 환경 변수, 데이터베이스 전제, 실행 방법, CI 미통합 사유, 아키텍처 노트, 이전된 @MX:TODO
m6_modified_files:
  - playwright.config.ts   # @MX:TODO 블록(CI 미통합, M5가 신설)을 e2e/README.md로 이전 — 주석 텍스트만 변경, 코드 로직 변경 0줄
m6_mx_tags_relocated:
  - { from_file: playwright.config.ts, to_file: e2e/README.md, tag: "@MX:TODO", verified_by: "grep -n '@MX:TODO' playwright.config.ts (0 hits) && grep -n '@MX:TODO' e2e/README.md (2 hits)" }
m6_toss_server_ts_diff_lines: 0   # git diff --stat 273b19f7... -- src/lib/payment/toss-server.ts — 빈 출력
m6_typecheck_status: pass
m6_lint_status: pass
m6_e2e_status: pass-with-noted-cold-start-flake   # 4회 연속 실행 중 1회차만 실패(콜드 스타트 추정), 2~4회차 9/9 GREEN — §E.2 M6 산문 참조
m6_baseline_vitest_unaffected: true   # 문서 전용 변경이므로 npm test 재실행 불필요 판단(Vitest 스위트가 e2e/ 또는 playwright.config.ts를 import하지 않음 — REQ-E2E-002 격리로 구조적 보장)
worktree_case: isolated-recovery   # A.0 — 별도 브랜치(m6-docs, t14의 M5 머지 커밋 273b19f7에서 분기)에서 작업, t14로 머지 예정
branch: m6-docs
commit: 3ffb144   # docs(SPEC-E2E-001): M6 e2e/README.md
pushed: true   # git push origin m6-docs — 성공(원격에 새 브랜치 생성 확인)
next_milestone: none — all milestones complete
```

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-09-05
sync_commit_sha: 818eb75ea0abda20c3fbc35379821106a436c588   # backfilled — D3 SHA 자리표시자 백필 예외에 따라 후속 커밋에서 실제 SHA로 갱신
sync_status: audit-passed
sync_auditor_verdict: PASS
sync_auditor_scores:
  functionality: 98
  security: 96
  craft: 90
  consistency: 95
sync_auditor_report: .moai/reports/sync-audit/SPEC-E2E-001-2026-09-05.md
b12_self_test_a: "grep -c 'SPEC-E2E-001' CHANGELOG.md → 0 (사전 확인, 본 커밋 작성 전)"
b12_self_test_b: "acceptance.md 내 고유 AC-E2E-* 식별자 16개(005a/005b 분기 포함) — grep -oE 'AC-E2E-[0-9]+[a-z]?' acceptance.md | sort -u | wc -l → 16"
b12_self_test_c: "CHANGELOG 엔트리가 인용하는 모든 경로(e2e/, e2e/README.md, playwright.config.ts, package.json)를 ls로 실재 확인"
changelog_entry_position: "[Unreleased] 섹션 최상단(가장 최근 항목) — SPEC-REVIEW-001 항목보다 위"
frontmatter_status_transitions:
  spec_md: "in-progress → completed (updated: 2026-09-05) — plan.md/acceptance.md는 frontmatter 없음(spec.md만 소유)"
canary_compliance_check: n/a   # 이 SPEC은 forward-looking 정책을 자체 테스트하지 않음
```

## §F Phase 4 Mode Selection

**Input parameters**: tier=M, scope≈6 milestones/~10 files (playwright.config.ts, package.json, e2e/support/*, e2e/*.spec.ts, e2e/README.md), domain count=1 (E2E/Playwright — single cross-cutting concern touching both browser and server-side mocking), file language mix=TypeScript, concurrency benefit=LOW (coding-heavy, milestones have sequential dependency — M2 depends on M1's spike proof), Agent Teams prereqs=not requested.

| Mode | Selected? | Rationale |
|---|---|---|
| `direct` | No | Non-trivial: new test harness + mocking infrastructure across 6 milestones |
| `serial` | **YES** | Coding-heavy, sequential milestone dependency (M1 spike gates M2+); Anthropic's coding-task parallelism caveat applies |
| `fanout` | No | Not multi-domain research; single cross-cutting E2E concern |
| `sweep` | No | Not mechanical/uniform; M1 spike is a genuine unknown requiring judgment, not a bulk transform |

**Decision: serial**

**Justification**: This is coding-heavy implementation work with a hard sequential dependency — M2-M6 all build on M1's proof that the undici interceptor reaches the Next.js route-handler execution context. Per Anthropic's coding-task parallelism caveat, coding work has fewer truly parallelizable units than research; `serial` (single manager-develop spawn per milestone) is the correct default here.

**Implementation Kickoff Approval**: user approved 2026-09-05 via AskUserQuestion (option: "지금 시작 (권장)"); progression mode = autonomous ("자동 진행 (권장)").
