// Send-retry policy (8.3) — pure so the backoff curve is unit-testable.
export const MAX_SEND_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

/** Exponential backoff: 500ms, 1s, 2s… capped. */
export function backoffMs(attempt: number): number {
  const capped = Math.min(Math.max(attempt, 1), 6);
  return BASE_DELAY_MS * 2 ** (capped - 1);
}

/**
 * Only transient problems are worth retrying. A rejected template name or a
 * number outside the allowed list will fail identically every time, so those
 * are recorded and dropped instead of hammering the API.
 */
export function isRetryable(error: string | undefined): boolean {
  if (!error) return true;
  const e = error.toLowerCase();
  const permanent = [
    "template",
    "not exist",
    "invalid parameter",
    "recipient",
    "unsupported",
    "permission",
    "authent",
    "token",
  ];
  return !permanent.some((p) => e.includes(p));
}

export function shouldRetry(attempt: number, error: string | undefined): boolean {
  return attempt < MAX_SEND_ATTEMPTS && isRetryable(error);
}
