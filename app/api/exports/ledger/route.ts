// Ledger export (7.1): CSV or Tally XML, built from the SAME derivation as
// the /ledger screen. Employees export their own; finance_admin+ any user.
import { NextResponse } from "next/server";
import { fetchLedgerEvents } from "@/lib/analytics/ledger";
import { getSessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { buildCsv } from "@/lib/domain/dashboard";
import { buildLedger } from "@/lib/domain/ledger";
import { parseOrgSettings } from "@/lib/domain/org-settings";
import { scopedDb } from "@/lib/db/scoped";
import { buildTallyXml } from "@/lib/exports/tally";
import { toDecimalString } from "@/lib/money";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await getSessionCtx();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit("export", ctx.orgId)) {
    return new NextResponse(rateLimitedMessage, { status: 429 });
  }

  const url = new URL(request.url);
  const isFinance = roleAtLeast(ctx.role, "finance_admin");
  const requestedUser = url.searchParams.get("user") ?? "";
  const targetUserId = isFinance && requestedUser ? requestedUser : ctx.userId;
  const fromS = url.searchParams.get("from");
  const toS = url.searchParams.get("to");
  const format = url.searchParams.get("format") === "tally" ? "tally" : "csv";

  const db = scopedDb(ctx.orgId);
  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true },
  });
  if (!target) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  const { events, requested } = await fetchLedgerEvents(db, target.id, {
    from: fromS ? new Date(`${fromS}T00:00:00.000Z`) : undefined,
    to: toS ? new Date(`${toS}T23:59:59.999Z`) : undefined,
  });
  const { lines, totals } = buildLedger(events, requested);

  if (format === "tally") {
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const settings = parseOrgSettings(org.settings);
    const xml = buildTallyXml(lines, {
      partyLedger: target.name,
      expenseLedger: settings.tallyExpenseLedger ?? "Expense Reimbursements",
      bankLedger: settings.tallyBankLedger ?? "Bank",
    });
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger-${target.name.replace(/\W+/g, "-")}.xml"`,
      },
    });
  }

  const csv = buildCsv(
    ["date", "type", "description", "reference", "credit", "debit", "balance"],
    [
      ...lines.map((l) => [
        l.date.toISOString().slice(0, 10),
        l.type,
        l.description,
        l.reference,
        l.credit ? toDecimalString(l.credit) : "",
        l.debit ? toDecimalString(l.debit) : "",
        toDecimalString(l.balance),
      ]),
      ["", "totals", `requested ${toDecimalString(totals.requested)}`, `approved ${toDecimalString(totals.approved)}`, `paid ${toDecimalString(totals.paid)}`, `outstanding ${toDecimalString(totals.outstanding)}`, toDecimalString(totals.netBalance)],
    ]
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-${target.name.replace(/\W+/g, "-")}.csv"`,
    },
  });
}
