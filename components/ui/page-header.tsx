import * as React from "react";

import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * PageHeader (D0.4) — the one way a screen states what it is.
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
 * Server component: no state, no handlers. Whatever is passed as `action`
 * brings its own interactivity.
 */
function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}) {
  return (
    <div data-slot="page-header" className={cn("grid gap-2 pb-6", className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      {/* Wraps rather than truncates: a long title stacking above its action
          is better than a title you can't read. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-h1 text-text-primary">{title}</h1>
          {description ? (
            <p className="text-body text-text-secondary max-w-2xl">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export { PageHeader };
