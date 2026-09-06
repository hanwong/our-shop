import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ValidatedAddressFields } from "@/features/addresses/types/address";

/**
 * SPEC-ADDRESS-001 M3 — Prisma query layer for the address domain.
 *
 * Performs NO validation and applies NO defaults — it trusts the arguments it
 * is given, the same layering rule review-repository.ts and
 * product-repository.ts already follow (plan.md §C). Validation and response
 * assembly both live one layer up in address-service.ts.
 *
 * @MX:ANCHOR every conditional write below puts `userId` in the `where`
 * clause, never in an application-level comparison after a read.
 * @MX:REASON `where: { id, userId }` IS the entire authorization mechanism —
 * if `userId` were ever dropped from one of these `where` clauses, the
 * result is an immediate IDOR (plan.md §H, M3).
 */

export type AddressRow = Prisma.AddressGetPayload<Record<string, never>>;

/** Newest-first has no particular meaning here; matches listByProduct's convention of a stable, predictable order. */
export async function listByUser(userId: string): Promise<AddressRow[]> {
  return prisma.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/**
 * A single owned address, or `null` when it does not exist or is not
 * owned by `userId` — same `where`-clause ownership shape as the writes
 * below. Used to re-read a row AFTER a successful `updateOwned()` call, not
 * as a pre-write ownership check (that would reintroduce the TOCTOU window
 * M3 rejects — plan.md M3).
 */
export async function findOwned(userId: string, addressId: string): Promise<AddressRow | null> {
  return prisma.address.findFirst({ where: { id: addressId, userId } });
}

// @MX:TODO the concurrent-first-address race below is untested (M3 residual
// risk, acceptance.md §E): two simultaneous first-address requests can both
// observe `existingCount === 0` and both create with `isDefault: true`.
/**
 * Creates one address row for `userId`, inside a transaction with the
 * "does this member already have an address?" count so the two reads/writes
 * observe a more consistent view than two separate round trips would
 * (REQ-ADDRESS-004: the first address a member ever saves is automatically
 * their default).
 *
 * NOT fully race-free — plan.md M3 explicitly declines a partial-unique-index
 * defense here. Two concurrent first-address requests can both observe
 * `count === 0` and both create with `isDefault: true`; that residual race is
 * recorded in acceptance.md §E, not defended against by this function.
 */
export async function createForUser(
  userId: string,
  fields: ValidatedAddressFields
): Promise<AddressRow> {
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId } });
    return tx.address.create({
      data: { userId, ...fields, isDefault: existingCount === 0 },
    });
  });
}

/**
 * Conditional update — ownership lives in the `where` clause (M3's IDOR
 * defense). `count === 0` covers BOTH "no such address" and "not yours";
 * callers must not try to tell them apart (REQ-ADDRESS-011).
 */
export async function updateOwned(
  userId: string,
  addressId: string,
  fields: ValidatedAddressFields
): Promise<{ count: number }> {
  return prisma.address.updateMany({ where: { id: addressId, userId }, data: fields });
}

/** Conditional delete — same ownership-in-`where` shape as `updateOwned`. */
export async function deleteOwned(userId: string, addressId: string): Promise<{ count: number }> {
  return prisma.address.deleteMany({ where: { id: addressId, userId } });
}

// @MX:WARN the order of the two `updateMany` calls below is load-bearing —
// SET the target first, THEN unset the old default. Reversed, an ownership
// failure would first strip the member's existing default and only then
// discover it may not touch the target, leaving the member with NO default.
/**
 * The default-address transaction (REQ-ADDRESS-007, plan.md M3). SET the
 * target first, THEN unset the member's other default(s) — the order is
 * load-bearing: if the target update matches zero rows (not owned / does
 * not exist), the function returns `false` having changed NOTHING, so the
 * member's existing default survives an ownership failure. This is NOT a
 * rollback — Prisma's interactive transaction commits on a normal `return`;
 * safety here comes from the first `updateMany` matching zero rows, not from
 * an exception (plan.md M3 — do not add a `throw` "for symmetry").
 */
export async function setDefault(userId: string, addressId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.address.updateMany({
      where: { id: addressId, userId },
      data: { isDefault: true },
    });
    if (count === 0) return false;

    // Any OTHER address of this member that is currently default gets
    // unset. Matches zero rows on the member's very first default — that is
    // fine, updateMany is silently a no-op in that case.
    await tx.address.updateMany({
      where: { userId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    });
    return true;
  });
}
