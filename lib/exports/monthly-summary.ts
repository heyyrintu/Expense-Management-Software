// The monthly summary document (PLAN 6.7 / G3) — PURE.
//
// Pulled out of the cron route so the layout is testable without a database,
// a clock or an SMTP server. The route fetches; this decides what the page
// says.
import { buildPdf, asciiMoney, type PdfLine } from "./pdf";

export type MonthlySummary = {
  /** "2026-07" — the month being reported, not the month it was sent. */
  monthLabel: string;
  orgCurrency: string;
  totalMinor: number;
  expenseCount: number;
  violationCount: number;
  /** Highest first. */
  topCategories: Array<{ name: string; totalMinor: number }>;
  /** Already formatted by lib/money — this module does no money maths. */
  formatMoney: (minor: number) => string;
};

/** Percentage of the month's spend, to one decimal. Presentational only. */
function share(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/**
 * The email body.
 *
 * Now a SUMMARY, not a summary plus a pasted spreadsheet. The CSV moved to a
 * real attachment: 300 rows of comma-separated text in a message body is a
 * wall nobody scrolls, and it made the numbers above it harder to find rather
 * than better supported.
 */
export function buildSummaryEmailText(summary: MonthlySummary): string {
  const { formatMoney: fmt } = summary;
  const lines = [
    `Monthly expense summary — ${summary.monthLabel}`,
    "",
    `Total spend:       ${fmt(summary.totalMinor)} across ${summary.expenseCount} expenses`,
    `Policy violations: ${summary.violationCount}`,
    "",
    "Top categories:",
    ...summary.topCategories.map(
      (c) =>
        `  • ${c.name}: ${fmt(c.totalMinor)} (${share(c.totalMinor, summary.totalMinor)})`
    ),
    "",
    "Attached: a one-page PDF summary and the full CSV for the month.",
  ];
  return lines.join("\n");
}

/** The one-page PDF. Same numbers, same order, as the email body. */
export function buildSummaryPdf(summary: MonthlySummary): Buffer {
  const money = (minor: number) =>
    asciiMoney(summary.formatMoney(minor), summary.orgCurrency);

  const lines: PdfLine[] = [
    { kind: "heading", text: "Monthly expense summary" },
    { kind: "meta", text: summary.monthLabel },
    { kind: "rule" },

    { kind: "subheading", text: "Headline" },
    { kind: "row", label: "Total spend", value: money(summary.totalMinor) },
    { kind: "row", label: "Expenses", value: String(summary.expenseCount) },
    { kind: "row", label: "Policy violations", value: String(summary.violationCount) },
    { kind: "gap", size: 8 },
    { kind: "rule" },

    { kind: "subheading", text: "Top categories" },
  ];

  if (summary.topCategories.length === 0) {
    lines.push({ kind: "body", text: "No spend in this period." });
  } else {
    for (const c of summary.topCategories) {
      lines.push({
        kind: "row",
        label: `${c.name}  (${share(c.totalMinor, summary.totalMinor)})`,
        value: money(c.totalMinor),
      });
    }
  }

  lines.push(
    { kind: "gap", size: 14 },
    { kind: "rule" },
    {
      kind: "meta",
      // The provenance line. A number in an emailed PDF is worth exactly as
      // much as the reader's ability to check it, so say where to.
      text:
        "Figures cover expenses submitted in the period shown, in the organisation's base currency. " +
        "The attached CSV is the same set, row by row.",
    },
    {
      kind: "meta",
      text:
        "Currency is written as an ISO code rather than a symbol — see lib/exports/pdf.ts.",
    }
  );

  return buildPdf(lines);
}

/** Attachment filenames, derived once so the PDF and CSV agree. */
export function summaryFilenames(monthLabel: string): {
  pdf: string;
  csv: string;
} {
  return {
    pdf: `expense-summary-${monthLabel}.pdf`,
    csv: `expense-detail-${monthLabel}.csv`,
  };
}
