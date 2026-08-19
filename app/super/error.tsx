"use client";

// Platform admin error boundary (D5.1). Same treatment as the tenant app —
// super_admin screens were falling through to the unstyled global boundary.
import { RouteError } from "@/components/ui/route-error";

export default function SuperError({ reset }: { error: Error; reset: () => void }) {
  return <RouteError headline="Couldn't load this page" reset={reset} />;
}
