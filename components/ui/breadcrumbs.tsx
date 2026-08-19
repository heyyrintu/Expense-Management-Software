import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  /** Omitted on the last crumb — the page you're already on isn't a link. */
  href?: string;
};

/**
 * Breadcrumbs (D0.4). Meta-sized and tertiary: they are orientation, not
 * content, and must never compete with the page title below them.
 *
 * Only earns its place on nested routes (report detail, a settings section).
 * A top-level screen has nothing to trail behind it — don't add one.
 */
function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="text-meta text-text-tertiary flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className={cn(
                    "hover:text-text-secondary rounded-sm",
                    "transition-colors duration-instant ease-out",
                    "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-text-secondary")}>
                  {item.label}
                </span>
              )}
              {last ? null : (
                <span aria-hidden="true" className="text-text-tertiary">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
