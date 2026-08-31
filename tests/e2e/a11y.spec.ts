// Automated accessibility checks (D5.3) — WCAG 2.1 AA via axe-core.
//
// ── WHAT THIS CATCHES, AND WHAT IT DOESN'T ────────────────────────────────
// axe finds roughly a third of real accessibility problems: missing names,
// bad roles, contrast, orphaned labels, duplicate ids, landmark structure.
// It cannot tell you whether the focus order makes sense, whether a screen
// reader's narration is comprehensible, or whether a keyboard user can
// actually finish a task. Those need a person, and docs/A11Y-AUDIT.md is
// explicit about which of them have been done.
//
// So this suite is the floor, not the ceiling — but it is a floor that holds
// on every commit, which is more than a one-off manual pass ever does.
//
// The run provisions its own org (same shape as happy-path.spec.ts) so the
// authenticated routes are checked with REAL content in them. Scanning an
// empty-state screen would pass while saying nothing about the table, the
// badges or the amounts a working screen actually renders.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type BrowserContext } from "@playwright/test";

const run = Date.now().toString(36);
const SLUG = `a11y-${run}`;
const ADMIN_EMAIL = `admin@${SLUG}.test`;
const PASSWORD = "Password123!";

/** WCAG 2.1 A + AA. `best-practice` is deliberately excluded: it flags
 *  opinions (heading-order preferences, region rules) that are not AA
 *  requirements, and a suite that fails on opinions gets muted. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Rules disabled, each with a reason. This list is the honest part of an
 * automated a11y suite — an empty one usually means the rules were never
 * really run.
 */
const DISABLED: Array<{ id: string; why: string }> = [
  {
    id: "color-contrast",
    why:
      "Checked exhaustively and deterministically by scripts/check-contrast.mjs " +
      "against the token source, which covers pairs no rendered page happens to " +
      "show. axe re-checks the same thing against antialiased pixels and " +
      "disagrees on sub-pixel edges.",
  },
];

async function scan(page: Page, context?: string) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const rule of DISABLED) builder = builder.disableRules(rule.id);
  const results = await builder.analyze();

  // Report every violation with its nodes — a bare count tells whoever reads
  // CI nothing about what to fix.
  if (results.violations.length > 0) {
    const detail = results.violations
      .map(
        (v) =>
          `\n  [${v.impact}] ${v.id}: ${v.help}\n  ${v.helpUrl}\n` +
          v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n")
      )
      .join("\n");
    throw new Error(
      `${results.violations.length} accessibility violation(s)` +
        `${context ? ` on ${context}` : ""}:${detail}`
    );
  }
  expect(results.violations).toEqual([]);
}

/**
 * Creates an org and signs its admin in. Extracted so the overlays block can
 * stand up its OWN tenant instead of borrowing the one "tenant routes"
 * happens to have created — a describe that depends on another describe's
 * beforeAll cannot be run on its own (`-g overlays` just fails to log in),
 * which is exactly when you want to run it while fixing a violation.
 */
async function signupOrg(page: Page, slug: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Organization name").fill("A11y Org");
  await page.getByLabel("Workspace URL").fill(slug);
  await page.getByLabel("Your name").fill("Admin A");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Unauthenticated routes
// ---------------------------------------------------------------------------

test.describe("public routes", () => {
  for (const path of ["/login", "/signup"]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      await scan(page, path);
    });
  }
});

// ---------------------------------------------------------------------------
// Authenticated routes, with real data
// ---------------------------------------------------------------------------

test.describe("tenant routes", () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // browser.newContext() rather than browser.newPage(): @axe-core/playwright
    // refuses a page created from the implicit context with "Please use
    // browser.newContext()", so every route scan errored before axe ran. The
    // suite has never executed in CI, so nothing surfaced it.
    context = await browser.newContext();
    page = await context.newPage();

    await signupOrg(page, SLUG, ADMIN_EMAIL);

    // A category and an expense, so lists and tables have rows to render.
    await page.goto("/settings/categories/new");
    await page.getByLabel("Name", { exact: true }).fill("Travel");
    await page.getByRole("button", { name: "Create category" }).click();
    await page.waitForURL("**/settings/categories");

    await page.goto("/expenses/new");
    await page.getByLabel("Amount").fill("1250.00");
    await page.getByLabel("Merchant").fill("Indigo Airlines");
    await page.getByRole("button", { name: /save draft/i }).click();
    await page.waitForURL("**/expenses**");
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  /**
   * Every tenant route reachable without an id.
   *
   * ── COVERAGE IS PART OF THE ASSERTION ─────────────────────────────────────
   * This list was 18 routes and the app has 29 without an id, so a third of
   * the product was never scanned — including `/card-imports`,
   * `/settings/whatsapp` and `/recurring`, three screens edited as recently as
   * the last two commits. A suite that passes because it never looked is
   * worse than no suite: it produces a green tick that stops anyone looking.
   *
   * All of these are reachable by the org_admin this run signs up as
   * (org_admin ≥ finance_admin ≥ approver, and every guard below is one of
   * those three), so a redirect here means a broken guard, not a missing role.
   *
   * STILL NOT COVERED, deliberately:
   *   * `/` — a redirect that resolves before anything paints.
   *   * `/:id` detail routes (`/expenses/[id]`, `/reports/[id]`,
   *     `/approvals/[id]`, `/complaints/[id]`, `/settings/users/[id]`,
   *     `/settings/categories/[id]`) — each needs an id captured during
   *     setup. Worth adding; they are where StatusBadge, the timeline and the
   *     decision panel actually render.
   *   * `/design-system` — a dev surface that deliberately quotes bad copy
   *     and unfinished components, so it would fail on purpose.
   *   * `/super/**` — a separate auth realm this run has no session for.
   */
  const ROUTES = [
    "/dashboard",
    "/expenses",
    "/expenses/new",
    "/reports",
    "/reports/new",
    "/approvals",
    "/finance",
    "/finance/accounting",
    "/ledger",
    "/bank-recon",
    "/complaints",
    "/advances",
    "/budgets",
    "/analytics",
    "/analytics/violations",
    "/card-imports",
    "/recurring",
    "/notifications",
    "/profile",
    // NOTE: the bare settings index is redirect-only and is listed in
    // EXCLUDED in tests/unit/a11y-coverage.test.ts with its reason. Do not
    // name it here in quotes: the coverage parser reads quoted strings out
    // of this file, comments included.
    "/settings/organization",
    "/settings/users",
    "/settings/categories",
    "/settings/categories/new",
    "/settings/departments",
    "/settings/approval-chains",
    "/settings/clients",
    "/settings/per-diem",
    "/settings/accounting",
    "/settings/delegations",
    "/settings/email-ingestion",
    "/settings/whatsapp",
  ];

  for (const path of ROUTES) {
    test(`${path} has no axe violations`, async () => {
      // Playwright starts `next dev`, which compiles each route on its FIRST
      // visit — so the first hit on a cold route can spend most of a minute
      // in webpack before any HTML arrives. The default 60s budget makes
      // that look like an accessibility failure ("Target page ... has been
      // closed" from waitForLoadState) when nothing was ever scanned.
      test.setTimeout(120_000);
      await page.goto(path);
      // NOT networkidle. Playwright starts `next dev`, which holds an open
      // HMR websocket for the life of the page, so the network is never
      // idle and this wait can only ever end at the timeout — with the page
      // torn down and nothing scanned, reported as an a11y failure. `load`
      // plus the main landmark being visible is the honest "the screen has
      // rendered" signal, and these routes fetch server-side so the real
      // content is in the first HTML rather than behind a skeleton.
      await page.waitForLoadState("load");
      await page.locator("main").waitFor({ state: "visible", timeout: 30_000 });
      await scan(page, path);
    });
  }
});

// ---------------------------------------------------------------------------
// Overlays
//
// A dialog or sheet is a different DOM than the page behind it, and it is
// where focus management goes wrong — so each is opened and scanned in its
// open state rather than trusting the closed page's clean result.
// ---------------------------------------------------------------------------

test.describe("overlays", () => {
  // Its own org and its own context, for the reason on signupOrg above and
  // because axe refuses a page from the implicit context.
  const OV_SLUG = `a11y-ov-${run}`;
  const OV_EMAIL = `admin@${OV_SLUG}.test`;
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await signupOrg(page, OV_SLUG, OV_EMAIL);
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test("invite user sheet", async () => {
    await page.goto("/settings/users");
    await page.getByRole("button", { name: "Invite user" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await scan(page, "invite user sheet");
  });

  test("statement import sheet", async () => {
    await page.goto("/bank-recon");
    await page.getByRole("button", { name: /import a statement/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await scan(page, "import sheet");
  });
});
