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

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_milestone: M4
run_status: milestone-complete   # M1, M2, M3, M4 완료 — M5~M6은 미착수
m1_spike_points_pass: 4   # / 4 (M1 그대로 유지)
ac_verified_this_milestone: [AC-E2E-009, AC-E2E-010, AC-E2E-011, AC-E2E-012]
ac_verified_cumulative: [AC-E2E-001, AC-E2E-002, AC-E2E-003, AC-E2E-005a, AC-E2E-005b, AC-E2E-006, AC-E2E-007, AC-E2E-008, AC-E2E-009, AC-E2E-010, AC-E2E-011, AC-E2E-012]
baseline_vitest_files_before: 110
baseline_vitest_files_after: 110
baseline_vitest_tests_after: 1478
toss_server_ts_diff_lines: 0
typecheck_status: pass
lint_status: pass
e2e_status: pass   # 9/9 (m1-spike ×1, m2-toss-stub ×2, m3-happy-path ×1, m4-edge-cases ×4, smoke ×1) — 3회 연속 재확인
new_files:
  - e2e/m4-edge-cases.spec.ts
modified_files:
  - e2e/support/order-fixture.ts   # createDiscountCoupon, deleteDiscountCoupon 신설 (DiscountType import 추가); 기존 export는 불변
  - e2e/support/toss-stub-fixture.ts   # setModeOnCurrentPage 신설 (page.evaluate 기반, 같은 페이지에서 즉시 모드 전환); 기존 setMode는 불변
residual_risk_m2_paymentkey_collision:
  status: reproduced-in-log-not-in-own-scenario   # 전체 로그에 P2002 1건 — M2 자신의 두 시나리오 구간(test 1→2 경계)에서 발생, M4 시나리오 구간에는 무재발(clearStalePaymentKey 재사용)
  scope: m4-guard-reused   # M3가 신설한 clearStalePaymentKey를 M4의 재시도 시나리오도 재사용 — M2 자신의 두 시나리오는 여전히 미수정, M5 일반 정리로 확장하지 않음
worktree_case: isolated-recovery   # A.0 — 별도 워크트리(agent-a5bfbe039671bad9d)에서 m4-edge-cases 브랜치로 작업, t14로 머지 예정
next_milestone: M5   # 시드·격리 정리 (plan.md §F)
```

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

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
