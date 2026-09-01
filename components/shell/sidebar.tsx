"use client";

// Desktop sidebar (D0.4, §5.5 · N1.1): 240px, collapsible to a 64px icon rail.
//
// STONE PANEL (N1.1, DESIGN-PLAN-NEOCLASSICAL §6). The panel sits on
// bg-subtle — limestone — with the content area on bg-app beside it, split
// by the usual hairline. That forced a rethink of the row states, because
// the D-series treatment (accent-subtle pill, bg-subtle hover) was designed
// for a white panel: measured against the stone, accent-subtle is 1.03:1 —
// an invisible fill — and bg-subtle hover is the panel itself. The stone
// scheme is inlay instead: the ACTIVE row is a white surface tile carrying
// laurel text (1.20:1 against the panel, the same prominence the old pill
// had against white), and hover is that tile at 60% — a half-cut inlay.
// Still one signal, no left bar, no bold.
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
import { BrandMark } from "./brand-mark";
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
      data-slot="app-sidebar"
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "border-line bg-bg-subtle fixed inset-y-0 left-0 z-30 hidden flex-col border-r md:flex print:hidden",
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
            "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-subtle"
          )}
        >
          <BrandMark />
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
            "text-text-secondary hover:bg-bg-surface/60 hover:text-text-primary flex h-11 w-full items-center gap-3 rounded-md px-3",
            "transition-colors duration-instant ease-out",
            "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-subtle",
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
 * One nav row. Active state is the stone-panel inlay (N1.1): a white
 * surface tile with laurel text — no left bar, no bold, no second signal.
 * (The §5.5 accent-subtle pill was designed for a white panel and measures
 * 1.03:1 against the stone; see the header note.)
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
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-subtle",
        active
          ? "bg-bg-surface text-accent-text"
          : "text-text-secondary hover:bg-bg-surface/60 hover:text-text-primary",
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

// The brand mark moved to ./brand-mark.tsx (N4.1) so the auth pediment can
// draw the same receipt fold without importing the whole sidebar.
