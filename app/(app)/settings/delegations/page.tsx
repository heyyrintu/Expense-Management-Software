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
      <div>
        <h1 className="text-xl font-semibold">Delegate access</h1>
        <p className="text-text-tertiary text-sm">
          A delegate can create expenses and reports on a principal&apos;s
          behalf — both identities are recorded, and delegates can never
          approve as the principal.
        </p>
      </div>
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
