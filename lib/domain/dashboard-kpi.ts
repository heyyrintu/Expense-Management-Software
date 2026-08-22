// Dashboard KPIs (D3.3) — DESIGN-PRD §7.4.
//
// "Every KPI clicks through to its filtered table — the number and the list
// must always agree."
//
// D1.4 made that true for the expense list by building the card and its href
// from one query. A dashboard is harder: it mixes expense sums with
// report-level figures like "outstanding to employees", which is not a sum of
// expenses at all — it is report totals minus payments recorded against them.
// Those two can never be the same query, so a KPI here has to be able to SAY
// which it is.
//
// Hence `agreement`. Every card declares one of:
//
//   exact     — the linked list runs the same where-clause this number was
//               summed from. Following the card and adding up the rows gives
//               the figure on the card, at any page size.
//   different — the card links somewhere useful, but the number came from a
//               different query. The reason is carried in `note`, rendered
//               under the KPI grid, not buried in a commit message.
//
// There is deliberately no "no link" case. A KPI the reader cannot open is a
// number nobody can check; if a figure has nowhere honest to point, it does
// not earn a card.
//
// The type is what enforces this: `note` is REQUIRED on "different", so the
// only way to ship a card whose number is computed differently is to write
// down why. tests/unit/dashboard-kpi.test.ts asserts every builder's exact
// cards serialise an href that round-trips back to the filters they were
// summed over.
import {
  expenseFiltersToParams,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import type { ExpenseViewScope } from "./expense-scope";
import type { StatusGroup } from "./expense-stats";

export type KpiAgreement =
  /** Same where-clause as the list behind `href`. */
  | { kind: "exact"; href: string }
  /** Different query. `note` explains, and is shown to the reader. */
  | { kind: "different"; href: string; note: string };

export type KpiDelta = {
  percent: number;
  label: string;
  /** Spend rising is not a win. Reimbursement rising is. */
  goodDirection: "up" | "down";
};

export type DashboardKpi = {
  key: string;
  label: string;
  /** Integer minor units when `currency` is set; a plain count otherwise. */
  value: number;
  currency?: string;
  hint?: string;
  agreement: KpiAgreement;
  delta?: KpiDelta | null;
  /** Sparkline values, oldest first. */
  trend?: number[];
};

export type ExpenseStatusKey =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "reimbursed";

/**
 * The expense list's URL for a filter state, optionally narrowed to one
 * status and widened to a view scope the session is allowed to see.
 *
 * `scope` rides alongside the filters rather than inside them — see the
 * header note in lib/domain/expense-scope.ts. "mine" is omitted because it is
 * the default; writing it would put a redundant parameter in every employee's
 * shared link.
 */
export function expenseListHref(
  filters: ExpenseFilters,
  opts: { status?: ExpenseStatusKey; scope?: ExpenseViewScope } = {}
): string {
  const next: ExpenseFilters = opts.status
    ? { ...filters, status: [opts.status] }
    : filters;
  const params = expenseFiltersToParams(next);
  if (opts.scope && opts.scope !== "mine") params.set("scope", opts.scope);
  const query = params.toString();
  return query ? `/expenses?${query}` : "/expenses";
}

/** Sum and count for one status out of the screen's own groupBy. */
function slice(groups: StatusGroup[], status?: ExpenseStatusKey) {
  const rows = status ? groups.filter((g) => g.status === status) : groups;
  return {
    total: rows.reduce((sum, g) => sum + (g._sum.baseAmount ?? 0), 0),
    count: rows.reduce((sum, g) => sum + g._count._all, 0),
  };
}

/** "12 expenses" / "1 expense". */
export function countHint(count: number): string {
  return `${count} expense${count === 1 ? "" : "s"}`;
}

/**
 * One expense-backed card. Both the number and the href come from the same
 * two arguments, so they cannot be edited apart — which is the entire reason
 * this helper exists rather than each dashboard assembling cards by hand.
 */
function expenseKpi(args: {
  key: string;
  label: string;
  groups: StatusGroup[];
  filters: ExpenseFilters;
  currency: string;
  status?: ExpenseStatusKey;
  scope?: ExpenseViewScope;
  delta?: KpiDelta | null;
  trend?: number[];
}): DashboardKpi {
  const { total, count } = slice(args.groups, args.status);
  return {
    key: args.key,
    label: args.label,
    value: total,
    currency: args.currency,
    hint: countHint(count),
    delta: args.delta ?? null,
    trend: args.trend,
    agreement: {
      kind: "exact",
      href: expenseListHref(args.filters, {
        status: args.status,
        scope: args.scope,
      }),
    },
  };
}

/**
 * Month-over-month change from the trend series, as a percentage.
 *
 * Null rather than a number when the previous month was zero: the honest
 * change from nothing to something is not "infinity%" and not "100%", it is
 * "there is no comparison yet". A delta chip that appears out of nowhere the
 * first time a figure is non-zero teaches the reader to distrust it.
 */
export function monthOverMonthDelta(
  monthly: Array<{ total: number }>
): number | null {
  if (monthly.length < 2) return null;
  const current = monthly[monthly.length - 1].total;
  const previous = monthly[monthly.length - 2].total;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function spendDelta(monthly: Array<{ total: number }>): KpiDelta | null {
  const percent = monthOverMonthDelta(monthly);
  if (percent === null) return null;
  return { percent, label: "vs last month", goodDirection: "down" };
}

// ---------------------------------------------------------------------------
// The three dashboards. Each takes the SAME groupBy its charts and tables are
// built from, so a card can never summarise a different set than the screen
// around it.
// ---------------------------------------------------------------------------

type BaseArgs = {
  groups: StatusGroup[];
  filters: ExpenseFilters;
  currency: string;
  monthly: Array<{ total: number }>;
};

/** Employee (§7.4 adapted): my spend, awaiting approval, pending
 *  reimbursement, drafts. Every one is a slice of the same list this reader
 *  already owns, so all four are exact. */
export function buildEmployeeKpis(args: BaseArgs): DashboardKpi[] {
  const common = {
    groups: args.groups,
    filters: args.filters,
    currency: args.currency,
  };
  return [
    expenseKpi({
      ...common,
      key: "total",
      label: "My spend in view",
      delta: spendDelta(args.monthly),
      trend: args.monthly.map((m) => m.total),
    }),
    expenseKpi({ ...common, key: "submitted", label: "Awaiting approval", status: "submitted" }),
    expenseKpi({
      ...common,
      key: "approved",
      label: "Pending reimbursement",
      status: "approved",
    }),
    expenseKpi({ ...common, key: "draft", label: "Not submitted", status: "draft" }),
  ];
}

/** Approver (§7.4 adapted): the queue first — it is the only figure on this
 *  screen that is someone waiting on THEM — then the team's spend. */
export function buildApproverKpis(
  args: BaseArgs & {
    /** Straight from `approvalQueueFor`, so the card and /approvals are the
     *  same rows counted twice rather than two queries hoping to match. */
    queue: { count: number; total: number; flagged: number };
  }
): DashboardKpi[] {
  const common = {
    groups: args.groups,
    filters: args.filters,
    currency: args.currency,
    scope: "team" as const,
  };
  return [
    {
      key: "queue",
      label: "Waiting on you",
      value: args.queue.total,
      currency: args.currency,
      hint:
        args.queue.flagged > 0
          ? `${args.queue.count} reports · ${args.queue.flagged} flagged`
          : `${args.queue.count} report${args.queue.count === 1 ? "" : "s"}`,
      agreement: { kind: "exact", href: "/approvals" },
    },
    expenseKpi({
      ...common,
      key: "total",
      label: "Team spend in view",
      delta: spendDelta(args.monthly),
      trend: args.monthly.map((m) => m.total),
    }),
    expenseKpi({ ...common, key: "submitted", label: "Team awaiting approval", status: "submitted" }),
    expenseKpi({
      ...common,
      key: "approved",
      label: "Team awaiting reimbursement",
      status: "approved",
    }),
  ];
}

/**
 * Finance — the four cards §7.4 names, in the order it names them.
 *
 * The fourth is the one that cannot be an expense sum, and it is worth being
 * precise about why. "Outstanding to employees" is what the organisation owes
 * right now: for every approved or partly-paid REPORT, its total minus the
 * payments recorded against it. Expenses do not carry payments — reports do —
 * so no filtering of the expense table produces this number. It links to
 * /finance, which lists exactly the reports it was computed from, and says so.
 */
export function buildFinanceKpis(
  args: BaseArgs & {
    /** From lib/domain/payable.ts — the same call /finance makes. */
    payable: { count: number; outstanding: number };
  }
): DashboardKpi[] {
  const common = {
    groups: args.groups,
    filters: args.filters,
    currency: args.currency,
    scope: "org" as const,
  };
  return [
    expenseKpi({
      ...common,
      key: "total",
      label: "Total spend",
      delta: spendDelta(args.monthly),
      trend: args.monthly.map((m) => m.total),
    }),
    expenseKpi({ ...common, key: "submitted", label: "Pending approval", status: "submitted" }),
    expenseKpi({
      ...common,
      key: "approved",
      label: "Awaiting reimbursement",
      status: "approved",
    }),
    {
      key: "outstanding",
      label: "Outstanding to employees",
      value: args.payable.outstanding,
      currency: args.currency,
      hint: `${args.payable.count} report${args.payable.count === 1 ? "" : "s"} payable`,
      agreement: {
        kind: "different",
        href: "/finance",
        note:
          "Outstanding to employees is report totals minus payments already " +
          "recorded, not a sum of expenses — payments attach to reports, so " +
          "no expense filter produces it. It ignores the filters above and " +
          "matches the payment queue on /finance exactly.",
      },
    },
  ];
}

/**
 * Finance's fifth card: open complaints and how old they are (G2).
 *
 * `complaintSummary` in lib/complaints/queries.ts was written as the dashboard
 * widget and documented as one, and its only caller was /complaints — the
 * dashboard never mentioned complaints at all. So finance had no way to see a
 * dispute ageing past its SLA without navigating to a screen they had no
 * reason to open.
 *
 * ── WHY THIS ONE IS `different` ───────────────────────────────────────────
 * Every other card on this strip is an expense sum, narrowed by the filter
 * bar. A complaint is not an expense: it has no amount, no category and no
 * project, and it is raised against a REPORT or a PAYMENT. None of the
 * dashboard's facets apply to it, so the number deliberately ignores them.
 *
 * The type forces that admission into the UI rather than a commit message —
 * `note` is required on "different", and KpiStrip prints it under the grid.
 * Letting a count that ignores the filters sit unmarked between four figures
 * that obey them is precisely how a reader learns the whole strip is
 * approximate.
 *
 * The href still points at the list the number came from: /complaints,
 * filtered to the same open statuses `complaintSummary` counted, serialised
 * through `complaintFiltersToParams` — the inbox's own URL contract, not a
 * hand-written query string.
 */
export function buildComplaintsKpi(args: {
  summary: { open: number; breached: number; warning: number; oldestOpenDays: number };
  /** The open statuses the summary counted, serialised back out. */
  href: string;
}): DashboardKpi {
  const { open, breached, warning, oldestOpenDays } = args.summary;

  // The hint leads with what is actionable. A breach is the only one of these
  // that means a promise has already been missed, so it comes first when it
  // exists; "oldest N days" is the fallback because a count with no age is a
  // number you cannot triage.
  const hint =
    open === 0
      ? "Nothing open"
      : breached > 0
        ? `${breached} past SLA · oldest ${plural(oldestOpenDays, "day")}`
        : warning > 0
          ? `${warning} nearing SLA · oldest ${plural(oldestOpenDays, "day")}`
          : `Oldest ${plural(oldestOpenDays, "day")}`;

  return {
    key: "complaints",
    label: "Open complaints",
    // No `currency`: this is a count, and StatCard's non-currency branch
    // renders it through the shared formatter.
    value: open,
    hint,
    agreement: {
      kind: "different",
      href: args.href,
      note:
        "Open complaints counts disputes, not expenses — a complaint has no " +
        "amount, category or project, so the filters above do not apply to " +
        "it. It matches the open items on /complaints exactly.",
    },
  };
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** The footnotes to render under a KPI grid: one per card computed
 *  differently from the list it opens. Empty when every card is exact. */
export function kpiNotes(kpis: DashboardKpi[]): Array<{ label: string; note: string }> {
  return kpis.flatMap((k) =>
    k.agreement.kind === "different"
      ? [{ label: k.label, note: k.agreement.note }]
      : []
  );
}
