// CSV export (route handlers are reserved for uploads/webhooks/exports).
//
// ── SAME DERIVATION AS THE SCREEN, NOT A MATCHING ONE ─────────────────────
// This route calls `resolveExpenseListQuery` — the same function
// app/(app)/expenses/page.tsx calls — and sorts by `EXPENSE_LIST_ORDER`, the
// same total order the list pages through. It parses no filters of its own
// and builds no where-clause of its own, which is the only way "export what
// I am looking at" stays true as either side changes.
//
// It used to do both itself, against the single-valued dashboard schema, and
// silently returned a different set: `q` dropped, multi-select truncated to
// its first value, `?scope=` ignored, delegation ignored. See the header of
// lib/domain/expense-list-query.ts for the full list, and
// tests/isolation/expense-export.test.ts for the proof that it no longer
// happens.
// ──────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { resolveActing } from "@/lib/auth/acting";
import { getSessionCtx } from "@/lib/auth/guard";
import { buildCsv } from "@/lib/domain/dashboard";
import { EXPENSE_LIST_ORDER } from "@/lib/domain/expense-query";
import {
  resolveExpenseListQuery,
  EXPENSE_EXPORT_MAX_ROWS,
} from "@/lib/domain/expense-list-query";
import { scopedDb } from "@/lib/db/scoped";
import { toDecimalString } from "@/lib/money";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { searchParamsToRecord } from "@/lib/schemas/expense-filters";

export const runtime = "nodejs";

type ExportRow = {
  date: Date;
  merchant: string;
  amount: number;
  baseAmount: number;
  fxRate: string;
  currency: string;
  status: string;
  purpose: string;
  flags: unknown;
  billable: boolean;
  taxAmount: number | null;
  taxNumber: string | null;
  client: { name: string } | null;
  user: { name: string; email: string; department: { name: string } | null };
  category: { name: string };
  project: { name: string } | null;
  report: { title: string } | null;
};

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await getSessionCtx();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit("export", ctx.orgId)) {
    return new NextResponse(rateLimitedMessage, { status: 429 });
  }

  const url = new URL(request.url);
  const db = scopedDb(ctx.orgId);
  const acting = await resolveActing(ctx);
  // searchParamsToRecord, not Object.fromEntries: repeated keys are how a
  // multi-select travels, and fromEntries keeps only the last one — which is
  // precisely how this route used to export one status out of three.
  const { where } = await resolveExpenseListQuery(
    db,
    ctx,
    acting,
    searchParamsToRecord(url.searchParams)
  );

  const rows = (await db.expense.findMany({
    where,
    orderBy: EXPENSE_LIST_ORDER,
    take: EXPENSE_EXPORT_MAX_ROWS,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          department: { select: { name: true } },
        },
      },
      category: { select: { name: true } },
      project: { select: { name: true } },
      report: { select: { title: true } },
      client: { select: { name: true } },
    },
  })) as ExportRow[];

  const csv = buildCsv(
    [
      "date",
      "merchant",
      "amount",
      "currency",
      "fx_rate",
      "base_amount",
      "status",
      "category",
      "project",
      "user",
      "email",
      "department",
      "report",
      "purpose",
      "flags",
      "billable",
      "client",
      "tax_amount",
      "tax_number",
    ],
    rows.map((e) => [
      e.date.toISOString().slice(0, 10),
      e.merchant,
      toDecimalString(e.amount),
      e.currency,
      e.fxRate,
      toDecimalString(e.baseAmount),
      e.status,
      e.category.name,
      e.project?.name ?? "",
      e.user.name,
      e.user.email,
      e.user.department?.name ?? "",
      e.report?.title ?? "",
      e.purpose,
      Array.isArray(e.flags) ? e.flags.length : 0,
      e.billable ? "yes" : "no",
      e.client?.name ?? "",
      e.taxAmount !== null ? toDecimalString(e.taxAmount) : "",
      e.taxNumber ?? "",
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
