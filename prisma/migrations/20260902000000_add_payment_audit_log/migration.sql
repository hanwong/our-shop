-- SPEC-PAYMENT-001 M1 — payment domain (Order.paymentKey + PaymentEventSource
-- + PaymentAuditLog).
--
-- Additive only: this migration adds ONE nullable, unique column to the
-- existing "Order" table, creates one new enum type, and creates one new
-- table. It touches no column or constraint belonging to SPEC-AUTH-001,
-- SPEC-CATALOG-001/002, SPEC-CART-001, or the EXISTING "OrderItem" table.
-- The "OrderStatus" enum is UNCHANGED — `paid`/`cancelled` were already
-- reserved by SPEC-ORDER-001; this SPEC is the first to transition into them
-- at the application layer only (no schema change needed for that).
--
-- Authored by hand rather than by `prisma migrate dev` because no PostgreSQL
-- instance (and therefore no shadow database) is reachable in this sandbox —
-- the same constraint SPEC-ORDER-001's migration already recorded. See
-- progress.md §E.2 for the unapplied-migration gap.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentKey_key" ON "Order"("paymentKey");

-- CreateEnum
CREATE TYPE "PaymentEventSource" AS ENUM ('CONFIRM_API', 'WEBHOOK');

-- CreateTable
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "source" "PaymentEventSource" NOT NULL,
    "previousStatus" "OrderStatus" NOT NULL,
    "newStatus" "OrderStatus" NOT NULL,
    "paymentKey" TEXT,
    "transmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAuditLog_transmissionId_key" ON "PaymentAuditLog"("transmissionId");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_orderId_idx" ON "PaymentAuditLog"("orderId");

-- AddForeignKey
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
