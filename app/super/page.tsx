// Platform panel (PRD 6.1b): org list + usage metrics + suspend. Raw client
// by design — cross-org AGGREGATES and status only, never tenant records.
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { formatDate } from "@/lib/format";
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
    prisma.receipt.groupBy({
      by: ["orgId"],
      _sum: { sizeBytes: true },
    }) as Promise<Array<{ orgId: string; _sum: { sizeBytes: number | null } }>>,
  ]);
  const storageByOrg = new Map(storage.map((s) => [s.orgId, s._sum.sizeBytes ?? 0]));

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto grid max-w-5xl gap-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold">Platform administration</h1>
            <p className="text-sm text-zinc-400">
              {orgs.length} organization{orgs.length === 1 ? "" : "s"} · signed
              in as {admin.email}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-zinc-400">
              <tr>
                <th className="p-3 font-medium">Organization</th>
                <th className="p-3 font-medium">Users</th>
                <th className="p-3 font-medium">Expenses</th>
                <th className="p-3 font-medium">Reports</th>
                <th className="p-3 font-medium">Storage</th>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3" />
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
                    created: formatDate(o.createdAt),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          This panel shows aggregates only — tenant expense data is never
          accessible here. Suspensions are logged to the organization&apos;s
          audit trail.
        </p>
      </div>
    </main>
  );
}
