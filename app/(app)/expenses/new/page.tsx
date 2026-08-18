import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { toDateInputValue } from "@/lib/format";
import { createExpenseAction } from "../actions";
import { ExpenseForm, type Option } from "../expense-form";

export default async function NewExpensePage() {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const [org, categories, projects] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <section className="grid gap-4">
      <h1 className="text-xl font-semibold">Add expense</h1>
      <ExpenseForm
        defaults={{
          amount: "",
          date: toDateInputValue(new Date()),
          merchant: "",
          categoryId: "",
          projectId: "",
          purpose: "",
        }}
        categories={categories as Option[]}
        projects={projects as Option[]}
        currency={org.currency}
        action={createExpenseAction}
      />
    </section>
  );
}
