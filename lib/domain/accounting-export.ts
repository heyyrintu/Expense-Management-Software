// Export-run rules — PURE. The double-export guard lives here.
//
// ── WHY DOUBLE EXPORT IS THE DANGEROUS ONE ────────────────────────────────
// Importing the same journal entry twice into QuickBooks does not error. It
// posts the expense again. The books then show double the cost, the control
// account stops reconciling, and the person who finds it is an accountant
// three weeks later working backwards from a variance.
//
// Nothing in the accounting system prevents it, so this must. The rule:
//
//   A report that has already been exported TO THIS TARGET is excluded from
//   the next export of that target, unless the reader explicitly confirms a
//   re-export — and confirming names the reports, not a count.
//
// Per TARGET, not globally: sending a report to QuickBooks does not mean it
// reached Tally, and treating them as one would make the second integration
// silently export nothing.
import type { AccountingTarget } from "@/lib/exports/accounting/types";

/** A prior export of one report to one target. */
export type PriorExport = {
  reportId: string;
  target: AccountingTarget;
  exportedAt: Date;
  /** Which run — so the UI can link to it rather than just assert it exists. */
  exportId: string;
};

export type ExportSelection = {
  /** Reports the reader picked. */
  reportIds: string[];
  target: AccountingTarget;
};

export type ExportPlan = {
  /** Reports that will be written. */
  included: string[];
  /** Picked, but already sent to this target — excluded unless confirmed. */
  alreadyExported: Array<{ reportId: string; exportedAt: Date; exportId: string }>;
  /** True when the plan would write nothing. */
  empty: boolean;
};

/**
 * Decide what an export run will actually contain.
 *
 * `allowReExport` is the explicit confirmation. It is a parameter rather than
 * a setting because it must be a decision made about THIS run, in front of
 * the list of reports it affects — a preference toggled once in settings and
 * forgotten is how double-posting becomes routine.
 */
export function planExport(
  selection: ExportSelection,
  priorExports: PriorExport[],
  allowReExport = false
): ExportPlan {
  // Newest prior export per report, for this target only.
  const priorByReport = new Map<string, PriorExport>();
  for (const p of priorExports) {
    if (p.target !== selection.target) continue;
    const existing = priorByReport.get(p.reportId);
    if (!existing || p.exportedAt > existing.exportedAt) {
      priorByReport.set(p.reportId, p);
    }
  }

  // Dedupe the selection: the same report picked twice is one report, and
  // letting it through would post the entry twice inside ONE file — which the
  // guard above would never catch, because it only looks at prior runs.
  const picked = [...new Set(selection.reportIds)];

  const included: string[] = [];
  const alreadyExported: ExportPlan["alreadyExported"] = [];

  for (const reportId of picked) {
    const prior = priorByReport.get(reportId);
    if (prior && !allowReExport) {
      alreadyExported.push({
        reportId,
        exportedAt: prior.exportedAt,
        exportId: prior.exportId,
      });
      continue;
    }
    if (prior) {
      // Re-export confirmed: it is included AND still reported, so the
      // confirmation screen can show what it is about to send again.
      alreadyExported.push({
        reportId,
        exportedAt: prior.exportedAt,
        exportId: prior.exportId,
      });
    }
    included.push(reportId);
  }

  return { included, alreadyExported, empty: included.length === 0 };
}

/** Has this report gone to this target? The report detail page's question. */
export function exportStatusFor(
  reportId: string,
  priorExports: PriorExport[]
): Array<{ target: AccountingTarget; exportedAt: Date; exportId: string }> {
  const byTarget = new Map<
    AccountingTarget,
    { target: AccountingTarget; exportedAt: Date; exportId: string }
  >();
  for (const p of priorExports) {
    if (p.reportId !== reportId) continue;
    const existing = byTarget.get(p.target);
    if (!existing || p.exportedAt > existing.exportedAt) {
      byTarget.set(p.target, {
        target: p.target,
        exportedAt: p.exportedAt,
        exportId: p.exportId,
      });
    }
  }
  return [...byTarget.values()].sort((a, b) => a.target.localeCompare(b.target));
}

/** Reports eligible for accounting export at all.
 *
 *  Approved and beyond: a draft or submitted report has no approved amount,
 *  and posting an unapproved cost to the general ledger is a statement the
 *  organisation has not made yet. */
export const EXPORTABLE_REPORT_STATUSES = [
  "approved",
  "partially_reimbursed",
  "reimbursed",
] as const;

export function isExportableStatus(status: string): boolean {
  return (EXPORTABLE_REPORT_STATUSES as readonly string[]).includes(status);
}

/** Inclusive [start, end] as a period label — "1 Apr – 30 Apr 2026". */
export function periodContains(
  date: Date,
  start: Date,
  end: Date
): boolean {
  const d = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  // End is inclusive of the whole day named, which is what "period ends 30
  // April" means to finance. An exclusive end drops everything filed on the
  // last day of the quarter — the day a quarter-end export is run for.
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return d >= s && d <= e;
}
