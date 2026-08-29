-- SPEC-CART-001 M1 — cart domain (Cart + CartItem).
--
-- Additive only: this migration creates two new tables and touches no table,
-- column or constraint belonging to SPEC-AUTH-001 (User / OAuthAccount /
-- RefreshToken) or SPEC-CATALOG-001/002 (Category / Product). The three
-- ALTER TABLE statements at the end add THIS migration's own foreign keys;
-- they alter only Cart and CartItem.
--
-- Authored by hand rather than by `prisma migrate dev` because no PostgreSQL
-- instance (and therefore no shadow database) is reachable in this sandbox —
-- the same constraint SPEC-CATALOG-001's 20260828015400_add_catalog_models
-- migration recorded. The statements below are the verbatim rendering emitted
-- by `prisma migrate diff --from-empty --to-schema-datamodel
-- prisma/schema.prisma --script` for the two new models, with the pre-existing
-- SPEC-AUTH-001 / SPEC-CATALOG-001/002 statements removed. See progress.md
-- §E.2 for the unapplied-migration gap.
--
-- NOTE ON THE OWNERSHIP COLUMNS: "userId" and "guestId" are both NULLABLE and
-- there is deliberately NO CHECK constraint enforcing that exactly one is set
-- (plan.md §2.1). The uniqueness indexes below still give the guarantee that
-- matters — Postgres excludes NULLs from a UNIQUE index, so "at most one cart
-- per member" and "at most one cart per guest cookie" both hold — while the
-- "exactly one owner" half is held in the repository layer, which exposes only
-- createUserCart() and createGuestCart() and so has no path that writes both
-- columns or neither. A later SPEC may tighten this with a CHECK constraint;
-- nothing here blocks that.

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_guestId_key" ON "Cart"("guestId");

-- CreateIndex
CREATE INDEX "Cart_guestId_idx" ON "Cart"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
