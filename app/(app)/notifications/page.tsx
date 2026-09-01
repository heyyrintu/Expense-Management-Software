import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { NotificationList } from "./notification-list";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export default async function NotificationsPage() {
  const ctx = await requireSession();
  const notifications: NotificationRow[] = await scopedDb(ctx.orgId).notification.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (notifications.length === 0) {
    return (
      <section className="grid gap-4">
        <PageHeader title="Notifications" />
        <EmptyState
          headline="Nothing to catch up on"
          description="Approvals, payments and complaint updates land here as they happen."
          action={
            <Button asChild variant="secondary">
              <Link href="/reports">Go to reports</Link>
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <PageHeader title="Notifications" />
      <NotificationList
        items={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.readAt !== null,
          // Raw timestamp — the list renders it through <DateCell>.
          when: n.createdAt,
        }))}
      />
    </section>
  );
}
