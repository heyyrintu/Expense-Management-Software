"use client";

// Top bar (D0.4): page context left · search / ⌘K · notifications · avatar.
//
// Sticky, 1px bottom border, NO shadow — §4.2 "border or shadow, not both",
// and a shadow here would make the bar float above content it isn't over.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import { AvatarMenu } from "./avatar-menu";
import { CommandPalette } from "./command-palette";
import { activeItem } from "./nav";

export function TopBar({
  role,
  orgName,
  userName,
  userEmail,
  unreadCount,
  signOutAction,
  actingSwitcher,
}: {
  role: Role;
  orgName: string;
  userName: string;
  userEmail: string;
  unreadCount: number;
  signOutAction: () => Promise<void>;
  /** Rendered by the layout — delegation is domain UI, not shell chrome. */
  actingSwitcher?: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = activeItem(pathname, role);

  return (
    <header
      data-slot="app-topbar"
      className={cn(
        "border-line bg-bg-surface sticky top-0 z-20 border-b print:hidden",
        // Border, not shadow (§5.4).
        "shadow-flat"
      )}
    >
      <div className="flex h-topbar items-center gap-3 px-4 md:px-6">
        {/* Page context. On mobile the sidebar is gone, so this is also the
            only place the org name appears. */}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-h3 text-text-primary truncate">
            {current?.label ?? orgName}
          </span>
          <span className="text-meta text-text-tertiary hidden truncate md:inline">{orgName}</span>
        </div>

        {actingSwitcher}
        <CommandPalette role={role} />
        <NotificationsBell unreadCount={unreadCount} />
        <AvatarMenu
          name={userName}
          email={userEmail}
          role={role}
          orgName={orgName}
          signOutAction={signOutAction}
        />
      </div>
    </header>
  );
}

/**
 * A dot, not a number. §4.1: the count is a decoration here — you either
 * have unread notifications or you don't, and the list itself tells you how
 * many. The exact figure still reaches screen readers through the label,
 * so nothing is lost for anyone who wants it.
 */
function NotificationsBell({ unreadCount }: { unreadCount: number }) {
  const hasUnread = unreadCount > 0;
  return (
    <Link
      href="/notifications"
      aria-label={
        hasUnread
          ? `Notifications, ${unreadCount} unread`
          : "Notifications, none unread"
      }
      className={cn(
        "text-text-secondary hover:bg-bg-subtle hover:text-text-primary relative grid size-11 shrink-0 place-items-center rounded-md",
        "transition-colors duration-instant ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
      )}
    >
      <Bell aria-hidden="true" className="size-5" />
      {hasUnread ? (
        <span
          aria-hidden="true"
          className="bg-accent border-bg-surface absolute top-2 right-2 size-2 rounded-full border-2"
        />
      ) : null}
    </Link>
  );
}
