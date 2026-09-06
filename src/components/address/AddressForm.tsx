"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import type { Address } from "@/features/addresses/types/address";

/**
 * SPEC-ADDRESS-001 M5 — the add/edit form for one delivery address
 * (REQ-ADDRESS-004/005, REQ-ADDRESS-013).
 *
 * A self-contained client "island", the same pattern ReviewForm.tsx /
 * AddToCartButton.tsx already established: its `fetch` fires only from the
 * submit handler, never from render, and there is no local success/optimistic
 * list state — on success it calls `router.refresh()` so the Server
 * Component re-reads the actual address list from the database
 * (CancelOrderButton.tsx's idiom).
 *
 * Doubles as BOTH the "add" and the "edit" form: when `address` is provided,
 * it PATCHes `/api/addresses/[addressId]`; otherwise it POSTs
 * `/api/addresses`. The four delivery fields are plain JSX text inputs —
 * never `dangerouslySetInnerHTML` (ReviewForm.tsx's convention for
 * user-supplied text).
 *
 * CSRF: the `csrf_token` cookie is not httpOnly specifically so client JS can
 * echo it back as `X-CSRF-Token` — the same double-submit pattern
 * CancelOrderButton.tsx already implements for a member-write endpoint.
 */

/** Reads the csrf_token cookie value — mirrors CancelOrderButton.tsx's readCsrfToken(). */
function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : "";
}

const SUBMIT_FAILED = "배송지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요";

interface AddressFailureBody {
  error?: string;
}

export function AddressForm({
  address,
  onCancel,
}: {
  /** Present ⇒ edit mode (PATCH); absent ⇒ create mode (POST). */
  address?: Address;
  /** Rendered as a "취소" action next to submit — used by the inline edit toggle in AddressList.tsx. */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const recipientNameId = useId();
  const recipientPhoneId = useId();
  const postalCodeId = useId();
  const addressId = useId();

  const [recipientName, setRecipientName] = useState(address?.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(address?.recipientPhone ?? "");
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? "");
  const [addressLine, setAddressLine] = useState(address?.address ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = address !== undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const url = isEdit ? `/api/addresses/${address.id}` : "/api/addresses";
      const method = isEdit ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          "X-CSRF-Token": readCsrfToken(),
        },
        body: JSON.stringify({
          recipientName,
          recipientPhone,
          postalCode,
          address: addressLine,
        }),
      });

      if (response.ok) {
        if (!isEdit) {
          setRecipientName("");
          setRecipientPhone("");
          setPostalCode("");
          setAddressLine("");
        }
        router.refresh();
        onCancel?.();
        return;
      }

      const failure: AddressFailureBody = await response.json().catch(() => ({}));
      setError(failure.error ?? SUBMIT_FAILED);
    } catch {
      setError(SUBMIT_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormField
        id={recipientNameId}
        label="받는 사람"
        value={recipientName}
        onChange={(event) => setRecipientName(event.target.value)}
        required
      />
      <FormField
        id={recipientPhoneId}
        label="연락처"
        value={recipientPhone}
        onChange={(event) => setRecipientPhone(event.target.value)}
        required
      />
      <FormField
        id={postalCodeId}
        label="우편번호"
        value={postalCode}
        onChange={(event) => setPostalCode(event.target.value)}
        required
      />
      <FormField
        id={addressId}
        label="주소"
        value={addressLine}
        onChange={(event) => setAddressLine(event.target.value)}
        required
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {isEdit ? "수정 저장" : "배송지 추가"}
        </Button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-[var(--space-4)] py-[var(--space-2)] text-sm font-medium text-text"
          >
            취소
          </button>
        ) : null}
      </div>

      {error !== null ? (
        <div role="alert" aria-live="polite" className="text-sm text-red-600">
          {error}
        </div>
      ) : null}
    </form>
  );
}
