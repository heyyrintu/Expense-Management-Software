import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getSessionCtx();
  if (!ctx) redirect("/login");
  // UI gate only — every action re-checks with requireRole("finance_admin").
  if (!roleAtLeast(ctx.role, "finance_admin")) redirect("/dashboard");

  const admin = roleAtLeast(ctx.role, "org_admin");
  return (
    <div className="grid gap-6">
      <nav className="flex flex-wrap gap-4 border-b pb-2 text-sm">
        <Link href="/settings/organization" className="hover:underline">
          Organization
        </Link>
        <Link href="/settings/categories" className="hover:underline">
          Categories
        </Link>
        <Link href="/settings/clients" className="hover:underline">
          Clients
        </Link>
        {admin ? (
          <>
            <Link href="/settings/users" className="hover:underline">
              Users
            </Link>
            <Link href="/settings/departments" className="hover:underline">
              Departments
            </Link>
            <Link href="/settings/approval-chains" className="hover:underline">
              Approval chains
            </Link>
            <Link href="/settings/delegations" className="hover:underline">
              Delegations
            </Link>
            <Link href="/settings/email-ingestion" className="hover:underline">
              Email ingestion
            </Link>
          </>
        ) : null}
      </nav>
      {children}
    </div>
  );
}
