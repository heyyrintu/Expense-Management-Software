// Shared field chrome (DESIGN-PRD §6.1): label above, helper below, error
// REPLACES the helper in the danger token. One implementation so every
// control in a form lines up and announces itself the same way.
import * as React from "react";

import { cn } from "@/lib/utils";

/** Base input surface: 36px, 1px line-strong, radius sm, 2px accent focus ring. */
export const fieldSurface = [
  "w-full min-w-0 rounded-sm border border-line-strong bg-bg-surface",
  "px-3 text-body text-text-primary placeholder:text-text-tertiary",
  "transition-[border-color,box-shadow] duration-instant ease-out",
  "outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
  "disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-tertiary",
  "aria-[invalid=true]:border-status-danger aria-[invalid=true]:focus-visible:ring-status-danger",
].join(" ");

export const FIELD_HEIGHT = "h-9"; // 36px (§6.1)

export function Field({
  label,
  htmlFor,
  helper,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const describedBy = error ? `${htmlFor}-error` : helper ? `${htmlFor}-helper` : undefined;
  return (
    <div className={cn("grid gap-2", className)} data-slot="field">
      <label htmlFor={htmlFor} className="text-label text-text-secondary">
        {label}
        {required ? (
          <span className="text-status-danger-text ml-1" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {/* The control is cloned only to attach describedby when we own the id. */}
      <div aria-describedby={describedBy}>{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-meta text-status-danger-text">
          {error}
        </p>
      ) : helper ? (
        <p id={`${htmlFor}-helper`} className="text-meta text-text-tertiary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
