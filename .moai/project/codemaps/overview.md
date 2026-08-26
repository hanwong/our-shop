# Architecture Overview (Placeholder)

> This is a placeholder. `our-shop` has no source code yet, so there is no
> existing architecture to document. Once implementation begins (via
> `/moai plan` → `/moai run`), re-run `/moai codemaps` to generate the full
> architecture documentation (overview, modules, dependencies, entry-points,
> data-flow) from the real codebase.

## Project goals (from `.moai/project/interview.md` and `.moai/project/harness-spec.yaml`)

- **Domain**: e-commerce-web (B2C fashion online shop)
- **Goal**: let customers search/browse products, add them to a cart, and
  complete checkout (including guest checkout) on a mobile-first web app.
- **Planned core features**: product catalog/search, cart, payment-gateway
  (PG) checkout, order/shipping-status tracking, product reviews, admin
  product/order management.
- **Constraints**: payment-data consistency is top priority; catalog
  response p95 <= 300ms; minimize personal-data collection.
