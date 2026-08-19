"use client";

// Mobile tab bar (D0.4, §5.5): Home · Expenses · Add · Reports · More.
// Replaces the sidebar under md.
//
// The centre "Add" is the accent circle — the one primary action visible on
// every mobile screen (§4.6), and the front door the whole product is
// measured on (§2.1, "submit an expense in under 60 seconds").
//
// SAFE AREA: the bar paints all the way to the bottom edge (so there's no
// pale strip above the home indicator) but its controls sit above the inset,
// via pb-safe on the container and a fixed-height row inside it.
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import { ADD_EXPENSE_HREF, TAB_BAR_ITEMS, isActiveHref, visibleSections } from "./nav";

export function MobileTabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const sections = React.useMemo(() => visibleSections(role), [role]);

  // Close "More" on navigation — otherwise tapping a link leaves the sheet
  // sitting over the page you just asked for.
  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const [home, expenses, reports] = TAB_BAR_ITEMS;

  return (
    <>
      <nav
        data-slot="app-tabbar"
        aria-label="Primary"
        className="border-line bg-bg-surface fixed inset-x-0 bottom-0 z-30 border-t pb-safe md:hidden print:hidden"
      >
        <ul className="grid h-tabbar grid-cols-5 items-center">
          <Tab item={home} active={isActiveHref(pathname, home)} />
          <Tab item={expenses} active={isActiveHref(pathname, expenses)} />

          <li className="grid place-items-center">
            <Link
              href={ADD_EXPENSE_HREF}
              aria-label="Add expense"
              aria-current={pathname === ADD_EXPENSE_HREF ? "page" : undefined}
              className={cn(
                "bg-accent-solid text-text-on-accent grid size-11 place-items-center rounded-full",
                "press-scale hover:bg-accent-hover active:bg-accent-pressed",
                "transition-colors duration-instant ease-out",
                "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
              )}
            >
              <Plus aria-hidden="true" className="size-5" />
            </Link>
          </li>

          <Tab item={reports} active={isActiveHref(pathname, reports)} />

          <li className="grid place-items-center">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="More destinations"
              aria-expanded={moreOpen}
              className={cn(
                "text-text-secondary grid h-11 w-full place-items-center gap-1 rounded-md",
                "transition-colors duration-instant ease-out",
                "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
              )}
            >
              <Menu aria-hidden="true" className="size-5" />
              <span className="text-meta">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Go to</SheetTitle>
          </SheetHeader>
          {/* Same role-filtered sections as the sidebar — one nav model, two
              surfaces, so nothing can appear on one and not the other. */}
          {sections.map((section) => (
            <div key={section.id} className="mt-4 first:mt-0">
              {section.label ? (
                <h3 className="text-meta text-text-tertiary px-1 pb-1 uppercase">{section.label}</h3>
              ) : null}
              <ul className="grid gap-1">
                {section.items.map((item) => {
                  const active = isActiveHref(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 items-center gap-3 rounded-md px-3 text-label",
                          "transition-colors duration-instant ease-out",
                          "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                          active
                            ? "bg-accent-subtle text-accent-text"
                            : "text-text-secondary"
                        )}
                      >
                        <item.icon aria-hidden="true" className="size-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Tab({
  item,
  active,
}: {
  item: (typeof TAB_BAR_ITEMS)[number];
  active: boolean;
}) {
  return (
    <li className="grid place-items-center">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "grid h-11 w-full place-items-center gap-1 rounded-md",
          "transition-colors duration-instant ease-out",
          "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface",
          active ? "text-accent-text" : "text-text-secondary"
        )}
      >
        <item.icon aria-hidden="true" className="size-5" />
        <span className="text-meta">{item.label}</span>
      </Link>
    </li>
  );
}
