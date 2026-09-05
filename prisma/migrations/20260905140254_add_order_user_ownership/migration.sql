-- SPEC-ORDER-004 M1 — add the member ownership dimension to Order.
--
-- Authored by hand rather than by `prisma migrate dev` because no PostgreSQL
-- instance (and therefore no shadow database) is reachable in this sandbox or
-- in CI — DATABASE_URL there is a loopback placeholder and nothing in CI opens
-- a database connection (.github/workflows/ci.yml:46-59). Every one of the ten
-- migrations preceding this one was written the same way.
--
-- ALL THREE OPERATIONS ARE PURELY ADDITIVE. No column, constraint, index or row
-- belonging to any earlier SPEC is dropped, emptied or rewritten:
--
--   1. DROP NOT NULL on "guestId" — a relaxation on a fully-populated column.
--      Every existing row keeps the exact value it already has; the constraint
--      that is removed only ever forbade FUTURE rows from omitting it.
--      20260831120000_add_order_models/migration.sql:14-20 recorded this very
--      relaxation as non-destructive in advance, so the judgement is that
--      migration author's, not this one's.
--
--   2. ADD COLUMN "userId" (nullable, no default) — existing rows all become
--      NULL, and NULL here is a valid terminal state meaning "guest-owned".
--      It does NOT violate the XOR invariant of REQ-ORDER-048: those rows carry
--      a "guestId" and no "userId", which is exactly one owner.
--
--   3. CREATE INDEX + ADD CONSTRAINT — new objects only. The foreign key is
--      satisfied vacuously at apply time because every "userId" is NULL.
--
-- ROLLBACK DATA-LOSS POINT. Reverting this migration is safe ONLY while no row
-- has a non-NULL "userId". Once member orders exist:
--   * dropping "userId" destroys their member attribution irrecoverably, and
--   * restoring NOT NULL on "guestId" FAILS outright, because member-owned rows
--     carry a NULL "guestId" by construction.
-- Those rows must be dealt with first — re-attributed or archived — and that
-- decision is a data decision, not a schema one.

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "guestId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
