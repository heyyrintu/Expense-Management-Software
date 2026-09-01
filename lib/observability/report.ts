// One place errors are reported from.
//
// There was no error reporting at all: route boundaries received `error`
// and dropped it, and every `catch` that degraded gracefully degraded
// silently. In production that means a broken screen is invisible until a
// user describes it over chat.
//
// This deliberately adds no dependency. It emits ONE JSON object per line
// on stderr, which every log aggregator (CloudWatch, Loki, Datadog, a
// container platform's log tab) can parse without configuration. When you
// adopt an APM, `emit` is the only function that changes — call sites do
// not.
//
// It must never throw. A reporter that can fail turns a handled error into
// an unhandled one, which is strictly worse than the silence it replaced.

export type ErrorContext = {
  /** Where this came from, e.g. "route:/api/receipts" or "boundary:(app)". */
  at: string;
  /** Next.js error digest, when the boundary was given one. */
  digest?: string;
  /** Never put tenant data, amounts or bank details in here. */
  meta?: Record<string, string | number | boolean | null>;
};

type Payload = {
  level: "error";
  at: string;
  message: string;
  name: string;
  stack?: string;
  digest?: string;
  meta?: ErrorContext["meta"];
};

function toPayload(error: unknown, ctx: ErrorContext): Payload {
  const e = error instanceof Error ? error : undefined;
  return {
    level: "error",
    at: ctx.at,
    name: e?.name ?? typeof error,
    // String(error) rather than a cast: a thrown string or object still has
    // to produce something readable.
    message: e?.message ?? String(error),
    stack: e?.stack,
    digest: ctx.digest,
    meta: ctx.meta,
  };
}

function emit(payload: Payload): void {
  // console.error, not process.stderr.write: this module is imported by
  // client boundaries too, and there is no process there.
  console.error(JSON.stringify(payload));
}

export function reportError(error: unknown, ctx: ErrorContext): void {
  try {
    emit(toPayload(error, ctx));
  } catch {
    // Reporting is best-effort by definition. Swallowing here is the one
    // place a silent catch is correct.
  }
}

/**
 * Security-relevant events that are NOT exceptions — a webhook signature
 * that did not verify, a job endpoint called with the wrong bearer. These
 * are the events worth alerting on, and they were previously a
 * `console.warn` with no structure and no way to count them.
 */
export function reportSecurityEvent(
  event: string,
  meta?: ErrorContext["meta"]
): void {
  try {
    emit({ level: "error", at: `security:${event}`, name: "SecurityEvent", message: event, meta });
  } catch {
    /* best effort */
  }
}
