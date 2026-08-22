// Per-diem rates (PRD P1). finance_admin — this sets what the org pays.
//
// Layout follows the categories screen: mobile cards, desktop table, one
// primary action. What it adds is a HISTORY column, because a per-diem rate
// is not a single value — it is a name with dated versions, and a screen that
// showed only the current amount would make "why was March priced at the old
// rate?" unanswerable from the UI.
import { Amount } from "@/components/ui/amount";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateCell } from "@/components/ui/date-cell";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { selectEffectiveRate, type PerDiemRateRow } from "@/lib/domain/per-diem";
import { PerDiemRatesPanel } from "./rates-panel";

export default async function PerDiemSettingsPage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, rates] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.perDiemRate.findMany({
      orderBy: [{ name: "asc" }, { effectiveFrom: "desc" }],
    }) as Promise<PerDiemRateRow[]>,
  ]);

  const today = new Date();
  // Which row is in force TODAY, per name — so the table can mark the version
  // that is actually pricing new claims rather than leaving the reader to
  // compare dates by eye.
  const names: string[] = [];
  for (const r of rates) if (!names.includes(r.name)) names.push(r.name);
  const inForce = new Set<string>();
  for (const name of names) {
    const id = selectEffectiveRate(rates, name, today)?.id;
    if (id) inForce.add(id);
  }

  return (
    <SettingsPanel
      title="Per-diem rates"
      description="A daily allowance, paid without a receipt. Rates are versioned by date — add a new effective date rather than editing an old one, and past claims keep the rate they were filed at."
    >
      <PerDiemRatesPanel currency={org.currency} />

      {rates.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No per-diem rates yet</CardTitle>
            <CardDescription>
              Add one above and employees can file a per-diem claim against it.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* mobile: cards */}
          <ul className="grid gap-3 md:hidden">
            {rates.map((r: PerDiemRateRow) => (
              <li key={r.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {r.name}
                      <StatusBadge status={r.active ? "active" : "deactivated"} />
                    </CardTitle>
                    <CardDescription>
                      <Amount value={r.dailyAmount} currency={org.currency} size="meta" />
                      {" per day · from "}
                      <DateCell value={r.effectiveFrom.toISOString()} />
                      {r.location ? ` · ${r.location}` : ""}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>

          {/* desktop: table */}
          <div className="border-line overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle/50 text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">Name</th>
                  <th scope="col" className="p-3 font-medium">Location</th>
                  <th scope="col" className="p-3 font-medium">Daily amount</th>
                  <th scope="col" className="p-3 font-medium">Effective from</th>
                  <th scope="col" className="p-3 font-medium">Status</th>
                  <th scope="col" className="p-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r: PerDiemRateRow) => (
                  <tr key={r.id} className="border-line border-t">
                    <td className="p-3 font-medium">
                      {r.name}
                      {inForce.has(r.id) ? (
                        <span className="text-meta text-text-tertiary block font-normal">
                          in force today
                        </span>
                      ) : null}
                    </td>
                    <td className="text-text-tertiary p-3">{r.location ?? "—"}</td>
                    <td className="p-3">
                      <Amount value={r.dailyAmount} currency={org.currency} />
                    </td>
                    <td className="p-3">
                      <DateCell value={r.effectiveFrom.toISOString()} />
                    </td>
                    <td className="p-3">
                      <StatusBadge status={r.active ? "active" : "deactivated"} />
                    </td>
                    <td className="p-3 text-right">
                      <PerDiemRatesPanel
                        currency={org.currency}
                        editing={{
                          id: r.id,
                          name: r.name,
                          location: r.location ?? "",
                          dailyAmount: r.dailyAmount,
                          effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
                          active: r.active,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SettingsPanel>
  );
}
