"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * SPEC-STOREFRONT-001 M4 — the product image gallery
 * (REQ-STOREFRONT-010..014, 015).
 *
 * The client boundary stops here. This is the only part of the detail screen
 * holding state, so marking the whole page `"use client"` would drag the
 * description copy into the client bundle for nothing (plan.md §F).
 *
 * Props are limited to the two serializable values the gallery actually needs.
 * The full ProductDetail is deliberately not passed: it would cross the
 * server/client boundary carrying fields the gallery has no business knowing.
 *
 * @MX:NOTE thumbnails are native <button> elements rather than a roving-tabindex
 * ARIA widget. For a handful of thumbnails, hand-rolling the tab pattern costs
 * several times the code and is itself a common source of accessibility bugs;
 * <button> gets Tab traversal, Enter/Space activation, and the focus ring from
 * the browser (plan.md §E, REQ-STOREFRONT-015).
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // `noUncheckedIndexedAccess` types this as `string | undefined`, and that is
  // load-bearing rather than noise: it makes the compiler force the empty-array
  // branch below (REQ-STOREFRONT-013). A non-null assertion here would switch
  // off exactly the guarantee being relied on (plan.md §L).
  const selected = images[selectedIndex];

  if (selected === undefined) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded bg-neutral-100 text-sm text-neutral-500"
        data-testid="gallery-placeholder"
      >
        이미지 준비 중
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative aspect-square w-full overflow-hidden rounded bg-neutral-100">
        <Image
          src={selected}
          alt={`${productName} 대표 이미지`}
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          className="object-cover"
          priority
        />
      </div>

      {/* A single image needs no way to switch between images
          (REQ-STOREFRONT-011), so the strip is not rendered at all. */}
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2">
          {images.map((image, index) => (
            <li key={image}>
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-current={index === selectedIndex ? "true" : undefined}
                className={`relative block h-16 w-16 overflow-hidden rounded border-2 ${
                  index === selectedIndex ? "border-neutral-900" : "border-transparent"
                }`}
              >
                <Image
                  src={image}
                  alt={`${productName} 썸네일 ${index + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
