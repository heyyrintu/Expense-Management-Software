import { requireSession } from "@/lib/auth/guard";
import { NewReportForm } from "./new-report-form";

export default async function NewReportPage() {
  await requireSession();
  return (
    <section className="grid gap-4">
      <h1 className="text-xl font-semibold">New report</h1>
      <NewReportForm />
    </section>
  );
}
