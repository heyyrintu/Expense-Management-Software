import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { toDateInputValue } from "@/lib/format";
import type { Option } from "../expense-form";
import { NewExpenseSwitcher } from "./new-expense-switcher";

export default async function NewExpensePage() {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const [org, categories, projects] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const today = toDateInputValue(new Date());

  return (
    <section className="grid gap-4">
      <h1 className="text-xl font-semibold">Add expense</h1>
      {categories.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Your organization has no expense categories yet — a finance admin
          needs to add one in Settings before expenses can be filed.
        </p>
      ) : null}
      <NewExpenseSwitcher
        regularDefaults={{
          amount: "",
          date: today,
          merchant: "",
          categoryId: "",
          projectId: "",
          purpose: "",
        }}
        mileageDefaults={{
          distanceKm: "",
          date: today,
          categoryId: "",
          projectId: "",
          purpose: "",
        }}
        categories={categories as Option[]}
        projects={projects as Option[]}
        currency={org.currency}
        ratePerKmMinor={org.mileageRate}
      />
    </section>
  );
}
