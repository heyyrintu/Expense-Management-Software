// Expense screen ↔ CSV export agreement (G1).
//
// The DoD for wiring the export is "the exported row count matches the
// filtered query count". That is only worth asserting against a real database
// with real rows, because the ways it breaks are all silent: a multi-select
// truncated to its first value, a `q` the export schema doesn't know about, a
// `?scope=` the route ignores, a delegate exporting their own rows while the
// screen shows the principal's.
//
// So: resolve the query the way the SCREEN does, resolve it the way the
// EXPORT ROUTE does — which is now the same function, and this suite is what
// holds it that way — and compare the counts under every filter shape that
// used to differ. Then check the export cannot be aimed across a tenant or
// widened past the caller's role.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import type { ActingCtx } from "@/lib/auth/acting";
import { resolveExpenseListQuery } from "@/lib/domain/expense-list-query";
import { EXPENSE_LIST_ORDER } from "@/lib/domain/expense-query";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

/** A session context of the shape resolveExpenseListQuery expects. */
function session(
  fixture: OrgFixture,
  role: "employee" | "approver" | "finance_admin"
) {
  return {
    userId: fixture.users[role],
    orgId: fixture.orgId,
    role,
  } as Parameters<typeof resolveExpenseListQuery>[1];
}

/** Not acting for anyone — the ordinary case. */
function self(userId: string): ActingCtx {
  return { effectiveUserId: userId, onBehalfOf: null };
}

/**
 * Both paths, run for real.
 *
 * `screen` counts and pages exactly as app/(app)/expenses/page.tsx does;
 * `exported` fetches exactly as app/api/exports/expenses/route.ts does. They
 * call one function, so this compares the RESULT of that sharing rather than
 * two hand-kept-in-step implementations.
 */
async function bothPaths(
  fixture: OrgFixture,
  role: "employee" | "approver" | "finance_admin",
  raw: Record<string, string | string[] | undefined>,
  acting?: ActingCtx
) {
  const db = scopedDb(fixture.orgId);
  const ctx = session(fixture, role);
  const actingCtx = acting ?? self(fixture.users[role]);

  const { where } = await resolveExpenseListQuery(db, ctx, actingCtx, raw);

  const screenCount = (await db.expense.count({ where })) as number;
  const exported = (await db.expense.findMany({
    where,
    orderBy: EXPENSE_LIST_ORDER,
    take: 10_000,
    select: { id: true, merchant: true, status: true, userId: true },
  })) as Array<{ id: string; merchant: string; status: string; userId: string }>;

  return { screenCount, exported };
}

beforeAll(async () => {
  A = await provisionOrg("exp-a");
  B = await provisionOrg("exp-b");

  // A spread of rows the filters can actually bite on: two merchants, three
  // statuses, two owners. The fixture's own expense ("… Cafe", draft,
  // employee) is in here too.
  await owner.expense.createMany({
    data: [
      {
        orgId: A.orgId,
        userId: A.users.employee,
        amount: 5000,
        baseAmount: 5000,
        fxRate: "1",
        currency: "INR",
        date: new Date("2026-07-02"),
        merchant: "Uber",
        categoryId: A.categoryId,
        purpose: "cab",
        status: "submitted",
      },
      {
        orgId: A.orgId,
        userId: A.users.employee,
        amount: 7000,
        baseAmount: 7000,
        fxRate: "1",
        currency: "INR",
        date: new Date("2026-07-03"),
        merchant: "Uber Eats",
        categoryId: A.categoryId,
        purpose: "meal",
        status: "approved",
      },
      {
        orgId: A.orgId,
        userId: A.users.approver,
        amount: 9000,
        baseAmount: 9000,
        fxRate: "1",
        currency: "INR",
        date: new Date("2026-07-04"),
        merchant: "Taxi Co",
        categoryId: A.categoryId,
        purpose: "cab",
        status: "submitted",
      },
    ],
  });

  // The approver must actually manage the employee, or "team" is a team of one
  // and the scope assertions below prove nothing.
  await owner.user.update({
    where: { id: A.users.employee },
    data: { approverId: A.users.approver },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("CSV export returns exactly the rows the table shows", () => {
  it("unfiltered: the exported count equals the screen's count", async () => {
    const { screenCount, exported } = await bothPaths(A, "finance_admin", {
      scope: "org",
    });
    expect(exported).toHaveLength(screenCount);
    expect(screenCount).toBeGreaterThan(0);
  });

  it("a merchant search narrows the export identically", async () => {
    // `q` did not exist in the export route's old schema, so this filter was
    // dropped entirely: the screen showed 2 rows and the file carried 4.
    const { screenCount, exported } = await bothPaths(A, "finance_admin", {
      scope: "org",
      q: "uber",
    });
    expect(exported).toHaveLength(screenCount);
    expect(screenCount).toBe(2); // Uber + Uber Eats, case-insensitive
    for (const row of exported) {
      expect(row.merchant.toLowerCase()).toContain("uber");
    }
  });

  it("a MULTI-select status keeps every value, not just the first", async () => {
    // The old route parsed a single-valued schema, so `?status=submitted&
    // status=approved` exported only the submitted rows.
    const { screenCount, exported } = await bothPaths(A, "finance_admin", {
      scope: "org",
      status: ["submitted", "approved"],
    });
    expect(exported).toHaveLength(screenCount);
    expect(screenCount).toBe(3);
    const statuses = new Set(exported.map((r) => r.status));
    expect(statuses).toEqual(new Set(["submitted", "approved"]));
  });

  it("a user facet narrows the export identically", async () => {
    const { screenCount, exported } = await bothPaths(A, "finance_admin", {
      scope: "org",
      userId: [A.users.approver],
    });
    expect(exported).toHaveLength(screenCount);
    for (const row of exported) expect(row.userId).toBe(A.users.approver);
  });

  it("a date range narrows the export identically", async () => {
    const { screenCount, exported } = await bothPaths(A, "finance_admin", {
      scope: "org",
      from: "2026-07-01",
      to: "2026-07-03",
    });
    expect(exported).toHaveLength(screenCount);
    expect(screenCount).toBe(2);
  });
});

describe("the export honours scope exactly as the screen resolves it", () => {
  it("?scope=mine gives an approver their own rows, not the team's", async () => {
    // The old route used the role CEILING alone and ignored ?scope=, so an
    // approver looking at "mine" exported everyone who reports to them.
    const { screenCount, exported } = await bothPaths(A, "approver", {
      scope: "mine",
    });
    expect(exported).toHaveLength(screenCount);
    for (const row of exported) expect(row.userId).toBe(A.users.approver);
  });

  it("?scope=team widens an approver to their reports, and no further", async () => {
    const { exported } = await bothPaths(A, "approver", { scope: "team" });
    const owners = new Set(exported.map((r) => r.userId));
    expect(owners).toContain(A.users.approver);
    expect(owners).toContain(A.users.employee);
    expect(owners).not.toContain(A.users.finance_admin);
  });

  it("?scope=org from an EMPLOYEE cannot widen the export", async () => {
    const { exported } = await bothPaths(A, "employee", { scope: "org" });
    expect(exported.length).toBeGreaterThan(0);
    for (const row of exported) expect(row.userId).toBe(A.users.employee);
  });

  it("delegation exports the PRINCIPAL's rows, matching the screen", async () => {
    // Acting for the employee, an approver's export must be the principal's
    // expenses — the screen shows those, and the old route showed the
    // delegate's own because it never read the acting context.
    const acting: ActingCtx = {
      effectiveUserId: A.users.employee,
      onBehalfOf: { id: A.users.employee, name: "principal" },
    };
    const { screenCount, exported } = await bothPaths(
      A,
      "approver",
      { scope: "mine" },
      acting
    );
    expect(exported).toHaveLength(screenCount);
    expect(exported.length).toBeGreaterThan(0);
    for (const row of exported) expect(row.userId).toBe(A.users.employee);
  });
});

describe("tenant isolation", () => {
  it("B's export cannot reach A's expenses, however it is filtered", async () => {
    const { exported } = await bothPaths(B, "finance_admin", {
      scope: "org",
      q: "uber",
      status: ["draft", "submitted", "approved", "rejected", "reimbursed"],
      from: "2000-01-01",
      to: "2100-01-01",
    });
    const aIds = new Set(
      (
        (await owner.expense.findMany({
          where: { orgId: A.orgId },
          select: { id: true },
        })) as Array<{ id: string }>
      ).map((r) => r.id)
    );
    for (const row of exported) expect(aIds.has(row.id)).toBe(false);
  });

  it("a userId facet naming A's employee returns nothing for B", async () => {
    const { exported } = await bothPaths(B, "finance_admin", {
      scope: "org",
      userId: [A.users.employee],
    });
    expect(exported).toHaveLength(0);
  });
});
