// Violation drill-down (6.7): same fetch + filter as the leaderboard, so the
// list length always equals the leaderboard count.
import Link from "next/link";

import { asFlags, FlagChips } from "@/components/flag-chips";
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { PageHeader } from "@/components/ui/page-header";
import { fetchSpendRows } from "@/lib/analytics";
import { flaggedRows } from "@/lib/analytics/aggregate";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const raw = await searchParams;
  const rule = typeof raw.rule === "string" ? raw.rule : undefined;
  const userId = typeof raw.user === "string" ? raw.user : undefined;

  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [org, rows] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    fetchSpendRows(db, { start: windowStart, end: windowEnd }),
  ]);
  const flagged = flaggedRows(rows, { rule, userId });

  return (
    <section className="grid gap-4">
      <PageHeader
        title="Flagged expenses"
        description={`${flagged.length} expense${flagged.length === 1 ? "" : "s"}${
          rule ? ` · rule: ${rule}` : ""
        }${userId ? ` · one user` : ""}`}
        action={
          <Link href="/analytics" className="underline">back to analytics</Link>
        }
      />
      <ul className="grid gap-2">
        {flagged.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{e.merchant}</span>
              <span className="text-text-tertiary">
                <DateCell value={e.date} /> · {e.categoryName} · {e.userName}
              </span>
            </span>
            <FlagChips flags={asFlags(e.flags)} />
            <Amount
              value={e.baseAmount}
              currency={org.currency}
              align="right"
              className="whitespace-nowrap"
            />
          </li>
        ))}
        {flagged.length === 0 ? (
          <li className="text-text-tertiary text-sm">Nothing matches.</li>
        ) : null}
      </ul>
    </section>
  );
}
