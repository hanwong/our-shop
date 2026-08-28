import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-CATALOG-002 M5 — response time for a request carrying `search`.
 * Traces: AC-CATALOG-030, REQ-CATALOG-016B (p95 within 300ms).
 *
 * WHAT THIS TEST DOES AND DOES NOT ESTABLISH — read before trusting a pass.
 *
 * AC-CATALOG-030 asks for the p95 of a searched list request against a seeded
 * database. No PostgreSQL is reachable in this sandbox, so THE DATABASE HALF OF
 * THE BUDGET — the part a keyword search actually stresses — CANNOT be measured
 * here. That is the more important half: the risk REQ-CATALOG-016B carries is a
 * sequential scan over a growing catalog, and this test cannot see it.
 *
 * What is measured is the APPLICATION-LAYER path only (URL parsing, term
 * normalisation, where-clause construction, DTO assembly, JSON serialisation)
 * with Prisma stubbed to answer synchronously. A pass establishes that adding
 * search contributes a negligible, non-degrading share of the 300ms budget, and
 * catches an accidental quadratic or synchronous-block regression in the search
 * path. It does NOT discharge AC-CATALOG-030.
 *
 * AC-CATALOG-030 is therefore recorded as PARTIAL with an explicit gap in
 * progress.md §E.2 — following the AC-CATALOG-016 / G2 precedent from
 * SPEC-CATALOG-001 rather than passing the limitation over in silence.
 *
 * Methodology matches tests/integration/catalog/response-time.test.ts: repeated
 * samples, nearest-rank percentile over the sample set.
 */

const findMany = vi.fn();
const count = vi.fn();
const findUnique = vi.fn();
const categoryFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
    category: {
      findUnique: (...args: unknown[]) => categoryFindUnique(...args),
    },
  },
}));

/** AC-CATALOG-030 reuses AC-CATALOG-016's N=50. */
const SAMPLE_SIZE = 50;
const P95_BUDGET_MS = 300;
const SEEDED_ROWS = 100;

function row(i: number) {
  return {
    id: `prod_${i}`,
    name: `Classic Denim Jacket ${i}`,
    price: 10000 + i,
    images: [`https://cdn.example.com/${i}-a.jpg`, `https://cdn.example.com/${i}-b.jpg`],
    stock: i % 7,
    category: { id: "cat-tops", name: "상의", slug: "tops" },
    createdAt: new Date("2026-08-20T01:02:03.000Z"),
  };
}

/** Nearest-rank p95 over the sample set. */
function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1]!;
}

beforeEach(() => {
  findMany.mockReset().mockResolvedValue(Array.from({ length: SEEDED_ROWS }, (_, i) => row(i)));
  count.mockReset().mockResolvedValue(SEEDED_ROWS);
  findUnique.mockReset().mockResolvedValue(null);
  categoryFindUnique.mockReset().mockResolvedValue({ id: "cat-tops" });
});

async function timeRequests(query: string, samples: number): Promise<number[]> {
  const { GET } = await import("@/app/api/products/route");
  const durations: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const response = await GET(new Request(`http://localhost/api/products${query}`));
    await response.json();
    durations.push(performance.now() - start);
    expect(response.status).toBe(200);
  }

  return durations;
}

describe("AC-CATALOG-030 — searched-request response time (DATABASE TIME EXCLUDED)", () => {
  it(`search request p95 stays within ${P95_BUDGET_MS}ms across N=${SAMPLE_SIZE} samples`, async () => {
    const observed = p95(await timeRequests("?search=denim&pageSize=100", SAMPLE_SIZE));

    console.log(
      `[AC-CATALOG-030] GET /api/products?search= p95=${observed.toFixed(2)}ms ` +
        `(N=${SAMPLE_SIZE}, ${SEEDED_ROWS} rows/page, DATABASE TIME EXCLUDED — budget ${P95_BUDGET_MS}ms)`
    );

    expect(observed).toBeLessThan(P95_BUDGET_MS);
  }, 30000);

  it(`search + category + sort p95 stays within ${P95_BUDGET_MS}ms`, async () => {
    // The heaviest documented combination: both filters plus an explicit sort,
    // which also costs a category-resolution round trip.
    const observed = p95(
      await timeRequests("?search=denim&category=tops&sort=price_asc&pageSize=100", SAMPLE_SIZE)
    );

    console.log(
      `[AC-CATALOG-030] GET /api/products?search=&category=&sort= p95=${observed.toFixed(2)}ms ` +
        `(N=${SAMPLE_SIZE}, DATABASE TIME EXCLUDED — budget ${P95_BUDGET_MS}ms)`
    );

    expect(observed).toBeLessThan(P95_BUDGET_MS);
  }, 30000);

  it("adding search does not materially change application-layer cost", async () => {
    // The regression this guards: term normalisation or where-clause assembly
    // doing per-row work. Both requests return the same 100 rows, so any large
    // divergence is attributable to the search path itself.
    const withSearch = p95(await timeRequests("?search=denim&pageSize=100", 20));
    const without = p95(await timeRequests("?pageSize=100", 20));

    console.log(
      `[AC-CATALOG-030] assembly p95: with search=${withSearch.toFixed(2)}ms ` +
        `without=${without.toFixed(2)}ms`
    );

    // Deliberately loose: at sub-millisecond scale on a shared machine a tight
    // ratio would be flaky. This is a shape check against per-row work in the
    // search path, not a throughput benchmark.
    expect(withSearch).toBeLessThan(Math.max(without * 50, 50));
  }, 30000);

  it("term length does not drive application-layer cost", async () => {
    // A 5000-character term must not cost meaningfully more to PROCESS than a
    // short one — the term is bound as a parameter, never scanned per row.
    const short = p95(await timeRequests("?search=denim&pageSize=100", 20));
    const long = p95(await timeRequests(`?search=${"a".repeat(5000)}&pageSize=100`, 20));

    console.log(
      `[AC-CATALOG-030] term length p95: 5 chars=${short.toFixed(2)}ms 5000 chars=${long.toFixed(2)}ms`
    );

    expect(long).toBeLessThan(Math.max(short * 50, 50));
  }, 30000);
});
