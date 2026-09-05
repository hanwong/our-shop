# SPEC-E2E-001 — 구현 계획

> 결제·주문 경로 E2E 테스트 시나리오 (게스트 전용)
> 이 문서는 **바뀔 가능성이 큰 결정부터** 배치했다. §A~§C가 검토가 필요한 설계 결정이고, §F 이하는 기계적인 단계다.

---

## §A. 컨텍스트 — 이 계획이 풀어야 하는 진짜 문제

여정 자체는 단순하다. 어려운 부분은 **결제 모킹이 두 개의 서로 다른 프로세스 경계에 걸쳐 있다**는 점이다.

```
[브라우저]  PayButton 클릭
              ↓ loadTossPaymentClient()
              ↓ <script src="https://js.tosspayments.com/v2/standard">   ← 다리 1 (브라우저)
              ↓ window.TossPayments(key).payment().requestPayment(...)
              ↓ successUrl 로 내비게이션
[브라우저]  GET /api/payments/confirm?paymentKey=..&orderId=..&amount=..
              ↓
[Next 서버]  confirmPayment() → confirmTossPayment()
              ↓ fetch("https://api.tosspayments.com/v1/payments/confirm")  ← 다리 2 (서버)
              ↓
[Next 서버]  NextResponse.redirect(/checkout/complete/{orderId}[?payment_failed=1])
```

**다리 1은 Playwright `page.route()`로 잡힌다.** 브라우저가 내는 요청이기 때문이다.

**다리 2는 잡히지 않는다.** `page.route()`는 브라우저 컨텍스트의 요청만 가로챈다. 다리 2는 Next.js **서버 프로세스**의 Node `fetch`이고, 대상 URL은 `src/lib/payment/toss-server.ts`의 모듈 상수로 **하드코딩**되어 있다.

```ts
const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";
```

환경 변수 이음매가 없다. 따라서 다리 2를 그대로 두면 REQ-E2E-005("어떤 실행에서도 Toss 호스트에 요청을 보내지 않는다")이 깨지고, 동시에 성공 경로가 검증 불가능해진다 — 가짜 `PG_SECRET_KEY`로 실제 Toss API를 때리면 승인이 실패하고 주문은 영영 `paid`가 되지 않기 때문이다.

이것이 이 계획에서 가장 먼저 풀어야 했던 설계 문제이며, §B에서 확정됐다.

---

## §B. 결정 1 — 다리 2(서버 측 confirm)를 어떻게 가로챌 것인가 — **확정됨**

**확정: 테스트 전용 undici 전역 디스패처 네트워크 모킹. `toss-server.ts` 를 포함한 프로덕션 소스 변경은 0줄.** (2026-09-05, 사용자 결정)

### 무엇을 모킹하는가

`src/lib/payment/toss-server.ts` 가 내는 **서버 측 아웃바운드 HTTP 호출 두 개**를 모킹한다. 모킹 대상은 이 두 엔드포인트이며, 그 밖의 어떤 것도 아니다.

| 호출자 | 대상 URL (모듈 상수) | 용도 |
|---|---|---|
| `confirmTossPayment()` | `TOSS_CONFIRM_URL` = `https://api.tosspayments.com/v1/payments/confirm` | 결제 승인 |
| `queryTossPayment()` | `TOSS_PAYMENT_QUERY_URL` = `https://api.tosspayments.com/v1/payments` — `paymentKey`는 상수에 없고 호출 지점(`toss-server.ts:121`)에서 `/{paymentKey}`로 덧붙는다 | 웹훅 재조회 |

E2E용 웹서버를 기동할 때만 인터셉터 모듈을 주입한다.

```
webServer.command: NODE_OPTIONS='--import ./e2e/support/mock-toss-api.mjs' npm run dev
```

`mock-toss-api.mjs` 가 undici `MockAgent` 를 `setGlobalDispatcher` 로 설치해 `api.tosspayments.com` 을 가로챈다. Node의 전역 `fetch` 가 undici 기반이므로, `toss-server.ts` 를 **한 줄도 수정하지 않고** 그 fetch가 스텁 응답으로 흡수된다.

### 프로덕션 소스 불변 (확정된 제약)

- `src/lib/payment/toss-server.ts` 의 diff는 **0줄**이다. `TOSS_CONFIRM_URL` / `TOSS_PAYMENT_QUERY_URL` 상수도, `redirect: "error"` 를 포함한 보안 처리(CWE-319, SPEC-PAYMENT-001 PR #9 리뷰 대응)도 그대로 둔다.
- 인터셉터는 `e2e/` 안에만 존재하고 E2E 기동 명령에서만 로드되므로, 실제 배포 경로에는 어떤 형태로도 남지 않는다.
- **베이스 URL 환경 변수 이음매(`TOSS_API_BASE_URL`) 방식은 검토 후 기각됐다** — 배포되는 결제 코드에 이음매를 여는 일이고, 잘못 설정된 환경 변수가 결제 트래픽을 다른 호스트로 보낼 수 있는 표면을 새로 만들기 때문이다. run-phase에서 이 방식으로 되돌아가지 않는다.

### M1 스파이크가 먼저 증명해야 하는 것

undici 전역 디스패처가 Next.js 라우트 핸들러의 실행 컨텍스트에 실제로 닿는지는 **가정이지 사실이 아니다.** Next dev 서버가 핸들러를 별도 워커·런타임에서 실행하면 전역 디스패처가 그 컨텍스트에 설치되지 않을 수 있다.

따라서 M1은 나머지 스위트가 이 이음매에 의존하기 **전에** 다음을 확인한다.

1. `/api/payments/confirm` 을 한 번 태워 `confirmTossPayment()` 가 실제로 실행되게 한다.
2. 그 호출이 `TOSS_CONFIRM_URL` 정확히 그 URL로 나가고, **MockAgent가 그것을 가로챘음**을 인터셉터 측 기록으로 확인한다 (`assertNoPendingInterceptors()` 또는 호출 카운트).
3. 같은 방식으로 `queryTossPayment()` 의 조회 엔드포인트도 가로채짐을 확인한다.
4. 동시에 Toss 호스트 감시 라우트가 **한 번도 발동하지 않음**을 확인한다 (실제 네트워크로 새어나가지 않았다는 반대 방향 증거).

이 네 가지가 관측되기 전에는 M2 이후를 진행하지 않는다. 스파이크가 실패하면 그것은 방식 전환 신호가 아니라 **run-phase 블로커**이며, 오케스트레이터에게 보고해 사용자 결정을 다시 받는다 — 기각된 이음매 방식을 임의로 되살리지 않는다.

REQ/AC는 이 확정으로 바뀌지 않는다. AC-E2E-004는 "Toss 호스트로 나가는 요청이 0건"이라는 **관찰 가능한 결과**만 고정하고 메커니즘을 고정하지 않는다.

---

## §C. 결정 2 — 도구 선택: Playwright

- 이 저장소에 경쟁 도구가 이미 설치되어 있지 않다(`package.json` 확인 — Cypress·Puppeteer·WebdriverIO 모두 없음). 따라서 기존 선택과의 충돌이 아니라 **최초 선택**이다.
- MoAI의 `e2e-tester` 에이전트와 `moai:e2e` 스킬이 CLI 우선 툴체인으로 Playwright를 전제한다 — 후속 run-phase 위임이 그대로 얹힌다.
- 요구되는 기능이 모두 1급으로 있다: 요청 가로채기(`page.route`), 웹서버 기동 대기(`webServer`), 브라우저 바이너리 핀 고정, 컨텍스트별 쿠키 격리(REQ-E2E-015).
- Next.js App Router와의 조합이 흔하고, 서버 렌더 → 하이드레이션 경계를 자동 대기(auto-waiting)로 다룬다.

**핀 고정**: `@playwright/test`를 정확한 버전으로 devDependency에 넣고, 브라우저는 Chromium 하나만 설치한다. 첫 스위트에 3개 브라우저를 켜는 것은 신호 대비 비용이 나쁘다.

---

## §D. Toss 스텁 SDK 설계 (다리 1)

`page.route()`로 CDN 스크립트를 가로채고, **애플리케이션 로더가 기대하는 정확한 호출 형태**를 갖춘 스텁을 응답 본문으로 돌려준다. `toss-client.ts`가 요구하는 계약은 다음과 같다.

```
window.TossPayments(clientKey) -> { payment({customerKey}) -> { requestPayment(options) } }
```

`requestPayment`가 받는 `options`에는 `orderId`, `amount:{currency,value}`, `orderName`, `successUrl`, `failUrl`이 들어온다. 스텁은 이 중 `successUrl`/`failUrl`을 **애플리케이션이 준 값 그대로** 사용한다 — 테스트가 URL을 직접 지어내면 `PayButton`이 실제로 어떤 URL을 만드는지가 검증되지 않는다.

```js
// e2e/support/toss-sdk-stub.js (개념)
window.TossPayments = (clientKey) => ({
  payment: ({ customerKey }) => ({
    requestPayment: async (options) => {
      const mode = window.__E2E_PAYMENT_MODE__ ?? "success";   // 시나리오가 주입
      if (mode === "fail") {
        window.location.assign(options.failUrl);
        return;
      }
      const u = new URL(options.successUrl);
      u.searchParams.set("paymentKey", "e2e_stub_payment_key");
      u.searchParams.set("orderId", options.orderId);
      u.searchParams.set("amount", String(options.amount.value));
      window.location.assign(u.toString());
    },
  }),
});
```

모드 전환은 `page.addInitScript()`로 `window.__E2E_PAYMENT_MODE__`를 심어 시나리오별로 제어한다. 실패 → 재시도 시나리오(REQ-E2E-011)는 같은 페이지에서 모드를 성공으로 바꾼 뒤 결제를 다시 누른다.

**금지 요청 감시**: `context.route("**://*.tosspayments.com/**")`로 남은 모든 Toss 호스트 요청을 잡아 **테스트를 실패시킨다**. 이것이 REQ-E2E-005을 통과 여부로 만드는 장치이고, 스텁이 조용히 우회되는 회귀를 잡는다.

---

## §E. 자체 검증

| 검증 항목 | 명령 / 관찰 |
|---|---|
| 기존 스위트 불변 (REQ-E2E-002) | `npm test` 수집 파일 수가 변경 전후 동일 |
| 타입·린트 | `npm run typecheck`, `npm run lint` |
| E2E 통과 | `npm run test:e2e` 종료 코드 0 |
| Toss 호스트 무접촉 (REQ-E2E-005) | 감시 라우트가 한 번도 발동하지 않음 |
| 시나리오 독립성 (REQ-E2E-015) | 시나리오 순서를 뒤집어도 통과 |

---

## §F. 마일스톤

우선순위 순. 시간 추정은 쓰지 않는다.

### M1 — 하네스 뼈대와 다리 2 스파이크 (Priority High)

가장 불확실한 것을 가장 먼저 죽인다.

- `@playwright/test` 도입, Chromium만 설치, 버전 핀 고정
- `playwright.config.ts`: `webServer`(기동 대기 포함), `baseURL`, Chromium 단일 프로젝트
- `package.json`에 `test:e2e` 추가 — 기존 `test` 스크립트는 손대지 않는다
- **스파이크**: §B가 확정한 undici 전역 디스패처 모킹이 `TOSS_CONFIRM_URL` 과 조회 엔드포인트 호출을 실제로 가로채는지 확인한다(§B의 4단계). 실패하면 임의로 방식을 바꾸지 말고 **블로커로 보고**한다
- 필수 환경 변수 부재 시 조기 실패(REQ-E2E-004)
- 종료 조건: 빈 시나리오 하나가 홈 화면을 열고, 감시 라우트가 설치된 상태로 통과

### M2 — Toss 스텁 SDK와 결제 경로 (Priority High)

- §D의 스텁 스크립트 + `page.route()` 설치를 픽스처로 제공
- 성공 모드 / 실패 모드 (REQ-E2E-006/007)
- 금지 요청 감시 라우트 (REQ-E2E-005)
- 종료 조건: 스텁이 `PayButton`이 만든 `successUrl`로 실제 내비게이션을 일으킨다

### M3 — 해피 패스 여정 (Priority High)

- 상품 상세 → 장바구니 담기 → `/cart` 확인 (REQ-E2E-008)
- `/checkout` 폼 제출 → 주문 생성 → `/checkout/complete/{orderId}` (REQ-E2E-009)
- 결제 성공 → 결제 완료 상태 (REQ-E2E-010)
- 종료 조건: AC-E2E-001 통과

### M4 — 실패·재시도와 엣지 경로 (Priority Medium)

- 결제 실패 → `?payment_failed=1` → 재시도 → 성공 (REQ-E2E-011)
- 빈 장바구니로 `/checkout` 진입 (REQ-E2E-012)
- 필수 필드 누락 제출 거부 (REQ-E2E-013)
- 쿠폰 적용 후 요약 갱신 (REQ-E2E-014)

### M5 — 시드·격리 정리 (Priority Medium)

- 시나리오별 독립 상태 보장(REQ-E2E-015) — 컨텍스트별 쿠키 격리 + 필요한 시드 상품 확인
- 선택자를 접근성 이름 기반으로 정리(REQ-E2E-015)
- @MX 주석 부착(§H)

### M6 — 문서 (Priority Low)

- `e2e/README.md`: 필요한 환경 변수, 데이터베이스 전제, 실행 방법, CI 미포함 사유(spec.md §3 참조)

---

## §G. 위험

| 위험 | 영향 | 완화 |
|---|---|---|
| undici 전역 디스패처가 Next 워커 경계를 못 넘는다 | 성공 경로 검증 불가 | M1 스파이크로 선제 확인 → 실패 시 run-phase 블로커로 보고(기각된 이음매 방식을 임의 복원하지 않음) |
| 시드 상품 부재로 시나리오가 시작조차 못 함 | 전 시나리오 실패 | M1에서 전제 조건 확인을 명시적 실패로 |
| 하이드레이션 타이밍 플레이크 | 간헐적 실패 | 임의 `waitForTimeout` 금지, 역할·텍스트 기반 자동 대기만 사용 |
| 첫 E2E가 피라미드를 뒤집는다 | 유지비 폭증 | 여정 1개 · 시나리오 6개 상한 유지(spec.md §1.3) |
| 로컬 DB 상태 오염 | 재실행 시 불안정 | 시나리오가 자기 상태를 만들고, 기존 데이터에 의존하지 않음 |

---

## §H. @MX 태그 계획

E2E 하네스의 진입점에만 부착한다. **프로덕션 소스에는 부착하지 않는다** — §B가 프로덕션 변경 0줄을 확정했으므로 예외가 없다.

| 대상 | 태그 | 사유 |
|---|---|---|
| `e2e/support/toss-sdk-stub.js` | `@MX:ANCHOR` | 모든 결제 시나리오가 이 스텁 하나에 의존한다(fan-in ≥ 3). 호출 형태가 `toss-client.ts`의 계약과 어긋나면 전 시나리오가 조용히 무너진다 |
| Toss 호스트 감시 라우트 | `@MX:WARN` | 이 라우트가 제거되면 REQ-E2E-005이 검증되지 않은 채 초록으로 남는다 — 삭제 위험이 큰 안전장치 |
| `e2e/support/mock-toss-api.mjs` | `@MX:WARN` | 프로세스 전역 디스패처를 교체한다. Node/undici 버전 변화에 취약한 가정 |
| `playwright.config.ts`의 `webServer` | `@MX:NOTE` | 기동 명령에 인터셉터 주입이 얹혀 있어, 명령만 보면 의도가 보이지 않는다 |
| CI 미통합 사실 | `@MX:TODO` | 이 스위트는 로컬 전용이다(spec.md §3). 후속 SPEC이 CI 데이터베이스를 세우면 해소된다 |

---

## §I. 상호 참조

- `spec.md` — 요구사항(REQ-E2E-001~016), 범위 밖 6건
- `acceptance.md` — AC-E2E-001~015 (005a/005b 분기 포함 16항목)
- SPEC-ORDER-001 §3 — 게스트 전용 결정과 `409 MEMBER_CHECKOUT_UNSUPPORTED`
- SPEC-PAYMENT-001 — `toss-client.ts` / `toss-server.ts` 계약
- SPEC-CI-001 (completed) — CI에 데이터베이스가 없는 이유
