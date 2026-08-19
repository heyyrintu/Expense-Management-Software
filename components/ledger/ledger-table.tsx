// LedgerTable (D4.1) — DESIGN-PRD §7.5, "dense but airy".
//
// ── WHY THIS IS NOT components/data-table ─────────────────────────────────
// The DataTable rule has one other sanctioned exception (the approval queue,
// §7.3) and this is the second. A ledger is not a list of records you sort,
// filter, select and page: it is a STATEMENT, read top to bottom, whose rows
// are meaningless out of order because each one carries the running balance
// produced by the row above it. Sorting it by amount would destroy the only
// column that matters. It also has to print, and TanStack's virtualisation
// and client paging both fight a printer.
//
// So: a plain semantic <table>, sticky <thead>, sticky <tfoot>, and the same
// tokens every other surface uses.
//
// Alternating rows are `--bg-subtle` at 40% (§7.5) — enough to keep the eye
// on a line across six columns, far short of zebra striping, which turns a
// dense table into a barcode.
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import type { LedgerLine, LedgerTotals } from "@/lib/domain/ledger";
import { cn } from "@/lib/utils";

export const LEDGER_TYPE_LABELS: Record<LedgerLine["type"], string> = {
  report_approved: "Report approved",
  payment: "Payment",
  advance_disbursed: "Advance disbursed",
  advance_settled: "Advance settled",
};

export function LedgerTable({
  lines,
  totals,
  currency,
  emptyMessage = "No ledger activity in this period.",
}: {
  lines: LedgerLine[];
  totals: LedgerTotals;
  currency: string;
  emptyMessage?: string;
}) {
  return (
    <div
      className={cn(
        "border-line bg-bg-surface overflow-x-auto rounded-lg border",
        // The scroll container is what makes position:sticky work vertically,
        // and it is removed for print so the table can break across pages.
        "max-h-ledger overflow-y-auto",
        "print:max-h-none print:overflow-visible print:rounded-none print:border-0"
      )}
    >
      <table className="ledger-table w-full border-collapse text-body">
        <caption className="sr-only">
          Ledger entries in date order, with a running balance after each line.
        </caption>

        <thead className="bg-bg-subtle text-text-secondary sticky top-0 z-10">
          <tr className="text-label">
            <th scope="col" className="p-3 text-left font-medium">Date</th>
            <th scope="col" className="p-3 text-left font-medium">Particulars</th>
            <th scope="col" className="p-3 text-right font-medium">Debit</th>
            <th scope="col" className="p-3 text-right font-medium">Credit</th>
            <th scope="col" className="p-3 text-right font-medium">Balance</th>
          </tr>
        </thead>

        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-text-secondary p-6 text-center">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr
                key={line.id}
                className={cn(
                  "border-line border-t align-top",
                  // 40%, not a solid fill. Printed, it drops out entirely —
                  // a grey band costs toner and buys nothing on paper.
                  index % 2 === 1 && "ledger-row-alt print:bg-transparent"
                )}
              >
                <td className="p-3 whitespace-nowrap">
                  {/* Absolute, never relative: this is a column somebody
                      compares against a bank statement (CLAUDE.md). */}
                  <DateCell value={line.date} />
                </td>
                <td className="p-3">
                  <span className="grid gap-0.5">
                    <span className="text-text-primary">
                      <span className="font-medium">{LEDGER_TYPE_LABELS[line.type]}</span>
                      {" · "}
                      {line.description}
                    </span>
                    {line.reference ? (
                      // Tabular: a UTR is read character by character against
                      // a statement, so the digits must line up.
                      <span className="text-meta text-text-tertiary tabular">
                        {line.reference}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {line.debit ? (
                    <Amount value={line.debit} currency={currency} align="right" />
                  ) : (
                    <span className="text-text-tertiary" aria-hidden="true">
                      —
                    </span>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {line.credit ? (
                    <Amount value={line.credit} currency={currency} align="right" />
                  ) : (
                    <span className="text-text-tertiary" aria-hidden="true">
                      —
                    </span>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <BalanceCell value={line.balance} currency={currency} />
                </td>
              </tr>
            ))
          )}
        </tbody>

        {/*
          Sticky totals. §7.5 asks for both ends pinned, and the footer is the
          half that earns it: the four figures a reader came for should be
          visible while they scroll the lines that produced them, not waiting
          at the bottom of two hundred rows.
        */}
        <tfoot className="bg-bg-subtle border-line sticky bottom-0 z-10 border-t-2 print:static">
          <tr>
            <td colSpan={2} className="p-3">
              <span className="text-label text-text-secondary">Totals</span>
            </td>
            <td colSpan={3} className="p-3">
              <span className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-2">
                <TotalItem label="Requested" value={totals.requested} currency={currency} />
                <TotalItem label="Approved" value={totals.approved} currency={currency} />
                <TotalItem label="Paid" value={totals.paid} currency={currency} />
                <TotalItem
                  label="Outstanding"
                  value={totals.outstanding}
                  currency={currency}
                  emphasis
                />
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * The balance column: semibold, tabular, negatives in the danger token.
 *
 * A negative balance means the EMPLOYEE owes the organisation — usually an
 * unsettled advance. That is not a neutral fact and not an error either, so
 * it takes the danger colour and keeps the ordinary minus sign; inventing a
 * parenthesised accounting notation here would be a second convention nobody
 * asked for.
 */
function BalanceCell({ value, currency }: { value: number; currency: string }) {
  return (
    <Amount
      value={value}
      currency={currency}
      align="right"
      className={cn(
        "font-semibold",
        value < 0 && "text-status-danger-text"
      )}
    />
  );
}

function TotalItem({
  label,
  value,
  currency,
  emphasis = false,
}: {
  label: string;
  value: number;
  currency: string;
  emphasis?: boolean;
}) {
  return (
    <span className="grid justify-items-end gap-0.5">
      <span className="text-meta text-text-tertiary">{label}</span>
      <Amount
        value={value}
        currency={currency}
        align="right"
        className={cn(
          "font-semibold",
          // Outstanding is the figure the screen exists to produce, and a
          // negative one is money flowing the other way.
          emphasis && value < 0 && "text-status-danger-text"
        )}
      />
    </span>
  );
}
