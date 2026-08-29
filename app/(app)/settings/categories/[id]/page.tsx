import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { toDecimalString } from "@/lib/money";
import { EditCategoryFormWrapper } from "./edit-form-wrapper";

function money(minor: number | null): string {
  return minor === null ? "" : toDecimalString(minor);
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRole("finance_admin");
  const category = await scopedDb(ctx.orgId).category.findUnique({
    where: { id },
  });
  if (!category) notFound(); // includes cross-org probes — indistinguishable

  return (
    <section className="grid gap-4">
      <PageHeader
        breadcrumbs={[{ label: "Categories", href: "/settings/categories" }, { label: "Edit category" }]}
        title="Edit category"
      />
      <EditCategoryFormWrapper
        categoryId={category.id}
        defaults={{
          name: category.name,
          perExpenseLimit: money(category.perExpenseLimit),
          monthlyLimit: money(category.monthlyLimit),
          receiptRequiredAbove: money(category.receiptRequiredAbove),
        }}
      />
    </section>
  );
}
