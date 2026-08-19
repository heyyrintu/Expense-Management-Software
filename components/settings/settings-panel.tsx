// Settings panel (D4.4) — the right-hand column of every settings screen.
//
// One wrapper so eleven screens cannot each invent their own heading size,
// gutter and card treatment. That drift is what made the old settings tree
// feel like eleven small apps: same data, same role, different furniture.
//
// `action` holds the screen's single primary button (New category, Invite
// user). Screens with a sticky save bar have no `action` — their primary
// button lives in the bar, and two primaries in view breaks §4.6.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SettingsPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid content-start gap-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-h2 text-text-primary">{title}</h1>
          {description ? (
            <p className="text-body text-text-secondary max-w-prose">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A titled block inside a panel — "Bank details", "Tally ledger names". */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-line bg-bg-surface grid content-start gap-4 rounded-lg border p-5",
        className
      )}
    >
      <div className="grid gap-1">
        <h2 className="text-h3 text-text-primary">{title}</h2>
        {description ? (
          <p className="text-meta text-text-tertiary max-w-prose">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
