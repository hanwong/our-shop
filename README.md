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

## Catalog API (SPEC-CATALOG-001)

Public, read-only, and unauthenticated — `src/middleware.ts` matches `/admin/:path*` only, so no auth runs ahead of these routes. Handlers live under `src/app/api/products/`; the domain logic lives in `src/features/catalog/`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/products` | GET | Paginated product list with sorting and category filtering |
| `/api/products/[productId]` | GET | Full product detail; 404 for an unknown id |

List query parameters (no others are read — there is no search in this SPEC):

| Parameter | Default | Behavior |
|---|---|---|
| `page` | `1` | Positive integer. Invalid values are rejected with 400 before any DB query. Out-of-range pages return an empty list, not an error. |
| `pageSize` | `20` | Positive integer, clamped to a maximum of `100` rather than rejected. |
| `sort` | `newest` | One of `newest`, `price_asc`, `price_desc`; each tie-broken by `id` for stable paging. Anything else is a 400. |
| `category` | (none) | A `Category.slug`. A slug matching no category returns an empty page (200), not a 404. |

The list response carries `items`, `page`, `pageSize`, `totalCount`, and `totalPages`. List rows omit `description` to keep the payload small; the detail response adds `description` and `updatedAt`. Both responses are built from an explicit field whitelist, so future row-shape additions (reviews, related products — both out of scope here) cannot leak into them.

**Known limitations** (see `.moai/specs/SPEC-CATALOG-001/progress.md`): the 300ms p95 response-time criterion is accepted as passing with debt — application-layer p95 measures 0.41ms (list) / 0.06ms (detail), but excludes the database round trip, since no PostgreSQL was available; re-measurement against a real seeded database is a follow-up. The catalog migration was hand-written and verified against the schema via `migrate diff`, never applied to a live database. No seed script ships, and there is no Category management API — category rows must be inserted manually.

## Project documentation

- `.moai/project/product.md`, `structure.md`, `tech.md` — project-wide docs
- `.moai/specs/SPEC-AUTH-001/`, `.moai/specs/SPEC-CATALOG-001/` — each feature's SPEC, plan, acceptance criteria, and progress record
