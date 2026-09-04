import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveAdminSession } from "@/features/admin/services/admin-session";
import {
  listCategoriesForAdmin,
  listProductsForAdmin,
} from "@/features/admin/repositories/admin-product-repository";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type AdminProductListItemDTO,
  type PaginatedAdminProducts,
} from "@/features/admin/types/admin";

/**
 * SPEC-ADMIN-002 M3 — `/staff/products` (REQ-ADMIN-021/022/023/037/040).
 *
 * A Server Component that calls the repository DIRECTLY — no `fetch`, no
 * intermediate `GET /staff/api/products`. That route is deliberately not built
 * (design.md §2): wrapping an in-process function call in an HTTP round trip
 * would buy nothing and would leave an auth/pagination/serialization surface to
 * maintain with no consumer.
 *
 * `resolveAdminSession()` runs BEFORE any product data is read, and redirects
 * on `null` — no cookie, expired, revoked, or a valid non-admin session, all
 * four collapsing to the same reason-blind outcome (REQ-ADMIN-037). The page
 * lives under `/staff`, outside the `/admin/:path*` middleware matcher, because
 * top-level browser navigation cannot carry an Authorization header
 * (REQ-ADMIN-040; SPEC-ADMIN-001 design.md §1 established this).
 *
 * Unlike every customer-facing product view, this list SHOWS sellability — it
 * is where a suspended product is found and restored.
 */

/** Mirrors staff/orders/page.tsx's formatWon — a won integer, thousands grouped. */
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso)
  );
}

/** Absent or invalid (non-integer, < 1) falls back to DEFAULT_PAGE — corrected, never rejected. */
function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_PAGE;
}

/** Absent or invalid falls back to DEFAULT_PAGE_SIZE; above MAX_PAGE_SIZE is clamped down. */
function parsePageSize(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(n, MAX_PAGE_SIZE);
}

/** A blank or whitespace-only term is no filter at all, not a search for nothing. */
function parseSearch(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

export default async function StaffProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string; pageSize?: string }>;
}) {
  const sp = await searchParams;

  // The gate runs first: data must not be read and then discarded.
  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    redirect("/staff/login");
  }

  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const categoryId = sp.category || undefined;
  const search = parseSearch(sp.search);

  const [{ rows, totalCount }, categories] = await Promise.all([
    listProductsForAdmin({ page, pageSize, categoryId, search }),
    listCategoriesForAdmin(),
  ]);

  const result: PaginatedAdminProducts = {
    items: rows.map(
      (row): AdminProductListItemDTO => ({
        id: row.id,
        name: row.name,
        price: row.price,
        stock: row.stock,
        isActive: row.isActive,
        categoryName: row.category.name,
        createdAt: row.createdAt.toISOString(),
      })
    ),
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };

  const filters = { category: categoryId, search };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">관리자 상품 목록</h1>
        <a
          href="/staff/products/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          새 상품 등록
        </a>
      </div>

      <form method="get" action="/staff/products" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="search" className="block text-sm text-neutral-600">
            상품명 검색
          </label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search ?? ""}
            className="mt-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm text-neutral-600">
            카테고리
          </label>
          <select
            id="category"
            name="category"
            defaultValue={categoryId ?? ""}
            className="mt-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          검색
        </button>
      </form>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-600">
            <th className="py-2" scope="col">
              상품명
            </th>
            <th className="py-2" scope="col">
              카테고리
            </th>
            <th className="py-2" scope="col">
              가격
            </th>
            <th className="py-2" scope="col">
              재고
            </th>
            <th className="py-2" scope="col">
              판매 상태
            </th>
            <th className="py-2" scope="col">
              등록일시
            </th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-100">
              <td className="py-2">
                <a href={`/staff/products/${item.id}`} className="font-medium text-neutral-900">
                  {item.name}
                </a>
              </td>
              <td className="py-2">{item.categoryName}</td>
              <td className="py-2">{formatWon(item.price)}</td>
              <td className="py-2">{item.stock}</td>
              <td className="py-2">
                <span
                  className={
                    item.isActive
                      ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"
                      : "rounded-full bg-neutral-200 px-2 py-1 text-xs text-neutral-700"
                  }
                >
                  {item.isActive ? "판매 중" : "판매 중단"}
                </span>
              </td>
              <td className="py-2">{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">조건에 맞는 상품이 없습니다.</p>
      ) : null}

      <nav aria-label="페이지네이션" className="mt-6 flex gap-4 text-sm">
        {page > 1 ? (
          <a href={`/staff/products${queryString({ ...filters, page: page - 1 })}`}>이전</a>
        ) : null}
        {page < result.totalPages ? (
          <a href={`/staff/products${queryString({ ...filters, page: page + 1 })}`}>다음</a>
        ) : null}
      </nav>
    </main>
  );
}
