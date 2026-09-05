---
id: SPEC-ORDER-004
title: "회원(로그인) 체크아웃 지원 — Order 회원 귀속과 쿠키 세션 기반 주문 생성"
version: "0.1.0"
status: in-progress
created: 2026-09-05
updated: 2026-09-05
author: snake
priority: P1
phase: "v0.2.0 target"
module: "src/features/orders"
lifecycle: spec-anchored
tags: "order, checkout, member, session, prisma, migration, xor-ownership, csrf"
tier: L
depends_on: [SPEC-ORDER-001, SPEC-AUTH-002, SPEC-AUTH-003, SPEC-CART-001]
related_specs: [SPEC-ORDER-003, SPEC-REVIEW-001, SPEC-STOREFRONT-002, SPEC-PAYMENT-001, SPEC-DISCOUNT-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-05 | 0.1.0 | draft | plan-phase 최초 작성. SPEC-ORDER-001 §3이 "후속 SPEC이 받아 갈 것"으로 넘긴 세 항목 중 (a)(b)를 인수한다. 착수 전 사용자가 AskUserQuestion으로 세 가지 범위 결정(신원 해석 메커니즘 = `resolveSession()` 쿠키 방식, 스키마 형태 = 평문 nullable `userId` + `@@index`, 범위 경계 = 주문 **생성**만)을 확정한 상태로 위임되었다. 위임 브리프의 정찰 내용을 실제 코드와 대조한 결과 **세 건의 정정**이 나왔고 §1.4에 전부 기록했다. |

---

## §1. 개요

로그인한 회원이 자기 계정에 귀속되는 주문을 만들 수 있게 한다. `Order` 모델에 회원 소유 차원(`userId`)을 신설하고, `POST /api/orders`가 회원 요청을 거부하던 409 분기를 제거하며, 신원 해석을 `resolveSession()` 쿠키 방식으로 옮긴다.

이 SPEC은 **SPEC-ORDER-001 §3이 명시적으로 후속 SPEC에 넘긴 작업**을 인수한다. 그 절의 문장은 이렇다.

> **후속 SPEC이 받아 갈 것**: 회원 체크아웃 SPEC은 (a) 서버 렌더 화면이 회원을 식별하는 전송 수단을 SPEC-AUTH-001과 **함께** 재설계하고, (b) `Order`에 회원 귀속 컬럼을 추가하는 마이그레이션을 소유하며, (c) 로그인 시 만료되는 게스트 쿠키와 진행 중인 체크아웃의 관계를 정의한다.
>
> — `.moai/specs/SPEC-ORDER-001/spec.md:127`

(a)는 **이미 해소되었다**(§1.1). 이 SPEC이 실제로 하는 일은 (b)와 (c), 그리고 (a)의 결과물을 주문 도메인에서 처음 소비하는 것이다.

### §1.1 원래의 차단 사유는 절반이 이미 풀렸다

SPEC-ORDER-001 §3은 회원 체크아웃을 "아직 안 정한 것"이 아니라 "지금 설계로는 만들 수 없는 것"으로 기각했고, 그 근거는 다음 한 문장이었다.

> **서버 렌더 시점에 회원을 식별할 수단이 존재하지 않는다.**
>
> — `.moai/specs/SPEC-ORDER-001/spec.md:122`

같은 절은 대안 두 가지를 함께 기각했다 — "서버가 읽을 수 있는 세션 쿠키를 도입하거나, 체크아웃 화면을 클라이언트 데이터 요청 기반으로 바꾸어 REQ-ORDER-005를 뒤집거나 둘 중 하나"(`spec.md:125`).

이후 **SPEC-AUTH-003이 그 전제를 명시적으로 갈라 놓았다.** 읽기 측은 해결되었고 쓰기 측만 남았다는 것이 그 SPEC의 §1.2 표다.

| | 읽기 측 (SPEC-AUTH-003) | 쓰기 측 (여전히 미해결) |
|---|---|---|
| 질문 | 이 SSR 요청의 방문자는 로그인했는가? | 이 주문을 어느 회원의 것으로 기록하는가? |
| 상태 | **해결됨** — `resolveSession()`이 refresh_token 쿠키로 판정 | **미해결** — SPEC-ORDER-001 §3 |
| 막는 것 | 없음 | `Order`에 `userId` 컬럼이 없음 + `POST /api/orders`가 유효한 회원 자격 증명을 제시하는 요청을 거부(REQ-ORDER-021) |
| 필요한 작업 | 없음(SPEC-AUTH-003은 소비만) | `prisma/schema.prisma` 마이그레이션 + 주문 생성 경로 재설계 |

— `.moai/specs/SPEC-AUTH-003/spec.md` §1.2에서 **두 셀만 고쳐 옮겼다**: 원문의 열 제목 "읽기 측 (이 SPEC)"과 "필요한 작업" 셀의 "이 SPEC은 소비만"에서 자기지시 표현 "이 SPEC"을 `SPEC-AUTH-003`으로 바꿨다. 원문에서 그 표현은 AUTH-003 자신을 가리키지만, 이 문서 안에서는 SPEC-ORDER-004를 가리키는 것으로 잘못 읽히기 때문이다. 나머지 셀은 원문 그대로다.

**이 표의 오른쪽 열이 이 SPEC의 작업 지시서다.** 기각된 대안 중 어느 것도 되살리지 않는다 — `refresh_token` 쿠키는 SPEC-AUTH-001이 처음부터 발급하던 것이고, 새 쿠키를 도입하지 않으며, `REQ-ORDER-005`(서버 렌더 주문서)도 뒤집지 않는다.

### §1.2 이 SPEC이 풀어 주는 하류 작업

세 개의 완료된 SPEC이 이 SPEC 하나를 기다리며 기능을 잘라 냈다.

| 이연한 SPEC | 잘라 낸 것 | 근거 위치 |
|---|---|---|
| SPEC-REVIEW-001 | "구매 인증(verified purchase)" 배지 — "로그인한 회원은 오늘 이 저장소에서 **주문을 완료할 방법이 아예 없다**" | `SPEC-REVIEW-001/spec.md:50`, §3 "Out of Scope — 구매 인증" |
| SPEC-STOREFRONT-002 | 백로그 카드 `t23` 배송지 주소록 — "회원 체크아웃/신원 기반(카드 t18)이 먼저 서야 한다" | `SPEC-STOREFRONT-002/spec.md:135` |
| SPEC-ORDER-003 | 회원 신원으로 여는 주문 조회 — "주문에 `userId`가 없어 회원 신원으로 조회할 대상 자체가 존재하지 않는다" | `SPEC-ORDER-003/spec.md:113` (절 제목은 `:111`) |

이 SPEC은 저 세 기능을 **만들지 않는다.** 저것들이 서 있을 수 있는 데이터(`Order.userId`가 채워진 행)를 만들 뿐이다. 각 기능의 구현은 자기 SPEC의 일이다(§3).

### §1.3 왜 Tier L인가

네 가지가 겹친다.

1. **기초 데이터 모델 변경.** `Order`에 이 스키마가 한 번도 가진 적 없는 소유 차원을 추가한다. `guestId`의 NOT NULL을 푸는 것은 모든 기존 주문 행의 불변식을 바꾸는 일이다.
2. **4개 이상 도메인을 관통한다.** 주문 생성(`src/features/orders`), 장바구니 조회(`src/features/cart`), 주문 조회 화면(`src/app/(shop)`), 체크아웃 API(`src/app/api/orders`).
3. **"동결된 불변식" 파일을 다시 연다.** `cart-repository.ts`가 문서로 못 박은 트랜잭션 클라이언트 서명 목록 — "Only findCartByGuestId() and deleteCart() accept one"(`cart-repository.ts:51`) — 에 `findCartByUserId`를 **두 번째 예외**로 추가한다.
4. **선례가 일치한다.** SPEC-AUTH-001 / ADMIN-001 / PAYMENT-001 / DISCOUNT-001은 모두 같은 성격의 "구성적(constitutional) 범위"로 Tier L을 받았다.

plan-auditor PASS 임계값은 **0.85**다(Tier M의 0.80보다 높다).

### §1.4 위임 브리프 정찰에 대한 정정 세 건

착수 브리프의 정찰 내용을 실제 파일과 대조했다. 세 건이 사실과 달랐고, 두 건은 범위를 넓힌다. 근거 없이 넘어가면 다음 독자가 같은 오류를 다시 유도해 내므로 여기 남긴다.

**정정 1 — `resolveCartIdentity()`의 Bearer 분기는 죽은 코드가 되지 않는다.**
브리프는 이 분기가 "죽은 코드가 되므로 유지/제거를 결정하라"고 했다. 실제 호출자를 세어 보면 **5곳이고, 그중 4곳이 장바구니 라우트**다.

| 호출자 | 소유 SPEC |
|---|---|
| `src/app/api/cart/route.ts:23` | SPEC-CART-001 |
| `src/app/api/cart/items/route.ts:17` | SPEC-CART-001 |
| `src/app/api/cart/items/[itemId]/route.ts:43` | SPEC-CART-001 |
| `src/app/api/cart/items/[itemId]/route.ts:61` | SPEC-CART-001 |
| `src/app/api/orders/route.ts:26` | SPEC-ORDER-001 — **이 SPEC이 떼어 내는 유일한 호출자** |

Bearer 분기는 회원 장바구니 API가 지금 동작하는 근거이고, 로그인 시 게스트→회원 카트 병합이 의존하는 경로다. 제거하면 SPEC-CART-001의 계약이 깨진다. **따라서 결정은 "유지"이며, 그 이유는 "혹시 몰라서"가 아니라 "살아 있는 소비자가 4곳이어서"다**(REQ-ORDER-054). 이 SPEC이 바꾸는 것은 주문 라우트가 그것을 **소비하지 않게 되는 것** 하나뿐이다.

**정정 2 — 다시 쓸 테스트는 2개 파일 6건이 아니라 3개 파일 7건이다.**
브리프가 지목한 두 파일은 맞다. 그런데 세 번째 파일이 있다.

```js
// tests/unit/orders/scope-boundaries.test.ts:237
it("added no member attribution to the User model (AC-ORDER-001 (c))", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const user = schema.match(/model\s+User\s*\{([\s\S]*?)\n\}/)![1]!;
  expect(user).not.toMatch(/orders?\s+Order/i);
});
```

이 단언은 고정 커밋 범위가 아니라 **살아 있는 작업 트리의 `prisma/schema.prisma`를 읽는다.** Prisma는 관계의 반대편 선언을 요구하므로(`Cart.user`가 `User.carts`를 요구한 것과 같은 이유 — `schema.prisma:39-44`) `Order.user`를 추가하면 `User.orders Order[]`가 반드시 따라오고, 이 단언은 **확실히 깨진다.** 같은 파일의 나머지 diff 단언들은 고정 SHA 쌍(`19bd29fb…` → `733e320`)을 대조하므로 영향받지 않는다(`scope-boundaries.test.ts:17-27`, 47-55).

**정정 3 — API만 고치면 이 기능은 UI로 도달할 수 없고, SPEC-ORDER-001이 이름 붙인 결함을 그대로 재현한다.**
브리프의 레이어 추적은 API·서비스·저장소 4개 층만 열거했다. 그런데 화면 두 개가 게스트 쿠키만 읽는다.

- `src/app/(shop)/checkout/page.tsx:42` — 게스트 쿠키가 없으면 `CheckoutUnavailable`. 로그인 시 게스트 쿠키는 무조건 만료되므로(`login/route.ts:129`) **회원은 주문서 화면에 도달할 수 없다.**
- `src/app/(shop)/checkout/complete/[orderId]/page.tsx:68-78` — 게스트 쿠키가 없으면 `notFound()`. 즉 **회원이 방금 만든 주문의 완료 화면을 열 수 없다.**

두 번째가 특히 중요하다. SPEC-ORDER-001 §3은 자신이 막고 있는 결함을 이렇게 이름 붙였다 — "회원 주문이 조용히 만들어졌다가 정작 그 회원이 열어볼 수 없는 상태"(`spec.md:129`). 화면을 손대지 않고 API만 열면 이 SPEC은 **바로 그 상태를 만들어 낸다.** 따라서 두 화면과 안내 문구(`CheckoutUnavailable.tsx:35`)를 범위에 포함한다.

이것은 §3이 제외하는 **재방문 조회**(`/orders/lookup/*`, SPEC-ORDER-003)와 다른 경로다. 완료 화면은 주문 **생성 흐름의 마지막 단계**이지 사후 조회가 아니다.

---

## §2. 요구사항 (GEARS)

### 데이터 모델

- **REQ-ORDER-046** (Ubiquitous): `Order` 모델은 회원 소유자를 가리키는 nullable 컬럼 `userId`와 `User`로의 관계를 보유해야 하며, `userId`에 인덱스를 두어야 한다.
- **REQ-ORDER-047** (Ubiquitous): `Order.guestId`는 nullable이어야 한다.
- **REQ-ORDER-048** (Ubiquitous — XOR 불변식): 모든 `Order` 행은 `guestId`와 `userId` 중 **정확히 하나만** 보유해야 한다. 이 불변식은 데이터베이스 제약이 아니라 쓰기 경로의 코드로 유지되어야 한다.
- **REQ-ORDER-049** (unwanted): 마이그레이션은 기존 주문 행의 어떤 값도 변경하거나 삭제해서는 안 되며, 어떤 컬럼도 제거해서는 안 된다.
- **REQ-ORDER-050** (Ubiquitous): `Order`에 `userId`를 쓰는 모든 경로는 `guestId`를 `null`로 두어야 하고, 그 역도 성립해야 한다.

### 신원 해석

- **When** 주문 제출 요청이 도착하면, 주문 라우트는 요청의 쿠키에서 `resolveSession()`으로 회원 세션을 해석해야 한다. — **REQ-ORDER-051** (Event-driven)
- **While** 유효한 회원 세션이 해석된 상태에서 주문 제출이 처리되는 동안, 주문 서비스는 그 주문을 해당 회원에게 귀속시켜야 한다. — **REQ-ORDER-052** (State-driven)
- **While** 회원 세션이 해석되지 않은 상태에서 주문 제출이 처리되는 동안(쿠키 부재·불일치·폐기·만료 — 전부 동일하게 취급), 주문 라우트는 그 요청을 게스트 소유로 처리해야 하며, 게스트 식별자를 요청의 게스트 쿠키에서 읽거나 없으면 새로 발급해야 한다. — **REQ-ORDER-053** (State-driven)
- **REQ-ORDER-054** (Ubiquitous): `resolveCartIdentity()`의 `Authorization: Bearer` 기반 회원 분기는 장바구니 도메인의 살아 있는 계약이므로 **그대로 유지되어야 한다**(§1.4 정정 1).
- **REQ-ORDER-055** (unwanted): 주문 라우트는 `Authorization` 헤더를 회원 식별의 근거로 사용해서는 안 되며, 그 헤더를 해석하는 어떤 함수도 호출해서는 안 된다. 유효한 Bearer 토큰이 제시되더라도 회원 세션이 없으면 그 요청은 게스트로 처리되어야 한다.
- **REQ-ORDER-056** (unwanted): 주문 라우트는 유효한 회원 신원을 제시하는 요청을 `MEMBER_CHECKOUT_UNSUPPORTED`로 거부해서는 안 되며, 그 응답 코드는 제거되어야 한다.

### 주문 생성

- **While** 회원 주문 생성 트랜잭션이 열려 있는 동안, 주문 서비스는 그 회원의 장바구니를 **같은 트랜잭션 클라이언트로** 읽고 비워야 한다. — **REQ-ORDER-057** (State-driven)
- **REQ-ORDER-058** (Ubiquitous): 주문 저장소는 게스트 소유 주문과 회원 소유 주문에 대해 **두 개의 명시적 생성 경로**를 유지해야 하며, 두 소유자를 한꺼번에 받는 모호한 단일 경로를 제공해서는 안 된다.
- **When** 이미 사용된 멱등성 키로 주문 제출이 도착하면, 주문 서비스는 요청자의 소유자 종류에 맞는 소유자 식별자(회원은 `userId`, 게스트는 `guestId`)로 대조한 뒤에만 기존 주문을 반환해야 한다. — **REQ-ORDER-059** (Event-driven)
- **REQ-ORDER-060** (unwanted): 주문 서비스는 요청자가 소유하지 않은 주문을 멱등성 재전송 응답으로 반환해서는 안 된다.

### 화면

- **When** 유효한 회원 세션을 가진 방문자가 주문서 화면을 열면, 스토어프론트는 그 회원의 장바구니로 주문 입력 양식을 렌더링해야 한다. — **REQ-ORDER-061** (Event-driven)
- **When** 유효한 회원 세션을 가진 방문자가 자기 소유 주문의 완료 화면을 열면, 스토어프론트는 그 주문을 표시해야 한다. — **REQ-ORDER-062** (Event-driven)
- **REQ-ORDER-063** (Ubiquitous): 주문서를 열 수 없을 때의 안내 문구는 회원 체크아웃이 제공되지 않는다고 말해서는 안 되며, 갱신되어야 한다.

### 보안

- **Where** 요청이 쿠키 세션으로 회원을 식별한 경로일 때, 주문 라우트는 주문 생성 트랜잭션을 열기 전에 CSRF 검증을 통과시켜야 하며, 실패 시 본문을 파싱하지 않고 어떤 데이터도 변경하지 않아야 한다. — **REQ-ORDER-064** (Where — 능력 게이트)

> **순서 주의**: CSRF 검증은 세션 해석 **이후**다. 회원 경로에만 CSRF를 요구하므로 "회원인가"를 먼저 알아야 하는데, 그 판정을 하는 `resolveSession()` 자체가 데이터베이스 조회이기 때문이다. 세션 조회는 읽기 전용이라(REQ-AUTH-034) CSRF보다 앞서도 안전하다 — CSRF가 막는 것은 변경 동작이지 읽기가 아니다. 근거 전문은 design.md §3.4.

### 회귀 방지

- **REQ-ORDER-065** (Ubiquitous): 게스트 주문 경로의 관측 가능한 동작(응답 코드, 응답 본문, 저장되는 행의 형태, 게스트 쿠키 발급)은 이 SPEC 이전과 동일해야 한다.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다. 이 SPEC은 하류 기능 세 개를 풀어 주지만, 그중 어느 것도 직접 만들지 않는다 — 각각이 자기 SPEC을 가질 만큼 크고, 여기 끼워 넣으면 Tier L 예산과 감사 임계값을 동시에 잃는다.

### Out of Scope — 회원 주문 조회·자기 조회 이력 (사용자 확정 경계)

- **제외 대상**: 회원이 자기 계정으로 주문 **목록**을 여는 경로, `findOrderByNumberForUser` 류의 회원 세션 기반 재방문 조회, 마이페이지·주문 내역 화면, 회원 전용 주문 검색.
- **사유**: 사용자가 착수 전 AskUserQuestion으로 이 SPEC의 범위를 **주문 생성만**으로 확정했다. 조회는 별개의 화면 계층과 인가 규칙을 요구하며, 그 규칙은 SPEC-ORDER-003이 게스트 경로에서 이미 촘촘히 정의해 둔 것과 나란히 설계되어야 한다.
- **SPEC-ORDER-003은 이 SPEC에 의해 변경되지 않는다**: `findOrderByNumberForGuest`(주문 번호 + `recipientPhone`) 경로와 `/orders/lookup/*` 화면은 전부 그대로다. 그 SPEC은 이 후속 작업을 이미 예상하고 넘겨 두었다 — "회원 신원으로 여는 주문 조회 … 주문에 `userId`가 없어 회원 신원으로 조회할 대상 자체가 존재하지 않는다"(`SPEC-ORDER-003/spec.md:113`). 이 SPEC이 그 문장의 전제를 없애므로, 저 카드는 이제 **막힌 것이 아니라 착수 가능한 것**이 된다.
- **경계의 미묘한 지점**: 이 SPEC이 포함하는 완료 화면(`/checkout/complete/[orderId]`)은 조회가 아니라 **생성 흐름의 종착점**이다(§1.4 정정 3). 재방문 조회(`/orders/lookup/*`)와는 다른 경로이고, 이 SPEC은 후자를 건드리지 않는다.

### Out of Scope — 구매 인증(Verified Purchase) 배지

- SPEC-REVIEW-001이 이연한 배지 자체는 만들지 않는다. 이 SPEC은 그 배지가 판정할 데이터(`Order.userId`가 채워진 행)를 만들 뿐이다.
- 리뷰 작성 권한 판정은 지금처럼 **로그인 여부**로만 이루어지며, 구매자 한정으로 좁히지 않는다. 그 변경은 SPEC-REVIEW-001의 후속 작업이다.

### Out of Scope — 배송지 주소록·마이페이지 (백로그 카드 t23)

- `Address` 모델, 저장된 배송지 목록, 기본 배송지 지정, "저장된 주소 불러오기", 회원 전용 화면 경로(`/account`·`/mypage`)는 전부 범위 밖이다.
- SPEC-STOREFRONT-002 §3이 이 카드의 선행 조건을 "회원 체크아웃/신원 기반(카드 `t18`)이 먼저 서야 한다"로 적었고, 이 SPEC이 그 선행 조건을 해소한다. 카드 착수는 별도다.

### Out of Scope — 게스트→회원 주문 승계

- 비회원으로 주문한 뒤 가입·로그인한 사람의 **기존 주문**을 회원 계정으로 옮기는 동작(`guestId` → `userId` 재귀속)은 범위 밖이다.
- 사유: 승계는 "이 게스트 쿠키가 이 회원의 것이었다"는 증명을 요구하는데, 로그인 시 게스트 쿠키가 즉시 만료되므로 그 증명이 남지 않는다. XOR 불변식(REQ-ORDER-048)을 지키면서 기존 행을 옮기려면 별도의 대조 수단(주문 번호 + 연락처 등)을 설계해야 하며, 그것은 조회 SPEC의 일이다.
- 이 SPEC의 마이그레이션은 **기존 게스트 주문 행을 손대지 않는다**(REQ-ORDER-049).

### Out of Scope — `resolveCartIdentity()` 리팩터링

- 장바구니 도메인의 Bearer 기반 신원 해석은 유지되며(REQ-ORDER-054), 장바구니 API를 쿠키 세션 방식으로 통일하는 작업은 범위 밖이다.
- 사유: 그 통일은 SPEC-CART-001의 계약을 다시 여는 일이고, 살아 있는 호출자 4곳의 동작을 바꾼다. 이 SPEC은 주문 라우트 하나만 옮긴다.
- **결과로 남는 것**: 회원 신원 해석 메커니즘이 저장소에 두 개 공존한다 — 장바구니의 Bearer 방식과 주문의 쿠키 방식. 이것은 사고가 아니라 기록된 상태이며, design.md §3이 두 메커니즘이 충돌하지 않는 이유를 적는다.

### Out of Scope — 결제·재고·쿠폰 로직 변경

- SPEC-PAYMENT-001(결제 상태 전이), SPEC-ORDER-002(재고 차감 동시성), SPEC-DISCOUNT-001(쿠폰 스냅숏)의 로직은 전부 그대로다. 이 SPEC은 주문의 **소유자 차원**만 추가하며, 주문이 만들어지는 트랜잭션의 단계 구성은 바꾸지 않는다.

### Out of Scope — 회원 전용 주문 취소·환불

- 회원이 자기 주문을 취소하거나 환불을 요청하는 동작은 범위 밖이다. SPEC-ORDER-001 §3의 "주문 취소·환불·부분 취소" 제외가 그대로 유효하다.

---

## §4. 소비하는 기존 계약 (변경하지 않음)

- **`resolveSession(cookieStore)`** — `src/lib/auth/session-resolver.ts:54`. `SessionCookieStore`(`get(name)`만 있는 덕 타이핑 인터페이스)를 받아 `Promise<Session | null>` 반환. 읽기 전용이며 쿠키를 재발급하거나 토큰을 회전시키지 않는다(REQ-AUTH-034). 모든 실패 사유는 동일하게 `null`로 붕괴한다(REQ-AUTH-035).
- **`verifyCsrfRequest(request)`** — `src/lib/auth/csrf.ts:130`. `Request`를 직접 받아 `csrf_token` 쿠키와 `x-csrf-token` 헤더를 대조한다. `POST /api/auth/logout`과 `POST /api/auth/refresh`가 이미 같은 방식으로 쓴다.
- **`findCartByUserId(userId)`** — `src/features/cart/repositories/cart-repository.ts:100`. 회원 장바구니 조회. 이 SPEC은 여기에 **선택적 트랜잭션 클라이언트 인자만 추가**하고 기존 동작은 바꾸지 않는다.
- **`Cart`의 XOR 소유 모델** — `schema.prisma:206-220`. 이 SPEC이 `Order`에 도입하는 XOR 강제 **방식**의 선례다. 다만 **기수(cardinality)가 다르다**: `Cart.userId`는 `@unique`(회원당 장바구니 하나)이고, `Order.userId`는 `@unique`가 아니다(회원당 주문 여럿).

---

## §5. 성공 기준

- 유효한 회원 세션으로 제출한 주문이 201로 생성되고, 저장된 행이 `userId` 있음 / `guestId` 없음이다.
- 게스트 제출의 관측 가능한 동작이 이 SPEC 이전과 동일하다 — 변경 전 테스트 통과 수를 기준선으로 캡처해 대조한다.
- `MEMBER_CHECKOUT_UNSUPPORTED`가 저장소 어디에도 남지 않는다.
- 회원이 자기 주문의 완료 화면을 연다.
- 3개 파일 7건의 기존 단언이 **삭제가 아니라 재작성**되어 새 동작을 검증한다.
- `npx prisma validate` 통과, 타입 검사·린트·전체 테스트 통과, 커버리지 기준 유지.
