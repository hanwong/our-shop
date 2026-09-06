# SPEC-ADDRESS-001 — 압축 요약

**한 줄 요약**: 로그인한 회원이 배송지를 여러 건 저장하고 `/mypage/addresses`에서 추가·수정·삭제·기본 지정을 할 수 있게 한다. 새 `Address` 모델(`userId` FK, Cascade) + CRUD API 5개 + 회원 전용 페이지 1개.

## 핵심 결정

- **선행 조건**: `SPEC-ORDER-004`가 `spec.md:191`에서 백로그 카드 `t23`의 선행 조건을 "이 SPEC이 해소한다"고 명시했다. 커밋 `f10155d`로 병합 완료.
- **CSRF: 적용.** 저장소에 상충하는 두 선례가 있다 — `POST /api/orders` 회원 분기·`/staff/api/*` 4개·`/api/auth/{refresh,logout}`은 적용, `POST /api/reviews`는 미적용. **의도적으로 적용 쪽을 따른다**(리뷰 미적용은 근거 기록이 없는 공백으로 판단). 누락이 아니라 결정.
- **CSRF 순서: 진짜 1번.** ORDER-004는 게스트 분기 때문에 `resolveSession` → CSRF 순서를 택했다("CSRF는 모든 DB 접근보다 먼저"가 아니라 "상태 변경보다 먼저"). 이 SPEC은 **게스트 분기가 없어** 그 순환이 발생하지 않으므로 CSRF를 문자 그대로 1번에 둔다(`/staff/api/orders/[orderId]/status`와 동형).
- **체크아웃 통합: 범위 밖.** `CheckoutForm`은 props가 `idempotencyKey`/`confirmedTotal`/`couponCode` 3개뿐이고 `checkout/page.tsx:53`이 `resolveSession()`을 장바구니 신원용으로만 써서 회원 여부를 폼에 내려보내지 않는다. 그 통로를 뚫는 것이 별도 SPEC의 본체.
- **경로 `/mypage/addresses`**: AUTH-003 §4가 후속 화면을 "마이페이지 SPEC"이라 명명. 주문 내역 등 형제 경로를 위해 하위 경로로 둔다.
- **`deliveryMemo` 제외**: 배송 메모는 *장소*가 아니라 *배송 건*의 속성 — `Order.deliveryMemo`에 남긴다.
- **`onDelete: Cascade`**: `Review`/`Cart`/`RefreshToken` 분류(회원 편의 데이터). `Order`/`OrderItem`의 `Restrict`(회계 기록)는 적용하지 않는다.
- **`userId`에 `@unique` 없음**: `Cart.userId`의 `@unique`를 복사하면 두 번째 주소가 P2002로 실패. `Order.userId`와 같은 판단 — 인덱스만 따로 선언.
- **기본 배송지 불변식**: 부분 유니크 인덱스 기각(Prisma 미표현 + 전환 중간 상태 차단). `prisma.$transaction`으로 **설정 먼저, 해제 나중** — 순서가 load-bearing(뒤집으면 소유권 실패 시 기존 기본값 상실).
- **소유권**: `findUnique` 후 비교가 아니라 `where: { id, userId }` 조건부 쓰기 + `count === 0 → 404`. TOCTOU 없음, 존재 여부 미노출.
- **로그인 복귀 경로 없음**: `SPEC-AUTH-002` REQ-AUTH-029(Unwanted)가 `redirect`/`next` 파라미터를 금지. `redirect("/login")` 파라미터 없이 호출하고 UX 거칠음을 명시적으로 기록.
- **최초 사례**: 저장소 최초의 고객용 "미로그인 → 리다이렉트" 페이지. 선례는 `staff/products/page.tsx:86-89`(다른 함수·다른 트리)의 기계적 형태만 차용.

## API 표면

`GET /api/addresses` · `POST /api/addresses` · `PATCH|DELETE /api/addresses/[addressId]` · `PATCH /api/addresses/[addressId]/default`

기본 지정을 별도 하위 라우트로 둔 근거: `staff/api/products/[productId]/active/route.ts`의 직접 선례(단일 boolean 전환을 분리 라우트로).

## 파일 (수정 1 + 신규 구현 10 + 신규 테스트 3)

`prisma/schema.prisma`(수정) · `prisma/migrations/<ts>_add_address_model/migration.sql`(손 작성, 앞선 11개와 동일) · `src/features/addresses/{types,repositories,services}/*` · `src/app/api/addresses/**`(3 라우트) · `src/app/(shop)/mypage/addresses/page.tsx` · `src/components/address/{AddressList,AddressForm}.tsx` + 테스트 3.

## REQ/AC

REQ-ADDRESS-001~015 (GEARS, spec.md §2) · AC-ADDRESS-001~015 (Given-When-Then, acceptance.md). Tier M 예산 16/16 이내.

## 의존/관련

- `depends_on`: SPEC-AUTH-002(`resolveSession()`), SPEC-ORDER-004(선행 조건 해소)
- `related_specs`: SPEC-AUTH-003(마이페이지 전방 포인터), SPEC-ORDER-003(카드 t23 이연 기록), SPEC-CART-001(추가 패턴), SPEC-STOREFRONT-002(선행 조건 최초 기록)
- 후속: "체크아웃 배송지 자동 채움 SPEC"(값 복사, FK 아님) · "로그인 복귀 경로 SPEC"(REQ-AUTH-029 개정)

## Tier

M (spec.md + plan.md + acceptance.md; spec-compact.md·progress.md는 Tier와 무관하게 별도 요청됨).
