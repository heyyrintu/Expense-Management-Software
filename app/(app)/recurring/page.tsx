import Link from "next/link";

import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { RecurringPanel, type TemplateView } from "./recurring-panel";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type TplRow = {
  id: string;
  cadence: "monthly" | "weekly";
  day: number;
  amount: number;
  merchant: string;
  purpose: string;
  active: boolean;
  lastRunAt: Date | null;
  category: { name: string };
};

export default async function RecurringPage() {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const [org, templates, categories] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.recurringTemplate.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "asc" },
      include: { category: { select: { name: true } } },
    }) as Promise<TplRow[]>,
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const views: TemplateView[] = templates.map((t) => ({
    id: t.id,
    schedule:
      t.cadence === "monthly"
        ? `Monthly on day ${t.day}`
        : `Weekly on ${WEEKDAYS[t.day - 1]}`,
    // Raw minor units + currency cross the boundary; the panel renders them
    // through <Amount> rather than receiving a pre-formatted string.
    amount: t.amount,
    currency: org.currency,
    merchant: t.merchant,
    category: t.category.name,
    active: t.active,
    lastRun: t.lastRunAt,
  }));

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Recurring expenses</h1>
        <p className="text-muted-foreground text-sm">
          Templates draft an expense automatically on schedule — you review it
          in <Link href="/expenses" className="underline">your expenses</Link>{" "}
          before submitting.
        </p>
      </div>
      <RecurringPanel templates={views} categories={categories} />
    </section>
  );
}
