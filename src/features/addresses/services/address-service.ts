import type { Address, AddressInput, ValidatedAddressFields } from "@/features/addresses/types/address";
import {
  createForUser,
  deleteOwned,
  findOwned,
  listByUser,
  setDefault,
  updateOwned,
  type AddressRow,
} from "@/features/addresses/repositories/address-repository";

/**
 * SPEC-ADDRESS-001 M3 — validation, ownership enforcement and response
 * assembly for the address domain (REQ-ADDRESS-004~008/011).
 *
 * @MX:ANCHOR fan-in target — every addresses API route and the
 * `/mypage/addresses` page enter this domain exclusively through the
 * functions below. The repository is never called from app/.
 * @MX:REASON this is the only place field validation and the ownership-vs-
 * not-found collapse are decided, so a regression here is either a
 * data-quality hole or an IDOR on a member-write endpoint, not a local bug.
 *
 * Framework-independent by design, matching review-service.ts / order-service.ts:
 * plain inputs in, discriminated results out — HTTP mapping stays in route.ts.
 */

export type AddressResult<T> = { ok: true; data: T } | { ok: false; status: 400 | 404; error: string };

const INVALID_RECIPIENT_NAME_ERROR = "Invalid 'recipientName' — expected non-empty text";
const INVALID_RECIPIENT_PHONE_ERROR = "Invalid 'recipientPhone' — expected non-empty text";
const INVALID_POSTAL_CODE_ERROR = "Invalid 'postalCode' — expected non-empty text";
const INVALID_ADDRESS_ERROR = "Invalid 'address' — expected non-empty text";
const NOT_FOUND_ERROR = "존재하지 않는 배송지입니다";

const MAX_FIELD_LENGTH = 200;

/** A trimmed, non-empty string within the length cap — the only shape every one of the four delivery fields accepts. */
function parseRequiredText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_FIELD_LENGTH) return null;
  return trimmed;
}

/**
 * Validates all four delivery fields, in field order, so the first invalid
 * one determines the error (REQ-ADDRESS-008 — no row is ever written on a
 * validation failure).
 */
function validateFields(input: AddressInput): AddressResult<ValidatedAddressFields> {
  const recipientName = parseRequiredText(input.recipientName);
  if (recipientName === null) {
    return { ok: false, status: 400, error: INVALID_RECIPIENT_NAME_ERROR };
  }

  const recipientPhone = parseRequiredText(input.recipientPhone);
  if (recipientPhone === null) {
    return { ok: false, status: 400, error: INVALID_RECIPIENT_PHONE_ERROR };
  }

  const postalCode = parseRequiredText(input.postalCode);
  if (postalCode === null) {
    return { ok: false, status: 400, error: INVALID_POSTAL_CODE_ERROR };
  }

  const address = parseRequiredText(input.address);
  if (address === null) {
    return { ok: false, status: 400, error: INVALID_ADDRESS_ERROR };
  }

  return { ok: true, data: { recipientName, recipientPhone, postalCode, address } };
}

function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    userId: row.userId,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    postalCode: row.postalCode,
    address: row.address,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** `GET /api/addresses` — the requesting member's own addresses only (REQ-ADDRESS-013). */
export async function listAddresses(userId: string): Promise<Address[]> {
  const rows = await listByUser(userId);
  return rows.map(toAddress);
}

/**
 * `POST /api/addresses` (REQ-ADDRESS-004/008). Validates the four delivery
 * fields, then creates the row; whether it becomes the member's default is
 * decided inside the repository transaction (`createForUser`), not here.
 */
export async function createAddress(userId: string, input: AddressInput): Promise<AddressResult<Address>> {
  const validated = validateFields(input);
  if (!validated.ok) {
    return validated;
  }

  const row = await createForUser(userId, validated.data);
  return { ok: true, data: toAddress(row) };
}

/**
 * `PATCH /api/addresses/[addressId]` (REQ-ADDRESS-005/008/011). Validation
 * runs BEFORE the ownership-checked write, so a malformed body is rejected
 * even for someone else's address id — REQ-ADDRESS-008's "no row changes on
 * a 400" holds regardless of ownership.
 */
export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput
): Promise<AddressResult<Address>> {
  const validated = validateFields(input);
  if (!validated.ok) {
    return validated;
  }

  const { count } = await updateOwned(userId, addressId, validated.data);
  if (count === 0) {
    return { ok: false, status: 404, error: NOT_FOUND_ERROR };
  }

  // updateOwned() already guaranteed exactly one row matched and was
  // written; re-read it (still ownership-scoped) to return the current
  // state rather than re-assembling it from the input we already trust.
  const row = await findOwned(userId, addressId);
  return { ok: true, data: toAddress(row as AddressRow) };
}

/** `DELETE /api/addresses/[addressId]` (REQ-ADDRESS-006/011). */
export async function removeAddress(userId: string, addressId: string): Promise<AddressResult<{ id: string }>> {
  const { count } = await deleteOwned(userId, addressId);
  if (count === 0) {
    return { ok: false, status: 404, error: NOT_FOUND_ERROR };
  }
  return { ok: true, data: { id: addressId } };
}

/** `PATCH /api/addresses/[addressId]/default` (REQ-ADDRESS-007/011). */
export async function setDefaultAddress(userId: string, addressId: string): Promise<AddressResult<{ id: string }>> {
  const changed = await setDefault(userId, addressId);
  if (!changed) {
    return { ok: false, status: 404, error: NOT_FOUND_ERROR };
  }
  return { ok: true, data: { id: addressId } };
}
