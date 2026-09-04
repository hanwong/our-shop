import Image from "next/image";

import type { ProductListItem } from "@/features/catalog/types/product";

/**
 * SPEC-STOREFRONT-003 M1 — a single card in the home product grid
 * (REQ-STOREFRONT-033/034/035/037/040/041).
 *
 * Server component, no `"use client"` (REQ-STOREFRONT-039) — the card is a
 * link only; browser navigation handles the click, so no React state is
 * needed anywhere in this file.
 *
 * The whole card is the link (REQ-STOREFRONT-035): image, name, and price
 * all live inside a single <a>, matching the "card-as-link" shape already
 * used by EmptyCart.tsx / CartView.tsx (plain <a>, not next/link's <Link>,
 * for internal navigation — design-notes.md §2).
 *
 * Image-absent handling mirrors ProductGallery.tsx's placeholder pattern
 * (REQ-STOREFRONT-037) — same aspect-square + bg-neutral-100 treatment,
 * same "이미지 준비 중" copy — but the pattern is re-implemented here rather
 * than shared: ProductGallery is a client component (thumbnail-selection
 * state) and this repository does not introduce a shared UI library
 * (design-notes.md §3, plan.md §D).
 */

function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

export function ProductCard({
  product,
}: {
  product: Pick<ProductListItem, "id" | "name" | "price" | "images">;
}) {
  const image = product.images[0];

  return (
    <a
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-md border border-neutral-200 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
    >
      {image === undefined ? (
        <div
          className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500"
          data-testid="product-card-placeholder"
        >
          이미지 준비 중
        </div>
      ) : (
        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition group-hover:scale-105"
          />
        </div>
      )}

      <div className="p-3">
        <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
        <p className="mt-1 text-sm text-neutral-700">{formatWon(product.price)}</p>
      </div>
    </a>
  );
}
