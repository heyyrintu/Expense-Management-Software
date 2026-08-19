"use client";

// Route error boundary body (D5.1).
//
// ── ONE COMPONENT, TWO RECOVERIES ─────────────────────────────────────────
// Next.js error boundaries inherit down the tree, so `app/(app)/error.tsx`
// already catches every tenant screen. A route only earns its own boundary
// when the useful recovery is DIFFERENT — and on a detail screen it is:
// "Try again" is the right offer when a list failed to load, but when one
// report won't open, the reader's actual next move is back to the list.
//
// So detail routes pass `backHref`, and get both actions. Everything else
// inherits the group boundary and gets Try again alone.
//
// COPY VOICE (design-craft, and the D5.1 brief): direct, no apology, no
// exclamation mark, never blames the reader. "Couldn't load this report" —
// not "Oops! Something went wrong." The reader already knows something went
// wrong; what they don't know is what failed and what to do next.
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export function RouteError({
  /** What failed, in the reader's words. "Couldn't load this report". */
  headline,
  /** One line on what to do. Omit for the standard retry line. */
  description,
  reset,
  backHref,
  backLabel,
}: {
  headline: string;
  description?: string;
  reset: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <ErrorState
      headline={headline}
      description={
        description ??
        "This is usually temporary. Try again, and if it keeps happening your org admin can raise it with support."
      }
      action={
        <span className="flex flex-wrap items-center justify-center gap-2">
          {/* Retry first: it is the cheaper move and it usually works. */}
          <Button onClick={reset}>Try again</Button>
          {backHref ? (
            <Button asChild variant="secondary">
              <Link href={backHref}>{backLabel ?? "Go back"}</Link>
            </Button>
          ) : null}
        </span>
      }
    />
  );
}
