-- SPEC-ADDRESS-001 M1 — saved delivery-address domain (member-only).
--
-- Authored by hand rather than by `prisma migrate dev` because no PostgreSQL
-- instance (and therefore no shadow database) is reachable in this sandbox or
-- in CI — DATABASE_URL there is a loopback placeholder and nothing in CI opens
-- a database connection (.github/workflows/ci.yml:46-59). Every one of the
-- eleven migrations preceding this one was written the same way. (A reachable
-- demo Postgres WAS found at run-phase in this particular working tree and
-- this migration was applied and verified against it — see progress.md §E —
-- but the file itself is still hand-authored, matching every prior migration
-- in this repository, so the SQL stays reviewable independent of any live DB.)
--
-- PURELY ADDITIVE. No column, constraint, index, or row belonging to any
-- earlier SPEC is dropped, emptied, or rewritten: one new table ("Address"),
-- one new index, one new foreign key. Nothing else in the database changes.

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
