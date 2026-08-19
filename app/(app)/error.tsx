"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

/**
 * Route-level error boundary for every tenant screen.
 *
 * D0.5 moved this onto the shared ErrorState so the trio in /design-system is
 * the real thing rather than a mock-up. `reset` is the recovery action the
 * component insists on.
 */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      headline="Couldn't load this page"
      description="Try again. If it keeps happening, your org admin can check with support."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
