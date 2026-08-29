import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { MATCH_WINDOW_DAYS } from "@/lib/domain/card-import";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { CardImportPanel, type UnmatchedTxn } from "./card-import-panel";

const DAY_MS = 24 * 60 * 60 * 1000;

type TxnRow = {
  id: string;
  date: Date;
  amount: number;
  merchant: string;
};

export default async function CardImportsPage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, unmatchedRaw, matchedCount, totalCount] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.cardTransaction.findMany({
      where: { matchedExpenseId: null },
      orderBy: { date: "desc" },
      take: 200,
      select: { id: true, date: true, amount: true, merchant: true },
    }) as Promise<TxnRow[]>,
    db.cardTransaction.count({ where: { matchedExpenseId: { not: null } } }),
    db.cardTransaction.count(),
  ]);

  // per-txn suggestions: unmatched org expenses, same amount, date ±window
  const unmatched: UnmatchedTxn[] = [];
  for (const t of unmatchedRaw) {
    const suggestions = (await db.expense.findMany({
      where: {
        amount: t.amount,
        cardTransaction: null,
        date: {
          gte: new Date(t.date.getTime() - MATCH_WINDOW_DAYS * DAY_MS),
          lte: new Date(t.date.getTime() + MATCH_WINDOW_DAYS * DAY_MS),
        },
      },
      take: 5,
      include: { user: { select: { name: true } } },
    })) as Array<{
      id: string;
      merchant: string;
      date: Date;
      user: { name: string };
    }>;
    unmatched.push({
      id: t.id,
      date: t.date.toISOString(),
      amount: t.amount,
      currency: org.currency,
      merchant: t.merchant,
      suggestions: suggestions.map((s) => ({
        id: s.id,
        // <option> label — text only, so formatDate rather than <DateCell>.
        label: `${s.merchant} · ${formatDate(s.date)} · ${s.user.name}`,
      })),
    });
  }

  return (
    <section className="grid gap-4">
      <PageHeader
        title="Card imports"
        description={`${totalCount} transaction${totalCount === 1 ? "" : "s"} imported · ${matchedCount} matched · ${totalCount - matchedCount} open. Auto-match pairs exact amounts within ±${MATCH_WINDOW_DAYS} days.`}
      />

      <CardImportPanel unmatched={unmatched} />

      {totalCount === 0 ? (
        <EmptyState
          headline="No card statements yet"
          description="Upload a CSV with date, amount and merchant columns. Each transaction is matched against expenses people have already filed."
        />
      ) : null}
    </section>
  );
}
