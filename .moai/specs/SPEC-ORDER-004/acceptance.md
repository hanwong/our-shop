# acceptance.md — SPEC-ORDER-004

24개 기준(AC-ORDER-050 ~ 073), Tier L 상한 25 이내. 모든 기준은 이진 판정 가능하다.

---

## §A. 요구사항 ↔ 기준 대응

| 요구사항 | 기준 |
|---|---|
| REQ-ORDER-046 (`userId` 컬럼·관계·인덱스) | AC-ORDER-050 |
| REQ-ORDER-047 (`guestId` nullable) | AC-ORDER-051 |
| REQ-ORDER-048 (XOR 불변식) | AC-ORDER-052 |
| REQ-ORDER-049 (비파괴 마이그레이션) | AC-ORDER-053 |
| REQ-ORDER-050 (쓰기 경로가 반대편을 null로 둔다) | AC-ORDER-052 |
| REQ-ORDER-051 (`resolveSession()`로 해석) | AC-ORDER-054 |
| REQ-ORDER-052 (회원 귀속) | AC-ORDER-055 |
| REQ-ORDER-053 (세션 없으면 게스트 경로) | AC-ORDER-056 |
| REQ-ORDER-054 (Bearer 분기 유지) | AC-ORDER-058 |
| REQ-ORDER-055 (`Authorization`은 회원 근거가 아니다) | AC-ORDER-057 |
| REQ-ORDER-056 (409 제거) | AC-ORDER-059 |
| REQ-ORDER-057 (회원 카트를 트랜잭션 안에서) | AC-ORDER-060 |
| REQ-ORDER-058 (두 개의 명시적 생성 경로) | AC-ORDER-061 |
| REQ-ORDER-059 (소유자 종류별 멱등성 대조) | AC-ORDER-062 |
| REQ-ORDER-060 (남의 주문을 재전송 응답으로 주지 않는다) | AC-ORDER-063 |
| REQ-ORDER-061 (회원 주문서 진입) | AC-ORDER-064, AC-ORDER-065 |
| REQ-ORDER-062 (회원 완료 화면) | AC-ORDER-066, AC-ORDER-067 |
| REQ-ORDER-063 (안내 문구 갱신) | AC-ORDER-068 |
| REQ-ORDER-064 (회원 경로 CSRF) | AC-ORDER-069, AC-ORDER-070 |
| REQ-ORDER-065 (게스트 무회귀) | AC-ORDER-071, AC-ORDER-072 |
| — (범위 경계 검증) | AC-ORDER-073 |

모든 REQ가 최소 하나의 AC에 대응하며, 대응 없는 AC는 AC-ORDER-073 하나다(범위 경계는 요구사항이 아니라 제외 항목의 검증이므로 의도적이다).

---

## §B. 데이터 모델

### AC-ORDER-050 — `Order`의 회원 소유 컬럼

**Given** `prisma/schema.prisma`가 있고
**When** `Order` 모델 블록을 읽으면
**Then** `userId String?`와 `user User? @relation(fields: [userId], references: [id], onDelete: Restrict)`와 `@@index([userId])`가 존재하고, `User` 모델에 `orders Order[]`가 존재하며, **`userId`에 `@unique`가 붙어 있지 않다**.

`@unique` 부재는 별도 단언으로 명시한다 — `Cart`에서 복사해 오는 실수를 사람 리뷰가 아니라 기계가 잡아야 한다(plan.md B2).

### AC-ORDER-051 — `guestId`의 NOT NULL 해제

**Given** `prisma/schema.prisma`와 새 `migration.sql`이 있고
**When** 둘을 읽으면
**Then** 스키마의 `Order.guestId`가 `String?`이고, 마이그레이션에 `ALTER TABLE "Order" ALTER COLUMN "guestId" DROP NOT NULL;`이 있다.

### AC-ORDER-052 — XOR 불변식이 쓰기 경로에서 강제된다

**Given** 주문 저장소의 생성 함수가 판별 유니온 소유자를 받고
**When** 회원 소유자로 주문을 만들면
**Then** 저장된 행은 `userId`가 채워지고 `guestId`가 `null`이며,
**And When** 게스트 소유자로 주문을 만들면
**Then** 저장된 행은 `guestId`가 채워지고 `userId`가 `null`이고,
**And** 두 소유자를 동시에 지정하거나 둘 다 생략하는 호출 형태가 **타입 수준에서 표현 불가능하다**(컴파일 실패 또는 그런 시그니처의 부재로 확인).

### AC-ORDER-053 — 마이그레이션이 비파괴적이다

**Given** 새 `migration.sql`이 있고
**When** 그 내용을 읽으면
**Then** `DROP COLUMN`·`DELETE`·`TRUNCATE`·`UPDATE` 구문이 하나도 없고, 동작은 `ALTER COLUMN ... DROP NOT NULL` / `ADD COLUMN` / `CREATE INDEX` / `ADD CONSTRAINT` 넷뿐이며, 헤더 주석이 SPEC ID와 롤백 시 데이터 손실 지점을 명시한다.

---

## §C. 신원 해석

### AC-ORDER-054 — `resolveSession()`이 회원 신원의 출처다

**Given** 유효한 `refresh_token` 쿠키를 가진 요청이
**When** `POST /api/orders`에 도착하면
**Then** 라우트가 `resolveSession()`을 호출해 회원 여부를 판정하고, 그 결과가 주문 소유자 결정에 쓰인다.

### AC-ORDER-055 — 회원 제출이 201로 성공한다

**Given** 상품이 담긴 회원 장바구니와 유효한 회원 세션 쿠키와 유효한 CSRF 토큰이 있고
**When** `POST /api/orders`에 유효한 배송 정보를 제출하면
**Then** 응답이 `201`이고, 저장된 주문 행의 `userId`가 그 회원의 id이며 `guestId`가 `null`이고, 응답 본문이 생성된 주문을 담는다.

### AC-ORDER-056 — 세션이 없으면 게스트 경로로 처리된다

**Given** 회원 세션 쿠키가 없고 게스트 쿠키만 있는 요청이
**When** `POST /api/orders`에 도착하면
**Then** 응답과 저장 결과가 이 SPEC 이전과 동일하며, `userId`가 `null`이고 `guestId`가 채워진다.

세션 해석 실패의 네 사유(쿠키 부재·불일치·폐기·만료)는 전부 같은 결과를 낸다 — `resolveSession()`이 전부 `null`로 붕괴시키므로 호출자가 구별하지 않는다.

### AC-ORDER-057 — `Authorization` 헤더는 회원 근거가 아니다

**Given** **유효한** `Authorization: Bearer <JWT>` 헤더는 있으나 회원 세션 쿠키가 없는 요청이
**When** `POST /api/orders`에 도착하면
**Then** 그 요청은 회원으로 인식되지 않고 게스트로 처리되며, 생성되는 주문의 `userId`가 `null`이고 `guestId`가 채워진다.

**And (구조적 확인)** `grep -n "resolveCartIdentity" src/app/api/orders/route.ts`가 **0건**이다.

이 두 번째 조건이 첫 번째를 실제로 가능하게 만든다. `resolveCartIdentity()`는 **유효한** Bearer 토큰에 대해 `{kind:"user", userId}`를 반환하고 게스트 식별자를 만들지 않으므로(`cart-service.ts:69-76`), 그 함수를 거치는 한 이 AC는 충족될 수 없다. 라우트는 그것을 호출하지 않고, `resolveSession()`이 `null`이면 헤더와 무관하게 `readGuestCartId()` / `generateGuestCartId()`로 게스트 신원을 직접 구성한다(design.md §3.2.1).

### AC-ORDER-058 — 장바구니 도메인의 Bearer 분기가 그대로 살아 있다

**Given** 구현 완료 트리에서
**When** `src/features/cart/services/cart-service.ts`와 `src/app/api/cart/**`의 diff를 확인하면
**Then** 변경 라인이 0이고, `resolveCartIdentity()`의 `identity.kind === "user"` 분기가 존재하며, 장바구니 API의 회원 경로 테스트가 전부 통과한다.

### AC-ORDER-059 — 거부 코드가 저장소에서 사라졌다

**Given** 구현 완료 트리에서
**When** `grep -rn "MEMBER_CHECKOUT_UNSUPPORTED" src tests`를 실행하면
**Then** 결과가 0건이다.

---

## §D. 주문 생성

### AC-ORDER-060 — 회원 카트를 트랜잭션 안에서 읽고 비운다

**Given** 회원 주문 생성이 진행 중이고
**When** 트랜잭션 콜백이 실행되면
**Then** `findCartByUserId`가 트랜잭션 클라이언트를 인자로 받아 호출되고, `deleteCart`도 같은 클라이언트로 호출되며, `order-service.ts` 안에서 `prisma`는 `$transaction` 외의 어떤 멤버로도 쓰이지 않고, 회원 분기의 거부가 `throw new OrderAbort`로 나온다(`return`이 아니다 — 반환하면 Prisma가 커밋한다).

`tests/unit/orders/scope-boundaries.test.ts`의 **여섯** 단언(`:113`, `:122`, `:123`, `:127`, `:128`, `:134`)이 **계속 통과하는 것**으로 확인한다. 이 여섯은 재작성 대상이 아니다 — 같은 파일에서 재작성되는 것은 `:237` 하나뿐이다(AC-ORDER-072).

### AC-ORDER-061 — 두 개의 명시적 생성 경로

**Given** `order-repository.ts`가 있고
**When** 주문 생성 함수의 시그니처를 읽으면
**Then** 소유자가 판별 유니온으로 전달되고, 저장소가 그것을 두 개의 구체적 `data` 형태로 펼치며, `{ guestId?, userId? }` 형태의 선택적 두 필드를 받는 함수가 존재하지 않는다.

### AC-ORDER-062 — 멱등성 재전송이 소유자 종류로 대조된다

**AC-ORDER-062a (회원)**: **Given** 회원 A가 키 `K`로 주문을 만들었고 **When** 회원 A가 같은 `K`로 다시 제출하면 **Then** 응답이 `201`이고 본문이 **첫 주문 그대로**이며, 새 주문이 생기지 않고 재고가 다시 차감되지 않는다.

**AC-ORDER-062b (게스트)**: **Given** 게스트 G가 키 `K`로 주문을 만들었고 **When** 게스트 G가 같은 `K`로 다시 제출하면 **Then** 이 SPEC 이전과 동일하게 첫 주문이 반환된다.

### AC-ORDER-063 — 교차 소유자 재전송이 거부된다

**Given** 게스트 G가 소유한 키 `K`로 만들어진 주문이 있고
**When** 회원 A가 같은 `K`로 제출하면
**Then** 응답이 G의 주문을 담지 않고,
**And Given** 회원 A가 소유한 키 `K2`의 주문이 있고
**When** 게스트 G가 `K2`로 제출하면
**Then** 응답이 A의 주문을 담지 않으며, 두 경우 모두 키의 존재 여부를 드러내지 않는다(기존 500 무명 응답 형태 유지).

양방향을 모두 확인한다 — 한 방향만 막으면 `null === null` 비교가 남아 있어도 통과할 수 있다.

---

## §E. 화면

### AC-ORDER-064 — 회원이 주문서를 연다

**Given** 상품이 담긴 회원 장바구니와 유효한 회원 세션이 있고
**When** 방문자가 `/checkout`을 열면
**Then** `CheckoutUnavailable` 대신 주문 입력 양식이 렌더링되고, 표시되는 상품과 금액이 그 회원의 장바구니에서 온다.

### AC-ORDER-065 — 세션 해석이 게스트 쿠키 읽기보다 먼저다

**Given** 유효한 회원 세션 쿠키와 (어떤 이유로든 남아 있는) 게스트 쿠키를 **둘 다** 제시하는 요청이
**When** `/checkout`을 렌더링하면
**Then** 회원 장바구니가 표시되고 게스트 장바구니는 조회되지 않는다.

### AC-ORDER-066 — 회원이 자기 주문의 완료 화면을 연다

**Given** 회원 A가 방금 만든 주문이 있고
**When** 회원 A가 `/checkout/complete/<orderId>`를 열면
**Then** 그 주문이 표시된다.

이 기준이 이 SPEC의 존재 이유 중 하나다 — 이것이 실패하면 SPEC-ORDER-001이 이름 붙인 "회원이 열어볼 수 없는 회원 주문" 결함을 그대로 만든 것이다(`SPEC-ORDER-001/spec.md:129`).

### AC-ORDER-067 — 남의 주문은 열리지 않는다

**Given** 회원 B가 소유한 주문의 id를 알고 있는 회원 A가
**When** 그 id로 완료 화면을 열면
**Then** `notFound()` 결과가 나오고, "권한 없음"을 뜻하는 응답이 아니며, 주문의 존재 여부가 드러나지 않는다.

**And** 게스트 소유 주문을 회원 세션으로 여는 경우, 회원 소유 주문을 게스트 쿠키로 여는 경우 모두 같은 결과다.

### AC-ORDER-068 — 안내 문구가 갱신되었다

**Given** `src/components/checkout/CheckoutUnavailable.tsx`가 있고
**When** 렌더 결과 텍스트를 읽으면
**Then** "회원 체크아웃은 아직 제공되지 않"는다는 취지의 문장이 없고, 남은 안내가 회원·게스트 양쪽에서 참인 서술("이 요청에 연결된 장바구니를 찾을 수 없습니다")이다.

---

## §F. 보안

### AC-ORDER-069 — 회원 경로가 CSRF 검증을 먼저 통과한다

**Given** 유효한 회원 세션 쿠키는 있으나 `X-CSRF-Token` 헤더가 없거나 `csrf_token` 쿠키와 불일치하는 요청이
**When** `POST /api/orders`에 도착하면
**Then** 응답이 `403`이고, `prisma.$transaction`이 호출되지 않으며, 본문이 파싱되지 않고, 주문·재고·장바구니가 전부 그대로다.

**순서에 대한 주의**: 이 AC는 "CSRF가 모든 DB 접근보다 먼저"를 요구하지 **않는다**. 회원 판정을 하는 `resolveSession()`이 그 자체로 DB 조회이므로, 회원 경로에만 CSRF를 거는 한 세션 조회가 먼저 일어나는 것은 불가피하고 안전하다(읽기 전용, REQ-AUTH-034). 검증 대상은 **CSRF가 변경 동작보다 먼저**라는 것이며, `prisma.$transaction` 미호출로 확인한다. 근거는 design.md §3.4.

### AC-ORDER-070 — 게스트 경로에는 CSRF를 걸지 않는다

**Given** 게스트 쿠키만 있고 CSRF 헤더가 없는 요청이
**When** `POST /api/orders`에 유효한 주문을 제출하면
**Then** 응답이 `201`이다 — 게스트 신원은 인증이 아니라 식별자이므로 이 경로의 동작은 이 SPEC 이전과 같다.

---

## §G. 회귀 방지

### AC-ORDER-071 — 게스트 경로 동작이 관측 가능하게 동일하다

**Given** 이 SPEC 이전과 동일한 게스트 요청 시퀀스를
**When** 구현 완료 트리에서 실행하면
**Then** 응답 코드·응답 본문 형태·게스트 쿠키 발급 동작·저장된 행의 필드값이 전부 동일하고, 저장된 행은 `guestId` 채워짐 / `userId` `null`이다.

### AC-ORDER-072 — 전체 스위트가 기준선 이상이다

**Given** 기준선이 **116개 파일 / 1526개 테스트 전부 통과**(커밋 `6c8b00b`, 2026-09-05, `npx vitest run --reporter=dot`)이고
**When** 구현 완료 후 같은 명령을 실행하면
**Then** 실패가 0건이고 테스트 수가 **1526 이상**이다.

수치가 1526보다 작으면 재작성 과정에서 단언을 옮긴 것이 아니라 잃은 것이며, 그 자체가 실패다.

**And** 재작성 대상 3개 파일 7건이 전부 **존재하되 새 동작을 검증**한다 — `tests/unit/api/orders/route.test.ts`(5건), `tests/integration/orders/create-order.test.ts`(1건), `tests/unit/orders/scope-boundaries.test.ts`(1건, `:237`). 삭제된 `it` 블록이 없다.

**And** `git diff --stat`으로 `src/lib/auth/`·`src/middleware.ts`·`src/app/api/cart/`·`src/features/cart/services/`의 변경 라인이 0이고, `src/features/cart/` 아래 변경 파일이 `cart-repository.ts` 하나다.

**And** `npx prisma validate`·`npx tsc --noEmit`·`npx eslint .`가 전부 통과하고, 커버리지가 85%/80% 기준을 유지한다.

---

## §H. 범위 경계

### AC-ORDER-073 — 제외 항목이 실제로 구현되지 않았다

**Given** 구현 완료 트리에서
**When** 범위 밖 항목을 확인하면
**Then** 다음이 전부 참이다.

- **SPEC-ORDER-003 무변경**: `findOrderByNumberForGuest`의 시그니처와 동작, `src/app/(shop)/orders/lookup/**`의 변경 라인이 0이다.
- **회원 주문 조회 미구현**: 회원 세션으로 주문 **목록**을 반환하는 API·화면이 존재하지 않고, `findOrderByNumberForUser` 류의 회원 재방문 조회 함수가 존재하지 않는다.
- **주소록 미구현**: `Address` 모델이 없고, `src/app/` 아래 `account`·`mypage`·`profile` 계열 디렉터리가 없다.
- **구매 인증 배지 미구현**: 리뷰 작성 권한 판정이 여전히 로그인 여부로만 이루어지며, 구매 이력을 조회하지 않는다.
- **게스트→회원 주문 승계 미구현**: 기존 주문의 `guestId`를 `userId`로 옮기는 경로가 존재하지 않는다.

`findOrderForUser`는 이 목록에 해당하지 않는다 — 그것은 **생성 흐름의 완료 화면**이 쓰는 단건 소유권 조회이며(AC-ORDER-066), 재방문 조회나 목록 조회가 아니다.

---

## §I. Definition of Done

- [ ] AC-ORDER-050 ~ 073 전부 PASS
- [ ] `npx prisma validate` / `npx tsc --noEmit` / `npx eslint .` 통과
- [ ] `npx vitest run` 실패 0건, 테스트 수 ≥ 1526
- [ ] `grep -rn "MEMBER_CHECKOUT_UNSUPPORTED" src tests` 0건
- [ ] `schema.prisma`와 `migration.sql` 항목별 대조 완료 (기계 검증이 없는 유일한 관문)
- [ ] `cart-repository.ts:51-53` 주석이 세 함수를 반영하도록 갱신됨
- [ ] plan.md §D PRESERVE 목록 `git diff --stat`으로 미변경 확인
- [ ] 커버리지 85%/80% 기준 유지
