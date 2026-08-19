"use client";

// Domain components (D0.5) — DESIGN-PRD §6.2.
//
// Two halves, and the second half is the point. The top shows what is built;
// the bottom is a roster of every §6.2 component that ISN'T, with the task
// that delivers it. A gallery that only lists finished work looks complete
// long before it is, and a review surface that flatters the project is
// useless. Each row moves up as its task lands.
import { BreakdownBarChart } from "@/components/charts/breakdown-bar";
import { MonthlyBarChart } from "@/components/charts/monthly-bar";
import { TrendAreaChart } from "@/components/charts/trend-area";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { ComplaintStatusBadge, SlaBadge } from "@/components/sla-badge";
import { StatusBadge } from "@/components/status-badge";
import { CHART_SERIES } from "@/lib/design/chart-colors";
import { Block, DebtNote, Group, Panel, Row } from "./shared";

/** Fixed dates so the SLA specimens don't change grade overnight. */
const NOW = new Date("2026-08-19T10:00:00Z");
const DAYS = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const MONTHLY = [
  { month: "Mar", total: 412_000 },
  { month: "Apr", total: 388_500 },
  { month: "May", total: 501_200 },
  { month: "Jun", total: 447_800 },
  { month: "Jul", total: 623_400 },
  { month: "Aug", total: 512_900 },
];

const BREAKDOWN = [
  { label: "Travel", total: 288_400 },
  { label: "Meals", total: 121_900 },
  { label: "Software", total: 96_500 },
  { label: "Lodging", total: 74_300 },
  { label: "Other", total: 31_800 },
];

// TrendAreaChart stacks its series, so the specimen uses categories that
// legitimately sum to a total — stacking "submitted" on "approved" would
// teach a chart that lies.
const TREND = MONTHLY.map((m, i) => ({
  month: m.month,
  Travel: Math.round(m.total * (0.55 + i * 0.01)),
  Meals: Math.round(m.total * 0.25),
  Software: Math.round(m.total * (0.2 - i * 0.01)),
}));

/** §6.2 components not yet built, with the task that delivers each. */
const ROSTER = [
  { name: "StatCard", purpose: "KPI label, value, delta chip, sparkline", task: "D1.4" },
  { name: "AmountInput", purpose: "Paste-tolerant, minor-unit safe", task: "D2.1" },
  { name: "ReceiptDropzone", purpose: "Drag-and-drop and camera capture", task: "D2.2" },
  { name: "OCRReviewCard", purpose: "Extracted fields with confidence emphasis", task: "D2.2" },
  { name: "ApprovalRow", purpose: "Decide without opening; optimistic exit with undo", task: "D3.1" },
  { name: "PaymentProofViewer", purpose: "Lightbox with zoom and metadata sidebar", task: "D3.2" },
  { name: "LedgerTable", purpose: "Tally-style running balance, sticky totals, print", task: "D4.1" },
  { name: "ReconcileBuckets", purpose: "Three-column board with counts", task: "D4.2" },
] as const;

export function DomainSection() {
  return (
    <Group
      id="domain"
      eyebrow="§6.2"
      title="Domain components"
      description="The pieces that know what an expense is. Everything here reads its colour from the same status map the primitives do — a policy flag is the warning token, not a shade someone liked."
    >
      <Block
        title="Status and flags"
        description="StatusBadge is the only renderer of status colour. SlaBadge and the complaint badge read the same tones rather than inventing a green/amber/red of their own."
      >
        <Panel>
          <Row label="StatusBadge — report workflow">
            <StatusBadge status="draft" />
            <StatusBadge status="submitted" />
            <StatusBadge status="approved" />
            <StatusBadge status="rejected" />
            <StatusBadge status="sent_back" />
            <StatusBadge status="reimbursed" />
          </Row>
          <Row label="StatusBadge — reconciliation buckets">
            <StatusBadge status="matched" />
            <StatusBadge status="missing_in_bank" />
            <StatusBadge status="missing_in_app" />
          </Row>
          <Row label="SlaBadge — business-day maths from lib/domain/complaint">
            <SlaBadge createdAt={DAYS(1)} status="open" now={NOW} />
            <SlaBadge createdAt={DAYS(5)} status="open" now={NOW} />
            <SlaBadge createdAt={DAYS(12)} status="open" now={NOW} />
            <SlaBadge createdAt={DAYS(12)} resolvedAt={DAYS(9)} status="resolved" now={NOW} />
          </Row>
          <Row label="ComplaintStatusBadge">
            <ComplaintStatusBadge status="open" />
            <ComplaintStatusBadge status="in_review" />
            <ComplaintStatusBadge status="resolved" />
            <ComplaintStatusBadge status="wont_fix" />
          </Row>
          <Row label="FlagChips — policy violations warn, never block">
            <FlagChips
              flags={asFlags([
                { rule: "per_expense_limit", message: "Above the ₹5,000 per-expense limit" },
                { rule: "receipt_required", message: "A receipt is required over ₹1,000" },
                { rule: "duplicate", message: "Same amount, date and merchant as EXP-2261" },
              ])}
            />
          </Row>
          <DebtNote owner="D2.1">
            FlagChips still paints raw <code>bg-amber-100</code> rather than the
            warning token, and carries its message in a <code>title</code>
            attribute instead of a Tooltip — so it is invisible to keyboard
            users. Both are fixed when the capture flow is restyled.
          </DebtNote>
        </Panel>
      </Block>

      <Block
        title="Charts"
        description="Recharts, one accent for the primary series and a restrained categorical palette for the rest — never a rainbow. Read-only in v1: no brush, no zoom."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Monthly spend — single series">
            <MonthlyBarChart data={MONTHLY} currency="INR" />
          </Panel>
          <Panel title="Category breakdown — secondary series">
            <BreakdownBarChart data={BREAKDOWN} currency="INR" />
          </Panel>
          <Panel title="Spend by category over time — stacked categorical" className="lg:col-span-2">
            <TrendAreaChart
              series={TREND}
              labels={["Travel", "Meals", "Software"]}
              currency="INR"
            />
          </Panel>
        </div>
        <Panel title="Series palette">
          <div className="flex flex-wrap gap-3">
            {CHART_SERIES.map((color, i) => (
              <div key={color} className="grid gap-1">
                <span
                  className="border-line block size-12 rounded-md border"
                  style={{ background: color }}
                />
                <code className="text-meta text-text-tertiary tabular">
                  {i === CHART_SERIES.length - 1 ? "other" : `series ${i + 1}`}
                </code>
              </div>
            ))}
          </div>
          <DebtNote owner="D1.4">
            The series palette predates the token layer — it is centralised in
            lib/design/chart-colors.ts but not yet aligned to the accent scale,
            and the grid, axes and tooltips still use Recharts defaults rather
            than the card styling §6.2 asks for.
          </DebtNote>
        </Panel>
      </Block>

      <Block
        title="Not built yet"
        description="The rest of §6.2, with the task that delivers each. These rows move up into the gallery as they land — that is what “added to /design-system in the same commit” means in practice. Amount and DateCell left this table in D1.1; they now have their own section above."
      >
        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <table className="w-full text-body">
            <thead className="bg-bg-subtle text-text-secondary text-label">
              <tr>
                <th className="p-3 text-left font-medium">Component</th>
                <th className="p-3 text-left font-medium">Purpose</th>
                <th className="p-3 text-left font-medium">Task</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {ROSTER.map((row) => (
                <tr key={row.name}>
                  <td className="text-text-primary p-3">{row.name}</td>
                  <td className="text-text-secondary p-3">{row.purpose}</td>
                  <td className="p-3">
                    <code className="text-label text-text-tertiary">{row.task}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </Group>
  );
}
