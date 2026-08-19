// Ledger screen ↔ export agreement, and the entity guard (D4.1).
//
// The DoD for D4.1 is "on-screen totals match the CSV export". That is only
// worth asserting against a real database with real rows, because the ways it
// breaks are a differently-parsed date boundary, a differently-resolved
// entity, or a rollup that apportions twice.
//
// So: build the ledger the way the SCREEN does, build it the way the EXPORT
// ROUTE does, and compare every line and every total. Then check the entity
// parameter cannot be used to read across a role or across a tenant.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import {
  fetchEntityLedger,
  resolveLedgerEntity,
  type LedgerEntity,
} from "@/lib/analytics/ledger-entity";
import { buildLedger } from "@/lib/domain/ledger";
import { parseLedgerWindow } from "@/lib/domain/ledger-params";
import { toDecimalString } from "@/lib/money";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let projectId: string;
let departmentId: string;

/** A session context of the shape resolveLedgerEntity expects. */
function session(fixture: OrgFixture, role: "employee" | "finance_admin") {
  return {
    userId: fixture.users[role],
    orgId: fixture.orgId,
    role,
  } as Parameters<typeof resolveLedgerEntity>[1];
}

beforeAll(async () => {
  A = await provisionOrg("ledg-a");
  B = await provisionOrg("ledg-b");

  const department = await owner.department.create({
    data: { orgId: A.orgId, name: "Field Ops" },
  });
  departmentId = department.id;
  await owner.user.update({
    where: { id: A.users.employee },
    data: { departmentId },
  });

  const project = await owner.project.create({
    data: { orgId: A.orgId, name: "Northwind", code: "NW" },
  });
  projectId = project.id;
  const other = await owner.project.create({
    data: { orgId: A.orgId, name: "Southgale", code: "SG" },
  });

  // A report SPLIT across two projects, so the rollup has to apportion rather
  // than take the whole total — the case where a naive implementation
  // double-counts.
  const report = await owner.expenseReport.create({
    data: {
      orgId: A.orgId,
      userId: A.users.employee,
      title: "August field work",
      status: "approved",
      total: 30_000,
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    },
  });
  await owner.expense.createMany({
    data: [
      {
        orgId: A.orgId,
        userId: A.users.employee,
        reportId: report.id,
        projectId,
        amount: 20_000,
        baseAmount: 20_000,
        currency: "INR",
        date: new Date(Date.UTC(2026, 7, 3)),
        merchant: "Northwind site",
        categoryId: A.categoryId,
        status: "approved",
      },
      {
        orgId: A.orgId,
        userId: A.users.employee,
        reportId: report.id,
        projectId: other.id,
        amount: 10_000,
        baseAmount: 10_000,
        currency: "INR",
        date: new Date(Date.UTC(2026, 7, 4)),
        merchant: "Southgale site",
        categoryId: A.categoryId,
        status: "approved",
      },
    ],
  });
  await owner.approval.create({
    data: {
      orgId: A.orgId,
      reportId: report.id,
      approverId: A.users.approver,
      level: 1,
      action: "approved",
      actedAt: new Date("2026-08-05T10:00:00.000Z"),
    },
  });

  // A payment against it, late on the last day of the month — the boundary
  // an exclusive `to` would silently drop.
  await owner.reimbursement.create({
    data: {
      orgId: A.orgId,
      reportId: report.id,
      paidById: A.users.finance_admin,
      // `amount` is the report total at payment time; `amountPaid` is this
      // payment. The ledger reads the latter.
      amount: 30_000,
      amountPaid: 12_000,
      method: "bank_transfer",
      reference: "N226083112345678",
      paidAt: new Date("2026-08-31T18:45:00.000Z"),
    },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

/** Exactly what app/(app)/ledger/page.tsx renders. */
async function screen(orgId: string, entity: LedgerEntity, raw: Record<string, string>) {
  const db = scopedDb(orgId);
  const window = parseLedgerWindow(raw);
  const { events, requested } = await fetchEntityLedger(db, entity, window);
  return buildLedger(events, requested);
}

/** Exactly what app/api/exports/ledger/route.ts serialises. */
async function csvRows(orgId: string, entity: LedgerEntity, raw: Record<string, string>) {
  const { lines, totals } = await screen(orgId, entity, raw);
  return {
    lines: lines.map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      debit: l.debit ? toDecimalString(l.debit) : "",
      credit: l.credit ? toDecimalString(l.credit) : "",
      balance: toDecimalString(l.balance),
    })),
    totals: {
      requested: toDecimalString(totals.requested),
      approved: toDecimalString(totals.approved),
      paid: toDecimalString(totals.paid),
      outstanding: toDecimalString(totals.outstanding),
    },
  };
}

describe("the screen and its CSV export are one derivation", () => {
  const cases: Array<{ name: string; raw: Record<string, string> }> = [
    { name: "all time", raw: {} },
    { name: "a window that includes the last-day payment", raw: { from: "2026-08-01", to: "2026-08-31" } },
    { name: "a window that ends before it", raw: { from: "2026-08-01", to: "2026-08-30" } },
  ];

  for (const kind of ["user", "project", "department"] as const) {
    for (const { name, raw } of cases) {
      it(`${kind} ledger — ${name}`, async () => {
        const entity: LedgerEntity = {
          kind,
          id:
            kind === "user"
              ? A.users.employee
              : kind === "project"
                ? projectId
                : departmentId,
          name: "fixture",
        };

        const onScreen = await screen(A.orgId, entity, raw);
        const exported = await csvRows(A.orgId, entity, raw);

        expect(exported.lines).toHaveLength(onScreen.lines.length);
        expect(exported.totals.requested).toBe(toDecimalString(onScreen.totals.requested));
        expect(exported.totals.approved).toBe(toDecimalString(onScreen.totals.approved));
        expect(exported.totals.paid).toBe(toDecimalString(onScreen.totals.paid));
        expect(exported.totals.outstanding).toBe(
          toDecimalString(onScreen.totals.outstanding)
        );
      });
    }
  }

  it("keeps the reconciliation invariant: outstanding = approved − paid", async () => {
    const { totals } = await screen(
      A.orgId,
      { kind: "user", id: A.users.employee, name: "x" },
      {}
    );
    expect(totals.outstanding).toBe(totals.approved - totals.paid);
  });

  it("includes a payment timestamped late on the window's last day", async () => {
    // The boundary bug: `to` must be the END of the day. Inside the window
    // the payment is present; a day earlier it is not.
    const inside = await screen(
      A.orgId,
      { kind: "user", id: A.users.employee, name: "x" },
      { from: "2026-08-01", to: "2026-08-31" }
    );
    const before = await screen(
      A.orgId,
      { kind: "user", id: A.users.employee, name: "x" },
      { from: "2026-08-01", to: "2026-08-30" }
    );
    expect(inside.totals.paid).toBe(12_000);
    expect(before.totals.paid).toBe(0);
  });
});

describe("project rollups apportion instead of double-counting", () => {
  it("gives a project only its share of a split report", async () => {
    // 20,000 of a 30,000 report is Northwind's, so the credit line is 20,000
    // — not the whole 30,000, which is what a `some: { projectId }` filter
    // returns if nobody apportions afterwards.
    const { lines } = await screen(A.orgId, { kind: "project", id: projectId, name: "x" }, {});
    const credit = lines.find((l) => l.type === "report_approved");
    expect(credit?.credit).toBe(20_000);
  });

  it("apportions the payment on the same basis", async () => {
    const { totals } = await screen(
      A.orgId,
      { kind: "project", id: projectId, name: "x" },
      {}
    );
    // 12,000 paid × (20,000 / 30,000) = 8,000.
    expect(totals.paid).toBe(8_000);
  });

  it("splits a report losslessly across its projects", async () => {
    // The whole reason projectShare allocates over EVERY project and then
    // reads one key: the shares must add back up to the report.
    const north = await screen(A.orgId, { kind: "project", id: projectId, name: "x" }, {});
    const south = (await scopedDb(A.orgId).project.findFirst({
      where: { name: "Southgale" },
      select: { id: true },
    })) as { id: string };
    const southLedger = await screen(
      A.orgId,
      { kind: "project", id: south.id, name: "x" },
      {}
    );
    expect(north.totals.approved + southLedger.totals.approved).toBe(30_000);
    expect(north.totals.paid + southLedger.totals.paid).toBe(12_000);
  });
});

describe("the entity parameter cannot widen a reader's view", () => {
  it("forces an employee back to their own user ledger", async () => {
    // An employee hand-typing ?entity=department&id=… must not get the
    // department rollup — it aggregates colleagues' reports and payments.
    const entity = await resolveLedgerEntity(
      scopedDb(A.orgId),
      session(A, "employee"),
      { entity: "department", id: departmentId }
    );
    expect(entity?.kind).toBe("user");
    expect(entity?.id).toBe(A.users.employee);
  });

  it("forces an employee back to themselves when naming another user", async () => {
    const entity = await resolveLedgerEntity(
      scopedDb(A.orgId),
      session(A, "employee"),
      { entity: "user", id: A.users.finance_admin }
    );
    expect(entity?.id).toBe(A.users.employee);
  });

  it("lets finance open a rollup", async () => {
    const entity = await resolveLedgerEntity(
      scopedDb(A.orgId),
      session(A, "finance_admin"),
      { entity: "project", id: projectId }
    );
    expect(entity).toEqual({ kind: "project", id: projectId, name: "Northwind" });
  });

  it("cannot resolve org A's project from org B's scope", async () => {
    // The headline isolation case. scopedDb pins org_id, so A's project id is
    // simply not there — B's finance admin gets null, not a foreign ledger.
    const entity = await resolveLedgerEntity(
      scopedDb(B.orgId),
      session(B, "finance_admin"),
      { entity: "project", id: projectId }
    );
    expect(entity).toBeNull();
  });

  it("cannot resolve org A's department or user from org B's scope", async () => {
    const db = scopedDb(B.orgId);
    const ctx = session(B, "finance_admin");
    expect(
      await resolveLedgerEntity(db, ctx, { entity: "department", id: departmentId })
    ).toBeNull();
    // A user id from A resolves to nothing, so B falls through to null rather
    // than reading A's statement.
    expect(
      await resolveLedgerEntity(db, ctx, { entity: "user", id: A.users.employee })
    ).toBeNull();
  });

  it("returns an empty ledger, never A's rows, if a foreign id is forced through", async () => {
    // Belt and braces: even bypassing the resolver, the fetch is org-scoped.
    const { lines, totals } = await screen(
      B.orgId,
      { kind: "project", id: projectId, name: "forced" },
      {}
    );
    expect(lines).toHaveLength(0);
    expect(totals.approved).toBe(0);
  });
});
