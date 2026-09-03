import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveAdminSession } from "@/features/admin/services/admin-session";
import { listOrdersForAdmin } from "@/features/admin/repositories/admin-order-repository";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type AdminOrderListItemDTO,
  type PaginatedAdminOrders,
} from "@/features/admin/types/admin";

/**
 * SPEC-ADMIN-001 M3 — `/staff/orders` (REQ-ADMIN-007~009).
 *
 * This is where AC-ADMIN-006's deferred server-side half actually lives
 * (progress.md §E.2 M2 PARTIAL note): `resolveAdminSession()` re-reads the
 * refresh-token cookie on every request and, on `null` — no cookie,
 * expired, revoked, or a valid non-admin session, all collapsing to the
 * SAME reason-blind result per REQ-ADMIN-003 — redirects to `/staff/login`
 * BEFORE any admin order data is fetched (REQ-ADMIN-017: this session
 * check is never reused from a prior page entry).
 *
 * Calls `listOrdersForAdmin()` DIRECTLY (no `fetch`, no intermediate
 * `GET /admin/api/orders` route — design.md §3's explicit "직접 호출"
 * instruction; that route is out of scope for this SPEC, plan.md §3).
 */

const ORDER_STATUSES: readonly AdminOrderListItemDTO["status"][] = [
  "pending_payment",
  "paid",
  "cancelled",
];

const STATUS_LABEL: Record<AdminOrderListItemDTO["status"], string> = {
  pending_payment: "결제 대기",
  paid: "결제 완료",
  cancelled: "취소됨",
};

/** Mirrors ProductDetailView.formatWon — a won integer, thousands grouped. */
function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function formatOrderDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso)
  );
}

/** Absent or invalid (non-integer, < 1) falls back to DEFAULT_PAGE — never rejected. */
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

/** An unrecognized value is treated as "no filter" — never a 500/crash (REQ-ADMIN-008). */
function parseStatus(raw: string | undefined): AdminOrderListItemDTO["status"] | undefined {
  return (ORDER_STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as AdminOrderListItemDTO["status"])
    : undefined;
}

function statusQuery(status: AdminOrderListItemDTO["status"] | undefined): string {
  return status ? `&status=${status}` : "";
}

export default async function StaffOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; pageSize?: string }>;
}) {
  const sp = await searchParams;

  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    redirect("/staff/login");
  }

  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const status = parseStatus(sp.status);

  const { rows, totalCount } = await listOrdersForAdmin({ page, pageSize, status });

  const result: PaginatedAdminOrders = {
    items: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      recipientName: row.recipientName,
      totalAmount: row.totalAmount,
      createdAt: row.createdAt.toISOString(),
    })),
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">관리자 주문 목록</h1>

      <nav aria-label="상태 필터" className="mt-6 flex gap-3 text-sm">
        <a
          href="/staff/orders"
          className={!status ? "font-semibold text-neutral-900" : "text-neutral-600"}
        >
          전체
        </a>
        {ORDER_STATUSES.map((s) => (
          <a
            key={s}
            href={`/staff/orders?status=${s}`}
            className={status === s ? "font-semibold text-neutral-900" : "text-neutral-600"}
          >
            {STATUS_LABEL[s]}
          </a>
        ))}
      </nav>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-600">
            <th className="py-2" scope="col">
              주문번호
            </th>
            <th className="py-2" scope="col">
              상태
            </th>
            <th className="py-2" scope="col">
              수령인
            </th>
            <th className="py-2" scope="col">
              총액
            </th>
            <th className="py-2" scope="col">
              주문일시
            </th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-100">
              <td className="py-2 font-mono">{item.orderNumber}</td>
              <td className="py-2">{STATUS_LABEL[item.status]}</td>
              <td className="py-2">{item.recipientName}</td>
              <td className="py-2">{formatWon(item.totalAmount)}</td>
              <td className="py-2">{formatOrderDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <nav aria-label="페이지네이션" className="mt-6 flex gap-4 text-sm">
        {page > 1 ? (
          <a href={`/staff/orders?page=${page - 1}${statusQuery(status)}`}>이전</a>
        ) : null}
        {page < result.totalPages ? (
          <a href={`/staff/orders?page=${page + 1}${statusQuery(status)}`}>다음</a>
        ) : null}
      </nav>
    </main>
  );
}
