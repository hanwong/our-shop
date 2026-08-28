# our-shop

A TypeScript / Next.js e-commerce backend. This repository currently implements:

- **SPEC-AUTH-001** — email/password and Google OAuth authentication with JWT sessions.
- **SPEC-CATALOG-001** — the product catalog domain model and the public product list/detail API.

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

## 카탈로그 API (SPEC-CATALOG-001)

공개, 읽기 전용, 비인증 — `src/middleware.ts`는 `/admin/:path*`만 매칭하므로 이 경로들 앞에는 인증이 걸리지 않는다. 핸들러는 `src/app/api/products/`에, 도메인 로직은 `src/features/catalog/`에 있다.

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/products` | GET | 정렬·카테고리 필터를 지원하는 페이지네이션 상품 목록 |
| `/api/products/[productId]` | GET | 상품 상세 전체; 존재하지 않는 id는 404 |

목록 쿼리 파라미터(이 외에는 읽지 않는다 — 이 SPEC에는 검색 기능이 없다):

| 파라미터 | 기본값 | 동작 |
|---|---|---|
| `page` | `1` | 양의 정수. 유효하지 않은 값은 DB 조회 전에 400으로 거부한다. 범위를 벗어난 페이지는 에러가 아니라 빈 목록을 반환한다. |
| `pageSize` | `20` | 양의 정수, 거부 대신 최대 `100`으로 클램프한다. |
| `sort` | `newest` | `newest`, `price_asc`, `price_desc` 중 하나이며 각각 `id`로 동점을 깨 페이징을 안정적으로 유지한다. 그 외 값은 400. |
| `category` | (없음) | `Category.slug`. 일치하는 카테고리가 없는 slug는 404가 아니라 빈 페이지(200)를 반환한다. |

목록 응답은 `items`, `page`, `pageSize`, `totalCount`, `totalPages`를 담는다. 목록 행은 응답 크기를 줄이기 위해 `description`을 생략하며, 상세 응답은 `description`과 `updatedAt`을 추가한다. 두 응답 모두 명시적 필드 화이트리스트로 만들어지므로, 이후 행 구조가 늘어나도(리뷰, 관련 상품 — 둘 다 이번 범위 밖) 응답으로 새어나가지 않는다.

**알려진 한계**(자세한 내용은 `.moai/specs/SPEC-CATALOG-001/progress.md` 참고): 300ms p95 응답 속도 기준은 부분 인정(PASS-with-debt) 상태다 — 애플리케이션 계층 p95는 목록 0.41ms·상세 0.06ms로 측정됐지만, PostgreSQL이 없어 DB 왕복은 제외했다. 실제 시드된 DB를 대상으로 한 재측정은 후속 작업이다. 카탈로그 마이그레이션은 손으로 작성했고 `migrate diff`로 스키마와의 일치만 확인했을 뿐 실제 DB에 적용한 적은 없다. 시드 스크립트가 없고 카테고리 관리 API도 없어, 카테고리 행은 수동으로 넣어야 한다.

## Project documentation

- `.moai/project/product.md`, `structure.md`, `tech.md` — project-wide docs
- `.moai/specs/SPEC-AUTH-001/`, `.moai/specs/SPEC-CATALOG-001/` — each feature's SPEC, plan, acceptance criteria, and progress record
