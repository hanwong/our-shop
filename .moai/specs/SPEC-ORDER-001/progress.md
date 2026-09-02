---
id: SPEC-ORDER-001
status: completed
updated: 2026-09-01
tier: L
---

# Progress: SPEC-ORDER-001

## §E.1 Plan-phase Audit-Ready Signal

- Tier: **L** (5 artifact set) — 근거: 신규 도메인 1개(모델 2 + enum 1 + 마이그레이션), 도메인/API/UI 3개 층에 걸친 산출물 15개 이상, 그리고 `product.md`의 최우선 제약(결제 데이터 정합성)을 직접 다루는 constitutional 성격.
- **범위: 게스트 체크아웃 전용**(v0.2.0). 회원 체크아웃은 SPEC-AUTH-001과의 구조적 충돌로 제외 — 사유 전문은 spec.md §3 첫 항목, 결정 기록은 plan.md §0 #5, 증거 조사는 research.md §6.
- 산출물: `spec.md`(REQ-ORDER-001~021, **21개**) / `plan.md`(M1~M7) / `acceptance.md`(**AC 20개** — `001~008`·`010~016`·`018~022`, REQ 21개 전부 매핑) / `design.md` / `research.md` / 이 파일.
  - AC 번호에 `009`·`017`이 없는 것은 누락이 아니라 흡수 매핑이다(acceptance.md §1.5). Tier L 상한(REQ 25 / AC 25) 이내.
- SPEC ID 사전 검사: `SPEC-ORDER-001` — 정규식 검사 **PASS**(기존 6개 SPEC ID와 충돌 없음).
- 결정 상태: plan.md §0의 5건 **전부 확정**(미해결 0건).
  - #1 결제 SPEC 경계 — **사용자 확인 완료(2026-08-31)**: 주문 먼저 생성(`pending_payment`), 주문 생성 시점 재고 차감, 결제 상태 전이는 후속 SPEC. plan-phase 권고안을 사용자가 승인.
  - #2 미결제 주문 재고 해제 정책 — **잠정 결정(재검토 가능)**: 이 SPEC에서는 미구현, 타임아웃 후 해제를 향후 방향으로 기록.
  - #3 배송비 — **잠정 결정(재검토 가능)**: `calculateShippingFee()` 단일 함수로 격리하고 0원 반환. 결정값처럼 굳는 위험은 plan.md §5에 유지.
  - #4 게스트 이메일 수집 — **잠정 결정(재검토 가능)**: 수집하지 않음(REQ-ORDER-008).
  - #5 회원 체크아웃 — **사용자 확인 완료(2026-08-31)**: 이 SPEC의 범위에서 **제외**. 게스트 체크아웃만 만든다.
  - #2~#4는 사용자 지시("잠정값으로 진행")에 따라 이 plan-phase의 확정값으로 채택되었다. run-phase는 이 값을 전제로 진행하며, 재검토가 필요해지면 후속 SPEC 또는 개정으로 처리한다. #1·#5는 잠정이 아니라 사용자가 확인한 확정 결정이다.
- 검증 하네스 한계 사전 고지: 실 PostgreSQL 부재로 트랜잭션 원자성·동시성·unique 제약 실동작은 자동 검증 대상에서 제외(acceptance.md §0). 제외 항목은 `AC-012-EXCL-ROLLBACK` / `AC-013-EXCL-CONCURRENCY` / `AC-016-EXCL-UNIQUE-RACE` 세 이름으로 고정되어 있으며, run-phase는 §E.2에 이 이름 그대로 미검증을 기록한다.

### 반영 — plan-audit iteration 1 지적사항 (2026-08-31)

`.moai/reports/plan-audit/SPEC-ORDER-001-review-1.md`(FAIL 0.81 / Tier L 임계 0.85)의 D1~D8 처리 결과.

| 지적 | 처리 | 반영 위치 |
|---|---|---|
| D1 신원이 서버 컴포넌트에서 도달 불가 | `next/headers` 기반 **얇은 전송 어댑터**를 orders 도메인 신규 코드로 도입. 판정 규칙은 재사용, 전송만 신규로 구분해 기술. `issuedGuestId`는 서버 컴포넌트에서 폐기(쿠키 설정 불가는 공식 문서로 확인) — `src/lib/auth/**` 불변 조건 **완화 0건** | design.md §6/§6.1/§6.2, plan.md §2·M2·M5·M6·§4, spec.md 계약표 |
| D2 트랜잭션 인지 카트 접근 부재 | 질의 복제를 기각하고 **카트 리포지토리 3개 함수에 선택적 tx 인자 추가**를 채택. PRESERVE 목록에 경계를 명시한 §4.1 예외로 기록 — "금지이자 필수" 모순 해소 | design.md §2.1, plan.md §4.1·M2, acceptance.md §4 |
| D3 AC 하위 라벨 미해석 | `(c)` 약칭을 폐기하고 `AC-012-EXCL-ROLLBACK`·`AC-013-EXCL-CONCURRENCY`·`AC-016-EXCL-UNIQUE-RACE`로 명명. 각 제외가 조건 짓는 Then 항목을 명시(013·016은 "없음(별도 주장)"). design.md의 research §3 라벨은 `R3(x)`로 네임스페이스 분리 | acceptance.md §0·AC-012/013/016·§4, design.md §2 |
| D4 AC 개수 불일치(20 vs 18) | 실제 개수 재확인 후 **19개**(AC-021 신설 포함)로 세 문서 정합 | acceptance.md 머리말·§1.5, 이 파일 |
| D5 fake 롤백 전제 미기재 | AC-011·012에 `전제 (fake 롤백)` 줄 추가 + §0에 원칙 기술 + DoD 기록 항목 추가 | acceptance.md §0·AC-011·AC-012·§4 |
| D6 인용 출처 오기 | `cart-service.ts:108` 주석 + `:113-114` 구현으로 재지정 | design.md §2 |
| D7 반환 타입 부정확 | `ResolvedCartIdentity` 실제 형태로 정정(D1과 같은 함수라 함께 처리) | spec.md 계약표 |
| D8 structure.md 이탈 미기재 | 도메인 디렉터리·라우트 그룹 두 이탈의 근거를 표로 기록 | plan.md §2 |

신설: **AC-ORDER-021** — D1이 도입한 어댑터가 판정을 자체 구현하지 않고 `resolveCartIdentity()`를 재사용하는지 정적으로 고정한다(새 설계 표면이 검증 없이 남지 않도록).

### 반영 — plan-audit iteration 2 지적사항 (2026-08-31, v0.2.0)

`.moai/reports/plan-audit/SPEC-ORDER-001-review-2.md` — **FAIL 0.74 / Tier L 임계 0.85, 점수 회귀(0.81 → 0.74)로 STOP 권고**. 감사의 판정은 "문서를 더 고쳐서 될 문제가 아니라 범위 결정이 필요하다"였다. 3회차를 그대로 돌리지 않고, 사용자 확인 아래 **범위를 축소**했다.

**iteration 1 → 2에서 해소된 것(감사가 독립 검증)**: D2(트랜잭션 카트 접근), D4(AC 개수), D5(fake 롤백 전제), D6(인용 출처), D7(반환 타입), D8(structure.md 이탈). 이번 판은 이것들을 **유지**한다 — 특히 D2의 선택적 tx 인자 설계와 D3의 이름 붙은 제외 3건은 그대로다.

| 지적 | 처리 | 반영 위치 |
|---|---|---|
| **D1** 서버 컴포넌트가 회원 신원을 볼 수 없음 (2회 연속 미해소, 구조적 충돌) | **감사가 제시한 (a) 범위 축소를 채택(사용자 확인).** 회원 체크아웃을 이 SPEC에서 제외하고 게스트 전용으로 좁혔다. 함께: `Order.userId` 삭제(경계를 스키마로 강제), 회원 제출 거부 REQ 신설, **`next/headers` 신원 어댑터 설계 전면 삭제**(회원 신원 해석용 장치였으므로 존재 이유 소멸), 서버 렌더는 `cookies()`로 게스트 쿠키만 읽는 형태로 단순화 | spec.md §3 첫 항목·§1·REQ 전면, plan.md §0 #5·§2·M1~M6·§4·§4.1·§5·§6, design.md §1.4·§6 전면·§7.1, acceptance.md AC-021/022, research.md §6 |
| **D1 파생** `issuedGuestId` 동치 주장이 회원에 대해 거짓 | 그 주장을 **삭제**했다. 서버 렌더 경로는 이제 쿠키가 없으면 조회할 id 자체가 없어 안내 화면으로 가며, 이는 추론이 아니라 항진명제다. 회원을 게스트로 오인해 "장바구니가 비었다"고 **단정하던 문제**는 문구 계약(design.md §7.1)으로 대체 — 서버가 관측한 사실만 말하고 회원 체크아웃 부재를 고지한다 | design.md §6.1·§7.1, acceptance.md AC-006 |
| **D1 파생** AC-ORDER-021(a)가 도달 불가 컨텍스트를 단언 | 회원 렌더 컨텍스트 케이스를 **삭제**하고 게스트/무쿠키 두 경우로 재작성. 감사가 건전하다고 판정한 (c) 정적 검사는 유지·강화(금지 토큰 확대 + 어댑터 파일 부재 확인) | acceptance.md AC-021 |
| **D9** `spec.md`의 `REQ-ORDER-009(c)` 오참조 | 재고 확정/차감의 실제 인수처인 `REQ-ORDER-011 / REQ-ORDER-013`으로 정정하고, 판정 근거는 `R3(c)` 네임스페이스로 명시 | spec.md §1 인수 표 |
| **D10** `PRODUCT_GONE`이 도달 불가능한 상태 | 감사의 (a) **삭제**를 채택. `CartItem.product`가 `onDelete: Cascade`이고 `Product`에 소프트 삭제 컬럼이 없음을 스키마에서 직접 확인했다. REQ-ORDER-015의 해당 절, 실패 코드, §2 2단계의 상품 분기, AC-015(ii)를 전부 제거. 실제로 도달 가능한 인접 상황(트랜잭션 중 상품 동시 삭제)은 잔여 위험으로 기록 | spec.md §3·REQ-ORDER-015, design.md §1.5·§2·§8·§9, acceptance.md AC-015·§2 |
| **D11** 금지 토큰 목록에 `readGuestCartId` 누락 | 목록을 확대해 반영(`readGuestCartId`·`getCookieValue`·`resolveCartIdentity`·`new Request(` + `"guest_cart_id"` 리터럴 금지) | acceptance.md AC-021 (c)(d) |
| **D12** `R3` 네임스페이스 미적용 1건 | design.md의 모든 research 참조를 `R3(x)`로 통일하고, 규칙 문구를 "예외 없이"로 강화 | design.md §2 라벨 주석·§9 |

**범위 축소가 만든 부수 변경 2건(기록)**:

1. **카트 리포지토리 완화가 3개 함수 → 2개로 좁아졌다.** `findCartByUserId`는 회원 경로 전용이었으므로 이 SPEC이 호출하지 않는다. 채택한 설계(선택적 tx 인자 추가)는 그대로이며, 불변 조건의 구멍만 작아졌다(design.md §2.1, plan.md §4.1).
2. **`src/features/orders/lib/server-identity.ts`가 산출물에서 사라졌다.** M2가 만들던 어댑터이며, 되살아나지 않도록 AC-ORDER-021 (e)가 파일 부재를 확인한다.

신설: **AC-ORDER-022 / REQ-ORDER-021** — 회원 자격 증명을 제시한 주문 제출을 409 `MEMBER_CHECKOUT_UNSUPPORTED`로 거부한다. 범위 경계를 문서가 아니라 코드로 강제하는 지점이며, 공개 엔드포인트이므로 실제로 도달 가능한 가드다.

## §E.2 Run-phase Evidence

cycle_type: **tdd** (RED-GREEN-REFACTOR). 마일스톤 M1~M7을 논리 단위별 커밋 7건으로 완료했다.
브랜치 `WT-order-checkout`, plan-phase 기준 커밋 `c19ab47`, run-phase 종료 시점 HEAD `698dfd4`.

| 마일스톤 | 커밋 | 산출물 |
|---|---|---|
| M1 데이터 모델 | `928ad88` | `prisma/schema.prisma`(OrderStatus/Order/OrderItem), `prisma/migrations/20260831120000_add_order_models/migration.sql`, `tests/unit/orders/schema.test.ts` |
| M2 타입·리포지토리 | `f60f5e2` | `features/orders/types/order.ts`, `features/orders/repositories/order-repository.ts`, `cart-repository.ts`(§4.1 예외) |
| M3 주문 생성 서비스 | `0271620` | `features/orders/services/order-service.ts` |
| M4 API 라우트 | `dfe23d0` | `src/app/api/orders/route.ts` |
| M5 주문서 화면 | `e5020dd` | `app/checkout/page.tsx`, `components/checkout/{OrderSummary,CheckoutForm,CheckoutUnavailable}.tsx` |
| M6 완료 화면 | `74838a7` | `app/checkout/complete/[orderId]/page.tsx` |
| M7 통합·경계 검증 | `698dfd4` | `tests/integration/orders/create-order.test.ts`, `tests/unit/orders/scope-boundaries.test.ts`, `tests/unit/components/checkout-form.test.tsx` |

### 실행한 검증 명령과 관측된 출력 (HEAD `698dfd4` 기준, 증거 로그 `.moai/state/verify/spec-order-001/`)

| 명령 | 종료 코드 | 관측 결과 |
|---|---|---|
| `npm run test` | 0 | `Test Files 50 passed (50)` / `Tests 631 passed (631)` |
| `npm run test:coverage` | 0 | `All files 98.37 stmts / 95.72 branch / 100 funcs / 98.37 lines` — 임계값(85/80/85/85) 상회 |
| `npm run lint` | 0 | 출력 없음 |
| `npm run typecheck` | 0 | 출력 없음 |
| `npm run prisma:validate` | 0 | `The schema at prisma/schema.prisma is valid 🚀` |
| `npm run build` | **1** | **선행 결함 — 아래 참조. 이 SPEC이 만든 것이 아니다** |

이 SPEC이 추가한 테스트 파일별 개수: `order-service` 39, `checkout-page` 21, `schema` 20,
`create-order`(통합) 18, `api/orders/route` 17, `scope-boundaries` 15, `order-repository` 13,
`checkout-complete-page` 11, `cart-repository-tx` 9, `checkout-form` 9 — 합계 **172건 신규**,
기존 459건은 전부 무변경 통과(459 → 631).

### `npm run build` 실패는 선행 결함이다 (근거를 남긴다)

acceptance.md §3의 품질 게이트 6개 중 `npm run build`만 exit 1이다. **이 SPEC의 산출물 때문이
아니라는 것을 추정이 아니라 실험으로 확인했다.**

- 실패 원인: `src/middleware.ts`(Edge 런타임)가 `@/lib/auth/jwt`의 `verifyAccessToken`을 import하고,
  `jwt.ts`가 `node:crypto`를 import한다. Edge 런타임은 `node:` 스킴을 처리하지 못한다.
  webpack import trace가 `node:crypto ← ./src/lib/auth/jwt.ts` 한 줄만 가리킨다.
- **귀속 실험**: `src/app/checkout/`과 `src/app/api/orders/`를 일시적으로 트리 밖으로 옮기고
  `npm run build`를 다시 실행했다 → **동일한 오류로 exit 1**
  (증거: `.moai/state/verify/spec-order-001/build-without-order-routes.log`). 이 SPEC이 만든 라우트가
  전부 없는 상태에서도 재현되므로 원인은 이 SPEC 밖에 있다.
- 두 파일 모두 이 SPEC의 PRESERVE 대상이며 diff 0줄이다
  (`git diff --numstat c19ab47 -- src/middleware.ts src/lib/auth/jwt.ts` → 빈 출력).
- **고치지 않았다.** plan.md §4가 `src/lib/auth/**`와 `src/middleware.ts`를 불변 조건으로 못 박았고,
  SPEC-AUTH-001의 표면을 이 SPEC이 손대는 것은 범위 위반이다. 후속 조치가 필요한 항목으로 남긴다.

### fake의 `$transaction` 롤백 구현 여부 (acceptance.md §0·§4가 요구한 기록)

**구현했다.** `tests/integration/orders/create-order.test.ts`의 `$transaction`은 호출 전
`structuredClone`으로 스토어 전체를 스냅샷하고, 콜백이 throw하면 스냅샷으로 되돌린다.
그리고 그 성질 자체를 테스트로 고정했다 — `"restores every write when the transaction callback
throws"`가 롤백이 실제로 일어나는지 직접 단언한다. 따라서 **AC-ORDER-011·012를 PASS로 계상한다**
(§0의 전제 조건 충족).

다른 세션이 커밋한 주문은 롤백 대상에서 제외되도록 별도 목록으로 모델링했다. 롤백은 자기
트랜잭션의 쓰기만 되돌리기 때문이며, 이 구분이 없으면 design.md §5의 2차 방어(경합에서 진 요청이
롤백한 뒤 승자의 주문을 **찾아내는** 경로)를 애초에 재현할 수 없다.

### 이름 붙은 제외 3건 — 관측하지 않았다 (PASS로 계상하지 않음)

acceptance.md §4가 요구한 대로 세 이름을 그대로 적어 미검증으로 남긴다.

| 제외 ID | 관측하지 않은 것 | 왜 |
|---|---|---|
| `AC-012-EXCL-ROLLBACK` | PostgreSQL이 실제로 트랜잭션을 되돌리는지 | 살아 있는 PostgreSQL이 없다. fake가 되돌리는 것은 fake가 저장한 것이지 데이터베이스가 되돌린 것이 아니다. 여기서 관측한 것은 "서비스가 트랜잭션 콜백 안에서만 쓰고, 실패 시 throw로 콜백을 중단시킨다"까지다 |
| `AC-013-EXCL-CONCURRENCY` | 동시 주문 두 건이 행 잠금으로 직렬화되어 한 건만 성공하는 것 | 위와 같다. 관측한 것은 재고 차감이 `updateMany` + `stock: { gte: quantity }` 형태로 작성되었고 `count !== 1`이면 실패 경로로 간다는 것까지다 |
| `AC-016-EXCL-UNIQUE-RACE` | 동시 도착 두 요청이 `@unique` 위반으로 직렬화되는 2차 방어 | 위와 같다. 순차 재제출(1차 방어)과, unique 위반을 주입했을 때 최초 주문을 재조회해 반환하는 경로까지는 관측했다 |

**초록불을 원자성·동시성의 증거로 제시하지 않는다.**

### AC별 PASS/FAIL 매트릭스 (20건)

| AC | 판정 | 검증 위치 |
|---|---|---|
| AC-ORDER-001 | PASS | `schema.test.ts`(guestId NOT NULL, userId/user/@@index([userId]) 부재, User diff 0), `scope-boundaries.test.ts` |
| AC-ORDER-002 | PASS | `create-order.test.ts` — 주문 후 상품 가격·이름 변경 뒤 재조회 시 스냅샷 불변 |
| AC-ORDER-003 | PASS | `order-service.test.ts`(주문번호 형식·비순차), `create-order.test.ts`(status=pending_payment, 금액 확정) |
| AC-ORDER-004 | PASS | `order-service.test.ts`(수량 0·-3), `create-order.test.ts`(수량 0 주입 → 500, OrderItem 0건) |
| AC-ORDER-005 | PASS | `checkout-page.test.tsx` — 서버 출력에 상품명·수량·단가·합계 존재 + 최초 렌더 경로 `fetch`/`useEffect` 0건 |
| AC-ORDER-006 | PASS | `checkout-page.test.tsx` 6건 — 양식 미렌더, 단정 문구 부재, 회원 고지 존재, 쿠키 발급 시도 0건 |
| AC-ORDER-007 | PASS | `checkout-page.test.tsx`(리다이렉트·404 없음, middleware matcher에 `/checkout` 부재), `route.test.ts`(401·403 아님) |
| AC-ORDER-008 | PASS | `checkout-page.test.tsx` — 입력 5개 정확히, 결제수단·이메일 토큰 0건 |
| AC-ORDER-010 | PASS | `order-service.test.ts` 8케이스 + `route.test.ts` — 400 + `fieldErrors`, 트랜잭션 미개시 |
| AC-ORDER-011 | PASS | `create-order.test.ts` 5건 (fake 롤백 구현 확인 완료 — 위 전제 충족) |
| AC-ORDER-012 | PASS(부분) | `create-order.test.ts` 2건 + `scope-boundaries.test.ts` 정적 검사(`prisma.` 사용처가 `$transaction` 단 하나). **`AC-012-EXCL-ROLLBACK`은 미검증으로 별도 기록** |
| AC-ORDER-013 | PASS | `create-order.test.ts` 2건(경계 `stock === quantity` 포함), `route.test.ts`, `order-service.test.ts` |
| AC-ORDER-014 | PASS | `create-order.test.ts`, `route.test.ts`, `order-service.test.ts` — 409 `PRICE_CHANGED` + 재계산 금액 |
| AC-ORDER-015 | PASS | `create-order.test.ts` 2건(쿠키 있음/없음, 후자는 Set-Cookie 부착 확인), `route.test.ts` |
| AC-ORDER-016 | PASS | `create-order.test.ts` 2건(순차 재제출, unique 경합), `order-service.test.ts` 3건, `route.test.ts` |
| AC-ORDER-018 | PASS | `checkout-complete-page.test.tsx` 6건 — 주문번호·주문시점 단가·총액·배송지·결제 미완료 고지(양방향 단언) |
| AC-ORDER-019 | PASS | `scope-boundaries.test.ts` 4건 — package.json/.env.example diff 0, PG 엔드포인트 0건, `paid` 전이 코드 0건 |
| AC-ORDER-020 | PASS | `checkout-complete-page.test.tsx` 5건 — 다른 쿠키·무쿠키 모두 `notFound()`, 내용 미노출, 헤더 판독 코드 0건 |
| AC-ORDER-021 | PASS | `checkout-page.test.tsx` 3건 — 금지 토큰 6종 0건, `"guest_cart_id"` 리터럴 0건 + `GUEST_CART_COOKIE_NAME` import 존재, `server-identity.ts` 부재 |
| AC-ORDER-022 | PASS | `route.test.ts` 5건(실제 서명 토큰 사용) + `create-order.test.ts` 1건 — 409 `MEMBER_CHECKOUT_UNSUPPORTED`, `$transaction` 미호출, 주문·재고·카트 무변경 |

### plan.md §4 불변 조건 / §4.1 예외 경계 (git diff로 확인)

- `src/lib/auth/**` diff **0줄** — import·호출만 했다.
- `src/middleware.ts` diff **0줄**.
- `src/features/catalog/**`, `src/app/api/products/**` diff **0줄**.
- `src/features/cart/**` 변경 파일 **1개**(`repositories/cart-repository.ts`)뿐이며, 변경은
  `findCartByGuestId`·`deleteCart` 두 함수의 **선택적** 인자 추가로 한정된다. `findCartByUserId`는
  무변경(회원 경로가 범위 밖이므로 열지 않았다).
- 기존 호출부(`cart/services`, `cart/types`, `app/api/cart`, `app/api/auth`) diff **0줄** —
  인자가 선택적이라는 사실의 기계적 증거다.
- `prisma/schema.prisma`의 `User` 모델 diff **0줄**, `Product`는 역참조 1필드만 추가.
- 위 항목 전부 `scope-boundaries.test.ts`가 `git diff --numstat`으로 매 실행마다 재확인한다.

### plan.md §0 확정 결정 5건과의 일치

#1 주문 선생성(`pending_payment` + 주문 생성 시점 재고 차감) 구현됨 · #2 재고 해제 정책 미구현
(코드 없음) · #3 배송비 `calculateShippingFee()` 단일 함수, 0원 반환 · #4 이메일 미수집(타입·스키마·
양식 어디에도 없음) · #5 회원 체크아웃 제외(스키마·서비스 시그니처·라우트 3중 방어).
#2~#4의 **잠정 결정(재검토 가능)** 표기는 plan.md에 그대로 유지되어 있다.

### 설계 문서에 없어 run-phase가 판단한 것 1건 (기록)

REQ-ORDER-004(수량 1 미만 거부)에 대응하는 실패 코드가 design.md §8 표에 없다. 새 코드를 발명하는
대신 같은 표의 마지막 행(**"그 외 예기치 못한 오류 → 500, 코드 없음"**)을 적용했다. 근거: 요청 자체는
정상이고 서버 상태가 이상한 경우이므로 사용자가 고칠 수 있는 것이 없고, 사용자에게 알릴 이름이
필요하지 않다. 표를 벗어나지 않으면서 AC-ORDER-004(거부 + 아무 것도 영속화하지 않음)를 만족한다.

## §E.3 Run-phase Audit-Ready Signal

- run_status: **audit-ready**
- run_complete_at: 2026-08-31
- branch: `WT-order-checkout` / HEAD: `698dfd4` / base: `c19ab47`
- 커밋 7건(M1~M7), 마일스톤별 1커밋 — 무관한 마일스톤을 한 커밋에 묶지 않았다.
- 자동 검증 가능한 AC **20건 전부 PASS**. 이름 붙은 제외 3건은 위 표에 **미검증으로 명시 기록**했고
  PASS로 계상하지 않았다.
- 품질 게이트 6개 중 5개 exit 0. `npm run build`만 exit 1이며, **선행 결함임을 귀속 실험으로 확인**해
  §E.2에 근거와 함께 기록했다(이 SPEC의 PRESERVE 파일 2개가 원인, diff 0줄).
- sync-phase가 받아 갈 잔여 항목:
  1. `npm run build` 선행 실패(Edge 런타임 ↔ `node:crypto`) — SPEC-AUTH-001 표면의 문제이므로 별도
     SPEC 또는 이슈로 처리해야 한다. 이 SPEC이 도입하지 않았고 이 SPEC이 고칠 수도 없다.
  2. 미결제 주문의 재고 점유 해제 정책 부재(plan.md §0 #2의 잠정 결정) — 설계상 필연이며 숨기지 않는다.
  3. `/checkout`으로 가는 화면 링크 부재 — 장바구니 UI SPEC의 몫(plan.md §0 관련 메모).

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_status: audit-ready
sync_complete_at: 2026-09-01
sync_commit_sha: pending-backfill-single-sync-commit
branch: WT-order-checkout
base_head_at_sync_entry: 0dd5454
changelog_entry_position: "CHANGELOG.md [Unreleased] — 마지막 항목(SPEC-STOREFRONT-001 '알려진 한계' 블록 뒤에 추가)"
b12_self_test_a: "PASS — grep -c 'SPEC-ORDER-001' CHANGELOG.md → 0 (중복 없음, 방출 진행)"
b12_self_test_b: "PASS — acceptance.md의 고유 AC-ORDER-* 20개 == CHANGELOG가 명시한 20개"
b12_self_test_c: "PASS — CHANGELOG/README가 주장하는 경로 12개 전부 ls로 확인"
frontmatter_status_transitions:
  spec.md: "in-progress → completed"
  plan.md: "in-progress → completed"
  acceptance.md: "in-progress → completed"
  progress.md: "in-progress → completed"
  updated_field: "2026-08-31 → 2026-09-01 (4개 전부)"
canary_compliance_check: "N/A — 이 SPEC은 향후 정책(forward-looking policy)을 정의하지 않는다"
```

### sync-phase가 직접 실행한 검증 (재실행이며, run-phase 결과의 인용이 아니다)

run-phase의 §E.2 표를 옮겨 적지 않았다. **이 트리에서, 이번에 다시 돌린 것**이다.

| 명령 | 종료 코드 | 관측한 출력 |
|---|---|---|
| `npm run lint` | 0 | 출력 없음 |
| `npm run typecheck` | 0 | 출력 없음 |
| `npm run test` | 0 | `Test Files 50 passed (50)` / `Tests 631 passed (631)` |
| `npm run test:coverage` | 0 | `All files 98.37 / 95.72 / 100 / 98.37` — 임계값(85/80/85/85) 상회 |
| `npx prisma validate` | 0 | `The schema at prisma/schema.prisma is valid 🚀` |
| `npm run build` | **1** | `Failed to compile.` + `UnhandledSchemeError: Reading from "node:crypto"` + import trace `./src/lib/auth/jwt.ts` |

`npm run build`의 실패는 **선행 결함이며 고치지 않았다.** 실패 지문이 `./src/lib/auth/jwt.ts` 한 줄만 가리키는 것을 이번 실행에서 직접 관측했고, run-phase가 §E.2에 남긴 귀속 실험(주문 라우트를 트리 밖으로 옮겨도 동일 실패)과 일치한다. 두 원인 파일이 이 SPEC의 불변 조건 대상임도 재확인했다 — `git diff --numstat c19ab47 HEAD -- src/middleware.ts src/lib/auth/jwt.ts src/features/catalog src/app/api/products` → **빈 출력**. SPEC-AUTH-001 표면의 문제이므로 백로그 카드 `t16`으로 남긴다.

### 문서 동기화 산출물

- `CHANGELOG.md` — `[Unreleased]`에 `### 추가 — SPEC-ORDER-001` + `### 알려진 한계 — SPEC-ORDER-001` 두 블록 추가. 기존 6개 SPEC이 쓰는 한국어 제목 형식(`### 추가 — SPEC-XXX: 제목` / `### 알려진 한계 — SPEC-XXX`)을 그대로 따랐다. 기존 항목은 한 줄도 고치지 않았다.
- `README.md` — (1) 최상단 구현 목록에 SPEC-ORDER-001 한 줄, (2) `## 주문/체크아웃 (SPEC-ORDER-001)` 절 신설(SPEC-CART-001·SPEC-STOREFRONT-001 절과 같은 구성: 엔드포인트 표 → 핵심 성질 → 알려진 한계), (3) 하단 문서 목록에 SPEC 디렉터리 추가. `documentation: ko` 설정에 따라 한국어로 작성했다(기존 절들과 동일).
- **docs 사이트는 존재하지 않는다.** `ls -d docs .moai/docs` → `docs: No such file or directory`, `.moai/docs`는 하네스 내부 문서(`agent-lint.md`, `generic-patterns-guide.md`)로 제품 문서 사이트가 아니다. 따라서 동기화할 docs-site 페이지가 없다 — 건너뛴 것이 아니라 대상이 없다.

### 정직하게 남기는 미검증 항목

- **`sync_commit_sha`는 자리표시자다.** 커밋은 자기 해시를 알 수 없다. 단일 sync 커밋 지시에 따라 별도 backfill 커밋을 만들지 않았으므로, 실제 SHA는 이 커밋을 만든 세션의 보고서에 기록되며 이 필드는 자리표시자로 남는다.
- **문서의 서술적 정확성은 사람이 읽어야 확인된다.** 기계적으로 확인한 것은 경로 존재·AC 개수·중복 부재까지다. CHANGELOG/README 산문이 구현을 정확히 묘사하는지는 구현 파일을 직접 읽고 쓴 것이지 도구가 판정한 것이 아니다.
- **run-phase가 남긴 잔여 항목 3건은 이 sync-phase가 해소하지 않았다** — `npm run build` 선행 실패(범위 밖, `t16`), 미결제 주문 재고 해제 정책 부재(설계상 필연), `/checkout` 진입 링크 부재(장바구니 UI SPEC의 몫). 세 건 모두 CHANGELOG와 README의 "알려진 한계"에 그대로 기록해 문서에서 사라지지 않게 했다.
- **이름 붙은 제외 3건은 여전히 미검증이다**(`AC-012-EXCL-ROLLBACK` · `AC-013-EXCL-CONCURRENCY` · `AC-016-EXCL-UNIQUE-RACE`). sync-phase는 PostgreSQL을 확보하지 않았으므로 이 상태를 바꾸지 못했고, PASS로 승격하지도 않았다.
