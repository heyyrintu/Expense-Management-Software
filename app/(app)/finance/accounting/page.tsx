// Accounting export (FINAL-AUDIT §4). finance_admin.
//
// The screen's whole job is to make the reader certain BEFORE a file exists:
// which system, which period, which reports, what is unmapped, and exactly how
// many lines and how much money. Everything downstream of a bad export is
// somebody else's month-end.
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { Amount } from "@/components/ui/amount";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { toDateInputValue } from "@/lib/format";
import { AVAILABLE_ADAPTERS } from "@/lib/exports/accounting";
import { ExportPanel } from "./export-panel";

type ExportRow = {
  id: string;
  target: string;
  periodStart: Date;
  periodEnd: Date;
  exportedAt: Date;
  lineCount: number;
  totalMinor: number;
  exportedBy: { name: string };
  _count: { reports: number };
};

export default async function AccountingExportPage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);

  const [org, history] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.accountingExport.findMany({
      orderBy: { exportedAt: "desc" },
      take: 20,
      include: {
        exportedBy: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    }) as Promise<ExportRow[]>,
  ]);

  // Default period: the month just gone, which is what a month-end export is
  // for. Today's month would default to a partial period nobody wants to post.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));

  return (
    <>
      <PageHeader
        title="Accounting export"
        description="Send approved reports to your accounting system. Nothing is written until you have seen the line count and the total."
        action={
          <Button asChild variant="secondary">
            <Link href="/settings/accounting">Account mappings</Link>
          </Button>
        }
      />

      <ExportPanel
        currency={org.currency}
        defaultStart={toDateInputValue(start)}
        defaultEnd={toDateInputValue(end)}
        targets={AVAILABLE_ADAPTERS.map((a) => ({
          target: a.target,
          label: a.label,
          description: a.description,
        }))}
      />

      <section className="mt-8 grid gap-3">
        <h2 className="text-h2 text-text-primary">Recent exports</h2>
        {history.length === 0 ? (
          <p className="text-body text-text-tertiary">
            No exports yet. The first one will appear here with its period and
            totals.
          </p>
        ) : (
          <div className="border-line bg-bg-surface overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle/50 text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">System</th>
                  <th scope="col" className="p-3 font-medium">Period</th>
                  <th scope="col" className="p-3 font-medium">Reports</th>
                  <th scope="col" className="p-3 font-medium">Lines</th>
                  <th scope="col" className="p-3 font-medium">Total</th>
                  <th scope="col" className="p-3 font-medium">Exported</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: ExportRow) => (
                  <tr key={h.id} className="border-line border-t">
                    <td className="p-3 font-medium">{h.target}</td>
                    <td className="p-3 whitespace-nowrap">
                      <DateCell value={h.periodStart.toISOString()} />
                      {" – "}
                      <DateCell value={h.periodEnd.toISOString()} />
                    </td>
                    <td className="p-3">{h._count.reports}</td>
                    <td className="p-3">{h.lineCount}</td>
                    <td className="p-3">
                      <Amount value={h.totalMinor} currency={org.currency} />
                    </td>
                    <td className="text-text-tertiary p-3 whitespace-nowrap">
                      <DateCell value={h.exportedAt.toISOString()} format="relative" />
                      {` · ${h.exportedBy.name}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
