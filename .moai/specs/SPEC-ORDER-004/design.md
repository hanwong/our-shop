# design.md — SPEC-ORDER-004

## §1. 데이터 모델

### §1.1 `Order`의 새 소유 차원

```prisma
model Order {
  id          String      @id @default(cuid())
  orderNumber String      @unique
  status      OrderStatus @default(pending_payment)

  // SPEC-ORDER-004 M1 — 소유 차원 두 개. 정확히 하나만 채워진다(REQ-ORDER-048).
  // 둘 다 nullable인 이유는 Cart와 같다: "정확히 하나"는 컬럼 제약으로 표현할
  // 수 없으므로, 그것을 위반하는 형태를 쓰기 경로가 아예 만들지 않는 것으로
  // 유지한다(cart-repository.ts:68-77의 선례).
  guestId String?
  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: Restrict)

  // ... 기존 필드 전부 불변 ...

  @@index([guestId])
  @@index([userId])
}
```

`User` 쪽 반대편 선언(Prisma 필수):

```prisma
model User {
  // ...
  // SPEC-ORDER-004 M1 — back-relation only; 기존 필드는 하나도 바뀌지 않는다.
  orders Order[]
}
```

### §1.2 `Cart`와 형태는 같고 기수가 다르다 — 가장 틀리기 쉬운 지점

`Cart`의 XOR을 그대로 베끼면 **틀린다.**

| | `Cart` (선례) | `Order` (이 SPEC) |
|---|---|---|
| `userId` | `String? @unique` | `String?` — **`@unique` 없음** |
| `guestId` | `String? @unique` | `String?` — **`@unique` 없음** |
| 의미 | 회원당 장바구니 **하나** | 회원당 주문 **여럿** |
| 인덱스 | `@@index([guestId])` | `@@index([guestId])` + `@@index([userId])` |

`Cart`의 `@unique`는 "회원당 카트 하나"라는 도메인 규칙을 DB로 강제한 것이다. 주문에는 그런 규칙이 없다 — 한 회원이 100건을 주문할 수 있어야 한다. 따라서 `@unique`를 옮겨 오면 **두 번째 주문이 P2002로 실패한다.**

`@unique`가 없으므로 인덱스를 명시적으로 선언해야 한다. `Cart`에서는 `@unique`가 인덱스를 겸했지만 여기서는 겸하지 않는다. `@@index([userId])`가 없으면 회원 주문 조회가 순차 스캔이 된다.

빌린 것은 **강제 방식**(둘 다 nullable + 쓰기 경로가 위반 형태를 만들지 않음)이고, 빌리지 않은 것은 **기수**다.

### §1.3 `onDelete: Restrict`인 이유

`Cart.user`는 `Cascade`(회원이 지워지면 장바구니도 사라진다 — 장바구니는 회계 기록이 아니다). `Order.user`는 **`Restrict`**다. `OrderItem.product`가 `Restrict`인 것과 같은 판단이다(`schema.prisma:222-227`) — 주문은 회계 기록이고, 사용자 삭제로 파괴되어서는 안 된다.

이 선택의 귀결: `userId`가 걸린 주문이 있는 `User`는 삭제할 수 없다. 저장소에 사용자 삭제 경로는 현재 존재하지 않으므로 지금 깨지는 것은 없고, 이 제약은 그 경로가 생길 때 명시적 결정을 강제한다(주문을 익명화할 것인가, 사용자를 소프트 삭제할 것인가).

### §1.4 XOR 불변식의 강제 지점

DB 제약이 아니다. `Order` 행을 만드는 **유일한 함수**가 형태를 결정한다.

```
createOrderWithItems(tx, row)
        ↑
    CreateOrderRow.owner: { kind: "guest", guestId } | { kind: "user", userId }
```

판별 유니온이 강제 장치다. `{ guestId?: string; userId?: string }` 같은 선택적 두 필드를 받으면 "둘 다"와 "둘 다 아님"이 타입상 표현 가능해지고, 그 순간 불변식은 코드 리뷰에 의존하게 된다. 판별 유니온에서는 **두 위반 상태가 타입으로 표현 불가능**하다.

저장소 함수는 유니온을 두 개의 구체적 `data` 형태로 펼친다.

```ts
const owner = row.owner.kind === "user"
  ? { userId: row.owner.userId }     // guestId는 언급조차 하지 않는다 → null
  : { guestId: row.owner.guestId };  // userId는 언급조차 하지 않는다 → null
```

언급하지 않은 컬럼은 Prisma가 `null`로 둔다. "명시적으로 `null`을 쓰는" 대신 "쓰지 않는" 방식을 택한 이유는 `createUserCart`/`createGuestCart`가 이미 같은 형태이기 때문이다(`cart-repository.ts:79-87`).

---

## §2. 마이그레이션

### §2.1 이 변경은 사전 승인되어 있다

`20260831120000_add_order_models/migration.sql:14-20`이 이 마이그레이션을 **미리 허가해 두었다.**

```sql
-- NOTE ON THE OWNERSHIP COLUMN: "guestId" is NOT NULL and there is deliberately
-- ...
-- migration that adds "userId" and relaxes this NOT NULL; that relaxation is a
-- plain DROP NOT NULL on a fully-populated column, so it is not destructive.
```

즉 `DROP NOT NULL`이 파괴적이지 않다는 판단은 이 SPEC이 새로 내리는 것이 아니라, 원래 마이그레이션 저자가 이미 기록해 둔 것이다.

### §2.2 SQL 형태

디렉터리: `prisma/migrations/<YYYYMMDDHHMMSS>_add_order_user_ownership/migration.sql` (저장소의 10개 기존 마이그레이션이 전부 이 규칙을 따른다).

```sql
-- SPEC-ORDER-004 M1 — Order에 회원 소유 차원을 추가한다.
--
-- 세 동작 전부 순수 추가(additive)다:
--   1. "guestId"의 NOT NULL 해제 — 완전히 채워진 컬럼에 대한 DROP NOT NULL이며,
--      기존 행의 값은 하나도 바뀌지 않는다(20260831120000_add_order_models
--      migration.sql:14-20이 이 완화를 미리 비파괴적이라고 기록해 두었다).
--   2. nullable "userId" 추가 — 기존 행은 전부 NULL이 되고, 그 상태는
--      "게스트 소유"라는 유효한 상태다(REQ-ORDER-048의 XOR을 위반하지 않는다).
--   3. 인덱스와 외래 키 추가.
--
-- 롤백 시 데이터 손실 지점: "userId"에 값이 들어간 뒤 이 마이그레이션을
-- 되돌리면 그 회원 귀속 정보는 사라지고, "guestId"의 NOT NULL 복원은
-- guestId가 NULL인 회원 주문 행 때문에 실패한다. 되돌리기 전에 그 행들을
-- 먼저 처리해야 한다.

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "guestId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

### §2.3 손으로 쓴다 — 그리고 그것이 이 저장소의 규칙이다

`prisma migrate dev`는 실행 중인 Postgres와 shadow DB를 요구한다. 이 샌드박스에도 CI에도 도달 가능한 Postgres가 없다(`.github/workflows/ci.yml:46-59` — `DATABASE_URL`은 루프백을 가리키는 자리표시자이며 "Nothing in CI opens a database connection"). 기존 10개 마이그레이션이 전부 이 방식으로 작성되었다.

CI가 실제로 거는 관문은 `prisma validate`(스키마 문법·관계 정합성)와 `prisma generate`뿐이다. **마이그레이션 SQL과 `schema.prisma`의 일치는 기계가 검사하지 않는다** — 손으로 대조해야 하고, 이것이 이 SPEC의 가장 조용한 위험이다(plan.md §B 참조).

---

## §3. 신원 해석 아키텍처

### §3.1 새 교차점

```
브라우저 (로그인 상태)
   │  refresh_token 쿠키 (httpOnly, sameSite=lax, path=/)
   │  — 모든 요청에 자동 첨부, 최상위 SSR 내비게이션 포함
   ▼
POST /api/orders
   │
   ├─ 1. resolveSession(cookieStore) ──── Session | null
   │        읽기 전용 조회다(REQ-AUTH-034). 이 단계는 아무것도 변경하지 않으므로
   │        CSRF보다 먼저 와도 안전하다 — 자세한 이유는 §3.4.
   │        │
   │        ├─ non-null (회원)
   │        │     │
   │        │     └─ 2a. verifyCsrfRequest(request) ── 실패 → 403
   │        │              변경 동작(주문 생성) 이전, 트랜잭션 이전.
   │        │              → owner = { kind: "user", userId }
   │        │
   │        └─ null (게스트) — Authorization 헤더 유무와 무관하게 무조건 이 경로
   │              │
   │              └─ 2b. CSRF 검증 없음 (§3.3)
   │                     guestId = readGuestCartId(request) ?? generateGuestCartId()
   │                     → owner = { kind: "guest", guestId }
   ▼
3. 본문 파싱 → createOrder(owner, body)
   │
   ├─ owner.kind === "user"  → findCartByUserId(userId, tx)  → userId 주문
   └─ owner.kind === "guest" → findCartByGuestId(guestId, tx) → guestId 주문
```

**이것은 `resolveSession()`이 주문 도메인에서 쓰이는 첫 사례이자, 그 함수의 첫 쓰기 경로 소비자다.** 현재 호출자는 **셋**이며 전부 읽기 게이트다 — `src/app/(shop)/products/[productId]/page.tsx:49`(페이지 레벨 표시 게이트), `src/app/api/reviews/route.ts:29`(API 라우트 인증 게이트), `src/components/layout/SiteHeader.tsx:30`(레이아웃 레벨 로그인 상태 표시). 전수 목록과 그것을 만든 grep은 `research.md` §4에 있다. 이 SPEC은 **네 번째 호출자이자 새로운 종류**를 추가한다 — 쓰기 트랜잭션의 소유자 결정.

읽기 게이트와 쓰기 소유자 결정의 차이가 §3.3의 CSRF 논의를 낳는다. 게이트가 틀리면 화면이 잘못 그려진다. 소유자 결정이 틀리면 **잘못된 사람 이름으로 행이 남는다.**

### §3.2 두 신원 메커니즘이 공존하는 이유와 충돌하지 않는 이유

이 SPEC 이후 저장소에는 회원 신원 해석이 두 개 있다.

| | 장바구니 도메인 | 주문 도메인 (이 SPEC) |
|---|---|---|
| 함수 | `resolveCartIdentity()` | `resolveSession()` |
| 전송 수단 | `Authorization: Bearer <JWT>` | `refresh_token` 쿠키 |
| 검증 | `verifyAccessToken()` (서명·만료) | DB의 `RefreshToken` 행 조회 |
| 호출자 | 장바구니 라우트 4곳 | 주문 라우트 1곳 + 화면 2곳 |
| 소유 SPEC | SPEC-CART-001 | SPEC-ORDER-004 |

**이 SPEC 이후 주문 라우트는 `resolveCartIdentity()`를 아예 호출하지 않는다.** 이것이 REQ-ORDER-055(`Authorization`은 이 라우트에서 회원 근거가 아니다)를 실제로 성립시키는 메커니즘이며, 아래 §3.2.1이 그 이유를 적는다.

**충돌하지 않는 이유**: 두 메커니즘은 같은 `User.id`를 가리킨다. JWT의 `sub` 클레임은 로그인 시 발급된 사용자 id이고(`login/route.ts`), `resolveSession()`이 반환하는 `Session.userId`도 같은 값이다. 그러므로 회원이 Bearer로 담은 장바구니를 쿠키로 주문해도 **같은 회원의 같은 카트**를 읽는다.

**왜 통일하지 않는가**: 장바구니 라우트를 쿠키 방식으로 옮기는 것은 SPEC-CART-001의 계약을 다시 여는 일이고, 살아 있는 호출자 4곳의 동작을 바꾼다(spec.md §1.4 정정 1). 이 SPEC의 범위가 아니다.

**왜 브리프의 원래 제안(Bearer 유지)이 아니라 쿠키인가**: 사용자가 AskUserQuestion으로 확정한 근거는 도달 가능성이다. 액세스 토큰은 클라이언트 메모리에만 존재하고(REQ-AUTH-009), 저장소에 클라이언트 측 인증 상태 저장소가 **하나도 없다**(SPEC-AUTH-002가 명시적으로 제외). 따라서 체크아웃 제출 시점에 그 토큰을 손에 쥐고 있을 보장이 없다 — 페이지를 새로 로드하면 사라진다. 쿠키는 페이지 로드 시점과 무관하게 항상 붙는다.

### §3.2.1 게스트 대체 경로의 실제 메커니즘 — `resolveCartIdentity()`로는 성립하지 않는다

REQ-ORDER-055는 "유효한 Bearer 헤더가 있어도 회원으로 인식하지 않는다"를 요구한다. **이것을 `resolveCartIdentity()`의 게스트 분기로 구현하려는 시도는 실패한다.** 그 함수의 실제 동작이 그렇지 않기 때문이다.

```ts
// cart-service.ts:65-88 — 실제 코드
export async function resolveCartIdentity(request: Request): Promise<ResolvedCartIdentity> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (token) {
    try {
      const claims = await verifyAccessToken(token);
      return { identity: { kind: "user", userId: claims.sub }, issuedGuestId: null };
    } catch {
      // Fall through to the guest path.
    }
  }
  // ... 게스트 경로 ...
}
```

게스트 경로로 떨어지는 것은 토큰이 **없거나 유효하지 않을 때뿐**이다. **유효한** Bearer 토큰은 `{ kind: "user", userId }`를 반환하며, 이때 `guestId`도 `issuedGuestId`도 존재하지 않는다. 즉 "유효한 Bearer + 세션 쿠키 없음" 요청을 이 함수에 통과시키면 게스트 신원이 **아예 만들어지지 않고**, AC-ORDER-057이 요구하는 `userId: null` 주문을 만들 수단이 없다.

**메커니즘 (구현 지시)**: 주문 라우트는 `resolveCartIdentity()`를 호출하지 않는다. `resolveSession()`이 회원 신원의 유일한 출처이고, 그것이 `null`이면 **Authorization 헤더의 존재·유효성과 무관하게 무조건** 게스트로 처리한다. 게스트 신원은 이미 export된 원시 함수로 직접 구성한다.

```ts
// src/app/api/orders/route.ts — 게스트 분기 (owner 결정)
const existing = readGuestCartId(request);            // guest-identity.ts:160
const issuedGuestId = existing === null ? generateGuestCartId() : null;  // :107
const guestId = existing ?? issuedGuestId!;
const owner = { kind: "guest" as const, guestId };
// 응답 직전, issuedGuestId !== null 이면 buildGuestCartCookie(issuedGuestId)를 붙인다 — 기존 :79-82 로직 그대로
```

세 함수 전부 `src/lib/auth/guest-identity.ts`가 이미 export하고 있고, 라우트는 그중 `buildGuestCartCookie`를 이미 import하고 있다. 새 헬퍼를 만들지 않으며, `cart-service.ts`도 건드리지 않는다.

**이 인라인화가 REQ-ORDER-055를 문서상의 다짐이 아니라 기계적 사실로 만든다**: 라우트에서 `resolveCartIdentity` import가 사라지므로, Bearer 토큰을 해석하는 코드 경로가 이 라우트에 물리적으로 존재하지 않게 된다. AC-ORDER-057은 그 import 부재로도 확인할 수 있다.

이것은 `resolveCartIdentity()`의 게스트 로직을 **복제**하는 것이므로 중복이다. 그 중복을 감수하는 이유는 대안이 더 나쁘기 때문이다 — 공유 함수에 "Bearer를 무시하라" 플래그를 추가하면 SPEC-CART-001이 소유한 함수의 시그니처를 바꾸게 되고(PRESERVE 위반), 그 함수를 쓰는 장바구니 라우트 4곳이 새 분기를 지나게 된다. 라우트 안의 3줄이 더 싸다.

### §3.3 위협 분석 — CSRF 노출면이 새로 생긴다

**변경 전**: `POST /api/orders`에는 CSRF 보호가 **전혀 없다**. `verifyCsrfRequest()`의 호출자는 저장소 전체에서 여섯 곳이며(`auth/refresh:39`, `auth/logout:39`, `staff/api/products:38`, `staff/api/products/[productId]:32`, `staff/api/products/[productId]/active:36`, `staff/api/orders/[orderId]/status:44` — 2026-09-05 재확인), 주문 라우트는 그중에 없다. 그럼에도 회원 경로에 CSRF 위험이 없었던 이유는 회원 식별이 `Authorization` 헤더를 요구했기 때문이다 — 교차 출처 HTML 폼은 커스텀 헤더를 붙일 수 없고, 커스텀 헤더를 붙이는 `fetch`는 프리플라이트를 유발한다. **헤더 기반 인증은 구조적으로 CSRF에 면역이다.**

**변경 후**: 회원 식별이 쿠키로 옮겨 간다. 쿠키는 브라우저가 자동으로 붙이므로, 그 면역이 사라진다.

**남아 있는 1차 방어**: `refresh_token`은 `sameSite: "lax"`다(`cookies.ts:44`). Lax는 **교차 출처 POST에 쿠키를 붙이지 않는다**(최상위 GET 내비게이션에만 붙는다). 따라서 교차 출처 폼 제출은 `resolveSession()`에서 `null`이 되고 게스트 경로로 떨어진다 — 공격자의 요청은 공격자 자신의 게스트 신원으로 처리되며, 피해자 회원의 주문을 만들지 못한다.

**그런데 이 방어는 단일 실패점이다.** `sameSite`를 `none`으로 바꾸는 한 줄짜리 변경(예: 서드파티 임베드 요구, 결제 리다이렉트 대응)이 이 SPEC과 무관한 곳에서 일어나면, 그 순간 회원 주문 생성이 CSRF에 노출된다 — 그리고 그 변경을 하는 사람은 주문 도메인을 보고 있지 않을 것이다.

**결정 (REQ-ORDER-064)**: 회원 경로에만 `verifyCsrfRequest()`를 걸고, **주문 생성이라는 변경 동작 이전**에 건다. 근거 셋:

1. **심층 방어** — `sameSite`가 유일한 방어이면 안 된다.
2. **저장소 선례와 일치** — `logout`/`refresh`/staff 라우트 4곳이 이미 "쿠키로 신원을 판정하는 상태 변경 요청은 변경 이전에 CSRF를 통과한다"는 규칙을 세웠다. 주문 생성은 그 규칙에 정확히 해당한다.
3. **비용이 낮다** — `csrf_token` 쿠키는 `httpOnly: false`로 이미 발급되고 있고(`csrf.ts:91-98`), 클라이언트가 `document.cookie`를 파싱해 `X-CSRF-Token`으로 되돌려 보내는 선례가 저장소에 두 곳 있다(`CancelOrderButton.tsx:29`, `ProductForm.tsx:38`).

**게스트 경로는 검증하지 않는다.** 게스트 신원은 쿠키(`guest_cart_id`)이지만 그것은 **인증이 아니라 식별자**다 — 아무 권한도 증명하지 않고, 위조해 봐야 공격자가 자기 장바구니로 자기 주문을 만들 뿐이다. 게스트 경로에 CSRF를 걸면 기존 게스트 동작이 깨지고(REQ-ORDER-065 위반), 얻는 것이 없다.

### §3.4 검증 순서 — 세션 해석이 CSRF보다 먼저다 (그리고 그래야만 한다)

**순서**: 세션 해석 → (회원이면) CSRF → 본문 파싱 → 트랜잭션.

CSRF를 맨 앞에 두는 것이 저장소의 다른 라우트 관행이므로, 여기서 순서를 뒤집는 이유를 분명히 적는다.

**CSRF를 먼저 둘 수 없는 이유는 논리적 순환이다.** CSRF 검증을 회원 경로에만 걸기로 했으므로(위 결정), "이 요청이 회원 경로인가"를 먼저 알아야 한다. 그런데 그 판정은 `resolveSession()`이 하고, `resolveSession()`은 **그 자체가 데이터베이스 조회다** — `prisma.refreshToken.findFirst({ where: { tokenHash }, include: { user: true } })`(`session-resolver.ts:60-63`). 따라서 "CSRF를 DB 접근 이전에 건다"와 "CSRF를 회원 경로에만 건다"는 그대로는 동시에 성립하지 않는다. 순서를 지정하지 않으면 구현자는 게스트에게도 CSRF를 걸거나(REQ-ORDER-065 위반), 판정 없이 CSRF를 건너뛰게 된다.

**세션 해석을 먼저 해도 안전한 이유**: `resolveSession()`은 **읽기 전용**이다. 쿠키를 재발급하지 않고, 토큰을 회전시키지 않으며, 읽은 `RefreshToken` 행을 변형하지 않는다(REQ-AUTH-034). CSRF가 막는 것은 **피해자의 권한으로 변경 동작이 촉발되는 것**이지 읽기가 아니다. 교차 출처 요청이 세션 조회 한 번을 유발하는 것은 CSRF 피해가 아니다 — 아무것도 바뀌지 않고, 응답도 공격자에게 돌아가지 않는다(교차 출처 응답은 읽을 수 없다).

**정확히 지켜야 하는 불변식**: CSRF 검증은 **주문 생성 트랜잭션 이전**에 완료된다. 회원 경로에서 CSRF가 실패하면 본문을 파싱하지 않고, `prisma.$transaction`을 열지 않으며, 주문·재고·장바구니 중 아무것도 건드리지 않는다(AC-ORDER-069).

**가장 가까운 선례**: `src/app/staff/api/orders/[orderId]/status/route.ts:14-16`이 같은 규율을 자기 주석으로 못 박아 두었다.

> 1. CSRF FIRST (REQ-ADMIN-016) — verifyCsrfRequest(request), before ANY other check, including DB access. Matches logout/route.ts's discipline exactly.

**구조적 차이는 인정하고 넘어간다**: 그 라우트는 관리자 전용이라 **모든** 요청이 CSRF를 요구하므로, 조건 판정 없이 맨 앞에 둘 수 있다. 이 SPEC의 주문 라우트는 회원·게스트 이중 경로이므로 그 배치가 불가능하다. 물려받는 것은 배치가 아니라 **"CSRF는 변경 동작을 게이트한다"는 원칙과 이유를 밝히지 않는 거부 응답 형태**다. 회원 경로의 CSRF 실패는 그 선례와 같이 403이며, 어떤 검사가 실패했는지 드러내지 않는다.

**남는 위험 (기록)**: CSRF 토큰이 없는 회원은 403을 받는다. `csrf_token` 쿠키의 수명은 30일(`csrf.ts:31`)이고 로그인 시 발급되므로 정상 흐름에서는 존재하지만, 쿠키가 만료된 채 세션만 살아 있는 창(session > csrf 수명)은 이론적으로 가능하다. 그 경우 사용자는 재로그인해야 한다 — `logout`/`refresh`가 이미 감수하고 있는 것과 동일한 위험이며, 이 SPEC이 새로 만드는 것이 아니다.

---

## §4. 멱등성 재전송의 소유자 대조

현재 코드는 소유자를 `guestId`로만 대조한다(두 곳: `order-service.ts:466`의 빠른 경로, `:691`의 경합 패자 경로).

```ts
const replayed = await findOrderByIdempotencyKey(input.idempotencyKey);
if (replayed !== null && replayed.guestId === guestId) { ... }
```

이 검사는 SPEC-ORDER-001 감사의 F1 결함(멱등성 키만으로 낯선 사람에게 배송 PII를 포함한 주문 전체를 넘겨주던 것)을 막기 위해 들어갔다. **`userId`를 추가하면서 이 방어를 약화시키면 같은 결함이 회원 축에서 재발한다.**

올바른 형태는 소유자 **종류까지** 대조하는 것이다.

```ts
function isSameOwner(order: { guestId: string | null; userId: string | null }, owner: OrderOwner): boolean {
  return owner.kind === "user"
    ? order.userId === owner.userId      // guestId 주문은 userId가 null이므로 매치 불가
    : order.guestId === owner.guestId;   // userId 주문은 guestId가 null이므로 매치 불가
}
```

**`null === null`이 참이 되는 경로가 없다는 것이 핵심이다.** `owner.kind === "user"`이면 `owner.userId`는 반드시 문자열이고, 게스트 주문의 `order.userId`는 `null`이므로 절대 같아질 수 없다. 반대 방향도 같다. XOR 불변식(REQ-ORDER-048)이 이 성질을 보장하며, 그래서 XOR이 문서상의 다짐이 아니라 **보안 속성**이다.

교차 소유자 충돌(회원이 게스트 주문의 키를 제시)은 기존 경로 그대로 500 무명 응답으로 붕괴한다 — 키의 존재 여부를 알려주지 않는 비공개 원칙을 유지한다.

---

## §5. 화면 계층

### §5.1 `/checkout` — 주문서 진입

```
CheckoutPage()
  ├─ resolveSession(jar) ── non-null → getCart({ kind: "user", userId })
  │
  └─ null → 기존 게스트 경로 (guest_cart_id 쿠키) — 한 줄도 바뀌지 않는다
```

회원이 여기 도달할 수 있는 이유: 로그인 시 게스트 카트가 회원 카트로 병합되고(`mergeGuestCartIntoUserCart`, `cart-service.ts:308`) 게스트 쿠키는 무조건 만료된다(`login/route.ts:129`). 즉 로그인 직후 회원의 상품은 **회원 카트 안에** 있다. `findCartByUserId`가 그것을 찾는다.

세션 해석을 게스트 쿠키 읽기보다 **먼저** 한다. 순서가 반대이면, 게스트 쿠키가 어떤 이유로든 남아 있는 회원(로그인 응답의 쿠키 만료가 유실된 경우)이 자기 회원 카트 대신 낡은 게스트 카트로 주문서를 열게 된다.

### §5.2 `/checkout/complete/[orderId]` — 완료 화면

같은 분기이며, 조회 함수가 소유자별로 갈린다: `getOrderForUser(orderId, userId)` / 기존 `getOrderForGuest(orderId, guestId)`.

두 함수 모두 소유 조건을 **`where` 절 안에** 둔다(`findOrderForGuest`의 기존 규율 — "there is no shape of this function that returns a stranger's order to be filtered afterwards", `order-repository.ts:99-101`). 결과를 받아서 걸러내는 형태를 만들면 그 규율이 깨진다.

모든 거부는 `notFound()`이며 "권한 없음" 상태를 쓰지 않는다 — 기존 화면의 비공개 선례를 그대로 따른다.

### §5.3 `CheckoutUnavailable` 안내 문구

현재 문구(`CheckoutUnavailable.tsx:35`)는 이 SPEC 이후 **거짓**이 된다.

> 현재는 비회원(게스트) 주문만 지원합니다. 회원 체크아웃은 아직 제공되지 않으며, 로그인한 상태에서는 이 화면에서 장바구니를 불러올 수 없습니다.

이 문단(범위 고지)을 제거한다. 첫 문단("이 요청에 연결된 … 장바구니를 찾을 수 없습니다")은 회원·게스트 양쪽에서 여전히 참이므로 유지하되, "게스트"라는 한정을 뺀다. REQ-ORDER-006의 원래 요구("회원 체크아웃이 이번 범위에 없다는 사실을 함께 알려야 한다")는 이 SPEC이 그 전제를 없애면서 소멸한다.

---

## §6. 저장소 계층 서명 변경

### §6.1 `cart-repository.ts`의 동결 불변식에 두 번째 예외

이 파일은 트랜잭션 클라이언트를 받는 함수 목록을 **문서로 못 박아 두었다**.

> Only findCartByGuestId() and deleteCart() accept one, and only as an OPTIONAL trailing parameter defaulting to the singleton — so every existing call site is unchanged.
>
> — `cart-repository.ts:51-53`

이 SPEC은 `findCartByUserId`를 **세 번째 함수**로 추가한다 — 즉 원래 문장이 세운 2개 목록의 **두 번째 예외**다.

첫 번째 예외(SPEC-ORDER-001 §4.1)의 논거를 그대로 물려받는다: 주문 트랜잭션은 카트를 **트랜잭션 안에서** 읽고 지워야 하며, 대안은 `where: { userId }` 소유권 질의를 주문 도메인으로 복사하는 것인데 그것은 이 모듈이 한곳에 모아 두려는 인가 표면을 갈라 놓는다.

형태도 그대로 물려받는다 — **선택적 후행 인자, 기본값은 싱글턴**. 그래서 `cart-service.ts:93`의 기존 호출자는 한 글자도 바뀌지 않는다.

```ts
export async function findCartByUserId(
  userId: string,
  client: CartClient = prisma
): Promise<CartWithItems | null> {
  return client.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
}
```

**주석의 목록 문장 자체를 갱신해야 한다.** 문장을 그대로 두면 파일이 자기 자신에 대해 거짓을 말하게 되고, 다음 독자는 코드가 아니라 주석을 믿는다.

### §6.2 `order-repository.ts`

- `CreateOrderRow.guestId: string` → `owner: OrderOwner` 판별 유니온(§1.4).
- `findOrderForUser(orderId, userId, client = prisma)` 신설 — `findOrderForGuest`와 같은 형태, 소유 조건은 `where` 안에.
- `findOrderByIdempotencyKey`는 **바뀌지 않는다.** 키로만 찾고, 소유자 판정은 호출자(서비스)가 한다 — 기존 책임 분담 그대로다.

### §6.3 `order-service.ts`

`createOrder(guestId: string, ...)` → `createOrder(owner: OrderOwner, ...)`.

**기계적 제약**: `tests/unit/orders/scope-boundaries.test.ts`가 살아 있는 소스 텍스트를 여섯 개 단언으로 검사한다(`:113`, `:122`, `:123`, `:127`, `:128`, `:134` — 전수 목록은 research.md §2.5).

```
:122  /findCartByGuestId\(\s*guestId,\s*tx\s*\)/
:123  /deleteCart\(\s*cart\.id,\s*tx\s*\)/
:127  /decrementStockIfAvailable\(\s*tx,/
:128  /createOrderWithItems\(\s*tx,/
:134  /throw new OrderAbort/
```

`:134`는 특히 이 SPEC과 관련이 깊다. Prisma는 콜백이 **던지면 롤백하고 반환하면 커밋한다**. 회원 분기를 추가하면서 그 분기의 거부를 `return`으로 쓰면 부분 주문이 저장되며, 이 단언이 그것을 잡는다. 두 소유자 분기 모두 거부는 `throw new OrderAbort`다.

게스트 분기는 **`findCartByGuestId(guestId, tx)`라는 문자열 형태를 그대로 유지해야 한다.** 소유자 dispatch를 `findCart(owner, tx)` 같은 헬퍼로 감싸면 이 단언이 깨진다 — 그리고 그 단언은 "모든 주문 쓰기가 트랜잭션 안에서 일어난다"는 실제 안전 속성을 지키고 있으므로, 깨뜨린 뒤 완화하는 것이 아니라 형태를 지키는 쪽이 옳다. 분기는 서비스 안에서 명시적 `if`로 쓰고, 각 분기가 자기 저장소 함수를 직접 호출한다.

같은 파일 `:107-116`의 `prisma` 단독 사용 검사(`prisma.$transaction` 하나만 허용)도 그대로 통과해야 한다 — 새 코드가 `prisma.order`나 `prisma.cart`를 직접 만지면 안 된다.

---

## §7. 이 설계가 만들지 않는 것

- 새 쿠키를 도입하지 않는다. `refresh_token`과 `csrf_token`은 둘 다 SPEC-AUTH-001이 이미 발급하던 것이다.
- `REQ-AUTH-009`(액세스 토큰 메모리 전용)를 건드리지 않는다.
- `REQ-ORDER-005`(서버 렌더 주문서)를 뒤집지 않는다 — 주문서는 여전히 서버 렌더다.
- `src/middleware.ts`를 건드리지 않는다 — `/checkout`은 여전히 보호 라우트가 아니며, 회원과 게스트 모두 진입 가능해야 하므로 보호 라우트가 되어서도 안 된다.
- `resolveAdminSession()`과 `resolveSession()`을 합치지 않는다 — SPEC-AUTH-002가 명시적으로 제외한 범위다.
