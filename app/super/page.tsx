// Platform panel (PRD 6.1b): org list + usage metrics + suspend. Raw client
// by design — cross-org AGGREGATES and status only, never tenant records.
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { OrgRow } from "./org-row";

type OrgWithCounts = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  createdAt: Date;
  _count: { users: number; expenses: number; reports: number };
};

export default async function SuperPanelPage() {
  let admin: { email: string };
  try {
    admin = await requireSuperAdmin();
  } catch {
    redirect("/super/login");
  }

  const [orgs, storage] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { users: true, expenses: true, reports: true } },
      },
    }) as Promise<OrgWithCounts[]>,
    prisma.$queryRaw<Array<{ org_id: string; total: bigint }>>`
      SELECT org_id, COALESCE(SUM(size_bytes), 0) AS total
      FROM receipts GROUP BY org_id`,
  ]);
  const storageByOrg = new Map<string, number>(
    storage.map((s: { org_id: string; total: bigint }) => [s.org_id, Number(s.total)])
  );

  return (
    <main className="bg-bg-app text-text-primary min-h-screen p-6">
      <div className="mx-auto grid max-w-5xl gap-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold">Platform administration</h1>
            <p className="text-text-tertiary text-sm">
              {orgs.length} organization{orgs.length === 1 ? "" : "s"} · signed
              in as {admin.email}
            </p>
          </div>
        </div>

        <div className="border-line bg-bg-surface overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-text-tertiary text-left">
              <tr>
                <th scope="col" className="p-3 font-medium">Organization</th>
                <th scope="col" className="p-3 font-medium">Users</th>
                <th scope="col" className="p-3 font-medium">Expenses</th>
                <th scope="col" className="p-3 font-medium">Reports</th>
                <th scope="col" className="p-3 font-medium">Storage</th>
                <th scope="col" className="p-3 font-medium">Created</th>
                <th scope="col" className="p-3 font-medium">Status</th>
                <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <OrgRow
                  key={o.id}
                  org={{
                    id: o.id,
                    name: o.name,
                    slug: o.slug,
                    plan: o.plan,
                    status: o.status,
                    users: o._count.users,
                    expenses: o._count.expenses,
                    reports: o._count.reports,
                    storageMb:
                      Math.round(((storageByOrg.get(o.id) ?? 0) / (1024 * 1024)) * 10) / 10,
                    created: o.createdAt,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-tertiary text-xs">
          This panel shows aggregates only — tenant expense data is never
          accessible here. Suspensions are logged to the organization&apos;s
          audit trail.
        </p>
      </div>
    </main>
  );
}
