/**
 * SPEC-ADDRESS-001 M2 — address domain types and the wire DTOs the addresses
 * API and screen exchange.
 *
 * Framework-independent by design, matching features/reviews/types/review.ts
 * and features/orders/types/order.ts: nothing here imports from `next/*` or
 * `@prisma/client`; the service layer serializes `Date` to an ISO-8601
 * `string` once, at the response-assembly boundary.
 *
 * Deliberately absent: `deliveryMemo` (REQ-ADDRESS-002, plan.md M1) — a saved
 * address is a place, not a per-shipment instruction, so that field stays on
 * `Order.deliveryMemo` and is never modeled here.
 */

/** The shape a create/update request body is expected to carry, pre-validation. */
export interface AddressInput {
  recipientName?: unknown;
  recipientPhone?: unknown;
  postalCode?: unknown;
  address?: unknown;
}

/** One persisted address, projected onto the wire shape. */
export interface Address {
  id: string;
  userId: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The four validated delivery fields, ready for a repository write. */
export interface ValidatedAddressFields {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
}
