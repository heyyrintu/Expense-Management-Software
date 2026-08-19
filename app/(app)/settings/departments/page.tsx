import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { DepartmentsPanel } from "./departments-panel";

type DeptRow = { id: string; name: string; _count: { users: number } };

export default async function DepartmentsPage() {
  const ctx = await requireRole("org_admin");
  const departments: DeptRow[] = await scopedDb(ctx.orgId).department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <SettingsPanel
      title="Departments"
      description="Departments group users for reporting, dashboards and ledger rollups."
    >
      <DepartmentsPanel
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          userCount: d._count.users,
        }))}
      />
    </SettingsPanel>
  );
}
