"use client";

// Category detail error boundary (D5.1). Its own, because the useful recovery here is
// back to the list — "try again" is the right offer when a LIST failed, but
// when one record won't open the reader's next move is the one that will.
import { RouteError } from "@/components/ui/route-error";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <RouteError
      headline="Couldn't load this category"
      reset={reset}
      backHref="/settings/categories"
      backLabel="All categories"
    />
  );
}
