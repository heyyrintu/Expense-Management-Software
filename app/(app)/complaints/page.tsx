// Complaints (7.3). Employees see their own disputes; finance_admin+ get the
// inbox with status / type / age filters and SLA badges. Both views read the
// same lib/complaints/queries module.
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComplaintStatusBadge, SlaBadge } from "@/components/sla-badge";
import { DateCell } from "@/components/ui/date-cell";
import { requireSession } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { listComplaints, complaintSummary } from "@/lib/complaints/queries";
import { scopedDb } from "@/lib/db/scoped";
import {
  COMPLAINT_STATUSES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_TYPES,
  COMPLAINT_TYPE_LABELS,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";

function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const raw = await searchParams;
  const isFinance = roleAtLeast(ctx.role, "finance_admin");
  const now = new Date();

  const status = (one(raw.status) ?? "all") as ComplaintStatus | "all" | "open_only";
  const type = (one(raw.type) ?? "all") as ComplaintType | "all";
  const age = (one(raw.age) ?? "all") as "all" | "breached" | "warning";
  const mine = one(raw.mine) === "1";

  const rows = await listComplaints(
    db,
    {
      raisedById: isFinance ? undefined : ctx.userId,
      assignedToId: isFinance && mine ? ctx.userId : undefined,
      status,
      type,
      age,
    },
    now
  );
  const summary = isFinance ? await complaintSummary(db, {}, now) : null;

  const qs = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    const base: Record<string, string> = {
      status: status === "all" ? "" : status,
      type: type === "all" ? "" : type,
      age: age === "all" ? "" : age,
      mine: mine ? "1" : "",
      ...patch,
    };
    for (const [k, v] of Object.entries(base)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/complaints?${s}` : "/complaints";
  };

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          {isFinance ? "Complaints inbox" : "My complaints"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isFinance
            ? "Disputes raised by employees about reports and payments. Target: 5 business days."
            : "Disputes you've raised about your reports and payments."}
        </p>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Open", value: summary.open, tone: "text-foreground" },
            { label: "In review", value: summary.inReview, tone: "text-foreground" },
            { label: "Past SLA", value: summary.breached, tone: "text-red-700" },
            { label: "Unassigned", value: summary.unassigned, tone: "text-amber-700" },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className={`text-2xl ${s.tone}`}>{s.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase">Status</span>
          {(["all", "open_only", ...COMPLAINT_STATUSES] as const).map((s) => (
            <Link
              key={s}
              href={qs({ status: s === "all" ? "" : s })}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                status === s ? "border-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {s === "all"
                ? "All"
                : s === "open_only"
                  ? "Still open"
                  : COMPLAINT_STATUS_LABELS[s as ComplaintStatus]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase">Type</span>
          {(["all", ...COMPLAINT_TYPES] as const).map((t) => (
            <Link
              key={t}
              href={qs({ type: t === "all" ? "" : t })}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                type === t ? "border-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {t === "all" ? "All" : COMPLAINT_TYPE_LABELS[t as ComplaintType]}
            </Link>
          ))}
        </div>
        {isFinance ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs uppercase">Age</span>
            {(
              [
                ["all", "Any"],
                ["warning", "3+ days"],
                ["breached", "Past SLA"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={qs({ age: value === "all" ? "" : value })}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  age === value ? "border-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href={qs({ mine: mine ? "" : "1" })}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                mine ? "border-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Assigned to me
            </Link>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No complaints here</CardTitle>
            <CardDescription>
              {isFinance
                ? "Nothing matches these filters. Clear them to see everything."
                : "If a report or payment doesn't look right, open it and choose “Raise complaint”."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={isFinance ? "/complaints" : "/reports"}
              className="text-sm underline"
            >
              {isFinance ? "Clear filters" : "Go to my reports"}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/complaints/${c.id}`}
                className="hover:bg-accent/40 block rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {COMPLAINT_TYPE_LABELS[c.type]}
                  </span>
                  <ComplaintStatusBadge status={c.status} />
                  <SlaBadge
                    createdAt={c.createdAt}
                    resolvedAt={c.resolvedAt}
                    status={c.status}
                    now={now}
                  />
                  {c.messageCount > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {c.messageCount} {c.messageCount === 1 ? "reply" : "replies"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm">{c.description}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {isFinance ? `${c.raisedBy.name} · ` : ""}
                  {c.reportTitle
                    ? `Report “${c.reportTitle}”`
                    : c.reimbursementReference
                      ? `Payment ${c.reimbursementReference}`
                      : "—"}{" "}
                  · raised <DateCell value={c.createdAt} tone="muted" /> ·{" "}
                  {c.assignedTo ? `with ${c.assignedTo.name}` : "unassigned"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
