import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-ADMIN-003 M5 (A layer) — route-placement inventory guard
 * (REQ-ADMIN-048/049/051, AC-ADMIN-048/049/051).
 *
 * No route handler under src/app may sit at a URL the middleware matcher
 * claims. A handler behind the matcher never executes: the middleware
 * redirects first, fetch() follows the 307 with the method preserved, the
 * caller receives 200, and `response.ok` reports success for a write that
 * never happened. Four routes shipped that way and 268 tests, 24 acceptance
 * criteria and a passing plan audit all missed it, because nothing in the
 * repository compared placement against the matcher.
 *
 * @MX:ANCHOR the single mechanical check standing between this defect class
 * and its return. Both inputs are read from the tree — the matcher from
 * src/middleware.ts, the routes from the filesystem — so it follows a matcher
 * change and covers a route nobody thought to register.
 * @MX:REASON the failure it catches is silent by construction: the write is
 * lost, the screen says it succeeded, and no test fails. That combination is
 * why a guard exists here at all, and why it must fail closed.
 *
 * @MX:WARN never add an allowlist to this guard. A single blessed exception
 * is the door this defect walks back in through, and the exception will
 * outlive the reason it was granted. If a handler genuinely must live behind
 * the matcher, that is a middleware decision, not a test-file decision.
 */

const ROOT = path.resolve(__dirname, "../../..");
const MIDDLEWARE = "src/middleware.ts";
const APP_DIR = "src/app";

/** Every filename Next.js App Router treats as a route handler. Counting only
 * `route.ts` would let a `.tsx` handler through in silence — the guard's whole
 * value is covering the file the next person writes, not the four this SPEC
 * moved (design.md §3.1 ②). */
const ROUTE_FILENAMES = ["route.ts", "route.tsx", "route.js", "route.jsx"];

/**
 * Reads `config.matcher` out of the middleware source, accepting BOTH forms
 * Next.js allows — an array of patterns and a bare single string.
 *
 * Deliberately NOT reusing middleware-preserve.test.ts's extractMatcher: that
 * one returns [] when its array regex misses, and a bare-string matcher makes
 * it miss. Zero patterns means zero comparisons, so every route passes and the
 * guard reports success while checking nothing — fail-open, and an exact
 * re-run of the failure this SPEC exists to close (design.md §3.1 ①).
 *
 * Throws rather than returning empty. "I could not read the matcher" and
 * "there is nothing to check" must not arrive at the caller as the same value.
 */
export function extractMatcherStrict(source: string): string[] {
  const arrayForm = source.match(/matcher:\s*\[([^\]]*)\]/);
  if (arrayForm !== null) {
    // Next.js also accepts matcher OBJECTS — `{ source, has, missing }` — whose
    // `has`/`missing` conditions decide at request time whether the middleware
    // runs. This parser reads none of that, and a half-read object is worse
    // than an unread one: `source` alone would judge a route intercepted that
    // the conditions may exempt, or the reverse. Refused deliberately, rather
    // than left to fail by accident further down (sync-audit F1).
    if (arrayForm[1]!.includes("{")) {
      throw new Error(
        `matcher in ${MIDDLEWARE} uses the OBJECT form ({ source, has, missing }), which this ` +
          `guard does not read. Its has/missing conditions decide at request time whether the ` +
          `middleware runs, and a route's placement cannot be judged from \`source\` alone. ` +
          `TEACH THIS FUNCTION to read the form. Do not soften the failure: a half-read ` +
          `matcher checks the wrong thing, which is worse than checking nothing.`
      );
    }

    const patterns = arrayForm[1]!
      .split(",")
      .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
      .filter((entry) => entry.length > 0);
    if (patterns.length === 0) {
      throw new Error(
        `matcher parsed to an EMPTY pattern list in ${MIDDLEWARE}. An empty matcher is ` +
          `unreadable, not permissive — refusing to pass every route by default.`
      );
    }
    return patterns;
  }

  const stringForm = source.match(/matcher:\s*["']([^"']+)["']/);
  if (stringForm !== null) return [stringForm[1]!];

  throw new Error(
    `could not read config.matcher from ${MIDDLEWARE}. Neither the array form ` +
      `(matcher: ["/x/:path*"]) nor the single-string form (matcher: "/x/:path*") ` +
      `parsed. If the matcher moved to a form this guard cannot read — a regex, an ` +
      `imported constant, a computed value — TEACH THIS FUNCTION to read it. Do not ` +
      `soften the failure: an unreadable matcher checks nothing.`
  );
}

/**
 * Regex metacharacters that carry meaning in a Next.js matcher but none in
 * this translator. Reaching one in a literal chunk means the pattern is a
 * regex-form matcher, and the only honest response is to stop.
 *
 * `.` is deliberately absent: it is a metacharacter in a regex but an ordinary
 * character in a path, and matchers name real files (`/favicon.ico`). Escaping
 * a lone `.` narrows the match by exactly one character class, which cannot
 * hide a route the way an unquantified pattern can.
 */
const UNTRANSLATED_REGEX_CHARS = /[()[\]{}|!?*+^$\\]/;

/**
 * Converts one matcher pattern into a regex over URL pathnames.
 *
 * `:param*` is zero-or-more segments, so `/admin/:path*` matches the bare
 * `/admin` as well as `/admin/a/b`. Reading `*` as "at least one segment"
 * would let a handler sit at exactly the prefix and slip past — real traffic
 * there is intercepted all the same (design.md §3.1 ③).
 *
 * Translates exactly two vocabularies: literal path segments, and `:param`
 * with its `*` / `+` / `?` modifiers. Every other form — Next.js accepts a
 * full regex, negative lookahead included — is REFUSED, because the failure
 * mode of guessing is silent. Escaping a regex-form pattern into a literal
 * yields a regex matching no pathname at all; every route then compares clean
 * and the guard reports success having checked nothing. That is the exact
 * shape of the defect this file exists to catch, reproduced inside the catcher
 * (sync-audit F1 — the audit ran this SPEC's own documented bypass literal
 * through the guard and got `0/4 caught` against a reality of 4/4).
 *
 * Detecting what it cannot read is the goal here; reading everything is not.
 */
export function matcherToRegExp(pattern: string): RegExp {
  const parts: string[] = [];
  let rest = pattern;

  while (rest.length > 0) {
    const named = rest.match(/^\/:([A-Za-z0-9_]+)(\*|\+|\?)?/);
    if (named !== null) {
      const modifier = named[2];
      if (modifier === "*") parts.push("(?:/[^/]+)*");
      else if (modifier === "+") parts.push("(?:/[^/]+)+");
      else if (modifier === "?") parts.push("(?:/[^/]+)?");
      else parts.push("/[^/]+");
      rest = rest.slice(named[0].length);
      continue;
    }

    const literal = rest.match(/^[^:]+?(?=\/:|$)/);
    if (literal === null) {
      throw new Error(
        `cannot translate matcher pattern ${JSON.stringify(pattern)} into a regex. ` +
          `Failing rather than skipping it — an untranslated pattern is an unchecked one.`
      );
    }
    const untranslated = literal[0].match(UNTRANSLATED_REGEX_CHARS);
    if (untranslated !== null) {
      throw new Error(
        `cannot translate matcher pattern ${JSON.stringify(pattern)} into a regex: it contains ` +
          `${JSON.stringify(untranslated[0])}, which this translator does not read. Escaping it ` +
          `would build a regex that matches NO pathname, so every route would compare clean and ` +
          `this guard would report success having checked nothing — the fail-open it exists to ` +
          `prevent, reproduced inside itself. Next.js accepts full regex matchers, and one of ` +
          `those can put every route behind the middleware. TEACH THIS FUNCTION to read the ` +
          `form, or keep the matcher in one it reads. Do not soften the failure.`
      );
    }

    parts.push(literal[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    rest = rest.slice(literal[0].length);
  }

  return new RegExp(`^${parts.join("")}$`);
}

/** Every route-handler file under src/app, found by walking the tree. Nothing
 * is registered by hand, so a route added later is judged without this file
 * being touched (REQ-ADMIN-051). */
export function routeHandlerFiles(relative: string = APP_DIR): string[] {
  const absolute = path.join(ROOT, relative);
  const out: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const child = path.join(absolute, entry);
    const childRelative = path.relative(ROOT, child);
    if (statSync(child).isDirectory()) out.push(...routeHandlerFiles(childRelative));
    else if (ROUTE_FILENAMES.includes(entry)) out.push(childRelative);
  }
  return out;
}

/** `src/app/staff/api/products/[productId]/route.ts` -> `/staff/api/products/x`.
 * Route groups `(name)` contribute no segment; dynamic segments stand in as an
 * ordinary one, which is what the matcher would see. */
export function toPathname(routeFile: string): string {
  const segments = routeFile
    .replace(new RegExp(`^${APP_DIR}/`), "")
    // Anchored on the segment boundary, not on a leading slash: the root
    // handler `src/app/route.ts` has no directory ahead of the filename, and
    // a `/`-anchored strip would leave "route.ts" standing as a path segment.
    .replace(/(^|\/)route\.(ts|tsx|js|jsx)$/, "")
    .split("/")
    .filter((s) => s.length > 0 && !/^\(.*\)$/.test(s))
    .map((s) => (/^\[.*\]$/.test(s) ? "x" : s));
  return `/${segments.join("/")}`;
}

function readMiddleware(): string {
  return readFileSync(path.join(ROOT, MIDDLEWARE), "utf8");
}

describe("[AC-ADMIN-048] no route handler sits behind the middleware matcher", () => {
  it("finds route handlers by walking the tree, and finds some", () => {
    const files = routeHandlerFiles();

    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => ROUTE_FILENAMES.some((n) => f.endsWith(`/${n}`)))).toBe(true);
  });

  it("enumerates every filename Next.js accepts as a route handler", () => {
    expect(ROUTE_FILENAMES.sort()).toEqual(["route.js", "route.jsx", "route.ts", "route.tsx"]);
  });

  it("no handler's pathname matches any matcher pattern", () => {
    const patterns = extractMatcherStrict(readMiddleware());
    const regexes = patterns.map((p) => ({ pattern: p, regex: matcherToRegExp(p) }));

    const caught = routeHandlerFiles().flatMap((file) => {
      const pathname = toPathname(file);
      return regexes
        .filter(({ regex }) => regex.test(pathname))
        .map(({ pattern }) => `${file}  (pathname ${pathname})  matches matcher ${pattern}`);
    });

    // The message carries the file AND the pattern it hit, because the next
    // person to see this failure will not have read this SPEC.
    expect(
      caught,
      caught.length === 0
        ? ""
        : `route handler(s) behind the middleware matcher — the middleware answers ` +
            `these before the handler runs, and fetch() follows the redirect to a 200, ` +
            `so a write there is lost while the caller reports success:\n  ` +
            caught.join("\n  ")
    ).toEqual([]);
  });
});

describe("[AC-ADMIN-049] the matcher is read, never copied, and never fails open", () => {
  it("reads the array form", () => {
    expect(extractMatcherStrict('export const config = { matcher: ["/admin/:path*"] };')).toEqual([
      "/admin/:path*",
    ]);
  });

  it("reads the bare single-string form Next.js also allows", () => {
    // The form that makes middleware-preserve.test.ts's extractMatcher return
    // [] — the fail-open path this wrapper exists to close.
    expect(extractMatcherStrict('export const config = { matcher: "/admin/:path*" };')).toEqual([
      "/admin/:path*",
    ]);
    expect(
      extractMatcherStrict('export const config = { matcher: "/admin/:path*" };').length
    ).toBeGreaterThan(0);
  });

  it("FAILS on an empty array rather than treating it as nothing to check", () => {
    expect(() => extractMatcherStrict("export const config = { matcher: [] };")).toThrow(/EMPTY/);
  });

  it("FAILS on a form it cannot read at all — unconditionally", () => {
    // An identifier reference: no parser here can resolve it, so the only
    // honest answer is to stop. Returning [] would pass every route.
    expect(() =>
      extractMatcherStrict("export const config = { matcher: MATCHER_CONST };")
    ).toThrow(/could not read config.matcher/);
    expect(() => extractMatcherStrict("export const config = {};")).toThrow();
    expect(() => extractMatcherStrict("")).toThrow();
  });

  it("FAILS on a pattern it cannot translate into a regex", () => {
    expect(() => matcherToRegExp("/:")).toThrow(/cannot translate/);
  });

  // The two fixtures below are the REAL middleware source with only its
  // matcher line rewritten — not hand-written snippets. A snippet can be
  // shaped to whatever the parser happens to accept; a copy of the shipped
  // file cannot, so these judge the parser against the thing it actually
  // reads (AC-ADMIN-049).
  it("still reads a real middleware whose matcher was rewritten to a bare string", () => {
    const fixture = readMiddleware().replace(
      /matcher:\s*\[[^\]]*\]/,
      'matcher: "/admin/:path*"'
    );

    expect(fixture).not.toBe(readMiddleware());
    const patterns = extractMatcherStrict(fixture);
    expect(patterns.length).toBeGreaterThan(0);
    // Non-empty means the placement check keeps judging — the fail-open path
    // (a silent [] and therefore zero comparisons) is closed.
    expect(patterns.every((p) => matcherToRegExp(p) instanceof RegExp)).toBe(true);
  });

  it("FAILS on a real middleware whose matcher became an identifier reference", () => {
    const fixture = readMiddleware().replace(/matcher:\s*\[[^\]]*\]/, "matcher: MATCHER_CONST");

    expect(fixture).not.toBe(readMiddleware());
    expect(fixture).toContain("MATCHER_CONST");
    // Unconditional: there is no input shape under which an unreadable matcher
    // is allowed to pass.
    expect(() => extractMatcherStrict(fixture)).toThrow(/could not read config.matcher/);
  });

  it("holds no matcher constant of its own — the checked value comes from the middleware", () => {
    const self = readFileSync(__filename, "utf8");

    // The point is not that the string never appears — it appears above, as
    // INPUT to extractMatcherStrict's own unit tests, which is exactly where a
    // parser's fixtures belong. The point is that no binding in this file
    // holds a matcher for the placement check to consult, so the only value
    // that check can reach is the one read from src/middleware.ts.
    expect(self).not.toMatch(/(const|let|var)\s+\w*MATCHER\w*\s*=/i);
    expect(self).toContain("extractMatcherStrict(readMiddleware())");
  });
});

describe("[AC-ADMIN-048/049] :param* is zero-or-more, so the prefix itself matches", () => {
  const regex = matcherToRegExp("/admin/:path*");

  it.each(["/admin", "/admin/route", "/admin/anything/deep", "/admin/a/b/c"])(
    "%s is inside the matcher",
    (pathname) => {
      expect(regex.test(pathname)).toBe(true);
    }
  );

  it.each(["/staff", "/staff/api/products", "/api/products", "/", "/administrator"])(
    "%s is outside it",
    (pathname) => {
      expect(regex.test(pathname)).toBe(false);
    }
  );

  it("treats :param (no modifier) as exactly one segment and :param+ as one or more", () => {
    expect(matcherToRegExp("/x/:id").test("/x/1")).toBe(true);
    expect(matcherToRegExp("/x/:id").test("/x")).toBe(false);
    expect(matcherToRegExp("/x/:id").test("/x/1/2")).toBe(false);
    expect(matcherToRegExp("/x/:rest+").test("/x")).toBe(false);
    expect(matcherToRegExp("/x/:rest+").test("/x/1/2")).toBe(true);
  });
});

describe("[AC-ADMIN-051] the check is by enumeration, not by a list of today's routes", () => {
  it("narrows the checked set with no list of route paths", () => {
    const self = readFileSync(__filename, "utf8");

    // AC-ADMIN-051 forbids hardcoding route paths to LIMIT what gets checked.
    // routeHandlerFiles() applies exactly one filter — the four Next.js route
    // filenames — and nothing that names a URL. A path list appearing as a
    // toPathname fixture below narrows nothing; a path list inside the walk
    // would.
    const walkBody = self
      .slice(self.indexOf("export function routeHandlerFiles"), self.indexOf("export function toPathname"))
      // Comments stripped: the doc comment on the NEXT function illustrates the
      // conversion with a real path, and a check that counted that would push a
      // future maintainer to delete the illustration. Judge code, not prose.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(walkBody).toContain("ROUTE_FILENAMES.includes(entry)");
    expect(walkBody).not.toMatch(/["'`]\/[a-z]/i);
  });

  it("covers every handler on disk — the count is the tree's, not a list's", () => {
    const files = routeHandlerFiles();

    // Independent recount: every route.* file anywhere under src/app.
    function countAll(relative: string): number {
      const absolute = path.join(ROOT, relative);
      return readdirSync(absolute).reduce((n, entry) => {
        const child = path.join(absolute, entry);
        if (statSync(child).isDirectory()) return n + countAll(path.relative(ROOT, child));
        return n + (/^route\.(ts|tsx|js|jsx)$/.test(entry) ? 1 : 0);
      }, 0);
    }

    expect(files.length).toBe(countAll(APP_DIR));
  });

  it("derives a pathname from a route file's position alone", () => {
    expect(toPathname("src/app/w/x/y/route.ts")).toBe("/w/x/y");
    expect(toPathname("src/app/a/[id]/b/route.tsx")).toBe("/a/x/b");
    expect(toPathname("src/app/(group)/a/route.js")).toBe("/a");
    expect(toPathname("src/app/route.ts")).toBe("/");
  });
});

/**
 * SPEC-ADMIN-003 sync-audit F1 — the matcher forms the guard must not wave
 * through.
 *
 * The audit fed the guard the catch-all this SPEC's own progress.md §26 names
 * as the bypass — `["/((?!_next|api).*)"]` — and watched it report clean while
 * all four moved routes sat behind that matcher: `SPECLITERAL PASSED 0/4
 * caught`, against `REALITY the same pattern as an actual regex matches 4/4`.
 * matcherToRegExp's literal branch swallowed the colon-less pattern whole and
 * escaped it, producing a regex that matches no pathname at all, so there was
 * nothing to compare and `caught` came back empty.
 *
 * @MX:NOTE the guard's contract is NOT "translate every matcher Next.js
 * accepts". acceptance.md §E settles it the other way: a matcher that turns
 * regex-form "must fail, not pass". The goal is to DETECT the forms this
 * parser does not translate and refuse them as loudly as an unreadable
 * matcher — never to guess at a dialect.
 */
describe("[AC-ADMIN-049] a matcher form this guard cannot translate is refused, never escaped", () => {
  /** The real middleware with only its matcher line rewritten — the same
   * fixture discipline as the two AC-049 fixtures above. A hand-written
   * snippet can be shaped to whatever the parser happens to accept; a copy of
   * the shipped file cannot. */
  function withMatcher(literal: string): string {
    const original = readMiddleware();
    const rewritten = original.replace(/matcher:\s*\[[^\]]*\]/, () => `matcher: ${literal}`);
    expect(rewritten).not.toBe(original);
    return rewritten;
  }

  /** The placement check's own computation, run against a substituted matcher.
   * Returns what the guard would REPORT, which is the thing under test: a
   * throw fails the build loudly, while an empty `caught` with no throw is
   * precisely the fail-open the audit found. */
  function placementVerdict(middlewareSource: string): { refused: boolean; caught: string[] } {
    try {
      const regexes = extractMatcherStrict(middlewareSource).map(matcherToRegExp);
      return {
        refused: false,
        caught: routeHandlerFiles().filter((file) =>
          regexes.some((regex) => regex.test(toPathname(file)))
        ),
      };
    } catch {
      return { refused: true, caught: [] };
    }
  }

  // Each entry is a form the audit actually ran, or one Next.js documents. The
  // requirement is the same for all of them and deliberately names no
  // mechanism: the guard must not come back clean.
  it.each([
    ["the catch-all progress.md §26 names as the bypass", '["/((?!_next|api).*)"]'],
    ["the form SPEC-ADMIN-002's audit recommended as a fix", '["/admin/((?!api/).*)"]'],
    ["a catch-all excluding static assets", '["/((?!_next/static|favicon.ico).*)"]'],
    ["a bare regex quantifier", '["/admin/.*"]'],
    ["an alternation group", '["/(admin|staff)/:path*"]'],
    ["the object form, which carries source/has/missing", '[{ source: "/admin/:path*" }]'],
  ])("does not report clean on %s", (_label, literal) => {
    const verdict = placementVerdict(withMatcher(literal));

    expect(
      verdict.refused || verdict.caught.length > 0,
      `matcher ${literal} produced a CLEAN report: nothing thrown and 0 route handlers ` +
        `caught. The guard did not translate this pattern and did not notice that it had ` +
        `not — it escaped the metacharacters into a regex matching no pathname, compared ` +
        `that against every route, and read the empty result as success. Either translate ` +
        `this form or refuse it; reporting clean is the one outcome never correct here.`
    ).toBe(true);
  });

  it("refuses the SPEC's own bypass literal, and names the pattern when it does", () => {
    // The mechanism, as against the outcome asserted above: this guard's answer
    // to an untranslatable form is to throw, matching extractMatcherStrict's
    // "do not soften the failure" stance rather than guessing.
    expect(() => matcherToRegExp("/((?!_next|api).*)")).toThrow(/cannot translate/);
    expect(() => matcherToRegExp("/((?!_next|api).*)")).toThrow(/\(\(\?!_next\|api\)\.\*\)/);
  });

  it("the refused pattern really would have hidden the four moved routes", () => {
    // Why the fail-open mattered rather than being a curiosity: read as an
    // actual regex, this pattern covers the routes this SPEC moved, so a guard
    // reporting clean here is reporting clean over live traffic.
    const asRealRegex = new RegExp("^/((?!_next|api).*)$");
    const moved = routeHandlerFiles()
      .map(toPathname)
      .filter((pathname) => pathname.startsWith("/staff/api/"));

    expect(moved.length).toBeGreaterThan(0);
    expect(moved.every((pathname) => asRealRegex.test(pathname))).toBe(true);
  });

  it("still translates the shipped matcher and plain paths — the refusal is not blanket", () => {
    // Read from the middleware, never copied, so this control cannot drift
    // from what actually ships (AC-ADMIN-049).
    for (const pattern of extractMatcherStrict(readMiddleware())) {
      expect(matcherToRegExp(pattern)).toBeInstanceOf(RegExp);
    }

    expect(matcherToRegExp("/staff/api/products").test("/staff/api/products")).toBe(true);
    expect(matcherToRegExp("/staff/api/products").test("/staff/api/orders")).toBe(false);
    // A dot is a regex metacharacter but an ordinary character in a path, and
    // Next.js matchers do name real files. Escaped, not refused.
    expect(matcherToRegExp("/favicon.ico").test("/favicon.ico")).toBe(true);
    expect(matcherToRegExp("/favicon.ico").test("/faviconxico")).toBe(false);
  });
});
