"use client";

// Route error boundary for every tenant screen (D5.1).
//
// Next.js boundaries inherit down the tree, so this ONE file catches every
// route under (app). Detail routes add their own only where the useful
// recovery differs — see components/ui/route-error.tsx.
import { RouteError } from "@/components/ui/route-error";
import { useErrorReport } from "@/lib/observability/use-error-report";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useErrorReport(error, "(app)");

  return <RouteError headline="Couldn't load this page" reset={reset} />;
}
