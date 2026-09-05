# plan.md — SPEC-ORDER-004

## §A. 컨텍스트

`Order`에 회원 소유 차원을 추가하고, `POST /api/orders`의 회원 거부를 제거하며, 신원 해석을 `resolveSession()` 쿠키 방식으로 옮긴다. 개발 방식은 `quality.yaml`의 `development_mode: tdd` — RED-GREEN-REFACTOR.

읽는 순서: `spec.md` §1.4(정찰 정정 세 건) → `design.md` §1.2(Cart와 기수가 다르다) → `research.md` §2(재작성 대상 7건).

**밀스톤은 되돌리기 어려운 결정부터 배치했다.** M1(스키마)과 M2(신원·CSRF)가 이 SPEC에서 가장 바꾸기 힘든 두 결정이고, M7(안내 문구)이 가장 쉽다. 검토 시간을 앞쪽에 쓰는 것이 맞다. 전체 순서는 M1 스키마 → M2 신원·CSRF → M3 저장소 → M4 서비스 → M5 화면 → M6 테스트 재작성 → M7 문구다(§F).

---

## §B. 알려진 위험

### B1. 마이그레이션과 스키마의 불일치를 검사하는 기계가 없다 — 최상위 위험

`prisma validate`는 `schema.prisma`만 본다. `migration.sql`은 CI가 읽지 않는다(`research.md` §1.3). 둘이 어긋나면 실 배포 시점까지 드러나지 않는다.

**완화**: M1의 DoD에 두 파일을 나란히 놓고 컬럼·nullable·인덱스·외래 키를 항목별로 대조하는 단계를 명시한다. 기계 검증이 없으므로 이 대조는 사람이 한다.

### B2. `Cart`의 `@unique`를 그대로 베끼면 두 번째 주문이 실패한다

`Cart.userId`는 `@unique`(회원당 카트 하나), `Order.userId`는 아니다(회원당 주문 여럿). XOR 강제 **방식**은 빌리고 **기수**는 빌리지 않는다(`design.md` §1.2).

**완화**: `@unique` 부재를 검증하는 단언을 스키마 테스트에 명시적으로 넣는다(M1). 사람이 리뷰에서 잡기를 기대하지 않는다.

### B3. `order-service.ts`의 소스 텍스트 정규식 단언이 dispatch 리팩터링에 깨진다

`tests/unit/orders/scope-boundaries.test.ts`의 여섯 단언(`:113`, `:122`, `:123`, `:127`, `:128`, `:134`)이 살아 있는 소스를 정규식으로 읽는다(`research.md` §2.5). 게스트 분기를 헬퍼로 감싸면 깨진다.

**완화**: 명시적 `if` 분기로 쓰고 `findCartByGuestId(guestId, tx)` 호출 형태를 문자열 그대로 유지한다. 이 여섯 단언은 **완화 대상이 아니라 유지 대상**이다 — 실제 트랜잭션 안전 속성을 지키고 있다.

### B4. 멱등성 소유자 대조를 잘못 일반화하면 SPEC-ORDER-001 감사의 F1 결함이 회원 축에서 재발한다

`null === null`이 참이 되는 비교를 만들면 소유자 없는 주문끼리 매치될 수 있다. 판별 유니온 기반 비교(`design.md` §4)가 그 경로를 없앤다.

**완화**: 교차 소유자 케이스를 양방향으로 테스트한다 — 회원이 게스트 주문의 키를 제시, 게스트가 회원 주문의 키를 제시.

### B5. 게스트 경로 회귀가 조용히 일어난다

`createOrder`의 서명이 바뀌므로 게스트 경로도 새 코드를 지난다.

**완화**: 기준선 캡처(`research.md` §3 — 116 파일 / 1526 테스트, 커밋 `6c8b00b`)와 대조한다. 최종 수치가 1526보다 작으면 실패 신호다.

---

## §C. 착수 전 확인

- [ ] `git rev-parse --short HEAD`가 `6c8b00b` 이후 — 기준선 캡처 시점 이후의 트리인가
- [ ] `npx vitest run` 116 파일 / 1526 테스트 전부 통과 — 기준선 재확인
- [ ] `npx prisma validate` 통과
- [ ] `.moai/specs/SPEC-ORDER-004/` 5개 아티팩트 존재
- [ ] plan-audit PASS(≥ 0.85) 및 Implementation Kickoff Approval 완료

---

## §D. PRESERVE 목록 (건드리지 않는 것)

| 경로 | 이유 |
|---|---|
| `src/lib/auth/**` | `resolveSession()`·`verifyCsrfRequest()`·쿠키 헬퍼는 **소비만** 한다. 한 줄도 수정하지 않는다 |
| `src/middleware.ts` | `/checkout`은 보호 라우트가 아니며 되어서도 안 된다 — 회원·게스트 양쪽이 진입해야 한다 |
| `src/features/cart/services/**` | `resolveCartIdentity()` Bearer 분기 유지(REQ-ORDER-054). 장바구니 서비스는 수정 대상이 아니다 |
| `src/app/api/cart/**` | 장바구니 라우트 4곳 전부 불변 |
| `src/features/catalog/**`, `src/app/api/products/**` | 무관 |
| `src/features/payments/**`, 재고 차감 로직, 쿠폰 스냅숏 | SPEC-PAYMENT-001 / ORDER-002 / DISCOUNT-001의 로직 불변 |
| `src/app/(shop)/orders/lookup/**`, `findOrderByNumberForGuest` | SPEC-ORDER-003 재방문 조회 경로 — 이 SPEC의 범위 밖(spec.md §3) |
| `tests/unit/orders/scope-boundaries.test.ts` 의 `:113`/`:122`/`:123`/`:127`/`:128`/`:134` | 여섯 개 트랜잭션 안전 단언은 **통과 유지** 대상 (같은 파일 `:237`은 재작성 대상 — M6) |

`src/features/cart/repositories/cart-repository.ts`는 예외다 — `findCartByUserId` 한 함수의 서명과 그 위 주석만 바꾼다(M3).

---

## §E. 자체 검증

각 밀스톤 종료 시:

```bash
npx prisma validate
npx tsc --noEmit
npx eslint .
npx vitest run --reporter=dot
```

최종:

```bash
npx vitest run --coverage
grep -rn "MEMBER_CHECKOUT_UNSUPPORTED" src tests   # 0건이어야 한다
git diff --stat $(git rev-parse HEAD) -- src/lib/auth src/middleware.ts src/app/api/cart   # 비어 있어야 한다
```

---

## §F. 밀스톤 — 되돌리기 어려운 순서

### M1 — 데이터 모델과 마이그레이션 (가장 되돌리기 어려움)

**바꾸는 것**
- `prisma/schema.prisma`: `Order.guestId`를 `String?`로, `userId String?` + `user User? @relation(..., onDelete: Restrict)` + `@@index([userId])` 추가. `User`에 `orders Order[]` 반대편 선언 추가.
- `prisma/migrations/<YYYYMMDDHHMMSS>_add_order_user_ownership/migration.sql` 신설 — SQL 형태는 `design.md` §2.2 그대로.

**결정**
- `userId`에 `@unique`를 **붙이지 않는다**(B2).
- `onDelete: Restrict` — 주문은 회계 기록이므로 사용자 삭제로 파괴되지 않는다(`design.md` §1.3).
- 기존 게스트 주문 행은 손대지 않는다. `userId`가 `NULL`인 상태가 곧 "게스트 소유"이며 XOR을 위반하지 않는다.

**DoD**
- [ ] `npx prisma validate` 통과
- [ ] `npx prisma generate` 후 `npx tsc --noEmit` 통과
- [ ] **`schema.prisma`와 `migration.sql`을 나란히 놓고 항목별 대조** — 컬럼명, nullable 여부, 인덱스 이름, 외래 키의 `ON DELETE`/`ON UPDATE`. 기계가 검사하지 않으므로 이 대조가 유일한 관문이다(B1)
- [ ] 마이그레이션 헤더 주석에 SPEC ID·추가성·롤백 시 데이터 손실 지점이 적혀 있다

### M2 — 신원 해석과 CSRF (두 번째로 되돌리기 어려움)

**바꾸는 것**
- `src/app/api/orders/route.ts`: 409 회원 거부 블록 삭제. `resolveCartIdentity` import 제거. `resolveSession(cookieStore)`로 회원 판정. 회원 분기에 `verifyCsrfRequest(request)`. 게스트 분기는 `readGuestCartId`/`generateGuestCartId`/`buildGuestCartCookie`로 인라인 구성.
- `src/features/orders/types/order.ts`: `MEMBER_CHECKOUT_UNSUPPORTED` 코드와 그 실패 형태 제거(`:121`, `:145`). `OrderOwner` 판별 유니온 신설.

**순서 (design.md §3.4 — 정확히 이 순서여야 한다)**

```
1. resolveSession(cookieStore)        읽기 전용 DB 조회. CSRF보다 앞서도 안전하다.
2a. 회원이면 → verifyCsrfRequest()    실패 시 403, 본문 파싱 없음, 트랜잭션 없음.
2b. 게스트면 → CSRF 없음              guestId = readGuestCartId() ?? generateGuestCartId()
3. 본문 파싱
4. createOrder(owner, body) → 트랜잭션
```

CSRF를 맨 앞에 두는 것은 **불가능하다**: 회원 경로에만 CSRF를 걸기로 했는데, "회원인가"를 판정하는 `resolveSession()`이 그 자체로 DB 조회이므로 CSRF를 그보다 앞에 두려면 게스트에게도 걸어야 한다(REQ-ORDER-065 위반). 세션 조회는 아무것도 변경하지 않으므로(REQ-AUTH-034) 이 순서가 안전하다. 지켜야 하는 불변식은 "CSRF가 DB보다 먼저"가 아니라 **"CSRF가 변경 동작보다 먼저"**다.

**결정**
- 게스트 경로에는 CSRF를 걸지 않는다 — 게스트 쿠키는 인증이 아니라 식별자이고, 걸면 REQ-ORDER-065를 위반한다(`design.md` §3.3).
- **주문 라우트는 `resolveCartIdentity()`를 호출하지 않는다**(`design.md` §3.2.1). 그 함수는 유효한 Bearer 토큰에 대해 `{kind:"user"}`를 돌려주고 게스트 식별자를 만들지 않으므로, 그것으로는 "유효 Bearer + 세션 없음 → 게스트 주문"을 구현할 수 없다. 게스트 분기를 라우트 안에서 세 줄로 인라인 구성한다.
- `cart-service.ts`는 **수정하지 않는다** — `resolveCartIdentity()`와 그 Bearer 분기는 장바구니 라우트 4곳을 위해 그대로 남는다(REQ-ORDER-054).

**DoD**
- [ ] `grep -rn "MEMBER_CHECKOUT_UNSUPPORTED" src` 0건
- [ ] `grep -n "resolveCartIdentity" src/app/api/orders/route.ts` 0건 — REQ-ORDER-055가 코드 구조로 성립함
- [ ] 회원 세션 쿠키 + CSRF 헤더 요청이 201
- [ ] CSRF 헤더 없는 회원 요청이 403이며 `prisma.$transaction`이 호출되지 않는다
- [ ] **유효한** Bearer 헤더 + 세션 쿠키 없음 요청이 게스트로 처리되고 `userId`가 `null`이다
- [ ] 게스트 쿠키가 없던 요청에 게스트 쿠키가 발급된다 (기존 `:79-82` 동작 보존)

### M3 — 저장소 계층: 두 개의 명시적 소유 경로

**바꾸는 것**
- `src/features/orders/repositories/order-repository.ts`: `CreateOrderRow.guestId: string` → `owner: OrderOwner`. `createOrderWithItems`가 유니온을 두 구체 `data` 형태로 펼친다(`design.md` §1.4). `findOrderForUser(orderId, userId, client = prisma)` 신설.
- `src/features/cart/repositories/cart-repository.ts`: `findCartByUserId`에 선택적 후행 인자 `client: CartClient = prisma` 추가. **`:51-53`의 목록 주석을 갱신**해 세 함수를 반영한다.

**결정**
- 두 소유자를 한꺼번에 받는 단일 경로를 만들지 않는다(REQ-ORDER-058). `createUserCart`/`createGuestCart`가 세운 규율 그대로다.
- `findOrderByIdempotencyKey`는 바꾸지 않는다 — 키로만 찾고 소유자 판정은 서비스가 한다.
- `findCartByUserId`의 인자는 **선택적**이어야 한다. 그래야 `cart-service.ts:93`의 기존 호출자가 안 바뀐다.

**DoD**
- [ ] `git diff` 상 `src/features/cart/` 변경 파일이 `cart-repository.ts` 하나
- [ ] `cart-repository.ts:51-53` 주석이 이제 세 함수를 말한다 — 파일이 자기 자신에 대해 거짓을 말하지 않는다
- [ ] `cart-service.ts` 무변경
- [ ] 두 소유자를 동시에 받는 생성 함수가 존재하지 않음을 단언하는 테스트

### M4 — 주문 서비스: 소유자 dispatch와 멱등성

**바꾸는 것**
- `src/features/orders/services/order-service.ts`: `createOrder(owner: OrderOwner, body)`. 트랜잭션 안에서 소유자별 카트 조회·삭제. 멱등성 대조를 `isSameOwner()`로 교체(두 곳: 빠른 경로, 경합 패자 경로). `getOrderForUser(orderId, userId)` 신설.

**결정 (B3 — 형태 제약)**
- 게스트 분기는 `findCartByGuestId(guestId, tx)` 문자열 형태를 **그대로 유지**한다. 헬퍼로 감싸지 않는다.
- `prisma`는 `$transaction` 외에 쓰지 않는다.
- 교차 소유자 멱등성 충돌은 기존대로 500 무명 응답 — 키 존재 여부를 알려주지 않는다.

**DoD**
- [ ] `tests/unit/orders/scope-boundaries.test.ts`의 여섯 트랜잭션 단언 전부 통과 (`:113`,`:122`,`:123`,`:127`,`:128`,`:134`)
- [ ] 회원/게스트 양방향 교차 소유자 멱등성 테스트 통과
- [ ] `createOrderWithItems`가 받는 `owner`가 회원 경로에서 `kind: "user"`

### M5 — 화면 두 곳

**바꾸는 것**
- `src/app/(shop)/checkout/page.tsx`: `resolveSession(jar)`을 **게스트 쿠키 읽기보다 먼저**. 회원이면 `getCart({ kind: "user", userId })`.
- `src/app/(shop)/checkout/complete/[orderId]/page.tsx`: 같은 분기. 회원이면 `getOrderForUser(orderId, userId)`.

**결정**
- 순서(세션 먼저)는 임의가 아니다 — 반대이면 게스트 쿠키가 남아 있는 회원이 낡은 게스트 카트로 주문서를 연다.
- 모든 거부는 `notFound()`. "권한 없음" 상태를 쓰지 않는다.
- 소유 조건은 `where` 절 안에 둔다 — 결과를 받아서 거르는 형태를 만들지 않는다.

**DoD**
- [ ] 회원 세션으로 `/checkout` 진입 시 회원 카트 상품이 보인다
- [ ] 회원이 자기 주문의 완료 화면을 연다
- [ ] 회원이 남의 주문 id로 완료 화면을 열면 `notFound()`
- [ ] 게스트 경로 두 화면 무변경 동작

### M6 — 기존 테스트 7건 재작성 (가장 기계적)

`research.md` §2의 표를 그대로 따른다. **삭제가 아니라 재작성**이다.

- `tests/unit/api/orders/route.test.ts` 5건 — `submitAsMember()` 헬퍼를 Bearer가 아니라 세션 쿠키 기반으로 다시 쓴다.
- `tests/integration/orders/create-order.test.ts` 1건 — 201 + 저장된 행의 XOR 관측.
- `tests/unit/orders/scope-boundaries.test.ts` 1건(`:237`) — 단언을 뒤집고 `@unique` 부재까지 확인(B2).

**DoD**
- [ ] `describe` 제목이 SPEC-ORDER-004를 참조하도록 갱신
- [ ] 각 재작성 단언이 원래 단언이 지키던 **속성**을 계승한다(예: `:136`의 "게스트로 조용히 강등하지 않는다"는 이제 `findCartByUserId` 호출 + `findCartByGuestId` 미호출로 표현)
- [ ] 전체 스위트 통과, 테스트 수 ≥ 1526

### M7 — 안내 문구

`src/components/checkout/CheckoutUnavailable.tsx`: 범위 고지 문단(`:34-37`) 제거, 첫 문단에서 "게스트" 한정 제거.

**DoD**
- [ ] 컴포넌트 어디에도 "회원 체크아웃은 아직 제공되지 않"는다는 문구가 없다

---

## §G. 안티패턴

- **`Cart`의 `@unique`를 복사한다** — 두 번째 주문이 P2002로 실패한다(B2).
- **`{ guestId?: string; userId?: string }`로 소유자를 표현한다** — "둘 다"와 "둘 다 아님"이 타입상 표현 가능해지고 XOR이 코드 리뷰에 의존하게 된다.
- **소유자 dispatch를 헬퍼로 감싼 뒤 `scope-boundaries` 정규식을 완화한다** — 실제 트랜잭션 안전 속성을 잃는다(B3).
- **멱등성 대조를 `order.userId === owner.userId || order.guestId === owner.guestId`로 쓴다** — `null === null` 경로가 생기고 F1 결함이 재발한다.
- **`resolveCartIdentity()`의 Bearer 분기를 제거한다** — 장바구니 라우트 4곳이 깨진다(spec.md §1.4 정정 1).
- **주문 라우트에서 `resolveCartIdentity()`를 계속 호출하면서 "Bearer는 무시한다"고 적어 둔다** — 그 함수는 유효한 Bearer에 대해 `{kind:"user"}`를 돌려주고 게스트 식별자를 만들지 않으므로, 호출하는 한 REQ-ORDER-055는 구현 불가능하다. 무시는 주석이 아니라 호출 부재로 표현한다(design.md §3.2.1).
- **게스트 경로에도 CSRF를 건다** — 기존 게스트 동작이 깨지고 얻는 것이 없다.
- **CSRF를 세션 해석보다 앞에 둔다** — 회원 판정 전에는 CSRF를 걸어야 할 요청인지 알 수 없으므로, 앞에 두면 게스트에게도 걸리게 되어 위와 같은 위반이 된다(design.md §3.4).
- **회원 분기의 거부를 트랜잭션 콜백 안에서 `return`한다** — Prisma는 반환값에 커밋하므로 부분 주문이 저장된다. `throw new OrderAbort`를 쓴다(`scope-boundaries.test.ts:134`가 잡는다).
- **화면 수정을 건너뛰고 API만 연다** — SPEC-ORDER-001이 이름 붙인 "열어볼 수 없는 회원 주문" 결함을 재현한다(정정 3).
- **회원 주문 조회·마이페이지를 "이왕 하는 김에" 넣는다** — 사용자가 확정한 범위 경계를 넘고 Tier L 예산을 깬다.
- **낡은 단언을 지우고 끝낸다** — 재작성이지 삭제가 아니다. 테스트 수가 줄면 커버리지를 잃은 것이다.

---

## §H. 교차 참조

- `spec.md` §1.1(전제 분할), §1.4(정찰 정정), §3(범위 경계)
- `design.md` §1.2(기수 함정), §3.3(CSRF 위협 분석), §4(멱등성 소유자 대조), §6.3(정규식 제약)
- `research.md` §2(재작성 7건), §3(기준선), §5(브리프 정정)
- `acceptance.md` — AC-ORDER-050 ~ 073
- `SPEC-ORDER-001/spec.md:127`(인계 항목), `:129`(재현하면 안 되는 결함)
- `SPEC-AUTH-003/spec.md` §1.2(읽기/쓰기 분할 표)
