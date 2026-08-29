// Money and dates (D1.1) — DESIGN-PRD §5.3, §6.2.
//
// The edge cases are the point of this section. Money code fails at the
// boundaries, not in the middle: zero versus missing, the negative sign, the
// Indian grouping at eight figures, a currency the org doesn't use. Each of
// those is rendered here so a regression is visible rather than theoretical.
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { Block, Group, Panel } from "./shared";

/** Fixed so the relative specimens don't drift with the wall clock. */
const NOW = new Date("2026-08-19T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function MoneySection() {
  return (
    <Group
      id="money"
      eyebrow="§5.3 · §6.2"
      title="Money and dates"
      description="Two components, and no component may format either without them. That is what makes “the same amount renders identically in a table, a card, a WhatsApp message and a PDF” a rule rather than a hope."
    >
      <Block
        title="Sizes"
        description="Three, matched to the type scale. display for a hero figure, body for table rows and cards, meta for a secondary or inline mention. All three are tabular."
      >
        <Panel>
          <div className="grid gap-4">
            {(["display", "body", "meta"] as const).map((size) => (
              <div key={size} className="flex flex-wrap items-baseline gap-4">
                <code className="text-meta text-text-tertiary w-16">{size}</code>
                <Amount value={1245600} currency="INR" size={size} />
              </div>
            ))}
            {/* The hero face (N2.2): Bodoni Moda, one figure per screen —
                the dashboard's first KPI and the ledger's closing balance.
                Never in a column: Bodoni has no tabular figures. */}
            <div className="flex flex-wrap items-baseline gap-4">
              <code className="text-meta text-text-tertiary w-16">hero</code>
              <Amount value={1245600} currency="INR" size="display" face="display" />
            </div>
          </div>
        </Panel>
      </Block>

      <Block
        title="Edge cases"
        description="Zero is not missing, and a negative is signed with a minus in the danger token — never parentheses, which vanish at a glance and disappear entirely when read aloud."
      >
        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <table className="w-full text-body">
            <thead className="bg-bg-subtle text-text-secondary text-label">
              <tr>
                <th className="p-3 text-left font-medium">Case</th>
                <th className="p-3 text-right font-medium">Rendered</th>
                <th className="p-3 text-left font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {[
                {
                  label: "Zero",
                  node: <Amount value={0} currency="INR" align="right" />,
                  note: "A real value. Renders ₹0.00, never a dash.",
                },
                {
                  label: "Missing",
                  node: <Amount value={null} currency="INR" align="right" />,
                  note: "Dash plus an “No amount” label for screen readers. An unsettled advance and a settled one must not look alike.",
                },
                {
                  label: "Negative",
                  node: <Amount value={-45000} currency="INR" align="right" />,
                  note: "Danger token and a minus sign — two signals, so it survives being printed in greyscale.",
                },
                {
                  label: "Sub-rupee",
                  node: <Amount value={5} currency="INR" align="right" />,
                  note: "Two decimal places at every magnitude.",
                },
                {
                  label: "Very large",
                  node: <Amount value={1234567890} currency="INR" align="right" />,
                  note: "Lakhs and crores — ₹1,23,45,678.90, not 12,345,678.90.",
                },
                {
                  label: "Foreign currency",
                  node: <Amount value={123456} currency="USD" align="right" />,
                  note: "Whatever the expense was actually paid in.",
                },
                {
                  label: "Unknown code",
                  node: <Amount value={123456} currency="ZZZ" align="right" />,
                  note: "Falls back to “CODE 1234.56” rather than throwing inside a table.",
                },
                {
                  label: "Muted tone",
                  node: <Amount value={125000} currency="INR" align="right" tone="muted" />,
                  note: "For a total that is context rather than the point of the row.",
                },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="text-text-primary p-3">{row.label}</td>
                  <td className="p-3 text-right whitespace-nowrap">{row.node}</td>
                  <td className="text-text-secondary p-3 text-meta">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Multi-currency"
        description="What was actually spent on top, what it converts to underneath. That ordering is deliberate — the employee recognises the amount they paid, not its conversion."
      >
        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <table className="w-full text-body">
            <thead className="bg-bg-subtle text-text-secondary text-label">
              <tr>
                <th className="p-3 text-left font-medium">Merchant</th>
                <th className="p-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              <tr>
                <td className="text-text-secondary p-3">AWS</td>
                <td className="p-3 text-right">
                  <Amount
                    value={24000}
                    currency="USD"
                    align="right"
                    converted={{ value: 2004000, currency: "INR" }}
                  />
                </td>
              </tr>
              <tr>
                <td className="text-text-secondary p-3">IndiGo</td>
                <td className="p-3 text-right">
                  <Amount value={1450000} currency="INR" align="right" />
                </td>
              </tr>
              <tr>
                <td className="text-text-secondary p-3">Refund — Taj</td>
                <td className="p-3 text-right">
                  <Amount
                    value={-320000}
                    currency="INR"
                    align="right"
                    converted={{ value: -320000, currency: "INR" }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Alignment in a column"
        description="Right-aligned and tabular, so the decimal points stack whatever the magnitude. This is the whole reason for the alignment rule — a column you can scan instead of read."
      >
        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <ul className="divide-line divide-y">
            {[450, 34050, 1450000, 0, -320000, 1234567890].map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-4 py-2">
                <span className="text-body text-text-secondary">Row {i + 1}</span>
                <Amount value={v} currency="INR" align="right" />
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block
        title="Dates"
        description="One format, dd MMM yyyy, everywhere. 12/08/2026 is the 12th of August to half the world and the 8th of December to the other half — and this product reconciles bank statements."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Absolute — the default">
            <ul className="grid gap-2">
              {[
                { label: "Expense date", value: new Date("2026-08-12T00:00:00Z") },
                { label: "Single digit day", value: new Date("2026-08-05T00:00:00Z") },
                { label: "Muted", value: NOW, tone: "muted" as const },
                { label: "Missing", value: null },
                { label: "Malformed", value: "not-a-date" },
              ].map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-4">
                  <span className="text-meta text-text-tertiary">{row.label}</span>
                  <DateCell value={row.value} tone={row.tone} />
                </li>
              ))}
            </ul>
            <p className="text-meta text-text-tertiary">
              A malformed value renders the same calm dash as a missing one —
              never the string “Invalid Date” in a finance screen.
            </p>
          </Panel>

          <Panel title="Relative — activity contexts only">
            <ul className="grid gap-2">
              {[
                { label: "Seconds", value: ago(5_000) },
                { label: "Minutes", value: ago(2 * MINUTE) },
                { label: "Hours", value: ago(5 * HOUR) },
                { label: "Yesterday", value: new Date("2026-08-18T23:00:00Z") },
                { label: "Days", value: ago(3 * DAY) },
                { label: "Past 30 days", value: ago(60 * DAY) },
                { label: "Future", value: new Date("2026-08-22T12:00:00Z") },
              ].map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-4">
                  <span className="text-meta text-text-tertiary">{row.label}</span>
                  <DateCell value={row.value} format="relative" now={NOW} />
                </li>
              ))}
            </ul>
            <p className="text-meta text-text-tertiary">
              For comment timestamps and notification lists — never for an
              expense date. Past 30 days it gives up and returns the absolute
              date: “60 days ago” makes the reader do the arithmetic the format
              was meant to save them.
            </p>
          </Panel>
        </div>
      </Block>
    </Group>
  );
}
