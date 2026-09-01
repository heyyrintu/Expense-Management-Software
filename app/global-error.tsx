"use client";

// Last-resort error boundary (covers the root layout itself). It cannot use
// the app's components or tokens: if the root layout is what failed, the
// providers those depend on are exactly what is missing. Hence inline
// styles here and nowhere else.
import { useErrorReport } from "@/lib/observability/use-error-report";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useErrorReport(error, "global");

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "32rem", padding: "1rem" }}>
          {/* This copy used to read "Something went wrong" / "Please try
              again — if it keeps happening, contact support." Both phrases
              are banned by DESIGN-PRD's voice rules and by
              scripts/check-copy-voice.mjs, which only scans headline/
              description/emptyMessage/title PROPS and so never saw raw JSX
              text. Says what happened and what to do, blames nobody. */}
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
            This page didn&rsquo;t load
          </h1>
          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.5 }}>
            The app hit an error it could not recover from. Reloading usually
            clears it.
          </p>
          <button
            onClick={reset}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
