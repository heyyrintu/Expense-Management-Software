"use client";

// Desktop sidebar (D0.4, §5.5): 240px, collapsible to a 64px icon rail.
//
// MOTION NOTE — why the collapse does not animate.
// Width is a layout property, and DESIGN-PRD §4.4 allows exactly one
// exception to transform/opacity-only (collapseRow, because the rows below a
// departing row have to close the gap). A sidebar has no such obligation:
// the content beside it simply takes the space. Animating 240→64px would
// also thrash layout on every frame across the entire page — which is the
// reason for the rule in the first place. So the width snaps.
//
// Labels are removed with `sr-only`, not faded: an opacity-0 label still
// claims its full width and would overflow a 64px rail. They reappear as
// tooltips instead, so the rail never becomes a memory test.
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import { isActiveHref, visibleSections } from "./nav";

export function Sidebar({
  role,
  orgName,
  collapsed,
  onToggle,
}: {
  role: Role;
  orgName: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const sections = React.useMemo(() => visibleSections(role), [role]);

  return (
    <aside
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "border-line bg-bg-surface fixed inset-y-0 left-0 z-30 hidden flex-col border-r md:flex print:hidden",
        collapsed ? "w-sidebar-rail" : "w-sidebar"
      )}
    >
      {/* Brand. Doubles as the link home, so the rail keeps a home affordance
          even with every label hidden. */}
      <div className={cn("flex h-topbar shrink-0 items-center", collapsed ? "justify-center px-2" : "px-4")}>
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2 rounded-md outline-none",
            "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
          )}
        >
          <Mark />
          <span className={cn("text-h3 text-text-primary truncate", collapsed && "sr-only")}>
            {orgName}
          </span>
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-4">
        {sections.map((section) => (
          <div key={section.id} className="mt-4 first:mt-0">
            {section.label ? (
              <h2
                className={cn(
                  "text-meta text-text-tertiary px-2 pb-1 uppercase",
                  // In the rail the heading has nothing to label — the border
                  // above the group carries the separation instead.
                  collapsed && "sr-only"
                )}
              >
                {section.label}
              </h2>
            ) : null}
            <ul className="grid gap-1">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    icon={<item.icon aria-hidden="true" className="size-4 shrink-0" />}
                    active={isActiveHref(pathname, item)}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-line shrink-0 border-t p-2")}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "text-text-secondary hover:bg-bg-subtle hover:text-text-primary flex h-11 w-full items-center gap-3 rounded-md px-3",
            "transition-colors duration-instant ease-out",
            "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className={cn("text-label", collapsed && "sr-only")}>Collapse</span>
        </button>
      </div>
    </aside>
  );
}

/**
 * One nav row. Active state is the §5.5 treatment: an accent-subtle pill
 * with accent text — no left bar, no bold, no second signal.
 *
 * 44px tall, which satisfies the touch target and gives the comfortable
 * density §5.4 asks for. In the rail the label becomes a tooltip rather
 * than disappearing: an icon-only nav without names is a memory test.
 */
function NavLink({
  href,
  label,
  icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  collapsed: boolean;
}) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-label",
        "transition-colors duration-instant ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface",
        active
          ? "bg-accent-subtle text-accent-text"
          : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        collapsed && "justify-center px-0"
      )}
    >
      {icon}
      <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Geometric brand mark — a receipt fold. No illustration set (§3). */
function Mark() {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-solid text-text-on-accent grid size-7 shrink-0 place-items-center rounded-md"
    >
      <svg viewBox="0 0 16 16" fill="none" className="size-4">
        <path
          d="M4 2.5h8v11l-2-1.2-2 1.2-2-1.2-2 1.2v-11Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M6.5 6h3M6.5 8.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
