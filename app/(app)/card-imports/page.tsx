import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guard";
import { MATCH_WINDOW_DAYS } from "@/lib/domain/card-import";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
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
      date: formatDate(t.date),
      amount: formatMoney(t.amount, org.currency),
      merchant: t.merchant,
      suggestions: suggestions.map((s) => ({
        id: s.id,
        label: `${s.merchant} · ${formatDate(s.date)} · ${s.user.name}`,
      })),
    });
  }

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Card imports</h1>
        <p className="text-muted-foreground text-sm">
          {totalCount} transaction{totalCount === 1 ? "" : "s"} imported ·{" "}
          {matchedCount} matched · {totalCount - matchedCount} open. Auto-match
          pairs exact amounts within ±{MATCH_WINDOW_DAYS} days.
        </p>
      </div>

      <CardImportPanel unmatched={unmatched} />

      {totalCount === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No statements yet</CardTitle>
            <CardDescription>
              Upload a card statement CSV (columns: date, amount, merchant or
              description) to reconcile against expenses.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </section>
  );
}
