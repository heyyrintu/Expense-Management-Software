"use client";

import { Button } from "@/components/ui/button";

export default function ComplaintsError({ reset }: { reset: () => void }) {
  return (
    <section className="grid gap-3">
      <h1 className="text-lg font-semibold">We couldn&apos;t load complaints</h1>
      <p className="text-muted-foreground text-sm">
        Something went wrong on our side. Try again in a moment.
      </p>
      <div>
        <Button onClick={reset} size="sm">
          Try again
        </Button>
      </div>
    </section>
  );
}
