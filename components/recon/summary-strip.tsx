// Reconciliation summary strip (D4.2) — DESIGN-PRD §7.6.
//
// Period, matched %, unexplained amount. Three figures, and only one of them
// is allowed to shout.
//
// §7.6: "Unexplained amounts always shown in the danger token." Always, not
// "when large" — an unexplained debit is money that left the bank with no
// record in the app, and there is no threshold below which that is fine. But
// ZERO unexplained is the goal state, so at zero it goes green: a red ₹0
// would train the reader to ignore the colour, which is exactly what you
// don't want on the one figure that matters.
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { cn } from "@/lib/utils";

export function ReconSummaryStrip({
  periodStart,
  periodEnd,
  matchedPct,
  unexplained,
  currency,
  lineCount,
}: {
  /** ISO strings — DateCell parses them; never pre-formatted (D1.1). */
  periodStart: string;
  periodEnd: string;
  matchedPct: number;
  /** Integer minor units. */
  unexplained: number;
  currency: string;
  lineCount: number;
}) {
  const clean = unexplained === 0;

  return (
    <div className="border-line bg-bg-surface grid gap-4 rounded-lg border p-5 sm:grid-cols-3">
      <Cell label="Period">
        <span className="text-h3 text-text-primary flex flex-wrap items-baseline gap-1">
          <DateCell value={periodStart} />
          <span aria-hidden="true" className="text-text-tertiary">–</span>
          <DateCell value={periodEnd} />
        </span>
        <span className="text-meta text-text-tertiary tabular">
          {lineCount} debit {lineCount === 1 ? "line" : "lines"}
        </span>
      </Cell>

      <Cell label="Matched">
        <span className="text-display text-text-primary tabular">{matchedPct}%</span>
        {/* A bar, because a percentage is a proportion and the eye reads a
            proportion faster than it reads two digits. scaleX, not width. */}
        <span
          aria-hidden="true"
          className="bg-bg-subtle block h-1 w-full overflow-hidden rounded-full"
        >
          <span
            className={cn(
              "block h-full w-full origin-left rounded-full",
              matchedPct === 100 ? "bg-status-success" : "bg-accent"
            )}
            style={{ transform: `scaleX(${Math.max(0, Math.min(100, matchedPct)) / 100})` }}
          />
        </span>
      </Cell>

      <Cell label="Unexplained">
        <Amount
          value={unexplained}
          currency={currency}
          size="display"
          className={clean ? "text-status-success-text" : "text-status-danger-text"}
        />
        <span
          className={cn(
            "text-meta",
            clean ? "text-status-success-text" : "text-status-danger-text"
          )}
        >
          {clean
            ? "Every debit is accounted for."
            : "Left the bank with no record in the app."}
        </span>
      </Cell>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <span className="text-label text-text-secondary">{label}</span>
      {children}
    </div>
  );
}
