// QuickBooks Online — journal-entry CSV. PURE.
//
// ── THE COLUMN SPEC ───────────────────────────────────────────────────────
// QuickBooks Online imports journal entries from a CSV with these columns, in
// this order. This is QBO's own "Import journal entries" template; IIF is the
// old QuickBooks DESKTOP format and is deliberately not used.
//
//   JournalNo    Groups rows into one entry. Every row of a report shares it.
//   JournalDate  MM/DD/YYYY. QBO parses US order regardless of locale here.
//   Currency     ISO 4217. One currency per entry.
//   AccountName  The GL account. THIS is what the mapping supplies.
//   Debits       Positive decimal, or blank on a credit row.
//   Credits      Positive decimal, or blank on a debit row.
//   Description  Free text, shown on the register line.
//   Name         Customer/Vendor/Employee the line is attributed to.
//   Location     Optional class/location dimension — department.
//   Class        Optional second dimension — project.
//
// Exactly one of Debits/Credits carries a value per row; QBO rejects a row
// with both, and silently imports a row with neither as zero.
//
// ── THE ENTRY SHAPE ───────────────────────────────────────────────────────
// One journal entry per REPORT, which is the unit finance approves and pays:
//
//   Dr  <category's GL account>   per expense line
//   Cr  <employee's payable account>  once, for the report total
//
// The credit is the report's OWN total, not the sum of the lines it carries.
// Those are the same number in every correct case — and when they are not,
// the report total is what was approved and paid, so it is the figure the
// ledger must agree with. `buildExport` asserts they match rather than
// silently emitting an unbalanced entry, because QBO would reject the whole
// file with an error naming a row number and nothing else.
import { buildCsv } from "@/lib/domain/dashboard";
import { toDecimalString } from "@/lib/money";
import { requireCode } from "../mapping";
import type {
  AccountingAdapter,
  AccountingArtifact,
  AdapterConfig,
  ExportableReport,
  MappingIndex,
} from "../types";

export const QBO_COLUMNS = [
  "JournalNo",
  "JournalDate",
  "Currency",
  "AccountName",
  "Debits",
  "Credits",
  "Description",
  "Name",
  "Location",
  "Class",
] as const;

/** MM/DD/YYYY — QBO's import parser expects US order in this template. */
function qboDate(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

/**
 * A short, stable journal number.
 *
 * Derived from the report id rather than a counter: two exports of the same
 * report must carry the same JournalNo so QBO treats the second as a
 * re-import of one entry rather than as a second entry doubling the expense.
 * The double-export guard already makes that deliberate; this makes it safe
 * when it happens.
 */
export function journalNo(reportId: string): string {
  return `EXP-${reportId.replace(/-/g, "").slice(-10).toUpperCase()}`;
}

function buildQboExport(
  reports: ExportableReport[],
  mapping: MappingIndex,
  config: AdapterConfig
): AccountingArtifact {
  const rows: Array<Array<string | number>> = [];
  let totalMinor = 0;

  for (const report of reports) {
    const no = journalNo(report.id);
    const date = qboDate(report.submittedAt);
    const payable = requireCode(
      mapping,
      "user",
      report.userId,
      report.userName
    );

    let lineSum = 0;
    for (const line of report.lines) {
      const account = requireCode(
        mapping,
        "category",
        line.categoryId,
        line.categoryName
      );
      // Dimensions are optional in QBO and optional here: an unmapped one
      // that is not in the adapter's requiredEntities is written blank rather
      // than blocking the export or inventing a code.
      const location = line.departmentId
        ? (mapping.get("department", line.departmentId)?.remoteCode ?? "")
        : "";
      const klass = line.projectId
        ? (mapping.get("project", line.projectId)?.remoteCode ?? "")
        : "";

      lineSum += line.amountMinor;
      rows.push([
        no,
        date,
        config.currency,
        account,
        toDecimalString(line.amountMinor), // Debits
        "", // Credits
        `${line.merchant}${line.purpose ? ` — ${line.purpose}` : ""}`,
        report.userName,
        location,
        klass,
      ]);
    }

    // An entry whose debits do not equal its credit is one QBO rejects with a
    // row number and no explanation. Catching it here names the report.
    if (lineSum !== report.totalMinor) {
      throw new Error(
        `Cannot export "${report.title}": its expense lines total ` +
          `${toDecimalString(lineSum)} but the report total is ` +
          `${toDecimalString(report.totalMinor)}. The journal entry would not balance.`
      );
    }

    rows.push([
      no,
      date,
      config.currency,
      payable,
      "", // Debits
      toDecimalString(report.totalMinor), // Credits
      `Reimbursement payable — ${report.title}`,
      report.userName,
      "",
      "",
    ]);
    totalMinor += report.totalMinor;
  }

  return {
    filename: `quickbooks-journal-${new Date().toISOString().slice(0, 10)}.csv`,
    mimeType: "text/csv; charset=utf-8",
    // buildCsv is the Excel-injection-safe writer already used by the ledger
    // and expense exports — a merchant called "=cmd|..." is neutralised there,
    // and reusing it means this adapter cannot be the one that forgets.
    content: buildCsv([...QBO_COLUMNS], rows),
    lineCount: rows.length,
    totalMinor,
  };
}

export const quickbooksAdapter: AccountingAdapter = {
  target: "quickbooks",
  label: "QuickBooks Online",
  description:
    "Journal-entry CSV. Import via Settings → Import Data → Journal Entries.",
  // A journal entry cannot be written without a GL account per category and a
  // payable account per employee. Department and project map to optional QBO
  // dimensions, so they are not required — an unmapped one writes blank.
  requiredEntities: ["category", "user"],
  buildExport: buildQboExport,
};
