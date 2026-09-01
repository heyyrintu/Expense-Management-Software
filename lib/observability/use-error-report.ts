"use client";

import { useEffect } from "react";
import { reportError } from "./report";

/**
 * Reports an error a route boundary caught. Every `error.tsx` in the app
 * received `error` and dropped it, so a broken screen produced a friendly
 * message and no record anywhere.
 *
 * Keyed on the error object: React remounts the boundary with a new one per
 * failure, so a repeated failure is reported each time, while a re-render
 * of the same failure is not.
 */
export function useErrorReport(
  error: Error & { digest?: string },
  at: string
): void {
  useEffect(() => {
    reportError(error, { at: `boundary:${at}`, digest: error.digest });
  }, [error, at]);
}
