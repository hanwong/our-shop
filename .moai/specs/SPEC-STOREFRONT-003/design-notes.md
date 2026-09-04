# Design Notes: SPEC-STOREFRONT-003 — 홈 화면 상품 목록 그리드

> Design-phase deliverable (Conditional Design Route, plan-audit PASS 0.93). Written by manager-design.
> This file is a handoff for manager-develop's run-phase implementation — it does not touch `plan.md`'s
> body content (manager-develop/manager-spec ownership boundary).

## 0. Design premise — match existing conventions, invent nothing

This repo has no design system, no `src/components/ui/`, no design tokens file, no dark mode
(spec.md §3). Every decision below is derived from an existing sibling component rather than a
new convention:

| Decision | Precedent | File |
|---|---|---|
| Container width for a full-page view | `max-w-3xl` for a page with real content (`max-w-2xl` is the thinner stub/empty-state width) | `ProductDetailView.tsx` (`max-w-3xl`), `CartView.tsx` (`max-w-3xl`) |
| Empty-state container width | `max-w-xl`, centered text | `EmptyCart.tsx` |
| No-image placeholder | `aspect-square` + `bg-neutral-100` + centered `text-sm text-neutral-500` caption | `ProductGallery.tsx` (`data-testid="gallery-placeholder"`, caption "이미지 준비 중") |
| Price formatting | `formatWon` one-line duplicate per file (`Intl.NumberFormat("ko-KR")` + `"원"` suffix) — this SPEC does NOT introduce a shared utility module (spec.md §3 decided against `src/components/ui/`) | `CartView.tsx`, `ProductDetailView.tsx` |
| Heading scale | `text-2xl font-semibold text-neutral-900` for page title | `CartView.tsx` `<h1>` |
| Link visual weight (primary action button) | `rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white` | `EmptyCart.tsx`, `CartView.tsx` checkout link |

## 1. `ProductGrid` — layout

**File**: `src/components/product/ProductGrid.tsx` (server component, no `"use client"`).

Props: `{ items: ProductListItem[] }` (or equivalently the subset the card needs — `id`, `name`,
`price`, `images`). No pagination/service props — pure display layer per AC-STOREFRONT-041.

Wrapping page container (in `src/app/page.tsx`, replacing the current stub):

```
<main className="mx-auto max-w-5xl px-4 py-12">
```

`max-w-5xl` (wider than the `max-w-3xl` single-column screens) is the one new width value in this
SPEC — it is justified because a grid needs more horizontal room to show 3-4 columns before cards
get cramped; `max-w-3xl` would force a 2-column grid on most desktop viewports. This is a
layout-width decision, not a new design-token system.

Grid element:

```
<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
```

Breakpoint/column plan (Tailwind v4 default breakpoints, `sm: 640px`, `lg: 1024px`):

| Viewport | Columns | Rationale |
|---|---|---|
| `< 640px` (mobile default) | 2 | Matches `gallery` thumbnail-strip density; a 1-column list would under-use mobile width for a square-image card |
| `≥ 640px` (`sm:`) | 3 | Tablet / narrow desktop |
| `≥ 1024px` (`lg:`) | 4 | Desktop — caps here rather than growing further; `pageSize=20` (REQ-STOREFRONT-031) divides evenly into 4-column rows (5 rows), which is a nice-to-have, not a requirement |

`<ul>`/`<li>` semantics (not `<div>`) because the grid is a genuine list of products — matches
`ProductGallery.tsx`'s thumbnail-strip `<ul>`/`<li>` choice and `CartView.tsx`'s item list.

Each grid cell:

```tsx
<li key={item.id}>
  <ProductCard item={item} />
</li>
```

## 2. `ProductCard` — card treatment

**File**: `src/components/product/ProductCard.tsx` (server component, no `"use client"`).

Props: `{ item: Pick<ProductListItem, "id" | "name" | "price" | "images"> }`.

The whole card is the link (REQ-STOREFRONT-035, AC-STOREFRONT-033) — `<a>` wraps image + name +
price, matching the "card-as-link" shape already implied by `EmptyCart.tsx`'s and
`CartView.tsx`'s `<a>`-as-button pattern (this repo uses plain `<a>`, not `next/link`'s `<Link>`,
for internal navigation in `EmptyCart`/`CartView` — `ProductCard` follows that precedent for
consistency, since `next/link` vs `<a>` makes no behavioral difference for a same-origin route and
introducing `<Link>` here would be a new import pattern this repo hasn't otherwise adopted in a
card context). Native `<a>` keyboard-focuses and Enter-activates by platform guarantee
(REQ-STOREFRONT-041 / AC-STOREFRONT-040b, same classification as `plan.md §H-5` precedent).

```tsx
<a
  href={`/products/${item.id}`}
  className="group block overflow-hidden rounded-md border border-neutral-200 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
>
  {/* image block — see §3 */}
  <div className="p-3">
    <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
    <p className="mt-1 text-sm text-neutral-700">{formatWon(item.price)}</p>
  </div>
</a>
```

Decisions:

- **Border, not shadow** — `border border-neutral-200` at rest, `hover:border-neutral-400` on
  hover. This repo has zero existing `shadow-*` usage anywhere (`CartView`, `ProductDetailView`,
  `EmptyCart` are all borderless/flat); introducing a shadow here would be a new visual primitive.
  A border-color shift is the smallest possible hover affordance consistent with the flat existing
  style.
- **Focus ring** — `focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2`
  satisfies REQ-STOREFRONT-041's keyboard-focus requirement with a visible indicator distinct from
  the hover state (`:focus-visible` rather than `:focus` so mouse clicks don't show the ring).
  `ring-neutral-900` matches the existing "primary/emphasis" color already used for buttons
  (`bg-neutral-900` in `EmptyCart`/`CartView`).
- **`truncate` on the name** — a single line, ellipsis-clipped; the card treats the grid cell width
  as the truncation boundary, avoiding uneven card heights across a row (`ProductDetailView`'s
  detail heading has room to wrap since it's a single non-grid item, but a grid of cards needs
  uniform height, so `ProductCard`'s name row is deliberately single-line).
- **Price styling** — `text-sm text-neutral-700`, one step lighter than the name (`text-neutral-900`).
  Deliberately NOT scaled up like `ProductDetailView`'s `text-xl font-medium` price — that's a
  single-item detail view with room to emphasize; a grid card needs both name and price to fit a
  compact vertical stack without competing for visual weight. `font-medium` is reserved for the
  name only in the card context.
- **Price formatting function** — duplicate `formatWon` inline in `ProductCard.tsx`, matching the
  established per-file duplication precedent (see §0 table); do not extract to a shared module.

```ts
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}
```

## 3. Image block + no-image placeholder (REQ-STOREFRONT-033/037, AC-STOREFRONT-033/035)

Mirrors `ProductGallery.tsx`'s `aspect-square` + `bg-neutral-100` treatment exactly — same
aspect ratio, same background, same placeholder caption style — scaled down to card size (no
`priority`, no `fill`+thumbnail-strip complexity since a card shows exactly one image, never
switches).

**Has image** (`item.images[0]` defined):

```tsx
<div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
  <Image
    src={item.images[0]}
    alt={item.name}
    fill
    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    className="object-cover transition group-hover:scale-105"
  />
</div>
```

- `alt={item.name}` — satisfies REQ-STOREFRONT-041 ("이미지는 상품명을 포함한 대체 텍스트"). Kept as
  the bare product name (not `"{name} 대표 이미지"` like `ProductGallery`'s detail-view alt) because
  the card's accessible name is carried by the surrounding `<a>` as a whole; a screen reader
  announces image alt + adjacent text together, and `ProductGallery`'s longer alt exists to
  disambiguate multiple gallery images relative to each other — a concern that doesn't apply to a
  single per-card image.
- `sizes` — matches the grid's own breakpoints (2/3/4 columns → ~50vw/33vw/25vw), so Next Image
  requests an appropriately-sized image at each breakpoint rather than over-fetching.
- `group-hover:scale-105 transition` — a small, optional hover affordance consistent with the
  `<a className="group ...">` wrapper already declared in §2; purely decorative, not required by
  any REQ/AC. **If this is judged excess scope during run-phase, manager-develop may drop it** —
  it's the only element in this file not directly traced to a REQ, called out explicitly so it
  isn't mistaken for a hidden requirement.

**No image** (`item.images.length === 0` — REQ-STOREFRONT-037, AC-STOREFRONT-035):

```tsx
<div
  className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500"
  data-testid="product-card-placeholder"
>
  이미지 준비 중
</div>
```

Same caption text ("이미지 준비 중") as `ProductGallery.tsx`'s placeholder — REQ-STOREFRONT-037
explicitly calls this "the same pattern `ProductGallery` already adopted" for the detail screen,
so the copy is reused verbatim rather than reworded. `data-testid` follows the same
`{component}-placeholder` naming shape as `gallery-placeholder`, renamed to
`product-card-placeholder` to distinguish which component rendered it (useful for
AC-STOREFRONT-035's "renders without throwing, placeholder appears" test).

No rounded corners on the image block itself (unlike `ProductGallery`'s `rounded`) — the
**card's own** `rounded-md` (§2) already rounds the outer boundary, and the image sits flush
inside it (`overflow-hidden` on the card clips the image to match). This avoids doubled/mismatched
corner radii between the card and its image.

## 4. Empty-state message (REQ-STOREFRONT-036, AC-STOREFRONT-034)

Rendered directly in `src/app/page.tsx` when `totalCount === 0` — a small enough block that a
separate component would be over-decomposition (Enforce Simplicity ladder), matching how
`EmptyCart` is its own component only because `CartView`'s conditional-render branch needed to
return a fully separate screen shape, whereas here the empty case is a same-page inline branch.

```tsx
<div className="mx-auto max-w-xl px-4 py-16 text-center">
  <p className="text-sm text-neutral-600">아직 등록된 상품이 없습니다.</p>
</div>
```

- `max-w-xl`, centered, matches `EmptyCart.tsx`'s container width and centering exactly.
- Single sentence, no call-to-action link — unlike `EmptyCart` (which links back to "/"), there is
  nowhere further to send the visitor from an empty home page; a link to itself would be a no-op.
- Tone matches `EmptyCart`'s body copy register ("아직 담은 상품이 없습니다" → "아직 등록된 상품이
  없습니다"): same "아직 X이/가 없습니다" construction, same `text-sm`/`text-neutral-600` weight (one
  step lighter than `EmptyCart`'s heading, since this has no heading of its own — it sits under the
  page's own `<h1>`, unlike `EmptyCart` which is a full standalone screen).

## 5. `src/app/page.tsx` — assembly sketch (illustrative, not the final diff)

```tsx
import { ProductGrid } from "@/components/product/ProductGrid";
import { listProducts } from "@/features/catalog/services/product-service";

export default async function HomePage() {
  const result = await listProducts(new URLSearchParams());
  // result.ok is always true here per plan.md §J — parseListQuery always
  // falls back to defaults for an empty URLSearchParams (REQ-CATALOG-004);
  // this path has no reachable error branch per the SPEC's own edge-case
  // table (acceptance.md §2 row 1). Follow whatever `ServiceResult` narrowing
  // pattern product-service.ts already establishes for its `ok: true` shape.
  const { items, totalCount } = result.data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">our-shop</h1>

      {totalCount === 0 ? (
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-sm text-neutral-600">아직 등록된 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid items={items} />
        </div>
      )}
    </main>
  );
}
```

This is a design-intent sketch, not a prescription of the exact `ServiceResult`/`ProductListItem`
type shapes — manager-develop implements against the actual `product-service.ts` contract
(SPEC-CATALOG-001), matching whatever narrowing/error-branch idiom `getProductDetail`'s caller
(`src/app/products/[productId]/page.tsx`) already established for that same `ServiceResult`
pattern.

## 6. Traceability — REQ/AC coverage of design decisions

| REQ/AC | Design element |
|---|---|
| REQ-STOREFRONT-031/032, AC-031/032 | §5 — direct `listProducts` call in the server component, no client fetch |
| REQ-STOREFRONT-033/034/035, AC-033/039 | §1 grid, §2 card (image+name+price, full-card link) |
| REQ-STOREFRONT-036, AC-034 | §4 empty state |
| REQ-STOREFRONT-037, AC-035 | §3 no-image placeholder |
| REQ-STOREFRONT-038, AC-036 | §1/§2 — no pagination/sort/filter controls anywhere in the sketch |
| REQ-STOREFRONT-039, AC-037 | No `"use client"`, no `fetch(`, no `useEffect` anywhere in §1/§2/§5 |
| REQ-STOREFRONT-040, AC-038 | §2 card fields limited to name + price (no description/stock/category) |
| REQ-STOREFRONT-041, AC-040 | §2 focus-visible ring, §3 `alt={item.name}` |

## 7. What this design deliberately does NOT specify

Per spec.md §3 Out of Scope, this design carries no pagination/sort/filter UI, no header/footer/
nav, no reusable `src/components/ui/` extraction, no dark-mode variants, and no new
`next.config.ts` host entries. The `max-w-5xl` value in §1 is the only new width token introduced;
everything else in this file cites an existing sibling component as its source.
