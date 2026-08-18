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
