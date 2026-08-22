// Tenant isolation for the accounting export layer (FINAL-AUDIT §4).
//
// Three new tables, so three cases per CLAUDE.md. What makes this feature
// worth being careful about: a mapping row is a statement about another
// company's chart of accounts, and an export record is the audit trail of
// what was posted to their books. Either leaking is worse than a data leak in
// a list view — it is a leak into someone else's accounting.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import { fetchMappings, fetchPriorExports } from "@/lib/accounting/queries";
import { buildMappingIndex } from "@/lib/exports/accounting";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let exportA: string;
let exportB: string;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

beforeAll(async () => {
  A = await provisionOrg("acct-a");
  B = await provisionOrg("acct-b");

  // The SAME category name in both orgs, mapped to DIFFERENT codes — so a
  // leak shows up as a wrong account, not merely a wrong row count.
  await owner.accountingMapping.create({
    data: {
      orgId: A.orgId,
      target: "quickbooks",
      entityType: "category",
      localId: A.categoryId,
      remoteCode: "6100",
      remoteName: "A Travel",
    },
  });
  await owner.accountingMapping.create({
    data: {
      orgId: B.orgId,
      target: "quickbooks",
      entityType: "category",
      localId: B.categoryId,
      remoteCode: "9900",
      remoteName: "B Travel",
    },
  });

  const ea = await owner.accountingExport.create({
    data: {
      orgId: A.orgId,
      target: "quickbooks",
      periodStart: d("2026-04-01"),
      periodEnd: d("2026-04-30"),
      exportedById: A.users.finance_admin,
      lineCount: 3,
      totalMinor: 700_000,
      reports: { create: [{ orgId: A.orgId, reportId: A.reportId }] },
    },
  });
  exportA = ea.id;

  const eb = await owner.accountingExport.create({
    data: {
      orgId: B.orgId,
      target: "quickbooks",
      periodStart: d("2026-04-01"),
      periodEnd: d("2026-04-30"),
      exportedById: B.users.finance_admin,
      lineCount: 1,
      totalMinor: 12_345,
      reports: { create: [{ orgId: B.orgId, reportId: B.reportId }] },
    },
  });
  exportB = eb.id;
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("mappings are org-scoped", () => {
  it("A sees only its own mapping", async () => {
    const rows = await fetchMappings(scopedDb(A.orgId), "quickbooks");
    expect(rows).toHaveLength(1);
    expect(rows[0].remoteCode).toBe("6100");
  });

  it("B sees only its own, at its own code", async () => {
    const rows = await fetchMappings(scopedDb(B.orgId), "quickbooks");
    expect(rows).toHaveLength(1);
    expect(rows[0].remoteCode).toBe("9900");
  });

  it("B's index cannot resolve A's category", async () => {
    const rows = await fetchMappings(scopedDb(B.orgId), "quickbooks");
    const index = buildMappingIndex(rows);
    // The critical assertion: not merely "no row", but no CODE — a resolver
    // that fell back would hand B's export A's chart of accounts.
    expect(index.get("category", A.categoryId)).toBeNull();
    expect(index.has("category", A.categoryId)).toBe(false);
  });

  it("B cannot update or delete A's mapping", async () => {
    const db = scopedDb(B.orgId);
    const rowA = await owner.accountingMapping.findFirst({
      where: { orgId: A.orgId },
    });
    const up = await db.accountingMapping.updateMany({
      where: { id: rowA!.id },
      data: { remoteCode: "HACKED" },
    });
    expect(up.count).toBe(0);
    const del = await db.accountingMapping.deleteMany({ where: { id: rowA!.id } });
    expect(del.count).toBe(0);
    const still = await owner.accountingMapping.findUnique({ where: { id: rowA!.id } });
    expect(still?.remoteCode).toBe("6100");
  });

  it("a mapping B creates lands in B whatever orgId is passed", async () => {
    const created = await scopedDb(B.orgId).accountingMapping.create({
      data: {
        orgId: A.orgId,
        target: "generic",
        entityType: "project",
        localId: B.categoryId,
        remoteCode: "X",
      } as never,
    });
    const check = await owner.accountingMapping.findUnique({ where: { id: created.id } });
    expect(check?.orgId).toBe(B.orgId);
  });

  it("target scoping is real — a Tally lookup does not see QuickBooks rows", async () => {
    // Mixing targets would let a QuickBooks code satisfy a Tally export.
    const rows = await fetchMappings(scopedDb(A.orgId), "tally");
    expect(rows).toHaveLength(0);
  });
});

describe("export records are org-scoped", () => {
  it("A sees only its own export runs", async () => {
    const rows = (await scopedDb(A.orgId).accountingExport.findMany({})) as Array<{
      id: string;
      totalMinor: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(exportA);
    expect(rows[0].totalMinor).toBe(700_000);
  });

  it("B cannot read A's export by id", async () => {
    const row = await scopedDb(B.orgId).accountingExport.findUnique({
      where: { id: exportA },
    });
    expect(row).toBeNull();
  });

  it("B cannot read A's export lines", async () => {
    const rows = (await scopedDb(B.orgId).accountingExportReport.findMany({
      where: { exportId: exportA },
    })) as Array<{ id: string }>;
    expect(rows).toHaveLength(0);
  });

  it("B's own export lines are visible to B", async () => {
    const rows = (await scopedDb(B.orgId).accountingExportReport.findMany({
      where: { exportId: exportB },
    })) as Array<{ reportId: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].reportId).toBe(B.reportId);
  });
});

describe("the double-export guard cannot be defeated across orgs", () => {
  it("A's prior exports are found for A's report", async () => {
    const prior = await fetchPriorExports(scopedDb(A.orgId), [A.reportId]);
    expect(prior).toHaveLength(1);
    expect(prior[0]).toMatchObject({ reportId: A.reportId, target: "quickbooks" });
  });

  it("B asking about A's report id gets nothing", async () => {
    // Not just a leak: if B could see A's history the guard would ALSO
    // mis-block B's own exports. Scoping protects correctness both ways.
    const prior = await fetchPriorExports(scopedDb(B.orgId), [A.reportId]);
    expect(prior).toHaveLength(0);
  });

  it("A asking about B's report id gets nothing", async () => {
    const prior = await fetchPriorExports(scopedDb(A.orgId), [B.reportId]);
    expect(prior).toHaveLength(0);
  });
});

describe("an exported report cannot be deleted out from under its audit trail", () => {
  it("the report FK is RESTRICT", async () => {
    await expect(
      owner.expenseReport.delete({ where: { id: A.reportId } })
    ).rejects.toThrow();
  });

  it("deleting the export run cascades its lines away", async () => {
    const tmp = await owner.accountingExport.create({
      data: {
        orgId: A.orgId,
        target: "generic",
        periodStart: d("2026-05-01"),
        periodEnd: d("2026-05-31"),
        exportedById: A.users.finance_admin,
        lineCount: 1,
        totalMinor: 1,
        reports: { create: [{ orgId: A.orgId, reportId: A.reportId }] },
      },
    });
    await owner.accountingExport.delete({ where: { id: tmp.id } });
    const orphans = await owner.accountingExportReport.findMany({
      where: { exportId: tmp.id },
    });
    // An orphan line would claim a report was exported by a run that no
    // longer exists — a guard that blocks with no evidence to show.
    expect(orphans).toHaveLength(0);
  });
});
