// The a11y suite's ROUTE COVERAGE, checked without a browser (D5.3 / G4).
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────
// `tests/e2e/a11y.spec.ts` needs a dev server, a database and Chromium, so it
// runs rarely and, until CI was wired, never. Its ROUTES list had drifted to
// 18 entries while the app had 29 id-less routes — a third of the product,
// including three screens edited in the two commits before this one, was
// silently unscanned.
//
// That drift is not something axe can catch: a suite that never visits a
// route reports zero violations for it, and zero reads exactly like a pass.
// The only way coverage stays honest is if a MISSING route fails a build.
//
// So this test walks the real route tree and asserts the spec names every
// route it should. It is a unit test on purpose — no browser, no server, no
// database — so it runs in `npm run test`, which CI has always run, and it
// fails the moment someone adds a screen without adding it to the scan.
//
// Same discipline as tests/unit/nav.test.ts (nav mirrors each route's guard)
// and tests/unit/settings-nav.test.ts (minRole mirrors the guard): a list that
// must be maintained by hand is a list that rots, unless something checks it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SPEC = "tests/e2e/a11y.spec.ts";

/**
 * Routes the suite deliberately does not scan, each with the reason.
 *
 * An exclusion list is the honest half of a coverage check — the alternative
 * is a check everyone learns to edit rather than satisfy. Every entry here is
 * a decision, not an oversight, and adding one should feel like a cost.
 */
const EXCLUDED: Record<string, string> = {
  "/": "A redirect that resolves to /dashboard or /login before anything paints.",
  "/settings":
    "Redirect-only (redirect to /settings/organization). Next implements it " +
    "with a meta refresh, which axe flags as a critical meta-refresh " +
    "violation on markup nobody authored — the destination is scanned instead.",
  "/design-system":
    "A dev surface that quotes bad copy and unfinished components on purpose — it would fail by design.",
  "/super": "A separate auth realm; the a11y run holds a tenant session, not a platform one.",
  "/super/login":
    "The platform console's own sign-in, outside the tenant session this run holds.",
  "/invite/[token]": "Needs a live invite token; covered by the happy path instead.",
};

/** Turn `app/(app)/settings/users/page.tsx` into `/settings/users`. */
function toRoute(file: string): string {
  const path = file
    .replace(/\\/g, "/")
    .replace(/^app/, "")
    .replace(/\/page\.tsx$/, "")
    // Route groups — (app), (auth), (dev) — are organisational, not URL segments.
    .replace(/\/\([^)]+\)/g, "");
  return path === "" ? "/" : path;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

/** Every route the app actually serves. */
function realRoutes(): string[] {
  return walk("app").map(toRoute).sort();
}

/** Routes carrying a dynamic segment — they need an id from setup. */
function isDynamic(route: string): boolean {
  return route.includes("[");
}

/** The paths named in the spec, from both its public and tenant lists. */
function scannedRoutes(): Set<string> {
  const src = readFileSync(SPEC, "utf8");
  const found = new Set<string>();

  const publicList = /for \(const path of \[(.*?)\]\)/s.exec(src);
  if (publicList) {
    for (const m of publicList[1].matchAll(/"([^"]+)"/g)) found.add(m[1]);
  }

  const routes = /const ROUTES = \[(.*?)\];/s.exec(src);
  if (routes) {
    for (const m of routes[1].matchAll(/"([^"]+)"/g)) found.add(m[1]);
  }

  return found;
}

describe("a11y suite route coverage", () => {
  it("finds the spec and parses both of its route lists", () => {
    // If the spec is restructured and these regexes stop matching, every
    // assertion below would pass vacuously — so prove the parse worked first.
    const scanned = scannedRoutes();
    expect(scanned).toContain("/login");
    expect(scanned).toContain("/dashboard");

    // An EXACT count, derived rather than hard-coded.
    //
    // This was `toBeGreaterThan(20)`, a floor — which is how three documents
    // ended up claiming three different numbers (20, 29, and the spec's
    // actual 34) with nothing to contradict them. A floor cannot catch a
    // count drifting upward, and the count is exactly what the docs quote.
    //
    // Deriving it from the route tree rather than writing 34 keeps this true
    // when a route is added: the expectation moves with the app, and the
    // "scans every static route" test below is what forces the spec to move
    // with it too. The number is stated in the message so a mismatch reports
    // both sides.
    const expected = realRoutes()
      .filter((r) => !isDynamic(r))
      .filter((r) => !(r in EXCLUDED));
    expect(
      scanned.size,
      `the spec scans ${scanned.size} routes; the app has ${expected.length} ` +
        `id-less, non-excluded routes (34 at the time of writing). If these ` +
        `disagree, update tests/e2e/a11y.spec.ts AND the counts quoted in ` +
        `docs/A11Y-AUDIT.md and DESIGN-PLAN.md.`
    ).toBe(expected.length);
  });

  it("scans every static route the app serves", () => {
    const scanned = scannedRoutes();
    const missing = realRoutes()
      .filter((r) => !isDynamic(r))
      .filter((r) => !(r in EXCLUDED))
      .filter((r) => !scanned.has(r));

    expect(
      missing,
      `These routes exist but ${SPEC} never scans them. Add each to ROUTES, ` +
        `or to EXCLUDED in this file with a reason:\n  ${missing.join("\n  ")}`
    ).toEqual([]);
  });

  it("does not name routes that no longer exist", () => {
    // The other direction: a scan of a deleted route fails confusingly, and a
    // scan of a renamed one silently checks a 404 page.
    const real = new Set(realRoutes());
    const stale = [...scannedRoutes()].filter((r) => !real.has(r));

    expect(
      stale,
      `${SPEC} scans routes the app no longer serves:\n  ${stale.join("\n  ")}`
    ).toEqual([]);
  });

  it("keeps every exclusion pointing at a real route", () => {
    const real = new Set(realRoutes());
    const orphaned = Object.keys(EXCLUDED).filter((r) => !real.has(r));
    expect(
      orphaned,
      `EXCLUDED names routes that do not exist — delete them:\n  ${orphaned.join("\n  ")}`
    ).toEqual([]);
  });

  it("records why each exclusion is excluded", () => {
    for (const [route, why] of Object.entries(EXCLUDED)) {
      expect(why.length, `${route} needs a real reason`).toBeGreaterThan(30);
    }
  });

  it("leaves the dynamic routes visibly uncovered rather than pretending", () => {
    // Not a failure — a statement. These need an id captured during setup and
    // are the screens where StatusBadge, the report timeline and the decision
    // panel actually render, so they are the most valuable ones still missing.
    const dynamic = realRoutes().filter(isDynamic).filter((r) => !(r in EXCLUDED));
    expect(dynamic.length).toBeGreaterThan(0);
    // If someone adds id-based scanning, this count drops and the test says so.
    expect(dynamic).toEqual([
      "/approvals/[id]",
      "/complaints/[id]",
      "/expenses/[id]",
      "/reports/[id]",
      "/settings/categories/[id]",
      "/settings/users/[id]",
    ]);
  });
});
