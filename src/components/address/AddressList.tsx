"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AddressForm } from "@/components/address/AddressForm";
import type { Address } from "@/features/addresses/types/address";

/**
 * SPEC-ADDRESS-001 M5 — the address list + default badge + per-row actions
 * (REQ-ADDRESS-013). Receives its data from the Server Component
 * (`/mypage/addresses/page.tsx`) as a prop — "server에서 데이터 받음" (plan.md
 * M5) means the initial list is server-fetched, not that this component is
 * itself server-only; the delete / set-default / inline-edit actions below
 * need client interactivity, the same reason CancelOrderButton.tsx is a
 * client component even though the page around it is a Server Component.
 *
 * No optimistic update anywhere in this file (matching CancelOrderButton.tsx
 * / ReviewForm.tsx's discipline) — every mutation calls `router.refresh()` on
 * success so the Server Component re-reads the actual current state.
 */

function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : "";
}

const DELETE_FAILED = "배송지를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요";
const SET_DEFAULT_FAILED = "기본 배송지로 지정하지 못했습니다. 잠시 후 다시 시도해 주세요";

function AddressRow({ address }: { address: Address }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/addresses/${address.id}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": readCsrfToken() },
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      const failure: { error?: string } = await response.json().catch(() => ({}));
      setError(failure.error ?? DELETE_FAILED);
    } catch {
      setError(DELETE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/addresses/${address.id}/default`, {
        method: "PATCH",
        headers: { "X-CSRF-Token": readCsrfToken() },
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      const failure: { error?: string } = await response.json().catch(() => ({}));
      setError(failure.error ?? SET_DEFAULT_FAILED);
    } catch {
      setError(SET_DEFAULT_FAILED);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-md border border-divider p-4">
        <AddressForm address={address} onCancel={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="rounded-md border border-divider p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-text">
            {address.recipientName}
            {address.isDefault ? (
              <span className="ml-2 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-white">
                기본 배송지
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-neutral-600">{address.recipientPhone}</p>
          <p className="mt-1 text-sm text-neutral-600">
            ({address.postalCode}) {address.address}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!address.isDefault ? (
            <button
              type="button"
              onClick={handleSetDefault}
              disabled={busy}
              className="text-sm font-medium text-accent disabled:opacity-60"
            >
              기본으로 설정
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-sm font-medium text-text disabled:opacity-60"
          >
            수정
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-sm font-medium text-red-600 disabled:opacity-60"
          >
            삭제
          </button>
        </div>
      </div>
      {error !== null ? (
        <p role="alert" aria-live="polite" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function AddressList({ addresses }: { addresses: Address[] }) {
  if (addresses.length === 0) {
    return <p className="text-sm text-neutral-600">저장된 배송지가 없습니다.</p>;
  }

  return (
    <ul className="space-y-3">
      {addresses.map((address) => (
        <AddressRow key={address.id} address={address} />
      ))}
    </ul>
  );
}
