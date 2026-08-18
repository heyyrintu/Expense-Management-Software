import { requireRole } from "@/lib/auth/guard";
import { createCategoryAction } from "../../actions";
import { CategoryForm } from "../category-form";

export default async function NewCategoryPage() {
  await requireRole("finance_admin");
  return (
    <section className="grid gap-4">
      <h1 className="text-xl font-semibold">New category</h1>
      <CategoryForm
        defaults={{ name: "", perExpenseLimit: "", monthlyLimit: "", receiptRequiredAbove: "" }}
        action={createCategoryAction}
      />
    </section>
  );
}
