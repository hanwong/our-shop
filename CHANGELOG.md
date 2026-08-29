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
