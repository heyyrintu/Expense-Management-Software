import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { ManageUserPanel } from "./manage-user-panel";

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRole("org_admin");
  const db = scopedDb(ctx.orgId);

  const [user, departments, activeUsers] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        approverId: true,
      },
    }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!user) notFound();

  return (
    <section className="grid gap-4">
      <PageHeader
        breadcrumbs={[{ label: "Users", href: "/settings/users" }, { label: user.name }]}
        title={user.name}
        description={`${user.email} · ${user.status}`}
      />
      <ManageUserPanel
        user={{
          id: user.id,
          name: user.name,
          role: user.role,
          status: user.status,
          departmentId: user.departmentId ?? "",
          approverId: user.approverId ?? "",
        }}
        isSelf={user.id === ctx.userId}
        departments={departments}
        approvers={activeUsers.filter((u: { id: string }) => u.id !== user.id)}
      />
    </section>
  );
}
