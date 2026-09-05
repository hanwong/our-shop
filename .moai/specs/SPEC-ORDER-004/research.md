# research.md — SPEC-ORDER-004

착수 전 정찰 기록. 모든 인용은 이 세션에서 실제 파일을 열어 대조한 것이며, 위임 브리프에서 받은 내용을 그대로 옮긴 것은 하나도 없다. 브리프와 어긋난 세 건은 §5에 따로 모았다.

---

## §1. 마이그레이션 메커니즘

### §1.1 실행 중인 데이터베이스가 없다

`prisma migrate dev`는 Postgres 인스턴스와 shadow database를 요구한다. 둘 다 없다.

CI 워크플로가 그 사실을 직접 기록하고 있다.

```yaml
# .github/workflows/ci.yml:46-59
#
# It is load-bearing rather than defensive: `prisma validate` fails with
# P1012 "Environment variable not found: DATABASE_URL" when the variable
# is absent ... A clean CI checkout has no .env (it is gitignored), so
# without this the prisma:validate step could not pass.
#
# Nothing in CI opens a database connection: the test suite mocks the
# Prisma seam (@/lib/db) ...
DATABASE_URL: "postgresql://ci:ci@127.0.0.1:5432/our_shop_ci?schema=public"
```

`DATABASE_URL`은 루프백을 가리키는 자리표시자이고, 그 이름의 데이터베이스는 러너에서 도달 불가능하다.

### §1.2 따라서 마이그레이션은 손으로 쓴다 — 기존 10건 전부 그렇다

```
prisma/migrations/
  20260826065250_init
  20260828015400_add_catalog_models
  20260828120000_add_product_name_trgm_index
  20260829140000_add_cart_cart_item
  20260831120000_add_order_models
  20260902000000_add_payment_audit_log
  20260902142631_add_coupon_discount
  20260903110422_admin_action_event_source
  20260904060000_add_product_is_active
  20260904145033_add_review_model
```

디렉터리 규칙: `<YYYYMMDDHHMMSS>_<snake_case 설명>`. 파일명은 `migration.sql`.

가장 최근 것(`add_review_model`)의 형태가 이 SPEC이 따라야 할 본보기다 — `-- CreateTable` / `-- CreateIndex` / `-- AddForeignKey` 주석 헤더를 Prisma가 생성하는 것과 같은 형태로 붙인다.

### §1.3 CI가 실제로 거는 관문

`package.json:17-18`:

```json
"prisma:generate": "prisma generate",
"prisma:validate": "prisma validate"
```

`prisma validate`는 **`schema.prisma`만** 본다 — 문법과 관계 정합성을 검사한다. `migration.sql`은 읽지 않는다.

**결론: 마이그레이션 SQL과 스키마의 일치를 검사하는 기계가 없다.** 손으로 대조하는 수밖에 없고, 어긋나면 실제 배포 시점까지 드러나지 않는다. 이것이 이 SPEC의 가장 조용한 위험이다.

### §1.4 이 특정 변경은 원래 저자가 미리 허가했다

`prisma/migrations/20260831120000_add_order_models/migration.sql:14-20`:

```sql
-- NOTE ON THE OWNERSHIP COLUMN: "guestId" is NOT NULL and there is deliberately
-- ...
-- migration that adds "userId" and relaxes this NOT NULL; that relaxation is a
-- plain DROP NOT NULL on a fully-populated column, so it is not destructive.
```

`DROP NOT NULL`의 비파괴성 판단은 이 SPEC이 새로 내리는 것이 아니다.

---

## §2. 다시 써야 할 기존 테스트 — 3개 파일 7건

브리프는 2개 파일 6건이라고 했다. 세 번째 파일이 있다(§5 정정 2).

### §2.1 `tests/unit/api/orders/route.test.ts` — 5건

공용 헬퍼가 Bearer 토큰으로 회원을 흉내 낸다.

```ts
// :102-108
async function submitAsMember() {
  const token = await signAccessToken({ sub: "user-1", role: "customer" });
  return submit(validBody(), {
    authorization: `Bearer ${token}`,
    cookie: `guest_cart_id=${GUEST}`,
  });
}
```

| # | 위치 | 현재 단언 | 대체 단언 |
|---|---|---|---|
| 1 | `:110` "answers 409 MEMBER_CHECKOUT_UNSUPPORTED, not 401 or 403" | `status === 409`, body에 `code: "MEMBER_CHECKOUT_UNSUPPORTED"` | 세션 쿠키로 제출 시 `status === 201`, 응답 본문이 생성된 주문 |
| 2 | `:122` "refuses BEFORE opening a transaction" | `prisma.$transaction` 미호출 | 회원 제출은 **트랜잭션을 연다** — `$transaction` 호출 1회 |
| 3 | `:128` "creates no order, moves no stock, empties no cart" | `createOrderWithItems`·`decrementStockIfAvailable`·`deleteCart` 전부 미호출 | 셋 다 호출되며 `createOrderWithItems`가 `owner.kind === "user"`를 받는다 |
| 4 | `:136` "does not quietly demote the member to their guest cookie" | `findCartByGuestId` 미호출 | **유지되는 의도** — 이제 `findCartByUserId`가 호출되고 `findCartByGuestId`는 여전히 미호출. 단언 대상만 바뀐다 |
| 5 | `:145` "is reachable in practice, which is why the guard is code and not prose" | `status === 409` | Bearer 헤더만 있고 세션 쿠키가 없는 요청은 **회원으로 인식되지 않는다** — 게스트 경로로 처리(REQ-ORDER-055) |

4번은 특히 보존 가치가 크다. 원래 주석이 이유를 적어 두었다.

> Demoting would create an order the member can never open again: the guest cookie is expired at login, so nothing would present it back (research.md §6). Refusing is the honest answer.

이 SPEC 이후 정답은 "거부"가 아니라 "회원 카트로 처리"지만, **"게스트로 조용히 강등하지 않는다"는 속성 자체는 그대로 유효하다.** 단언을 지우는 것이 아니라 목표를 옮긴다.

5번도 성격이 바뀌면서 살아남는다: 원래는 "가드가 산문이 아니라 코드여야 하는 이유"를 지켰고, 이후에는 "Bearer 헤더는 이 라우트에서 회원 신원의 근거가 아니다"라는 새 경계를 지킨다.

### §2.2 `tests/integration/orders/create-order.test.ts` — 1건

```ts
// :852-870
describe("SPEC-ORDER-001 — a member submission is refused end to end (AC-ORDER-022)", () => {
  it("returns 409 and leaves orders, stock and carts untouched", async () => {
    await addToCart("A", 3);
    const token = await signAccessToken({ sub: "user-1", role: "customer" });

    const response = await submitOrder(orderBody(30000), {
      authorization: `Bearer ${token}`,
      cookie: `guest_cart_id=${GUEST}`,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "MEMBER_CHECKOUT_UNSUPPORTED",
    });
    expect(store.orders).toHaveLength(0);
    expect(store.products.find((p) => p.id === "A")!.stock).toBe(10);
    await expect(readCart()).resolves.toMatchObject({ itemCount: 3 });
  });
});
```

**대체**: 회원 세션 쿠키로 제출 → `201`, `store.orders`에 한 건, 그 행의 `userId` 있음 / `guestId` 없음, 재고 차감됨, 회원 카트 비워짐. 이 테스트는 fake store를 쓰므로 **XOR 불변식을 저장된 행에서 직접 관측할 수 있는 유일한 자리**다.

### §2.3 `tests/unit/orders/scope-boundaries.test.ts` — 1건 (브리프 미포함)

```ts
// :237-242
it("added no member attribution to the User model (AC-ORDER-001 (c))", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const user = schema.match(/model\s+User\s*\{([\s\S]*?)\n\}/)![1]!;

  expect(user).not.toMatch(/orders?\s+Order/i);
});
```

**확실히 깨진다.** Prisma는 관계의 반대편 선언을 요구하므로 `Order.user`를 추가하면 `User.orders Order[]`가 필수다. 같은 파일이 `Cart` 때 같은 제약을 기록해 두었다.

```prisma
// schema.prisma:39-44
// SPEC-CART-001 M1 — back-relation only. Prisma requires the opposite side
// of Cart.user to be declared here; no existing field above changes.
```

**대체**: 단언을 뒤집는다 — `User` 모델이 `orders Order[]`를 **보유하고**, `Order` 모델이 `userId String?`와 `@@index([userId])`를 보유하며, `userId`에 `@unique`가 **없음**을 확인한다(design.md §1.2의 기수 함정을 기계적으로 막는다).

### §2.4 같은 파일의 나머지 단언은 왜 안 깨지는가

이 파일의 diff 단언들은 **고정된 두 커밋을 대조한다.**

```ts
// :47-48
const PLAN_PHASE_HEAD = "19bd29fb9a965b0bb98fe9f1c47bdecb2ab7ce7e";
const SPEC_MERGE_HEAD = "733e320";
```

주석이 그 이유를 적어 두었다(`:17-27`).

> The diff assertions run over a FIXED historical range ... Both endpoints are pinned, so these assertions state what SPEC-ORDER-001 itself changed — a historical fact that stays true no matter what later work touches the same paths.
>
> The second endpoint is load-bearing. Omitting it diffs the pinned commit against the live working tree, which silently re-asserts the PRESERVE list against every future change and fails on edits this SPEC never made (t16: an unrelated Edge-runtime fix to src/lib/auth/jwt.ts tripped the auth assertion).

따라서 `src/lib/auth`·`src/middleware.ts`·`src/features/cart`를 이 SPEC이 수정해도 저 단언들은 반응하지 않는다 — **역사적 사실을 말하고 있기 때문이다.**

작업 트리를 읽는 단언은 정확히 셋이다.

| 위치 | 읽는 대상 | 이 SPEC의 영향 |
|---|---|---|
| `:104` (모듈 레벨) + `:113`/`:122`/`:123`/`:127`/`:128`/`:134` | `src/features/orders/services/order-service.ts` 소스 텍스트 | **주의 필요** — 여섯 단언이 호출 형태와 롤백 형태를 검사한다(§2.5) |
| `:238` | `prisma/schema.prisma` | **깨진다** — 재작성 대상 |
| `:245` | `existsSync("src/features/orders/lib/server-identity.ts")` | 영향 없음 — 이 SPEC은 그 파일을 만들지 않는다(`resolveSession()`은 `src/lib/auth`에 이미 있다) |

`:171`·`:198`의 `git grep`은 결제 패턴 스캔이므로 무관하다.

### §2.5 `order-service.ts` 정규식 제약 — 구현을 좁히는 조건

`grep -n "orderService" tests/unit/orders/scope-boundaries.test.ts`로 전수 확인했다(2026-09-05). 모듈 레벨 `readFileSync`(`:104`)를 제외하면 **단언은 여섯이다.**

| 위치 | 단언 |
|---|---|
| `:113` | `prismaUses`가 `["$transaction"]`과 정확히 일치 — `prisma`의 다른 멤버 사용 금지 |
| `:122` | `/findCartByGuestId\(\s*guestId,\s*tx\s*\)/` |
| `:123` | `/deleteCart\(\s*cart\.id,\s*tx\s*\)/` |
| `:127` | `/decrementStockIfAvailable\(\s*tx,/` |
| `:128` | `/createOrderWithItems\(\s*tx,/` |
| `:134` | `/throw new OrderAbort/` — 콜백이 값을 반환해 커밋되는 대신 던져서 롤백함을 보장 |

**정정 기록**: 초판은 이것을 "다섯 단언"이라고 셌다 — `:134`의 `throw new OrderAbort`를 누락한 오류다. 그 단언이 지키는 속성이 가장 무겁다: Prisma는 던진 오류에는 롤백하고 **반환된 값에는 커밋한다**, 그러므로 콜백 안에서 거부를 `return`하면 부분 주문이 저장된다. 소유자 dispatch를 추가하면서 회원 분기의 거부를 `return`으로 쓰면 이 단언이 정확히 그 실수를 잡는다.

여섯 단언 전부 **"모든 주문 쓰기가 트랜잭션 안에서 일어나고, 실패는 롤백된다"는 실제 안전 속성**을 지킨다(AC-ORDER-012). 소유자 dispatch를 헬퍼로 감싸면 정규식이 깨지는데, 그때 올바른 대응은 정규식을 완화하는 것이 아니라 **호출 형태를 그대로 두는 것**이다. 게스트 분기는 `findCartByGuestId(guestId, tx)` 문자열을 유지하고, 회원 분기를 명시적 `if`로 나란히 두며, 두 분기 모두 거부를 `throw new OrderAbort`로 낸다.

이 여섯 단언은 재작성 7건에 포함되지 않는다 — **바뀌지 않아야 하는 것**이고, 통과 유지 자체가 검증 항목이다.

---

## §3. 테스트 기준선 (회귀 방지용)

변경 전 전체 스위트를 실행해 캡처했다.

```
$ npx vitest run --reporter=dot

 Test Files  116 passed (116)
      Tests  1526 passed (1526)
   Duration  21.76s
```

- 측정 시점 커밋: `6c8b00b` (브랜치 `WT-member-checkout`, `origin/main` 기반)
- 측정 일자: 2026-09-05
- 실패·건너뜀 없음

이 수치가 AC-ORDER-072(전체 스위트 기준선 대조)의 기준이며, 게스트 경로 무회귀는 AC-ORDER-071이 별도로 다룬다. 재작성 7건은 **파일 수를 늘리지 않고 테스트 수를 유지하거나 늘린다**(단언을 지우는 것이 아니라 옮기므로). 최종 수치가 1526보다 **작으면** 어딘가에서 커버리지를 잃은 것이고, 그 자체가 실패 신호다.

---

## §4. `resolveSession()` 소비 현황

`grep -rn "resolveSession(" src`를 직접 실행해 확인했다(2026-09-05). **호출자는 셋이다.**

| 호출자 | 레벨 | 용도 |
|---|---|---|
| `src/app/(shop)/products/[productId]/page.tsx:49` | 페이지 | 리뷰 작성 폼 vs 로그인 유도 링크 게이트(SPEC-REVIEW-001) |
| `src/app/api/reviews/route.ts:29` | API 라우트 | 리뷰 작성 요청의 인증 게이트 — `null`이면 401(REQ-REVIEW-003) |
| `src/components/layout/SiteHeader.tsx:30` | 레이아웃 컴포넌트 | 헤더의 로그인 상태 표시(SPEC-AUTH-003) |

**정정 기록**: 이 표의 초판은 `SPEC-AUTH-003/spec.md` §1.3을 옮겨 적은 것이었고 호출자를 "정확히 둘"이라고 썼다. 그것은 틀렸다 — 그 표는 SPEC-AUTH-003이 **자기 자신의 소비자(`SiteHeader`)를 만들기 전에** 작성된 것이므로 두 행뿐이었고, 그 SPEC이 완료되면서 세 번째가 생겼다. `SiteHeader.tsx:12`는 자기 주석에서 스스로를 소비자로 지목하고 있다. 첫 행의 경로도 `src/app/products/...`로 잘못 적혀 있었다(실제는 라우트 그룹 `(shop)` 아래). **선행 SPEC의 표를 재검증 없이 인용한 것이 원인이며, 위 표는 직접 실행한 grep 출력에서 다시 만들었다.**

셋 다 **읽기 게이트**다(표시 게이트 둘, 인증 게이트 하나). 이 SPEC이 추가하는 것은 네 번째 호출자이자 **새로운 종류** — 쓰기 트랜잭션의 소유자 결정이며, AUTH/REVIEW 도메인 밖 첫 사용이다.

부수 관찰(이 SPEC의 범위 밖): `session-resolver.ts:40`의 `@MX:NOTE`가 "No caller exists in this repository yet"이라고 적고 있는데, 위 표대로 지금은 호출자가 셋이므로 이 주석은 낡았다(SPEC-REVIEW-001이 리뷰 관련 둘을, SPEC-AUTH-003이 `SiteHeader` 하나를 붙였다). 이 SPEC은 이 파일을 수정하지 않으므로 고치지 않는다.

### §4.1 쿠키 속성 확인

| 쿠키 | httpOnly | sameSite | 위치 |
|---|---|---|---|
| `refresh_token` | `true` | `"lax"` | `src/lib/auth/cookies.ts:42-44` |
| `csrf_token` | `false` (의도적) | `"lax"` | `src/lib/auth/csrf.ts:96-98` |

`sameSite: "lax"`는 교차 출처 POST에 쿠키를 붙이지 않으므로 CSRF의 1차 방어가 된다. `verifyCsrfRequest(request)`(`csrf.ts:130`)는 `Request`를 직접 받으므로 주문 라우트에서 바로 쓸 수 있다.

`grep -rn "verifyCsrfRequest(" src`를 직접 실행해 확인했다(2026-09-05). **호출자는 여섯이다.**

| 호출자 | 소유 SPEC |
|---|---|
| `src/app/api/auth/refresh/route.ts:39` | SPEC-AUTH-001 |
| `src/app/api/auth/logout/route.ts:39` | SPEC-AUTH-001 |
| `src/app/staff/api/products/route.ts:38` | SPEC-ADMIN-002 계열 |
| `src/app/staff/api/products/[productId]/route.ts:32` | SPEC-ADMIN-002 계열 |
| `src/app/staff/api/products/[productId]/active/route.ts:36` | SPEC-ADMIN-003 계열 |
| `src/app/staff/api/orders/[orderId]/status/route.ts:44` | SPEC-ADMIN-001 계열 |

**정정 기록**: 초판은 "logout과 refresh 둘뿐"이라고 썼다 — staff 라우트 4곳을 세지 않은 오류다. 핵심 주장(**`POST /api/orders`에는 CSRF 보호가 전혀 없다**, design.md §3.3)은 그대로 유효하며, 위 여섯 곳 어디에도 주문 라우트는 없다.

마지막 행이 design.md §3.4가 인용하는 순서 규율의 원본이다 — 그 파일의 주석(`:14-16`)이 "CSRF FIRST … before ANY other check, including DB access"라고 못 박고 있다. 다만 그 라우트는 **관리자 전용 단일 경로**라 조건 판정 없이 CSRF를 맨 앞에 둘 수 있고, 이 SPEC의 주문 라우트는 회원·게스트 이중 경로라 그 배치를 그대로 쓸 수 없다(design.md §3.4가 그 차이를 다룬다).

---

## §5. 위임 브리프와 어긋난 세 건

### 정정 1 — Bearer 분기는 죽은 코드가 되지 않는다

브리프: "`resolveCartIdentity()`의 Bearer/JWT `identity.kind === "user"` 분기가 죽은 코드가 되므로 유지/제거를 결정하라."

실측(`grep -rn "resolveCartIdentity" src`): 호출자 5곳, 그중 4곳이 SPEC-CART-001 소유 장바구니 라우트. 이 SPEC은 그중 **주문 라우트 1곳만** 떼어 낸다. 나머지 4곳은 그대로 Bearer 분기를 쓴다 — 회원 장바구니 API와 로그인 시 카트 병합이 그것에 의존한다.

**결정: 유지.** 근거는 "혹시 몰라서"가 아니라 "살아 있는 소비자 4곳"이다.

### 정정 2 — 재작성 대상은 2파일 6건이 아니라 3파일 7건

`tests/unit/orders/scope-boundaries.test.ts:237`이 살아 있는 `prisma/schema.prisma`를 읽어 `User` 모델에 `orders Order` 패턴이 **없음**을 단언한다. Prisma 관계 규칙상 확실히 깨진다(§2.3).

### 정정 3 — API만 고치면 UI로 도달 불가능하고, ORDER-001이 이름 붙인 결함을 재현한다

브리프의 레이어 추적은 API·서비스·저장소 4개 층만 열거했다. 실제로는 화면 둘이 게스트 쿠키만 읽는다.

```tsx
// src/app/(shop)/checkout/page.tsx:42-50
const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null;
if (guestId === null) {
  return <CheckoutUnavailable />;
}
```

```tsx
// src/app/(shop)/checkout/complete/[orderId]/page.tsx:68-78
const guestId = jar.get(GUEST_CART_COOKIE_NAME)?.value ?? null;
if (guestId === null) { notFound(); }
const order = await getOrderForGuest(orderId, guestId);
if (!order) { notFound(); }
```

로그인 시 게스트 쿠키는 무조건 만료되므로(`src/app/api/auth/login/route.ts:129`, 주석: "Expired unconditionally, INCLUDING after a failed merge") 회원은 두 화면 어디에도 도달하지 못한다.

두 번째가 결정적이다. SPEC-ORDER-001 §3이 자신이 막고 있던 결함에 이름을 붙여 두었다.

> 회원 주문이 조용히 만들어졌다가 정작 그 회원이 열어볼 수 없는 상태는 발생하지 않는다.
>
> — `SPEC-ORDER-001/spec.md:129`

화면을 손대지 않고 API만 열면 이 SPEC은 **정확히 그 상태를 만든다.** 따라서 두 화면과 안내 문구를 범위에 포함했다. 이것은 §3이 제외하는 재방문 조회(`/orders/lookup/*`)와 다른 경로다 — 완료 화면은 생성 흐름의 종착점이다.

---

## §6. 로그인이 회원 카트를 남긴다 — 회원 주문서가 성립하는 이유

`src/app/api/auth/login/route.ts`는 로그인 성공 시 두 가지를 한다.

1. `mergeGuestCartIntoUserCart(userId, guestId)` — 게스트 카트를 회원 카트로 병합(`cart-service.ts:308`).
2. 게스트 쿠키를 무조건 만료(`:129`).

주석이 무조건 만료의 이유를 적어 두었다.

> Expired unconditionally, INCLUDING after a failed merge. The merge is idempotent only because a merged guest id stops resolving; a partial merge breaks that, so re-presenting the cookie at the next login could double-count quantities.

**귀결**: 로그인 직후 회원의 상품은 `userId`가 걸린 `Cart` 행 안에 있고, 게스트 쿠키는 사라졌다. 따라서 `/checkout`이 `resolveSession()` → `findCartByUserId()` 경로를 타면 방문자가 담아 둔 상품을 정확히 찾는다. 이 병합이 없었다면 회원 주문서는 항상 빈 카트를 봤을 것이다.

이것이 SPEC-ORDER-001이 기록한 세 번째 인계 항목 — "(c) 로그인 시 만료되는 게스트 쿠키와 진행 중인 체크아웃의 관계를 정의한다"(`spec.md:127`) — 에 대한 이 SPEC의 답이다: **관계는 병합이며, 회원은 자기 카트를 본다.**

---

## §7. 남은 불확실성

- **마이그레이션 SQL의 실제 적용 결과를 이 환경에서 관측할 수 없다.** `prisma validate`는 스키마만 본다. 실 데이터베이스에 적용될 때 처음 검증된다.
- **커버리지 영향 미측정.** 기준선은 통과 수만 캡처했고 커버리지 수치는 캡처하지 않았다. run-phase에서 `--coverage`로 다시 측정해 85%/80% 기준을 대조해야 한다.
- **`Order.user`의 `onDelete: Restrict`가 사용자 삭제 경로와 충돌하는지 확인하지 못했다.** 저장소에 사용자 삭제 경로가 현재 없다는 것은 확인했으나(`prisma.user.delete` 미검출), 관리자 백오피스가 나중에 추가할 경우 이 제약을 만나게 된다. 그때의 결정은 그 SPEC의 일이다.
