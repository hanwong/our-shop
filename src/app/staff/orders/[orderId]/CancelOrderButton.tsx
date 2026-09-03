"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-ADMIN-001 M4 — the order-detail "취소" (cancel) action
 * (REQ-ADMIN-012~016).
 *
 * fetch()es PATCH /admin/api/orders/[orderId]/status with
 * { status: "cancelled" }. Deliberately NO optimistic update (design.md §3
 * — "낙관적 업데이트 없음"): on success this calls router.refresh() so the
 * Server Component re-reads the order's ACTUAL current state from the
 * database, rather than the UI assuming the transition applied. On failure,
 * the order's rendered status is untouched and an error message is shown.
 *
 * CSRF: the csrf_token cookie is deliberately NOT httpOnly (csrf.ts's doc
 * comment on buildCsrfCookie) specifically so client JS can read it and echo
 * it back as the X-CSRF-Token request header — the double-submit half of the
 * pattern src/lib/auth/csrf.ts already implements for /auth/refresh and
 * /auth/logout.
 */

/** Reads the csrf_token cookie value via a small inline document.cookie parse
 * — no new dependency needed for a single-cookie read. */
function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : "";
}

interface CancelFailureBody {
  error?: string;
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/admin/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "X-CSRF-Token": readCsrfToken(),
        },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (response.ok) {
        router.refresh();
        return;
      }

      const failure: CancelFailureBody = await response.json().catch(() => ({}));
      setError(failure.error ?? "주문을 취소하지 못했습니다");
    } catch {
      setError("주문을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={submitting}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {submitting ? "취소 처리 중…" : "취소"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
