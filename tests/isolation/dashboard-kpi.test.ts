// Dashboard KPIs and the `?scope=` ceiling (D3.3), against a real database.
//
// Two properties, and they pull in opposite directions, which is why they are
// tested together.
//
//  1. §7.4 — every KPI must equal the total of the table it links to. D3.3
//     widened the expense list so an org-wide card HAS a table to link to;
//     this walks each card's href, pages through the rows, and adds them up.
//
//  2. That widening must never cross a tenant, and must never let a role
//     exceed its ceiling. `?scope=org` is the only parameter in the product
//     that asks for MORE rows, so it is tried from every role and from the
//     wrong organisation.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import {
  buildApproverKpis,
  buildEmployeeKpis,
  buildFinanceKpis,
  type DashboardKpi,
} from "@/lib/domain/dashboard-kpi";
import {
  applyExpenseFilters,
  EXPENSE_LIST_ORDER,
  type ExpenseScope,
} from "@/lib/domain/expense-query";
import { narrowViewScope, viewScopeWhere } from "@/lib/domain/expense-scope";
import type { StatusGroup } from "@/lib/domain/expense-stats";
import { summarisePayable, payableQuery } from "@/lib/domain/payable";
import {
  EMPTY_EXPENSE_FILTERS,
  parseExpenseFilters,
  searchParamsToRecord,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

const PAGE_SIZE = 50;
/** Enough to cross a page boundary — where a capped table and a whole-set
 *  aggregate quietly stop agreeing. */
const ROWS_PER_USER = 40;

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("dash-a");
  B = await provisionOrg("dash-b");

  const statuses = ["draft", "submitted", "approved", "reimbursed"] as const;

  // Spread across THREE owners in org A so team and org views differ from
  // "mine" — a scope test where every row belongs to the reader proves
  // nothing.
  for (const [tag, userId] of [
    ["emp", A.users.employee],
    ["apr", A.users.approver],
    ["fin", A.users.finance_admin],
  ] as const) {
    await owner.expense.createMany({
      data: Array.from({ length: ROWS_PER_USER }, (_, i) => ({
        orgId: A.orgId,
        userId,
        amount: (i + 1) * 100,
        baseAmount: (i + 1) * 100,
        currency: "INR",
        date: new Date(Date.UTC(2026, 6, (i % 28) + 1)),
        merchant: `${tag} merchant ${i}`,
        categoryId: A.categoryId,
        status: statuses[i % statuses.length],
      })),
    });
  }

  // The approver's direct report, so the team scope is a real set.
  await owner.user.update({
    where: { id: A.users.employee },
    data: { approverId: A.users.approver },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

const NO_FILTERS: ExpenseFilters = { ...EMPTY_EXPENSE_FILTERS };

/** The dashboard's own query, for a scope ceiling and a filter state. */
async function dashboardWhere(
  orgId: string,
  ceiling: ExpenseScope,
  selfId: string,
  requested: "mine" | "team" | "org",
  filters: ExpenseFilters
) {
  const scopeWhere = viewScopeWhere(ceiling, requested, selfId);
  return applyExpenseFilters(scopeWhere, filters);
}

async function statusGroupsFor(orgId: string, where: Record<string, unknown>) {
  return (await scopedDb(orgId).expense.groupBy({
    by: ["status"],
    where,
    _sum: { baseAmount: true },
    _count: { _all: true },
  })) as StatusGroup[];
}

/**
 * Follow a card's href the way a click would: parse the query string, rebuild
 * the list's where-clause from it, then page through and total.
 */
async function walkLinkedList(
  orgId: string,
  ceiling: ExpenseScope,
  selfId: string,
  href: string
) {
  const url = new URL(href, "https://example.test");
  const requested = (url.searchParams.get("scope") ?? "mine") as "mine" | "team" | "org";
  url.searchParams.delete("scope");
  const filters = parseExpenseFilters(searchParamsToRecord(url.searchParams));

  // The list clamps the requested scope exactly as the page does.
  const where = applyExpenseFilters(
    viewScopeWhere(ceiling, narrowViewScope(ceiling, requested), selfId),
    filters
  );

  const db = scopedDb(orgId);
  let pageIndex = 0;
  let total = 0;
  let count = 0;
  for (;;) {
    const rows = (await db.expense.findMany({
      where,
      orderBy: EXPENSE_LIST_ORDER,
      skip: pageIndex * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { baseAmount: true },
    })) as Array<{ baseAmount: number }>;
    if (rows.length === 0) break;
    for (const row of rows) total += row.baseAmount;
    count += rows.length;
    pageIndex += 1;
    if (rows.length < PAGE_SIZE) break;
  }
  return { total, count };
}

/** Assert every EXACT expense-backed card equals the list it opens. */
async function assertCardsMatchTheirLists(
  kpis: DashboardKpi[],
  orgId: string,
  ceiling: ExpenseScope,
  selfId: string
) {
  let checked = 0;
  for (const kpi of kpis) {
    if (kpi.agreement.kind !== "exact") continue;
    if (!kpi.agreement.href.startsWith("/expenses")) continue;
    const walked = await walkLinkedList(orgId, ceiling, selfId, kpi.agreement.href);
    expect(walked.total, `${kpi.label} — total`).toBe(kpi.value);
    expect(walked.count, `${kpi.label} — count`).toBe(
      Number(kpi.hint?.split(" ")[0] ?? -1)
    );
    checked += 1;
  }
  // A test that silently checked nothing would pass forever.
  expect(checked).toBeGreaterThan(0);
}

describe("§7.4 — every KPI equals the total of the table it links to", () => {
  it("employee dashboard", async () => {
    const ceiling: ExpenseScope = { kind: "employee", userId: A.users.employee };
    const where = await dashboardWhere(
      A.orgId,
      ceiling,
      A.users.employee,
      "mine",
      NO_FILTERS
    );
    const kpis = buildEmployeeKpis({
      groups: await statusGroupsFor(A.orgId, where),
      filters: NO_FILTERS,
      currency: "INR",
      monthly: [],
    });
    await assertCardsMatchTheirLists(kpis, A.orgId, ceiling, A.users.employee);
  });

  it("approver dashboard, across a team of more than one", async () => {
    const ceiling: ExpenseScope = {
      kind: "team",
      teamUserIds: [A.users.approver, A.users.employee],
    };
    const where = await dashboardWhere(
      A.orgId,
      ceiling,
      A.users.approver,
      "team",
      NO_FILTERS
    );
    const kpis = buildApproverKpis({
      groups: await statusGroupsFor(A.orgId, where),
      filters: NO_FILTERS,
      currency: "INR",
      monthly: [],
      queue: { count: 0, total: 0, flagged: 0 },
    });
    await assertCardsMatchTheirLists(kpis, A.orgId, ceiling, A.users.approver);
  });

  it("finance dashboard, org-wide and across a page boundary", async () => {
    const ceiling: ExpenseScope = { kind: "org" };
    const where = await dashboardWhere(
      A.orgId,
      ceiling,
      A.users.finance_admin,
      "org",
      NO_FILTERS
    );
    const groups = await statusGroupsFor(A.orgId, where);
    const rowCount = groups.reduce((n, g) => n + g._count._all, 0);
    // Three owners × 40 rows — comfortably past one page.
    expect(rowCount).toBeGreaterThan(PAGE_SIZE);

    const payable = (await scopedDb(A.orgId).expenseReport.findMany({
      ...payableQuery(),
      select: { total: true, reimbursements: { select: { amountPaid: true } } },
    })) as Array<{ total: number; reimbursements: Array<{ amountPaid: number }> }>;

    const kpis = buildFinanceKpis({
      groups,
      filters: NO_FILTERS,
      currency: "INR",
      monthly: [],
      payable: summarisePayable(payable),
    });
    await assertCardsMatchTheirLists(kpis, A.orgId, ceiling, A.users.finance_admin);
  });

  it("still agrees once a filter is applied", async () => {
    const ceiling: ExpenseScope = { kind: "org" };
    const filters: ExpenseFilters = {
      ...EMPTY_EXPENSE_FILTERS,
      categoryId: [A.categoryId],
      from: "2026-07-05",
      to: "2026-07-20",
    };
    const where = await dashboardWhere(
      A.orgId,
      ceiling,
      A.users.finance_admin,
      "org",
      filters
    );
    const kpis = buildFinanceKpis({
      groups: await statusGroupsFor(A.orgId, where),
      filters,
      currency: "INR",
      monthly: [],
      payable: { count: 0, outstanding: 0 },
    });
    await assertCardsMatchTheirLists(kpis, A.orgId, ceiling, A.users.finance_admin);
  });

  it("the finance card and /finance compute the SAME outstanding figure", async () => {
    // Both call summarisePayable over payableQuery(). If either screen ever
    // grows its own copy, this is where it shows up — as two numbers for one
    // debt.
    const db = scopedDb(A.orgId);
    const rows = (await db.expenseReport.findMany({
      ...payableQuery(),
      select: { total: true, reimbursements: { select: { amountPaid: true } } },
    })) as Array<{ total: number; reimbursements: Array<{ amountPaid: number }> }>;

    const card = buildFinanceKpis({
      groups: [],
      filters: NO_FILTERS,
      currency: "INR",
      monthly: [],
      payable: summarisePayable(rows),
    }).find((k) => k.key === "outstanding");

    expect(card?.value).toBe(summarisePayable(rows).outstanding);
    // And it is honest about not being an expense sum.
    expect(card?.agreement.kind).toBe("different");
  });
});

describe("the ?scope= widening never crosses a tenant or a role ceiling", () => {
  it("org B cannot reach org A's rows even at the widest scope", async () => {
    // The headline isolation case. scopedDb pins org_id, so an empty user
    // predicate still means "this organisation" — never "every organisation".
    const where = applyExpenseFilters(
      viewScopeWhere({ kind: "org" }, "org", B.users.finance_admin),
      NO_FILTERS
    );
    const rows = (await scopedDb(B.orgId).expense.findMany({
      where,
      select: { orgId: true },
    })) as Array<{ orgId: string }>;

    expect(rows.length).toBeGreaterThan(0); // B has its own fixture expense
    expect(rows.every((r) => r.orgId === B.orgId)).toBe(true);
    expect(rows.some((r) => r.orgId === A.orgId)).toBe(false);
  });

  it("an employee asking for scope=org still gets only their own rows", async () => {
    const ceiling: ExpenseScope = { kind: "employee", userId: A.users.employee };
    const where = applyExpenseFilters(
      viewScopeWhere(ceiling, "org", A.users.employee),
      NO_FILTERS
    );
    const rows = (await scopedDb(A.orgId).expense.findMany({
      where,
      select: { userId: true },
    })) as Array<{ userId: string }>;

    expect(rows.length).toBe(ROWS_PER_USER + 1); // +1 fixture expense
    expect(rows.every((r) => r.userId === A.users.employee)).toBe(true);
  });

  it("an approver asking for scope=org gets their team and no further", async () => {
    const ceiling: ExpenseScope = {
      kind: "team",
      teamUserIds: [A.users.approver, A.users.employee],
    };
    const where = applyExpenseFilters(
      viewScopeWhere(ceiling, "org", A.users.approver),
      NO_FILTERS
    );
    const rows = (await scopedDb(A.orgId).expense.findMany({
      where,
      select: { userId: true },
    })) as Array<{ userId: string }>;

    expect(rows.length).toBeGreaterThan(ROWS_PER_USER); // wider than one person
    // …but the finance_admin's rows are not in it.
    expect(rows.some((r) => r.userId === A.users.finance_admin)).toBe(false);
  });

  it("a userId facet cannot widen past the scope pin", async () => {
    // The D1.3 lesson, re-checked at the new scope boundary: filters AND onto
    // the pin, so naming somebody else returns nothing rather than their rows.
    const ceiling: ExpenseScope = { kind: "employee", userId: A.users.employee };
    const where = applyExpenseFilters(viewScopeWhere(ceiling, "mine", A.users.employee), {
      ...EMPTY_EXPENSE_FILTERS,
      userId: [A.users.finance_admin],
    });
    const rows = (await scopedDb(A.orgId).expense.findMany({
      where,
      select: { userId: true },
    })) as Array<{ userId: string }>;

    expect(rows).toHaveLength(0);
  });
});
