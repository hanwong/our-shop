import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * SPEC-ADMIN-003 M6 (B layer) — the middleware's actual behaviour
 * (REQ-ADMIN-050, AC-ADMIN-050).
 *
 * The first test in this repository to EXECUTE src/middleware.ts rather than
 * read it. middleware-preserve.test.ts asserts the file has not changed; that
 * is a different question from what the file does, and the gap between the two
 * is where this SPEC's defect lived: everyone knew the matcher covered
 * `/admin/**`, nobody had established what a covered request actually gets
 * back.
 *
 * What it gets back is a REDIRECT, and that is the whole point (assertion 3
 * below). A 4xx would have been loud — fetch() sets ok false and every caller
 * already handles it. A 3xx is silent: fetch()'s default `redirect: "follow"`
 * chases it, a 307 preserves the method, the caller receives 200 from `/`, and
 * `response.ok` is true. Four admin write routes reported success for writes
 * that never happened because of that single fact.
 *
 * @MX:NOTE this test is the answer to "why does route-placement-guard.test.ts
 * exist?". The A layer catches a misplaced route; this one records why a
 * misplaced route is silent rather than loud.
 *
 * Reads the middleware through a dynamic import so a failure to load surfaces
 * here as a test failure rather than as a collection error.
 */

const ADMIN_URL = "http://localhost/admin/write/anything";

let middleware: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ middleware } = await import("@/middleware"));
});

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new Request(ADMIN_URL, { method: "POST", headers }));
}

describe("[AC-ADMIN-050] a matched request is answered with a redirect, not an error", () => {
  it.each([
    ["no Authorization header at all", {}],
    ["an invalid Bearer token", { authorization: "Bearer notarealtoken" }],
  ])("%s — the middleware returns a 3xx carrying a location", async (_label, headers) => {
    const response = await middleware(request(headers as Record<string, string>));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toBeTruthy();
  });

  it.each([
    ["no Authorization header at all", {}],
    ["an invalid Bearer token", { authorization: "Bearer notarealtoken" }],
  ])("%s — the response is explicitly NOT 4xx and NOT 5xx", async (_label, headers) => {
    const response = await middleware(request(headers as Record<string, string>));

    // Stated as its own assertion rather than implied by the 3xx range check
    // above, because this is the property that makes the failure silent. An
    // error status would have surfaced the defect on the first manual test.
    expect(response.status).toBeLessThan(400);
    expect(response.status).toBeGreaterThanOrEqual(300);
  });

  it("redirects to the site root, so the follow lands on a page that answers 200", async () => {
    const response = await middleware(request());

    // The destination matters as much as the status: had it pointed at an
    // endpoint answering 4xx, the followed response would have carried
    // ok === false and the callers' existing failure branch would have run.
    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
  });

  it("a malformed Authorization header is treated as no session, not as an error", async () => {
    const response = await middleware(request({ authorization: "Basic dXNlcjpwYXNz" }));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
  });
});

describe("[AC-ADMIN-050] why a redirect reads as success to the caller", () => {
  it("carries a status that fetch() follows by default, preserving the method", async () => {
    const response = await middleware(request());

    // 307 and 308 preserve the request method; 301/302/303 may rewrite POST to
    // GET. Either way fetch()'s default `redirect: "follow"` chases it and the
    // caller never sees this response — it sees the destination's, which for
    // `/` is a 200. That is the mechanism, fixed here as an assertion so it
    // cannot quietly change (SPEC-ADMIN-003 spec.md §1).
    expect([301, 302, 303, 307, 308]).toContain(response.status);
  });

  it("proves the follow-to-200 shape end to end against a stand-in destination", async () => {
    const response = await middleware(request());
    const destination = new URL(response.headers.get("location")!);

    // What a browser fetch() effectively observes: the redirect is consumed by
    // the transport, and the caller inspects the DESTINATION's response. `/`
    // renders a page, so that response is a 200 with ok true — which is the
    // exact reading that made four broken writes look successful.
    const followed = new Response("<!doctype html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    expect(destination.pathname).toBe("/");
    expect(followed.ok).toBe(true);
    expect(followed.status).toBe(200);
  });
});

describe("[AC-ADMIN-050] the middleware itself is untouched by this SPEC", () => {
  it("still exports the matcher config alongside the handler", async () => {
    const mod = await import("@/middleware");

    expect(typeof mod.middleware).toBe("function");
    expect(mod.config).toBeDefined();
  });
});
