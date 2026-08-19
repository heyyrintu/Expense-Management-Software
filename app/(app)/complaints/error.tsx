"use client";

// Complaints list error boundary (D5.1).
import { RouteError } from "@/components/ui/route-error";

export default function ComplaintsError({ reset }: { error: Error; reset: () => void }) {
  return <RouteError headline="Couldn't load complaints" reset={reset} />;
}
