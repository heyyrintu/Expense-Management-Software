import { describe, expect, it } from "vitest";
import { buildTallyXml, xmlEscape } from "@/lib/exports/tally";
import { buildLedger, type LedgerEvent } from "@/lib/domain/ledger";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const cfg = { partyLedger: "Priya & Co", expenseLedger: "Expense Reimbursements", bankLedger: "HDFC Bank" };

function sample() {
  const events: LedgerEvent[] = [
    { kind: "report_approved", id: "r1", date: d("2026-08-01"), title: "Trip <Pune>", amount: 10000 },
    { kind: "payment", id: "p1", date: d("2026-08-05"), title: "Trip pay", amount: 10000, reference: "UTR123", method: "bank_transfer", batchId: null },
  ];
  return buildLedger(events, 10000).lines;
}

describe("Tally XML structure (import format)", () => {
  const xml = buildTallyXml(sample(), cfg);

  it("has the required envelope skeleton", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    for (const tag of [
      "<ENVELOPE>", "<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>",
      "<BODY><IMPORTDATA>", "<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>",
      "<REQUESTDATA>", "</ENVELOPE>",
    ]) {
      expect(xml).toContain(tag);
    }
  });

  it("credit → Receipt voucher, debit → Payment voucher, Tally dates", () => {
    expect(xml).toContain('VCHTYPE="Receipt"');
    expect(xml).toContain('VCHTYPE="Payment"');
    expect(xml).toContain("<DATE>20260801</DATE>");
    expect(xml).toContain("<DATE>20260805</DATE>");
    expect(xml).toContain("<VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>");
  });

  it("every voucher balances: one deemed-positive (negative) + one positive entry", () => {
    const vouchers = xml.split("<VOUCHER ").slice(1);
    for (const v of vouchers) {
      const amounts = [...v.matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((m) => Number(m[1]));
      expect(amounts).toHaveLength(2);
      expect(amounts[0] + amounts[1]).toBe(0); // Dr = Cr
      expect(v).toContain("<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>");
      expect(v).toContain("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>");
    }
  });

  it("uses configurable ledger names and escapes XML", () => {
    expect(xml).toContain("<LEDGERNAME>Priya &amp; Co</LEDGERNAME>");
    expect(xml).toContain("<LEDGERNAME>HDFC Bank</LEDGERNAME>");
    expect(xml).toContain("Trip &lt;Pune&gt;");
    expect(xmlEscape(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&apos;");
  });

  it("is well-formed (tag balance sanity)", () => {
    const opens = (xml.match(/<(?!\/)(?!\?)[A-Z]+[^>]*>/g) ?? []).length;
    const closes = (xml.match(/<\/[A-Z.]+>/g) ?? []).length;
    // self-contained pairs: every opened element closes (VOUCHER attrs included)
    expect(opens).toBe(closes);
  });
});
