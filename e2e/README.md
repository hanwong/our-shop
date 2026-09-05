# E2E suite (SPEC-E2E-001)

Browser-level end-to-end tests for the guest checkout/payment journey — cart
→ `/checkout` → payment → `/checkout/complete/{orderId}`. Built with
Playwright (Chromium only). See `.moai/specs/SPEC-E2E-001/{spec,plan}.md` for
the full requirements and design record; this file is the practical
day-to-day guide.

## Required environment variables

`playwright.config.ts` calls `assertRequiredEnvVars()`
(`e2e/support/env-check.ts`) at module-load time, before Playwright starts
the webServer or any scenario. It checks exactly these three names:

| Variable | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | root `.env` (loaded read-only by `env-check.ts`, since the Playwright CLI process does not go through Next.js's own `.env` loading) | Prisma connection used both by the Next.js server under test and by the fixtures in `e2e/support/*` that create/read rows directly (`order-fixture.ts`) |
| `NEXT_PUBLIC_PG_CLIENT_KEY` | `e2e/e2e-stub.env` | Stub Toss client key — required so `loadTossPaymentClient()` does not throw before a scenario's payment step runs |
| `PG_SECRET_KEY` | `e2e/e2e-stub.env` | Stub Toss secret key — used to construct the Basic-auth header `toss-server.ts` sends to the (intercepted) confirm/query calls |

`e2e/e2e-stub.env` is checked into the repo (not `.env.*`, since the root
`.gitignore` blanket-ignores that pattern) precisely so this suite is
reproducible from a clean checkout without any manual secret setup — the
values are stub-only and never reach a real host (see Architecture below).

**If any of the three is missing or empty**, `assertRequiredEnvVars()`
throws before the webServer starts:

```
[e2e] required environment variable(s) missing before suite start: <names>.
Set them directly or add them to one of: <envFilePaths> (REQ-E2E-004).
```

This is REQ-E2E-004's early-fail requirement: the suite must never start a
run that could silently reach an external host because a stub credential
was absent.

## Database preconditions

- **Guest-only, no login/session.** Every scenario carries a guest identity
  via the `guest_cart_id` cookie (`GUEST_CART_COOKIE_NAME`,
  `src/lib/auth/guest-identity.ts`). Most scenarios never inject this cookie
  manually — the application's own `POST /api/cart/items` issues
  `Set-Cookie: guest_cart_id=...` on first add-to-cart, and the real browser
  carries it on every subsequent navigation. A few scenarios that skip the
  cart UI (payment-confirm spike, retry flow) create the guest identity
  directly via Prisma instead (`e2e/support/order-fixture.ts`).
- **A local PostgreSQL reachable via `DATABASE_URL` with at least one seeded,
  sellable product.** `getSeededProduct()` (`e2e/support/order-fixture.ts`)
  queries `prisma.product.findFirst({ where: { isActive: true, stock: { gt:
  0 } } })` and throws if none exists:
  `[e2e] no seeded active Product with stock > 0 found — the M3 happy-path
  fixture needs one.` This suite does not seed that product itself — it
  assumes whatever local dev database you already run the app against has
  one. `createSpikeOrder()` uses a slightly looser query (`isActive: true`
  only, no stock filter) because it creates the `Order` row directly via
  Prisma and never drives the add-to-cart UI, so the stock guard does not
  apply to it.
- Coupon and order rows the suite needs beyond that (the M4 discount
  scenario's coupon, the M1 spike order) are created by the fixtures
  themselves at run time (`createDiscountCoupon()`, `createSpikeOrder()`) —
  no separate seed script needs to run first.

## How to run

```bash
npm install                       # once per checkout/worktree — see note below
npx playwright install chromium   # once per environment; Chromium only (plan.md §C)
npm run test:e2e
```

**`npm install` is required once per git worktree, not just once per
machine.** `node_modules/` (and the generated Prisma client inside it) is
**not shared across git worktrees** in this repository — each worktree has
its own `node_modules/`. This surfaced repeatedly during this SPEC's own
milestone-by-milestone delegation, where each milestone ran in a freshly
isolated worktree and needed its own `npm install` before `npm run test:e2e`
would even boot. If `test:e2e` fails immediately with a missing-module or
missing-Prisma-client error, this is the first thing to check.

`npm run test:e2e` runs `playwright test` against `playwright.config.ts`,
which starts its own `next dev` server on a dedicated port (`3100` —
deliberately distinct from the ordinary dev port `3000`, so this suite never
collides with an unrelated dev server you may already have running) and
waits for it to become ready before the first scenario (REQ-E2E-003).

## Why this suite does not run in CI

Per `spec.md` §3 ("Out of Scope — CI에서의 E2E 실행"): this SPEC does not
modify `.github/workflows/ci.yml` and does not add an E2E job to CI, because
browser E2E requires a real database with seeded data, and **CI has no
reachable database today**. `.github/workflows/ci.yml`'s `DATABASE_URL`
(`postgresql://ci:ci@127.0.0.1:5432/our_shop_ci?schema=public`) is a
loopback placeholder, and the Vitest suite that runs in CI mocks the Prisma
seam rather than hitting a live database. Standing up a database service in
CI is out of scope for this SPEC — `SPEC-CI-001` is already `status:
completed` and explicitly scoped CD and a live database out of its own
boundary. CI integration for this suite is therefore a future SPEC's job,
not something deferred by oversight here.

## Architecture note — the two-process-boundary payment mock

The payment mock spans two independent process boundaries, because the
checkout journey's payment step itself does (`plan.md` §A/§B):

1. **Browser bridge** — the browser loads the Toss SDK script
   (`https://js.tosspayments.com/v2/standard`) and calls
   `window.TossPayments(...).payment(...).requestPayment(...)`. This is
   intercepted with Playwright's `page.route()`
   (`e2e/support/toss-stub-fixture.ts`), which fulfils the request with
   `e2e/support/toss-sdk-stub.js` instead of letting it reach a real host.
2. **Server bridge** — once the stub navigates to the application's own
   `successUrl` (`GET /api/payments/confirm`), the Next.js server calls
   `confirmTossPayment()` / `queryTossPayment()`
   (`src/lib/payment/toss-server.ts`), which issue outbound `fetch()` calls
   to Toss's real API host. `page.route()` cannot see this — it is a
   server-process request, not a browser one. This bridge is intercepted
   instead by installing an undici `MockAgent` as the process-global
   dispatcher (`e2e/support/mock-toss-api.mjs`, loaded only via
   `NODE_OPTIONS='--import ./e2e/support/mock-toss-api.mjs'` in
   `playwright.config.ts`'s `webServer.env`).

**`src/lib/payment/toss-server.ts` carries zero production changes for this
SPEC** — its diff against the SPEC's starting commit is 0 lines, verified
repeatedly across every milestone (`git diff --stat <base>... --
src/lib/payment/toss-server.ts`). The mock lives entirely in `e2e/` and is
loaded only by the E2E webServer's own startup command; it is never present
in a plain `npm run dev` or in production. See `plan.md` §A/§B for the full
design record, including why a base-URL environment-variable seam was
considered and rejected.

## @MX:TODO — CI non-integration

<!--
@MX:TODO — this suite is LOCAL-ONLY; no CI workflow runs `test:e2e`
(spec.md §3 explicitly scopes CI integration out). Resolve once a future
SPEC stands up a CI database this suite can run against (plan.md §I cites
SPEC-CI-001 for why CI has none today). Relocated here from
`playwright.config.ts` in M6, now that this file exists (plan.md §H).
-->

This suite is local-only; no CI workflow runs `npm run test:e2e` (see "Why
this suite does not run in CI" above, and `spec.md` §3). Resolve once a
future SPEC stands up a CI database this suite can run against (`plan.md`
§I cites `SPEC-CI-001` for why CI has none today).
