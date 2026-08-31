// Visual baseline capture (D5.5).
//
// Writes a full-page PNG of every key screen at desktop and mobile widths
// into docs/screenshots/, to serve as the reference future regressions are
// compared against.
//
// ── NOT A VISUAL-REGRESSION TEST ──────────────────────────────────────────
// This CAPTURES; it does not assert. Playwright's `toHaveScreenshot` would
// fail the build on a one-pixel antialiasing difference between machines,
// which is how visual tests get muted within a month. The baseline's job is
// to make a change VISIBLE in a diff when someone reviews it — a human
// comparison, at review time, on purpose.
//
// Run with: npx playwright test tests/e2e/screenshots.spec.ts
import { test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const SLUG = `shot-${run}`;
const ADMIN_EMAIL = `admin@${SLUG}.test`;
const PASSWORD = "Password123!";

/** 390 is the iPhone 14 width and the narrowest real device we design for;
 *  1440 is the desktop the §5.5 grid is specified against. */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** The screens DESIGN-PRD §7 specifies, plus the shell that frames them. */
const SCREENS = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/expenses", name: "expenses" },
  { path: "/expenses/new", name: "add-expense" },
  { path: "/reports", name: "reports" },
  { path: "/approvals", name: "approval-queue" },
  { path: "/finance", name: "finance-queue" },
  { path: "/ledger", name: "ledger" },
  { path: "/bank-recon", name: "reconciliation" },
  { path: "/complaints", name: "complaints" },
  { path: "/profile", name: "profile" },
  { path: "/settings/organization", name: "settings-organization" },
  { path: "/settings/users", name: "settings-users" },
] as const;

test.describe.configure({ mode: "serial" });

test.describe("visual baseline", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    await page.goto("/signup");
    await page.getByLabel("Organization name").fill("Baseline Org");
    await page.getByLabel("Workspace URL").fill(SLUG);
    await page.getByLabel("Your name").fill("Admin A");
    await page.getByLabel("Work email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create organization" }).click();
    await page.waitForURL("**/dashboard");

    // Real content, or the baseline records empty states forever and every
    // future diff is against a screen nobody actually sees.
    await page.goto("/settings/categories/new");
    await page.getByLabel("Name", { exact: true }).fill("Travel");
    await page.getByRole("button", { name: "Create category" }).click();
    await page.waitForURL("**/settings/categories");

    for (const [merchant, amount] of [
      ["IndiGo 6E-2043", "14500.00"],
      ["Blue Tokai", "450.00"],
      ["Uber", "340.50"],
    ]) {
      await page.goto("/expenses/new");
      await page.getByLabel("Amount").fill(amount);
      await page.getByLabel("Merchant").fill(merchant);
      await page.getByRole("button", { name: /save draft/i }).click();
      await page.waitForURL("**/expenses**");
    }
  });

  test.afterAll(async () => {
    await page.close();
  });

  for (const viewport of VIEWPORTS) {
    for (const screen of SCREENS) {
      test(`${screen.name} @ ${viewport.name}`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(screen.path);
        // NOT networkidle — see the note in a11y.spec.ts. Under `next dev`
        // the HMR websocket keeps a connection open forever, so this can
        // only ever end at the timeout.
        await page.waitForLoadState("load");
        await page.locator("main").waitFor({ state: "visible", timeout: 30_000 });
        // Skeletons pulse and charts animate in; a moment of settling keeps
        // the baseline from capturing a half-drawn frame.
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `docs/screenshots/${screen.name}-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  }
});
