import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CATALOG-001 M6 — response-time measurement for the catalog endpoints.
 * Traces: AC-CATALOG-016, REQ-CATALOG-016 (p95 within 300ms).
 *
 * WHAT THIS TEST DOES AND DOES NOT ESTABLISH — read before trusting a pass.
 *
 * AC-CATALOG-016 asks for the p95 of the two endpoints against a seeded
 * database of 50+ products. No PostgreSQL is reachable in this sandbox (there
 * is no .env and no server; SPEC-AUTH-001 documented the same constraint), so
 * the database half of that budget CANNOT be measured here. This test measures
 * the APPLICATION-LAYER path only — URL parsing, validation, DTO assembly and
 * JSON serialisation — with the repository stubbed to return a 100-row page
 * synchronously.
 *
 * A pass therefore does NOT discharge AC-CATALOG-016; the AC is recorded as a
 * partial with an explicit gap in progress.md §E.2. What a pass DOES establish
 * is that the code this SPEC adds contributes a negligible, non-degrading share
 * of the 300ms budget — which is the part of the AC that is measurable here,
 * and enough to catch a quadratic assembly regression or an accidental
 * synchronous block in the response path.
 *
 * The methodology follows SPEC-AUTH-001's AC-AUTH-005 timing test (repeated
 * samples, percentile over the sample set) with p95 substituted for its median.
 */

const findProductsPage = vi.fn();
const findProductById = vi.fn();
const findCategoryIdBySlug = vi.fn();

vi.mock("@/features/catalog/repositories/product-repository", () => ({
  findProductsPage: (...args: unknown[]) => findProductsPage(...args),
  findProductById: (...args: unknown[]) => findProductById(...args),
}));

vi.mock("@/features/catalog/repositories/category-repository", () => ({
  findCategoryIdBySlug: (...args: unknown[]) => findCategoryIdBySlug(...args),
}));

/** AC-CATALOG-016 requires N >= 30; 50 gives the p95 a less coarse rank. */
const SAMPLE_SIZE = 50;
const P95_BUDGET_MS = 300;

/** Seeded fixture size — the AC's "최소 50개 이상" of catalog rows. */
const SEEDED_ROWS = 100;

function row(i: number) {
  return {
    id: `prod_${i}`,
    name: `상품 ${i}`,
    price: 10000 + i,
    images: [`https://cdn.example.com/${i}-a.jpg`, `https://cdn.example.com/${i}-b.jpg`],
    stock: i % 7,
    category: { id: "cat-tops", name: "상의", slug: "tops" },
    createdAt: new Date("2026-08-20T01:02:03.000Z"),
    description: "가볍고 통기성 좋은 여름용 린넨 셔츠.".repeat(10),
    updatedAt: new Date("2026-08-21T04:05:06.000Z"),
  };
}

/** Nearest-rank p95 over the sample set. */
function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[rank]!;
}

beforeEach(() => {
  findProductsPage.mockReset().mockResolvedValue({
    rows: Array.from({ length: SEEDED_ROWS }, (_, i) => row(i)),
    totalCount: SEEDED_ROWS,
  });
  findProductById.mockReset().mockResolvedValue(row(1));
  findCategoryIdBySlug.mockReset().mockResolvedValue("cat-tops");
});

describe("AC-CATALOG-016 — application-layer response time (database excluded)", () => {
  it(`list endpoint p95 stays within ${P95_BUDGET_MS}ms across N=${SAMPLE_SIZE} samples`, async () => {
    const { GET } = await import("@/app/api/products/route");

    const durations: number[] = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const request = new Request("http://localhost/api/products?pageSize=100");
      const start = performance.now();
      const response = await GET(request);
      await response.json();
      durations.push(performance.now() - start);
      expect(response.status).toBe(200);
    }

    const observed = p95(durations);
    console.log(
      `[AC-CATALOG-016] GET /api/products p95=${observed.toFixed(2)}ms ` +
        `(N=${SAMPLE_SIZE}, ${SEEDED_ROWS} rows/page, DATABASE TIME EXCLUDED — budget ${P95_BUDGET_MS}ms)`
    );

    expect(observed).toBeLessThan(P95_BUDGET_MS);
  }, 30000);

  it(`detail endpoint p95 stays within ${P95_BUDGET_MS}ms across N=${SAMPLE_SIZE} samples`, async () => {
    const { GET } = await import("@/app/api/products/[productId]/route");

    const durations: number[] = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = performance.now();
      const response = await GET(new Request("http://localhost/api/products/prod_1"), {
        params: Promise.resolve({ productId: "prod_1" }),
      });
      await response.json();
      durations.push(performance.now() - start);
      expect(response.status).toBe(200);
    }

    const observed = p95(durations);
    console.log(
      `[AC-CATALOG-016] GET /api/products/:id p95=${observed.toFixed(2)}ms ` +
        `(N=${SAMPLE_SIZE}, DATABASE TIME EXCLUDED — budget ${P95_BUDGET_MS}ms)`
    );

    expect(observed).toBeLessThan(P95_BUDGET_MS);
  }, 30000);

  it("assembly cost scales linearly with page size, not quadratically", async () => {
    // The regression this guards: a per-item lookup that walks the whole page
    // would make a 100-row page cost ~100x a 10-row page rather than ~10x.
    const { GET } = await import("@/app/api/products/route");

    async function timePage(rows: number): Promise<number> {
      findProductsPage.mockResolvedValue({
        rows: Array.from({ length: rows }, (_, i) => row(i)),
        totalCount: rows,
      });
      const samples: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await (await GET(new Request(`http://localhost/api/products?pageSize=100`))).json();
        samples.push(performance.now() - start);
      }
      return p95(samples);
    }

    const small = await timePage(10);
    const large = await timePage(100);

    console.log(`[AC-CATALOG-016] assembly p95: 10 rows=${small.toFixed(2)}ms 100 rows=${large.toFixed(2)}ms`);

    // 10x the rows must not cost 50x the time. Deliberately loose — this is a
    // shape check against quadratic blowup, not a throughput benchmark, and a
    // tight ratio would be flaky on a shared machine at sub-millisecond scale.
    expect(large).toBeLessThan(Math.max(small * 50, 50));
  }, 30000);
});
