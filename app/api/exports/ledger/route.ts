// Ledger export (PLAN 7.1, entity rollups D4.1): CSV or Tally XML.
//
// ── SAME DERIVATION AS THE SCREEN, NOT A MATCHING ONE ─────────────────────
// This route calls `resolveLedgerEntity` → `fetchEntityLedger` → `buildLedger`
// with a window from `parseLedgerWindow`, which is exactly what
// app/(app)/ledger/page.tsx does. It computes no total of its own, applies no
// date arithmetic of its own, and repeats no authorization logic of its own —
// `resolveLedgerEntity` forces anyone below finance_admin back to their own
// user ledger, so a hand-written `?entity=department&id=…` from an employee
// exports their personal statement rather than the department's.
//
// tests/isolation/ledger-export.test.ts runs both paths and compares every
// line and every total.
// ──────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";

import { getSessionCtx } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { fetchEntityLedger, resolveLedgerEntity } from "@/lib/analytics/ledger-entity";
import { buildCsv } from "@/lib/domain/dashboard";
import { buildLedger } from "@/lib/domain/ledger";
import { parseLedgerWindow } from "@/lib/domain/ledger-params";
import { parseOrgSettings } from "@/lib/domain/org-settings";
import { buildTallyXml } from "@/lib/exports/tally";
import { toDecimalString } from "@/lib/money";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Search params as the shared parsers expect them. */
function toRecord(url: URL): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) out[key] = value;
  return out;
}

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await getSessionCtx();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit("export", ctx.orgId))) {
    return new NextResponse(rateLimitedMessage, { status: 429 });
  }

  const url = new URL(request.url);
  const raw = toRecord(url);
  const format = url.searchParams.get("format") === "tally" ? "tally" : "csv";

  // `?user=` was the pre-D4.1 contract, and old links live in bookmarks and
  // email. Accepting it costs two lines and keeps them working.
  const legacyUser = url.searchParams.get("user");
  const entityRaw = legacyUser
    ? { entity: "user", id: legacyUser }
    : { entity: raw.entity, id: raw.id };

  const db = scopedDb(ctx.orgId);
  const entity = await resolveLedgerEntity(db, ctx, entityRaw);
  if (!entity) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const window = parseLedgerWindow(raw);
  const { events, requested } = await fetchEntityLedger(db, entity, window);
  const { lines, totals } = buildLedger(events, requested);

  const slug = entity.name.replace(/\W+/g, "-").toLowerCase();

  if (format === "tally") {
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const settings = parseOrgSettings(org.settings);
    const xml = buildTallyXml(lines, {
      // For a rollup the "party" is the project or department — Tally takes
      // any ledger name here, and importing a project rollup against the
      // employee's personal ledger would be worse than useless.
      partyLedger: entity.name,
      expenseLedger: settings.tallyExpenseLedger ?? "Expense Reimbursements",
      bankLedger: settings.tallyBankLedger ?? "Bank",
    });
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger-${entity.kind}-${slug}.xml"`,
      },
    });
  }

  const csv = buildCsv(
    ["date", "type", "description", "reference", "debit", "credit", "balance"],
    [
      ...lines.map((l) => [
        l.date.toISOString().slice(0, 10),
        l.type,
        l.description,
        l.reference,
        l.debit ? toDecimalString(l.debit) : "",
        l.credit ? toDecimalString(l.credit) : "",
        toDecimalString(l.balance),
      ]),
      // The totals row carries the same four figures the sticky footer shows,
      // labelled, so a spreadsheet reader can reconcile against the screen
      // without recomputing anything.
      [
        "",
        "totals",
        `requested ${toDecimalString(totals.requested)}`,
        `approved ${toDecimalString(totals.approved)}`,
        `paid ${toDecimalString(totals.paid)}`,
        `outstanding ${toDecimalString(totals.outstanding)}`,
        toDecimalString(totals.netBalance),
      ],
    ]
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-${entity.kind}-${slug}.csv"`,
    },
  });
}
