import Link from "next/link";

/**
 * SPEC-STOREFRONT-001 M3 — the detail route's 404 screen (REQ-STOREFRONT-004).
 *
 * Rendered by the App Router when the page calls `notFound()`. It states the
 * situation in plain language and offers a way onward; it never surfaces the
 * service's internal error string, a stack, or any database detail.
 */
export default function ProductNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">상품을 찾을 수 없습니다</h1>
      <p className="mt-3 text-neutral-600">
        주소가 바뀌었거나 판매가 종료된 상품일 수 있습니다.
      </p>
      <Link className="mt-6 inline-block underline" href="/">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
