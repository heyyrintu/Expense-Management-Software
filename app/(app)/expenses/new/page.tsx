import { Suspense } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/page-skeleton";
import { requireSession, type SessionCtx } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { toDateInputValue } from "@/lib/format";
import type { Option } from "../expense-form";
import { NewExpenseSwitcher } from "./new-expense-switcher";

// The header is static text and the form needs five reads (org, categories,
// projects, clients, per-diem history). Streaming them separately means the
// title paints with the first paint and the form arrives over its own
// skeleton — the same FormSkeleton loading.tsx uses, so the boxes match. See
// the note at the top of app/(app)/dashboard/page.tsx for why this matters
// on a phone.
export default async function NewExpensePage() {
  const ctx = await requireSession();
  return (
    <>
      <PageHeader
        title="Add expense"
        description="Capture it now — you can attach the receipt and tidy the details later."
        breadcrumbs={[{ label: "Expenses", href: "/expenses" }, { label: "Add" }]}
      />
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <NewExpenseForm ctx={ctx} />
      </Suspense>
    </>
  );
}

async function NewExpenseForm({ ctx }: { ctx: SessionCtx }) {
  const db = scopedDb(ctx.orgId);
  const [org, categories, projects, clients, perDiemRates] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    // Every version, not just the current one: which rate applies depends on
    // the date the reader picks, so the form needs the history to preview an
    // amount without a round trip.
    db.perDiemRate.findMany({
      orderBy: [{ name: "asc" }, { effectiveFrom: "desc" }],
      select: {
        id: true,
        name: true,
        location: true,
        dailyAmount: true,
        effectiveFrom: true,
        active: true,
      },
    }) as Promise<
      Array<{
        id: string;
        name: string;
        location: string | null;
        dailyAmount: number;
        effectiveFrom: Date;
        active: boolean;
      }>
    >,
  ]);
  const today = toDateInputValue(new Date());

  return (
    <>
      {categories.length === 0 ? (
        <p className="border-status-warning-subtle bg-status-warning-subtle text-status-warning-text mb-4 rounded-lg border p-3 text-body">
          Your organization has no expense categories yet — a finance admin
          needs to add one in Settings before expenses can be filed.
        </p>
      ) : null}
      <NewExpenseSwitcher
        regularDefaults={{
          amount: "",
          currency: org.currency,
          fxRate: "1",
          date: today,
          merchant: "",
          categoryId: "",
          projectId: "",
          purpose: "",
          billable: false,
          clientId: "",
          taxAmount: "",
          taxNumber: "",
          splits: [],
        }}
        mileageDefaults={{
          distanceKm: "",
          date: today,
          categoryId: "",
          projectId: "",
          purpose: "",
        }}
        perDiemDefaults={{
          rateName: "",
          start: today,
          end: today,
          firstDayHalf: false,
          lastDayHalf: false,
          categoryId: "",
          projectId: "",
          purpose: "",
        }}
        categories={categories as Option[]}
        projects={projects as Option[]}
        clients={clients as { id: string; name: string; code: string }[]}
        currency={org.currency}
        ratePerKmMinor={org.mileageRate}
        // Dates cross to the client as ISO strings and are parsed back there —
        // never pre-formatted into display text (D1.1).
        perDiemRates={perDiemRates.map(
          (r: {
            id: string;
            name: string;
            location: string | null;
            dailyAmount: number;
            effectiveFrom: Date;
            active: boolean;
          }) => ({ ...r, effectiveFrom: r.effectiveFrom.toISOString() })
        )}
      />
    </>
  );
}
