# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added — SPEC-AUTH-001: Email/password and Google OAuth authentication

- `POST /api/auth/signup` — email/password registration with server-side validation, bcrypt cost-12 hashing (SHA-256 pre-hashed to defeat the 72-byte truncation limit), duplicate-email rejection.
- `POST /api/auth/login` — email/password login; a single generic error message and a dummy-compare timing-equalization path so the client cannot distinguish "no such user" from "wrong password" (AC-AUTH-005).
- `POST /api/auth/refresh` — refresh-token rotation with reuse detection (family-wide revocation on a reused/revoked token).
- `POST /api/auth/logout` — revokes the presented refresh token.
- `GET /api/auth/google` + `GET /api/auth/google/callback` — Google OAuth login: matched-account login, new-account creation, and auto-link to an existing email/password account.
- `src/middleware.ts` — RBAC gate on `/admin/*`, requiring an `admin`-role access token.
- Rate limiting (in-memory sliding window) on login/refresh/google-callback: 5 requests/60s per IP, 15-minute soft lockout.
- CSRF double-submit-cookie protection, verified on `refresh` and `logout`.
- Prisma schema: `User`, `OAuthAccount`, `RefreshToken` models.

### Fixed — sync-phase security review (2026-08-27)

A post-implementation security audit (independent quality + security review) found and closed three defects before this feature shipped:

- **Account pre-hijacking via unverified-email signup + OAuth auto-link** (critical): an attacker could register a victim's email address (no email-verification flow exists), then retain access after the victim's Google login got auto-linked to the attacker's account. Fixed by invalidating the existing password **and** revoking any live refresh tokens when auto-linking to a previously-unverified account, in the same transaction as the link itself. This required narrowing the original "auto-link always preserves password login" acceptance criterion to already-verified accounts only, with a new criterion (AC-AUTH-018b) covering the unverified case — see `.moai/specs/SPEC-AUTH-001/acceptance.md`.
- **Missing email case-normalization** in signup/login (the Google OAuth path already normalized): a mixed-case signup email was invisible to the OAuth auto-link's lowercase lookup, silently defeating both the auto-link feature and the account-hijacking fix above for any mixed-case address.
- **Rate-limit bypass via IP spoofing**: the IP extractor trusted the client-forgeable leftmost `x-forwarded-for` entry rather than the proxy-appended rightmost one, and requests with no `x-forwarded-for` header at all bypassed rate limiting entirely. Both are now closed (rightmost-entry trust; a shared rate-limited bucket for undeterminable IPs).

### Known limitations

- Account-keyed rate limiting (in addition to the wired IP-keyed limiting) is implemented but not enabled on `/login` — it conflicts with an existing statistical timing-equalization test's methodology. Tracked as `@MX:DEBT` in `src/app/api/auth/login/route.ts`.
- The Google OAuth callback hands off the access token via a short-lived (60s), non-`httpOnly` cookie — a reviewed, deliberately accepted trade-off pending a frontend SPEC that can replace it with a dedicated token-retrieval endpoint.
- No live PostgreSQL instance was available during development; the schema was validated via `prisma validate` / `generate` / `migrate diff` only, never `migrate dev` against a real database.
- A `tar` critical dependency advisory (via `bcrypt`'s install-time `node-pre-gyp` dependency) remains unresolved — tracked separately, not shipped-and-forgotten.

### 추가 — SPEC-DISCOUNT-001: 쿠폰·할인 정책 계산 엔진 (게스트 주문)

- Prisma 스키마: `Coupon` 모델(코드는 대문자 정규화, 정률/정액 두 유형만 존재하는 `DiscountType` enum, 유효 기간·최소 주문 금액·전역 사용 상한 `maxRedemptions`·누적 사용 `redeemedCount`)과 `Order`의 스냅샷 컬럼 2개(`couponCode`, `discountAmount`). 검증용 쿠폰 시드 스크립트(`prisma/seed-coupons.ts`) 포함. 마이그레이션: `prisma/migrations/20260902142631_add_coupon_discount/`.
- `src/features/discounts/services/discount-engine.ts` — **순수 함수** 할인 계산 엔진(DB·시계·난수·네트워크 접근 없음, `grep`으로 확인). 할인은 `itemsSubtotal`에만 적용되고 배송비는 건드리지 않는다. 정률 쿠폰은 원 단위 **내림**(`floor`)으로 계산하며, 산출된 할인액은 `itemsSubtotal`을 넘지 않도록 상한이 적용되어 `totalAmount`가 음수가 되지 않는다.
- `src/features/discounts/services/discount-service.ts`(`validateCoupon`) — 쿠폰 거절 사유 4종을 모두 409로 응답한다: `COUPON_NOT_FOUND`·`COUPON_EXPIRED`·`COUPON_MINIMUM_NOT_MET`(요구 최소 금액 동봉)·`COUPON_EXHAUSTED`.
- `order-service.ts` 주문 생성 트랜잭션에 쿠폰 검증·할인 산출·사용 횟수 증가를 통합했다. 사용 횟수 증가는 **조건부 원자 갱신**(상한 미만을 조건으로 `updateMany`, 영향 행 수로 성공 판정)이라 마지막 한 장을 두 주문이 동시에 요청해도 상한을 넘지 않는다 — 경쟁에서 진 쪽은 `COUPON_EXHAUSTED`로 거절된다. `confirmedTotal` 교차 검사는 할인 반영 후 금액과 대조되도록 옮겨 붙였다. 쿠폰을 쓰지 않는 기존 주문의 금액 계산·응답 형태는 그대로다.
- `payment-repository.ts`의 결제 취소 트랜잭션(재고 복원)에 쿠폰 사용분 해제를 같은 트랜잭션 안에 얹었다 — `payment-service.ts`의 금액 검사 로직은 **한 글자도 바뀌지 않았다**(diff 0줄로 확인). 결제 승인 시의 금액 대조도 `Order.totalAmount`를 그대로 읽으므로 무변경이다.
- `POST /api/discounts/validate`(사전 검증, 무쓰기) — 코드와 `itemsSubtotal`을 받아 할인액 또는 거절 사유만 돌려주고 `Coupon.redeemedCount`를 포함해 어떤 행도 쓰지 않는다. 응답은 주문 시점 적용 가능성을 보장하지 않으며, 실제 강제는 주문 생성 트랜잭션의 조건부 원자 갱신만이 수행한다.
- 체크아웃 화면(`checkout/page.tsx`, `CheckoutInteractive.tsx`, `OrderSummary`/`CheckoutForm` 확장) — 쿠폰 코드 입력란과 적용 결과 표시 영역을 최소 범위로 추가했다. 할인이 0보다 클 때만 할인 행을 표시하며, 4종 거절 사유마다 서로 구별되는 문구를 보여준다(스타일링·UX 다듬기는 백로그 카드 `t10`이 후속으로 가져간다).
- 사용 제한은 **전역 총량 상한**(`maxRedemptions`)뿐이다 — 이 SPEC은 인별(1인 1회) 사용 제한을 제공한다고 주장하지 않는다. 게스트 주문의 유일한 신원인 `Order.guestId`가 쿠키에서 오고 쿠키는 지워질 수 있어 강제할 수단이 없기 때문이다(REQ-DISCOUNT-022).
- 인수 기준 25개(AC-DISCOUNT-001~025) 전부 이 개발 환경에서 관측 가능한 형태로 PASS. AC-DISCOUNT-016(쿠폰 사용 횟수 동시성)은 실제 살아 있는 PostgreSQL에서 실제로 실행되어 통과했다(SKIPPED 아님) — 다만 이 저장소의 CI 워크플로에는 `services: postgres`가 없어 **CI에서는 이 AC가 판정되지 않고 개발자 기계에서만 닫힌다**(SPEC-ORDER-002 AC-026-EXCL-CONCURRENCY와 동일한 능력 게이트 패턴, plan-phase에서 미리 이름 붙여 수용한 공백).

### plan-audit 이력 — SPEC-DISCOUNT-001

plan-audit는 세 차례 실행되어 점수가 0.79 → 0.90 → 0.95로 올랐지만, 세 번 다 형식상 FAIL로 끝났다(3회 재시도 상한 도달). 마지막 반복의 유일한 잔여 결함은 research.md 한 문장의 자기모순("아직 plan-audit를 거치지 않았다"는, 그 시점엔 이미 거짓인 문장)이었고 이후 수정되었다. 재범위축소나 요구사항 변경은 없었다 — 설계·요구사항·run-phase 산출물에 영향이 없는 연구 문서 한 문장의 문제였다. 이 SPEC은 관측된 PASS가 아니라 **PASS-with-debt**로 run-phase에 진입했다(자세한 내용은 `.moai/specs/SPEC-DISCOUNT-001/progress.md` §E.1 참고).

### Fixed — sync-phase quality review (2026-09-03)

세 건의 독립적인 sync-phase 검토가 run-phase 종료 후 실제 결함을 찾았고, 모두 이 SPEC이 머지되기 전에 닫혔다:

- **F1 [High, blocking] — 통합 테스트 2종의 DB 도달성 게이트 누락**(sync-auditor `--deep`, 초기 판정 FAIL): `tests/integration/discounts/coupon-model.test.ts`와 `tests/integration/discounts/validate-write-free.test.ts`가 도달성 게이트 없이 실제 PostgreSQL 연결을 열었다. 이 저장소의 CI `DATABASE_URL`은 영구적으로 도달 불가능한 자리표시자라, 다음 push에서 CI의 필수 `verify` 검사를 확실히 실패시켰을 결함이다. `concurrency.postgres.test.ts`(SPEC-ORDER-002 M4)가 세운 선례(모듈 로드 시 1회 도달성 프로브 → 이름 붙은 사유로 스킵 → "조용히 스킵하지 않음" 게이트 무결성 테스트)를 그대로 미러링해 닫았다. 커밋 `f2d8cc2`.
- **F2 [Medium, blocking] — `incrementRedeemedCountIfAvailable`(쿠폰 초과사용 방지 가드)에 fast/mocked 유닛 테스트 부재**(sync-auditor `--deep`, F1과 같은 보고서): 라이브 DB 통합 테스트만 이 함수를 실행했는데 그 경로는 CI에서 능력 게이트로 막혀 있어, CI 대표 조건에서 이 가드가 전혀 테스트되지 않고 있었다(`coupon-repository.ts` 60.71%). 최초 sync 커밋에서 F1·H1만 닫고 이 항목을 그대로 놓쳤다 — kanban lead가 보고서를 직접 대조해 잡아냈다. 자매 함수 `decrementRedeemedCountIfPositive`의 기존 테스트 패턴을 그대로 미러링해 닫았다. 커밋 `ed8118a`. 수정 후 `coupon-repository.ts`는 라이브 DB 없이도 100% stmts/branch/funcs/lines.
- **H1 [High] — `POST /api/discounts/validate`의 속도 제한 부재 + 코드 열거 오라클**(보안 리뷰, OWASP): 인증도 속도 제한도 없이 쿠폰 코드마다 서로 구별되는 4가지 실패 상태를 반환해, 유효한 쿠폰 코드를 스크립트로 탐색할 수 있는 오라클이었다. plan-phase(design.md §5 / research.md §5)에서 이미 정직하게 공개된 공백이었지만 사용자에게 수용 위험으로 확인받은 적이 없었고 추적 카드도 없었다. 사용자에게 제시했고 **지금 고치기**로 결정되었다. `/api/auth/login`이 이미 쓰는 `checkIpRateLimit`을 `"discount-validate"` 전용 버킷으로 재사용해 닫았다. 커밋 `da5f75d`.

### 알려진 한계 — SPEC-DISCOUNT-001

- **AC-DISCOUNT-016(쿠폰 사용 횟수 동시성)은 개발자 기계에서만 닫힌 관측이다** — CI에는 `services: postgres`가 없어 CI 기준으로는 판정되지 않는다(plan-phase에서 미리 수용한 공백, SPEC-ORDER-002와 동일한 패턴).
- **인별(1인 1회) 사용 제한은 제공하지 않는다.** 전역 총량 상한만 있으며, 게스트 신원(쿠키)이 지워질 수 있어 인별 제한을 강제할 수단이 없다(REQ-DISCOUNT-022, plan-phase에서 확정된 결정).
- 무료배송 쿠폰, 쿠폰 중복 적용(스태킹), 관리자 쿠폰 저작 화면/API, 상품·카테고리 한정 쿠폰, 코드 없는 자동 적용 프로모션, 미결제 이탈 주문의 쿠폰 사용분 **시간 기반** 자동 해제(결제 취소 웹훅 도달 시 해제는 지원한다)는 모두 이번 범위 밖이다. 시간 기반 해제의 소유자는 아직 정해지지 않았고, 이를 다룰 백로그 카드도 아직 없다(카드 `t21`과 같은 성격의 공백).

### 추가 — SPEC-CATALOG-001: 상품 카탈로그 도메인 모델과 공개 목록/상세 API

- Prisma 스키마: `Category`(`name`·`slug` 고유, `slug`는 목록 API의 필터 키)와 `Product`(`name`, `price`는 `Decimal`이 아닌 원화 정수, `description`, 표시 순서를 그대로 담는 문자열 배열 `images`, `stock`, `categoryId`). 카테고리는 enum이 아니라 테이블이므로 스키마 마이그레이션 없이 추가·이름 변경이 가능하다. `Product`는 인덱스 3개를 갖는다 — `categoryId`(필터), `createdAt`(기본 정렬 `newest`), `price`(`price_asc`/`price_desc` 정렬). 마이그레이션: `prisma/migrations/20260828015400_add_catalog_models/`.
- `GET /api/products` — 공개(비인증) 상품 목록. `src/middleware.ts`는 `/admin/:path*`만 매칭하므로 이 경로 앞에는 인증이 걸리지 않는다.
  - 페이지네이션: `page`·`pageSize` 기본값은 각각 1·20. 값이 존재하지만 유효하지 않으면(`0`, `-1`, `abc`, `1.5`, 빈 문자열) DB 조회 *전에* 400으로 거부한다. `pageSize`가 100을 넘으면 거부 대신 100으로 클램프한다 — 과도한 `pageSize`는 잘못된 요청이 아니라 유효한 요청으로 취급한다.
  - 응답 메타데이터: `items`, `page`, `pageSize`, `totalCount`, `totalPages`.
  - `sort` 정렬: `newest`(기본), `price_asc`, `price_desc`. 각각 `id`로 동점을 깨 페이징이 안정적이다. 인식하지 못하는 값은 DB 조회 없이 400.
  - `?category=<slug>` 카테고리 필터: slug를 한 번 id로 해석해 페이지 조회와 개수 조회 양쪽에 동일하게 적용한다. 일치하는 카테고리가 없는 slug는 404가 아니라 빈 페이지(200, `items: []`, `totalCount: 0`)를 반환하고, 상품 조회 자체를 건너뛴다.
  - 검색 파라미터는 없다. `q`/`search`/`keyword`/`query`는 읽지 않으며, 인식하는 파라미터 집합은 정확히 `category`, `page`, `pageSize`, `sort`이고 화이트리스트 테스트로 보장된다.
- `GET /api/products/[productId]` — 공개 상품 상세: 목록 필드 전부에 `description` 전체와 `updatedAt`을 더한다. 존재하지 않는 id는 404. 응답은 명시적 필드 화이트리스트로 조립되므로, 이후 SPEC이 조회 행에 `reviews`나 `relatedProducts`를 추가해도 이 응답으로 새어나가지 않는다.
- 새 `src/features/catalog/` 계층(`types/`, `repositories/`, `services/`) — 이 저장소에서 `features/` 레이어링을 처음 도입했다. 서비스 계층은 프레임워크에 독립적이다 — 순수 `URLSearchParams`를 받아 판별 유니온 결과를 반환하고, HTTP 매핑은 라우트 핸들러에 맡긴다.

### 알려진 한계 — SPEC-CATALOG-001

- **응답 속도 기준(AC-CATALOG-016)은 부분 인정(PASS-with-debt) 상태이며 완전히 검증되지 않았다.** p95 기준은 300ms이고, 측정된 p95는 목록 0.41ms·상세 0.06ms(N=50)다 — 다만 이 수치는 애플리케이션 계층만 다루며 DB 왕복은 제외한다. 이 환경에 PostgreSQL 인스턴스가 없었기 때문이다. 원래 기준은 50개 이상 시드된 DB를 대상으로 한 p95를 요구한다. 실제 DB를 대상으로 한 재측정(CI나 배포 환경)은 명시적 후속 작업이며, 아직 종료된 항목이 아니다.
- 카탈로그 마이그레이션은 `prisma migrate dev`가 아니라 손으로 작성했다(섀도 DB가 없었다). DDL 객체 집합은 `prisma migrate diff --from-empty`로 스키마와 정확히 일치함을 확인했지만, 실제 DB에 적용해본 적은 없다.
- 이 SPEC에는 시드 스크립트가 없다. 시드 스크립트나 관리자용 카테고리 API가 생기기 전까지는 카테고리 행을 수동으로 넣어야 한다 — 이 범위에는 카테고리 생성/수정/삭제 API가 없다.
- **구현 이후 보안 검토(`--security` 렌즈)에서 막는 결함은 발견되지 않았고**, 인수 기준을 위반하지 않는 비차단(non-blocking) 후속 항목 3건이 나왔다: (1) `page`에 상한이 없다(`pageSize`는 100으로 클램프되지만, 임의로 큰 `page` 값은 그대로 받아들여져 DB에 큰 `OFFSET`으로 전달된다); (2) 카탈로그 라우트 핸들러에 에러 경계가 없어, DB 계층 예외가 제어된 JSON 에러가 아니라 처리되지 않은 Next.js 프레임워크 500으로 그대로 전파된다; (3) 공개 목록/상세 엔드포인트에는(기존 인증 엔드포인트와 달리) 요청 횟수 제한이 없다 — SPEC-CATALOG-001이 이를 요구하지도, 금지하지도 않는다. 전체 근거: `.moai/reports/sync-audit/SPEC-CATALOG-001-security-2026-08-28.md`(로컬, gitignore 대상).

### 추가 — SPEC-CATALOG-002: 상품 목록 API 키워드 검색 (이름 기반 부분 일치)

- `GET /api/products`에 `?search=<검색어>` 파라미터를 추가했다. 상품명(`name`)에 대한 **대소문자 무관 부분 문자열 일치**이며, Prisma의 `contains` + `mode: "insensitive"`만 사용한다 — 원시 SQL도, PostgreSQL 전문 검색(`tsvector`/`to_tsquery`)도 쓰지 않는다.
  - 검색 대상은 `name` 하나뿐이다. 상품 설명(`description`)에만 등장하는 단어로는 매치되지 않는다.
  - 빈 문자열(`?search=`)이나 공백만 있는 값(`?search=%20%20%20`)은 400이 아니라 **파라미터가 없는 것과 동일하게** 처리한다 — 필터를 적용하지 않고 200을 반환한다.
  - 일치하는 상품이 없으면 404가 아니라 빈 페이지(200, `items: []`, `totalCount: 0`, `totalPages: 0`)를 반환한다.
  - 기존 `category`·`sort`·`page`·`pageSize`와 AND로 결합된다. 페이지네이션 메타데이터(`totalCount`, `totalPages`)는 **검색으로 걸러진 집합**을 기준으로 계산되며, 전체 카탈로그를 기준으로 하지 않는다.
  - 관련도(relevance) 정렬은 추가하지 않았다. 검색 결과에도 기존 3종 정렬(`newest` 기본값, `price_asc`, `price_desc`)만 적용된다.
  - 인식하는 쿼리 파라미터 집합은 4개에서 5개(`category`, `page`, `pageSize`, `sort`, `search`)로 늘었다. 별칭 `q`/`keyword`/`query`는 여전히 읽지 않으며, 이 폐쇄성은 화이트리스트 테스트가 계속 보장한다.
- SPEC-CATALOG-001이 §3에서 검색을 **연기된 범위**로 기록하며 남겨둔 REQ-CATALOG-012를, `search` 파라미터에 한해 대체(supersede)한다. 그에 따라 "검색 파라미터를 읽지 않는다"고 못박고 있던 기존 테스트 두 곳(`query-surface.test.ts`, `product-service.test.ts`)을 계약 변경에 맞춰 수정했다 — 편의를 위한 삭제가 아니다.
- Prisma 스키마: `postgresqlExtensions` 프리뷰 기능을 켜고 `pg_trgm` 확장과 `Product.name`에 대한 GIN 트라이그램 인덱스(`product_name_trgm_idx`)를 선언했다. 앞에 와일드카드가 붙는 `ILIKE '%검색어%'` 패턴은 B-tree 인덱스로 가속할 수 없어(B-tree는 접두사만 탐색한다) 기존 인덱스 3개로는 순차 스캔이 남기 때문이다. 마이그레이션: `prisma/migrations/20260828120000_add_product_name_trgm_index/`. 기존 인덱스 3개(`categoryId`, `createdAt`, `price`)는 그대로 유지된다.
- `GET /api/products/[productId]` 상세 API와 라우트 핸들러(`src/app/api/products/route.ts`)는 변경하지 않았다. 핸들러가 이미 `searchParams`를 통째로 `listProducts()`에 넘기고 있어, 실제 변경은 서비스·리포지토리·타입 계층에 국한된다.
- 인수 기준 14개(AC-CATALOG-017~030) 중 13개 PASS, 1개는 아래 "알려진 한계"의 부분 인정(PASS-with-debt) 항목이다. 테스트는 222개에서 304개로 늘었고 회귀는 0건이다.

### 알려진 한계 — SPEC-CATALOG-002

- **검색 포함 요청의 응답 속도 기준(AC-CATALOG-030)은 부분 인정(PASS-with-debt) 상태다.** p95 기준은 300ms이고, 측정된 애플리케이션 계층 p95는 `search` 단독 0.50ms·`search`+`category`+`sort` 조합 0.35ms(N=50)로 예산을 크게 밑돈다. 다만 이 수치에는 **DB 왕복이 빠져 있다** — 이 환경에 PostgreSQL 인스턴스가 없어 SPEC-CATALOG-001 AC-CATALOG-016과 같은 제약을 그대로 안고 있다. REQ-CATALOG-016B가 실제로 경계하는 위험은 카탈로그가 커질 때의 순차 스캔인데, 애플리케이션 계층 측정으로는 그것을 볼 수 없다.
- **트라이그램 인덱스를 쿼리 플래너가 실제로 선택하는지 검증하지 못했다** — SPEC-CATALOG-001에는 없던 새 미검증 항목이다. 스키마와 마이그레이션이 `pg_trgm` 확장과 GIN 인덱스를 올바르게 **선언**한다는 점은 확인했지만, 확장이 실제로 설치되는지, 인덱스가 생성되는지, 플래너가 순차 스캔 대신 그 인덱스를 **선택**하는지는 라이브 DB에서 `EXPLAIN`을 돌려야 알 수 있다. 위 성능 근거가 기대는 지점이 바로 여기이므로, 실제 DB를 대상으로 한 재측정(CI나 배포 환경)은 명시적 후속 작업이며 아직 종료된 항목이 아니다.
- 트라이그램 마이그레이션도 SPEC-CATALOG-001 선례대로 손으로 작성했고(섀도 DB가 없어 `prisma migrate dev`를 쓸 수 없었다), 어떤 데이터베이스에도 적용된 적이 없다. SQL의 구조적 정확성만 확인했다.
- 관리형 DB(Neon, Supabase 등)에서 `CREATE EXTENSION "pg_trgm"` 권한이 있는지 확인하지 못했다. 권한이 없다면 인덱스 없이 진행하는 대안으로 물러서야 하며(plan.md §2.3 대안 B), 그 판단은 배포 대상 DB가 정해진 뒤에야 내릴 수 있다.
- 유니코드 대소문자 폴딩은 ASCII 범위에서만 검증했다. 한글은 대소문자 구분이 없어 이 SPEC의 주 사용 사례에는 영향이 없지만, 라틴 확장 문자에 대한 동작은 collation에 의존하며 미검증이다.
- **구현 이후 보안 검토(`--security` 렌즈)에서 막는 결함은 발견되지 않았고**(PASS), 인수 기준을 위반하지 않는 비차단 후속 항목 3건이 나왔다: (1) `product-repository.ts`의 코드 주석이 "Prisma가 파라미터로 바인딩하므로 검색어 안의 `%`/`_`도 문자 그대로 취급된다"고 적고 있는데, 이 설명은 정확하지 않다 — 파라미터 바인딩은 SQL 구문 삽입(인젝션)만 막을 뿐, 값이 `ILIKE` 패턴의 피연산자로 쓰일 때 그 안의 `%`/`_`가 와일드카드로 해석되는 것은 별개 문제이며 SQL LIKE 자체의 성질이다. 실제 동작(Prisma가 추가로 이스케이프하는지)은 이 환경에 DB가 없어 확인하지 못했지만, 주석의 설명 자체는 지금도 부정확하다. 인수 기준은 위반하지 않는다(`acceptance.md` §2가 "오류를 일으키지 않아야 함"으로만 요구). (2) 공개·비인증 엔드포인트인데 `search` 값에 길이 제한이 없다 — ReDoS는 해당하지 않지만(정규식이 아닌 부분 문자열 비교), `pg_trgm` 인덱스는 검색어 길이에 비례해 트라이그램을 생성하므로 매우 긴 검색어의 DB 비용은 측정된 적이 없다. (3) SPEC 문서(`spec.md §3`)에 남용·비용 관점의 언급이 전혀 없다 — 코드 결함은 아니며 후속 SPEC이 오독하지 않도록 남기는 기록성 지적이다. 전체 근거는 감사 세션 로그를 참고(리포트 파일은 생성되지 않았다).

### 추가 — SPEC-CART-001: 장바구니(담기/수량변경/삭제) 및 게스트→회원 카트 병합

- Prisma 스키마: `Cart`(`userId`·`guestId` 둘 다 nullable — 앱 레벨 XOR 불변식으로 정확히 하나만 채운다)와 `CartItem`(`@@unique([cartId, productId])`로 상품당 한 줄만 허용). 마이그레이션: `prisma/migrations/20260829140000_add_cart_cart_item/`.
- `GET /api/cart` — 현재 카트 조회. 활동 이력이 없는 신원은 DB에 `Cart` 행을 만들지 않고 빈 카트(`{items:[],subtotal:0,itemCount:0}`)를 반환한다(지연 생성).
- `POST /api/cart/items` — 상품 담기. 이미 담긴 상품은 새 행이 아니라 수량 증분(+`quantity`)이며, 재고를 초과하는 요청은 400으로 거부하고 어떤 카트 행도 생성/변경하지 않는다.
- `PATCH /api/cart/items/:itemId` — 수량을 절대값으로 설정(담기의 증분과 다른 의미론). 재고 초과 시 400.
- `DELETE /api/cart/items/:itemId` — 항목 삭제. 신원 X의 카트에 속하지 않거나 존재하지 않는 `itemId`는 403이 아니라 404(다른 카트 존재 여부를 노출하지 않기 위함).
- 신원 해석(`resolveCartIdentity`, `src/features/cart/services/cart-service.ts`): 유효한 Bearer 액세스 토큰은 회원 카트로, 그 외(토큰 없음 또는 무효 토큰)는 게스트 카트로 해석된다. 무효/만료 토큰도 401이 아니라 게스트로 폴백한다 — 장바구니는 인증을 요구하지 않는다.
- `src/lib/auth/guest-identity.ts`(신규) — 게스트 신원 쿠키(`guest_cart_id`). `crypto.randomBytes(32)`(CSPRNG) base64url 인코딩, `httpOnly:true`, `sameSite:"lax"`, 만료 14일(리프레시 토큰의 30일과 의도적으로 다름). 이름·수명 모두 `refresh_token`/`csrf_token`/`oauth_state`와 겹치지 않는다.
- 로그인 시 게스트→회원 카트 병합(`mergeGuestCartIntoUserCart`, REQ-CART-011~013): 회원 카트가 없으면 게스트 카트를 그대로 승격(소유권 이전)하고, 있으면 상품별로 두 카트 수량을 합산한 뒤 **현재 재고로 클램프**하며, 클램프 결과가 0이면(재고 소진) 항목을 완전히 생략한다(수량 0으로 남기지 않음). 병합 후 게스트 카트는 삭제되어, 같은 게스트 쿠키로 재로그인해도 중복 반영되지 않는다(멱등). `src/app/api/auth/login/route.ts`와 `src/app/api/auth/google/callback/route.ts` 양쪽에 추가만 했으며(기존 로직 삭제 없음), 병합은 `try/catch`로 감싸 실패해도 로그인 자체는 항상 성공한다.
- 카트 작업은 상품 재고를 차감하지 않는다(REQ-CART-015) — 재고 차감은 체크아웃의 몫으로 남겨둔다.
- 새 `src/features/cart/` 계층(`types/`, `repositories/`, `services/`) — SPEC-CATALOG-001이 도입한 `features/` 레이어링 패턴을 그대로 따른다. 서비스 계층은 프레임워크에 독립적이며(순수 `Request`를 받아 판별 유니온 결과를 반환), HTTP 매핑은 라우트 핸들러에 맡긴다.
- 인수 기준 16개(AC-CART-001~016) 전부 PASS. 테스트는 304개에서 437개로 늘었고 기존 인증(132개)·카탈로그(164개) 스위트 회귀는 0건이다.

### 알려진 한계 — SPEC-CART-001

- **마이그레이션 실제 적용은 미검증이다.** 이 환경에 PostgreSQL 인스턴스가 없어(`P1001 Can't reach database server`), 마이그레이션 SQL은 `prisma migrate diff --from-empty --to-schema-datamodel` 출력에서 발췌했다. 구조적 정합성(테이블 2개만 생성, DROP 없음, 제약 이름)은 단위 테스트로 텍스트 검증했지만, 실제 서버 적용·롤백·DB 제약(유니크 충돌 시 원자성, `onDelete: Cascade` 실제 전파)의 동작은 확인하지 못했다 — SPEC-CATALOG-001/002와 동일한 환경 제약이다.
- **동시 담기 경합은 미관측이다.** 같은 게스트 쿠키로 들어오는 병렬 요청이 원자적 `{increment}`로 올바르게 합산되는지는 실제 Postgres 없이는 검증할 수 없다. 코드는 read-modify-write 대신 원자적 증분을 쓰도록 작성됐고 단위 테스트가 그 호출 형태를 확인하지만, 실제 경합 시나리오는 관측되지 않았다.
- **게스트 카트 병합 실패는 관측 가능성이 없다.** 로그인 성공을 지키기 위해 병합 실패를 의도적으로 삼키는데(로그인 자체는 항상 성공), 이 저장소에 로깅 인프라가 없어 실패가 어디에도 기록되지 않는다 — 알려진 관측성 공백이며 새 SPEC이 로깅을 도입하기 전까지는 남는다.
- 계정 키(guest_cart_id) 유출은 낮은 위험으로 판단해 값을 평문으로 저장한다(`Cart.guestId`) — 유출 시 노출 범위가 낯선 사람의 장바구니 내용뿐이며 PII·결제수단·계정 접근권이 없기 때문이다(리프레시 토큰의 해시 저장 방식과 의도적으로 다름). 게스트 카트 조작에는 CSRF 토큰이 요구되지 않는다 — 위조된 카트 편집이 노출하거나 이동시키는 자산이 없기 때문에 받아들인 잔여 위험이다.
- **구현 이후 보안 검토(`--security` 렌즈)에서 막는 결함은 발견되지 않았다(PASS).** 게스트 카트 쿠키의 난수성(`crypto.randomBytes` 기반, `Math.random()` 아님), 병합 시 재고 클램프 로직, 두 인증 라우트에 대한 추가가 순수 additive임(기존 132개 인증 테스트 무변경 통과)을 확인했다. 유일한 잔여 항목은 위에서 이미 기록한 병합-실패 관측성 공백이며, 새로 발견된 결함이 아니다. 전체 근거: `.moai/reports/sync-audit/SPEC-CART-001-security-2026-08-29.md`(로컬, gitignore 대상).

### 추가 — SPEC-CI-001: GitHub Actions CI 파이프라인 (PR/main 푸시 자동 품질 검증)

- `.github/workflows/ci.yml`(신규) — `package.json`에 이미 존재하던 검증 스크립트(`lint`, `typecheck`, `prisma:validate`, `test:coverage`)를 새로 도입하지 않고 그대로, PR(`main` 대상, opened/synchronize/reopened)과 `main` 푸시에서 자동 실행한다. 검증 도구나 임계값은 전혀 바꾸지 않았다 — 실행 주체를 사람에서 CI로 옮긴 것이 전부다.
  - 잡 이름은 `verify`로 고정(브랜치 보호 규칙이 참조할 계약 표면).
  - `permissions: contents: read`(최소 권한), `timeout-minutes: 15`.
  - PR push는 이전 실행을 취소(`cancel-in-progress`)하지만 `main` push는 취소하지 않아 커밋별 검증 기록을 보존한다.
  - `prisma generate`가 4개 검증 스텝(lint/typecheck/prisma:validate/test:coverage)의 선행 조건이며, `prisma generate` 실패 시 나머지는 스킵되고, 성공 시 4개는 서로 독립적으로 전부 실행되어(하나 실패해도 나머지 계속) 한 번의 푸시로 모든 실패를 한꺼번에 보고한다.
  - `DATABASE_URL`은 루프백을 가리키는 자리표시자 값이며 실제 크레덴셜이 아니다 — `prisma:validate`가 요구하기 때문에 필요하다(값이 없거나 비어 있으면 `prisma validate`가 즉시 실패함을 실측으로 확인).
  - 커버리지 리포트를 아티팩트로 업로드(`actions/upload-artifact`, 7일 보관) — 대응하는 REQ/AC는 없는 편의 기능.
  - `.nvmrc`(신규, Node 22) — 로컬 `nvm use`와 CI(`setup-node`의 `node-version-file`)가 같은 파일을 Node 버전의 단일 출처로 공유한다.
  - `actions/checkout` / `actions/setup-node` / `actions/upload-artifact`는 계획 단계 스케치(`@v4`)에서 실제 최신 메이저인 `@v7`로 의도적으로 갱신했다 — 사용 중인 입력 표면(`node-version-file`, `cache`, `name`/`path`/`retention-days`/`if-no-files-found`)이 v7에서도 그대로임을 확인한 뒤 채택했다.
- 이 SPEC은 애플리케이션 코드를 만들지 않는다 — `src/**`/`tests/**`/`package.json`/`vitest.config.ts`/`prisma/**`/`.github/workflows/label-sync.yml`는 전부 무변경이다.
- 인수 기준 14개(AC-CI-001~014) 중 12개는 실제 GitHub Actions 실행(정상 실행 1회 + 실패 주입 6종 + 취소 프로브 1회, PR #5)으로 완전히 확인됐다. 나머지 2건은 아래 "알려진 한계"에 명시한 대로 의도적으로 미검증 상태로 남겼다.

### 알려진 한계 — SPEC-CI-001

- **AC-CI-003(main push가 워크플로 실행을 트리거)과 AC-CI-004의 main-측 절반(main에 연속 2회 push해도 실행이 취소되지 않음)은 검증하지 못했다.** 이 SPEC의 공유 checkout 정책(카드 브랜치에서 직접 `main`으로 push 금지, 통합은 리드/사용자 결정)과 충돌하기 때문에 오케스트레이터가 의도적으로 `main`에 push하지 않았다. PR-측 취소 동작(AC-CI-004의 나머지 절반)은 실제로 취소됨을 확인했다. 두 항목 모두 PR이 실제로 `main`에 merge되는 시점에 자연히 검증된다 — merge 자체가 `push` 트리거를 발동시키므로 별도 조치는 필요 없고, `gh run list --branch main`으로 사후 확인 가능하다.
- 커버리지 계측 하 응답 속도 테스트가 "3회 연속 실행에서 flaky하지 않다"는 acceptance.md의 요구는, 6회의 정상/실패 혼합 실행에서 해당 테스트가 포함된 스텝이 매번 통과했다는 간접 근거만 있고 별도로 격리된 3회 연속 측정은 하지 않았다.
- 로컬 검증은 Node 25.2.1에서 수행했고 CI는 `.nvmrc`대로 Node 22를 사용한다 — 6회의 실제 CI 실행이 전부 문제없이 성공했으므로 실질적 차이는 없어 보이지만, 두 버전을 나란히 대조 측정하지는 않았다.
- 브랜치 보호 규칙(리포지토리 Settings에서 `verify`를 필수 상태 검사로 지정)은 이 SPEC의 범위가 아니며 아직 설정되지 않았다 — README에 활성화 절차를 안내해 두었다(수동 설정 필요).
- 이 SPEC은 애플리케이션 코드가 없어 test-first(RED-GREEN-REFACTOR) 주기가 성립하지 않는다 — 대신 6종 실패 주입과 즉시 원복으로 워크플로의 구속력을 실증했다(`git diff` byte-identical 확인).

### 추가 — SPEC-STOREFRONT-001: 상품 상세 페이지 UI 및 이미지 갤러리 (루트 문서 셸 포함)

**이 저장소의 첫 화면이다.** 이전 5개 SPEC은 전부 API·도메인 계층만 만들었고 `.tsx` 파일도 CSS 파일도 하나 없었다. Next.js App Router는 루트 레이아웃 없이는 어떤 라우트도 렌더링하지 못하므로, 루트 문서 셸 구축이 상세 페이지의 부수 작업이 아니라 **선행 산출물**로 이 SPEC 범위에 들어왔다.

- **루트 문서 셸** — `src/app/layout.tsx`(`<html lang="ko">`, 전역 스타일 import, `metadata.title`/`.description`), `src/app/globals.css`(Tailwind 진입점 + 한국어 본문 가독성을 위한 시스템 폰트 스택), `src/app/page.tsx`(상세 화면 진입 링크 한 줄짜리 홈 스텁 — 홈 콘텐츠 설계는 범위 밖). 헤더·푸터·전역 내비게이션·검색창·장바구니 아이콘은 전부 제외했다.
  - 폰트는 `next/font/google`이 아니라 `globals.css`의 시스템 폰트 스택을 쓴다. plan.md §K R7이 빌드 시점 네트워크 의존성을 이유로 이미 대안으로 승인해 둔 경로이며, 여기에 R7이 예상하지 못한 두 번째 이유가 더해졌다 — `next/font`는 Next.js SWC 폰트 로더를 요구하는데 vitest는 그것을 돌리지 않아 셸이 테스트 불가능해진다.
- **Tailwind CSS v4** — `tailwindcss` / `@tailwindcss/postcss` / `postcss` 3종을 devDependency로 추가하고 `postcss.config.mjs` 한 개만 둔다. v3 방식(`tailwind.config.js`, `npx tailwindcss init`, `@tailwind base/components/utilities` 3종 디렉티브)은 쓰지 않는다 — v4는 CSS-first이며 `globals.css` 최상단의 `@import "tailwindcss";` 한 줄이 전부다. `@theme` 커스터마이즈(디자인 토큰 체계)는 만들지 않았다. 이 결정으로 프로젝트 전체의 스타일링 방향이 Tailwind로 고정된다.
- **`GET /products/[productId]` 상세 화면** — `src/app/products/[productId]/page.tsx`는 얇은 데이터 어댑터다. `params`를 풀고 기존 `getProductDetail()` 서비스를 **직접** 호출한다. 자기 자신의 `GET /api/products/:id`를 HTTP로 되부르지 않는다 — 프로세스 안에서 끝날 일에 네트워크 왕복을 얹고, 절대 URL용 환경변수가 새로 필요해지며, JSON 경계에서 `ProductDetail` 타입 계약을 잃기 때문이다. 페이지와 API가 같은 서비스를 공유하므로 404의 의미가 두 곳에서 갈라질 수 없다.
  - 존재하지 않는 상품 id는 `notFound()`로 분기하고 `src/app/products/[productId]/not-found.tsx`가 안내 화면을 그린다. 서비스의 내부 오류 문자열(`Product not found`)·스택·DB 정보는 화면으로 전달하지 않는다.
  - 인증을 요구하지 않는다. 세션 조회도 `redirect()`도 없고 `src/middleware.ts`의 매처(`/admin/:path*`)에 `/products`가 없다(이 SPEC에서 `middleware.ts` 변경 0건).
- **`ProductDetailView`**(순수 서버 컴포넌트) — 이름·가격·설명 전문·카테고리 이름·재고 상태를 표시한다. 가격은 `Intl.NumberFormat("ko-KR")`으로 `89,000원` 형태(소수점 없음, `₩` 글리프 없음). 재고 0이면 "품절"을 명시한다. 표시 필드를 페이로드 순회가 아니라 하나씩 적어 두었기 때문에, 이후 카탈로그 DTO에 필드가 늘어도 화면에 저절로 새어 나오지 않는다 — 리뷰·관련 상품·재고 변동 이력·`category.id`·`createdAt`/`updatedAt`은 표시하지 않는다.
- **`ProductGallery`**(클라이언트 컴포넌트) — 상태를 가진 유일한 조각이라 `"use client"` 경계를 여기까지로 좁혔다. 페이지 전체에 붙이면 설명 텍스트까지 클라이언트 번들에 들어간다. props는 직렬화 가능한 `images: string[]`과 `productName: string` 둘뿐이다.
  - 첫 이미지가 최초 대표 이미지. 이미지가 2장 이상일 때만 썸네일 목록을 렌더하고, 1장이면 아예 렌더하지 않는다. 썸네일 선택 시 대표 이미지가 교체되고 해당 썸네일만 `aria-current="true"`를 갖는다. 빈 배열이면 예외 없이 "이미지 준비 중" 대체 표시를 그린다(`noUncheckedIndexedAccess`가 이 분기를 컴파일러 차원에서 강제한다 — non-null 단언을 쓰지 않은 이유).
  - 썸네일은 네이티브 `<button>`이다. 로빙 tabindex ARIA 위젯을 손으로 구현하지 않았다 — 몇 개짜리 목록에 그 패턴을 직접 짜면 코드가 몇 배로 늘고 그 자체가 접근성 버그의 출처가 된다. `<button>`은 Tab 이동·Enter/Space 활성화·포커스 링을 브라우저에서 그대로 받는다. 모든 이미지의 `alt`에 상품명이 들어간다.
  - 확대(zoom), 라이트박스, 스와이프 제스처, 자동 재생 캐러셀은 제공하지 않는다(정적 검사로 매치 0건 확인). 캐러셀·라이트박스 런타임 의존성 추가도 0건이다.
- **`next.config.ts`**(신규) — `next/image`의 원격 호스트 허용 목록만 담는다. 현재 등록된 유일한 호스트 `picsum.photos`는 실제 상품 이미지 호스트가 아니라 **임시 플레이스홀더**다. 저장소에 시드 데이터가 없고 실제 이미지 호스팅도 아직 정해지지 않았다. 호스팅이 정해지면 이 목록을 교체·확장해야 하며, **그 설정 변경이 실제 상품 이미지 URL을 데이터에 넣기 전에 선행되어야 한다** — 미등록 호스트를 `next/image`에 넘기면 런타임 오류가 난다.
- **테스트 하네스 확장** — `vitest.config.ts`에 `.tsx` 수집(`tests/**/*.test.tsx`), `.tsx` 커버리지 대상(`src/**/*.tsx`), `esbuild: { jsx: "automatic" }`를 추가했다. 전역 `environment`는 `"node"`로 **유지한다** — 컴포넌트 테스트만 파일 상단의 `// @vitest-environment jsdom` 지시자로 DOM을 켠다. 기존 437개 노드 테스트의 실행 환경을 바꾸는 것은 이 SPEC의 범위가 아니다. devDependency는 `jsdom`과 `@testing-library/react` 2개만 추가했다(`@testing-library/jest-dom`은 넣지 않았다 — `getByRole` 계열이 스스로 예외를 던지므로 별도 매처 없이 단언이 성립한다). `@vitejs/plugin-react`도 도입하지 않았다.
- 인수 기준 15개(AC-STOREFRONT-001~015) 중 14개 PASS, 1개는 아래 "알려진 한계"의 미확인 항목이다. 테스트는 437개에서 459개로(파일 36 → 40) 늘었고 회귀는 0건, 커버리지는 98.2% lines / 95.5% branches / 100% functions로 임계값(85/85/80/85)을 충족한다. 신규 `.tsx` 6개는 전부 100%다.
- `src/features/catalog/services/product-service.ts`의 `@MX:ANCHOR` fan-in 주석을 갱신했다 — 상세 페이지가 세 번째 진입점이 됐기 때문이다. 주석 전용 변경이며(주석 블록을 제거한 두 버전의 코드가 완전히 동일함을 확인), 카탈로그 도메인 로직·API·Prisma 스키마·인증·장바구니는 전부 변경 0건이다.

### 알려진 한계 — SPEC-STOREFRONT-001

- **`npm run build`가 실패한다(AC-STOREFRONT-001c 미충족).** 원인은 이 SPEC의 산출물이 아니라 기존 결함이다 — `src/middleware.ts` → `@/lib/auth/jwt` → `node:crypto` 경로에서 Edge 런타임이 `node:crypto`를 번들하지 못한다(`UnhandledSchemeError`). **이 SPEC의 산출물을 전부 제거한 상태에서 빌드해도 동일하게 실패함을 확인했다.** 이 SPEC이 프로젝트에 처음으로 빌드 실행을 도입하면서 드러났을 뿐이다. `src/lib/auth/**`와 `src/middleware.ts`는 이 SPEC의 "변경 0건" 불변 조건 대상이라 고치지 않았고, **칸반 백로그의 별도 카드로 분리해 추적한다.**
- **AC-STOREFRONT-015(c) — 폭 375px 뷰포트에서 가로 스크롤이 없는지는 확인하지 않았다.** 이 항목은 처음부터 **수동 시각 확인 항목**으로 분류돼 자동 Definition of Done의 통과 조건에서 제외돼 있다. jsdom에는 레이아웃 엔진이 없어 요소 폭·스크롤 폭을 계산할 수 없고, 그것을 관측할 브라우저 E2E 하네스(Playwright 등) 도입은 이 SPEC의 범위 밖이기 때문이다. run-phase는 브라우저를 띄우지 않았으므로 **관측 결과가 없다** — 자동으로 통과했다는 뜻이 아니라, 아직 아무도 확인하지 않았다는 뜻이다. 같은 이유로 썸네일 포커스 링의 실제 렌더도 미확인이다.
- **빌드 게이트는 CI에 없다.** `.github/workflows/ci.yml`의 실행 단계는 `lint`/`typecheck`/`prisma:validate`/`test:coverage` 네 개이고 `npm run build`가 없다. 이 SPEC이 처음 들여온 빌드 타임 툴체인(PostCSS + Tailwind v4)의 회귀는 CI가 잡아주지 않으며, 손으로 돌려야 한다. CI 워크플로 수정은 이 SPEC의 범위 밖이다.
- **[정정됨] `npm run typecheck` 오류 13건은 이 SPEC이 유발한 회귀였고, 지금은 해결돼 0건이다.** 이전 기록은 "이 SPEC 이전부터 존재했다 / 이 SPEC이 기여한 타입 오류는 0건"이라고 적었으나 사실이 아니었다. 캐시가 섞이지 않은 워크트리에서 재측정한 결과 base `15965f1`은 **0건(exit 0)**, 이 SPEC 종료 시점 `44bb562`는 **13건(exit 2)**으로, 13건 전부가 이 SPEC의 회귀다. 원인은 이 SPEC이 추가한 `next.config.ts`와 `src/app/layout.tsx`의 베어 `import type … from "next"`다 — `"next"`는 `next/index.d.ts`로 해석되고 그 1행의 `/// <reference types="./types/global" />`가 `NodeJS.ProcessEnv.NODE_ENV`를 `readonly`로 선언하는 `next/types/global.d.ts`를 프로그램 전역에 적재해, 기존 테스트 파일 6개의 `process.env.NODE_ENV = "..."` 직접 대입이 일제히 TS2540이 됐다(이전에는 `next/server` 서브패스만 import했고 서브패스는 `index.d.ts`를 거치지 않는다). 해당 6개 파일의 대입을 vitest의 `vi.stubEnv("NODE_ENV", x)`로 교체해 해결했다 — `tsconfig.json`과 `import type` 구문은 손대지 않았다. 수정 후 `npm run typecheck` 오류 0건, 테스트 459개 전부 통과, 커버리지 98.2%로 회귀 없음.
- **jsdom 테스트는 브라우저가 실제로 그려낸 결과를 보지 않는다.** Tailwind 관련 단언이 보장하는 것은 "컴포넌트가 의도한 유틸리티 클래스 토큰을 출력한다 + Tailwind 파이프라인이 설정돼 있다"까지이며, 계산된 CSS·요소 폭·시각적 스타일은 판정 대상이 아니다. 같은 이유로 HTTP 응답 상태 코드(404/200) 자체도 관측하지 않는다 — 이 SPEC의 테스트가 판정하는 것은 페이지가 `notFound()`를 호출하는지까지이고, 그 호출이 HTTP 404로 번역되는 것은 Next.js 런타임의 보증이다.
- 개별 이미지 URL이 깨진 경우(URL은 있으나 404)의 대체 처리는 없다 — 대체 표시가 다루는 것은 "이미지가 없는 상품"이지 "깨진 URL"이 아니다. 수용된 잔여 위험이며 후속 SPEC 대상이다.
- 라우트 그룹 `(shop)`은 만들지 않았다. 그룹의 존재 이유인 공통 레이아웃(헤더/푸터)이 이번 범위 밖이라 지금 만들면 빈 디렉터리 한 겹만 남는다. 괄호 이름은 URL에 반영되지 않으므로 나중에 옮겨도 `/products/{id}` 주소는 그대로다.

### 추가 — SPEC-ORDER-001: 주문서 작성 화면 및 주문 생성 트랜잭션 (게스트 전용)

**이 저장소가 처음으로 약속을 하는 지점이다.** 이전까지 장바구니는 아무것도 보장하지 않았다 — 가격은 매번 새로 읽었고 재고는 확인만 할 뿐 잡아두지 않았다(SPEC-CART-001 REQ-CART-015). 주문이 생기는 순간이 그 약속의 시작이므로, 주문을 구성하는 네 가지 효과(재고 차감 · 주문 생성 · 주문 항목 생성 · 카트 비우기)는 나뉠 수 없어야 한다.

**범위는 게스트 체크아웃 전용이다.** 회원 체크아웃은 계획 단계에서 의도적으로 제외됐다 — 서버 렌더 페이지는 회원을 식별할 수 없기 때문이다. 쿠키는 최상위 내비게이션에 자동으로 실려 오지만 회원의 액세스 토큰은 클라이언트 메모리에만 있어 그 요청에 붙을 수 없다. plan-audit 2회차가 이 충돌을 2회 연속 미해소로 판정했고(0.81 → 0.74 점수 회귀, STOP 권고), 문서를 더 고치는 대신 사용자 확인 아래 **범위를 축소**한 결과다. 근거 전문은 `.moai/specs/SPEC-ORDER-001/research.md` §6과 `progress.md`의 iteration 2 반영 표.

- Prisma 스키마: `OrderStatus` enum(`pending_payment`·`paid`·`cancelled`)과 `Order`·`OrderItem` 두 테이블. 마이그레이션 `prisma/migrations/20260831120000_add_order_models/`는 순수 additive이며 기존 5개 SPEC의 어떤 테이블·컬럼·제약도 건드리지 않는다(`User` 모델 diff 0줄, `Product`는 역참조 1필드만 추가).
  - **`Order`에는 `userId` 컬럼이 없다.** 문서로만 적어둔 경계가 아니라, 회원 소유 주문을 애초에 **표현 불가능하게** 만드는 스키마 차원의 강제다. 후속 회원 체크아웃 SPEC이 `userId` 추가와 `guestId` NOT NULL 완화를 담당하며, 그 완화는 이미 채워진 컬럼에 대한 `DROP NOT NULL`이라 파괴적이지 않다.
  - `Order.orderNumber`와 `Order.idempotencyKey`는 각각 `@unique`. 인덱스는 `Order.guestId`, `OrderItem.orderId`, `OrderItem.productId` 3개. `OrderItem → Order`는 `onDelete: Cascade`, `OrderItem → Product`는 `onDelete: Restrict`(주문 이력이 상품 삭제를 막는다).
  - 금액은 전부 `Int`(원화 정수) — 카탈로그의 기존 관례를 그대로 따르며 `Decimal`을 쓰지 않는다.
- **가격·상품명 스냅샷**(REQ-ORDER-002): `OrderItem`은 `productName`·`unitPrice`·`lineTotal`을 주문 시점 값으로 **복사해 저장**한다. 주문 이후 상품 가격이나 이름이 바뀌어도 주문 내역은 불변이다 — `Product`를 조인해 렌더하는 방식이 아니다.
- `POST /api/orders` — 게스트 주문 생성. 성공 시 201.
  - 네 가지 효과가 `prisma.$transaction` 콜백 **하나** 안에서만 일어난다. 카트는 트랜잭션 **안에서** 다시 읽는다 — 밖에서 가격·재고를 읽고 안에서 쓰면 그 사이에 둘 다 바뀔 수 있는 창이 열리며, 그것이 바로 트랜잭션이 막으려는 것이다. 카트 비우기는 **마지막**이다 — 카트가 주문의 입력이므로 주문 성립 전에 지우면 실패 시 무엇을 사려 했는지의 유일한 기록이 사라진다.
  - 재고 차감은 `updateMany` + `stock: { gte: quantity }` 조건부 감소이며, 영향 행이 1이 아니면 실패 경로로 간다(read-modify-write가 아니다).
  - 실패 응답 4종: `CART_EMPTY`(409) · `PRICE_CHANGED`(409, 서버가 재계산한 `totalAmount` 동봉) · `INSUFFICIENT_STOCK`(409, 부족 상품과 잔여 수량) · `MEMBER_CHECKOUT_UNSUPPORTED`(409). 유효성 실패는 400 + `fieldErrors`로 **모든** 문제를 한 번에 보고한다(한 필드씩 알리면 빈칸 3개짜리 양식이 왕복 3번을 요구한다).
  - **금액 교차 검증**(REQ-ORDER-014): 클라이언트가 보낸 `confirmedTotal`은 지시가 아니라 **대조용**이다. 서버는 자기 계산을 저장하고, 값이 다르면 `PRICE_CHANGED`로 재확인을 요구한다. 필드가 없으면 기본값을 넣지 않고 거부한다 — 넣었다면 본 적 없는 금액이 청구될 수 있다.
  - **멱등성**(REQ-ORDER-016): 멱등 키는 **서버가** 양식을 렌더할 때 발급해 제출 시 되돌려받는다(클라이언트 발급은 충돌·재사용 책임을 강제할 수 없는 곳에 떠넘긴다). 1차 방어는 트랜잭션 이전의 조회 재사용, 2차 방어는 `idempotencyKey` unique 위반 시 승자 주문 재조회다.
  - **회원 거부 가드가 본문 파싱보다 먼저** 온다(트랜잭션을 열지 않기 위해). 회원 자격 증명은 *유효하지만* 이 범위가 서비스할 수 없는 신원이므로 401/403이 아니라 409다 — 다시 로그인해도 같은 답이 나온다. 조용히 게스트로 강등하지 않는 이유: 강등된 주문은 로그인이 만료시킨 게스트 id에 귀속되어, 회원이 영영 열 수 없는 주문이 남는다.
  - 신원 판정은 SPEC-CART-001의 `resolveCartIdentity()`를 **재사용**한다 — 규칙을 다시 구현하지 않으므로 주문 엔드포인트와 카트 엔드포인트가 "누구의 요청인가"에 대해 어긋날 수 없다.
- `GET /checkout` — 주문서 작성 화면(`src/app/checkout/page.tsx`). 서버 컴포넌트가 `getCart()` 서비스를 직접 호출한다(자기 API를 HTTP로 되부르지 않음 — SPEC-STOREFRONT-001의 선례). **신원 해석은 쿠키 한 번 읽기가 전부다** — 토큰 검증도, 회원/게스트 우선순위 규칙도, id 발급도 없다. 지름길이 아니라, 이 화면이 카트 서비스가 소유한 판정과 어긋날 수 있는 **두 번째 인가 표면이 되지 않게** 하는 장치다(AC-ORDER-021이 금지 토큰 6종을 정적으로 고정한다).
  - 입력은 정확히 5개: 수령인 이름 · 연락처 · 우편번호 · 주소 · 배송 요청사항(선택). **결제수단 입력도, 이메일 수집도 없다**(plan.md §0 #4).
  - 인증을 요구하지 않는다 — `src/middleware.ts`의 매처에 `/checkout`이 없다(이 SPEC의 `middleware.ts` 변경 0건).
- `GET /checkout/complete/[orderId]` — 주문 완료 화면. 주문번호 · **주문 시점 단가** · 총액 · 배송지를 보여주고, 결제가 진행되지 않았음을 명시한다(주문은 `pending_payment`이고 이 SPEC은 거기서 벗어나는 전이를 만들지 않는다 — 결제 완료를 암시하는 문구는 느슨한 게 아니라 거짓이다).
  - **주문 id를 아는 것만으로는 부족하다.** 소유권이 질의 자체의 일부이므로(`getOrderForGuest`), 남의 주문을 가져온 뒤 안 보여주기로 결정하는 형태가 존재하지 않는다. 모든 거부는 `notFound()`이며 "권한 없음" 상태 코드가 아니다 — 구분 가능한 상태는 찍어본 id가 실재하는지를 알려준다.
- `CheckoutUnavailable` 화면의 **문구는 계약이다**(AC-ORDER-006이 고정). 게스트 카트를 찾지 못한 요청은 두 사람 중 하나이고 서버는 구분할 수 없다 — 아무것도 담지 않은 방문자, 또는 방금 로그인한 회원. 그래서 "장바구니가 비었다"고 **단정하지 않고**(회원에게는 거짓이다) 서버가 실제로 관측한 것만 말하며, 회원 체크아웃이 범위 밖임을 함께 고지한다. 이 고지가 없으면 로그인한 회원에게 이 화면은 경계가 아니라 고장으로 보인다.
- `src/features/orders/` 계층 신설(`types/`, `repositories/`, `services/`) — 카탈로그·카트가 세운 `features/` 패턴을 그대로 따른다. 서비스 계층은 프레임워크에 독립적이며(게스트 id와 파싱된 본문을 받아 판별 유니온을 반환), HTTP 매핑은 라우트 핸들러의 몫이다.
- `src/features/cart/repositories/cart-repository.ts`에 **선택적 트랜잭션 클라이언트 인자**를 추가했다(`findCartByGuestId`·`deleteCart` 2개 함수). 주문 트랜잭션이 게스트 카트를 자기 트랜잭션 **안에서** 읽고 지워야 하기 때문이며, 대안이었던 "`where: { guestId }` 소유권 질의를 주문 도메인에 복제"는 인가 표면을 둘로 쪼개므로 기각했다. 인자가 선택적이라 **기존 호출부는 diff 0줄**이다(`cart/services`, `cart/types`, `app/api/cart`, `app/api/auth`) — 이것이 무변경의 기계적 증거다. `findCartByUserId`는 회원 경로 전용이라 열지 않았다.
- 배송비는 `calculateShippingFee()` 단일 함수로 격리하고 0원을 반환한다(plan.md §0 #3의 **잠정 결정**). 3,000원 같은 값을 지어내지 않은 이유: 만들어낸 숫자는 아무도 내리지 않은 결정으로 굳어져 테스트·픽스처·화면으로 번진 뒤 확정된 것처럼 보이게 된다. 실제 정책이 오면 이 함수 본문만 바뀐다 — `shippingFee` 컬럼과 호출부는 이미 있다.
- 인수 기준 20개(AC-ORDER-001~008 · 010~016 · 018~022) 전부 PASS. 테스트는 459개에서 631개로(파일 40 → 50) 늘었고 기존 459개는 전부 무변경 통과(회귀 0건), 커버리지는 98.37% stmts / 95.72% branch / 100% funcs로 임계값(85/80/85/85)을 상회한다.

### 알려진 한계 — SPEC-ORDER-001

- **트랜잭션 원자성·동시성·unique 경합의 실동작은 관측하지 않았다.** 이 환경에 PostgreSQL이 없다. 계획 단계에서 미리 이름을 붙여 제외한 3건이며(`AC-012-EXCL-ROLLBACK` · `AC-013-EXCL-CONCURRENCY` · `AC-016-EXCL-UNIQUE-RACE`), **PASS로 계상하지 않았다.**
  - 통합 테스트의 fake `$transaction`은 실제로 롤백을 구현하고(호출 전 `structuredClone` 스냅샷, 콜백이 throw하면 복원) 그 성질 자체를 테스트로 고정해 두었지만, **fake가 되돌리는 것은 fake가 저장한 것이지 데이터베이스가 되돌린 것이 아니다.** 여기서 관측한 것은 "서비스가 트랜잭션 콜백 안에서만 쓰고, 실패 시 throw로 콜백을 중단시킨다"까지다. 초록불을 원자성·동시성의 증거로 제시하지 않는다.
- **마이그레이션은 어떤 데이터베이스에도 적용된 적이 없다.** 섀도 DB가 없어 `prisma migrate dev` 대신 손으로 작성했으며(SPEC-CATALOG-001/002·SPEC-CART-001과 동일한 제약), 구조적 정확성만 확인했다. `prisma validate`는 통과한다.
- **미결제 주문의 재고 점유를 해제하는 정책이 없다.** 주문 생성 시점에 재고를 차감하는데(plan.md §0 #1의 확정 결정), 결제로 이어지지 않은 주문의 재고는 아무것도 돌려주지 않는다. 설계상 필연이며 숨기지 않는다 — 타임아웃 후 해제가 향후 방향으로 기록돼 있다(plan.md §0 #2, **잠정 결정**).
- **`/checkout`으로 가는 화면 링크가 없다.** 장바구니 UI SPEC의 몫이며, 현재는 주소를 직접 입력해야 도달한다.
- **게스트 쿠키가 만료되면 완료 화면으로 돌아갈 수 없다.** 이 화면은 주문 직후의 순간을 위한 것이고, 재방문 수단은 주문 내역 SPEC의 몫이다. 간과가 아니라 수용된 한계다.
- **결제는 이 SPEC에 없다.** 주문은 `pending_payment`에 머물며 `paid`로 가는 전이 코드가 존재하지 않는다(AC-ORDER-019가 PG 엔드포인트 0건·`paid` 전이 코드 0건을 정적으로 확인한다). `package.json`·`.env.example` diff 0줄 — 결제 SDK도 크레덴셜도 추가하지 않았다.
- **`npm run build`는 여전히 실패하며, 이 SPEC이 고칠 수 있는 것이 아니다.** SPEC-STOREFRONT-001이 이미 기록한 것과 **동일한** 선행 결함이다 — `src/middleware.ts` → `@/lib/auth/jwt` → `node:crypto` 경로에서 Edge 런타임이 `node:` 스킴을 처리하지 못한다. 추정이 아니라 **귀속 실험으로 확인**했다: `src/app/checkout/`과 `src/app/api/orders/`를 트리 밖으로 옮기고 다시 빌드해도 동일한 오류로 실패했다. 두 파일 모두 이 SPEC의 불변 조건 대상이라 diff 0줄이며, SPEC-AUTH-001의 표면을 이 SPEC이 손대는 것은 범위 위반이다. 칸반 백로그 카드 `t16`으로 추적한다.
- **설계 문서에 없어 run-phase가 판단한 항목 1건**(기록): REQ-ORDER-004(수량 1 미만 거부)에 대응하는 실패 코드가 design.md §8 표에 없다. 새 코드를 발명하는 대신 같은 표의 "그 외 예기치 못한 오류 → 500, 코드 없음" 행을 적용했다 — 요청 자체는 정상이고 서버 상태가 이상한 경우라 사용자가 고칠 수 있는 것이 없고, 따라서 알릴 이름도 필요하지 않다.

### 추가 — SPEC-PAYMENT-001: PG 결제 연동과 결제 승인·취소 웹훅 처리 (게스트 전용)

SPEC-ORDER-001이 명시적으로 유예한 두 책임 — 결제 승인·웹훅 처리, `pending_payment` 이후의 상태 전이 — 을 이 SPEC이 인수한다. PG사는 토스페이먼츠(사용자 확정). 이 SPEC이 다루는 주문은 SPEC-ORDER-001이 만든 게스트 주문뿐이며, 회원 결제는 다루지 않는다(회원 귀속 주문이 이 저장소에 아예 존재하지 않기 때문).

- Prisma 스키마: `Order.paymentKey`(unique) 추가, `PaymentEventSource`(`CONFIRM_API`·`WEBHOOK`) enum 신설, `PaymentAuditLog` 테이블 신설(전이 전/후 상태·트리거 출처·관련 주문 id·발생 시각 보존, update/delete/upsert 경로 없음 — append-only).
- `src/features/payments/`(`types`·`repositories`·`services`) — `payment-repository`가 `markOrderPaid`/`markOrderCancelledAndRestoreStock`을 조건부 `updateMany` 형태로 제공(read-modify-write 아님), `payment-service`가 확인(confirm)·웹훅 양쪽에서 `paymentKey` 일치 여부로 분기.
- `src/lib/payment/toss-server.ts` — 토스 결제 승인 API 호출 + 결제 조회(Payment Query) API 호출(서버 전용, `next/*` import 없음), 둘 다 10초 타임아웃 적용.
- `POST /api/payments/confirm` — 결제창 승인 콜백 리다이렉트 처리. 금액 불일치 시 확인 API 미호출·트랜잭션 미개시. API 실패·타임아웃 시 트랜잭션 미개시, 이미 처리된(paymentKey 일치) 주문은 멱등 재응답.
- `POST /api/payments/webhook` — `PAYMENT_STATUS_CHANGED` 웹훅 수신. payload의 `paymentKey`로 Toss 결제 조회 API를 되짚어 호출해 그 결과와 payload의 `orderId`가 일치할 때만 주문 조회로 진입한다(조회 실패 시 502, 불일치 시 400 — CodeRabbit PR #9 리뷰 반영, 아래 "수정" 참조). 조회된 기록의 `DONE`이 `pending_payment→paid` 전이, `CANCELED`가 (paymentKey 일치 시) 재고 복원 + `cancelled` 전이(단일 트랜잭션), `PARTIAL_CANCELED`는 무전이 기록만 남김. 금액 불일치 웹훅은 기록만 남기고 전이 없음. 재전송(known `transmissionId`)은 no-op.
- `src/components/checkout/PayButton.tsx` + `src/lib/payment/toss-client.ts` — 결제창 트리거(orderId/amount/orderName/successUrl/failUrl 전달, `NEXT_PUBLIC_PG_CLIENT_KEY`만 클라이언트에 노출 — 비밀키는 클라이언트 번들에 없음).
- `checkout/complete/[orderId]` 화면 확장 — `pending_payment` 상태이면서 `payment_failed=1` 쿼리가 있을 때만 재시도 배너 노출(상태 우선 원칙 — 이미 `paid`인 주문에는 배너를 표시하지 않음).
- `.env.example`에 `PG_SECRET_KEY`/`PG_WEBHOOK_SECRET`/`NEXT_PUBLIC_PG_CLIENT_KEY` 추가.
- 인수 기준 20개 중 19개 PASS, 1개(`AC-004-EXCL-CONCURRENCY`)는 아래 알려진 한계에서 이름 붙여 제외. 테스트는 717개(61개 파일)로 구성되며, 수치는 실행 부하에 따라 갈린다 — 부하가 낮은 실행에서는 717/717 전부 통과, 전체 스위트 동시 실행(커버리지 포함) 부하 하에서는 716개 통과·1개(`AC-AUTH-005`, SPEC-AUTH-001 소유, 이 SPEC과 무관한 머신 부하 플레이크) 실패. `--exclude tests/integration/auth/login.test.ts`로 그 플레이크를 제외하면 716/716이 클린하게 통과하며, 커버리지는 97.56% stmts / 93.09% branch / 100% funcs / 97.56% lines로 임계값(85/85/80/85)을 상회한다(근거: progress.md §E.2/§E.4).

### 수정 — SPEC-PAYMENT-001: CodeRabbit PR #9 리뷰 반영

- **웹훅 검증 방식 교체(Major, 구조적)**: `PAYMENT_STATUS_CHANGED` 웹훅에는 `tosspayments-webhook-signature` 헤더가 실려 오지 않는다는 사실을 Toss 공식 문서로 재확인했다(그 헤더는 `payout.changed`·`seller.changed` 전용). 이전의 HMAC-SHA256 서명 검증(`verifyWebhookSignature`, `PG_WEBHOOK_SECRET`)을 제거하고, Toss의 결제 조회(Payment Query) API(`GET /v1/payments/{paymentKey}`, `PG_SECRET_KEY` Basic 인증 재사용)로 웹훅의 `paymentKey`를 되짚어 조회해 그 응답만을 상태 전이의 근거로 삼는 방식으로 교체했다. `.env.example`에서 `PG_WEBHOOK_SECRET`을 제거했다(더 이상 참조되지 않음).
- **취소 웹훅의 paymentKey 대조 누락 수정(Major)**: 취소(`CANCELED`) 웹훅 처리가 조회된 `paymentKey`를 주문에 저장된 `paymentKey`와 대조하지 않고 취소를 적용하던 결함을 수정했다 — 이제 불일치 시 취소를 적용하지 않는다.
- **`PARTIAL_CANCELED`의 전체 취소 오적용 수정(Major)**: `PARTIAL_CANCELED` 웹훅이 `CANCELED`와 같은 전체 취소 경로로 라우팅되어 재고를 과다 복원하고 부분 결제 상태인 주문을 완전 취소로 표시하던 결함을 수정했다 — 이제 별도 분기로 라우팅되어 무전이 기록만 남긴다(부분 취소 자체는 이 SPEC의 범위 밖).
- **확인(confirm) API 호출 타임아웃 부재 수정(Major)**: `confirmTossPayment`가 타임아웃 없이 `fetch`를 호출해 Toss 응답이 지연되면 게스트의 확인 요청이 무한정 대기하던 결함을 수정했다 — 10초 타임아웃(`AbortSignal.timeout`)을 추가하고, 타임아웃·네트워크 오류를 예외가 아닌 기존 `CONFIRM_API_FAILED` 실패 결과로 반환한다(재시도 가능).
- 관련 SPEC 문서(`spec.md` REQ-PAYMENT-011/012/014, `design.md` §5/§7/§8/§9, `research.md` §4, `plan.md` §2, `acceptance.md` AC-PAYMENT-011/012/013/014)를 새 검증 흐름에 맞춰 갱신했다.

### 알려진 한계 — SPEC-PAYMENT-001

- **`AC-004-EXCL-CONCURRENCY`는 미검증이다.** 이 환경에 살아 있는 PostgreSQL이 없어, 확인(confirm) API 경로와 웹훅 경로가 실제로 동시에 도착할 때의 행 잠금 직렬화는 관측할 수 없다. 순차 요청으로 관측 가능한 `paymentKey` 불일치 거부·기록은 테스트로 확인했지만, 진짜 경합 상황의 동작은 **PASS로 계상하지 않는다**.
- **관리자·사용자 주도 취소·환불은 이 범위 밖이다.** 이 SPEC이 처리하는 취소는 **PG가 먼저 알린 웹훅뿐**이다(확인 API의 `CONFIRM_API_FAILED` 경로는 취소를 수행하지 않는다 — 그 경로는 주문을 `pending_payment`로 남겨 재시도를 허용할 뿐이며, 실제 취소 전이는 웹훅 `CANCELED` 분기만이 수행한다). 관리자가 직접 요청하는 취소·환불 API, 부분 취소·부분 환불 UI는 다루지 않는다 — 사전에 사용자가 확인한 범위 결정이며, 향후 백오피스 주문 관리 SPEC(칸반 백로그 카드 `t12`)의 몫이다.
- **미결제 주문의 재고 점유 해제 만료 작업(스케줄러/배치)은 없다.** 이 SPEC이 다루는 재고 복원은 이벤트 주도(웹훅이 취소를 알렸을 때)뿐이며, 시간 경과만으로 트리거되는 예약 작업은 별도 운영 SPEC의 몫이다(SPEC-ORDER-001도 동일한 결정을 이미 기록).
- **확인 실패·결제창 중단 시 새 상태값을 만들지 않는다.** 주문은 `pending_payment`에 그대로 남아 재시도를 허용한다 — 재시도 의미론을 복잡하게 만들지 않기 위한 설계상 결정.
- **가상계좌·정기결제·해외 간편결제·정산 웹훅·ARS 결제는 이 범위 밖이다.** 요청받은 범위는 카드/일반 결제 승인 + `PAYMENT_STATUS_CHANGED` 웹훅 두 이벤트로 한정된다.
- **회원 결제 경로는 이 범위 밖이다.** SPEC-ORDER-001이 회원 체크아웃 자체를 구조적으로 제외했으므로 이 저장소에는 회원에게 귀속된 주문이 존재하지 않는다.
- **`npm run build`는 여전히 실패하며, 이 SPEC이 고칠 수 있는 것이 아니다.** SPEC-STOREFRONT-001·SPEC-ORDER-001이 이미 기록한 것과 **동일한** 선행 결함이다 — `src/middleware.ts` → `src/lib/auth/jwt.ts` → `node:crypto` 경로에서 Edge 런타임이 `node:` 스킴을 처리하지 못한다. 이 SPEC은 두 원인 파일을 전혀 건드리지 않았다(diff 0줄, 이번 세션에서 직접 확인). 칸반 백로그 카드 `t16`으로 추적한다.
- **`tests/integration/auth/login.test.ts`의 AC-AUTH-005는 알려진 플레이크다.** bcrypt 타이밍-허용오차 비교 테스트로 전체 스위트 동시 실행 시 CPU 경합에 민감하다. 단독 실행하면 통과한다. SPEC-AUTH-001 소유이며 이 SPEC이 만들지도 고치지도 않았다 — sync-phase에서도 재현해 동일한 특성을 확인했다.

### 추가 — SPEC-ORDER-002: 재고 차감 동시성 제어와 품절 처리 (게스트 전용)

SPEC-ORDER-001은 조건부 원자 갱신(`stock >= quantity`인 경우에만 감소)을 이미 만들어 두었지만, 그 전략이 실제로 성립한다는 것은 관측하지 않은 채 남겨 두었다. 이 SPEC은 새 동시성 전략을 고르지 않고, 기존 전략이 성립하지 않는 네 구멍을 막고 그 성립을 이 저장소에서 처음으로 관측했다.

- **G1 — 잠금 순서 미결정으로 인한 교착 회피**: 여러 상품을 차감할 때 상품 id 오름차순으로 잠근다(장바구니 저장 순서를 따르지 않음). 정렬은 잠금 순서에만 적용되며 저장·응답·완료 화면의 항목 순서는 장바구니 순서 그대로 보존된다(REQ-ORDER-023).
- **G2 — 실패 응답의 스냅샷 재고 보고**: 재고 부족으로 차감이 거부되면 같은 트랜잭션에서 재고를 다시 읽어, 트랜잭션 시작 시점의 거짓 스냅샷이 아니라 재조회한 실제 값을 보고한다(REQ-ORDER-025/026).
- **G3 — 다중 품목 부족의 부분 보고**: 요청 수량보다 재고가 적은 **모든** 미차감 항목을 한 번에 보고한다. 이미 차감에 성공한 항목은 롤백 대상이라는 이유로 제외한다(REQ-ORDER-025 · AC-ORDER-027/028).
- **G4 — 화면의 재고 표면화 부재**: 주문서 화면이 항목마다 재고 상태(재고 부족/품절)를 표시하고, 부족으로 거부된 응답의 상품 목록을 항목별로 렌더한다. 표시는 제출을 막지 않는다(REQ-ORDER-028~030).
- **M4 — 살아 있는 PostgreSQL에서의 첫 관측**: 이 저장소가 처음으로 실제 PostgreSQL 16.15 인스턴스에 대해 행 잠금 직렬화를 관측했다. 재고 1인 상품을 두 주문이 동시에 요청하면 정확히 하나만 성공하고 재고가 정확히 0에서 멈추며 주문 행이 1건만 생성됨을 확인했다(REQ-ORDER-024 · AC-ORDER-035). 반사실 시나리오로 실제 교착(40P01)도 재현해, PostgreSQL이 보낸 원문 오류를 그대로 관측했다.
- **M4-fix — REQ-ORDER-027 매핑 결함**: M4 관측 결과 plan.md가 전제한 "40P01 교착은 Prisma `P2034`로 도달한다"가 이 환경에서 반증되었다 — 실제로는 `code`가 없는 `PrismaClientUnknownRequestError`이고 SQLSTATE는 메시지 문자열 안에만 있었다. `P2034`만 검사하던 `isTransactionConflict()`가 실제 교착에 대해 절대 참이 되지 않아, 진짜 교착이 발생하면 `CONCURRENCY_RETRY`(409)로 매핑되지 못하고 미분류 500으로 새는 결함이 있었다. SQLSTATE(`40P01`/`40001`) 메시지 검사를 추가해(`P2034` 검사는 유지) 닫았고, 실제로 중단된 트랜잭션의 오류 객체에 production 함수를 직접 적용하는 실 DB 단언으로 회귀를 방지한다.
- 인수 기준 13건(AC-ORDER-024~036) 전부 개발자 기계에서 PASS. 테스트는 746개(M1) → 764개(M2) → 781개(M3) → 794개(M4) → 801개(M4-fix)로 늘었으며 기존 테스트 중 이번에 깨진 것은 없다.

### 알려진 한계 — SPEC-ORDER-002

- **CI에서는 동시성 하네스가 실행되지 않는다.** `.github/workflows/ci.yml`의 `DATABASE_URL`은 여전히 어떤 데이터베이스도 열지 않는 자리표시자다. 하네스는 도달 불가 시 사유를 남기고 건너뛰므로, `AC-026-EXCL-CONCURRENCY`·`AC-034-EXCL-DEADLOCK`은 **개발자 기계에서만 닫혔고 CI 기준으로는 열린 채**다. plan-phase에서 사용자가 확인하고 받아들인 공백이며, CI 필수 검사로의 승격은 후속 SPEC-CI-001 소유 SPEC으로 명시적으로 미뤄졌다.
- **서비스가 교착의 희생자가 되는 장면은 관측하지 못했다.** 반사실 시나리오를 4회 시도했으나 매번 PostgreSQL이 대조군 트랜잭션을 희생자로 골랐다(희생자 선택은 통제 불가). M4-fix가 닫은 것은 실제 오류 객체에 대한 술어 반환값과 서비스 매핑 경로의 단위 검증이며, 끝단에서의 500→409 전환 자체를 한 번에 관측하지는 못했다.
- **메시지 문자열 매칭은 API 계약이 아니다.** `isTransactionConflict()`의 SQLSTATE 검사는 Prisma 커넥터의 오류 렌더링 형태에 의존한다. 취약하지만 조용히 깨지지는 않는다 — 렌더링이 바뀌면 실 DB 단언이 먼저 실패한다.
- **미결제 주문의 재고 점유 해제는 이 SPEC의 범위 밖이다.** SPEC-ORDER-001·SPEC-PAYMENT-001 사이에서 인수되지 않은 채 남아 있으며, 이 SPEC도 범위를 넓히지 않기로 확정했다. 별도 백로그 카드 `t21`이 추적한다.
- **`payment-repository.ts`의 재고 복원 경로는 이 SPEC의 잠금 순서 규칙 밖이다.** 차감과 결제 취소 복원 사이의 교착 가능성은 남아 있으며, `CONCURRENCY_RETRY` 매핑이 이를 흡수한다(막은 것이 아니라 식별 가능하게 만들었다).
