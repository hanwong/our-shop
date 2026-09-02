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

**M3 ~ M5**: _<pending>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
