// Generic accounting CSV — the long tail. PURE.
//
// Zoho Books, Sage 50, a bookkeeper's spreadsheet: systems whose import
// format we do not model, whose operator will map columns by hand anyway.
// So this emits ONE flat row per expense with everything a general ledger
// could want, and no vendor dialect at all.
//
// It requires a category code like QuickBooks does — the whole point of an
// accounting export is which account a cost lands in, and a file without
// that is the CSV export we already had on /expenses.
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

export const GENERIC_COLUMNS = [
  "ReportId",
  "ReportTitle",
  "Date",
  "Employee",
  "EmployeeEmail",
  "AccountCode",
  "CategoryName",
  "DepartmentCode",
  "ProjectCode",
  "Merchant",
  "Description",
  "Currency",
  "Amount",
  "TaxAmount",
] as const;

function buildGenericExport(
  reports: ExportableReport[],
  mapping: MappingIndex,
  config: AdapterConfig
): AccountingArtifact {
  const rows: Array<Array<string | number>> = [];
  let totalMinor = 0;

  for (const report of reports) {
    const date = report.submittedAt.toISOString().slice(0, 10);
    for (const line of report.lines) {
      rows.push([
        report.id,
        report.title,
        date,
        report.userName,
        report.userEmail,
        requireCode(mapping, "category", line.categoryId, line.categoryName),
        line.categoryName,
        line.departmentId
          ? (mapping.get("department", line.departmentId)?.remoteCode ?? "")
          : "",
        line.projectId
          ? (mapping.get("project", line.projectId)?.remoteCode ?? "")
          : "",
        line.merchant,
        line.purpose,
        config.currency,
        toDecimalString(line.amountMinor),
        line.taxMinor !== null ? toDecimalString(line.taxMinor) : "",
      ]);
      totalMinor += line.amountMinor;
    }
  }

  return {
    filename: `accounting-export-${new Date().toISOString().slice(0, 10)}.csv`,
    mimeType: "text/csv; charset=utf-8",
    content: buildCsv([...GENERIC_COLUMNS], rows),
    lineCount: rows.length,
    totalMinor,
  };
}

export const genericAdapter: AccountingAdapter = {
  target: "generic",
  label: "Generic CSV",
  description: "One row per expense, with account codes. Map the columns in your system.",
  requiredEntities: ["category"],
  buildExport: buildGenericExport,
};
