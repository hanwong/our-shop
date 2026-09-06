# SPEC-ADDRESS-001 — 구현 계획

> 마일스톤은 **되돌리기 어려운 결정 순**으로 배열했다. M1(스키마)·M2(API 계약)·M3(트랜잭션 불변식)이 가장 바꾸기 어렵고 검토 가치가 높으며, M5(화면)·M6(테스트 정리)는 기계적이다.

## §A. 맥락

`SPEC-ORDER-004`(커밋 `f10155d`)가 백로그 카드 `t23`의 선행 조건을 해소했다고 스스로 명시했다(`spec.md:191`). 그 위에 `Address` 도메인 하나를 **순수 추가**한다. 기존 테이블의 모양은 하나도 바뀌지 않으며, `User`에 역관계(back-relation) 한 줄만 추가된다 — `Cart`(SPEC-CART-001)·`Review`(SPEC-REVIEW-001)·`Order`(SPEC-ORDER-004)가 모두 따른 추가 패턴과 동일하다.

## §B. 알려진 이슈 / 선행 확인 사항

1. **로컬·CI에 도달 가능한 PostgreSQL이 없다.** `DATABASE_URL`이 루프백 placeholder이고 CI에서 DB 커넥션을 여는 곳이 없다(`.github/workflows/ci.yml`). 따라서 마이그레이션은 **손으로 작성**한다 — 앞선 11개 마이그레이션 전부가 같은 방식이다(§M1).
2. **`/login`에 복귀 경로 파라미터가 없다.** `SPEC-AUTH-002`의 REQ-AUTH-029가 `redirect`/`next` 처리를 **금지**했고, `src/app/(shop)/login/page.tsx`는 성공 시 항상 하드코딩된 `"/"`로 이동한다. 이 SPEC은 그 금지를 존중하며, 그 귀결을 M4에 명시한다.
3. **워크트리 공유 `node_modules` 주의.** 이 카드는 `prisma/schema.prisma`를 건드리므로 Prisma 클라이언트 재생성이 필요하다. 스키마를 만지는 다른 카드가 동시에 돌면 재생성이 경합할 수 있다.

## §C. 사전 점검 (run-phase 착수 시)

- [ ] 회귀 기준선 확보: `npx vitest run` 결과의 파일 수/테스트 수를 착수 **전에** 기록한다(§AC-ADDRESS-015).
- [ ] `npx tsc --noEmit` / `npx eslint .` 착수 전 clean 확인.
- [ ] `git log --oneline -1`로 `f10155d`(SPEC-ORDER-004) 이후 브랜치임을 확인.

## §D. 제약 / PRESERVE 목록

아래 파일은 이 SPEC에서 **한 줄도 바뀌지 않아야** 한다. run-phase 종료 시 `git diff --stat`으로 기계적으로 확인한다(§AC-ADDRESS-014).

```
src/components/checkout/CheckoutForm.tsx
src/app/(shop)/checkout/page.tsx
src/app/(shop)/checkout/complete/[orderId]/page.tsx
src/app/api/orders/route.ts
src/app/(shop)/login/page.tsx
src/components/layout/SiteHeader.tsx
src/lib/auth/session-resolver.ts
src/lib/auth/csrf.ts
```

`session-resolver.ts`와 `csrf.ts`는 **소비만 하고 수정하지 않는다** — 둘 다 다른 SPEC이 소유한 인증 경계다.

---

## §E. 마일스톤

### M1 — `Address` 모델과 손으로 쓴 마이그레이션 (되돌리기 가장 어려움)

**Prisma 모델** (`prisma/schema.prisma`에 추가, `User`에 역관계 한 줄 추가):

```prisma
model Address {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Order의 배송 스냅샷 5개 필드 중 deliveryMemo를 제외한 4개.
  recipientName  String
  recipientPhone String
  postalCode     String
  address        String

  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

**필드 선택 근거 — `deliveryMemo`를 넣지 않는다 (명시적 판단)**. `Order.deliveryMemo`는 nullable이며 주문 건마다 다른 값을 받는다("부재 시 경비실에", "벨 누르지 마세요"). 저장된 주소는 *장소*이고 배송 메모는 *그 배송 건*의 지시사항이므로, 주소에 메모를 얹으면 매번 같은 메모가 따라붙거나 사용자가 매번 지워야 한다. 따라서 `Address`는 장소만 보유하고, 메모는 체크아웃 시점에 `Order`가 계속 받는다(REQ-ADDRESS-002). 후속 "체크아웃 자동 채움" SPEC이 주소를 불러올 때도 메모 칸은 비어 있는 채로 남는다.

**`onDelete: Cascade` 근거**. 스키마 자체가 두 분류를 문서화하고 있다 — `CartItem.product`에 "a cart line has no reason to outlive the product it points at", `Order.user`/`OrderItem.product`에 "an order is an accounting record and must not be destroyed by a user deletion". 주소록은 전자다: 계정이 사라지면 그 계정의 배송지를 보존할 회계·감사상 이유가 없다. `Review`(Cascade)·`Cart`(Cascade)·`RefreshToken`(Cascade)과 같은 줄에 선다.

**`@@index([userId])` 근거**. `userId`에 `@unique`를 걸지 **않는다** — 한 회원이 주소를 여러 개 갖는 것이 이 기능의 전부다. `Cart.userId`의 `@unique`("회원당 장바구니 하나")를 복사하면 두 번째 주소 저장이 P2002로 실패한다. 이는 `Order.userId`가 같은 이유로 `@unique`를 거부하고 인덱스를 따로 선언한 것과 정확히 같은 판단이다.

**마이그레이션** `prisma/migrations/<timestamp>_add_address_model/migration.sql` — 손으로 작성. 헤더 주석은 `20260905140254_add_order_user_ownership/migration.sql`의 형식을 따라 (a) 이 SPEC ID, (b) 손 작성 사유(도달 가능한 Postgres·shadow DB 없음, 앞선 11개 전부 동일), (c) **순수 추가**임을 명시한다: 새 테이블 1개 + 새 인덱스 1개 + 새 FK 1개, 기존 컬럼/제약/행 변경 0.

### M2 — API 계약 (되돌리기 어려움 — 클라이언트가 붙는 표면)

**기저 경로**: `src/app/api/addresses/` — 고객용 API는 `src/app/api/` 아래(`/api/orders`, `/api/reviews` 선례), 관리자용은 `/staff/api/` 아래라는 기존 분리를 따른다.

| 메서드 | 경로 | 동작 | 성공 |
|---|---|---|---|
| `GET` | `/api/addresses` | 내 배송지 목록 | 200 |
| `POST` | `/api/addresses` | 생성 | 201 |
| `PATCH` | `/api/addresses/[addressId]` | 네 개 배송 필드 수정 | 200 |
| `DELETE` | `/api/addresses/[addressId]` | 삭제 | 200 |
| `PATCH` | `/api/addresses/[addressId]/default` | 기본 배송지 지정 | 200 |

**기본 지정을 별도 하위 라우트로 두는 결정 (명시적 선택)**. 대안은 `PATCH /api/addresses/[addressId]`의 본문에 `isDefault: true`를 실어 보내는 것이었다. 별도 라우트를 고른 근거는 **저장소 안의 직접 선례**다: `src/app/staff/api/products/[productId]/active/route.ts`가 정확히 이 모양이다 — 상품의 단일 boolean 상태(`isActive`) 전환을 일반 수정 라우트와 분리된 `/active` 하위 라우트로 뒀다. 기본 지정은 대상 행 하나만 바꾸는 것이 아니라 **다른 행까지 건드리는 트랜잭션**(M3)이므로, 필드 수정과 같은 핸들러에 섞으면 "이 PATCH는 트랜잭션인가 아닌가"가 본문에 따라 달라진다. 라우트를 나누면 그 질문이 사라진다.

**모든 상태 변경 엔드포인트의 연산 순서** (역순 불가):

```
1. verifyCsrfRequest(request)   실패 ⇒ 403, 본문 파싱 없음, DB 접근 없음
2. resolveSession(jar)          null ⇒ 401
3. 본문 파싱 + 검증              실패 ⇒ 400
4. 서비스 호출 (소유권 포함 조건부 쓰기)
```

**왜 여기서는 CSRF가 진짜로 1번인가 — SPEC-ORDER-004의 교훈과 그 교훈의 정확한 적용 범위.** `src/app/api/orders/route.ts:26-35`는 자기 순서가 `resolveSession` → CSRF임을 밝히고 그 이유를 이렇게 적었다:

> CSRF cannot go first. It is scoped to the member path only, so "is this the member path" must be answered first — and answering it IS `resolveSession()`, itself a DB read. The invariant is "CSRF before the STATE-CHANGING operation", not "CSRF before all DB access".

그 SPEC의 plan-audit이 잡아낸 순환은 **"CSRF는 회원 분기에만 적용되는데, 회원 분기인지 알려면 세션을 읽어야 한다"**는 것이었고, 해법은 불변식을 *"모든 DB 접근보다 먼저"*가 아니라 *"상태 변경 연산보다 먼저"*로 정확히 진술하는 것이었다.

**이 SPEC에는 그 순환이 없다.** 주소록 엔드포인트에는 게스트 분기가 존재하지 않는다 — 회원이 아니면 401로 끝이다. 따라서 "회원 분기인가?"라는 선행 질문 자체가 없고, CSRF를 문자 그대로 1번에 둘 수 있다. `/staff/api/orders/[orderId]/status/route.ts:14`가 이미 같은 형태다("CSRF FIRST — before ANY DB access").

두 SPEC이 순서가 다른 것은 불일치가 아니다. **같은 불변식("CSRF는 상태 변경보다 먼저")을 분기 구조가 다른 두 라우트에 적용한 결과**이며, 이 SPEC은 게스트 분기가 없으므로 더 강한 순서를 무료로 얻는다. 이 문단은 그 교훈이 여기서 다시 발견되지 않도록 남긴다.

**실패 응답**: 403·401·404는 본문에 이유를 상술하지 않는다(`{ error: "Forbidden" }` 등) — `/staff/api/orders/[orderId]/status/route.ts`가 세운 "403은 어떤 검사가 실패했는지 말하지 않는다" 규율을 따른다.

### M3 — 소유권 검사와 기본 배송지 트랜잭션 (되돌리기 어려움 — 보안 불변식)

**소유권: 읽고-검사하는 대신 조건부 쓰기.** IDOR 방지를 위해 `findUnique(id)` 후 `row.userId === session.userId`를 검사하는 형태를 **쓰지 않는다**. 대신 세션의 `userId`를 `where` 절에 넣어 데이터베이스가 걸러내게 한다:

```ts
// 수정 / 삭제 / 기본 지정 — 전부 동일한 형태
const { count } = await prisma.address.updateMany({
  where: { id: addressId, userId },   // 소유권이 where 절 안에 있다
  data: { ... },
});
if (count === 0) return notFound();   // 없거나 남의 것이거나 — 구별하지 않는다
```

두 가지를 동시에 얻는다: (a) 읽고-검사 사이의 TOCTOU 창이 없고, (b) 남의 행은 **읽히지도 않으므로** 존재 여부가 응답 지연이나 오류 형태로 새지 않는다. `count === 0`을 404로 매핑하는 것이 REQ-ADDRESS-011이 요구하는 "403과 404로 구별해 노출하지 않는다"를 자동으로 만족시킨다.

**기본 배송지 트랜잭션.** "회원당 `isDefault === true`는 최대 한 개"(REQ-ADDRESS-003)를 DB 부분 유니크 인덱스(`CREATE UNIQUE INDEX ... WHERE "isDefault"`)로 표현하는 길은 **택하지 않는다** — Prisma 스키마 언어가 부분 인덱스를 표현하지 못해 raw SQL 마이그레이션과 스키마 사이에 영구적 불일치가 생기고, 그 제약은 "먼저 해제 후 설정" 순서에서 중간 상태를 허용하지 않아 오히려 정상 전환을 막는다.

대신 **애플리케이션 레벨 트랜잭션**으로 지킨다. 이는 이 저장소가 자기 불변식을 지킬 때 이미 쓰는 관용구다 — `order-service.ts`의 단일 트랜잭션, `coupon-repository.ts`의 조건부 원자적 `updateMany`가 같은 계열이다.

정확한 모양:

```ts
// address-repository.ts
export async function setDefault(userId: string, addressId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // 1. 대상이 내 것인지 확인 + 설정을 한 번에. 남의 것이면 count 0.
    const { count } = await tx.address.updateMany({
      where: { id: addressId, userId },
      data: { isDefault: true },
    });
    if (count === 0) return false;

    // 2. 같은 회원의 "대상이 아닌" 기존 기본값들을 내린다.
    //    updateMany는 조건에 맞는 행이 없으면 조용히 0건 — 첫 지정 시에도 안전하다.
    await tx.address.updateMany({
      where: { userId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    });
    return true;
  });
}
```

**순서가 load-bearing이다**: 해제를 먼저 하면 소유권 검사(1번)가 실패했을 때 이미 회원의 기본 배송지를 잃은 상태가 된다. 설정을 먼저 두면 그 창이 없다 — 소유권이 없을 때 **첫 번째 `updateMany`가 0건을 매치하므로 아무것도 바뀌지 않은 채로** 두 번째 `updateMany`에 도달하기 전에 `false`로 빠져나온다.

**안전 장치는 롤백이 아니다 (혼동 주의).** 위 코드는 `if (count === 0) return false`로 **정상 반환**하며, Prisma의 인터랙티브 트랜잭션은 반환 시 커밋하고 **throw할 때만** 롤백한다. 즉 소유권 실패 시 데이터가 보존되는 이유는 "롤백이 되돌려서"가 아니라 **애초에 어떤 행도 변경되지 않았기 때문**이다. 이 구분은 실무적으로 중요하다: "롤백으로 지켜진다"고 읽은 구현자가 대칭성을 맞추려 `throw`를 넣으면, 깔끔한 404가 500으로 바뀐다. 소유권 실패는 예외가 아니라 **예상된 결과**이므로 반환으로 표현한다.

**생성 시 첫 주소 자동 기본 지정**(REQ-ADDRESS-004)도 같은 트랜잭션 안에서 처리한다: `count()`가 0이면 `isDefault: true`로 생성. 두 요청이 동시에 첫 주소를 만들면 둘 다 `true`가 될 수 있으므로, 이 경합은 **AC로 검증하지 않고 잔여 위험으로 기록**한다(§AC 없음, `progress.md` 잔여 위험) — 한 사용자가 자기 브라우저 두 개로 동시에 첫 주소를 저장하는 시나리오이며, 결과는 "기본 배송지가 두 개로 보인다"이지 데이터 손상이나 권한 이탈이 아니다. 완전한 방어는 부분 유니크 인덱스를 요구하는데 위에서 기각했다.

**삭제 시 기본 배송지가 사라지는 경우**: 승계하지 않는다. 남은 주소 중 하나를 자동으로 기본으로 올리지 않으며, 회원이 명시적으로 지정할 때까지 기본 배송지가 없는 상태를 허용한다(REQ-ADDRESS-003은 "최대 한 개"이지 "정확히 한 개"가 아니다).

### M4 — 페이지 게이트 (되돌리기 중간 — 사용자 동선)

`src/app/(shop)/mypage/addresses/page.tsx` (서버 컴포넌트):

```
1. const jar = await cookies();
2. const session = await resolveSession(jar);
3. if (session === null) redirect("/login");   // 데이터 읽기 전에
4. const addresses = await listAddresses(session.userId);
5. 목록 + 조작 UI 렌더링
```

**게이트가 데이터 읽기보다 먼저**인 것은 `src/app/staff/products/page.tsx:84-89`가 세운 형태다 — 인용한 주석 "The gate runs first: data must not be read and then discarded"는 `:84`에 있고, 그 주석이 설명하는 게이트 코드(`resolveAdminSession` → `null` → `redirect`)는 `:86-89`에 있다. 그 파일은 `resolveAdminSession()`을 쓰는 **다른 함수·다른 라우트 트리**이므로 고객용 선례가 아니다 — 옮겨 오는 것은 기계적 형태뿐이다(spec.md §1.3).

**복귀 경로가 없다는 귀결을 명시한다.** `redirect("/login")`은 **파라미터 없이** 호출한다. `redirect("/login?next=/mypage/addresses")`를 쓰지 않는 이유는 `SPEC-AUTH-002`의 REQ-AUTH-029(Unwanted)가 로그인 화면의 `redirect`/`next` 처리를 금지했고, 실제로 `login/page.tsx`가 성공 시 항상 `router.push("/")`를 하기 때문이다. 파라미터를 붙여도 **로그인 화면이 무시하므로 아무 효과가 없고**, 효과를 내려면 완료된 다른 SPEC의 REQ를 뒤집어야 한다.

따라서 이 SPEC이 만드는 동선은 "미로그인 → `/login` → 로그인 성공 → `/`"이며, 회원은 주소록으로 **다시 직접 이동**해야 한다. 이는 알려진 UX 거칠음이며, 해소는 "로그인 복귀 경로 SPEC"(ID 미정)이 REQ-AUTH-029를 개정하면서 소유한다. 이 SPEC에서 조용히 우회하지 않는다.

`(shop)` 라우트 그룹 아래에 두어 공통 `SiteHeader`를 상속한다 — `cart`·`checkout`·`orders`·`login`·`signup`이 모두 그 그룹 안에 있다.

### M5 — 화면 컴포넌트 (기계적)

- `src/features/addresses/types/address.ts` — DTO 타입.
- `src/features/addresses/repositories/address-repository.ts` — M3의 조건부 쓰기.
- `src/features/addresses/services/address-service.ts` — 검증 + 실패 객체 매핑.
- `src/components/address/AddressList.tsx` — 목록 + 기본 배지 (서버에서 데이터 받음).
- `src/components/address/AddressForm.tsx` — `"use client"`, 추가/수정 폼. `fetch`는 자기 submit 핸들러 안에만 둔다(`ReviewForm.tsx`/`AddToCartButton.tsx` 관용구).
- 클라이언트 요청은 `x-csrf-token` 헤더에 `csrf_token` 쿠키 값을 실어 보낸다 — 기존 회원 쓰기 클라이언트와 동일한 double-submit 형태.
- 리뷰 본문과 마찬가지로 주소 문자열은 **평범한 JSX 텍스트로만** 렌더링하며 `dangerouslySetInnerHTML`을 쓰지 않는다.

### M6 — 테스트와 회귀 확인 (기계적)

- `tests/unit/features/addresses/address-service.test.ts` — 검증·소유권·기본 지정 로직(mock 기반).
- `tests/unit/app/api/addresses/route.test.ts` — CSRF 403 / 401 / 400 / 201 순서 검증.
- `tests/unit/app/mypage-addresses-page.test.tsx` — 리다이렉트 + 목록 렌더링.
- 회귀: 착수 전 기준선과 착수 후 `npx vitest run` 결과를 대조하고, §D PRESERVE 목록에 `git diff --stat`을 건다.

---

## §F. 신규/수정 파일 목록

**수정 (1)**: `prisma/schema.prisma`(Address 모델 + User 역관계 1줄).

**신규 구현 (10)**: `prisma/migrations/<ts>_add_address_model/migration.sql`(1) · `src/features/addresses/{types,repositories,services}/*`(3) · `src/app/api/addresses/route.ts`(1) · `src/app/api/addresses/[addressId]/route.ts`(1) · `src/app/api/addresses/[addressId]/default/route.ts`(1) · `src/app/(shop)/mypage/addresses/page.tsx`(1) · `src/components/address/{AddressList,AddressForm}.tsx`(2).

**신규 테스트 (3)**: §M6의 세 파일.

합계: 수정 1 + 신규 13(구현 10 + 테스트 3).

## §G. 안티패턴 (하지 말 것)

- `findUnique(id)` 후 `userId`를 애플리케이션에서 비교하는 소유권 검사 — M3가 기각했다.
- `CREATE UNIQUE INDEX ... WHERE "isDefault"` raw SQL — M3가 기각했다.
- `redirect("/login?next=...")` — M4가 기각했다(REQ-ADDRESS-015).
- 체크아웃 파일을 "겸사겸사" 수정 — §D PRESERVE.
- `Cart.userId`의 `@unique`를 `Address.userId`에 복사 — M1이 기각했다.

## §H. @MX 태그 계획

| 대상 | 태그 | 사유 |
|---|---|---|
| `Address` 모델 (schema.prisma) | `@MX:ANCHOR` + `@MX:REASON` | 모든 주소 읽기·쓰기가 이 모델에 모인다. `userId` 귀속은 인가 경계이므로 nullability/uniqueness 변경은 모델링 세부가 아니라 보안 경계 변경이다. |
| `address-repository.ts` `setDefault()` | `@MX:WARN` | 트랜잭션 안 두 `updateMany`의 **순서가 load-bearing**이다(설정 먼저, 해제 나중). 뒤집으면 소유권 실패 시 기존 기본값을 잃는다. |
| `address-repository.ts` 조건부 쓰기 3곳 | `@MX:ANCHOR` | `where` 절의 `userId`가 유일한 인가 수단이다. 빠지면 즉시 IDOR. |
| 첫 주소 자동 기본 지정 경로 | `@MX:TODO` | 동시 첫-주소 생성 경합은 테스트되지 않는다(M3 잔여 위험). |
| `mypage/addresses/page.tsx` | `@MX:NOTE` | 저장소 최초의 고객용 리다이렉트 게이트. 복귀 경로가 없는 것은 REQ-AUTH-029에 따른 의도다. |
