// Reimbursement ledger (7.1): employee sees their own; finance_admin+ can
// open any user's, with date filters and CSV/Tally export. Print-friendly.
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { fetchLedgerEvents } from "@/lib/analytics/ledger";
import { requireSession } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { buildLedger } from "@/lib/domain/ledger";
import { scopedDb } from "@/lib/db/scoped";
import { PrintButton } from "./print-button";

const TYPE_LABELS: Record<string, string> = {
  report_approved: "Report approved",
  payment: "Payment",
  advance_disbursed: "Advance disbursed",
  advance_settled: "Advance settled",
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const isFinance = roleAtLeast(ctx.role, "finance_admin");
  const raw = await searchParams;

  // finance may view any org member; everyone else only themselves
  const requestedUser = typeof raw.user === "string" ? raw.user : "";
  const targetUserId = isFinance && requestedUser ? requestedUser : ctx.userId;
  const from = typeof raw.from === "string" && raw.from ? new Date(`${raw.from}T00:00:00.000Z`) : undefined;
  const to = typeof raw.to === "string" && raw.to ? new Date(`${raw.to}T23:59:59.999Z`) : undefined;

  const [org, target, users] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    }),
    isFinance
      ? (db.user.findMany({
          where: { status: "active" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }) as Promise<Array<{ id: string; name: string }>>)
      : Promise.resolve([]),
  ]);
  if (!target) {
    return (
      <section className="grid gap-4">
        <h1 className="text-xl font-semibold">Ledger</h1>
        <p className="text-muted-foreground text-sm">User not found.</p>
      </section>
    );
  }

  const { events, requested } = await fetchLedgerEvents(db, target.id, { from, to });
  const { lines, totals } = buildLedger(events, requested);

  const exportQs = new URLSearchParams();
  if (isFinance && requestedUser) exportQs.set("user", requestedUser);
  if (typeof raw.from === "string" && raw.from) exportQs.set("from", raw.from);
  if (typeof raw.to === "string" && raw.to) exportQs.set("to", raw.to);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold">
            {target.id === ctx.userId ? "My ledger" : `Ledger — ${target.name}`}
          </h1>
          <p className="text-muted-foreground text-sm">
            Derived live from reports, payments, and advances — nothing stored.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/api/exports/ledger?format=csv&${exportQs.toString()}`}>CSV</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/exports/ledger?format=tally&${exportQs.toString()}`}>Tally XML</a>
          </Button>
          <PrintButton />
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2 print:hidden" action="/ledger" method="GET">
        {isFinance ? (
          <div className="grid gap-1">
            <label htmlFor="l-user" className="text-muted-foreground text-xs">User</label>
            <NativeSelect id="l-user" name="user" defaultValue={requestedUser} className="w-44">
              <option value="">Me</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="grid gap-1">
          <label htmlFor="l-from" className="text-muted-foreground text-xs">From</label>
          <Input id="l-from" name="from" type="date" defaultValue={typeof raw.from === "string" ? raw.from : ""} className="w-40" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="l-to" className="text-muted-foreground text-xs">To</label>
          <Input id="l-to" name="to" type="date" defaultValue={typeof raw.to === "string" ? raw.to : ""} className="w-40" />
        </div>
        <Button type="submit" variant="outline">Apply</Button>
      </form>

      <div className="hidden print:block">
        <h1 className="text-lg font-bold">Ledger — {target.name} ({org.name})</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {(
          [
            ["Requested", totals.requested],
            ["Approved", totals.approved],
            ["Paid", totals.paid],
            ["Outstanding", totals.outstanding],
          ] as const
        ).map(([label, v]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle>
                <Amount value={v} currency={org.currency} size="display" />
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {totals.netBalance !== totals.outstanding ? (
        <p className="text-muted-foreground text-sm">
          Net position incl. advances:{" "}
          <Amount value={totals.netBalance} currency={org.currency} />
          {totals.netBalance < 0 ? " (owed to the organization)" : ""}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border print:border-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left print:bg-transparent">
            <tr>
              <th className="p-2 font-medium">Date</th>
              <th className="p-2 font-medium">Entry</th>
              <th className="p-2 font-medium">Reference</th>
              <th className="p-2 text-right font-medium">Credit</th>
              <th className="p-2 text-right font-medium">Debit</th>
              <th className="p-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2 whitespace-nowrap"><DateCell value={l.date} /></td>
                <td className="p-2">
                  <span className="font-medium">{TYPE_LABELS[l.type]}</span>{" "}
                  <span className="text-muted-foreground">{l.description}</span>
                </td>
                <td className="text-muted-foreground p-2">{l.reference}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  {l.credit ? <Amount value={l.credit} currency={org.currency} align="right" /> : ""}
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  {l.debit ? <Amount value={l.debit} currency={org.currency} align="right" /> : ""}
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Amount value={l.balance} currency={org.currency} align="right" />
                </td>
              </tr>
            ))}
            {lines.length === 0 ? (
              <tr><td colSpan={6} className="text-muted-foreground p-3">No ledger activity yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs print:hidden">
        Rollups by project/department:{" "}
        <Link href="/analytics" className="underline">Analytics</Link> shows spend
        by entity; ledger rollups aggregate the same expenses proportionally.
      </p>
    </section>
  );
}
