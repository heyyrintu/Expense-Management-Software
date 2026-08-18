import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { DepartmentsPanel } from "./departments-panel";

type DeptRow = { id: string; name: string; _count: { users: number } };

export default async function DepartmentsPage() {
  const ctx = await requireRole("org_admin");
  const departments: DeptRow[] = await scopedDb(ctx.orgId).department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Departments</h1>
        <p className="text-muted-foreground text-sm">
          Departments group users for reporting and dashboards.
        </p>
      </div>
      <DepartmentsPanel
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          userCount: d._count.users,
        }))}
      />
    </section>
  );
}
