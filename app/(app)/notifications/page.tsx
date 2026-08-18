import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
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
        <h1 className="text-xl font-semibold">Notifications</h1>
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>
              You&apos;ll see report submissions and decisions here.{" "}
              <Link href="/reports" className="underline underline-offset-4">
                Go to reports
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <NotificationList
        items={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.readAt !== null,
          when: formatDate(n.createdAt),
        }))}
      />
    </section>
  );
}
