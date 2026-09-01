// The MVP demo in one spec: a FRESH org goes signup → invite employee →
// capture expense → report → submit → approve → reimburse. Self-contained:
// no seed data required, unique slug per run.
import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const SLUG = `e2e-${run}`;
const ADMIN_EMAIL = `admin@${SLUG}.test`;
const EMP_EMAIL = `emp@${SLUG}.test`;
const PASSWORD = "Password123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Organization").fill(SLUG);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.configure({ mode: "serial" });

test("signup → invite → submit → approve → reimburse", async ({ browser }) => {
  // The whole MVP in one test: two browser contexts, ~15 navigations and a
  // non-optimistic payment round trip. It runs in ~40s warm, but every route
  // it touches is compiled on first visit by `next dev`, so a cold run needs
  // considerably more than the 60s default.
  test.setTimeout(180_000);
  const admin = await browser.newPage();

  // --- signup: org + first user = org_admin
  await admin.goto("/signup");
  await admin.getByLabel("Organization name").fill("E2E Org");
  await admin.getByLabel("Workspace URL").fill(SLUG);
  await admin.getByLabel("Your name").fill("Admin A");
  await admin.getByLabel("Work email").fill(ADMIN_EMAIL);
  await admin.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await admin.getByRole("button", { name: "Create organization" }).click();
  await admin.waitForURL("**/dashboard");

  // --- a category so expenses can be filed
  await admin.goto("/settings/categories/new");
  await admin.getByLabel("Name", { exact: true }).fill("Travel");
  await admin.getByRole("button", { name: "Create category" }).click();
  await admin.waitForURL("**/settings/categories");
  // .filter({ visible: true }) matters: settings/categories renders the list
  // TWICE — a card <ul className="grid gap-3 md:hidden"> for narrow screens
  // and a table for wide ones. Plain .first() resolves to the mobile card,
  // which is display:none at the desktop viewport Playwright runs at, so
  // the assertion failed against an element that was correctly hidden.
  await expect(
    admin.getByText("Travel").filter({ visible: true }).first()
  ).toBeVisible();

  // --- invite an employee, approver = admin
  await admin.goto("/settings/users");
  await admin.getByRole("button", { name: "Invite user" }).click();
  await admin.getByLabel("Name", { exact: true }).fill("Emp E");
  await admin.getByLabel("Work email").fill(EMP_EMAIL);
  // The field is labelled "Approver (optional)" — there has never been an
  // "Assigned approver". This spec has never run in CI, so the drift was
  // free to accumulate.
  await admin.getByLabel(/^Approver/).selectOption({ label: "Admin A" });
  await admin.getByRole("button", { name: "Send invite" }).click();
  const inviteLink = (await admin.locator("code").textContent()) ?? "";
  expect(inviteLink).toContain("/invite/");

  // --- employee accepts the invite and logs in
  const emp = await browser.newPage();
  await emp.goto(inviteLink);
  await emp.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await emp.getByRole("button", { name: "Activate account" }).click();
  await emp.waitForURL("**/login**");
  await login(emp, EMP_EMAIL);

  // --- capture an expense
  await emp.goto("/expenses/new");
  await emp.getByLabel(/Amount/).fill("1234.50");
  await emp.getByLabel("Merchant").fill("E2E Cafe");
  await emp.getByLabel("Category").selectOption({ label: "Travel" });
  // "Add expense" is the PAGE TITLE, not a control. The capture form ends
  // in two buttons — "Save draft" (goes to the list) and "Add to report".
  // The list is what this step asserts on next.
  await emp.getByRole("button", { name: "Save draft" }).click();
  await emp.waitForURL("**/expenses");
  await expect(emp.getByText("E2E Cafe").first()).toBeVisible();

  // --- report: assembled FROM THE EXPENSES LIST, then submitted.
  // The old steps drove /reports/new and then an "Add" button on the report
  // detail page. Neither exists: a report is built by selecting expenses and
  // using the "Add to report" bulk action, whose "New report…" branch
  // creates the report and navigates to it.
  await emp.getByRole("checkbox", { name: "Select expense from E2E Cafe" }).check();
  await emp.getByRole("button", { name: "Add to report" }).click();
  await emp.getByRole("button", { name: /New report/ }).click();
  await emp.getByLabel("New report title").fill("E2E Trip");
  await emp.getByRole("button", { name: "Create and add" }).click();
  await emp.waitForURL(/\/reports\/[0-9a-f-]+/);
  await expect(emp.getByRole("button", { name: "Submit for approval" })).toBeEnabled();
  await emp.getByRole("button", { name: "Submit for approval" }).click();
  // §7.2: submitting goes through SubmitDialog — it shows the count, the
  // total, the approver's NAME and any flags — so it needs a second,
  // explicit confirm. The spec used to assume a one-click submit.
  await emp.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    emp.getByText("Submitted", { exact: true }).filter({ visible: true }).first()
  ).toBeVisible();

  // --- admin approves from the queue
  await admin.goto("/approvals");
  // The queue row offers inline Approve / Send back / Reject plus an "Open"
  // link — there has never been a "Review" link. Going through the detail
  // page deliberately: the queue's Approve is OPTIMISTIC with a 5s undo
  // window (§7.3), so asserting on it would mean racing that timer.
  await admin.getByRole("link", { name: "Open" }).first().click();
  await admin.waitForURL(/\/approvals\/[0-9a-f-]+/);
  await admin.getByRole("button", { name: /^Approve/ }).click();
  await admin.waitForURL("**/approvals");

  // --- admin (finance) reimburses
  // Money movement is never optimistic (§7.4): this is a TWO-STEP sheet —
  // set method/date and a per-report reference, then review every line and
  // the batch total before committing. The spec still drove the old
  // single-button "Mark reimbursed" flow with a "Payment reference" field,
  // neither of which exists any more.
  await admin.goto("/finance");
  await admin.getByRole("checkbox", { name: /Select E2E Trip/ }).check();
  await admin.getByRole("button", { name: /^Pay 1 report/ }).click();
  await admin.getByLabel("Reference for E2E Trip").fill("E2E-BATCH-1");
  await admin.getByRole("button", { name: /^Review 1 payment/ }).click();
  await admin.getByRole("button", { name: "Record payments" }).click();
  // Longer than the default 5s expect window on purpose: recording a payment
  // run is a real server round trip (observed ~6s in dev) and money movement
  // is deliberately NOT optimistic, so the toast cannot appear before the
  // server has answered.
  await expect(admin.getByText(/Recorded 1 payment/)).toBeVisible({
    timeout: 20_000,
  });

  // --- employee sees the money on its way
  await emp.goto(`/reports`);
  // "Reimbursed" is the DB status; the BADGE reads "Paid" (DESIGN-PRD §5.2).
  // Asserting on the status name rather than the label is how this went
  // unnoticed — nothing ever rendered the word "Reimbursed" to a user.
  // Asserted on the ROW's accessible name, not a bare text node: StatusBadge
  // renders an sr-only "Status:" prefix beside the word, and the whole row
  // collapses into one link label — "E2E Trip ₹1,234.50 Status: Paid …" —
  // so there is no text node equal to "Paid" to match exactly.
  await expect(
    emp.getByRole("link", { name: /Status: Paid/ }).first()
  ).toBeVisible();
  await emp.goto("/notifications");
  await expect(
    emp.getByText("Reimbursement on its way").filter({ visible: true }).first()
  ).toBeVisible();
});
