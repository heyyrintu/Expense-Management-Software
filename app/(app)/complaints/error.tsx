"use client";

// Complaints list error boundary (D5.1).
import { RouteError } from "@/components/ui/route-error";
import { useErrorReport } from "@/lib/observability/use-error-report";

export default function ComplaintsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useErrorReport(error, "complaints");

  return <RouteError headline="Couldn't load complaints" reset={reset} />;
}
