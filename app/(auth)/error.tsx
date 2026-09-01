"use client";

// Auth error boundary (D5.1).
//
// This group had none, so a failure on sign-in fell through to
// app/global-error.tsx — a bare document with none of the app's styling, on
// the one screen where a stranger forms their first impression.
//
// No "go back": the reader isn't signed in, so there is nowhere behind them.
import { RouteError } from "@/components/ui/route-error";
import { useErrorReport } from "@/lib/observability/use-error-report";

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useErrorReport(error, "(auth)");

  return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6">
      <RouteError
        headline="Couldn't load this page"
        description="This is usually temporary. Try again in a moment."
        reset={reset}
      />
    </div>
  );
}
