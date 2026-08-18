import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { ClientsPanel } from "./clients-panel";

type ClientRow = { id: string; name: string; code: string; _count: { expenses: number } };

export default async function ClientsPage() {
  const ctx = await requireRole("finance_admin");
  const clients: ClientRow[] = await scopedDb(ctx.orgId).client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true } } },
  });

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Billing clients</h1>
        <p className="text-muted-foreground text-sm">
          Billable expenses are tagged to a client for invoicing and reporting.
        </p>
      </div>
      <ClientsPanel
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          expenseCount: c._count.expenses,
        }))}
      />
    </section>
  );
}
