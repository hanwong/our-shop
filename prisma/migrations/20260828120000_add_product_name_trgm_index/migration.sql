-- SPEC-CATALOG-002 M1 — pg_trgm extension + GIN trigram index on Product.name.
--
-- Additive only: creates one extension and one index. No table, column or
-- constraint belonging to SPEC-AUTH-001 (User / OAuthAccount / RefreshToken) or
-- SPEC-CATALOG-001 (Category / Product) is altered or dropped.
--
-- WHY THIS INDEX: REQ-CATALOG-018 matches product names with a case-insensitive
-- substring search, which PostgreSQL executes as `name ILIKE '%term%'`. A
-- leading wildcard defeats a B-tree index — B-tree can only seek a known
-- prefix — so the existing Product_createdAt/price/categoryId indexes leave the
-- search as a sequential scan. A GIN index over trigrams is the standard
-- PostgreSQL answer to exactly this pattern (plan.md §2.3, alternative A).
--
-- Authored by hand rather than by `prisma migrate dev` because no PostgreSQL
-- instance (and therefore no shadow database) is reachable in this sandbox —
-- the same constraint SPEC-CATALOG-001's 20260828015400_add_catalog_models
-- migration recorded. See progress.md §E.2 for the unapplied-migration gap.

-- CreateExtension
-- IF NOT EXISTS keeps this replayable on a managed platform (Neon, Supabase)
-- that pre-installs pg_trgm. Must precede the index: gin_trgm_ops does not
-- exist as an operator class until the extension is installed.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
