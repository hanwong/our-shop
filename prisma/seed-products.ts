/**
 * SPEC-BRAND-001 M4 — the "OUR" brand product catalog seed script
 * (REQ-BRAND-020/021/024).
 *
 * Standalone, dev-only, matching the prisma/seed-coupons.ts convention:
 *
 *   node prisma/seed-products.ts
 *
 * (Node 22.6+ strips TypeScript types natively — no `tsx`/`ts-node`
 * dependency needed; this repository has neither installed.)
 *
 * DATA PROVENANCE — every field below traces to a fixed SPEC artifact, not
 * to a value invented here:
 *
 * - Category names/slugs: design.md §2.1 (PROVISIONAL — standard Korean-to-
 *   romanization slugs, code-based fallback). **3 categories only** — the
 *   live DesignSync re-query (design.md §2.6/§3.5, CONFIRMED 2026-09-07)
 *   found exactly 3 filter buttons on the live mockup (derby/loafer/boots),
 *   reversing plan.md §B.7's earlier PROVISIONAL 4th-category ("몽크"/"monk")
 *   judgment call.
 * - Product name/subtitle/price: research.md §3.1 (`renderVals()` verbatim
 *   transcription).
 * - Category assignment: research.md §3.2 / plan.md §B.7 (4 source-explicit,
 *   2 judgment calls). 시로코→더비 remains PROVISIONAL per design.md §2.6/§8.3
 *   item 6 (Oxford counter-hypothesis unresolved). 하야마→더비 is a NEW
 *   provisional-derby assignment (design.md §2.6, this correction cycle) —
 *   for the SAME underlying reason as 시로코: no dedicated category exists
 *   in the live source for either product's specific closure/toe style, now
 *   that the 4th "monk" category has been confirmed absent from the source.
 * - Image paths: design.md §2.1 (PROVISIONAL — picsum.photos seed mapping,
 *   code-based fallback; `next.config.ts` already allow-lists this host).
 *
 * DELIBERATELY NOT SEEDED — the mockup's per-product size-range strings
 * ("250–330mm" / "260–320mm") are an `i % 3` index-derived rendering
 * artifact, NOT a product attribute (research.md §3.3, REQ-BRAND-024). No
 * field on this script's product rows carries anything resembling them.
 *
 * `stock`: no source specifies a per-product inventory count (out of scope
 * per spec.md §3 — sizes are display-only and stock is a single integer
 * signal, REQ-BRAND-022/023). A flat default of 10 is used for every row —
 * a schema-required filler value, not a brand fact, and freely edited by a
 * future admin-side SPEC.
 *
 * IDEMPOTENCY (REQ-BRAND-021): both Category and Product are `upsert`ed.
 * Category has a unique `slug`, so that is the natural key. Product carries
 * no unique field besides its Prisma-generated `id` (unlike
 * prisma/seed-coupons.ts's `code`), so this script assigns each of the six
 * rows a fixed, deterministic id (`brand-product-<romanized-name>`) and
 * upserts on THAT — re-running never creates duplicates and never requires
 * a schema change (a `@@unique([name])` migration would violate this SPEC's
 * zero-migration constraint, spec.md §2.2 / AC-BRAND-025).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** design.md §2.1 — standard romanization slugs, PROVISIONAL. */
interface SeedCategory {
  id: string;
  name: string;
  slug: string;
}

/**
 * 3 categories (design.md §2.6/§3.5, CONFIRMED 2026-09-07 — live DesignSync
 * re-query found exactly 3 filter buttons: 더비/로퍼/부츠, no "몽크"). This
 * reverses the earlier PROVISIONAL 4th-category ("몽크"/"monk") judgment.
 */
const SEED_CATEGORIES: SeedCategory[] = [
  { id: "brand-category-derby", name: "더비", slug: "derby" },
  { id: "brand-category-loafer", name: "로퍼", slug: "loafer" },
  { id: "brand-category-boots", name: "부츠", slug: "boots" },
];

/** research.md §3.1 (name/subtitle/price) + §3.2 (category, PROVISIONAL for 2 of 6). */
interface SeedProduct {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  categorySlug: string;
  /** design.md §2.1 — picsum.photos seed, PROVISIONAL. */
  imageSeed: string;
}

const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: "brand-product-siroko",
    name: "시로코",
    subtitle: "스트레이트 팁 · 블랙 칼프",
    price: 285000,
    categorySlug: "derby", // PROVISIONAL — design.md §2.6, Oxford 대립 가설 미해소
    imageSeed: "siroko",
  },
  {
    id: "brand-product-ejima",
    name: "에지마",
    subtitle: "홀컷 더비 · 다크 브라운",
    price: 240000,
    categorySlug: "derby",
    imageSeed: "ejima",
  },
  {
    id: "brand-product-nomachi",
    name: "노마치",
    subtitle: "페니 로퍼 · 스웨이드",
    price: 162000,
    categorySlug: "loafer",
    imageSeed: "nomachi",
  },
  {
    id: "brand-product-akita",
    name: "아키타",
    subtitle: "플레인 토 더비 · 블랙",
    price: 198000,
    categorySlug: "derby",
    imageSeed: "akita",
  },
  {
    id: "brand-product-seto",
    name: "세토",
    subtitle: "체르시 부츠 · 브라운",
    price: 276000,
    categorySlug: "boots",
    imageSeed: "seto",
  },
  {
    id: "brand-product-hayama",
    name: "하야마",
    subtitle: "몽크 스트랩 · 버건디",
    price: 225000,
    categorySlug: "derby", // PROVISIONAL — design.md §2.6, no dedicated "monk" category in live source (4th category reversed 2026-09-07)
    imageSeed: "hayama",
  },
];

const DEFAULT_STOCK = 10;

function describe(product: SeedProduct): string {
  return `${product.subtitle}. 주문을 받은 뒤 한 켤레씩 손으로 꿰매는 OUR의 수제화입니다.`;
}

function imageUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/800/800`;
}

async function main() {
  const categoryIdBySlug = new Map<string, string>();

  for (const category of SEED_CATEGORIES) {
    const result = await prisma.category.upsert({
      where: { slug: category.slug },
      create: { id: category.id, name: category.name, slug: category.slug },
      update: { name: category.name },
    });
    categoryIdBySlug.set(category.slug, result.id);
    console.log(`[seed-products] category ${result.slug} — ${result.name}`);
  }

  for (const product of SEED_PRODUCTS) {
    const categoryId = categoryIdBySlug.get(product.categorySlug);
    if (categoryId === undefined) {
      throw new Error(
        `[seed-products] unknown category slug "${product.categorySlug}" for product "${product.name}"`
      );
    }

    const result = await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        name: product.name,
        price: product.price,
        description: describe(product),
        images: [imageUrl(product.imageSeed)],
        stock: DEFAULT_STOCK,
        categoryId,
      },
      update: {
        name: product.name,
        price: product.price,
        description: describe(product),
        images: [imageUrl(product.imageSeed)],
        categoryId,
      },
    });
    console.log(`[seed-products] product ${result.id} — ${result.name} (${product.categorySlug})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("[seed-products] failed:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
