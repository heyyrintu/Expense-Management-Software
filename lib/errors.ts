// Single source for user-facing error messages and the typed action result.
export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}
export function err<T = undefined>(error: string): Result<T> {
  return { ok: false, error };
}

export const userErrors = {
  invalidCredentials: "Invalid organization, email, or password.",
  slugTaken: "That workspace URL is already taken.",
  emailTaken: "A user with that email already exists in this organization.",
  inviteInvalid: "This invite link is invalid or has expired.",
  notAuthenticated: "You must be signed in to do that.",
  notAuthorized: "You don't have permission to perform this action.",
  validation: "Please correct the highlighted fields.",
  // Names what failed and what to do. The old "Something went wrong.
  // Please try again." told the reader nothing they didn't already know
  // and apologised for it (D5.1).
  unknown: "That didn't go through. Nothing was changed — try again.",
} as const;

/** Policy flag copy — violations FLAG, never block (CLAUDE.md). */
export const policyMessages = {
  per_expense_limit: (limit: string) =>
    `Above the per-expense limit for this category (${limit}).`,
  monthly_limit: (limit: string) =>
    `This puts your monthly total for the category above its limit (${limit}).`,
  receipt_required: (threshold: string) =>
    `A receipt is required for amounts above ${threshold}.`,
  expense_age: (days: number) =>
    `This expense is older than ${days} days.`,
  duplicate: (merchant: string) =>
    `Looks like a duplicate: same amount, date, and merchant (${merchant}).`,
} as const;

/**
 * Copy for a mutation that didn't land (D5.1).
 *
 * ── VOICE ─────────────────────────────────────────────────────────────────
 * Direct, no apology, no exclamation mark, never blames the reader. Say what
 * did not happen and what state their work is in — the reader's real question
 * after a failed save is "did I lose it?", and every line below answers that
 * before anything else.
 *
 * "Something went wrong. Please try again." fails all of it: it names nothing,
 * says nothing about their data, and the "please" is an apology wearing a
 * politeness costume.
 */
export const failureMessages = {
  /** No network at all — navigator.onLine is false. */
  offline: {
    title: "You're offline",
    description:
      "Nothing was sent. Your changes are still here — reconnect and try again.",
  },
  /** The request went out and didn't come back cleanly. */
  unreachable: {
    title: "Couldn't reach the server",
    description: "Nothing was saved. Try again in a moment.",
  },
  /** The server answered with a refusal that has no message of its own. */
  refused: {
    title: "That didn't save",
    description: "Nothing was changed. Try again, or reload the page to see the current state.",
  },
} as const;

export type FailureCopy = { title: string; description: string };

/**
 * Which failure the reader is actually looking at.
 *
 * Offline is worth distinguishing because the advice differs: reconnecting is
 * something they can do, and "try again" while the tunnel is down is advice
 * that wastes their time. A server-supplied message always wins — it knows
 * whether the period was locked or the report already paid, and no generic
 * line beats that.
 */
export function failureCopy(input: {
  serverError?: string | null;
  online?: boolean;
}): FailureCopy {
  if (input.serverError) {
    return { title: input.serverError, description: "" };
  }
  if (input.online === false) return failureMessages.offline;
  return failureMessages.unreachable;
}

/**
 * One sentence for an inline error after a transport failure (D5.1).
 *
 * Forms show failures INLINE rather than as a toast — the message belongs
 * beside the fields it concerns, and a toast can be missed while the reader
 * is looking at the form. This gives those call sites the same offline-aware
 * copy the toast helper uses, so the two never diverge.
 */
export function offlineAwareMessage(): string {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const copy = online ? failureMessages.unreachable : failureMessages.offline;
  return `${copy.title}. ${copy.description}`;
}
