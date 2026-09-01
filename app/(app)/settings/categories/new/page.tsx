import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { createCategoryAction } from "../../actions";
import { CategoryForm } from "../category-form";

export default async function NewCategoryPage() {
  await requireRole("finance_admin");
  return (
    <section className="grid gap-4">
      <PageHeader
        breadcrumbs={[{ label: "Categories", href: "/settings/categories" }, { label: "New category" }]}
        title="New category"
      />
      <CategoryForm
        defaults={{ name: "", perExpenseLimit: "", monthlyLimit: "", receiptRequiredAbove: "" }}
        action={createCategoryAction}
      />
    </section>
  );
}
