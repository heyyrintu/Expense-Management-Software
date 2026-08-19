import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Layout furniture shared by every gallery section (D0.5).
 *
 * The gallery is allowed to be plainer than the app: it is a workbench, not a
 * screen. Its job is to put specimens against a neutral background with
 * enough label to identify them, and then get out of the way.
 */

/** A top-level group — one entry in the table of contents. */
export function Group({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    // scroll-mt clears the sticky header when an anchor is followed.
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16 grid gap-6">
      <div className="grid gap-1">
        <p className="text-meta text-text-tertiary uppercase">{eyebrow}</p>
        <h2 id={`${id}-heading`} className="text-h1 text-text-primary">
          {title}
        </h2>
        <p className="text-body text-text-secondary max-w-2xl">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** A subsection within a group. */
export function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="text-h2 text-text-primary">{title}</h3>
        {description ? (
          <p className="text-body text-text-secondary max-w-2xl">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** A bordered surface to stand specimens on. */
export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-line bg-bg-surface grid gap-4 rounded-lg border p-5", className)}>
      {/* h3, not h4: Panel is used both inside a Block and directly under a
          Group, and h2 → h4 would be a heading-order skip in the second case. */}
      {title ? <h3 className="text-h3 text-text-primary">{title}</h3> : null}
      {children}
    </div>
  );
}

/** A labelled row of specimens. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="text-meta text-text-tertiary">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/**
 * Marks a specimen that does not yet meet the design system — with the task
 * that fixes it. A review surface that hides its own debt isn't one.
 */
export function DebtNote({ owner, children }: { owner: string; children: React.ReactNode }) {
  return (
    <p className="border-status-warning-subtle bg-status-warning-subtle text-status-warning-text rounded-md border p-3 text-meta">
      <span className="font-medium">Known deviation · {owner}</span> — {children}
    </p>
  );
}
