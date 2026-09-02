---
id: SPEC-ORDER-002
status: completed
updated: 2026-09-02
tier: M
---

# Acceptance Criteria: SPEC-ORDER-002 — 재고 차감 동시성 제어와 품절 처리

Tier M — AC 상한 20개 이내(현재 13개). 각 항목은 REQ-ORDER-022 ~ 033 중 하나에 대응하며, 통과/실패가 이분법으로 판정 가능하다. REQ 12건에 AC 13건인 이유는 REQ-ORDER-027(트랜잭션 중단 매핑)이 두 관점 — 오류 주입으로 관측 가능한 매핑(AC-ORDER-029)과 실제 교착 상황에서의 결과(AC-ORDER-034) — 으로 나뉘기 때문이다.

## §0. 검증 수단의 경계 (읽기 전에)

이 SPEC의 핵심 주장은 **행 잠금에 의한 직렬화**인데, 이 저장소에는 살아 있는 PostgreSQL이 없다(SPEC-ORDER-001 research.md §5, `.github/workflows/ci.yml:60`의 `DATABASE_URL`은 어떤 데이터베이스도 열리지 않는 자리표시자다). SPEC-ORDER-001·SPEC-PAYMENT-001과 같은 분류를 쓴다.

| 분류 | 의미 | 해당 항목 |
|---|---|---|
| **하네스 관측 가능** | vitest(node) + 인메모리 fake + 정적 소스 검사로 판정 | AC-ORDER-024 ~ 032, 034 |
| **실 DB 필요 — 자동 DoD 제외** | 살아 있는 PostgreSQL에서만 관측 가능 | `AC-026-EXCL-CONCURRENCY`, `AC-034-EXCL-DEADLOCK` |

### 이름 붙은 제외 항목

| 제외 ID | 소속 AC | 관측 불가능한 것 |
|---|---|---|
| `AC-026-EXCL-CONCURRENCY` | AC-ORDER-026 | 두 주문이 **정말로 동시에** 도착했을 때 조건부 갱신이 실제 행 잠금으로 직렬화되는 것 |
| `AC-034-EXCL-DEADLOCK` | AC-ORDER-034 | 교착 상태가 실제로 발생하고 PostgreSQL이 그것을 탐지해 40P01로 중단시키는 것. 인메모리 fake는 잠금을 모형화하지 않으므로 교착을 만들 수 없다 |

**이 두 제외 항목을 닫는 것이 AC-ORDER-035의 목적이며**, 그 AC 자체가 `Where` 능력 게이트다 — 데이터베이스에 도달 가능한 환경에서만 판정된다. plan.md §0에서 CI DB 배선 소유권이 **(B)로 확정**되어 CI 필수 검사 승격이 후속 CI SPEC으로 넘어갔으므로, 이 SPEC의 자동 Definition of Done은 두 제외 항목을 **열린 상태로 정직하게 남긴다** — 개발자 기계에서 하네스가 통과하더라도 CI에서는 여전히 열려 있다.

---

## §1. Given-When-Then 시나리오

### 재고 차감의 동시성

**AC-ORDER-024** — 재고 차감은 조건부 원자 갱신으로만 이루어진다 (REQ-ORDER-022)
- Given: 이 SPEC이 추가·수정한 전체 산출물
- When: `src/features/orders/` 전체를 정적 검사한다
- Then: 재고를 쓰는 경로가 `where`에 수량 조건(`stock: { gte: ... }`)을 포함한 단일 갱신 호출 하나뿐이고, 재고를 읽어 애플리케이션에서 비교한 뒤 그 비교 결과로 갱신하는 호출 쌍이 존재하지 않는다.
- 검증 수단: 정적 소스 검사(재고 쓰기 호출 전수 열거).

**AC-ORDER-025** — 여러 상품의 차감은 상품 id 오름차순으로 실행된다 (REQ-ORDER-023)
- Given: 상품 `p-9`·`p-2`·`p-5`를 이 순서로 담은 장바구니(즉 `createdAt` 순서가 id 순서와 다르다)
- When: 주문을 생성한다
- Then: 재고 차감 호출이 `p-2` → `p-5` → `p-9` 순서로 관측되고, 생성된 주문의 항목 표시 순서는 여전히 `p-9`·`p-2`·`p-5`(장바구니 저장 순서)다.
- 검증 수단: fake DB의 갱신 호출 순서 기록 + 생성된 주문 항목 배열 순서 단언.

**AC-ORDER-026** — 마지막 재고를 두 주문이 노리면 하나만 성공한다 (REQ-ORDER-024)
- Given: `stock === 1`인 상품, 그 상품을 수량 1로 담은 서로 다른 게스트의 장바구니 두 개
- When: 두 주문을 순차로 제출한다
- Then: 첫 주문은 성공하고 재고가 0이 되며, 두 번째 주문은 `INSUFFICIENT_STOCK`으로 거부되고 재고는 0에서 변하지 않으며 음수가 되지 않는다.
- 검증 수단: fake DB 스냅샷 비교.
- **실 DB 필요 — 자동 DoD 제외 · `AC-026-EXCL-CONCURRENCY`**: 진짜 동시 도착 시의 직렬화는 실 DB에서만 관측된다(§0). 순차 재현은 "조건이 성립하지 않으면 `count === 0`을 받아 롤백한다"까지만 판정한다.

**AC-ORDER-027** — 차감 실패 시 재고를 다시 읽어 부족한 모든 항목을 보고한다 (REQ-ORDER-025)
- Given: 장바구니에 세 항목(각 수량 2)이 있고, 트랜잭션이 열린 뒤 세 상품의 재고가 각각 `0`·`5`·`1`로 바뀐 상태
- When: 주문을 제출한다
- Then: 응답 `products`가 **2건**(재고 0인 항목과 재고 1인 항목)을 담고, 재고 5인 항목은 담기지 않으며, 각 항목의 `available`이 재조회된 값(`0`과 `1`)이다.
- 검증 수단: fake DB(트랜잭션 시작 후 재고를 변경하는 훅 포함) + 응답 본문 단언.

**AC-ORDER-028** — 보고된 구매 가능 수량은 요청 수량보다 항상 작다 (REQ-ORDER-026)
- Given: AC-ORDER-027과 동일한 상황, 그리고 트랜잭션 시작 시점 스냅샷에서는 세 항목 모두 재고가 충분했던 상태
- When: 주문을 제출한다
- Then: 응답 `products`의 모든 항목에서 `available < quantity`가 성립한다 — 즉 "재고 부족"이라고 말하면서 요청 수량 이상의 구매 가능 수량을 함께 보내는 응답이 존재하지 않는다.
- 검증 수단: 응답 본문 전수 단언.

**AC-ORDER-029** — 트랜잭션 중단은 재시도 가능한 실패로 식별된다 (REQ-ORDER-027)
- Given: 재고 차감 중 데이터베이스가 교착 상태 오류(Prisma `P2034` 계열)를 던지도록 구성된 fake
- When: 주문을 제출한다
- Then: 응답이 409이고 `code === "CONCURRENCY_RETRY"`이며, 주문이 생성되지 않고 재고와 장바구니가 모두 무변경이고, 분류되지 않은 500이 발생하지 않는다.
- 검증 수단: fake DB의 오류 주입 + 응답 단언 + 스냅샷 비교.

### 품절·재고 부족의 표면화

**AC-ORDER-030** — 주문 요약이 항목별 재고 상태를 표시한다 (REQ-ORDER-028)
- Given: 세 항목을 가진 장바구니 — (a) 수량 1 · 재고 10, (b) 수량 3 · 재고 2, (c) 수량 1 · 재고 0
- When: `<OrderSummary>`를 렌더한다
- Then: (a)에는 재고 관련 표시가 없고, (b)에는 재고 부족 표시와 현재 수량 `2`가, (c)에는 품절 표시가 나타난다.
- 검증 수단: jsdom + Testing Library.

**AC-ORDER-031** — 화면은 재고 표시를 근거로 제출을 막지 않는다 (REQ-ORDER-029)
- Given: 모든 항목이 품절인 장바구니로 렌더된 주문서 화면
- When: 필수 배송 정보를 채우고 제출 버튼의 상태를 확인한 뒤 제출한다
- Then: 제출 버튼이 비활성화되어 있지 않고, `POST /api/orders` 호출이 실제로 발생한다.
- 검증 수단: jsdom + Testing Library, fetch 스파이.

**AC-ORDER-032** — 거부 시 문제가 된 상품을 항목별로 보여준다 (REQ-ORDER-030)
- Given: 주문서 화면
- When: 제출이 `{ code: "INSUFFICIENT_STOCK", products: [{ name: "머그컵", available: 0 }, { name: "텀블러", available: 1 }] }`로 거부된다
- Then: 화면에 "머그컵"과 "텀블러"가 각각 나타나고 각자의 구매 가능 수량(`0`, `1`)이 함께 표시되며, 상품을 특정하지 않은 단일 문구만 남는 상태가 아니다.
- 검증 수단: jsdom + Testing Library.

**AC-ORDER-033** — 선행 SPEC의 산출물이 변경되지 않는다 (REQ-ORDER-031)
- Given: 이 SPEC이 만든 전체 변경
- When: `src/components/product/ProductDetailView.tsx`와 `src/features/payments/` 전체, `prisma/schema.prisma`에 대해 `git diff --numstat`을 실행한다
- Then: 세 경로 모두 변경 줄 수가 0이고, SPEC-ORDER-001·SPEC-PAYMENT-001·SPEC-STOREFRONT-001의 기존 테스트가 전부 통과한다.
- 검증 수단: git diff + 전체 테스트 실행.

### 검증의 정직성

**AC-ORDER-034** — 교착이 발생해도 미분류 500이 나오지 않는다 (REQ-ORDER-027 · REQ-ORDER-023의 실효 확인)
- Given: 상품 A·B를 반대 순서로 담은 두 게스트의 장바구니
- When: 두 주문을 병렬로 실행한다
- Then: 두 주문 모두 성공하거나, 하나가 `INSUFFICIENT_STOCK`/`CONCURRENCY_RETRY`로 식별 가능하게 거부되며, 어느 쪽도 분류되지 않은 500을 받지 않는다.
- 검증 수단: fake DB 기준으로는 차감 호출 순서가 두 주문에서 동일함을 단언하는 데까지.
- **실 DB 필요 — 자동 DoD 제외 · `AC-034-EXCL-DEADLOCK`**: 실제 교착 탐지(40P01)는 실 DB에서만 관측된다. 인메모리 fake는 행 잠금을 모형화하지 않으므로 교착 자체를 만들 수 없다(§0).

**AC-ORDER-035** — 실 PostgreSQL에서 동시 주문 중 정확히 하나만 성공한다 (REQ-ORDER-032)
- Given: `DATABASE_URL`이 가리키는 살아 있는 PostgreSQL에 마이그레이션이 적용되어 있고, `stock === 1`인 상품이 있다
- When: 그 상품을 수량 1로 담은 서로 다른 게스트의 주문 두 건을 **병렬로** 실행한다
- Then: 정확히 한 건만 성공하고, `Product.stock`이 정확히 `0`이며, 생성된 `Order`가 정확히 1건이고, 실패한 쪽은 `INSUFFICIENT_STOCK` 또는 `CONCURRENCY_RETRY`다.
- 검증 수단: 실 PostgreSQL을 향한 통합 테스트.
- **능력 게이트**: 데이터베이스에 도달할 수 없는 환경에서는 이 AC를 **건너뛴 사실을 기록하고** 판정하지 않는다. 건너뛴 실행은 통과로 계산하지 않는다.

**AC-ORDER-036** — 초록불을 직렬화의 증거로 제시하지 않는다 (REQ-ORDER-033)
- Given: 살아 있는 PostgreSQL 없이 실행한 전체 테스트가 통과한 상태
- When: `progress.md` §E와 이 SPEC의 완료 보고를 검토한다
- Then: 어느 문서에서도 그 통과가 행 잠금 직렬화의 증거로 서술되지 않고, `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`이 열린 항목으로 명시되어 있다.
- 검증 수단: 문서 정적 검사.

---

## §2. 엣지 케이스

| 상황 | 기대 동작 |
|---|---|
| 장바구니 항목이 1건뿐이다 | 정렬은 무의미하지만 동작은 동일하다. 차감 1회, 실패 시 재조회 1건 |
| 같은 상품이 장바구니에 두 줄로 있다 | `CartItem`의 `@@unique([cartId, productId])`가 이를 불가능하게 한다. 방어 코드를 추가하지 않는다 |
| 차감 실패 후 재조회 시점에 재고가 다시 늘어났다 | 재조회 값이 요청 수량 이상이면 그 항목은 `products`에 담기지 않는다. 그 결과 `products`가 빈 배열이 될 수 있으며, 이때도 주문은 거부된다(트랜잭션은 이미 되돌릴 수 없는 판정을 내렸다). 빈 배열은 "부족한 상품을 특정할 수 없음"으로 화면에 표시된다 |
| 응답의 `products`가 비어 있다 | AC-ORDER-032의 항목별 표시 대신 상품을 특정하지 않는 문구를 표시한다 — 특정한 척하지 않는다 |
| 재고가 0인 상품이 장바구니에 있는 채로 주문서에 진입한다 | 품절 표시가 나타나지만 제출은 가능하다(AC-ORDER-031). 서버가 거부한다 |
| `CONCURRENCY_RETRY`를 받은 주문자가 그대로 재제출한다 | 멱등키가 같으므로 SPEC-ORDER-001 REQ-ORDER-016의 경로를 탄다. 첫 트랜잭션은 롤백되어 주문이 없으므로 새 주문이 생성된다 |

---

## §3. Definition of Done

- [x] AC-ORDER-024 ~ 034, 036이 자동 하네스에서 통과한다(§0의 두 제외 항목은 열린 상태로 명시).
- [x] AC-ORDER-035는 데이터베이스 도달 가능 환경에서 통과하거나, 건너뛴 사실이 기록된다. **건너뜀은 통과가 아니다.**
- [x] `npm run typecheck` · `npm run lint` · `npm test` 종료 코드 0.
- [x] `prisma/schema.prisma`의 git diff가 0줄이다(이 SPEC은 스키마를 바꾸지 않는다).
- [x] plan.md §0의 결정 2건이 해소되었다(2026-09-02 사용자 확정 — CI DB 배선 (B), 미결제 주문 재고 해제는 범위 밖 유지 + 백로그 `t21`).
