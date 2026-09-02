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

**M5**: _<pending>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
