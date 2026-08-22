"use client";

// Dashboards (D3.3) — DESIGN-PRD §7.4.
//
// Three role variants of one screen, the ranked breakdown, and the loading
// state. The loading state is on this page for a specific reason: it is the
// one state nobody reviews, because you only see it for 200ms on a slow
// connection and never on a fast one. Put next to the real strip at the same
// width, a skeleton that reserves the wrong box is obvious in a second.
import * as React from "react";

import { KpiStrip } from "@/components/ui/kpi-strip";
import { RankList, type RankRow } from "@/components/ui/rank-list";
import {
  buildApproverKpis,
  buildComplaintsKpi,
  buildEmployeeKpis,
  buildFinanceKpis,
} from "@/lib/domain/dashboard-kpi";
import type { StatusGroup } from "@/lib/domain/expense-stats";
import { EMPTY_EXPENSE_FILTERS } from "@/lib/schemas/expense-filters";
import { DashboardSkeleton } from "@/app/(app)/dashboard/dashboard-skeleton";
import { Block, Group, Panel, Row } from "./shared";
import { Button } from "@/components/ui/button";

const CURRENCY = "INR";

/** A plausible groupBy — the same shape the real screen hands the builders. */
const GROUPS: StatusGroup[] = [
  { status: "draft", _sum: { baseAmount: 184_500 }, _count: { _all: 6 } },
  { status: "submitted", _sum: { baseAmount: 1_240_000 }, _count: { _all: 23 } },
  { status: "approved", _sum: { baseAmount: 3_960_000 }, _count: { _all: 48 } },
  { status: "reimbursed", _sum: { baseAmount: 8_415_000 }, _count: { _all: 131 } },
];

const MONTHLY = [
  { total: 9_100_000 },
  { total: 10_450_000 },
  { total: 11_020_000 },
  { total: 9_870_000 },
  { total: 12_400_000 },
  { total: 13_799_500 },
];

const BASE = { groups: GROUPS, filters: EMPTY_EXPENSE_FILTERS, currency: CURRENCY, monthly: MONTHLY };

/** Finance's complaints card (G2) — a count, and one with a breach in it, so
 *  the hint shows the branch that matters rather than the quiet one. */
const COMPLAINTS = { open: 6, breached: 2, warning: 1, oldestOpenDays: 11 };

const ROLES = ["employee", "approver", "finance"] as const;
type RoleKey = (typeof ROLES)[number];

const CATEGORIES: RankRow[] = [
  { key: "1", label: "Travel", total: 5_240_000, count: 61, href: "/expenses" },
  { key: "2", label: "Meals and entertainment", total: 2_980_000, count: 44, href: "/expenses" },
  { key: "3", label: "Software", total: 2_105_000, count: 12, href: "/expenses" },
  { key: "4", label: "Office supplies", total: 890_000, count: 27, href: "/expenses" },
  { key: "5", label: "Training", total: 412_000, count: 5, href: "/expenses" },
  { key: "6", label: "Uncategorised", total: 172_500, count: 3, href: "/expenses" },
];

export function DashboardSection() {
  const [role, setRole] = React.useState<RoleKey>("finance");

  const kpis =
    role === "finance"
      ? [
          ...buildFinanceKpis({ ...BASE, payable: { count: 9, outstanding: 3_487_600 } }),
          // G2: finance's fifth card, exactly as the real screen assembles it.
          buildComplaintsKpi({ summary: COMPLAINTS, href: "/complaints?status=open" }),
        ]
      : role === "approver"
        ? buildApproverKpis({ ...BASE, queue: { count: 7, total: 1_240_000, flagged: 2 } })
        : buildEmployeeKpis(BASE);

  return (
    <Group
      id="dashboard"
      eyebrow="§7.4"
      title="Dashboards"
      description="One route, three screens, decided by the scope the server resolves from the role — never by a query parameter. Every card opens the rows it was counted from."
    >
      <Block
        title="KPI strip"
        description="1 → 2 → N across the breakpoints, where N is the number of cards (KpiStrip derives it). A strip must never leave one card alone on a second row: an orphan reads as a separate section rather than the last member of the set — which is what four hard-coded columns did to finance's fifth card in G2."
      >
        <Row label="Role">
          {ROLES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={role === r ? "primary" : "secondary"}
              onClick={() => setRole(r)}
            >
              {r === "finance" ? "Finance" : r === "approver" ? "Approver" : "Employee"}
            </Button>
          ))}
        </Row>

        <Panel>
          <KpiStrip kpis={kpis} />
          <p className="text-meta text-text-tertiary">
            Switch to Finance and a footnote appears. That is the whole point
            of the <code>agreement</code> field: “Outstanding to employees” is
            report totals minus payments, so no expense filter reproduces it,
            and the type refuses to let it link anywhere without saying so.
            The other three cards keep their credibility because this one
            declared itself.
          </p>
        </Panel>
      </Block>

      <Block
        title="Loading"
        description="Every block reserves the exact box its real counterpart occupies, and both import their grid classes from layout-grid.ts — so “no layout shift” is structural rather than a claim someone checked once."
      >
        <Panel>
          <KpiStrip kpis={kpis} loading />
        </Panel>
      </Block>

      <Block
        title="RankList"
        description="The breakdown half of §7.4. A list rather than a second chart: a chart answers “which is biggest” and refuses “how much was travel”, and a chart segment cannot carry a link."
      >
        <Panel>
          <RankList rows={CATEGORIES} currency={CURRENCY} />
          <p className="text-meta text-text-tertiary">
            Bars are scaled to the LARGEST row, not to the total. Share-of-total
            renders the tail as invisible slivers and turns the bottom half of
            the list into decoration; scaled to the leader, every row has a
            length worth comparing to its neighbour. The bar is{" "}
            <code>aria-hidden</code> — the amount beside it is the accessible
            value, and hearing it twice teaches a screen-reader user nothing.
          </p>
        </Panel>

        <Panel>
          <RankList rows={[]} currency={CURRENCY} emptyMessage="No expenses match this view yet." />
        </Panel>
      </Block>

      <Block
        title="Whole-screen skeleton"
        description="What /dashboard renders while its queries run. Shown at full width so a mismatched reservation is visible against the sections above."
      >
        <div className="border-line bg-bg-app rounded-lg border p-5">
          <DashboardSkeleton />
        </div>
      </Block>
    </Group>
  );
}
