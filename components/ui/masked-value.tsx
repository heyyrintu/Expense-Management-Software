"use client";

// Masked value with a reveal (D4.4) — used for a bank account number.
//
// ── THE REVEAL FETCHES; IT DOES NOT UNHIDE ────────────────────────────────
// The unmasked value is NEVER in the page. `onReveal` is a server action that
// returns it, and it is held in component state only until the reader hides
// it again or navigates away.
//
// That distinction is the entire security value. A component that renders the
// full number and CSS-hides it has already shipped it: to the DOM, to a view-
// source, to any extension on the page, and to a screenshot of the React
// tree. Masking is a property of what was sent, not of what is displayed.
//
// The caller's action must resolve the identity from the SESSION and take no
// id parameter, so it structurally cannot be aimed at another person's row.
import * as React from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MaskedValue({
  /** What the server already sent — e.g. "••••••4477". */
  masked,
  onReveal,
  label,
  className,
}: {
  masked: string;
  /** Server action returning the full value for the CURRENT session's own
   *  record. Null means it could not be read. */
  onReveal: () => Promise<string | null>;
  /** Announced with the control — "Reveal account number". */
  label: string;
  className?: string;
}) {
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggle() {
    if (revealed !== null) {
      // Hiding drops the value from state entirely rather than keeping it
      // behind a flag — nothing lingering for the next render to leak.
      setRevealed(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const value = await onReveal();
      if (value === null) {
        setError("Couldn't read that right now.");
        return;
      }
      setRevealed(value);
    });
  }

  return (
    <span className={cn("grid gap-1", className)}>
      <span className="flex flex-wrap items-center gap-2">
        {/* Tabular either way, so revealing doesn't reflow the row. */}
        <span className="text-body text-text-primary tabular">
          {revealed ?? masked}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={toggle}
          disabled={pending}
          aria-label={revealed !== null ? `Hide ${label}` : `Reveal ${label}`}
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : revealed !== null ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
          {revealed !== null ? "Hide" : "Reveal"}
        </Button>
      </span>
      {error ? (
        <span role="alert" className="text-meta text-status-danger-text">
          {error}
        </span>
      ) : null}
    </span>
  );
}
