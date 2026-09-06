---
id: SPEC-ADDRESS-001
title: "배송지 주소록 관리(회원 전용)"
version: "0.1.0"
status: draft
created: 2026-09-07
updated: 2026-09-07
author: snake
priority: P2
phase: "v0.3.0 target"
module: "src/features/addresses"
lifecycle: spec-anchored
tags: "address, mypage, member, csrf, crud"
tier: M
depends_on: [SPEC-AUTH-002, SPEC-ORDER-004]
related_specs: [SPEC-AUTH-003, SPEC-ORDER-003, SPEC-CART-001, SPEC-STOREFRONT-002]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-07 | 0.1.0 | draft | plan-phase 최초 작성. 착수 전 사용자가 AskUserQuestion 라운드로 CSRF 적용 여부와 체크아웃 통합 범위를 이미 확정한 상태로 위임됨 — 별도 명료화 라운드 없이 진행. 미해결 명료화 마커 없음. |

---

## §1. 개요

로그인한 회원이 **배송지 주소를 여러 건 저장**하고, 회원 전용 화면(`/mypage/addresses`)에서 **추가·수정·삭제**하며, 그중 하나를 **기본 배송지로 지정**할 수 있게 한다. 새 `Address` 모델(`userId` FK)과 그 CRUD API, 그리고 회원 전용 페이지 한 개를 만든다.

### 1.1 이 SPEC이 잇는 경계 — 백로그 카드 `t23`이 기다리던 선행 조건은 이미 해소되었다

백로그 카드 `t23`("배송지 주소록 관리(회원 전용)")은 `t8`에서 분리된 뒤 **선행 조건 미충족**을 이유로 두 번 이연되었다. `SPEC-ORDER-003/spec.md:96`은 그 이연을 이렇게 기록했다:

> **넘긴 곳**: 백로그 카드 **`t23`** — "배송지 주소록 관리(회원 전용) — Address 모델·userId FK·마이페이지 화면 전부 없음, 회원 체크아웃/신원 기반(백로그 `t18`)이 먼저 서야 함. `t8`에서 분리됨". 이 카드가 회원 체크아웃 SPEC에 흡수될지 `SPEC-ADDRESS-001`(후보 ID — 아직 생성되지 않았다)로 신설될지는 카드 착수 시 정한다. 선행 조건은 `t18` 해소 또는 회원 체크아웃 도입이다.

이 문서가 바로 그 후보 ID로 신설된 SPEC이다. 그리고 그 선행 조건은 **SPEC-ORDER-004가 스스로 해소했다고 명시했다** — `SPEC-ORDER-004/spec.md:188-191`:

> ### Out of Scope — 배송지 주소록·마이페이지 (백로그 카드 t23)
>
> - `Address` 모델, 저장된 배송지 목록, 기본 배송지 지정, "저장된 주소 불러오기", 회원 전용 화면 경로(`/account`·`/mypage`)는 전부 범위 밖이다.
> - SPEC-STOREFRONT-002 §3이 이 카드의 선행 조건을 "회원 체크아웃/신원 기반(카드 `t18`)이 먼저 서야 한다"로 적었고, **이 SPEC이 그 선행 조건을 해소한다.** 카드 착수는 별도다.

즉 이 SPEC은 새 선행 조건을 만들지 않는다. 이미 서 있는 토대(`User.id`, `resolveSession()`, `Order.userId`) 위에 **순수하게 추가되는** 도메인 하나를 얹는다.

### 1.2 선행 조건이 실제로 서 있음을 확인한 근거

| 선행 조건 | 제공 SPEC | 현재 상태 | 확인 근거 |
|---|---|---|---|
| 지속적 신원 `User.id` | SPEC-AUTH-001 | 존재 | `prisma/schema.prisma` `model User { id String @id @default(cuid()) ... }` |
| 서버에서 로그인 상태 판별 | SPEC-AUTH-002 / SPEC-AUTH-003 | 존재, 정본화됨 | `src/lib/auth/session-resolver.ts:54` `resolveSession()` — 역할 무관, 읽기 전용 |
| 회원 귀속 쓰기 경로 선례 | SPEC-ORDER-004 | 병합됨 | `git log` 커밋 `f10155d`, `Order.userId` + `@@index([userId])` |
| CSRF 원시 함수 | SPEC-AUTH-001 M6 | 존재 | `src/lib/auth/csrf.ts:130` `verifyCsrfRequest()` |

### 1.3 이 SPEC이 만드는 최초의 것 — 고객용 회원 전용(미로그인 시 리다이렉트) 화면

지금 저장소의 `resolveSession()` 호출부는 **6곳**이며, 그중 어느 것도 세션이 `null`일 때 **리다이렉트하지 않는다**. 전부 `null`을 "익명 방문자"로 취급하고 무언가를 계속 렌더링하거나 응답한다:

| 호출부 | `null`일 때의 동작 |
|---|---|
| `src/components/layout/SiteHeader.tsx:30` | 로그인 링크를 대신 렌더링 (UI 분기) |
| `src/app/(shop)/products/[productId]/page.tsx:49` | 로그인 유도 문구를 대신 렌더링 (UI 분기) |
| `src/app/(shop)/checkout/page.tsx:53` | 게스트 쿠키 신원으로 폴백 |
| `src/app/(shop)/checkout/complete/[orderId]/page.tsx:88` | 게스트 쿠키 신원으로 폴백 |
| `src/app/api/orders/route.ts:51` | 게스트 주문 경로로 폴백 |
| `src/app/api/reviews/route.ts:29` | 401 JSON 반환 (API이므로 리다이렉트 아님) |

따라서 **"미로그인이면 로그인 화면으로 리다이렉트하는 고객용 페이지"는 이 SPEC이 저장소에서 처음 만든다.** 구조적 선례는 관리자 쪽에만 있다 — `src/app/staff/products/page.tsx:86-89`의 `resolveAdminSession()` → `null` → `redirect("/staff/login")`. 이는 **다른 함수·다른 라우트 트리**이므로 고객용 선례가 아니지만, "데이터를 읽기 전에 게이트를 먼저 통과시킨다"는 기계적 형태는 그대로 옮겨 온다. 이 문서는 존재하지 않는 고객용 선례가 있는 것처럼 쓰지 않는다.

### 1.4 화면 경로를 `/mypage/addresses`로 정하는 근거

`SPEC-AUTH-003/spec.md:190`은 후속 SPEC 전방 포인터에 이렇게 적었다:

> - **마이페이지 SPEC** — 헤더의 "내 정보"가 실제로 향할 화면. 이 SPEC은 그 화면의 설계를 앞질러 정하지 않는다.

`SPEC-ORDER-003`과 `SPEC-ORDER-004`는 둘 다 후보를 `/account`·`/mypage`로 병기했을 뿐 선택하지 않았다. 저장소에는 `account`·`mypage`·`profile` 계열 디렉터리가 하나도 없다. 선택 근거는 두 가지다:

1. **문서상 실제로 쓰인 이름은 "마이페이지"다.** AUTH-003이 후속 SPEC을 "마이페이지 SPEC"이라 부르고, 카드 `t23` 본문도 "마이페이지 화면"이라 쓴다. `/account`는 병기된 대안일 뿐 어느 문서도 그 이름을 쓰지 않았다.
2. **주소록은 마이페이지의 전부가 아니라 한 항목이다.** 주문 내역·프로필 수정은 각각 별도 SPEC으로 남아 있으므로(§3), 이 SPEC은 **`/mypage/addresses` 경로 하나만** 만든다. `/mypage`를 회원 영역의 이름 공간으로 **예약하되 그 자리에 실제 라우트를 만들지는 않는다** — 이 SPEC 종료 시점에 `/mypage`를 직접 열면 404다. 이는 의도이며, 마이페이지 랜딩 화면은 별도 SPEC의 몫이다(§3). 하위 경로로 둔 덕에 후속 SPEC이 `/mypage/orders`나 `/mypage` 랜딩을 형제·부모로 추가할 때 경로 구조를 재편할 필요가 없다.

`SiteHeader.tsx:46`의 "내 정보"는 현재 링크가 아닌 `<span>`이다 — 이 SPEC은 그 span을 링크로 바꾸지 않는다(§3).

### 1.5 CSRF 적용 — 두 상충하는 선례 사이의 의도적 선택

저장소에는 회원 전용 쓰기 경로에 대해 **서로 어긋나는 두 선례**가 있다:

| 선례 | CSRF | 위치 |
|---|---|---|
| `POST /api/orders` 회원 분기 | **적용** | `src/app/api/orders/route.ts:62` |
| `/staff/api/*` 관리자 CRUD 4개 | **적용** | `staff/api/products/route.ts:38` 등 |
| `POST /api/auth/refresh`·`logout` | **적용** | `refresh/route.ts:39`, `logout/route.ts:39` |
| `POST /api/reviews` | **미적용** | `src/app/api/reviews/route.ts` — `verifyCsrfRequest` import 자체가 없음 |

이 SPEC은 **적용 쪽을 따른다**. 이는 오류가 아니라 **두 선례 중 하나를 고른 결정**이며, 근거는 다음과 같다: 리뷰 미적용은 이 세션의 정찰이 *설명 없는 공백*으로 판단한 것이고(리뷰 SPEC 어디에도 "CSRF를 의도적으로 뺐다"는 근거 기록이 없다), 나머지 **7개 경로는 전부 적용한다**(`grep -rln "verifyCsrfRequest" src/app` → 7개 파일). 7 대 1의 다수 선례이자 방어적으로 옳은 쪽을 따른다.

**후속 독자에게**: 이 문단은 "리뷰를 따르지 않은 이유"를 남기기 위해 존재한다. `POST /api/reviews`와 이 SPEC의 엔드포인트가 CSRF 적용 여부에서 다른 것은 **누락이 아니라 의도**다.

---

## §2. 요구사항 (GEARS)

### 데이터 모델

- **REQ-ADDRESS-001** (Ubiquitous): `Address` 모델의 모든 행은 정확히 한 명의 `User`에 귀속되어야 하며, `userId` FK는 `onDelete: Cascade`여야 한다 — `Review`·`Cart`·`RefreshToken`과 같은 "계정보다 오래 살아남을 이유가 없는 회원 편의 데이터" 분류를 따른다. `Order`·`OrderItem`의 `Restrict`(회계·감사 기록 보호)는 이 모델에 적용하지 않는다.

- **REQ-ADDRESS-002** (Ubiquitous): `Address`는 배송지 식별에 필요한 네 개 필드 `recipientName`·`recipientPhone`·`postalCode`·`address`와 기본 배송지 표시 `isDefault`만 보유해야 하며, `deliveryMemo`를 보유해서는 안 된다 — 배송 메모는 저장된 *장소*의 속성이 아니라 개별 *배송 건*의 속성이므로 `Order.deliveryMemo`에 남는다.

- **REQ-ADDRESS-003** (Ubiquitous): 한 회원이 보유한 `Address` 행 중 `isDefault === true`인 행은 **최대 한 개**여야 한다.

### 쓰기 API

- **REQ-ADDRESS-004** (When): 회원이 유효한 배송지 생성 요청을 보내면, 주소록 서비스는 새 `Address` 행을 생성하고 201로 응답해야 한다. 그 회원의 기존 주소가 하나도 없었다면 생성된 행의 `isDefault`는 `true`여야 한다.

- **REQ-ADDRESS-005** (When): 회원이 자신이 소유한 배송지의 수정 요청을 보내면, 주소록 서비스는 네 개 배송 필드를 갱신하고 200으로 응답해야 한다.

- **REQ-ADDRESS-006** (When): 회원이 자신이 소유한 배송지의 삭제 요청을 보내면, 주소록 서비스는 해당 행을 삭제하고 성공 응답을 반환해야 한다.

- **REQ-ADDRESS-007** (When): 회원이 자신이 소유한 배송지를 기본 배송지로 지정하면, 주소록 서비스는 **하나의 트랜잭션 안에서** 그 회원의 기존 기본 배송지의 `isDefault`를 `false`로 되돌리고 대상 행의 `isDefault`를 `true`로 설정해야 한다.

- **REQ-ADDRESS-008** (When): 요청 본문이 검증을 통과하지 못하면, 주소록 서비스는 400으로 응답하고 어떤 행도 생성·수정·삭제해서는 안 된다.

### 인증·인가

- **REQ-ADDRESS-009** (When): 상태를 변경하는 주소록 엔드포인트에 CSRF 토큰이 없거나 불일치하면, 라우트 핸들러는 **어떤 상태 변경 연산에도 도달하기 전에** 403으로 응답해야 한다.

- **REQ-ADDRESS-010** (When): 세션이 해석되지 않는 요청이 주소록 API에 도달하면, 라우트 핸들러는 401로 응답해야 한다.

- **REQ-ADDRESS-011** (When): 요청된 배송지가 요청자의 소유가 아니면, 주소록 서비스는 404로 응답하고 그 행을 읽거나 변경해서는 안 된다 — 존재 여부를 403과 404로 구별해 노출하지 않는다.

### 화면

- **REQ-ADDRESS-012** (When): 세션이 해석되지 않는 방문자가 주소록 화면을 열면, 페이지는 **어떤 데이터도 읽기 전에** 로그인 화면으로 리다이렉트해야 한다.

- **REQ-ADDRESS-013** (While): 세션이 해석된 상태에서, 주소록 화면은 그 회원이 소유한 배송지 목록과 각 항목의 기본 배송지 여부를 표시하고, 추가·수정·삭제·기본 지정 조작 수단을 제공해야 한다.

### 금지

- **REQ-ADDRESS-014** (Unwanted, shall not): 이 SPEC은 체크아웃 화면·`CheckoutForm`·`POST /api/orders`에 저장된 배송지를 불러오는 경로를 만들어서는 안 된다.

- **REQ-ADDRESS-015** (Unwanted, shall not): 이 SPEC은 로그인 화면에 `redirect`/`next` 쿼리 파라미터 처리를 추가해서는 안 된다 — `SPEC-AUTH-002`의 **REQ-AUTH-029**(Unwanted)가 이를 명시적으로 금지하고 있으며, 그 SPEC은 `status: completed`로 종료된 별도 문서다.

---

## §3. 범위 밖 (Out of Scope)

이 SPEC이 **만들지 않는 것**을 명시한다. 아래 각 항목은 조용한 공백이 아니라 의도적 제외이며, 대부분 후속 SPEC의 전방 포인터를 함께 남긴다.

### Out of Scope — 체크아웃 통합 ("저장된 주소 불러오기")

- 체크아웃 화면에서 저장된 배송지를 선택해 폼에 채우는 기능은 **만들지 않는다**. `CheckoutForm`·`checkout/page.tsx`·`POST /api/orders`는 이 SPEC에서 한 줄도 바뀌지 않는다.
- 이는 단순한 우선순위 문제가 아니라 **실제 구조적 작업량**이다: `src/components/checkout/CheckoutForm.tsx`가 받는 props는 `idempotencyKey`·`confirmedTotal`·`couponCode` 세 개뿐이고, `checkout/page.tsx:53`은 `resolveSession()`을 **장바구니 신원 해석 용도로만** 쓰며 `isLoggedIn`·`userId` 중 어느 것도 폼으로 내려보내지 않는다. 즉 체크아웃 폼은 현재 방문자가 회원인지 알 방법이 **하나도 없다**. 그 통로를 새로 뚫는 일이 통합의 본체다.
- **후속 SPEC 전방 포인터**: "체크아웃 배송지 자동 채움 SPEC"(ID 미정)이 이 통로를 소유한다. 그 SPEC은 `Address`를 FK로 참조하지 않고 **값을 복사**해야 한다 — 이 저장소의 확립된 규약은 주문 시점 필드를 항상 동결된 스냅샷으로 두는 것이며(`OrderItem.productName`/`unitPrice`, `Order.couponCode`가 모두 조인이 아닌 복사본이다), 저장된 주소는 회원이 나중에 수정할 수 있는 살아 있는 행이므로 조인하면 과거 주문의 배송지가 소급 변경된다.

### Out of Scope — 마이페이지의 나머지 화면

- 주문 내역 목록, 프로필 수정, 비밀번호 변경, 회원 탈퇴는 만들지 않는다. 이 SPEC은 `/mypage` 아래에 `addresses` 한 항목만 연다.
- `SiteHeader.tsx:46`의 "내 정보" `<span>`을 `/mypage`로 향하는 링크로 바꾸지 않는다 — 헤더 변경은 `SPEC-AUTH-003`이 소유한 영역이고, 마이페이지 랜딩 화면 자체가 이 SPEC의 범위 밖이다.

### Out of Scope — 주소 데이터의 고도화

- 우편번호 검색 API 연동(다음/카카오 주소 검색 등)은 하지 않는다. 네 개 필드는 전부 수기 입력이다.
- 주소 별칭(`label`: "집"·"회사"), 주소록 정렬 순서 사용자 지정, 주소 개수 상한은 만들지 않는다.
- 전화번호·우편번호의 형식 정규화(하이픈 제거, 국가 코드 처리)는 하지 않는다 — 검증은 존재·길이 수준에 머무른다.

### Out of Scope — 게스트 및 관리자

- 비회원(게스트)이 배송지를 저장하는 경로는 만들지 않는다. 주소록은 `userId`에 귀속되므로 게스트에게는 소유 주체가 없다.
- 관리자가 회원의 배송지를 조회·수정하는 `/staff/*` 화면이나 API는 만들지 않는다.

### Out of Scope — 기존 SPEC의 본문 수정

- `SPEC-AUTH-002`의 REQ-AUTH-029(로그인 리다이렉트 파라미터 금지)를 개정하지 않는다. 그 결과 이 SPEC의 리다이렉트는 **복귀 경로 없이** `/login`으로만 향한다(§REQ-ADDRESS-012, `plan.md` M4에 그 귀결을 명시).
- `resolveAdminSession()`을 `resolveSession()`에 위임하도록 리팩터하지 않는다 — `SPEC-AUTH-002` §3이 이미 후속 후보로만 기록해 둔 사안이다.
