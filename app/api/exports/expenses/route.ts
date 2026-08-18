// CSV export (route handlers are reserved for uploads/webhooks/exports).
// Uses the SAME scope resolver + where builder as the dashboard, so the
// file always reconciles with what's on screen.
import { NextResponse } from "next/server";
import { getSessionCtx } from "@/lib/auth/guard";
import { buildCsv } from "@/lib/domain/dashboard";
import { buildExpenseWhere } from "@/lib/domain/expense-query";
import { resolveExpenseScope } from "@/lib/domain/expense-scope";
import { scopedDb } from "@/lib/db/scoped";
import { toDecimalString } from "@/lib/money";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { parseFilters } from "@/lib/schemas/dashboard";

export const runtime = "nodejs";

type ExportRow = {
  date: Date;
  merchant: string;
  amount: number;
  currency: string;
  status: string;
  purpose: string;
  flags: unknown;
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
  const filters = parseFilters(Object.fromEntries(url.searchParams.entries()));

  const db = scopedDb(ctx.orgId);
  const scope = await resolveExpenseScope(db, ctx);
  const rows = (await db.expense.findMany({
    where: buildExpenseWhere(scope, filters),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 10000,
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
    },
  })) as ExportRow[];

  const csv = buildCsv(
    [
      "date",
      "merchant",
      "amount",
      "currency",
      "status",
      "category",
      "project",
      "user",
      "email",
      "department",
      "report",
      "purpose",
      "flags",
    ],
    rows.map((e) => [
      e.date.toISOString().slice(0, 10),
      e.merchant,
      toDecimalString(e.amount),
      e.currency,
      e.status,
      e.category.name,
      e.project?.name ?? "",
      e.user.name,
      e.user.email,
      e.user.department?.name ?? "",
      e.report?.title ?? "",
      e.purpose,
      Array.isArray(e.flags) ? e.flags.length : 0,
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
