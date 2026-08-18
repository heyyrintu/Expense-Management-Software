// Isolation for 4.2: dashboard/export scopes stay inside the org AND the
// role-derived user pin.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildExpenseWhere } from "@/lib/domain/expense-query";
import { resolveExpenseScope } from "@/lib/domain/expense-scope";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("dash-a");
  B = await provisionOrg("dash-b");
  // approver's team = employee
  await owner.user.update({
    where: { id: A.users.employee },
    data: { approverId: A.users.approver },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

function sessionCtx(orgId: string, userId: string, role: "employee" | "approver" | "finance_admin") {
  return { userId, orgId, orgSlug: "x", role } as const;
}

describe("scope resolution + query", () => {
  it("employee scope returns only own expenses", async () => {
    const db = scopedDb(A.orgId);
    const scope = await resolveExpenseScope(db, sessionCtx(A.orgId, A.users.finance_admin, "employee"));
    const rows = await db.expense.findMany({ where: buildExpenseWhere(scope, {}) });
    expect(rows).toHaveLength(0); // fixture expense belongs to the employee
  });

  it("approver team scope covers self + direct reports, nothing else", async () => {
    const db = scopedDb(A.orgId);
    const scope = await resolveExpenseScope(db, sessionCtx(A.orgId, A.users.approver, "approver"));
    expect(scope.kind).toBe("team");
    const rows = (await db.expense.findMany({
      where: buildExpenseWhere(scope, {}),
    })) as Array<{ userId: string }>;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect([A.users.approver, A.users.employee]).toContain(r.userId);
    }
  });

  it("org scope still cannot cross orgs (scopedDb boundary)", async () => {
    const db = scopedDb(B.orgId);
    const scope = await resolveExpenseScope(db, sessionCtx(B.orgId, B.users.finance_admin, "finance_admin"));
    const rows = (await db.expense.findMany({
      where: buildExpenseWhere(scope, {}),
    })) as Array<{ orgId: string }>;
    for (const r of rows) expect(r.orgId).toBe(B.orgId);
    const ids = (rows as unknown as Array<{ id: string }>).map((r) => r.id);
    expect(ids).not.toContain(A.expenseId);
  });
});
