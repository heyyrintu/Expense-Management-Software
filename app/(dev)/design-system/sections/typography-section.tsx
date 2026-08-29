// Typography (D0.5 · N0.5). The full §5.3 scale with real specimen text.
//
// Specimens use product copy, not lorem ipsum: the scale has to be judged on
// the words it will actually carry. A 13px label reads differently as "Amount
// reimbursed" than as "consectetur adipiscing".
//
// The display and h1 rows render through `font-display` (Bodoni Moda, N0.3),
// exactly as their call sites must — the registry's `family` field is the
// jurisdiction, and this page is where the pairing is demonstrated.
import { cn } from "@/lib/utils";
import { TYPE_SCALE } from "@/lib/design/tokens";
import { Block, Group, Panel } from "./shared";

/** One line of real copy per role, so each size is judged on its own job. */
const SPECIMENS: Record<string, string> = {
  display: "₹12,45,600.00",
  h1: "August travel — Mumbai review",
  h2: "Awaiting reimbursement",
  h3: "Blue Tokai Coffee Roasters",
  body: "Four expenses submitted on 12 August, waiting on Priya for approval.",
  "body-strong": "₹4,500.00",
  label: "Amount reimbursed",
  meta: "Updated 2 days ago · via WhatsApp",
  eyebrow: "Awaiting reimbursement",
  micro: "99+",
};

export function TypographySection() {
  return (
    <Group
      id="typography"
      eyebrow="§5.3"
      title="Typography"
      description="Two faces, strict jurisdiction (N0.3): Bodoni Moda for display and h1, Inter for everything else — including every numeral, because Bodoni has no tabular figures. Ten roles, and the rules that govern them: at most three sizes on a screen, never bold a label and its value both, and every numeral tabular."
    >
      <Block
        title="The scale"
        description="Size, line height, weight and tracking for each role, with the copy it is meant to carry."
      >
        <div className="border-line bg-bg-surface divide-line grid divide-y rounded-lg border">
          {TYPE_SCALE.map((type) => (
            <div
              key={type.name}
              className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6"
            >
              <p className={cn(type.className, type.family === "display" && "font-display")}>
                {SPECIMENS[type.name] ?? type.role}
              </p>
              <span className="text-meta text-text-tertiary tabular sm:text-right">
                {type.className} · {type.size}/{type.lineHeight} · {type.weight} · {type.tracking}
                <br />
                {type.role}
              </span>
            </div>
          ))}
        </div>
      </Block>

      <Block
        title="Tabular numerals"
        description="Every amount uses tabular figures so digits occupy identical width. Columns line up, and a value updating in place never makes the row jitter — which matters most exactly where it is least noticed, in a table of money."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Proportional — wrong">
            {/* Same digits, different widths: the decimal points wander. */}
            <div className="grid gap-1 text-body-strong">
              {["₹1,11,111.11", "₹8,88,888.88", "₹4,00,004.00", "₹9,99,999.99"].map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
            <p className="text-meta text-text-tertiary">
              The decimal point moves from row to row. In a column of a hundred
              expenses this is the difference between scanning and reading.
            </p>
          </Panel>
          <Panel title="Tabular — the .amount utility">
            <div className="grid gap-1 text-body-strong">
              {["₹1,11,111.11", "₹8,88,888.88", "₹4,00,004.00", "₹9,99,999.99"].map((v) => (
                <span key={v} className="amount">
                  {v}
                </span>
              ))}
            </div>
            <p className="text-meta text-text-tertiary">
              Every digit the same width, so the decimals stack. This is what
              &lt;Amount&gt; will render through in D1.1.
            </p>
          </Panel>
        </div>
      </Block>

      <Block
        title="Right-aligned in tables"
        description="Amounts are right-aligned wherever they appear in a column, so the units line up regardless of magnitude."
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
              {[
                ["Blue Tokai", "₹450.00"],
                ["IndiGo", "₹14,500.00"],
                ["Uber", "₹340.50"],
                ["Taj Bengal", "₹1,08,200.00"],
              ].map(([merchant, amount]) => (
                <tr key={merchant}>
                  <td className="text-text-secondary p-3">{merchant}</td>
                  <td className="amount p-3 text-right">{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </Group>
  );
}
