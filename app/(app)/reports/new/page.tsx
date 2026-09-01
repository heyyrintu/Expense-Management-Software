import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/guard";
import { NewReportForm } from "./new-report-form";

export default async function NewReportPage() {
  await requireSession();
  return (
    <section className="grid gap-4">
      <PageHeader
        breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: "New report" }]}
        title="New report"
      />
      <NewReportForm />
    </section>
  );
}
