"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

type Item = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  /** Raw timestamp — rendered through <DateCell>, never pre-formatted. */
  when: Date | string;
};

export function NotificationList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const unread = items.filter((i) => !i.read).length;

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationReadAction({ id });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      {unread > 0 ? (
        <div>
          <Button variant="outline" size="sm" disabled={pending} onClick={markAll}>
            Mark all read ({unread})
          </Button>
        </div>
      ) : null}
      <ul className="grid gap-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={cn(
              "grid gap-1 rounded-lg border p-3 text-sm",
              !n.read && "border-blue-200 bg-blue-50/50"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{n.title}</span>
              {/* A notification list is an activity context — relative time. */}
              <DateCell value={n.when} format="relative" />
            </div>
            <p className="text-muted-foreground">{n.body}</p>
            <div className="flex gap-3">
              {n.link ? (
                <Link
                  href={n.link}
                  className="text-sm underline underline-offset-4"
                  onClick={() => !n.read && markOne(n.id)}
                >
                  Open
                </Link>
              ) : null}
              {!n.read ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markOne(n.id)}
                  className="text-muted-foreground text-sm underline underline-offset-4"
                >
                  Mark read
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
