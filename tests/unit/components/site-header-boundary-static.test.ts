// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-AUTH-003 M4 — boundary regression guard for
 * `src/components/layout/SiteHeader.tsx` and
 * `src/components/layout/LogoutButton.tsx` (REQ-AUTH-046, AC-AUTH-044).
 *
 * Two halves, per acceptance.md AC-AUTH-044:
 * (1) a static source-text scan of the header's source files for zero
 *     occurrences (case-insensitive) of 장바구니 / search / 검색 / `<footer`;
 * (2) a rendered-output scan confirming SiteHeader emits no navigation
 *     links to /products?... or a category path, for either the guest or
 *     the logged-in branch.
 *
 * SPEC-BRAND-001 REQ-BRAND-010 intentionally supersedes the original
 * "no cart token / no /cart link" half of AC-AUTH-044 — a CART nav link
 * (English label, href `/cart`) is now a required part of the header, so
 * both the `cart` token pattern and the `/^\/cart\b/` link pattern were
 * removed below (with an explanatory comment at each removal site). Every
 * other AC-AUTH-044 guarantee (no Korean 장바구니 text, no search, no
 * footer, no /products? or /categories menu) is unchanged.
 *
 * The `<nav>` tag itself is NOT scanned for (plan-audit D3 /
 * acceptance.md AC-AUTH-044 note) — REQ-AUTH-046 forbids the category
 * navigation MENU as content, not the semantic element.
 */

vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/auth/session-resolver", () => ({ resolveSession: vi.fn() }));
// SiteHeader renders the real LogoutButton when logged in, and LogoutButton
// calls useRouter() at render time — same reason site-header.test.tsx mocks
// next/navigation for this scenario.
vi.mock("next/navigation", () => ({ useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })) }));

const { resolveSession } = await import("@/lib/auth/session-resolver");
const { default: SiteHeader } = await import("@/components/layout/SiteHeader");

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(resolveSession).mockReset();
});

const SOURCE_FILES = [
  "src/components/layout/SiteHeader.tsx",
  "src/components/layout/LogoutButton.tsx",
  "src/components/layout/SiteHeaderNav.tsx",
];

// SPEC-BRAND-001 REQ-BRAND-010 intentionally supersedes the "no cart token"
// half of AC-AUTH-044 — the header now requires a visible "CART" nav link
// (English label; no Korean 장바구니 text is added, so that token stays
// forbidden alongside search/footer).
const FORBIDDEN_TOKEN_PATTERNS = [/장바구니/i, /search/i, /검색/i, /<footer/i];

// SPEC-BRAND-001 REQ-BRAND-010 intentionally supersedes the "no /cart link"
// half of AC-AUTH-044 — a `/cart` nav link is now required. `/^\/products\?/`
// and `/^\/categories\b/` stay forbidden: SHOP links to `/shop`, a distinct
// route matching neither pattern, and no product-listing or category menu
// is added to the header.
const FORBIDDEN_LINK_PATTERNS = [/^\/products\?/, /^\/categories\b/];

describe("SiteHeader / LogoutButton — AC-AUTH-044 static source scan", () => {
  it("contains no 장바구니, search, or footer tokens (case-insensitive)", () => {
    for (const path of SOURCE_FILES) {
      const source = readFileSync(path, "utf8");
      for (const pattern of FORBIDDEN_TOKEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});

describe("SiteHeader — AC-AUTH-044 rendered navigation link scan", () => {
  it("renders no links to /products?... or a category path for a guest visitor", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);

    render(await SiteHeader());

    const links = screen.queryAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      for (const pattern of FORBIDDEN_LINK_PATTERNS) {
        expect(href).not.toMatch(pattern);
      }
    }
  });

  it("renders no links to /products?... or a category path for a logged-in visitor", async () => {
    vi.mocked(resolveSession).mockResolvedValue({ userId: "u1", role: "customer" });

    render(await SiteHeader());

    const links = screen.queryAllByRole("link");
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      for (const pattern of FORBIDDEN_LINK_PATTERNS) {
        expect(href).not.toMatch(pattern);
      }
    }
  });
});
