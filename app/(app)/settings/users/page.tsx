import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { usersListQuerySchema } from "@/lib/schemas/user";
import { InviteUserSheet } from "./invite-user-sheet";

const PAGE_SIZE = 50;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department: { name: string } | null;
  approver: { name: string } | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireRole("org_admin");
  const raw = await searchParams;
  const parsed = usersListQuerySchema.safeParse({
    q: typeof raw.q === "string" && raw.q !== "" ? raw.q : undefined,
    role: typeof raw.role === "string" && raw.role !== "" ? raw.role : undefined,
    department:
      typeof raw.department === "string" && raw.department !== ""
        ? raw.department
        : undefined,
    status:
      typeof raw.status === "string" && raw.status !== "" ? raw.status : undefined,
    page: typeof raw.page === "string" ? raw.page : 1,
  });
  const query = parsed.success
    ? parsed.data
    : { q: undefined, role: undefined, department: undefined, status: undefined, page: 1 };

  const db = scopedDb(ctx.orgId);
  const where = {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.department ? { departmentId: query.department } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [users, total, departments, activeUsers] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        department: { select: { name: true } },
        approver: { select: { name: true } },
      },
    }) as Promise<UserRow[]>,
    db.user.count({ where }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.role) p.set("role", query.role);
    if (query.department) p.set("department", query.department);
    if (query.status) p.set("status", query.status);
    p.set("page", String(page));
    return `/settings/users?${p.toString()}`;
  };

  return (
    <SettingsPanel
      title="Users"
      description={`${total} user${total === 1 ? "" : "s"} in your organisation.`}
      action={<InviteUserSheet departments={departments} approvers={activeUsers} />}
    >

      <form className="flex flex-wrap items-end gap-2" action="/settings/users" method="GET">
        <div className="grid gap-1">
          <label htmlFor="q" className="text-text-tertiary text-xs">Search</label>
          <Input id="q" name="q" defaultValue={query.q ?? ""} placeholder="Name or email" className="w-48" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="role" className="text-text-tertiary text-xs">Role</label>
          <NativeSelect id="role" name="role" defaultValue={query.role ?? ""} className="w-36">
            <option value="">All roles</option>
            <option value="employee">employee</option>
            <option value="approver">approver</option>
            <option value="finance_admin">finance admin</option>
            <option value="org_admin">org admin</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <label htmlFor="department" className="text-text-tertiary text-xs">Department</label>
          <NativeSelect id="department" name="department" defaultValue={query.department ?? ""} className="w-40">
            <option value="">All departments</option>
            {departments.map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <label htmlFor="status" className="text-text-tertiary text-xs">Status</label>
          <NativeSelect id="status" name="status" defaultValue={query.status ?? ""} className="w-36">
            <option value="">All statuses</option>
            <option value="active">active</option>
            <option value="invited">invited</option>
            <option value="deactivated">deactivated</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {users.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No users match</CardTitle>
            <CardDescription>Adjust the filters or invite someone new.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle/50 text-left">
              <tr>
                <th scope="col" className="p-3 font-medium">Name</th>
                <th scope="col" className="hidden p-3 font-medium md:table-cell">Email</th>
                <th scope="col" className="p-3 font-medium">Role</th>
                <th scope="col" className="hidden p-3 font-medium lg:table-cell">Department</th>
                <th scope="col" className="hidden p-3 font-medium lg:table-cell">Approver</th>
                <th scope="col" className="p-3 font-medium">Status</th>
                <th scope="col" className="p-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="text-text-tertiary hidden p-3 md:table-cell">{u.email}</td>
                  <td className="p-3">{u.role.replace("_", " ")}</td>
                  <td className="hidden p-3 lg:table-cell">{u.department?.name ?? "—"}</td>
                  <td className="hidden p-3 lg:table-cell">{u.approver?.name ?? "—"}</td>
                  <td className="p-3">
                    {/* active / invited / deactivated / suspended all live in
                        STATUS_MAP — a user's state is a status like any other
                        and gets the same badge the rest of the app uses. */}
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="p-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/users/${u.id}`}>Manage</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-tertiary">
            Page {query.page} of {pages}
          </span>
          <div className="flex gap-2">
            {query.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={qs(query.page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {query.page < pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={qs(query.page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </SettingsPanel>
  );
}
