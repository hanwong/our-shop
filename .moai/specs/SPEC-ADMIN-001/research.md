# Research: SPEC-ADMIN-001 — 관리자 주문 목록·상태 변경 백오피스

plan-phase 착수 전 직접 읽은 파일과 실행한 명령의 근거를 남긴다. 모든 결론은 spec.md·plan.md·design.md에서 이 문서를 인용한다.

## §1. 백로그 카드 t12의 정확한 문구

```
$ moai todo (발췌)
t12  picked  관리자 주문 목록·상태 변경 백오피스
t24  queued  배송 이행 상태 기계(준비중/배송중/배송완료) — 새 상태값·전이 주체(관리자 백오피스, 백로그 t12)
             둘 다 미계획. t8에서 분리됨, SPEC-SHIPPING-001 후보
```

`t24`는 이 SPEC(t12)을 **미래의** 전이 주체로만 지목했다 — "관리자 백오피스가 생기면 그 다음에 t24를 다룬다"는 순서이지, "이 SPEC이 t24를 흡수한다"는 뜻이 아니다. `t24`의 선행조건은 "전이 주체 확정"이며 이 SPEC이 그 선행조건을 채우지만, 새 상태값(`preparing`/`shipped`/`delivered`) 자체는 이 SPEC이 만들지 않는다. `SPEC-ORDER-003` §3도 동일하게 `OrderStatus` 3종 외 신규 상태값 도입을 명시적으로 범위 밖에 두었다. **판정: 이행 상태 기계는 이번 범위 밖(§3), t24는 여전히 별도 후속.**

## §2. OrderStatus의 현재 값과 기존 전이 로직

`prisma/schema.prisma`:
```prisma
enum OrderStatus {
  pending_payment
  paid
  cancelled
}
```

기존에 코드로 구현된 전이는 정확히 둘뿐이다:

| 전이 | 소유 SPEC | 구현 위치 | 트리거 |
|---|---|---|---|
| `pending_payment → paid` | SPEC-PAYMENT-001 | `payment-repository.ts markOrderPaid()` | 결제 승인(confirm) API 응답 또는 웹훅 `DONE` |
| `paid → cancelled` | SPEC-PAYMENT-001 | `payment-repository.ts markOrderCancelledAndRestoreStock()` | 결제 웹훅 `CANCELED` |

`markOrderCancelledAndRestoreStock(tx, orderId)`(payment-repository.ts:151-189)은 `status: "paid"`인 주문만 조건부로 `cancelled`로 전이시키고, 같은 트랜잭션 안에서 주문 항목별 재고를 `increment`로 복원하며, `SPEC-DISCOUNT-001` M5가 추가한 쿠폰 사용분 해제까지 수행한다. **이 함수는 `pending_payment` 소스 상태를 다루지 않는다** — `where` 절이 `status: "paid"`로 고정되어 있어, 결제 전 주문(`pending_payment`)에는 매치되지 않는다.

`PaymentAuditLog`(`prisma/schema.prisma:327-341`)는 모든 상태 전이마다 정확히 한 행을 요구하며(REQ-PAYMENT-001), `source` 컬럼은 `PaymentEventSource` enum이다:
```prisma
enum PaymentEventSource {
  CONFIRM_API // success redirect -> confirm API call path
  WEBHOOK // PAYMENT_STATUS_CHANGED webhook path
}
```
**두 값뿐이다.** 관리자가 취소를 트리거하면 이 두 값 중 어느 것도 사실과 맞지 않는다 — REQ-PAYMENT-001의 "모든 전이마다 정확히 하나의 감사 로그" 불변식을 지키려면 이 enum에 세 번째 값(관리자 트리거)이 필요하다. 이는 스키마를 소유한 `SPEC-PAYMENT-001`을 재설계하는 것이 아니라, 이미 확장 가능하게 설계된 enum에 새 값 하나를 더하는 것이다(다른 SPEC이 공유 모델에 필드를 더한 선례: `SPEC-DISCOUNT-001`의 `Order.couponCode`, `SPEC-PAYMENT-001`의 `Order.paymentKey`).

## §3. 관리자 주도 취소는 이미 이 SPEC(t12)에 명시적으로 위임되어 있다

`SPEC-PAYMENT-001` spec.md §3 "Out of Scope — 관리자·사용자 주도 취소·환불":

> "관리자 또는 사용자가 직접 요청하는 취소·환불 API, 부분 취소·부분 환불 UI는 이번 범위 밖이다... **관리자 주도 취소·환불은 향후 백오피스 주문 관리 SPEC(칸반 카드 t12로 이미 백로그에 등재)의 몫이다.**"

이 SPEC이 바로 그 t12다. 따라서 "관리자가 상태를 변경한다"는 요구를 단순 CRUD로 다루지 않고, **PAYMENT-001이 스스로 자신에게 위임한 책임을 인수하는 것**으로 취급한다 — 감사 로그 계약(REQ-PAYMENT-001)과 재고 복원 부작용(REQ-PAYMENT-014)을 그대로 승계해야 한다는 뜻이다.

`SPEC-ORDER-001` §3 "Out of Scope — 관리자 주문 관리"와 `SPEC-ORDER-003` §3 "Out of Scope — 관리자 주문 목록·상태 변경"도 동일하게 `product.md` 핵심 기능 #6과 백로그 `t12`를 이 책임의 소유자로 지목했다 — 세 개의 선행 SPEC이 독립적으로 같은 결론에 도달했다.

## §4. 결제 정합성 제약이 허용 전이를 좁힌다

`product.md` 핵심 제약: "**결제 데이터 정합성 최우선** — 결제 관련 데이터는 어떤 상황에서도 어긋나서는 안 되며, 이는 다른 품질 목표보다 우선한다."

관리자가 임의로 `paid`로 전이시킬 수 있게 하면, 실제 PG 승인 없이 "결제 완료"로 표시된 주문이 만들어질 수 있다 — 이 제약을 정면으로 위반한다. 따라서:

- **관리자가 만들 수 있는 전이는 `→ cancelled`뿐이다.** 어떤 소스 상태에서도 관리자가 `paid`로 전이시키는 경로는 만들지 않는다.
- 소스 상태는 `pending_payment`와 `paid` 둘 다 허용한다 — `pending_payment` 주문도 `REQ-ORDER-011`에 따라 **주문 생성 시점에 이미 재고가 차감**되어 있으므로, 결제 전 주문이라도 관리자가 취소하면 재고를 복원해야 정합성이 유지된다.
- `cancelled`는 종단 상태로 유지한다 — 취소된 주문을 되돌리는 전이(`cancelled → *`)는 만들지 않는다(어떤 선행 SPEC도 이런 되돌리기 요구를 제기한 적이 없다).

## §5. 관리자 인증 — REQ-AUTH-022는 이미 있지만 "API 전용"으로 스스로 경계를 그었다

`src/middleware.ts`(SPEC-AUTH-001 M6, REQ-AUTH-022):

```ts
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.redirect(new URL("/", request.url));
  try {
    const claims = await verifyAccessToken(token);
    if (claims.role !== "admin") return NextResponse.redirect(new URL("/", request.url));
  } catch { return NextResponse.redirect(new URL("/", request.url)); }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*"] };
```

이 파일 자신의 주석이 한계를 명시한다(3-31행): `REQ-AUTH-009`가 액세스 토큰을 **클라이언트 메모리에만** 두므로, `/admin/...`으로의 **최상위 브라우저 내비게이션**은 `Authorization` 헤더를 원리적으로 가질 수 없다 — 그 헤더는 same-origin `fetch`/XHR만 붙일 수 있다. 결과: `/admin/:path*` 경로 아래 어떤 **페이지**를 두더라도, 브라우저로 직접 열면 미들웨어가 무조건 `/`로 리다이렉트한다. 이 미들웨어는 **API 호출 게이팅에는 이미 작동**하지만(클라이언트 JS가 `fetch`로 `Authorization` 헤더를 붙이는 경우), **페이지 서빙에는 원리적으로 작동할 수 없다.**

주석 자신이 이렇게 적어 둔다: "A real frontend serving protected admin pages would need a same-origin API-call pattern... that frontend pattern is **outside this SPEC's API-only scope**." — 즉 SPEC-AUTH-001은 "관리자 페이지를 실제로 서빙하는 방법"을 의도적으로 미뤄 두었고, 그 몫이 바로 이 SPEC(t12)이다.

같은 문제를 `SPEC-ORDER-001` §3도 이미 겪었다 — 회원 체크아웃이 "서버 렌더 시점에 회원을 식별할 수단이 없다"는 이유로 구조적으로 제외된 것과 정확히 같은 벽이다. 다만 이번에는 **회피 가능한 우회로가 실제로 존재한다** (§6).

## §6. 우회로 — refreshToken 쿠키는 이미 서버에서 읽을 수 있다

`REQ-AUTH-008`: 리프레시 토큰은 **httpOnly + Secure + SameSite** 쿠키로 전달된다(액세스 토큰과 달리 메모리 전용이 아니다!). `session.ts`의 `hashRefreshToken()`이 이미 export되어 있고(52-61행), `RefreshToken` 모델은 `tokenHash`·`userId`·`expiresAt`·`revokedAt`을 갖는다.

즉 **Server Component/Route Handler는 `cookies()`로 refreshToken 원문을 읽고, `hashRefreshToken()`으로 해시한 뒤, `RefreshToken` 테이블에서 조회해 유효성(`revokedAt IS NULL AND expiresAt > now()`)과 `User.role`을 확인할 수 있다** — 이것은 회전(rotation)을 트리거하지 않는 **읽기 전용** 조회이며, `/auth/refresh`의 상태 변경 로직(`REQ-AUTH-010`의 회전+무효화)을 호출하지 않는다. `REQ-AUTH-009`(액세스 토큰 메모리 전용)는 전혀 건드리지 않는다 — 액세스 토큰이 아니라 이미 쿠키로 전달되는 리프레시 토큰을 읽을 뿐이다.

이것이 이 SPEC이 채택하는 **최소 침습 해법**이다: 새 쿠키·새 토큰 종류·새 로그인 플로우를 발명하지 않고, 이미 있는 리프레시 토큰 쿠키를 **읽기 전용으로** 한 번 더 소비하는 새 함수 하나(`resolveAdminSession()` 성격)를 추가한다.

**대안이었던, 채택하지 않은 경로**:
1. `src/middleware.ts`의 matcher를 `/admin/:path*` → `/admin/api/:path*`로 좁혀 페이지 요청은 게이트를 통과시키고 API만 계속 게이팅 — **기각**: 이미 테스트로 고정된(REQ-AUTH-022, `tests/unit/middleware.test.ts`) 완료 SPEC의 파일을 수정하는 것은 이 저장소가 반복적으로 지켜온 PRESERVE 원칙(SPEC-STOREFRONT-002 progress.md가 `src/middleware.ts` 무변경을 명시적 증거로 남긴 선례)과 어긋난다.
2. 클라이언트 메모리 부트스트랩(마운트 시 `/auth/refresh` fetch로 액세스 토큰을 메모리에 채운 뒤 관리자 API를 호출) — **기각하지 않았지만 더 무거움**: 이 경로도 결국 브라우저가 처음 `/admin/orders` HTML을 받아야 하는데, 그 최초 내비게이션 자체가 여전히 `/admin/:path*` 미들웨어에 걸려 리다이렉트된다(§5). 페이지를 `/admin` 접두사 밖에 두어야 하는 것은 이 경로에서도 동일하게 필요하다 — 그런데 그럴 거라면 §6의 읽기 전용 쿠키 해석이 더 적은 새 코드로 SSR을 되살린다.

**결론(잠정 결정 — plan.md §0에서 확정)**: 관리자 페이지는 `/admin` 접두사 **밖**(예: `/staff/...`)에 두어 기존 `REQ-AUTH-022` 미들웨어와 절대 충돌하지 않게 하고, 그 페이지들은 §6의 읽기 전용 refreshToken 해석으로 서버 렌더 시점에 관리자 여부를 직접 판정한다. 관리자 API(목록/상세/상태변경)는 별도로 그 자신의 라우트 핸들러 안에서 같은 판정 함수를 호출한다 — `src/middleware.ts`는 이 SPEC에서 **한 줄도 수정하지 않는다**(PRESERVE).

## §7. 관리자 로그인 진입점이 저장소에 전혀 없다

```
$ find src/app -iname "*login*" -o -iname "*signin*"
src/app/api/auth/login   (API 라우트 핸들러만 있음 — 폼 페이지 없음)
```

`/api/auth/login`(email+password)은 이미 완성되어 있고, `role: admin`인 `User`가 로그인하면 `issueSession(userId, role)`이 그 role을 액세스 토큰 클레임에 그대로 담는다(session.ts:73-93) — **로그인 로직 자체는 새로 만들 것이 없다.** 다만 그 API를 호출할 **폼 화면**이 저장소 전체에 하나도 없다. 이 SPEC의 관리자 백오피스가 최초의 진입점이므로, 최소한의 로그인 화면 하나를 이 SPEC이 만든다(§ 범위 결정, spec.md §1).

## §8. 관리자 계정 생성 경로가 없다

`prisma/schema.prisma`의 `Role`은 `customer`(기본값)·`admin` 두 값이다. 그러나 `POST /api/auth/signup`(REQ-AUTH-002)은 항상 기본값 `customer`로 `User`를 만든다 — **애플리케이션 어디에도 `admin` 역할의 사용자를 만드는 경로가 없다.** 즉 지금 이 저장소에는 관리자로 로그인할 수 있는 계정이 실제로 존재하지 않는다(DB에 직접 seed하지 않는 한). 이 SPEC은 관리자 계정 프로비저닝을 범위에 포함하지 않는다 — Prisma seed 스크립트나 수동 DB 갱신으로 `role: admin`인 `User` 행을 만드는 것은 운영 절차이지 이 SPEC의 산출물이 아니다(§3 Out of Scope).

## §9. 기존 페이지네이션·리포지토리 관례

`product-repository.ts`(SPEC-CATALOG-001/002)가 이미 `{ page, pageSize }` 입력을 받아 `skip`/`take`로 한 페이지 + 총 개수를 함께 반환하는 패턴을 확립해 두었다. 이 SPEC의 관리자 주문 목록도 같은 관례를 따른다 — 새 페이지네이션 방식을 발명하지 않는다.

`order-repository.ts`(SPEC-ORDER-001/002/003)는 이미 `findOrderForGuest`/`findOrderByNumberForGuest` 같은 게스트 귀속 조회를 갖고 있지만, **관리자 전용의 "귀속 무관 전체 조회"** 함수는 없다 — 이 SPEC이 새로 추가한다(귀속 조건이 없는 것이 바로 관리자 조회의 정의이므로 기존 게스트 조회 함수를 확장하지 않고 별도 함수로 둔다 — 인가 경계가 다른 두 개념을 한 함수에 조건 분기로 섞으면 실수로 게스트 인가를 우회하는 코드 경로가 생길 위험이 있다).

## §10. 요약 — 이미 있는 것 / 이 SPEC이 추가하는 것

| 이미 있음 (그대로 재사용) | 이 SPEC이 추가함 |
|---|---|
| `Role` enum(`customer`/`admin`), `User.role` | 관리자 세션 판정 함수(refreshToken 쿠키 읽기 전용 해석) |
| JWT 발급·검증(`jwt.ts`), 로그인 API(`/api/auth/login`) | 최소 관리자 로그인 화면(기존 API 그대로 호출) |
| `REQ-AUTH-022` `/admin` 미들웨어(무변경, PRESERVE) | 관리자 페이지·API를 `/admin` 접두사 밖에 배치 |
| `markOrderCancelledAndRestoreStock()`(paid 소스만) | `pending_payment` 소스도 포함하는 관리자 취소 경로 |
| `PaymentAuditLog` + `PaymentEventSource` enum | enum에 관리자 트리거 값 1개 추가 |
| catalog 페이지네이션 관례(`page`/`pageSize`) | 관리자 주문 목록에 동일 관례 적용 |
| `REQ-AUTH-023` CSRF 방지(refresh/logout) | 상태 변경 API에 동일 CSRF 방지 적용 |
