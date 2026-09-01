"use client";

// Expense detail error boundary (D5.1). Its own, because the useful recovery here is
// back to the list — "try again" is the right offer when a LIST failed, but
// when one record won't open the reader's next move is the one that will.
import { RouteError } from "@/components/ui/route-error";
import { useErrorReport } from "@/lib/observability/use-error-report";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useErrorReport(error, "expenses/[id]");

  return (
    <RouteError
      headline="Couldn't load this expense"
      reset={reset}
      backHref="/expenses"
      backLabel="All expenses"
    />
  );
}
