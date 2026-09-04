import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-ADMIN-002 M6 — structural boundary guards
 * (AC-ADMIN-020/028/036/037/040).
 *
 * These assert on properties of the SOURCE TREE rather than on runtime
 * behaviour, because the requirements they cover are absences — no delete
 * path, no upload pipeline, no second admin-session implementation, no page
 * under /admin. An absence cannot be observed by calling something; it has to
 * be looked for.
 *
 * Read via readFileSync, never by shelling out to git — the same discipline
 * SPEC-ADMIN-001's middleware-preserve.test.ts established, so these keep
 * failing loudly long after this SPEC closes.
 *
 * Succession: the old `/admin`-prefixed API clause of AC-ADMIN-040 was superseded by
 * SPEC-ADMIN-003 REQ-ADMIN-042 (admin write APIs live under `/staff/api`,
 * outside the `/admin/:path*` middleware matcher). Only that one clause moved
 * — the `[AC-ADMIN-040]` block below asserts the new convention, and the other
 * six describe blocks (020 / 028 / 036 / 037 / 039 / 041) are unchanged in
 * what they judge and how strongly, path strings aside (REQ-ADMIN-055).
 */

const ROOT = path.resolve(__dirname, "../../..");

/** Every file this SPEC adds or extends outside the SPEC document tree. */
const SPEC_SOURCE_FILES = [
  "src/features/admin/repositories/admin-product-repository.ts",
  "src/features/admin/services/product-validation.ts",
  "src/features/admin/types/admin.ts",
  "src/app/staff/api/products/route.ts",
  "src/app/staff/api/products/shared.ts",
  "src/app/staff/api/products/[productId]/route.ts",
  "src/app/staff/api/products/[productId]/active/route.ts",
  "src/app/staff/products/page.tsx",
  "src/app/staff/products/new/page.tsx",
  "src/app/staff/products/[productId]/page.tsx",
  "src/app/staff/products/ProductForm.tsx",
  "src/features/catalog/repositories/product-repository.ts",
];

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

function walk(relative: string): string[] {
  const absolute = path.join(ROOT, relative);
  const out: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const child = path.join(absolute, entry);
    if (statSync(child).isDirectory()) {
      out.push(...walk(path.relative(ROOT, child)));
    } else {
      out.push(path.relative(ROOT, child));
    }
  }
  return out;
}

describe("[AC-ADMIN-020] no physical-delete path exists anywhere this SPEC added", () => {
  it.each(SPEC_SOURCE_FILES)("%s issues no product delete", (file) => {
    const source = read(file);

    // Soft delete is the whole design. A single product.delete would defeat
    // it AND would hit OrderItem's ON DELETE RESTRICT for any ordered product.
    expect(source).not.toMatch(/product\.delete\b/);
    expect(source).not.toMatch(/product\.deleteMany\b/);
  });

  it("leaves both productId foreign-key directions untouched in the schema", () => {
    const schema = read("prisma/schema.prisma");

    // CartItem cascades, OrderItem restricts — deliberately asymmetric, and
    // this SPEC changes neither (REQ-ADMIN-020).
    expect(schema).toMatch(/cartItems\s+CartItem\[\]/);
    expect(schema).toMatch(
      /product\s+Product\s+@relation\(fields:\s*\[productId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/
    );
    expect(schema).toMatch(
      /product\s+Product\s+@relation\(fields:\s*\[productId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/
    );
  });

  it("adds isActive without touching the existing Product indexes", () => {
    const schema = read("prisma/schema.prisma");

    expect(schema).toMatch(/isActive\s+Boolean\s+@default\(true\)/);
    expect(schema).toMatch(/@@index\(\[categoryId\]\)/);
    expect(schema).toMatch(/@@index\(\[createdAt\]\)/);
    expect(schema).toMatch(/@@index\(\[price\]\)/);
    expect(schema).toMatch(/product_name_trgm_idx/);
  });
});

describe("[AC-ADMIN-028] no upload pipeline and no new dependency", () => {
  it.each(SPEC_SOURCE_FILES)("%s handles no multipart or file upload", (file) => {
    const source = read(file);

    expect(source).not.toMatch(/multipart\/form-data/);
    expect(source).not.toMatch(/\bformData\(\)/);
    expect(source).not.toMatch(/type=["']file["']/);
  });

  it("adds no dependency to package.json", () => {
    const pkg = JSON.parse(read("package.json"));

    // The validation is hand-written precisely so this stays true — zod and
    // any storage client would both show up here.
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@prisma/client",
      "bcrypt",
      "google-auth-library",
      "jose",
      "next",
      "react",
      "react-dom",
    ]);
  });
});

describe("[AC-ADMIN-037] admin identity is decided in exactly one place", () => {
  const WRITE_SURFACES = SPEC_SOURCE_FILES.filter(
    (f) => f.startsWith("src/app/staff/products") || f.startsWith("src/app/staff/api/products")
  );

  it.each(WRITE_SURFACES.filter((f) => !f.endsWith("ProductForm.tsx") && !f.endsWith("shared.ts")))(
    "%s resolves the session through resolveAdminSession",
    (file) => {
      const source = read(file);

      expect(source).toMatch(/resolveAdminSession/);
    }
  );

  it.each(SPEC_SOURCE_FILES)("%s never re-derives admin identity itself", (file) => {
    const source = read(file);

    // No new code may read the refresh-token cookie or consult User.role —
    // those are admin-session.ts's job, and a second implementation would be
    // a second thing to get wrong (REQ-ADMIN-037).
    expect(source).not.toMatch(/refresh_token/);
    expect(source).not.toMatch(/hashRefreshToken/);
    expect(source).not.toMatch(/role:\s*["']admin["']/);
    expect(source).not.toMatch(/prisma\.refreshToken/);
    expect(source).not.toMatch(/prisma\.user\b/);
  });

  it("does not modify admin-session.ts — this SPEC imports it and nothing more", () => {
    const source = read("src/features/admin/services/admin-session.ts");

    // A byte-level snapshot would fight legitimate SPEC-ADMIN-001 maintenance;
    // asserting the absence of any SPEC-ADMIN-002 marker is the property that
    // actually matters here.
    expect(source).not.toMatch(/SPEC-ADMIN-002/);
    expect(source).not.toMatch(/isActive/);
  });
});

describe("[AC-ADMIN-039] the two rejection reasons are literally the same response", () => {
  it.each([
    "src/app/staff/api/products/route.ts",
    "src/app/staff/api/products/[productId]/route.ts",
    "src/app/staff/api/products/[productId]/active/route.ts",
  ])("%s answers CSRF and session failures from one shared constant", (file) => {
    const source = read(file);

    // Two separately-maintained literals would eventually diverge and leak
    // which check rejected the caller. One shared constant cannot.
    expect(source).toMatch(/GENERIC_AUTH_ERROR/);
    const occurrences = source.match(/GENERIC_AUTH_ERROR/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3); // import + both rejections
  });

  it.each([
    "src/app/staff/api/products/route.ts",
    "src/app/staff/api/products/[productId]/route.ts",
    "src/app/staff/api/products/[productId]/active/route.ts",
  ])("%s verifies CSRF before it resolves the session", (file) => {
    const source = read(file);

    // Source order is the check: a session lookup before the CSRF gate would
    // mean a DB read on a forged request.
    expect(source.indexOf("verifyCsrfRequest(request)")).toBeGreaterThan(-1);
    expect(source.indexOf("verifyCsrfRequest(request)")).toBeLessThan(
      source.indexOf("resolveAdminSession(jar)")
    );
  });
});

describe("[AC-ADMIN-040] the route convention SPEC-ADMIN-001 established is followed", () => {
  it("puts every admin product screen under /staff", () => {
    const pages = walk("src/app/staff/products").filter((f) => f.endsWith("page.tsx"));

    expect(pages.sort()).toEqual([
      "src/app/staff/products/[productId]/page.tsx",
      "src/app/staff/products/new/page.tsx",
      "src/app/staff/products/page.tsx",
    ]);
  });

  it("puts every admin write API under /staff/api and NO page there", () => {
    const files = walk("src/app/staff/api");

    // A route handler under /admin would be caught by the `/admin/:path*`
    // middleware matcher, which redirects any request without an Authorization
    // header — and no /staff/* screen holds an access token to attach one
    // (REQ-AUTH-009, memory-only). The redirect is then followed by fetch()'s
    // default `redirect: "follow"`, yielding 200 and response.ok === true, so
    // the caller reports success while nothing was written. Placement, not the
    // caller, is what keeps that from happening (SPEC-ADMIN-003 REQ-ADMIN-042).
    expect(files.filter((f) => f.endsWith("page.tsx"))).toEqual([]);
    expect(files.filter((f) => f.includes("products")).sort()).toEqual([
      "src/app/staff/api/products/[productId]/active/route.ts",
      "src/app/staff/api/products/[productId]/route.ts",
      "src/app/staff/api/products/route.ts",
      "src/app/staff/api/products/shared.ts",
    ]);
  });

  it("leaves no src/app/admin directory behind for a future route to land in", () => {
    // An empty shell would read as "admin API goes here" to the next person,
    // which is the most natural path back inside the matcher. Asserting the
    // absence here keeps SPEC-ADMIN-003 REQ-ADMIN-044 enforced from the
    // neighbouring SPEC's own guard as well as its own.
    expect(existsSync(path.join(ROOT, "src/app/admin"))).toBe(false);
  });

  it("builds no GET /staff/api/products list endpoint (design.md §2)", () => {
    const source = read("src/app/staff/api/products/route.ts");

    // The list page calls the repository in-process; an HTTP round trip would
    // add an auth/pagination/serialization surface with no consumer.
    expect(source).not.toMatch(/export async function GET/);
  });
});

describe("[AC-ADMIN-036] sellability never reaches a customer-facing response", () => {
  it("keeps isActive out of both customer projections", () => {
    const source = read("src/features/catalog/repositories/product-repository.ts");

    const listSelect = source.slice(
      source.indexOf("const LIST_SELECT"),
      source.indexOf("} satisfies Prisma.ProductSelect", source.indexOf("const LIST_SELECT"))
    );
    const detailSelect = source.slice(
      source.indexOf("const DETAIL_SELECT"),
      source.indexOf("} satisfies Prisma.ProductSelect", source.indexOf("const DETAIL_SELECT"))
    );

    // Structural, not disciplinary: toListItem/toDetail cannot read a field
    // the query never selected.
    expect(listSelect).not.toMatch(/isActive/);
    expect(detailSelect).not.toMatch(/isActive/);
  });

  it("leaves the catalog service layer untouched", () => {
    const source = read("src/features/catalog/services/product-service.ts");

    // The repository signatures did not change, so the caller did not need to.
    expect(source).not.toMatch(/isActive/);
    expect(source).not.toMatch(/SPEC-ADMIN-002/);
  });

  it("leaves the sort keys and pagination arithmetic of the catalog query alone", () => {
    const source = read("src/features/catalog/repositories/product-repository.ts");

    expect(source).toMatch(/newest:\s*\[\{ createdAt: "desc" \}, \{ id: "asc" \}\]/);
    expect(source).toMatch(/price_asc:\s*\[\{ price: "asc" \}, \{ id: "asc" \}\]/);
    expect(source).toMatch(/price_desc:\s*\[\{ price: "desc" \}, \{ id: "asc" \}\]/);
    expect(source).toMatch(/skip:\s*\(page - 1\) \* pageSize/);
    expect(source).toMatch(/take:\s*pageSize/);
  });
});

describe("[AC-ADMIN-041] the PRESERVE list is untouched", () => {
  it.each([
    "src/middleware.ts",
    "src/lib/auth/csrf.ts",
    "src/lib/auth/session.ts",
    "src/lib/auth/cookies.ts",
    "src/features/admin/services/admin-session.ts",
    "src/features/admin/repositories/admin-order-repository.ts",
    "src/features/catalog/services/product-service.ts",
    "src/features/catalog/repositories/category-repository.ts",
  ])("%s carries no SPEC-ADMIN-002 change", (file) => {
    expect(read(file)).not.toMatch(/SPEC-ADMIN-002/);
  });
});
