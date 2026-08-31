"use client";

// Top bar (D0.4 · N1.2): page context left · search / ⌘K · notifications · avatar.
//
// Sticky, plate-rule bottom edge, NO shadow — §4.2 "border or shadow, not
// both", and a shadow here would make the bar float above content it isn't
// over. The plate rule (the redesign's engraved double hairline) is an
// ABSOLUTE overlay on the bar's bottom edge, not a border or an extra row:
// the bar's rendered height must stay exactly --topbar-height, because
// the settings nav parks at `top-topbar` and would underlap a taller bar.
// This is one of the plate rule's three sanctioned positions.
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
        "bg-bg-surface sticky top-0 z-20 print:hidden",
        // Rule, not shadow (§5.4).
        //
        // Do NOT add `relative` here to anchor the plate rule below.
        // `position: sticky` is already a positioned value, so it is the
        // containing block for the absolutely-positioned rule — and
        // `relative` and `sticky` are the SAME tailwind-merge group, so
        // passing both silently deletes `sticky` and the bar stops sticking.
        // That shipped once (N1.2) and was invisible to every gate:
        // the class string still looked right in source.
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
      {/* The engraved bottom edge — punctuation, not content. */}
      <div aria-hidden="true" className="plate-rule absolute inset-x-0 bottom-0" />
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
