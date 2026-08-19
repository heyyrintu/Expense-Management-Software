"use client";

// App shell (D0.4) — the frame every tenant screen renders inside.
//
// Owns exactly one piece of state: whether the desktop sidebar is collapsed.
// It lives here rather than in Sidebar because the content gutter has to
// change with it, and two components reading one cookie is how they drift.
//
// PERSISTENCE: a cookie, not localStorage. The server reads it in
// app/(app)/layout.tsx and renders the correct width on the first paint —
// localStorage would only be readable after hydration, so every navigation
// would flash the expanded sidebar before snapping to the rail.
import * as React from "react";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import { MobileTabBar } from "./mobile-tab-bar";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export const SIDEBAR_COOKIE = "shell.sidebar";
export const SIDEBAR_COLLAPSED_VALUE = "collapsed";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function AppShell({
  role,
  orgName,
  userName,
  userEmail,
  unreadCount,
  defaultCollapsed,
  signOutAction,
  actingSwitcher,
  children,
}: {
  role: Role;
  orgName: string;
  userName: string;
  userEmail: string;
  unreadCount: number;
  defaultCollapsed: boolean;
  signOutAction: () => Promise<void>;
  actingSwitcher?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? SIDEBAR_COLLAPSED_VALUE : "expanded"}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <div className="bg-bg-app min-h-screen">
      {/* Keyboard users shouldn't have to tab the whole nav on every page. */}
      <a
        href="#main-content"
        className={cn(
          "bg-bg-surface text-text-primary border-line shadow-overlay sr-only rounded-md border px-4 py-2 text-label",
          "focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50",
          "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
        )}
      >
        Skip to content
      </a>

      <Sidebar role={role} orgName={orgName} collapsed={collapsed} onToggle={toggle} />

      {/* The gutter mirrors the sidebar's width from the same token pair, so
          the two cannot fall out of step. Below md there is no sidebar and
          no gutter — the tab bar handles navigation. */}
      <div className={cn(collapsed ? "md:ps-sidebar-rail" : "md:ps-sidebar", "print:ps-0")}>
        <TopBar
          role={role}
          orgName={orgName}
          userName={userName}
          userEmail={userEmail}
          unreadCount={unreadCount}
          signOutAction={signOutAction}
          actingSwitcher={actingSwitcher}
        />
        <main
          id="main-content"
          // §5.5: content capped at 1280px, 24px padding on desktop and 16px
          // on mobile. The bottom padding clears the mobile tab bar so the
          // last row of any list is never trapped underneath it.
          className="mx-auto max-w-content px-4 py-4 pb-tabbar md:px-6 md:py-6 md:pb-6"
        >
          {children}
        </main>
      </div>

      <MobileTabBar role={role} />
    </div>
  );
}
