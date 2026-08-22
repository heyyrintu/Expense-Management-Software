// Tally Prime — XML vouchers, behind the adapter interface. PURE.
//
// ── THE EXISTING WRITER IS REUSED, NOT REWRITTEN ──────────────────────────
// `lib/exports/tally.ts` has shipped since 7.1 and is structure-tested in
// tests/unit/tally-xml.test.ts. This file adapts REPORTS into the ledger
// lines that writer already takes, and calls it. Reimplementing the XML here
// would fork a format two tests and a production integration depend on, to
// gain nothing.
//
// ── WHY TALLY NEEDS NO MAPPING ────────────────────────────────────────────
// Tally posts against LEDGER NAMES, not account codes, and the names are
// already org settings (`tallyExpenseLedger` / `tallyBankLedger`), with the
// party ledger being the employee's own name. So `requiredEntities` is empty
// and the unmapped warning correctly stays silent for this target — a warning
// that fires when nothing is wrong is a warning people learn to click past.
import { buildTallyXml } from "@/lib/exports/tally";
import type {
  AccountingAdapter,
  AccountingArtifact,
  AdapterConfig,
  ExportableReport,
  LedgerLine,
  MappingIndex,
} from "../types";

/**
 * One approved report → one CREDIT ledger line (the org owes the employee).
 *
 * `balance` is zero because the existing writer does not read it — it emits
 * vouchers, not a statement. Passing a computed running balance would imply
 * this export carries one, and the ledger screen is where that lives.
 */
export function reportsToLedgerLines(reports: ExportableReport[]): LedgerLine[] {
  return reports.map((report) => ({
    id: report.id,
    date: report.submittedAt,
    type: "report_approved" as LedgerLine["type"],
    description: report.title,
    reference: report.userName,
    credit: report.totalMinor,
    debit: 0,
    balance: 0,
  }));
}

function buildTallyExport(
  reports: ExportableReport[],
  _mapping: MappingIndex,
  config: AdapterConfig
): AccountingArtifact {
  // Tally's party ledger is per-employee, and one XML can carry vouchers for
  // several. The existing writer takes ONE party per call, so reports are
  // grouped by employee and the fragments concatenated — which is why this
  // builds per-user and joins, rather than making one call.
  const byUser = new Map<string, ExportableReport[]>();
  for (const r of reports) {
    const list = byUser.get(r.userName);
    if (list) list.push(r);
    else byUser.set(r.userName, [r]);
  }

  const parts: string[] = [];
  let totalMinor = 0;
  let lineCount = 0;
  for (const [partyLedger, group] of byUser) {
    parts.push(
      buildTallyXml(reportsToLedgerLines(group), {
        partyLedger,
        expenseLedger: config.expenseLedger,
        bankLedger: config.bankLedger,
      })
    );
    for (const r of group) totalMinor += r.totalMinor;
    lineCount += group.length;
  }

  // Each call returns a complete ENVELOPE. Tally accepts one envelope per
  // file, so a multi-party export merges their REQUESTDATA bodies rather than
  // concatenating envelopes — which Tally would reject as trailing content.
  const bodies = parts
    .map((xml) => {
      const open = xml.indexOf("<REQUESTDATA>") + "<REQUESTDATA>".length;
      const close = xml.indexOf("</REQUESTDATA>");
      return open > 0 && close > open ? xml.slice(open, close) : "";
    })
    .join("");

  const content =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ENVELOPE>` +
    `<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>` +
    `<BODY><IMPORTDATA>` +
    `<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>` +
    `<REQUESTDATA>${bodies}</REQUESTDATA>` +
    `</IMPORTDATA></BODY>` +
    `</ENVELOPE>`;

  return {
    filename: `tally-vouchers-${new Date().toISOString().slice(0, 10)}.xml`,
    mimeType: "application/xml; charset=utf-8",
    content,
    lineCount,
    totalMinor,
  };
}

export const tallyAdapter: AccountingAdapter = {
  target: "tally",
  label: "Tally Prime",
  description: "Voucher XML. Import via Gateway of Tally → Import Data → Vouchers.",
  // Posts against org-level ledger NAMES, not per-entity codes. See above.
  requiredEntities: [],
  buildExport: buildTallyExport,
};
