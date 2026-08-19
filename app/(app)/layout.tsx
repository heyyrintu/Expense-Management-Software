import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { resolveActing } from "@/lib/auth/acting";
import { getSessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { scopedDb } from "@/lib/db/scoped";
import { logoutAction } from "@/app/(auth)/actions";
import { ActingSwitcher } from "./acting-switcher";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getSessionCtx();
  if (!ctx) redirect("/login");
  const unread = await scopedDb(ctx.orgId).notification.count({
    where: { userId: ctx.userId, readAt: null },
  });
  const acting = await resolveActing(ctx);
  const myPrincipals = (await scopedDb(ctx.orgId).delegation.findMany({
    where: { delegateId: ctx.userId, active: true },
    include: { principal: { select: { id: true, name: true } } },
  })) as Array<{ principal: { id: string; name: string } }>;

  return (
    <div className="min-h-screen">
      <header className="border-b print:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-baseline gap-3">
            <Link href="/dashboard" className="font-semibold">
              Expense Management
            </Link>
            <span className="text-muted-foreground text-sm">/{ctx.orgSlug}</span>
            <Link
              href="/expenses"
              className="text-muted-foreground text-sm hover:underline"
            >
              Expenses
            </Link>
            <Link
              href="/reports"
              className="text-muted-foreground text-sm hover:underline"
            >
              Reports
            </Link>
            <Link
              href="/advances"
              className="text-muted-foreground text-sm hover:underline"
            >
              Advances
            </Link>
            <Link
              href="/ledger"
              className="text-muted-foreground text-sm hover:underline"
            >
              Ledger
            </Link>
            <Link
              href="/complaints"
              className="text-muted-foreground text-sm hover:underline"
            >
              Complaints
            </Link>
            {roleAtLeast(ctx.role, "approver") ? (
              <Link
                href="/approvals"
                className="text-muted-foreground text-sm hover:underline"
              >
                Approvals
              </Link>
            ) : null}
            {roleAtLeast(ctx.role, "finance_admin") ? (
              <>
                <Link
                  href="/finance"
                  className="text-muted-foreground text-sm hover:underline"
                >
                  Finance
                </Link>
                <Link
                  href="/budgets"
                  className="text-muted-foreground text-sm hover:underline"
                >
                  Budgets
                </Link>
                <Link
                  href="/card-imports"
                  className="text-muted-foreground text-sm hover:underline"
                >
                  Cards
                </Link>
                <Link
                  href="/analytics"
                  className="text-muted-foreground text-sm hover:underline"
                >
                  Analytics
                </Link>
                <Link
                  href="/bank-recon"
                  className="text-muted-foreground text-sm hover:underline"
                >
                  Bank
                </Link>
              </>
            ) : null}
            {roleAtLeast(ctx.role, "finance_admin") ? (
              <Link
                href="/settings"
                className="text-muted-foreground text-sm hover:underline"
              >
                Settings
              </Link>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <ActingSwitcher
              principals={myPrincipals.map((d) => d.principal)}
              actingAs={acting.onBehalfOf}
            />
            <Link
              href="/notifications"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
              className="text-muted-foreground relative text-sm hover:underline"
            >
              Inbox
              {unread > 0 ? (
                <span className="absolute -top-2 -right-3 rounded-full bg-blue-600 px-1.5 text-micro font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <Link
              href="/profile"
              className="text-muted-foreground hidden text-sm hover:underline sm:inline"
            >
              {ctx.role.replace("_", " ")}
            </Link>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
