---
id: SPEC-ORDER-002
status: in-progress
updated: 2026-09-02
tier: M
---

# Progress: SPEC-ORDER-002 — 재고 차감 동시성 제어와 품절 처리

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-02
plan_status: audit-ready

plan-phase 산출물 3종(spec.md, plan.md, acceptance.md) 작성 완료. SPEC ID 정규식 검사를 Bash로 실행해 `PASS`를 관측했고(`SPEC-ORDER-002`), `.moai/specs/` 내 동일 ID 부재를 확인했다. 프론트매터 12필드 + `tier` + `depends_on` 확인. REQ 12건(REQ-ORDER-022 ~ 033) / AC 13건(AC-ORDER-024 ~ 036) 대응 확인 — REQ-ORDER-027이 AC 2건으로 나뉘어 13:12다(acceptance.md 머리말에 사유 명시). depends_on: [SPEC-ORDER-001, SPEC-PAYMENT-001] — 둘 다 `status: completed`.

**plan-audit 판정: PASS · 종합 점수 0.93** (Tier M 기준선 0.80). 근거: `.moai/reports/plan-audit/SPEC-ORDER-002-review-1.md` (iteration 1, 2026-09-02) — 이 파일을 직접 열어 판정 문구와 점수를 대조했다. Must-pass 7종 전부 PASS(클래리피케이션 마커 grep 0건 포함). 결함 7건 중 blocking 2건(D1: spec.md §5 AC 개수 오기 23→21, D2: plan.md 재시도 근거 문장의 범위 과대 서술)은 정정 완료 — 둘 다 판정 점수에 영향 없음(재감사 불요, 감사자 명시). D3~D7은 optional로 남김(D6은 run-phase에서 AC-ORDER-031 테스트 작성 시 함께 정리 예정).

**run-phase 진입 전 해소가 필요했던 2건은 2026-09-02 사용자 결정으로 모두 확정되었다** — 결정 내용과 받아들인 공백은 plan.md §0 "확정된 결정"에 기록했고, 범위에서 잘라낸 미결제 주문 재고 해제는 백로그 카드 `t21`로 세워 추적한다.

## §E.2 Run-phase Evidence

### M1 — 실패 보고의 정확성 (REQ-ORDER-025, REQ-ORDER-026)

카드 `t6` · 브랜치 `WT-inventory-concurrency` · cycle_type: tdd (RED-GREEN-REFACTOR).

**변경한 파일 4종 + 테스트 더블 보정 2종**

| 파일 | 변경 |
|---|---|
| `src/features/orders/repositories/order-repository.ts` | `findStockByProductIds(tx, productIds)` 추가 — 트랜잭션 클라이언트 **필수**(싱글턴 기본값 없음), `findMany({ where: { id: { in } }, select: { id, stock } })` |
| `src/features/orders/services/order-service.ts` | 차감 실패 시 같은 트랜잭션에서 재조회 → 순수 함수 `shortLines()`가 요청 수량보다 재고가 적은 **모든** 미차감 항목을 `products`에 담아 abort |
| `tests/unit/orders/order-repository.test.ts` | M1 describe 3건 추가 + `fakeTx`에 `product.findMany` 추가 |
| `tests/unit/orders/order-service.test.ts` | M1 describe 7건 추가 |
| `tests/unit/api/orders/route.test.ts` | 레포지토리 모듈 목에 새 export 추가 (목 누락 시 import 실패) |
| `tests/integration/orders/create-order.test.ts` | 인메모리 fake `product.findMany` 추가 — 차감이 쓰는 **같은 store**를 읽으므로 트랜잭션 내부 관측을 그대로 모형화 |

#### 1. Claim (주장)

1. `findStockByProductIds`는 주어진 상품 id들의 현재 재고를 **주어진 트랜잭션 클라이언트로** 읽으며 싱글턴 기본값을 갖지 않는다 (REQ-ORDER-025).
2. 조건부 차감이 거부되면 서비스는 같은 트랜잭션에서 재고를 다시 읽어, 요청 수량보다 재고가 적은 **모든** 항목을 `products`에 담는다 (REQ-ORDER-025 · AC-ORDER-027).
3. `products`의 모든 항목에서 `available < quantity`가 성립한다 (REQ-ORDER-026 · AC-ORDER-028).
4. 기존 테스트 746건이 회귀 없이 전부 통과하고, `typecheck` · `lint` 종료 코드가 0이다.

#### 2. Evidence (증거 — 실행한 명령과 그 출력 그대로)

**RED — 구현 전에 실패를 관측했다** (`.moai/state/verify/spec-order-002-m1/red.txt`, gitignored):

```
$ npx vitest run tests/unit/orders/order-repository.test.ts tests/unit/orders/order-service.test.ts
 ❯ tests/unit/orders/order-repository.test.ts (16 tests | 3 failed) 8ms
   × SPEC-ORDER-002 M1 — findStockByProductIds (REQ-ORDER-025) > reads the current stock of exactly the products it was given 2ms
   × SPEC-ORDER-002 M1 — findStockByProductIds (REQ-ORDER-025) > returns the rows as read, with no reshaping 0ms
   × SPEC-ORDER-002 M1 — findStockByProductIds (REQ-ORDER-025) > takes the transaction client with no singleton default (REQ-ORDER-025) 0ms
 ❯ tests/unit/orders/order-service.test.ts (46 tests | 5 failed) 16ms
   × SPEC-ORDER-002 M1 — ... > reports EVERY short line, not just the one that failed (AC-ORDER-027) 5ms
   × SPEC-ORDER-002 M1 — ... > never reports a quantity the shopper could actually have bought (AC-ORDER-028) 0ms
   × SPEC-ORDER-002 M1 — ... > re-reads inside the SAME transaction that failed (REQ-ORDER-025) 0ms
   × SPEC-ORDER-002 M1 — ... > does not report a line this transaction already decremented 1ms
   × SPEC-ORDER-002 M1 — ... > refuses with an EMPTY product list when the re-read shows restocking (acceptance.md §2) 0ms

 Test Files  2 failed (2)
      Tests  8 failed | 54 passed (62)
exit=1
```

RED 시점의 실패 사유가 스냅샷 보고임을 그대로 보여주는 단언 하나(AC-ORDER-028 계열):

```
AssertionError: expected [ { productId: 'p-1', …(2) } ] to deeply equal []
- Array []
+ Array [
+   Object {
+     "available": 10,      ← 트랜잭션 시작 시점 스냅샷(거짓)
+     "name": "머그컵",
+     "productId": "p-1",
+   },
+ ]
```

**GREEN — 전체 스위트**:

```
$ npm test
 Test Files  61 passed (61)
      Tests  746 passed (746)
   Duration  16.57s (transform 1.49s, setup 0ms, collect 3.40s, tests 30.62s, environment 5.24s, prepare 3.37s)
exit=0
```

**타입 검사**:

```
$ npm run typecheck
> our-shop@0.1.0 typecheck
> tsc --noEmit
exit=0
```
(진단 출력 없음 — `tsc --noEmit`은 오류가 0건일 때 아무것도 출력하지 않는다.)

**린트**:

```
$ npm run lint
> our-shop@0.1.0 lint
> eslint .
exit=0
```
(위반 0건 — eslint는 문제가 없으면 출력이 없다.)

**변경 파일 커버리지** (임계 85%):

```
$ npx vitest run --coverage --coverage.reporter=text \
    --coverage.include='src/features/orders/repositories/order-repository.ts' \
    --coverage.include='src/features/orders/services/order-service.ts' \
    tests/unit/orders tests/unit/api/orders tests/integration/orders
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.85 |    97.56 |     100 |   97.85 |
 repositories      |     100 |      100 |     100 |     100 |
  ...repository.ts |     100 |      100 |     100 |     100 |
 services          |    97.3 |     97.4 |     100 |    97.3 |
  order-service.ts |    97.3 |     97.4 |     100 |    97.3 | 175-180
exit=0
```

미커버 175-180은 `validate()`의 `deliveryMemo` 비문자열 분기로, M1이 건드리지 않은 기존 코드다(이 부분 집합 실행에서만 미도달).

**범위 · PRESERVE 확인**:

```
$ git status --short
 M src/features/orders/repositories/order-repository.ts
 M src/features/orders/services/order-service.ts
 M tests/integration/orders/create-order.test.ts
 M tests/unit/api/orders/route.test.ts
 M tests/unit/orders/order-repository.test.ts
 M tests/unit/orders/order-service.test.ts

$ git diff --numstat -- prisma/schema.prisma src/components/product/ProductDetailView.tsx \
    src/features/payments src/components/checkout
(빈 출력)
```

#### 3. Baseline-attribution (baseline 귀속)

- 트리: `WT-inventory-concurrency` 워크트리, HEAD `0908b43f817bee1e320b5a54d324567fbb1cf3af` + 위 6개 파일의 미커밋 변경.
- 위 모든 수치는 **이번 실행에서 이 트리를 대상으로** 관측한 것이다. 이전 실행이나 다른 SPEC의 수치를 옮겨 적은 항목은 없다.
- RED 출력은 구현 커밋 이전 상태에서 캡처한 것으로, 테스트가 실제로 먼저 실패했다는 증거다(test-after는 이 출력을 만들 수 없다).
- 회귀 기준선: M1 착수 직전 `npm test`가 744건 통과였고, M1이 신규 테스트 10건을 더해 746건이 되었다(744 + 10 = 746, 산술 일치).

#### 4. Gaps (미검증)

- **실 PostgreSQL에서 아무것도 관측하지 않았다.** 위 초록불은 전부 인메모리 fake 기준이며, 행 잠금 직렬화가 성립한다는 증거가 **아니다**(REQ-ORDER-033). `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`은 여전히 **열린 항목**이다.
- **AC-ORDER-027의 "트랜잭션 시작 후 재고가 바뀌는" 상황을 실제 동시성으로 만들지 않았다.** 재조회 결과를 목으로 주입해 재현했으므로, 판정되는 것은 "재조회 값을 보고한다"까지이지 "경쟁에서 져서 값이 바뀌었다"가 아니다.
- **M1은 차감 순서를 건드리지 않았다.** 여전히 `cart.items`의 `createdAt` 순서를 따르므로 G1(교착)은 열린 채이며, M2의 몫이다.
- **`CONCURRENCY_RETRY` 매핑(REQ-ORDER-027)은 M1 범위 밖**이라 구현·검증하지 않았다.
- 통합 테스트의 fake `product.findMany`는 롤백을 모형화하지 않는다 — 실패 후 재조회 시점에 앞선 차감이 store에 남아 있다. 실 DB의 트랜잭션 내부 가시성과 같은 방향이지만, 롤백 자체는 검증 대상이 아니었다.

#### 5. Residual-risk (잔여 위험)

- **이미 차감에 성공한 항목을 보고에서 제외하는 규칙**은 AC에 명시되어 있지 않고 M1이 내린 판단이다. 근거: 그 항목의 재고는 충분했고, 재조회 값이 낮은 이유는 곧 롤백될 이 트랜잭션 자신의 차감 때문이므로, 보고하면 주문자와 무관한 상품을 지목하게 된다(G2와 같은 자기 모순). 반대 해석 — "재조회 값이 요청 수량보다 작은 모든 항목"을 문자 그대로 담는 것 — 을 택하면 이 항목들도 포함되므로, 검토자가 다르게 판단하면 뒤집힐 수 있다. 전용 테스트("does not report a line this transaction already decremented")로 의도를 고정해 두었다.
- `products`가 빈 배열이 될 수 있다(재조회 시점 재입고). acceptance.md §2가 허용한 상태지만, 이를 렌더할 화면은 M3에서 만들어지므로 그 전까지는 UI 공백이다.
- 실패 경로에 `findMany` 1회가 추가된다. 성공 경로의 질의 수는 변하지 않았고 이미 잠긴 행들을 한 번에 읽지만, 실제 지연 영향은 측정하지 않았다.
- 회귀로 판정된 기존 테스트 2건(`create-order.test.ts`, `route.test.ts`)은 **테스트 더블의 공백**이었지 동작 회귀가 아니었다. 두 곳 모두 새 계약(재조회 값)을 공급하도록 고쳤고 단언 자체는 바꾸지 않았다 — `available: 2`라는 기대값은 그대로이고 출처만 스냅샷에서 재조회로 옮겨졌다.

**M2 ~ M5**: _<pending>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
