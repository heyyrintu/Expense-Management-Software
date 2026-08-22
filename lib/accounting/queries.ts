// Shared accounting-export queries — ONE module, so the preview, the file and
// the report detail page cannot disagree about what is in an export.
//
// Same discipline as lib/analytics and lib/complaints/queries.ts. Every call
// takes a scopedDb, so org scoping is the caller's session and never an
// argument the caller could get wrong.
import type { ScopedDb } from "@/lib/db/scoped";
import {
  EXPORTABLE_REPORT_STATUSES,
  type PriorExport,
} from "@/lib/domain/accounting-export";
import type {
  AccountingTarget,
  ExportableReport,
  MappingRow,
} from "@/lib/exports/accounting/types";

type ReportRow = {
  id: string;
  title: string;
  submittedAt: Date | null;
  createdAt: Date;
  total: number;
  user: { id: string; name: string; email: string };
  expenses: Array<{
    id: string;
    date: Date;
    merchant: string;
    baseAmount: number;
    categoryId: string;
    projectId: string | null;
    taxAmount: number | null;
    purpose: string;
    category: { name: string };
    user: { departmentId: string | null };
  }>;
};

/**
 * Reports eligible for export in a period, flattened into adapter input.
 *
 * The period is filtered on `submittedAt` — the date the claim entered the
 * workflow, which is the date finance means by "April's expenses". Filtering
 * on the EXPENSE dates instead would split one report across two periods and
 * produce an unbalanced journal entry, since the credit is per report.
 *
 * `baseAmount` throughout: an accounting export posts to a ledger kept in the
 * org's own currency, so the original-currency figure would be the wrong
 * number even when it is the more familiar one.
 */
export async function fetchExportableReports(
  db: ScopedDb,
  period: { start: Date; end: Date }
): Promise<ExportableReport[]> {
  // End is inclusive of the whole day named — a quarter-end export is run FOR
  // the last day of the quarter, and an exclusive bound drops it.
  const endOfDay = new Date(period.end);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const rows = (await db.expenseReport.findMany({
    where: {
      status: { in: [...EXPORTABLE_REPORT_STATUSES] },
      submittedAt: { gte: period.start, lte: endOfDay },
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    take: 500,
    select: {
      id: true,
      title: true,
      submittedAt: true,
      createdAt: true,
      total: true,
      user: { select: { id: true, name: true, email: true } },
      expenses: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: {
          id: true,
          date: true,
          merchant: true,
          baseAmount: true,
          categoryId: true,
          projectId: true,
          taxAmount: true,
          purpose: true,
          category: { select: { name: true } },
          user: { select: { departmentId: true } },
        },
      },
    },
  })) as unknown as ReportRow[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    // Every status in EXPORTABLE_REPORT_STATUSES has been submitted, so this
    // fallback should never fire; it exists so a corrupt row dates the entry
    // rather than crashing the export.
    submittedAt: r.submittedAt ?? r.createdAt,
    totalMinor: r.total,
    userId: r.user.id,
    userName: r.user.name,
    userEmail: r.user.email,
    lines: r.expenses.map((e) => ({
      expenseId: e.id,
      date: e.date,
      merchant: e.merchant,
      amountMinor: e.baseAmount,
      categoryId: e.categoryId,
      categoryName: e.category.name,
      departmentId: e.user.departmentId,
      projectId: e.projectId,
      taxMinor: e.taxAmount,
      purpose: e.purpose,
    })),
  }));
}

/** Mapping rows for ONE target. Filtering here rather than at the index is
 *  what stops a QuickBooks code satisfying a Tally export. */
export async function fetchMappings(
  db: ScopedDb,
  target: AccountingTarget
): Promise<MappingRow[]> {
  return (await db.accountingMapping.findMany({
    where: { target },
    select: { entityType: true, localId: true, remoteCode: true, remoteName: true },
  })) as MappingRow[];
}

/**
 * Prior exports for a set of reports.
 *
 * Scoped to the reports in question rather than loading the org's whole
 * history: the guard only needs to know about what is being exported now, and
 * an unbounded read here would grow with every run finance has ever made.
 */
export async function fetchPriorExports(
  db: ScopedDb,
  reportIds: string[]
): Promise<PriorExport[]> {
  if (reportIds.length === 0) return [];
  const rows = (await db.accountingExportReport.findMany({
    where: { reportId: { in: reportIds } },
    select: {
      reportId: true,
      export: { select: { id: true, target: true, exportedAt: true } },
    },
  })) as Array<{
    reportId: string;
    export: { id: string; target: AccountingTarget; exportedAt: Date };
  }>;
  return rows.map((r) => ({
    reportId: r.reportId,
    target: r.export.target,
    exportedAt: r.export.exportedAt,
    exportId: r.export.id,
  }));
}

/** Human labels for the unmapped warning — a UUID tells the reader nothing. */
export async function fetchEntityLabels(db: ScopedDb): Promise<{
  category: Map<string, string>;
  department: Map<string, string>;
  project: Map<string, string>;
  user: Map<string, string>;
}> {
  const [categories, departments, projects, users] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true } }),
    db.department.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const toMap = (rows: Array<{ id: string; name: string }>) =>
    new Map(rows.map((r) => [r.id, r.name]));
  return {
    category: toMap(categories as Array<{ id: string; name: string }>),
    department: toMap(departments as Array<{ id: string; name: string }>),
    project: toMap(projects as Array<{ id: string; name: string }>),
    user: toMap(users as Array<{ id: string; name: string }>),
  };
}
