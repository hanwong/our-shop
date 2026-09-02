---
id: SPEC-ORDER-002
status: completed
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

### M2 — 결정적 차감 순서와 중단 매핑 (REQ-ORDER-022, REQ-ORDER-023, REQ-ORDER-027)

카드 `t6` · 브랜치 `WT-inventory-concurrency` · cycle_type: tdd · M1 커밋 `a0f38aa` 위에 쌓았다.

**변경한 파일**

| 파일 | 변경 |
|---|---|
| `src/features/orders/services/order-service.ts` | 차감 루프 진입 전 `[...items].sort(byProductId)`로 **사본**을 정렬(REQ-ORDER-023). 트랜잭션 경계 catch에 `isTransactionConflict()`(Prisma `P2034`) → `CONCURRENCY_RETRY` 409 매핑 추가(REQ-ORDER-027) |
| `src/features/orders/types/order.ts` | `OrderFailureCode`에 `CONCURRENCY_RETRY` 추가, `OrderFailure` 유니온에 대응 멤버 추가(plan.md §2). 기존 4개 코드의 의미는 불변 |
| `tests/unit/orders/stock-write-paths.test.ts` (신규) | AC-ORDER-024 — `src/features/orders/**` 정적 스캔 |
| `tests/unit/orders/order-service.test.ts` | M2 describe 2종 11건 추가 |
| `tests/unit/api/orders/route.test.ts` | `CONCURRENCY_RETRY`의 HTTP 표면 1건 추가 |
| `tests/integration/orders/create-order.test.ts` | `stockWriteLog` 기록 + 잠금 순서/표시 순서 분리 검증 2건 추가 |

#### 1. Claim (주장)

1. 여러 상품을 차감할 때 **상품 id 오름차순**으로 잠근다. 장바구니 저장 순서(`createdAt`)를 따르지 않는다 (REQ-ORDER-023 · AC-ORDER-025).
2. 그 정렬은 **잠금 순서에만** 적용된다. 저장·응답·완료 화면의 항목 순서는 장바구니 순서 그대로다 (plan.md §5 PRESERVE · AC-ORDER-025 후반부).
3. 같은 상품 두 개를 **반대 순서**로 담은 두 장바구니가 동일한 차감 순서를 만든다 (AC-ORDER-034의 fake 관측 가능 부분).
4. 트랜잭션 중단(Prisma `P2034`)은 409 `CONCURRENCY_RETRY`로 식별되며, 미분류 500으로 새지 않는다 (REQ-ORDER-027 · AC-ORDER-029).
5. 재고 쓰기 경로는 조건부 원자 갱신 **한 곳뿐**이며 그 UPDATE가 자기 WHERE에 `stock: { gte }` 가드를 갖는다 (REQ-ORDER-022 · AC-ORDER-024).
6. 전체 테스트 764건 통과, `typecheck` · `lint` 종료 코드 0.

#### 2. Evidence (증거 — 실행한 명령과 그 출력 그대로)

**RED — 구현 전 9건 실패** (`.moai/state/verify/spec-order-002-m1/m2-red.txt`, gitignored):

```
$ npx vitest run tests/unit/orders tests/unit/api/orders tests/integration/orders
 ❯ tests/unit/orders/order-service.test.ts (56 tests | 7 failed) 33ms
   × SPEC-ORDER-002 M2 — deduction order is decided by id, not by the cart (REQ-ORDER-023) > takes the lines in ascending product-id order (AC-ORDER-025) 11ms
   × ... > takes two carts holding the same products in opposite order identically (AC-ORDER-034) 1ms
   × ... > sorts by code unit, not by locale (a locale-dependent order is not deterministic) 1ms
   × SPEC-ORDER-002 M2 — an aborted transaction is retryable, not a mystery (REQ-ORDER-027) > answers 409 CONCURRENCY_RETRY (AC-ORDER-029) 1ms
   × ... > does not let the abort escape as an unclassified error 2ms
   × ... > creates no order and empties no cart when the transaction is aborted 0ms
   × ... > maps the conflict wherever in the transaction it surfaces 0ms
 ❯ tests/unit/api/orders/route.test.ts (18 tests | 1 failed) 20ms
   × ... > 409s an aborted transaction with CONCURRENCY_RETRY (SPEC-ORDER-002 AC-ORDER-029) 3ms
 ❯ tests/integration/orders/create-order.test.ts (24 tests | 1 failed) 109ms
   × SPEC-ORDER-002 M2 — locking order and line order are different things (AC-ORDER-025) > locks by ascending product id, whatever order the cart was built in 8ms

 Test Files  3 failed | 4 passed (7)
      Tests  9 failed | 145 passed (154)
exit=1
```

**RED이 아니었던 3건을 정직하게 구분한다.** 아래 3건은 처음부터 초록이었고 그 상태가 정상이다 — RED→GREEN 전환을 거쳤다고 주장하지 않는다.

| 테스트 | 처음부터 초록인 이유 |
|---|---|
| `stock-write-paths.test.ts` 5건 전부 (AC-ORDER-024) | REQ-ORDER-022는 **이미 있는 것을 계약으로 고정**하는 요구사항이다(plan.md §1). 새 동작이 아니므로 실패할 상태가 애초에 없다 — 회귀 가드다 |
| "leaves the ORDER's own item order exactly as the cart stored it" | PRESERVE 가드. 정렬 도입 **전에도 후에도** 초록이어야 의미가 있다 — 정렬이 저장 순서로 새면 이 테스트가 빨개진다 |
| 통합 "stores the lines in cart order, and reads them back that way" | 같은 이유. 잠금 순서와 표시 순서가 어긋난 장바구니(B→A 담기, id 순서는 A→B)를 쓰기 때문에 공허하지 않다 |

**GREEN — 전체 스위트**:

```
$ npm test
 Test Files  62 passed (62)
      Tests  764 passed (764)
   Duration  16.43s (transform 1.56s, setup 0ms, collect 3.50s, tests 30.95s, environment 5.35s, prepare 3.31s)
exit=0
```

**타입 검사 · 린트**:

```
$ npm run typecheck        $ npm run lint
> tsc --noEmit             > eslint .
exit=0                     exit=0
```
(둘 다 문제가 없을 때 아무것도 출력하지 않는다 — 종료 코드가 신호다.)

**변경 파일 커버리지** (임계 85%):

```
$ npx vitest run --coverage --coverage.reporter=text \
    --coverage.include='src/features/orders/services/order-service.ts' \
    --coverage.include='src/features/orders/types/order.ts' \
    tests/unit/orders tests/unit/api/orders tests/integration/orders
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.65 |    96.66 |     100 |   96.65 |
 services          |   96.65 |    96.62 |     100 |   96.65 |
  order-service.ts |   96.65 |    96.62 |     100 |   96.65 | 175-180,293-294
 types             |       0 |        0 |       0 |       0 |
  order.ts         |       0 |        0 |       0 |       0 |
exit=0
```

두 미커버 구간과 `order.ts`의 0%를 있는 그대로 적는다.

- **175-180**: `validate()`의 `deliveryMemo` 비문자열 분기 — M2가 건드리지 않은 기존 코드(이 부분 집합 실행에서만 미도달).
- **293-294**: `byProductId`의 `return 0`(두 id가 같을 때). `CartItem`의 `@@unique([cartId, productId])`가 한 장바구니에 같은 상품이 두 줄로 존재하는 것을 **불가능하게** 하므로 도달 경로가 없다(acceptance.md §2가 같은 이유로 방어 코드를 금지한다). 비교 함수는 전순서를 반환해야 하므로 이 줄을 지울 수는 없다.
- **`order.ts` 0%**: 이 파일은 `export type` / `export interface`뿐이고 런타임 문장이 0개다. 0/0을 0%로 보고한 것이며 **미검증이 아니라 측정 대상이 없는 것**이다. 커버리지를 달성했다고 주장하지 않는다.

**범위 · PRESERVE 확인** (M1 커밋 `a0f38aa` 기준):

```
$ git diff --numstat a0f38aa
65	4	src/features/orders/services/order-service.ts
16	4	src/features/orders/types/order.ts
48	0	tests/integration/orders/create-order.test.ts
18	0	tests/unit/api/orders/route.test.ts
169	0	tests/unit/orders/order-service.test.ts
(+ 신규 미추적 파일 tests/unit/orders/stock-write-paths.test.ts)

$ git diff --numstat a0f38aa -- prisma/schema.prisma src/components src/features/payments \
    src/features/cart src/app src/lib
(빈 출력)
```

M3 대상인 `src/components/checkout/`도 0줄이다 — M2는 화면을 건드리지 않았다.

#### 3. Baseline-attribution (baseline 귀속)

- 트리: `WT-inventory-concurrency` 워크트리, M1 커밋 `a0f38aa` + 위 6개 파일의 미커밋 변경.
- 모든 수치는 **이번 실행에서 이 트리를 대상으로** 관측했다. M1 보고서의 수치를 옮겨 적은 항목은 없다.
- 회귀 산술: M1 종료 시점 **746건** → M2 신규 **18건** = **764건**(실측과 일치). 내역: `order-service.test.ts` 10건(차감 순서 4 + 중단 매핑 6, 46→56으로 확인) + `stock-write-paths.test.ts` 5건 + `route.test.ts` 1건 + `create-order.test.ts` 2건. 기존 746건 중 이번에 깨진 것은 **없다**.

#### 4. Gaps (미검증)

- **교착이 실제로 일어나는 것을 관측하지 않았다.** 인메모리 fake는 행 잠금을 모형화하지 않으므로 교착 자체를 만들 수 없다. AC-ORDER-034의 `AC-034-EXCL-DEADLOCK`은 **열린 채**이며, 여기서 판정된 것은 "두 장바구니가 같은 차감 순서를 만든다"까지다 — 그 순서가 실제로 교착을 없앤다는 것은 M4의 실 DB 하네스가 관측할 몫이다.
- **`P2034`가 실제로 던져지는 것을 관측하지 않았다.** 매핑은 plan.md §4 M2가 지목한 코드(`P2034`)를 그대로 구현했고, 테스트는 그 코드를 **주입**해 확인했다. 살아 있는 PostgreSQL이 40P01/40001을 정말 `P2034`로 표면화하는지는 이 저장소에서 한 번도 확인된 적이 없다 — M4가 닫을 공백이다.
- **다른 Prisma 오류 코드는 매핑하지 않았다.** 예컨대 원시 질의를 경유해 `P2010` + `meta.code: 40P01` 형태로 올라오는 경우는 처리하지 않는다. 관측할 수 없는 형태를 추측해 코드를 넣는 것은 검증 불가능한 분기를 늘리는 일이라 하지 않았다.
- **AC-ORDER-024는 "read-compare-write 경로가 존재하지 않음"을 증명하지 않는다.** 정적 스캔이 증명하는 것은 (a) 재고를 쓰는 문장이 하나뿐이고 (b) 그 문장이 자기 가드를 갖는다는 것까지다. 의미론적 부재 증명은 정적 검사로 불가능하며, 테스트 본문 주석에 같은 한계를 적어 두었다.
- **`CONCURRENCY_RETRY`를 표시할 화면이 아직 없다.** `CheckoutForm`의 `SubmitFailure`는 `code?: string`이라 타입은 깨지지 않지만, 지금 이 코드를 받은 주문자는 전용 문구를 보지 못한다 — M3 몫이다.

#### 5. Residual-risk (잔여 위험)

- **정렬은 이 SPEC의 차감 경로 안에서만 성립한다.** `payment-repository.ts`의 `markOrderCancelledAndRestoreStock()`은 같은 상품 행들을 순회 갱신하면서 이 순서 규칙 밖에 있다(plan.md §5가 관찰 사항으로만 남긴 항목). 차감과 복원 사이의 교착은 이론상 남으며, 그 경우 REQ-ORDER-027의 `CONCURRENCY_RETRY`가 흡수한다 — 막은 것이 아니라 식별 가능하게 만든 것이다.
- **`products` 배열의 순서가 장바구니 순서에서 잠금 순서로 바뀌었다.** `shortLines(lockingOrder.slice(index))`이므로 id 오름차순이다. 어떤 AC도 이 순서를 규정하지 않아 위반은 아니지만, M3가 화면에 목록을 그릴 때 장바구니 순서를 기대한다면 조정이 필요하다.
- **자동 재시도는 만들지 않았다**(plan.md §1의 명시적 결정). `CONCURRENCY_RETRY`를 받은 주문자는 직접 다시 제출해야 한다. 멱등키가 같으므로 첫 트랜잭션이 롤백된 이상 새 주문이 생성된다(acceptance.md §2).
- **M5 중복 방지 메모**: 완료 화면의 항목 순서 보존(plan.md §5)은 여기서 **단위·통합 양쪽으로 이미 고정**했다 — 단위는 `createOrderWithItems`에 넘어가는 행과 응답 DTO를, 통합은 `store.orderItems` · 응답 · `getOrderForGuest()` 재조회 세 지점을 단언한다. M5는 이 항목을 다시 만들지 말고 이 테스트들을 근거로 인용하면 된다.

### M3 — 주문서 화면의 재고 표면화 (REQ-ORDER-028, REQ-ORDER-029, REQ-ORDER-030)

카드 `t6` · 브랜치 `WT-inventory-concurrency` · cycle_type: tdd · M2 커밋 `0ab8e74` 위에 쌓았다.

**변경한 파일**

| 파일 | 변경 |
|---|---|
| `src/components/checkout/OrderSummary.tsx` | `stockNotice()` 추가 — 항목마다 `품절` / `재고 부족 — 현재 N개` / 표시 없음 세 상태(REQ-ORDER-028). 이미 받고 있는 `CartItemDTO.stock`을 쓰며 **새 조회는 없다** |
| `src/components/checkout/CheckoutForm.tsx` | `SubmitFailure.products` 수용 + `shortProducts` 상태 + 항목별 목록 렌더(REQ-ORDER-030). 제출 시작 시 목록을 비운다 |
| `tests/unit/components/order-summary.test.tsx` (신규) | AC-ORDER-030 6건 |
| `tests/unit/components/checkout-form.test.tsx` | AC-ORDER-032 + `CONCURRENCY_RETRY` 8건 |
| `tests/unit/app/checkout-page.test.tsx` | AC-ORDER-031 3건 (화면 전체 렌더) |

기존 컴포넌트 테스트 관례를 그대로 따랐다: 파일 첫 줄 `// @vitest-environment jsdom` 지시자 + `@testing-library/react`. vitest 기본 환경은 `node`이고 컴포넌트 테스트만 파일 단위로 DOM을 선택한다(vitest.config.ts 주석).

#### 1. Claim (주장)

1. 주문 요약이 항목마다 재고 상태를 표시한다 — 재고 충분: 표시 없음 / `stock < quantity`: 재고 부족 + 현재 수량 / `stock <= 0`: 품절 (REQ-ORDER-028 · AC-ORDER-030).
2. 그 표시는 제출을 **막지 않는다**. 모든 항목이 품절이어도 버튼이 활성 상태이고 `POST /api/orders`가 실제로 나간다 (REQ-ORDER-029 · AC-ORDER-031).
3. 재고 부족 거부 시 응답의 `products`를 항목별로 렌더하고 각 상품의 구매 가능 수량을 함께 보여준다 (REQ-ORDER-030 · AC-ORDER-032).
4. `CONCURRENCY_RETRY`는 재시도 문구를 보여주되 **상품을 특정하지 않는다** (plan.md §3).
5. 전체 테스트 781건 통과, `typecheck` · `lint` 종료 코드 0.

#### 2. Evidence (증거 — 실행한 명령과 그 출력 그대로)

**RED — 구현 전 7건 실패** (`.moai/state/verify/spec-order-002-m1/m3-red.txt`, gitignored):

```
$ npx vitest run tests/unit/components/order-summary.test.tsx \
    tests/unit/components/checkout-form.test.tsx tests/unit/app/checkout-page.test.tsx
 ❯ tests/unit/components/order-summary.test.tsx (6 tests | 2 failed) 50ms
   × SPEC-ORDER-002 M3 — per-line stock state (AC-ORDER-030) > marks a line short, with the quantity actually available 7ms
   × SPEC-ORDER-002 M3 — per-line stock state (AC-ORDER-030) > marks a line with no stock left as sold out 3ms
 ❯ tests/unit/app/checkout-page.test.tsx (24 tests | 1 failed) 149ms
   × SPEC-ORDER-002 M3 — the screen informs but never blocks (AC-ORDER-031) > marks both lines sold out 6ms
 ❯ tests/unit/components/checkout-form.test.tsx (17 tests | 4 failed) 4301ms
   × SPEC-ORDER-002 M3 — a refusal names the products (REQ-ORDER-030) > shows every named product, not one line the shopper cannot act on (AC-ORDER-032) 1014ms
   × ... > shows each product's currently available quantity (AC-ORDER-032) 1017ms
   × ... > clears a previous product list when the next submission fails differently 1009ms
   × SPEC-ORDER-002 M3 — an aborted transaction reads as retryable (plan.md §3) > names no product, because the database never said which line lost 1010ms

 Test Files  3 failed (3)
      Tests  7 failed | 40 passed (47)
exit=1
```

**첫 RED 실행에서 통과해 버린 테스트 2건을 잡아 고쳤다 — 기록해 둔다.** 최초 픽스처의 상품 **이름**을 상태 이름("품절", "부족")으로 지었더니, `lineFor("품절").textContent` 가 상품명 자체와 일치해 **표시기가 전혀 없는 컴포넌트에서도 초록**이 됐다. 이름을 평범한 상품명(머그컵/텀블러/티팟)으로 바꾸자 정상적으로 빨개졌다(위 출력의 "marks a line with no stock left as sold out"). 픽스처가 단언을 무력화한 사례이므로 테스트 본문 주석에도 남겼다.

**처음부터 초록이었던 신규 테스트 10건 (17건 중)** — RED→GREEN 전환을 거쳤다고 주장하지 않는다.

| 분류 | 건수 | 초록인 이유 |
|---|---|---|
| REQ-ORDER-029 계열 (AC-ORDER-031 중 2건) | 2 | "막지 말 것"이라는 **금지형 요구사항**이다. 화면은 전에도 막지 않았으므로 통과가 정상이며, 이 테스트의 값어치는 미래에 차단 로직이 들어오면 빨개진다는 데 있다 |
| 부정형 단언 (재고 충분한 항목엔 표시 없음, 품절을 "재고 부족"이라 부르지 않음, `products`가 비면 목록 없음 등) | 6 | 표시기가 없던 시점에도 참이다. 구현 후에도 참이어야 의미가 있다 |
| 기존 동작 보존 (요약의 이름·단가·합계 유지, 서버 문구가 alert로 도달) | 2 | 추가가 기존 렌더를 밀어내지 않았음을 고정하는 가드 |

**GREEN — 전체 스위트**:

```
$ npm test
 Test Files  63 passed (63)
      Tests  781 passed (781)
   Duration  16.10s (transform 1.34s, setup 0ms, collect 3.28s, tests 30.35s, environment 5.40s, prepare 3.33s)
exit=0
```

**타입 검사 · 린트**:

```
$ npm run typecheck        $ npm run lint
> tsc --noEmit             > eslint .
exit=0                     exit=0
```

**변경 파일 커버리지** (임계: 라인 85% / 브랜치 80%):

```
$ npx vitest run --coverage --coverage.reporter=text \
    --coverage.include='src/components/checkout/OrderSummary.tsx' \
    --coverage.include='src/components/checkout/CheckoutForm.tsx' \
    tests/unit/components tests/unit/app
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|-------------------
All files         |     100 |    95.91 |     100 |     100 |
 CheckoutForm.tsx |     100 |    94.87 |     100 |     100 | 83,119
 OrderSummary.tsx |     100 |      100 |     100 |     100 |
exit=0
```

미커버 브랜치 2곳은 **M3가 만든 것이 아니다**: 83행은 제출 중 재진입을 막는 `if (submitting) return;`(버튼이 비활성이라 핸들러 조기 반환 경로에 도달하지 않는다), 119행은 `failure.error ?? "주문을 완료하지 못했습니다"`의 폴백 가지(모든 테스트가 `error`를 보낸다). 둘 다 SPEC-ORDER-001 시절 코드다.

**범위 · PRESERVE 확인** (M2 커밋 `0ab8e74` 기준):

```
$ git diff --numstat 0ab8e74
40	0	src/components/checkout/CheckoutForm.tsx
42	14	src/components/checkout/OrderSummary.tsx
76	1	tests/unit/app/checkout-page.test.tsx
123	0	tests/unit/components/checkout-form.test.tsx
(+ 신규 미추적 파일 tests/unit/components/order-summary.test.tsx)

$ git diff --numstat 0ab8e74 -- prisma/schema.prisma src/features src/app src/lib \
    src/components/product src/components/checkout/PayButton.tsx
(빈 출력)
```

`src/features`가 0줄이다 — M3는 M1/M2의 백엔드 로직을 건드리지 않았다. `src/app`도 0줄(페이지는 이미 `cart`를 `OrderSummary`에 넘기고 있었으므로 배선 변경이 필요 없었다). `ProductDetailView`와 `PayButton`도 0줄.

#### 3. Baseline-attribution (baseline 귀속)

- 트리: `WT-inventory-concurrency` 워크트리, M2 커밋 `0ab8e74` + 위 5개 파일의 미커밋 변경.
- 모든 수치는 **이번 실행에서 이 트리를 대상으로** 관측했다. M1/M2 보고서의 수치를 옮겨 적지 않았다.
- 회귀 산술: M2 종료 시점 **764건** → M3 신규 **17건** = **781건**(실측과 일치). 내역: `order-summary.test.tsx` 6 + `checkout-form.test.tsx` 8 + `checkout-page.test.tsx` 3. 기존 764건 중 깨진 것은 **없다**.

#### 4. Gaps (미검증)

- **실제 브라우저에서 본 적이 없다.** 전부 jsdom 렌더다. 레이아웃, 색 대비, 좁은 화면에서 표시기가 상품명을 밀어내는지 등 **시각적 결과는 관측하지 않았다**. 이 저장소에 시각 회귀 도구나 E2E 브라우저 하네스가 없어 만들지 않았다(M3 범위 밖).
- **스크린리더 동작을 검증하지 않았다.** `products` 목록은 평범한 `<ul>`이며 `role="alert"`인 요약 문구와 **별개 요소**다. 즉 목록 자체는 라이브 리전으로 자동 announce되지 않는다. 기존 필드 오류가 `aria-describedby`로 입력과 묶여 있는 수준의 접근성 배선을 목록에는 하지 않았다 — 어떤 AC도 요구하지 않았고, 추측으로 넣기보다 공백으로 남긴다.
- **`stockNotice`의 `<= 0` 분기 중 음수 경로는 테스트하지 않았다.** `Product.stock`에 CHECK 제약이 없어 표현은 가능하지만, REQ-ORDER-024가 음수를 금지하므로 정상 경로에서는 발생하지 않는다.
- **품절 표시와 실제 구매 가능 여부의 시간차를 관측하지 않았다.** 화면이 읽은 재고는 렌더 시점 값이며, 렌더~제출 사이 재입고가 일어나는 경우를 재현하지 않았다(그 상황에서 제출이 막히지 않는다는 것만 AC-ORDER-031로 고정).

#### 5. Residual-risk (잔여 위험)

- **`products` 목록의 표시 순서는 서버가 준 순서 그대로다 — 즉 상품 id 오름차순(M2의 잠금 순서)이고 장바구니 순서가 아니다.** 어떤 AC도 이 순서를 규정하지 않아 위반은 아니다. 장바구니 순서로 다시 정렬하지 **않은** 이유는 취향이 아니라 구조다: `CheckoutForm`은 `idempotencyKey`와 `confirmedTotal`만 받고 **장바구니를 알지 못하므로**, 정렬하려면 새 prop으로 카트를 내려보내야 하고 이는 M3 범위 밖의 결합 증가다. 항목이 두세 개인 일반적인 주문에서는 체감되지 않지만, 화면상 순서가 요약과 어긋나 보일 수 있다는 점은 남는 위험이다.
- **`CONCURRENCY_RETRY` 전용 클라이언트 문구는 넣지 않았다 — 지시와 다른 선택이므로 명시한다.** M3 지시는 "전용 문구가 없다"고 했으나, 서버가 이미 `error` 문구를 보내고 폼은 그것을 그대로 alert에 띄운다(`OrderFailure`에서 `error`는 **필수** 필드라 이 코드에서 누락될 수 없다). 클라이언트에 같은 문장을 한 벌 더 두면 같은 카피가 두 곳에서 어긋날 수 있어, 대신 **목록을 렌더하지 않는다**는 성질만 테스트로 고정했다. 서버 문구를 바꾸면 화면이 자동으로 따라온다. 전용 카피가 필요하다는 판단이면 되돌리기 쉬운 한 줄이다.
- **실패 목록의 수량 표기는 0을 포함해 일률적으로 `현재 N개`다.** `available === 0`일 때 `품절`로 바꾸면 요약의 라벨과는 맞지만 AC-ORDER-032가 명시한 숫자(`0`)가 화면에서 사라진다. 숫자를 남기는 쪽을 택했고, 그 결과 요약("품절")과 실패 목록("현재 0개")의 문구가 같은 상태를 다르게 부른다.
- **M5 중복 방지 메모**: 요약이 기존에 보여주던 이름·단가·합계가 유지된다는 보존 확인은 여기서 이미 고정했다(`order-summary.test.tsx`의 "still shows every line's name, price and total"). M5는 이를 인용하면 된다.

### M4 — 실 PostgreSQL 동시성 하네스 (REQ-ORDER-024, REQ-ORDER-032, REQ-ORDER-033)

카드 `t6` · 브랜치 `WT-inventory-concurrency` · M3 커밋 `6d1fad4` 위에 쌓았다.

**이번 실행은 건너뛰지 않았다.** 살아 있는 PostgreSQL 16.15(localhost:5433, `our_shop`)에 도달했고, 이 저장소에서 **처음으로** 행 잠금 직렬화를 실제로 관측했다. 아래 모든 수치는 인메모리 fake가 아니라 그 데이터베이스에서 나온 것이다.

**변경한 파일: 1개 (테스트만)**

| 파일 | 변경 |
|---|---|
| `tests/integration/orders/concurrency.postgres.test.ts` (신규) | 능력 게이트 2건 + 시나리오 A 5건 + 시나리오 B 3건 + 반사실 3건 = 13건 |

`src/`와 `prisma/`의 diff는 **0줄**이다 — M4는 제품 코드를 한 줄도 바꾸지 않았다.

#### 1. Claim (주장)

1. `stock=1`인 상품을 두 주문이 **동시에** 요청하면 정확히 하나만 성공하고, 재고가 정확히 `0`이 되며, 주문 행이 정확히 1건 생긴다 (REQ-ORDER-024 · AC-ORDER-035).
2. 진 쪽은 409 + 행동 가능한 코드로 거부되며 미분류 500이 아니다.
3. 상품 A·B를 **반대 순서**로 담은 두 장바구니를 병렬 실행해도 어느 쪽도 미분류 500을 받지 않는다 (AC-ORDER-034).
4. 데이터베이스에 도달할 수 없으면 하네스는 **사유를 남기고** 건너뛰며, 사유 없는 침묵은 테스트가 실패시킨다 (REQ-ORDER-033).
5. 하네스가 만든 데이터는 전부 회수되어 재실행이 멱등하다.

#### 2. Evidence (증거 — 실행한 명령과 그 출력 그대로)

**연결 확인** (하네스와 같은 클라이언트):

```
$ node .moai/state/verify/spec-order-002-m1/probe.mjs
CONNECTED: our_shop PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on
products: 5 categories: 2
orders: 0 carts: 0
```

**하네스 실행 — 실 DB 관측 결과**:

```
$ npm test
[SPEC-ORDER-002 M4] live PostgreSQL reachable — concurrency observed for real (run m4-f2bfbbbe)
[SPEC-ORDER-002 M4] scenario A outcomes: ok, refused(INSUFFICIENT_STOCK)
[SPEC-ORDER-002 M4] scenario B outcomes: ok, ok
[SPEC-ORDER-002 M4] counterfactual outcomes: REJECTED code=(none) ::  | committed
[SPEC-ORDER-002 M4] real deadlock arrives as PrismaClientUnknownRequestError with code=undefined

 Test Files  64 passed (64)
      Tests  794 passed (794)
   Duration  16.34s (transform 1.29s, setup 0ms, collect 3.31s, tests 31.97s, environment 5.85s, prepare 3.40s)
exit=0
```

시나리오 A의 `ok, refused(INSUFFICIENT_STOCK)`가 이 SPEC 전체가 존재하는 이유다 — 두 트랜잭션이 같은 행을 노렸고, 하나만 통과했으며, 재고는 `0`에서 멈췄다(음수 아님). **이것이 SPEC-ORDER-001이 검증하지 못한 채 남겨 둔 그 주장이다.**

**반사실 — 교착이 실재함을 확인했다.** PostgreSQL이 실제로 뱉은 원문:

```
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError {
  code: "40P01", message: "deadlock detected", severity: "ERROR",
  detail: Some("Process 11564 waits for ShareLock on transaction 796; blocked by process 11565.\n
               Process 11565 waits for ShareLock on transaction 797; blocked by process 11564."),
  column: None, hint: Some("See server log for query details.") }), transient: false })
```

**타입 검사 · 린트**:

```
$ npm run typecheck        $ npm run lint
> tsc --noEmit             > eslint .
exit=0                     exit=0
```
(린트 경고 0건 — 초안의 불필요한 `eslint-disable no-console` 지시자 5개는 경고를 유발해 제거했다.)

**멱등성 · 데이터 회수**:

```
$ npx vitest run tests/integration/orders/concurrency.postgres.test.ts   (연속 2회)
 Test Files  1 passed (1)        Test Files  1 passed (1)
      Tests  13 passed (13)            Tests  13 passed (13)

$ node .moai/state/verify/spec-order-002-m1/probe.mjs    # 전체 npm test 이후
products: 5 categories: 2
orders: 0 carts: 0        ← 실행 전과 정확히 동일
```

**범위 확인** (M3 커밋 `6d1fad4` 기준):

```
$ git diff --numstat 6d1fad4 -- src prisma
(빈 출력)

$ git status --short
?? tests/integration/orders/concurrency.postgres.test.ts
```

#### 2-bis. 이 마일스톤이 찾아낸 결함 — REQ-ORDER-027의 매핑이 실제로는 성립하지 않는다

M4의 가장 중요한 산출물은 초록불이 아니라 이 발견이다.

**관측된 사실**: 실제 40P01 교착이 Prisma 6.1을 통해 애플리케이션에 도달할 때의 형태는 다음과 같다(두 번 독립 관측, `deadlock-shape.mjs`).

```
constructor: PrismaClientUnknownRequestError
instanceof PrismaClientKnownRequestError: false
code prop: undefined          ← P2034가 아니라 아예 없다
meta prop: undefined
own keys: ["clientVersion","name"]
has 40P01 in message: true    ← SQLSTATE는 메시지 문자열 안에만 있다
```

**대조할 코드**(`order-service.ts`, M2가 작성):

```ts
function isTransactionConflict(error: unknown): boolean {
  return isRecord(error) && error.code === "P2034";
}
```

**결론**: 관측된 오류의 `code`는 `undefined`이고 술어는 `"P2034"`와의 일치를 요구하므로, **이 술어는 실제 교착에 대해 절대 참이 되지 않는다.** 즉 진짜 교착이 주문 서비스의 트랜잭션을 중단시키면 `CONCURRENCY_RETRY`로 매핑되지 못하고 그대로 재던져져 **미분류 500**이 된다 — REQ-ORDER-027이 없애려던 바로 그 결과다. plan.md §4 M2의 "Prisma `P2034` 경유"라는 전제가 이 환경에서 **반증되었다**.

**증명의 강도를 정확히 말한다.** 위 결론은 (a) 오류 형태의 **직접 관측**과 (b) 술어 소스의 **읽기**를 결합한 연역이다. 서비스 트랜잭션이 교착의 희생자가 되어 주문자가 500을 받는 장면을 **끝까지 관측하지는 못했다** — 시도했으나(`service-deadlock.mjs`, 4회 실행) PostgreSQL이 매번 대조군 트랜잭션 쪽을 희생자로 골라 서비스는 정상 커밋했다. 희생자 선택은 이쪽에서 통제할 수 없다.

**M2 코드를 고치지 않았다.** 지시가 M4를 M2 범위에서 명시적으로 차단했고, 이는 마일스톤 경계를 넘는 결정이므로 리드에게 보고한다. 하네스에는 **관측된 형태 그대로** 단언을 걸어 두었다(`code`가 `undefined`임을 단언). 이는 두 가지를 동시에 한다: 사실을 기록하고, 훗날 Prisma가 교착을 분류하기 시작하면 그 테스트가 빨개져 REQ-ORDER-027의 매핑을 다시 판단하게 만드는 **덫**이 된다.

#### 3. Baseline-attribution (baseline 귀속)

- 트리: `WT-inventory-concurrency` 워크트리, M3 커밋 `6d1fad4` + 신규 테스트 파일 1개(미추적).
- 데이터베이스: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2), `our_shop` @ localhost:5433, 마이그레이션 적용 완료 상태.
- 모든 수치는 **이번 실행에서 이 트리·이 데이터베이스를 대상으로** 관측했다. 이전 마일스톤의 수치를 옮겨 적지 않았다.
- 회귀 산술: M3 종료 시점 **781건** → M4 신규 **13건** = **794건**(실측 일치). 기존 781건 중 깨진 것은 **없다**.

#### 4. Gaps (미검증)

- **CI에서는 여전히 열려 있다.** 이 관측은 **개발자 기계 한 대**에서 이루어졌다. `.github/workflows/ci.yml`의 `DATABASE_URL`은 여전히 자리표시자이므로, CI에서 이 파일은 사유를 남기고 건너뛴다. plan.md §0에서 (B)로 확정한 대로 CI 승격은 후속 CI SPEC의 몫이며, `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`은 **CI 기준으로는 닫히지 않았다**. 개발자 기계에서만 닫혔다.
- **서비스가 교착 희생자가 되는 장면을 관측하지 못했다**(위 2-bis). 4회 시도 모두 대조군이 희생자였다.
- **동시성 수준은 2다.** 두 트랜잭션만 겨뤘다. 열 개, 백 개가 몰리는 상황이나 커넥션 풀 고갈은 관측하지 않았다.
- **시나리오 B는 교착을 재현하지 않는다.** M2의 정렬 덕분에 교착이 발생하지 않는 것이 정상이고 실제로 둘 다 성공했으므로(`ok, ok`), 이 시나리오가 판정한 것은 "정렬된 경로는 교착하지 않는다"까지다. 교착이 실재한다는 증거는 **반사실 시나리오**가 따로 만든다.
- **단일 프로세스 안의 병렬성이다.** 두 요청은 같은 Node 프로세스, 같은 Prisma 풀에서 나갔다. 여러 서버 인스턴스가 붙는 실제 배포 형태는 재현하지 않았다(별도 프로세스를 띄우지 말라는 안전 제약과, 그것이 트랜잭션 수준 경쟁에는 불필요하다는 판단에 따른 것).
- **성능을 측정하지 않았다.** 잠금 대기 시간, 처리량은 이 하네스의 관심사가 아니다.

#### 5. Residual-risk (잔여 위험)

- **REQ-ORDER-027은 지금 이 순간 충족되지 않은 상태다**(2-bis). 발동 조건이 좁다는 점이 위험을 줄이기는 한다 — M2의 정렬이 차감 경로 내부의 교착을 없앴으므로, 남는 트리거는 차감과 결제 취소 복원(`payment-repository.ts`, 순서 규칙 밖) 사이의 교착 정도다. 그러나 "좁다"는 것과 "없다"는 것은 다르고, 그 경우 주문자는 재시도하면 성공할 주문에 대해 500을 받는다. 수정은 한 곳(`isTransactionConflict`)이며, 관측된 형태에 맞추려면 `PrismaClientUnknownRequestError`와 메시지 내 `40P01`/`40001`을 함께 보는 방식이 필요하다 — 문자열 검사는 취약하므로 그 취약함을 감수할지 자체가 판단 사항이다.
- **반사실 시나리오는 타이밍에 의존한다.** 배리어로 순서를 강제하지만, 교착 탐지는 PostgreSQL의 `deadlock_timeout`(기본 1초) 이후에 일어난다. 부하가 큰 기계에서는 느려질 수 있고, 어느 쪽이 희생자가 되는지도 데이터베이스가 정한다 — 그래서 "정확히 하나가 중단된다"까지만 단언하고 어느 쪽인지는 단언하지 않았다.
- **공유 개발 DB를 쓴다.** 행마다 실행별 접두사를 붙이고 `afterAll`에서 지우므로 정상 종료 시 흔적이 없다(위 확인). 다만 실행이 중간에 강제 종료되면 `m4-*` 행이 남을 수 있다. 실제로 이번 작업 중 프로브 하나가 import 실패로 죽어 `svc-*` 행 4개를 남겼고, 확인해 지웠다 — 하네스가 아니라 프로브의 문제였지만 같은 위험이 하네스에도 있다. 남은 행은 `m4-` 접두사로 찾아 지우면 된다.
- **`.env`를 테스트가 직접 읽는다.** vitest에 setup 파일이 없어 `process.loadEnvFile(".env")`를 파일 상단에서 호출한다. 이 API는 Node 20.12+/21.7+가 필요하며(`package.json` engines는 `>=20.0.0`), 더 낮은 20.x에서는 예외가 나지만 `try/catch`가 삼키고 환경변수 경로로 넘어가므로 최악의 경우 "건너뜀 + 사유 기록"이 된다.

---

### M4 부록 — 2-bis 결함 수정: REQ-ORDER-027 술어를 실제 오류 형태에 맞춘다

카드 `t6` · M4 커밋 `13ffb3e` 위에 쌓았다. **M5가 아니라 M4의 후속**이다 — M4가 관측으로 찾아낸 결함을 같은 실행 안에서 닫는다.

리드 결정: M2 파일로 되돌아가더라도 지금 고친다. 근거는 이것이 M2가 충족했어야 할 바로 그 요구사항(REQ-ORDER-027)이고, 그 불충족을 M4 자신의 증거가 밝혔기 때문이다.

**변경한 파일 3개** (리드가 예상한 것과 정확히 일치)

| 파일 | 변경 |
|---|---|
| `src/features/orders/services/order-service.ts` | `isTransactionConflict()`에 SQLSTATE 검사 추가(`P2034` 검사는 유지) + 실 DB 단언을 위해 export |
| `tests/unit/orders/order-service.test.ts` | M4-fix describe 6건 추가 |
| `tests/integration/orders/concurrency.postgres.test.ts` | 실 DB 단언 1건 추가 + 주석 블록 갱신 |

#### 1. Claim (주장)

1. 실제 40P01 교착의 오류 형태(`code` 없음, SQLSTATE는 메시지 안)를 `isTransactionConflict()`가 인식한다 (REQ-ORDER-027).
2. 40001(직렬화 실패)도 같은 경로로 인식된다.
3. `P2034` 검사는 **유지**된다 — 다른 경로가 이미 그 코드를 낼 수 있고, 훗날 Prisma가 분류하기 시작하면 그대로 맞는다.
4. 과대 매칭하지 않는다: SQLSTATE 없는 미분류 오류, 일반 텍스트 속 `40001`, 객체가 아닌 throw 모두 재시도로 오인하지 않는다.
5. **실 PostgreSQL이 중단시킨 진짜 트랜잭션의 오류 객체**에 대해 이 함수가 `true`를 반환함을 관측했다.

#### 2. Evidence (증거)

**RED — 실제 오류 형태로 3건 실패**:

```
$ npx vitest run tests/unit/orders/order-service.test.ts
 ❯ tests/unit/orders/order-service.test.ts (61 tests | 3 failed) 14ms
   × SPEC-ORDER-002 M4-fix — the shape a REAL deadlock actually has (REQ-ORDER-027) > maps a real 40P01 deadlock to CONCURRENCY_RETRY (REQ-ORDER-027) 3ms
   × ... > maps a real 40001 serialization failure the same way 0ms
   × ... > does not let a real deadlock reach the shopper as an unclassified 500 0ms
 Test Files  1 failed (1)
      Tests  3 failed | 58 passed (61)
exit=1
```

실패 형태가 결함 그 자체다 — 매핑되지 않고 **그대로 다시 던져졌다**:

```
PrismaClientUnknownRequestError:
Invalid `prisma.product.updateMany()` invocation:

Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError {
  code: "40P01", message: "deadlock detected", ... }), transient: false })
```

과대 매칭 가드 2건은 처음부터 초록이었다(가드의 정상 상태). RED는 3건이다.

**GREEN — 전체 스위트 · 타입 검사 · 린트**:

```
$ npm test
 Test Files  64 passed (64)
      Tests  801 passed (801)
   Duration  16.44s (transform 1.26s, setup 0ms, collect 3.36s, tests 31.78s, environment 5.68s, prepare 3.39s)
exit=0

$ npm run typecheck        $ npm run lint
> tsc --noEmit             > eslint .
exit=0                     exit=0
```

**실 DB에서 닫은 고리** — 하네스가 잡은 진짜 중단 트랜잭션에 production 함수를 직접 적용한다:

```
$ npx vitest run tests/integration/orders/concurrency.postgres.test.ts
[SPEC-ORDER-002 M4] live PostgreSQL reachable — concurrency observed for real (run m4-054a54b8)
[SPEC-ORDER-002 M4] scenario A outcomes: refused(INSUFFICIENT_STOCK), ok
[SPEC-ORDER-002 M4] scenario B outcomes: ok, ok
[SPEC-ORDER-002 M4] counterfactual outcomes: REJECTED code=(none) ::  | committed
[SPEC-ORDER-002 M4] real deadlock arrives as PrismaClientUnknownRequestError with code=undefined
 ✓ tests/integration/orders/concurrency.postgres.test.ts (14 tests) 1161ms
 Test Files  1 passed (1)
      Tests  14 passed (14)
exit=0
```

`is recognised by the SERVICE's own predicate (REQ-ORDER-027, closed)` — 픽스처가 아니라 **실제 오류 객체**에 대해 통과했다. 13건 → 14건.

**커버리지** (변경 파일):

```
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|-------------------
 order-service.ts |   96.69 |    96.84 |     100 |   96.69 | 175-180,329-330
```

미커버 2구간은 기존 그대로다(175-180 `deliveryMemo` 분기, 329-330 `byProductId`의 스키마상 도달 불가한 `return 0`). 분기 커버리지는 M2 시점 96.62% → **96.84%** 로 올랐다 — 새 술어의 분기를 전수 덮었기 때문이며, 비객체 throw 가드도 전용 테스트로 덮었다.

**범위 확인** (M4 커밋 `13ffb3e` 기준):

```
$ git diff --numstat 13ffb3e
45	9	src/features/orders/services/order-service.ts
28	6	tests/integration/orders/concurrency.postgres.test.ts
109	0	tests/unit/orders/order-service.test.ts

$ git diff --numstat 13ffb3e -- prisma src/components src/app src/lib src/features/cart \
    src/features/payments src/features/orders/repositories src/features/orders/types
(빈 출력)
```

#### 3. Baseline-attribution (baseline 귀속)

- 트리: `WT-inventory-concurrency` 워크트리, M4 커밋 `13ffb3e` + 위 3개 파일의 미커밋 변경.
- 데이터베이스: PostgreSQL 16.15 `our_shop` @ localhost:5433 (M4와 동일).
- 모든 수치는 이번 실행에서 이 트리·이 데이터베이스를 대상으로 관측했다.
- 회귀 산술: M4 종료 시점 **794건** → 신규 **7건**(단위 6 + 실 DB 1) = **801건**(실측 일치). 기존 794건 중 깨진 것은 **없다**.
- **"수정 전이었다면 실패했다"의 근거**: 옛 술어의 유일한 조건은 `error.code === "P2034"`였고(소스), 실제 오류의 `code`는 하네스 출력에 `code=undefined`로 **관측**되었다. `undefined === "P2034"`는 거짓이다. 추측이 아니라 관측값에 대한 직접 평가다.

#### 4. Gaps (미검증)

- **서비스가 교착 희생자가 되는 장면은 여전히 관측하지 못했다.** M4의 4회 시도와 마찬가지로 PostgreSQL의 희생자 선택은 통제할 수 없다. 이번에 닫은 것은 "실제 오류 객체를 술어가 인식한다"이지 "실제 희생 상황에서 주문자가 409를 받는다"의 끝단 관측이 아니다. 다만 그 사이에 남은 것은 이미 테스트로 덮인 서비스 매핑 경로뿐이다.
- **40001을 실 DB에서 만들어 보지 못했다.** Read Committed + 조건부 UPDATE 패턴은 직렬화 실패를 만들지 않는다. 40001 픽스처는 40P01과 **같은 커넥터 렌더링 형태**를 따른 것이며, 그 형태 가정 자체는 관측되지 않았다.
- **메시지 형식이 API 계약이 아니다.** 정규식은 관측된 `code: "…"` 필드에 고정되어 있다. Prisma가 렌더링을 바꾸면 매칭이 깨진다 — 다만 조용히 깨지지는 않는다(아래).
- **CI는 여전히 이 실 DB 단언을 실행하지 않는다.** M4와 동일한 공백이며 후속 CI SPEC 소유다.

#### 5. Residual-risk (잔여 위험)

- **문자열 매칭의 취약성은 남는다 — 감수하고 계측했다.** 완화책은 실 DB 단언이다: Prisma가 메시지를 바꾸면 `isTransactionConflict()`를 진짜 오류에 적용하는 그 테스트가 **빨개진다**. 500이 조용히 돌아오는 대신 테스트가 먼저 깨진다. 이것이 M4의 "덫"을 관측형에서 **기능형**으로 바꾼 지점이다.
- **`40001`을 느슨하게 매칭하지 않았다** — `code: "…"` 필드에 앵커했다. 다섯 자리 숫자는 금액·수량·id로 오류 메시지에 실릴 수 있고, 느슨한 매칭은 영구 실패를 재시도 가능으로 오분류해 주문자에게 무한 재시도를 권하게 된다. 대가는 반대편 위험이다: Prisma가 `SQLSTATE 40P01` 같은 다른 형식으로 바꾸면 매칭에 실패해 **현재 알려진 동작(500)으로 되돌아간다** — 회귀는 아니지만 개선도 아니다.
- **`isTransactionConflict`를 export했다.** 순수 술어이고 부작용이 없으며, 이 파일은 이미 `calculateShippingFee` / `generateOrderNumber` 등을 테스트를 위해 export하는 선례를 갖고 있다. 그래도 이는 테스트 이음새를 위한 가시성 확대이며, 실 오류 객체에 진짜 함수를 적용하는 값어치가 그 대가보다 크다고 판단했다.
- **M2의 기존 `{ code: "P2034" }` 픽스처 테스트는 남겨 두었다.** 그 형태는 이 환경에서 발생하지 않지만, `P2034` 분기가 살아 있음을 고정하는 값어치가 있다. 다만 그 describe의 테스트들은 **현실에서 발생하지 않는 형태**를 검증한다는 사실을 M4-fix describe 머리말에 명시해 두었다 — 초록이 무엇을 보증하고 무엇을 보증하지 않는지 읽는 사람이 오해하지 않도록.

---

### M5 — 보존 검증 (REQ-ORDER-031)

카드 `t6` · M4-fix 커밋 `8de6c71` 위. **run-phase의 마지막 마일스톤.**

**결론부터: 이 마일스톤은 새 결함을 찾지 못했고, 새 테스트 표면을 만들지 않았다.** M1~M4가 이미 각자의 증거로 덮은 것을 전수 확인하고, 아직 명시적으로 확인되지 않은 PRESERVE 항목만 마저 쓸어냈다. 제품 코드 변경은 **0줄**이다.

#### 1. Claim (주장)

1. SPEC-ORDER-001 · SPEC-PAYMENT-001 · SPEC-STOREFRONT-001의 기존 테스트가 전부 통과한다 (AC-ORDER-033).
2. 완료 화면의 항목 순서(`createdAt` 오름차순)는 변경되지 않았다.
3. plan.md §5 PRESERVE 6개 항목 **전부**가 무변경이거나 이미 보고된 의도적 변경이다.
4. 어떤 산출물도 초록불을 행 잠금 직렬화의 증거로 제시하지 않는다 (AC-ORDER-036).
5. 이 마일스톤은 `status` 전이를 수행하지 **않는다** — 규칙상 이 단계의 소유자가 아니다.

#### 2. Evidence (증거)

**전체 회귀** — 선행 SPEC 스위트가 모두 초록이다:

```
$ npm test
 Test Files  64 passed (64)
      Tests  801 passed (801)
   Duration  16.61s (transform 1.39s, setup 0ms, collect 3.53s, tests 32.05s, environment 5.75s, prepare 3.36s)
exit=0
```

선행 SPEC의 자체 가드가 살아 있음을 개별로 확인한다:

```
 ✓ tests/unit/orders/scope-boundaries.test.ts (15 tests) 87ms   ← SPEC-ORDER-001 자체 PRESERVE 가드
 ✓ tests/unit/components/product-detail-view.test.tsx (5 tests) ← SPEC-STOREFRONT-001 품절 표시
 ✓ tests/unit/payments/payment-repository.test.ts (12 tests)    ← SPEC-PAYMENT-001 복원 경로
 ✓ tests/unit/payments/payment-service.test.ts (20 tests)
 ✓ tests/integration/payments/webhook-flow.test.ts (10 tests)
 ✓ tests/unit/payments/guest-only-scope.test.ts (4 tests)
 ✓ tests/integration/cart/guest-merge.test.ts (9 tests)
```

`scope-boundaries.test.ts`가 특히 값어치 있다 — SPEC-ORDER-001이 **자기 PRESERVE 목록을 스스로 검사**하도록 만든 파일이고, 이 SPEC의 5개 마일스톤을 거친 뒤에도 15건 전부 통과한다.

**PRESERVE 6항목 전수 확인** (plan-phase 커밋 `0908b43` 기준 — M1 이전):

| plan.md §5 항목 | 확인 방법 | 결과 |
|---|---|---|
| `ProductDetailView.tsx` 품절 표시 | `git diff --numstat 0908b43 -- src/components/product/ProductDetailView.tsx` | 빈 출력 (무변경) |
| `payment-repository.ts` `markOrderCancelledAndRestoreStock()` | `git diff --numstat 0908b43 -- src/features/payments` | 빈 출력 (무변경) |
| `Order`·`OrderItem`·`Product` 스키마 | `git diff --numstat 0908b43 -- prisma` | 빈 출력 — **마이그레이션 0건**(plan.md §5가 "마이그레이션이 발생하면 설계가 어긋난 것"이라 한 기준을 충족) |
| `decrementStockIfAvailable()`의 조건부 갱신 형태 | 해당 함수 본문의 diff 라인 검사 | 본문 변경 0줄. 같은 파일에 `findStockByProductIds`가 **추가**되었을 뿐 |
| 주문 항목의 저장·표시 순서 (`createdAt` 오름차순) | `ORDER_INCLUDE`의 `orderBy` diff | `+`/`-` 없음. 현재도 `orderBy: [{ createdAt: "asc" }, { id: "asc" }]` |
| 기존 4개 실패 코드의 의미 | `order.ts` diff 전수 | `MEMBER_CHECKOUT_UNSUPPORTED`·`CART_EMPTY`·`INSUFFICIENT_STOCK`·`PRICE_CHANGED` 4개 모두 문자열·형태 무변경. 유니온에 `CONCURRENCY_RETRY` **추가**만 발생(plan.md §2가 예고한 계약 변경) |

**항목 순서 보존은 M2에서 이미 고정했다 — 중복 생성하지 않고 이름으로 인용한다**(M2 잔여 위험의 메모대로):

| 층위 | 테스트 | 무엇을 고정하는가 |
|---|---|---|
| 단위 | `order-service.test.ts` → "leaves the ORDER's own item order exactly as the cart stored it (plan.md §5)" | `createOrderWithItems`에 넘어가는 행과 응답 DTO가 장바구니 순서 |
| 통합 | `create-order.test.ts` → "stores the lines in cart order, and reads them back that way" | `store.orderItems` · 응답 · `getOrderForGuest()` 재조회 3지점 |
| 통합 | `create-order.test.ts` → "locks by ascending product id, whatever order the cart was built in" | 잠금 순서가 표시 순서와 **다름**을 같은 픽스처로 대조 |

M3도 요약의 기존 표시(이름·단가·합계) 보존을 `order-summary.test.tsx` → "still shows every line's name, price and total"로 고정해 두었다.

**AC-ORDER-036 — 정직성 정적 검사**: `progress.md` 전수 확인 결과, 초록불을 직렬화의 증거로 제시한 서술은 **없다**. 반대로 세 지점에서 명시적으로 부정한다(155행 M1, 292행 M2, 564행 M4). 두 제외 항목은 열린 항목으로 이름 붙어 있다:

```
155: 위 초록불은 전부 인메모리 fake 기준이며, 행 잠금 직렬화가 성립한다는 증거가 **아니다**(REQ-ORDER-033).
     `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`은 여전히 **열린 항목**이다.
564: ... `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`은 **CI 기준으로는 닫히지 않았다**. 개발자 기계에서만 닫혔다.
```

**status 전이는 수행하지 않았다 — 규칙을 확인한 결과다.** `spec-frontmatter-schema.md` § Status Transition Ownership Matrix:

```
| draft → in-progress                     | manager-develop (on M1 commit start) |
| in-progress → implemented → completed   | manager-docs (on the single sync commit) |
```

그리고 § Forbidden ownership crossings: "manager-develop MUST NOT modify spec.md / plan.md / acceptance.md body content (frontmatter `status:` + `updated:` updates on the **`draft → in-progress`** transition are allowed; ALL other body modifications are forbidden)."

즉 run-phase 완료에 대응하는 전이는 **존재하지 않는다**. 다음 전이(`in-progress → implemented → completed`)는 sync 커밋에서 manager-docs가 한 번에 수행한다. 4개 산출물은 `status: in-progress`로 **그대로 둔다** — 여기서 `implemented`로 올리면 소유권 매트릭스를 위반하고 `OwnershipTransitionInvalid` 린트를 유발한다.

#### 3. Baseline-attribution (baseline 귀속)

- 트리: `WT-inventory-concurrency`, M4-fix 커밋 `8de6c71` + 이 마일스톤의 `progress.md` 변경(제품 코드 0줄).
- PRESERVE 스윕의 비교 기준점은 **plan-phase 커밋 `0908b43`** — M1 이전, 즉 이 SPEC이 아무것도 건드리기 전이다. 마일스톤 간 diff가 아니라 SPEC 전체 diff를 본다.
- 801건은 이번 실행에서 이 트리를 대상으로 관측했다. 이전 마일스톤의 수치를 옮겨 적지 않았다.
- 회귀 산술: M4-fix 종료 시점 **801건** → M5 신규 **0건** = **801건**. M5는 테스트를 추가하지 않았다.

#### 4. Gaps (미검증)

- **"기존 4개 실패 코드의 의미"는 형태로만 확인했다.** 유니온 멤버의 문자열·필드가 무변경임은 diff로 관측했지만, 각 코드가 발생하는 *조건*이 의미상 그대로인지는 정적 diff가 아니라 선행 SPEC의 테스트가 보증한다(전부 통과). 의미 변경을 다른 방식으로 별도 검증하지는 않았다.
- **선행 SPEC 테스트의 "충분성"은 검증 대상이 아니었다.** M5가 확인한 것은 그 테스트들이 통과한다는 사실이지, 그것들이 선행 SPEC의 동작을 빠짐없이 덮는다는 것이 아니다.
- **M4의 CI 공백은 M5가 닫지 못한다.** `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`은 CI 기준으로 열린 채이며, 이는 plan.md §0에서 (B)로 확정된 범위 밖 사항이다.
- **`git diff` 기반 확인은 워킹 트리 기준이다.** 선행 SPEC의 파일이 이 SPEC 밖에서(다른 세션·다른 카드) 변경되었을 가능성은 이 스윕이 구분하지 못한다 — `0908b43` 이후 이 브랜치에서 일어난 변경만 본다.

#### 5. Residual-risk (잔여 위험)

- **`scope-boundaries.test.ts`는 고정된 과거 구간을 검사한다.** 그 파일은 `PLAN_PHASE_HEAD`~`SPEC_MERGE_HEAD`(c19ab47~733e320)라는 **핀 박힌 역사 구간**을 diff한다. 즉 SPEC-ORDER-001이 무엇을 바꿨는지에 대한 역사적 사실을 계속 참으로 유지할 뿐, 이 SPEC이 그 경로를 새로 건드렸는지는 판정하지 않는다. 그 판정은 위 표의 `0908b43` 기준 스윕이 한다 — 두 검사는 대상이 다르며 서로를 대신하지 못한다.
- **`payment-repository.ts`의 복원 경로는 여전히 순서 규칙 밖이다**(plan.md §5가 관찰 사항으로만 남긴 항목, M2 잔여 위험에서 재확인). 차감과 복원 사이의 교착 가능성은 이 SPEC이 없애지 않았고, REQ-ORDER-027의 매핑이 흡수하도록 남겨 두었다 — 그 매핑은 M4-fix에서 실제 오류 형태에 맞춰졌다.
- **run-phase가 여기서 끝나지만 SPEC은 닫히지 않았다.** `status`는 `in-progress`이고, `implemented → completed` 전이와 CHANGELOG·문서 동기화는 sync 단계(manager-docs)의 몫이다. 이 브랜치는 아직 push되지 않았고 PR도 없다 — 통합은 리드가 수행한다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-09-02
run_commit_sha: 30cb50e               # M5 커밋. 자신의 SHA는 착륙 후에만 알 수 있어 후속 커밋에서 backfill (D3 예외)
run_status: audit-ready
spec_tier: M
development_cycle: tdd (RED-GREEN-REFACTOR)

ac_pass_count: 13
ac_fail_count: 0
ac_total: 13
ac_qualifier: >-
  13건 전부 개발자 기계에서 PASS. 단 AC-ORDER-035는 `Where` 능력 게이트이며
  데이터베이스 도달 불가 환경(CI 포함)에서는 SKIP이다 — 건너뜀은 통과가 아니다.

preserve_list_post_run_count: 6/6      # plan.md §5의 6개 항목 전부 확인 (M5 §2 표)
schema_migrations: 0                   # prisma/ diff 0줄

total_run_phase_files: 18              # 소스 5 + 테스트 9 + SPEC 산출물 4
source_files_changed: 5
test_files_changed: 9
spec_artifacts_changed: 4

final_suite: "64 files / 801 tests / exit 0"
typecheck: "tsc --noEmit — exit 0"
lint: "eslint . — exit 0, 경고 0건"
new_warnings_or_lints_introduced: 0
coverage_changed_files:
  order-service.ts: "96.69% stmts / 96.84% branch"
  order-repository.ts: "100%"
  OrderSummary.tsx: "100%"
  CheckoutForm.tsx: "100% stmts / 94.87% branch"
cross_platform_build: n/a              # Go 전용 항목. 이 프로젝트는 TypeScript이며
                                       # 교차 컴파일 대상이 없다 — 해당 없음을 명시한다

m1_to_mN_commit_strategy: 마일스톤별 1커밋 + 결함 수정 1커밋 (총 6)
commits:
  M1: a0f38aa   # 재고 부족 실패 보고를 트랜잭션 내 재조회로 교체 (REQ-025/026)
  M2: 0ab8e74   # 상품 id 오름차순 잠금 + 트랜잭션 중단 매핑 (REQ-022/023/027)
  M3: 6d1fad4   # 주문서 화면 재고 표면화 (REQ-028/029/030)
  M4: 13ffb3e   # 실 PostgreSQL 동시성 하네스 (REQ-024/032/033)
  M4-fix: 8de6c71  # REQ-027 술어를 실제 교착 오류 형태에 맞춤 (M4 2-bis 후속)
  M5: 30cb50e   # 보존 검증 (REQ-031) — run-phase 종료

branch: WT-inventory-concurrency
pushed: false                          # 아직 push하지 않았다. 통합은 리드가 수행한다
pr: none
status_transition_performed: "draft → in-progress (M1, a0f38aa)"
status_now: in-progress                # 다음 전이는 sync 커밋에서 manager-docs가 수행
```

### 이 run-phase가 실제로 한 일

SPEC-ORDER-002는 동시성 전략을 새로 고르지 않았다. 조건부 원자 갱신은 이미 있었고(`order-repository.ts`, SPEC-ORDER-001), 이 SPEC은 그 전략이 **성립하지 않는 네 구멍**을 막고 그 성립을 **처음으로 관측**했다.

| 구멍 (spec.md §2) | 닫은 마일스톤 | 무엇이 바뀌었나 |
|---|---|---|
| G1 — 잠금 순서 미결정 → 교착 | M2 | 상품 id 오름차순 잠금. 정렬은 잠금 순서에만 적용되고 표시 순서는 불변 |
| G2 — 실패 응답의 `available`이 스냅샷이라 거짓 | M1 | 같은 트랜잭션에서 재조회한 값으로 교체 |
| G3 — 부족 상품을 한 건만 보고 | M1 | 요청 수량보다 적은 **모든** 미차감 항목 보고 |
| G4 — 화면이 재고를 전혀 안 보여줌 | M3 | 항목별 품절/재고 부족 표시 + 거부 시 상품 목록 렌더 |

그리고 M4가 **관측**을 더했다: 재고 1을 두 주문이 동시에 노렸을 때 정확히 하나만 성공하고 재고가 0에서 멈추는 것을, 살아 있는 PostgreSQL 16.15에서 확인했다. 이는 SPEC-ORDER-001이 "실 DB에서만 관측 가능"이라 적어 두고 미검증으로 남긴 주장이다.

**M4는 결함도 하나 찾았다.** plan.md §4 M2가 전제한 "40P01은 Prisma `P2034`로 도달한다"가 반증되었고(실제로는 `code` 없는 `PrismaClientUnknownRequestError`), 그 결과 REQ-ORDER-027은 단위 테스트가 초록인 채로 미충족 상태였다. M4-fix가 관측된 형태에 맞춰 술어를 고치고, 진짜 중단 트랜잭션의 오류 객체에 production 함수를 적용하는 실 DB 단언으로 닫았다.

### 아직 열려 있는 것 (sync/audit가 알아야 할 것)

1. **CI에서는 동시성 하네스가 실행되지 않는다.** `.github/workflows/ci.yml:60`의 `DATABASE_URL`은 어떤 데이터베이스도 열지 않는 자리표시자다. 하네스는 사유를 남기고 건너뛴다. 따라서 `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`은 **CI 기준으로 열린 채**이며, 개발자 기계에서만 닫혔다. plan.md §0에서 (B)로 확정된 **받아들인 공백**이고, CI 승격은 후속 CI SPEC(SPEC-CI-001 소유)의 몫이다.
2. **서비스가 교착 희생자가 되는 장면은 관측하지 못했다.** 4회 시도 모두 PostgreSQL이 대조군 트랜잭션을 희생자로 골랐다. REQ-ORDER-027의 매핑은 (a) 실제 오류 객체에 대한 술어 반환값과 (b) 서비스 매핑 경로의 단위 테스트로 나뉘어 검증되었지, 끝단 한 번으로 관측되지 않았다.
3. **`40001`(직렬화 실패)은 실 DB에서 만들어 보지 못했다.** Read Committed + 조건부 UPDATE 패턴은 이를 생성하지 않는다. 픽스처는 관측된 `40P01`과 **같은 커넥터 렌더링 형태**를 따른 추론이며, 그 가정 자체는 미관측이다.
4. **메시지 문자열 매칭은 API 계약이 아니다.** `isTransactionConflict()`의 SQLSTATE 검사는 커넥터의 `code: "…"` 렌더링에 의존한다. 취약하지만 조용히 깨지지 않는다 — 실 DB 단언이 먼저 빨개진다.
5. **`payment-repository.ts`의 재고 복원 경로는 순서 규칙 밖이다**(plan.md §5 관찰 사항). 차감과 복원 사이의 교착 가능성은 남으며, `CONCURRENCY_RETRY`가 흡수한다.
6. **미결제 주문의 재고 해제는 이 SPEC 범위 밖**이고 백로그 카드 `t21`이 추적한다(plan.md §0 확정).

### sync 단계로 넘기는 상태

- 4개 산출물 모두 `status: in-progress`. `implemented → completed` 전이는 sync 커밋에서 manager-docs가 수행한다(소유권 매트릭스).
- 브랜치 `WT-inventory-concurrency`, 6커밋, **push 안 됨**, PR 없음. 통합은 리드가 수행한다.
- 워킹 트리 깨끗함. 공유 개발 DB는 실행 전 상태(products 5 / categories 2 / orders 0 / carts 0)로 복원되어 있다.

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-09-02
sync_commit_sha: 07c3887ff332c73e8ebcbcabc6f9629711d7cbbf   # sync 커밋. 자신의 SHA는 착륙 후에만 알 수 있어 후속 커밋에서 backfill (D3 예외)
sync_status: audit-ready

b12_self_test_a: "grep -c 'SPEC-ORDER-002' CHANGELOG.md → 0 (실행 시점) — 중복 없음 확인 후 이번 커밋으로 신규 추가"
b12_self_test_b: "grep -oE 'AC-ORDER-[0-9]+' acceptance.md | sort -u | wc -l → 13 — CHANGELOG 항목의 '인수 기준 13건' 서술과 일치"
b12_self_test_c: "CHANGELOG.md·README.md에 인용한 파일 경로(order-service.ts, order-repository.ts, concurrency.postgres.test.ts 등)는 모두 이 워크트리에 존재함을 ls로 확인 — 새 경로를 발명하지 않았다"

changelog_entry_position: "CHANGELOG.md [Unreleased] 섹션, SPEC-PAYMENT-001 '알려진 한계' 다음(파일 끝)에 '### 추가 — SPEC-ORDER-002' + '### 알려진 한계 — SPEC-ORDER-002' 2개 절 추가"

frontmatter_status_transitions:
  spec_md: "in-progress → completed"
  plan_md: "in-progress → completed"
  acceptance_md: "in-progress → completed"
  progress_md: "in-progress → completed"
  updated_field: "2026-09-02 (변경 없음 — 이미 오늘 날짜였음)"

sync_auditor_verdict: "PASS · 종합 95/100 (Functionality 95 · Security 95 · Craft 95 · Consistency 95, --deep 렌즈) — blocking 결함 0건"
security_review_verdict: "CRITICAL 0 · HIGH 0 (이 SPEC의 diff 기준). package.json/package-lock.json diff 0줄이므로 기존 npm-audit HIGH/CRITICAL(tar, @mapbox/node-pre-gyp, postcss 등)는 이 SPEC이 도입한 것이 아님을 확인"

docs_synced:
  changelog: "CHANGELOG.md — SPEC-ORDER-002 '추가' + '알려진 한계' 2개 절"
  readme: "README.md — '주문/체크아웃(SPEC-ORDER-001)' 알려진 한계 문단 정정 + 신규 '### 재고 차감 동시성 (SPEC-ORDER-002)' 하위 절"

mx_tag_scan: "orchestrator가 사전 확인 — findStockByProductIds/isTransactionConflict/shortLines/stockNotice 전부 fan_in=1(단일 생산 호출부), 신규 goroutine/async-without-catch 패턴 없음(모든 Prisma 호출이 기존 트랜잭션 래퍼 내부). @MX:ANCHOR 필요 없음. order-service.ts의 기존 createOrder() @MX:ANCHOR/@MX:REASON은 SPEC-ORDER-001 소유로 무변경"
```

### 알려진 잔여 항목 — sync-auditor F5 (블로커, orchestrator 재위임 필요)

sync-auditor(`--deep`)가 남긴 비차단 항목 5건(F1~F5) 중 F1~F4는 progress.md §E.2 Gaps/Residual-risk에 이미 자체 기록되어 있다. **F5는 이 세션이 직접 닫을 수 없다** — `acceptance.md §3 Definition-of-Done` 체크박스가 progress.md의 증거로 이미 뒷받침됨에도 미체크 상태로 남아 있으나, `acceptance.md` 본문(체크박스 포함)은 manager-docs의 편집 권한 밖(frontmatter `status:`/`updated:`만 허용)이라 이 세션이 직접 체크할 수 없다. orchestrator가 manager-spec에 재위임해 `acceptance.md §3`의 체크박스를 progress.md §E.3 증거와 대조해 갱신할지 판단해야 한다.
