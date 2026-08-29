"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { sectionLabelFor } from "@/components/shell/nav";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * PageHeader (D0.4 · N2.1) — the one way a screen states what it is, and the
 * enforcement point for the Ledger Hall header pattern:
 *
 *   EYEBROW — Roman capitals, the nav section this screen belongs to
 *   Title — text-h1 in Bodoni Moda (font-display)
 *   ═══════ plate rule
 *
 *   <PageHeader
 *     breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: "R-1042" }]}
 *     title="R-1042"
 *     description="Four expenses · submitted 12 Aug"
 *     action={<Button>Submit</Button>}
 *   />
 *
 * `action` is the screen's SINGLE primary action (§4.6). If a screen needs a
 * second control, it is secondary or tertiary and goes here beside the
 * primary — but only one filled button may be in view.
 *
 * EYEBROW: derived from the nav model by pathname, so every screen gets it
 * without ~30 call sites each passing (and eventually mis-passing) their own
 * section name; the `eyebrow` prop overrides for screens the nav doesn't
 * name. It is suppressed when breadcrumbs render (two context lines above
 * one title is one too many) and when it would just repeat the title.
 *
 * This used to be a server component; the pathname lookup is why it is a
 * client one now. It holds no state and no handlers, and `action` arrives
 * as a prop, so whatever the page passes stays server-rendered.
 */
function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  eyebrow,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Overrides the nav-derived section label. Pass null to force none. */
  eyebrow?: string | null;
  className?: string;
}) {
  const pathname = usePathname();
  const derived = eyebrow === undefined ? sectionLabelFor(pathname) : eyebrow;
  const showEyebrow =
    !breadcrumbs?.length && derived != null && derived.toLowerCase() !== title.toLowerCase();

  return (
    <div data-slot="page-header" className={cn("grid gap-2 pb-6", className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      {showEyebrow ? <span className="eyebrow text-text-tertiary">{derived}</span> : null}
      {/* Wraps rather than truncates: a long title stacking above its action
          is better than a title you can't read. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-h1 font-display text-text-primary">{title}</h1>
          {description ? (
            <p className="text-body text-text-secondary max-w-2xl">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {/* The engraved rule under every page header — sanctioned position 1 of 3. */}
      <div aria-hidden="true" className="plate-rule" />
    </div>
  );
}

export { PageHeader };
