# Design: SPEC-ADMIN-001 — 관리자 주문 목록·상태 변경 백오피스

## §1. 경로 배치와 두 게이팅 레이어의 관계

```
/staff/login              (페이지, Client Component)  ─┐
/staff/orders              (페이지, Server Component)  ─┤  resolveAdminSession() 자체 판정
/staff/orders/[orderId]    (페이지, Server Component)  ─┘  (미들웨어 매처 밖)

/admin/api/orders/[orderId]/status (API, PATCH)          resolveAdminSession() 자체 판정
                                                          + REQ-AUTH-022 미들웨어(Authorization 헤더 있으면 추가 검증, 없으면 통과 없이 리다이렉트 — 단 API는 fetch 응답 리다이렉트를 그대로 받으므로 클라이언트가 302를 오류로 처리)
```

(`GET /admin/api/orders`는 이 SPEC의 범위 밖이다 — plan.md §3 "범위 밖" 참조. `/staff/orders`는 이 API를 거치지 않고 `admin-order-repository.ts`를 직접 호출한다.)

**왜 페이지는 `/admin` 밖에 두는가**: `src/middleware.ts`의 matcher `/admin/:path*`는 `Authorization` 헤더가 없는 모든 요청을 무조건 `/`로 리다이렉트한다(research.md §5). 브라우저의 최상위 내비게이션은 커스텀 헤더를 실을 수 없으므로, `/admin/*` 아래 어떤 페이지를 두어도 직접 열 수 없다. `/staff/*`는 이 매처와 문자열이 겹치지 않으므로(`/staff`는 `/admin/`으로 시작하지 않는다) 미들웨어를 전혀 거치지 않고 정상적으로 서빙된다.

**왜 API는 `/admin/api` 안에 두는가**: 미들웨어와의 충돌이 없다(API는 클라이언트 JS의 `fetch`가 호출하므로, 원한다면 `Authorization` 헤더도 얹을 수 있어 미들웨어의 검사를 통과할 여지가 있다). 다만 이 SPEC은 그 미들웨어의 통과를 **신뢰하지 않는다** — `resolveAdminSession()`을 각 라우트 핸들러 안에서 독립적으로 호출한다(REQ-ADMIN-017). 미들웨어는 있으면 이중 방어선, 없어도(예: 클라이언트가 `Authorization` 헤더를 안 보내 미들웨어가 먼저 리다이렉트해버리는 경우) 라우트 핸들러 자신의 판정이 유일한 방어선으로 여전히 작동한다.

이 경로 선택은 `t11`(관리자 상품 백오피스, 후속 SPEC)이 그대로 재사용할 수 있는 관례를 만든다 — `/staff/products`, `/admin/api/products` 형태로 확장 가능.

## §2. 관리자 세션 판정 — `resolveAdminSession()`

```
resolveAdminSession(cookieStore): Promise<{ userId: string; role: "admin" } | null>

1. cookieStore에서 리프레시 토큰 원문을 읽는다(REQ-AUTH-008이 정한 쿠키 이름 — cookies.ts의 기존 상수를 import, 새로 선언하지 않음).
2. 원문이 없으면 null.
3. session.ts의 hashRefreshToken(원문)으로 해시한다 — 재구현 안 함.
4. prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } }).
5. 행이 없거나, revokedAt이 설정되어 있거나, expiresAt <= now()이면 null.
6. user.role !== "admin"이면 null.
7. 전부 통과하면 { userId: user.id, role: "admin" }.
```

**이 함수가 회전을 트리거하지 않는 이유**: `/auth/refresh` 라우트(REQ-AUTH-010)는 이 조회 뒤에 새 토큰 발급 + 기존 토큰 무효화를 수행한다. `resolveAdminSession()`은 5번 단계에서 멈춘다 — 쓰기 쿼리가 전혀 없다. 이는 `findOrderForGuest()`(SPEC-ORDER-001)가 게스트 신원을 판정만 하고 아무것도 쓰지 않는 것과 동일한 성격의 읽기 전용 조회다.

**타이밍 공격 표면**: 이 함수는 `RefreshToken.tokenHash`를 정확한 값으로 조회(`findUnique`)하므로 비교 자체가 DB 인덱스 룩업이며, `REQ-AUTH-005`(로그인 실패 사유 은닉)가 다루는 "애플리케이션 레벨 문자열 비교" 타이밍 공격 표면과는 다른 종류다. 이 SPEC은 그 표면을 추가로 다루지 않는다(범위 밖 — DB 조회 자체의 타이밍은 이미 REQ-ADMIN-003이 요구하는 "동일한 거부 응답"으로 충분히 완화된다).

## §3. 관리자 주문 목록/상세 데이터 흐름

`/staff/orders`(page.tsx)는 Server Component로, 요청 시점에 `cookies()`를 읽어 `resolveAdminSession()`을 직접 호출한 뒤 실패하면 `redirect("/staff/login")`, 성공하면 `admin-order-repository.ts`의 `listOrdersForAdmin()`을 **직접 호출**한다(중간에 자기 자신의 API를 fetch하지 않는다 — 서버 컴포넌트가 굳이 네트워크 왕복을 만들 이유가 없다).

`GET /admin/api/orders`는 이 SPEC에서 만들지 않는다 — 이 SPEC의 어떤 REQ-ADMIN-XXX도 이 라우트의 존재를 요구하지 않으며(AC-ADMIN-009의 페이지네이션 검증도 아래 Server-Component 직접 호출만으로 충족된다), M1~M5 어느 마일스톤에도 배정하지 않는다(plan.md §3 "범위 밖" 참조). 향후 `t11` 같은 다른 화면이나 외부 도구가 같은 목록 조회가 필요해지면, 그때 별도 SPEC 또는 이 SPEC의 후속 확장으로 추가한다.

`PATCH /admin/api/orders/[orderId]/status`는 다르다 — 상태 변경 폼은 Client Component(버튼 클릭 인터랙션이 필요하므로)이며, 이 API를 실제로 `fetch`한다. 성공 시 페이지를 `router.refresh()`로 재요청해 서버 컴포넌트가 최신 상태를 다시 읽는다(낙관적 업데이트 없음 — 정합성이 최우선인 도메인에서 상태를 UI가 미리 가정하지 않는다).

## §4. `cancelOrderAsAdmin()` — 재고 복원 로직을 재사용하지 않고 별도 작성한 이유

`payment-repository.ts`의 `markOrderCancelledAndRestoreStock()`은 `where: { status: "paid" }`로 소스 상태가 고정되어 있다(research.md §2). 이 SPEC은 `pending_payment`도 소스로 허용해야 한다(REQ-ADMIN-012). 두 가지 대안을 검토했다:

1. **`payment-repository.ts`의 함수를 확장**해 `fromStatuses: OrderStatus[]` 인자를 받게 수정 — 기각. 그 파일은 `SPEC-PAYMENT-001` 소유이며, 완료된 SPEC의 파일을 수정하는 것은 이 저장소가 반복적으로 지켜온 PRESERVE 원칙과 어긋난다(plan.md §3, PRESERVE 목록). 또한 시그니처를 확장하면 그 함수의 유일한 기존 호출부(`payment-service.ts:273`, `markOrderCancelledAndRestoreStock(tx, queried.payment.orderId)`)도 새 인자를 넘기도록 함께 수정해야 하고, 그 함수를 대상으로 이미 존재하는 완료된 테스트 스위트(`tests/unit/payments/payment-repository.test.ts` — `markOrderCancelledAndRestoreStock` 관련 테스트만 7개 이상)를 다시 통과시켜야 한다 — 감사 로그 기록 자체는 이 함수 안에 있지 않고 호출부(`payment-service.ts`)가 `markOrderCancelledAndRestoreStock` 호출 직후 별도로 수행하므로(REQ-PAYMENT-001의 감사 추적과 무관하게 이미 분리되어 있음) 그 부분을 분기할 필요는 없지만, 위 두 가지(호출부 수정 + 기존 테스트 재검증)만으로도 이미 완료된 SPEC의 소유 파일에 손대는 범위가 발생하며, 이는 정확히 PRESERVE 원칙이 피하려는 작업이다.
2. **`admin-order-repository.ts`에 별도 함수 `cancelOrderAsAdmin()`을 작성**, 재고 복원·쿠폰 해제 로직을 재현 — **채택**. 재고 증가 루프(`tx.product.update({ data: { stock: { increment } } })`)와 쿠폰 해제 호출(`decrementRedeemedCountIfPositive`, `findCouponByCode` — 둘 다 이미 export되어 있으므로 **이 두 함수는 import해 재사용**한다. 복제하는 것은 오직 "루프와 조건부 갱신을 감싸는 껍데기"뿐이다)를 이 파일 안에서 다시 조립한다.

**트레이드오프를 명시적으로 인정한다**: 이 선택은 WET(재고 복원 "루프 껍데기"의 중복)를 받아들이는 대신, 완료된 SPEC의 파일에 손대지 않는 것을 우선한 것이다. 후속 리팩터로 두 함수의 공통 부분(재고 증가 루프 + 쿠폰 해제 호출)을 `src/features/payments/repositories/stock-restore.ts` 같은 공유 유틸로 뽑아낼 수 있으나, 그 리팩터는 `SPEC-PAYMENT-001`이 소유한 파일도 함께 바꾸는 크로스-SPEC 작업이라 이 SPEC의 범위로 포함하지 않는다 — `admin-order-repository.ts`에 `@MX:NOTE`로 이 리팩터 후보를 남긴다.

```ts
// design.md §4 참조 의사코드
export async function cancelOrderAsAdmin(
  tx: PrismaClient,
  orderId: string
): Promise<{ transitioned: boolean }> {
  const updated = await tx.order.updateMany({
    where: { id: orderId, status: { in: ["pending_payment", "paid"] } },
    data: { status: "cancelled" },
  });
  if (updated.count !== 1) return { transitioned: false };

  const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true } });
  for (const item of items) {
    await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
  }

  const order = await tx.order.findUnique({ where: { id: orderId }, select: { couponCode: true } });
  if (order?.couponCode != null) {
    const coupon = await findCouponByCode(order.couponCode, tx); // import, 재구현 안 함
    if (coupon !== null) await decrementRedeemedCountIfPositive(tx, coupon.id); // import, 재구현 안 함
  }

  await tx.paymentAuditLog.create({
    data: {
      orderId,
      source: "ADMIN_ACTION",
      previousStatus: /* updateMany 이전에 읽어둔 상태 */,
      newStatus: "cancelled",
    },
  });

  return { transitioned: true };
}
```

주: `updateMany`의 `where`는 이전 상태를 반환하지 않으므로, 감사 로그의 `previousStatus`를 기록하려면 `updateMany` **이전에** 같은 트랜잭션 안에서 현재 상태를 한 번 읽어야 한다(경쟁 상태를 피하기 위해 그 읽기와 `updateMany`는 같은 트랜잭션 안에 있어야 하고, `updateMany`의 조건부 갱신 자체가 최종 정합성의 권위임을 잊지 않는다 — 읽은 값은 로그용 스냅샷일 뿐, 그 값으로 애플리케이션이 분기 판단을 내리지 않는다. `SPEC-ORDER-002`의 조건부 원자 갱신 원칙과 동일).

## §5. CSRF 방지

`PATCH /admin/api/orders/[orderId]/status`는 쿠키(리프레시 토큰)로 인증되는 상태 변경 요청이므로 `src/lib/auth/csrf.ts`가 이미 제공하는 더블서브밋/synchronizer 헬퍼를 `/auth/refresh`·`/auth/logout`과 동일한 방식으로 적용한다(REQ-ADMIN-016). 새 CSRF 메커니즘을 만들지 않는다.

## §6. 잔여 위험

- `resolveAdminSession()`의 조회가 매 요청마다 DB 왕복 1회를 추가한다(리프레시 토큰 회전과 달리 캐시하지 않음) — 관리자 트래픽 규모(내부 운영자 소수)에서는 무시할 수 있는 비용이라 판단했다. 트래픽이 커지면 짧은 TTL 캐시를 고려할 수 있으나 이 SPEC의 범위가 아니다.
- `admin-order-repository.ts`와 `payment-repository.ts`의 재고 복원 로직 중복(§4)은 향후 두 파일이 갈라질 위험을 안고 있다 — `@MX:NOTE`로 추적.
- 관리자 계정이 애플리케이션 안에 프로비저닝 경로가 없어(research.md §8), 실제 운영 전 별도의 seed 절차가 필요하다 — 이 SPEC의 산출물에는 포함되지 않는다.
