import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AppShell,
  SIDEBAR_COLLAPSED_VALUE,
  SIDEBAR_COOKIE,
} from "@/components/shell/app-shell";
import { resolveActing } from "@/lib/auth/acting";
import { getSessionCtx } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { logoutAction } from "@/app/(auth)/actions";
import { ActingSwitcher } from "./acting-switcher";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getSessionCtx();
  if (!ctx) redirect("/login");

  const db = scopedDb(ctx.orgId);
  const unread = await db.notification.count({
    where: { userId: ctx.userId, readAt: null },
  });
  // Shell chrome only: the org's display name and the signed-in user's own
  // name/email. Both org-scoped through scopedDb like every other read.
  const [org, user] = await Promise.all([
    db.organization.findUnique({
      where: { id: ctx.orgId },
      select: { name: true },
    }) as Promise<{ name: string } | null>,
    db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true },
    }) as Promise<{ name: string; email: string } | null>,
  ]);

  const acting = await resolveActing(ctx);
  const myPrincipals = (await db.delegation.findMany({
    where: { delegateId: ctx.userId, active: true },
    include: { principal: { select: { id: true, name: true } } },
  })) as Array<{ principal: { id: string; name: string } }>;

  // Read on the server so the sidebar renders at its persisted width on the
  // first paint — see the note in components/shell/app-shell.tsx.
  const collapsed =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED_VALUE;

  return (
    <AppShell
      role={ctx.role}
      orgName={org?.name ?? ctx.orgSlug}
      userName={user?.name ?? ctx.orgSlug}
      userEmail={user?.email ?? ""}
      unreadCount={unread}
      defaultCollapsed={collapsed}
      signOutAction={logoutAction}
      actingSwitcher={
        <ActingSwitcher
          principals={myPrincipals.map((d) => d.principal)}
          actingAs={acting.onBehalfOf}
        />
      }
    >
      {children}
    </AppShell>
  );
}
