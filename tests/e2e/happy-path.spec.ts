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
  await expect(admin.getByText("Travel").first()).toBeVisible();

  // --- invite an employee, approver = admin
  await admin.goto("/settings/users");
  await admin.getByRole("button", { name: "Invite user" }).click();
  await admin.getByLabel("Name", { exact: true }).fill("Emp E");
  await admin.getByLabel("Work email").fill(EMP_EMAIL);
  await admin.getByLabel("Assigned approver (optional)").selectOption({ label: "Admin A" });
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
  await emp.getByRole("button", { name: "Add expense" }).click();
  await emp.waitForURL("**/expenses");
  await expect(emp.getByText("E2E Cafe").first()).toBeVisible();

  // --- report: create, attach, submit
  await emp.goto("/reports/new");
  await emp.getByLabel("Title").fill("E2E Trip");
  await emp.getByRole("button", { name: "Create report" }).click();
  await emp.waitForURL(/\/reports\/[0-9a-f-]+/);
  await emp.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(emp.getByRole("button", { name: "Submit for approval" })).toBeEnabled();
  await emp.getByRole("button", { name: "Submit for approval" }).click();
  await expect(emp.getByText("Submitted", { exact: true }).first()).toBeVisible();

  // --- admin approves from the queue
  await admin.goto("/approvals");
  await admin.getByRole("link", { name: "Review" }).first().click();
  await admin.waitForURL(/\/approvals\/[0-9a-f-]+/);
  await admin.getByRole("button", { name: /^Approve/ }).click();
  await admin.waitForURL("**/approvals");

  // --- admin (finance) reimburses
  await admin.goto("/finance");
  await admin.getByRole("checkbox", { name: /Select E2E Trip/ }).check();
  await admin.getByLabel("Payment reference").fill("E2E-BATCH-1");
  await admin.getByRole("button", { name: "Mark reimbursed" }).click();
  await expect(admin.getByText(/Marked 1 report/)).toBeVisible();

  // --- employee sees the money on its way
  await emp.goto(`/reports`);
  await expect(emp.getByText("Reimbursed").first()).toBeVisible();
  await emp.goto("/notifications");
  await expect(emp.getByText("Reimbursement on its way").first()).toBeVisible();
});
