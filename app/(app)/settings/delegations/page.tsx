import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { DelegationsPanel } from "./delegations-panel";

type DelegationRow = {
  id: string;
  active: boolean;
  delegate: { name: string };
  principal: { name: string };
};

export default async function DelegationsPage() {
  const ctx = await requireRole("org_admin");
  const db = scopedDb(ctx.orgId);
  const [delegations, users] = await Promise.all([
    db.delegation.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      include: {
        delegate: { select: { name: true } },
        principal: { select: { name: true } },
      },
    }) as Promise<DelegationRow[]>,
    db.user.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <section className="grid gap-4">
      <PageHeader
        title="Delegate access"
        description="A delegate can create expenses and reports on a principal's behalf — both identities are recorded, and delegates can never approve as the principal."
      />
      <DelegationsPanel
        delegations={delegations.map((d) => ({
          id: d.id,
          label: `${d.delegate.name} acts for ${d.principal.name}`,
        }))}
        users={users}
      />
    </section>
  );
}
