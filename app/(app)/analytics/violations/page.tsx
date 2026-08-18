// Violation drill-down (6.7): same fetch + filter as the leaderboard, so the
// list length always equals the leaderboard count.
import Link from "next/link";

import { asFlags, FlagChips } from "@/components/flag-chips";
import { fetchSpendRows } from "@/lib/analytics";
import { flaggedRows } from "@/lib/analytics/aggregate";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

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
      <div>
        <h1 className="text-xl font-semibold">Flagged expenses</h1>
        <p className="text-muted-foreground text-sm">
          {flagged.length} expense{flagged.length === 1 ? "" : "s"}
          {rule ? ` · rule: ${rule}` : ""}
          {userId ? ` · one user` : ""} ·{" "}
          <Link href="/analytics" className="underline">back to analytics</Link>
        </p>
      </div>
      <ul className="grid gap-2">
        {flagged.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{e.merchant}</span>
              <span className="text-muted-foreground">
                {formatDate(e.date)} · {e.categoryName} · {e.userName}
              </span>
            </span>
            <FlagChips flags={asFlags(e.flags)} />
            <span className="font-semibold whitespace-nowrap">
              {formatMoney(e.baseAmount, org.currency)}
            </span>
          </li>
        ))}
        {flagged.length === 0 ? (
          <li className="text-muted-foreground text-sm">Nothing matches.</li>
        ) : null}
      </ul>
    </section>
  );
}
