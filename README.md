# our-shop

[![CI](https://github.com/hanwong/our-shop/actions/workflows/ci.yml/badge.svg)](https://github.com/hanwong/our-shop/actions/workflows/ci.yml)

A TypeScript / Next.js e-commerce backend. This repository currently implements:

- **SPEC-AUTH-001** — email/password and Google OAuth authentication with JWT sessions.
- **SPEC-CATALOG-001** — the product catalog domain model and the public product list/detail API.
- **SPEC-CATALOG-002** — keyword search (name-based partial match) on the product list API.
- **SPEC-CART-001** — cart (add/update-quantity/remove) and guest-to-member cart merge on login.
- **SPEC-CI-001** — GitHub Actions CI: lint/typecheck/schema-validate/test run automatically on every PR and push to `main`.
- **SPEC-STOREFRONT-001** — the first UI surface: a root document shell (Tailwind CSS v4) and the `/products/{productId}` detail page with an image gallery.
- **SPEC-ORDER-001** — guest checkout: the `/checkout` order form and the single-transaction order-creation endpoint (price snapshot, stock decrement, idempotency).

## Stack

- **Language / runtime**: TypeScript, Node.js 20+
- **Framework**: Next.js 15 (App Router, Route Handlers as the API layer)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: [`jose`](https://github.com/panva/jose) (JWT), [`bcrypt`](https://github.com/kelektiv/node.bcrypt.js) (password hashing), [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs) (Google OAuth)
- **Tests**: Vitest (unit + integration), `@vitest/coverage-v8`

See `.moai/project/tech.md` for the full stack rationale and `.moai/project/structure.md` for the directory layout.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, JWT_ACCESS_SECRET, GOOGLE_CLIENT_ID/SECRET, etc.
npx prisma generate
npx prisma migrate deploy    # requires a live PostgreSQL instance
npm run dev
```

Required environment variables are documented inline in `.env.example`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:coverage` | Run the suite with coverage (gate: 85% stmt/branch/85% lines, 80% branch — see `vitest.config.ts`) |
| `npm run prisma:generate` / `npm run prisma:validate` | Prisma client generation / schema validation |

## Continuous Integration (SPEC-CI-001)

`.github/workflows/ci.yml` runs `lint`, `typecheck`, `prisma:validate`, and `test:coverage` — the exact scripts above, unchanged — on every pull request targeting `main` and on every push to `main`. No deployment step: hosting is not yet chosen, so CD is deferred to a future SPEC once it is.

**Branch protection is not configured by this SPEC.** The workflow reports a required-status-check-shaped result (job name `verify`), but until a repository admin turns on "Require status checks to pass" for `main` in GitHub's branch protection settings, a failing `verify` check does **not** block a merge — it is advisory only. To make it enforced:

1. Repository **Settings → Branches → Branch protection rules → Add rule** for `main`.
2. Enable **Require status checks to pass before merging**, then select `verify`.

## Authentication API (SPEC-AUTH-001)

All endpoints live under `src/app/api/auth/`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/signup` | POST | Email/password registration |
| `/api/auth/login` | POST | Email/password login — issues an access token (body) + refresh-token cookie |
| `/api/auth/refresh` | POST | Rotates the refresh token, reuse-detection with family-wide revocation |
| `/api/auth/logout` | POST | Revokes the presented refresh token |
| `/api/auth/google` | GET | Redirects to Google's OAuth consent screen |
| `/api/auth/google/callback` | GET | Completes the OAuth flow — matches, creates, or auto-links an account |

Key security properties (see `.moai/specs/SPEC-AUTH-001/` for the full spec/acceptance criteria):

- Passwords: bcrypt cost 12 with a SHA-256 pre-hash (defeats bcrypt's 72-byte truncation limit).
- Access tokens: JWT (HS256, explicit algorithm allowlist — the token header's own `alg` is never trusted), 15-minute default expiry.
- Refresh tokens: opaque random values, stored only as a SHA-256 hash, rotated on every use with reuse detection (family-wide revocation on reuse).
- Login/refresh/Google-callback are IP-rate-limited (5 requests/60s, 15-minute soft lockout).
- CSRF: double-submit-cookie pattern, verified on `refresh` and `logout`.
- Google auto-link: linking to a previously **unverified** existing account (the common case, since this SPEC has no email-verification flow) invalidates that account's old password and revokes any live refresh tokens for it, closing an account-pre-hijacking exploit found during sync-phase security review. See `.moai/specs/SPEC-AUTH-001/acceptance.md` (AC-AUTH-018 / AC-AUTH-018b) and `progress.md` for the full incident record.

**Known limitations** (tracked, not silently dropped — see `progress.md` for details): account-keyed rate limiting is implemented but not wired on `/login` (conflicts with an existing timing-equalization test); the OAuth callback's short-lived access-token handoff cookie is a reviewed, accepted trade-off pending a frontend SPEC; no live PostgreSQL has been exercised in this sandbox (schema validated via `prisma validate`/`generate`/`migrate diff` only).

## 카탈로그 API (SPEC-CATALOG-001, SPEC-CATALOG-002)

공개, 읽기 전용, 비인증 — `src/middleware.ts`는 `/admin/:path*`만 매칭하므로 이 경로들 앞에는 인증이 걸리지 않는다. 핸들러는 `src/app/api/products/`에, 도메인 로직은 `src/features/catalog/`에 있다.

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/products` | GET | 키워드 검색·카테고리 필터·정렬을 지원하는 페이지네이션 상품 목록 |
| `/api/products/[productId]` | GET | 상품 상세 전체; 존재하지 않는 id는 404 |

목록 쿼리 파라미터는 아래 5개가 전부다. 인식하는 집합은 닫혀 있어 `q`·`keyword`·`query` 같은 별칭은 읽지 않으며, 이 폐쇄성은 화이트리스트 테스트가 보장한다.

| 파라미터 | 기본값 | 동작 |
|---|---|---|
| `page` | `1` | 양의 정수. 유효하지 않은 값은 DB 조회 전에 400으로 거부한다. 범위를 벗어난 페이지는 에러가 아니라 빈 목록을 반환한다. |
| `pageSize` | `20` | 양의 정수, 거부 대신 최대 `100`으로 클램프한다. |
| `sort` | `newest` | `newest`, `price_asc`, `price_desc` 중 하나이며 각각 `id`로 동점을 깨 페이징을 안정적으로 유지한다. 그 외 값은 400. |
| `category` | (없음) | `Category.slug`. 일치하는 카테고리가 없는 slug는 404가 아니라 빈 페이지(200)를 반환한다. |
| `search` | (없음) | 상품명(`name`) 대상의 대소문자 무관 부분 문자열 일치(SPEC-CATALOG-002). `description`은 검색하지 않는다. 빈 문자열이나 공백만 있는 값은 400이 아니라 파라미터 부재로 처리한다. 매치가 없으면 빈 페이지(200). |

네 필터는 AND로 결합된다 — `?search=denim&category=tops&sort=price_asc&page=2`처럼 함께 지정하면 모든 조건을 만족하는 결과만 반환하며, `totalCount`·`totalPages`는 전체 카탈로그가 아니라 **걸러진 집합**을 기준으로 계산된다. 검색 결과에도 정렬은 위 3종만 적용된다 — 관련도(relevance) 정렬 옵션은 없다. 구현은 Prisma의 `contains` + `mode: "insensitive"`이며, 원시 SQL이나 PostgreSQL 전문 검색(`tsvector`)은 쓰지 않는다.

목록 응답은 `items`, `page`, `pageSize`, `totalCount`, `totalPages`를 담는다. 목록 행은 응답 크기를 줄이기 위해 `description`을 생략하며, 상세 응답은 `description`과 `updatedAt`을 추가한다. 두 응답 모두 명시적 필드 화이트리스트로 만들어지므로, 이후 행 구조가 늘어나도(리뷰, 관련 상품 — 둘 다 이번 범위 밖) 응답으로 새어나가지 않는다.

검색 성능을 위해 `Product.name`에 `pg_trgm` 기반 GIN 트라이그램 인덱스(`product_name_trgm_idx`)를 선언해 두었다. 앞에 와일드카드가 붙는 `ILIKE '%검색어%'`는 B-tree 인덱스로 가속할 수 없기 때문이다. 마이그레이션: `prisma/migrations/20260828120000_add_product_name_trgm_index/`.

**알려진 한계**(자세한 내용은 각 SPEC의 `progress.md` 참고): 300ms p95 응답 속도 기준은 두 SPEC 모두 부분 인정(PASS-with-debt) 상태다 — 애플리케이션 계층 p95는 목록 0.41ms·상세 0.06ms(SPEC-CATALOG-001), 검색 포함 요청 0.50ms·검색+필터+정렬 조합 0.35ms(SPEC-CATALOG-002)로 측정됐지만, PostgreSQL이 없어 DB 왕복은 모두 제외했다. 실제 시드된 DB를 대상으로 한 재측정은 후속 작업이다. 특히 **트라이그램 인덱스를 쿼리 플래너가 실제로 선택하는지는 아직 확인하지 못했다** — 선언이 올바르다는 것만 검증했을 뿐, 확장 설치·인덱스 생성·플래너의 선택 여부는 라이브 DB에서 `EXPLAIN`을 돌려야 알 수 있다. 두 마이그레이션 모두 손으로 작성했고 구조적 정확성만 확인했을 뿐 실제 DB에 적용한 적은 없으며, 관리형 DB에서 `CREATE EXTENSION "pg_trgm"` 권한이 있는지도 미확인이다. 시드 스크립트가 없고 카테고리 관리 API도 없어, 카테고리 행은 수동으로 넣어야 한다.

## 장바구니 API (SPEC-CART-001)

핸들러는 `src/app/api/cart/`에, 도메인 로직은 `src/features/cart/`에 있다. 게스트(비인증)와 회원(Bearer 토큰) 모두 사용할 수 있다 — 유효하지 않거나 없는 토큰은 401이 아니라 게스트 신원으로 처리된다.

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/cart` | GET | 현재 카트 조회. 활동 이력이 없으면 DB 행 생성 없이 빈 카트를 반환한다. |
| `/api/cart/items` | POST | 상품 담기(`{ productId, quantity }`). 이미 담긴 상품은 수량 증분. 재고 초과는 400. |
| `/api/cart/items/[itemId]` | PATCH | 수량을 절대값으로 설정(`{ quantity }`, 증분 아님). 재고 초과는 400. |
| `/api/cart/items/[itemId]` | DELETE | 항목 삭제. 남의 카트이거나 존재하지 않는 항목은 404. |

게스트 신원은 `guest_cart_id` 쿠키(`httpOnly`, `sameSite: "lax"`, `crypto.randomBytes(32)` 기반, 만료 14일)로 유지된다 — 이름·수명 모두 SPEC-AUTH-001의 `refresh_token`/`csrf_token`/`oauth_state`와 겹치지 않는다. 로그인(이메일/비밀번호 또는 Google 무관)에 성공하면 게스트 카트가 회원 카트로 병합된다: 회원 카트가 없으면 그대로 승격, 있으면 상품별로 수량을 합산한 뒤 현재 재고로 클램프하고 재고 소진 상품은 완전히 생략한다. 병합 후 게스트 카트는 삭제되어 같은 쿠키로 재로그인해도 중복 반영되지 않는다. 카트 작업은 상품 재고를 차감하지 않는다 — 재고 차감은 체크아웃의 몫이다.

**알려진 한계**(자세한 내용은 `.moai/specs/SPEC-CART-001/progress.md` 참고): PostgreSQL이 없는 환경이라 마이그레이션 실제 적용·DB 제약(유니크 충돌, cascade 삭제)의 실제 동작·동시 담기 경합은 미검증이다. 게스트→회원 병합 실패는 로그인 성공을 지키기 위해 의도적으로 삼켜지는데, 이 저장소에 로깅 인프라가 없어 실패가 기록되지 않는다(알려진 관측성 공백). 게스트 카트 쿠키는 낮은 유출 위험 판단에 따라 평문 저장이며 CSRF 토큰을 요구하지 않는다(받아들인 잔여 위험).

## 스토어프론트 화면 (SPEC-STOREFRONT-001)

이 저장소의 첫 UI다. 이전 SPEC들은 전부 API·도메인 계층만 만들었고, Next.js App Router는 루트 레이아웃 없이 어떤 라우트도 렌더링하지 못하므로 루트 문서 셸 구축이 상세 화면의 선행 산출물로 함께 들어갔다.

| 경로 | 파일 | 설명 |
|---|---|---|
| `/` | `src/app/page.tsx` | 상세 화면 진입 링크 한 줄짜리 스텁. 홈 콘텐츠 설계는 범위 밖 |
| `/products/[productId]` | `src/app/products/[productId]/page.tsx` | 상품 상세. 서버 컴포넌트가 `getProductDetail()`을 직접 호출한다(자기 API를 HTTP로 되부르지 않음) |
| (404) | `src/app/products/[productId]/not-found.tsx` | 존재하지 않는 상품 안내 화면 |

화면 컴포넌트는 `src/components/product/`에 있다 — `ProductDetailView`(순수 서버 컴포넌트: 이름·가격·설명 전문·카테고리·재고)와 `ProductGallery`(`"use client"`, 대표 이미지 + 썸네일 전환). 상세 화면은 인증을 요구하지 않는다.

스타일링은 **Tailwind CSS v4**(CSS-first)로 확정됐다 — 설정 파일은 `postcss.config.mjs` 하나뿐이고 `tailwind.config.js`는 만들지 않는다. 이미지는 `next/image`를 쓰며 허용 호스트는 `next.config.ts`의 `images.remotePatterns`에 등록된 `picsum.photos` 하나뿐이다. **이것은 실제 상품 이미지 호스트가 아니라 임시 플레이스홀더다** — 실제 호스팅이 정해지면 이 목록을 먼저 갱신해야 하며, 그 전에 실제 이미지 URL을 데이터에 넣으면 `next/image`가 런타임 오류를 낸다.

갤러리는 의도적으로 작다: 확대·라이트박스·스와이프·자동 재생 캐러셀은 제공하지 않는다. 썸네일은 네이티브 `<button>`이라 Tab 이동·Enter/Space 활성화·포커스 링을 브라우저에서 그대로 받는다. 장바구니 담기 버튼, 헤더·푸터·전역 내비게이션, 상품 목록/검색 화면은 전부 이 SPEC의 범위 밖이며 별도 SPEC 대상이다.

**알려진 한계**(자세한 내용은 `.moai/specs/SPEC-STOREFRONT-001/progress.md` 참고): `npm run build`가 실패한다 — 원인은 이 SPEC이 아니라 `src/middleware.ts` → `src/lib/auth/jwt.ts` → `node:crypto` 경로의 기존 결함이며(Edge 런타임이 `node:crypto`를 번들하지 못함), 이 SPEC의 산출물을 전부 제거해도 동일하게 실패함을 확인했다. 칸반 백로그의 별도 카드로 분리해 추적한다. 폭 375px 뷰포트의 가로 스크롤 여부는 **아직 확인하지 않았다** — 브라우저 E2E 하네스가 없어 자동 판정이 불가능한 수동 확인 항목이며, 통과했다는 뜻이 아니라 아직 아무도 보지 않았다는 뜻이다. 빌드 게이트는 CI에 없어(`.github/workflows/ci.yml`에 `npm run build` 단계 없음) Tailwind 툴체인 회귀는 손으로 돌려야 잡힌다.

## 주문/체크아웃 (SPEC-ORDER-001)

**게스트 전용이다.** 회원 체크아웃은 의도적으로 범위 밖이며, 이유는 편의가 아니라 구조적 충돌이다 — 서버 렌더 페이지는 회원을 식별할 수 없다. 게스트 쿠키는 최상위 내비게이션에 자동으로 실려 오지만, 회원의 액세스 토큰은 클라이언트 메모리에만 있어 그 요청에 붙을 수 없다. `Order` 테이블에 `userId` 컬럼이 아예 없는 것이 이 경계를 문서가 아니라 스키마로 강제한다.

| 경로 | 메서드 | 설명 |
|---|---|---|
| `/api/orders` | POST | 게스트 주문 생성. 성공 201. 네 가지 효과(재고 차감·주문·주문 항목·카트 비우기)가 트랜잭션 하나 안에서 일어난다 |
| `/checkout` | GET | 주문서 작성 화면. 배송 정보 5개 필드(요청사항은 선택), 결제수단·이메일 입력 없음 |
| `/checkout/complete/[orderId]` | GET | 주문 완료 화면. 주문번호·주문 시점 단가·총액·배송지 + 결제 미완료 고지 |

핸들러는 `src/app/api/orders/`·`src/app/checkout/`에, 도메인 로직은 `src/features/orders/`에, 화면 조각은 `src/components/checkout/`에 있다. 인증을 요구하지 않는다 — `src/middleware.ts`의 매처(`/admin/:path*`)에 `/checkout`이 없다.

주문의 핵심 성질 네 가지:

- **가격 스냅샷** — `OrderItem`은 상품명과 단가를 주문 시점 값으로 복사해 저장한다. 이후 상품 가격이 바뀌어도 주문 내역은 변하지 않는다(`Product` 조인 렌더가 아니다).
- **금액 교차 검증** — 클라이언트가 보낸 `confirmedTotal`은 지시가 아니라 대조용이다. 서버 계산과 다르면 저장하지 않고 409 `PRICE_CHANGED`에 재계산 금액을 담아 재확인을 요구한다.
- **멱등성** — 멱등 키는 서버가 주문서를 렌더할 때 발급해 제출 시 돌려받는다. 같은 키의 재제출은 새 주문이 아니라 최초 주문을 그대로 반환한다(`Order.idempotencyKey`가 `@unique`).
- **재고 차감 시점** — 카트 작업은 재고를 건드리지 않고(SPEC-CART-001 REQ-CART-015), 주문 생성 시점에 조건부로 차감한다(`stock >= quantity`인 경우에만).

실패 응답은 전부 409다: `CART_EMPTY` · `PRICE_CHANGED` · `INSUFFICIENT_STOCK` · `MEMBER_CHECKOUT_UNSUPPORTED`. 마지막 항목이 401/403이 아닌 이유는 회원의 자격 증명이 *유효하되* 이 범위가 서비스할 수 없는 신원이기 때문이다 — 다시 로그인해도 같은 답이 나온다. 유효성 실패만 400이며 잘못된 필드를 한 번에 모두 알려준다.

주문 완료 화면은 **주문 id를 아는 것만으로 열리지 않는다.** 소유권이 질의 자체의 일부라(`getOrderForGuest`) 남의 주문을 가져온 뒤 감추는 형태가 존재하지 않으며, 모든 거부는 "권한 없음"이 아니라 404다 — 구분 가능한 상태 코드는 찍어본 id가 실재하는지를 알려주기 때문이다.

**알려진 한계**(자세한 내용은 `.moai/specs/SPEC-ORDER-001/progress.md` 참고): PostgreSQL이 없는 환경이라 **트랜잭션 원자성·동시 주문 직렬화·unique 경합의 실동작은 관측하지 않았다** — 계획 단계에서 이름을 붙여 제외한 3건이며 통과로 계상하지 않았다. 통합 테스트의 fake가 롤백을 구현하긴 하지만, fake가 되돌리는 것은 fake가 저장한 것이지 데이터베이스가 되돌린 것이 아니다. 마이그레이션도 손으로 작성했고 실제 DB에 적용된 적이 없다. **미결제 주문의 재고 점유를 해제하는 정책이 없다** — 주문 시점에 차감한 재고를 결제로 이어지지 않은 주문에 대해 돌려주지 않는다(잠정 결정, 타임아웃 해제가 향후 방향). 배송비는 `calculateShippingFee()` 한 곳에 격리돼 0원을 반환하는 잠정값이다. `/checkout`으로 가는 화면 링크는 아직 없다(장바구니 UI SPEC의 몫). 결제는 이 범위에 없어 주문은 `pending_payment`에 머문다. `npm run build`는 여전히 실패하는데, 원인은 SPEC-STOREFRONT-001이 이미 기록한 것과 동일한 선행 결함(`src/middleware.ts` → `src/lib/auth/jwt.ts` → `node:crypto`)이며 이 SPEC의 산출물을 트리 밖으로 옮기고 빌드해도 동일하게 실패함을 확인했다 — 백로그 카드로 별도 추적한다.

## Project documentation

- `.moai/project/product.md`, `structure.md`, `tech.md` — project-wide docs
- `.moai/specs/SPEC-AUTH-001/`, `.moai/specs/SPEC-CATALOG-001/`, `.moai/specs/SPEC-CATALOG-002/`, `.moai/specs/SPEC-CART-001/`, `.moai/specs/SPEC-STOREFRONT-001/`, `.moai/specs/SPEC-ORDER-001/` — each feature's SPEC, plan, acceptance criteria, and progress record
