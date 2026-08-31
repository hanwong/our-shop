-- SPEC-ORDER-001 M1 — order domain (OrderStatus + Order + OrderItem).
--
-- Additive only: this migration creates one enum type and two new tables, and
-- touches no table, column or constraint belonging to SPEC-AUTH-001 (User /
-- OAuthAccount / RefreshToken), SPEC-CATALOG-001/002 (Category / Product) or
-- SPEC-CART-001 (Cart / CartItem). The three ALTER TABLE statements at the end
-- add THIS migration's own foreign keys; they alter only Order and OrderItem.
--
-- Authored by hand rather than by `prisma migrate dev` because no PostgreSQL
-- instance (and therefore no shadow database) is reachable in this sandbox —
-- the same constraint SPEC-CATALOG-001's and SPEC-CART-001's migrations already
-- recorded. See progress.md §E.2 for the unapplied-migration gap.
--
-- NOTE ON THE OWNERSHIP COLUMN: "guestId" is NOT NULL and there is deliberately
-- NO "userId" column (design.md §1.4). This SPEC builds guest checkout only —
-- a server-rendered page cannot identify a member at all (research.md §6) — and
-- the absence of the column is what makes a member-owned order unrepresentable
-- rather than merely undocumented. The follow-up member-checkout SPEC owns the
-- migration that adds "userId" and relaxes this NOT NULL; that relaxation is a
-- plain DROP NOT NULL on a fully-populated column, so it is not destructive.

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending_payment', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending_payment',
    "guestId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "deliveryMemo" TEXT,
    "itemsSubtotal" INTEGER NOT NULL,
    "shippingFee" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Order_guestId_idx" ON "Order"("guestId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
