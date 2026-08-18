// Recurring-expense drafting job (PLAN 6.5).
// Schedule daily:  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//   https://<host>/api/cron/recurring
// Duplicate-safe: last_run_at is compared against the latest scheduled
// occurrence (lib/domain/recurring), so re-runs and missed days are safe.
import { NextResponse } from "next/server";
import { computeExpenseFlags } from "@/lib/domain/policy-eval";
import { isDue, type Cadence } from "@/lib/domain/recurring";
import { prisma } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { sendEmail } from "@/lib/notifications/email";
import { formatMoney } from "@/lib/money";

export const runtime = "nodejs";

const AUTO_FLAG = {
  rule: "auto_created",
  message: "Auto-created from a recurring template — review before submitting.",
};

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const orgs = (await prisma.organization.findMany({
    where: { status: "active" },
    select: { id: true, currency: true },
  })) as Array<{ id: string; currency: string }>;

  let drafted = 0;
  let checked = 0;

  for (const org of orgs) {
    const db = scopedDb(org.id);
    const templates = (await db.recurringTemplate.findMany({
      where: { active: true, user: { status: "active" } },
      include: { user: { select: { id: true, email: true } } },
    })) as Array<{
      id: string;
      userId: string;
      cadence: Cadence;
      day: number;
      amount: number;
      categoryId: string;
      merchant: string;
      purpose: string;
      lastRunAt: Date | null;
      user: { id: string; email: string };
    }>;

    for (const tpl of templates) {
      checked += 1;
      const due = isDue(tpl, now);
      if (!due.due) continue;

      // category may have been deleted — skip quietly, keep the template
      const category = await db.category.findUnique({ where: { id: tpl.categoryId } });
      if (!category) continue;

      const policyFlags = await computeExpenseFlags(db, org.id, {
        expenseId: null,
        userId: tpl.userId,
        amount: tpl.amount,
        baseAmount: tpl.amount, // templates are org-currency
        date: due.occurrence,
        merchant: tpl.merchant,
        categoryId: tpl.categoryId,
        receiptCount: 0,
      });

      const expense = await db.expense.create({
        data: {
          orgId: org.id,
          userId: tpl.userId,
          amount: tpl.amount,
          baseAmount: tpl.amount,
          fxRate: "1",
          currency: org.currency,
          date: due.occurrence,
          merchant: tpl.merchant,
          categoryId: tpl.categoryId,
          purpose: tpl.purpose,
          flags: [AUTO_FLAG, ...policyFlags],
        },
      });
      await db.recurringTemplate.update({
        where: { id: tpl.id },
        data: { lastRunAt: due.occurrence },
      });
      await db.auditLog.create({
        data: {
          orgId: org.id,
          entity: "Expense",
          entityId: expense.id,
          actorId: null, // system action
          action: "expense.auto_created",
          meta: { templateId: tpl.id, occurrence: due.occurrence.toISOString() },
        },
      });
      try {
        const title = "Recurring expense drafted";
        const body = `${tpl.merchant} — ${formatMoney(tpl.amount, org.currency)} was drafted from your recurring template. Review it before adding to a report.`;
        await db.notification.create({
          data: {
            orgId: org.id,
            userId: tpl.userId,
            type: "recurring.drafted",
            title,
            body,
            link: `/expenses/${expense.id}`,
          },
        });
        await sendEmail({ to: tpl.user.email, subject: title, text: body });
      } catch (e) {
        console.error("[recurring] notify failed:", e);
      }
      drafted += 1;
    }
  }

  return NextResponse.json({ ok: true, data: { orgs: orgs.length, checked, drafted } });
}
