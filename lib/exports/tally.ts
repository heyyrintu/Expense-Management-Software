// Tally-importable XML vouchers (PLAN 7.1) — pure, structure-tested in
// tests/unit/tally-xml.test.ts.
//
// Mapping (Tally Prime "Import Data > Vouchers" format):
//   CREDIT ledger line (report approved / advance settled)
//     → Journal is typical, but per PLAN we emit a RECEIPT voucher crediting
//       the party ledger against the expense ledger.
//   DEBIT ledger line (payment / advance disbursed)
//     → PAYMENT voucher debiting the party against the bank ledger.
// Ledger names are org-configurable (settings.tallyExpenseLedger /
// settings.tallyBankLedger); the party ledger is the employee's name.
import type { LedgerLine } from "@/lib/domain/ledger";
import { toDecimalString } from "@/lib/money";

export type TallyConfig = {
  partyLedger: string; // employee name
  expenseLedger: string;
  bankLedger: string;
};

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tallyDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
}

function ledgerEntry(name: string, amountMinor: number, deemedPositive: boolean): string {
  // Tally: ISDEEMEDPOSITIVE=Yes → debit (negative amount); No → credit (positive)
  const signed = deemedPositive
    ? `-${toDecimalString(amountMinor)}`
    : toDecimalString(amountMinor);
  return (
    `<ALLLEDGERENTRIES.LIST>` +
    `<LEDGERNAME>${xmlEscape(name)}</LEDGERNAME>` +
    `<ISDEEMEDPOSITIVE>${deemedPositive ? "Yes" : "No"}</ISDEEMEDPOSITIVE>` +
    `<AMOUNT>${signed}</AMOUNT>` +
    `</ALLLEDGERENTRIES.LIST>`
  );
}

function voucher(line: LedgerLine, cfg: TallyConfig): string {
  const isCredit = line.credit > 0;
  const amount = isCredit ? line.credit : line.debit;
  const type = isCredit ? "Receipt" : "Payment";
  const narration = `${line.description}${line.reference ? ` — ${line.reference}` : ""}`;
  // Receipt: Cr party (org owes) / Dr expense.  Payment: Dr party / Cr bank.
  const entries = isCredit
    ? ledgerEntry(cfg.expenseLedger, amount, true) + ledgerEntry(cfg.partyLedger, amount, false)
    : ledgerEntry(cfg.partyLedger, amount, true) + ledgerEntry(cfg.bankLedger, amount, false);
  return (
    `<TALLYMESSAGE xmlns:UDF="TallyUDF">` +
    `<VOUCHER VCHTYPE="${type}" ACTION="Create">` +
    `<DATE>${tallyDate(line.date)}</DATE>` +
    `<VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>` +
    `<VOUCHERNUMBER>${xmlEscape(line.id.slice(0, 12))}</VOUCHERNUMBER>` +
    `<NARRATION>${xmlEscape(narration)}</NARRATION>` +
    `<PARTYLEDGERNAME>${xmlEscape(cfg.partyLedger)}</PARTYLEDGERNAME>` +
    entries +
    `</VOUCHER>` +
    `</TALLYMESSAGE>`
  );
}

export function buildTallyXml(lines: LedgerLine[], cfg: TallyConfig): string {
  const messages = lines
    .filter((l) => l.credit > 0 || l.debit > 0)
    .map((l) => voucher(l, cfg))
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ENVELOPE>` +
    `<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>` +
    `<BODY><IMPORTDATA>` +
    `<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>` +
    `<REQUESTDATA>${messages}</REQUESTDATA>` +
    `</IMPORTDATA></BODY>` +
    `</ENVELOPE>`
  );
}
