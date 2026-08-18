// Monthly finance summary (PLAN 6.7).
// Schedule on the 1st:  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//   https://<host>/api/cron/monthly-summary
// Emails each org's finance admins the PREVIOUS month's key numbers + a CSV
// of that month's spend — built from the SAME lib/analytics fetch as the
// dashboards. Last-run status is stored in org settings.
import { NextResponse } from "next/server";
import { fetchSpendRows } from "@/lib/analytics";
import { violationLeaderboard } from "@/lib/analytics/aggregate";
import { buildCsv } from "@/lib/domain/dashboard";
import { prisma } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatMoney, toDecimalString } from "@/lib/money";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = start.toISOString().slice(0, 7);

  const orgs = (await prisma.organization.findMany({
    where: { status: "active" },
    select: { id: true, currency: true, settings: true },
  })) as Array<{ id: string; currency: string; settings: unknown }>;

  let emailsSent = 0;
  for (const org of orgs) {
    const db = scopedDb(org.id);
    let status = "ok";
    try {
      const rows = await fetchSpendRows(db, { start, end });
      const admins = (await db.user.findMany({
        where: { status: "active", role: { in: ["finance_admin", "org_admin"] } },
        select: { email: true },
      })) as Array<{ email: string }>;
      if (admins.length === 0 || rows.length === 0) {
        status = rows.length === 0 ? "skipped: no spend" : "skipped: no recipients";
      } else {
        const total = rows.reduce((a, r) => a + r.baseAmount, 0);
        const byCategory = new Map<string, number>();
        for (const r of rows) {
          byCategory.set(r.categoryName, (byCategory.get(r.categoryName) ?? 0) + r.baseAmount);
        }
        const topCategories = [...byCategory.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const violations = violationLeaderboard(rows);
        const violationCount = violations.byType.reduce((a, t) => a + t.count, 0);

        const csv = buildCsv(
          ["date", "merchant", "amount_base", "status", "category", "department", "project", "user", "flags"],
          rows.map((r) => [
            r.date.toISOString().slice(0, 10),
            r.merchant,
            toDecimalString(r.baseAmount),
            r.status,
            r.categoryName,
            r.departmentName ?? "",
            r.projectName ?? "",
            r.userName,
            Array.isArray(r.flags) ? r.flags.length : 0,
          ])
        );
        const fmt = (m: number) => formatMoney(m, org.currency);
        const text =
          `Monthly expense summary — ${monthLabel}\n\n` +
          `Total spend: ${fmt(total)} across ${rows.length} expenses\n` +
          `Policy violations: ${violationCount}\n\n` +
          `Top categories:\n` +
          topCategories.map(([name, amt]) => `  • ${name}: ${fmt(amt)}`).join("\n") +
          `\n\n--- CSV (${rows.length} rows) ---\n\n` +
          csv;

        for (const admin of admins) {
          await sendEmail({
            to: admin.email,
            subject: `Expense summary ${monthLabel}: ${fmt(total)}, ${violationCount} violations`,
            text,
          });
          emailsSent += 1;
        }
      }
    } catch (e) {
      status = `failed: ${e instanceof Error ? e.message : "unknown"}`;
      console.error("[monthly-summary] org failed:", org.id, e);
    }

    // last-run status in org settings (visible on /analytics)
    await db.organization.update({
      where: { id: org.id },
      data: {
        settings: {
          ...((org.settings as Record<string, unknown>) ?? {}),
          monthlySummaryLastRun: now.toISOString(),
          monthlySummaryLastStatus: status,
        },
      },
    });
  }

  return NextResponse.json({ ok: true, data: { orgs: orgs.length, emailsSent } });
}
