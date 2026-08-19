"use client";

// Settings section nav (D4.4) — the left column of every settings screen.
//
// Vertical and grouped, not the single wrapping row of links it replaces. A
// flat row of eleven destinations gives the reader no structure to hold: they
// re-read the whole line every time. Grouped, "the thing I want is under
// Policies" is one glance.
//
// Below md it becomes a horizontal scroller above the panel rather than
// collapsing into a select. A select hides where you are and where you could
// go — on a settings screen those are the two facts the nav exists to carry.
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveSettingsHref, type SettingsGroup } from "@/lib/settings/nav";
import { cn } from "@/lib/utils";

export function SettingsNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="md:sticky md:top-topbar">
      {/* One list, two layouts. Flowing horizontally under md keeps the same
          DOM order and the same active logic — a second markup tree for
          mobile is how the two fall out of step. */}
      <ul className="flex gap-4 overflow-x-auto pb-2 md:grid md:gap-6 md:overflow-visible md:pb-0">
        {groups.map((group) => (
          <li key={group.id} className="grid content-start gap-1">
            <span className="text-meta text-text-tertiary px-3 uppercase">
              {group.label}
            </span>
            <ul className="flex gap-1 md:grid">
              {group.items.map((item) => {
                const active = isActiveSettingsHref(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "grid gap-0.5 rounded-md px-3 py-2 whitespace-nowrap md:whitespace-normal",
                        "transition-colors duration-instant ease-out",
                        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                        active
                          ? "bg-accent-subtle text-accent-text"
                          : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                      )}
                    >
                      <span className="text-label">{item.label}</span>
                      {/* The hint is desktop-only: horizontally it would
                          double the height of the scroller for text nobody
                          reads while swiping past it. */}
                      <span className="text-meta text-text-tertiary hidden md:block">
                        {item.hint}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
