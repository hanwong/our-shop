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
