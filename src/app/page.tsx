import Link from "next/link";

/**
 * SPEC-STOREFRONT-001 — home route stub (spec.md §4 minimal exception).
 *
 * Without a page at `/`, the dev server's first screen is a 404 and there is
 * no hand-navigable entry point into the detail screen. This stub exists only
 * to provide that entry point: home-screen content design, product listings,
 * and layout are excluded by spec.md §3.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">our-shop</h1>
      <p className="mt-4 text-neutral-600">
        상품 상세 화면을 확인하려면 아래 링크로 이동하세요.
      </p>
      <Link className="mt-6 inline-block underline" href="/products/p-1">
        상품 상세 예시 보기
      </Link>
    </main>
  );
}
