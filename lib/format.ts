// Date formatting for the app. THE ONLY PLACE A DATE BECOMES A STRING —
// components present through <DateCell>, and anything needing a plain string
// (emails, WhatsApp messages, CSV cells) calls these directly.
//
// TIMEZONE: everything here works in UTC. Expense dates are calendar dates
// stored at UTC midnight, so formatting them in the viewer's local zone would
// show "11 Aug" to anyone west of Greenwich for an expense filed on the 12th.
// Timestamps (createdAt, submittedAt) are instants and would be defensible in
// local time, but two date formats in one product is how "which day was
// that?" starts, so both use UTC and the whole app agrees with itself.

/** The project-wide date format: dd MMM yyyy → "12 Aug 2026". */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC", // expense dates are calendar dates stored at UTC midnight
  }).format(date);
}

/** yyyy-mm-dd for <input type="date"> values. */
export function toDateInputValue(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

/** Full ISO instant, for the <time dateTime> attribute. */
export function toIsoString(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString();
}

/** Whole UTC days from `a` to `b`, positive when `b` is later. */
function utcDayDelta(a: Date, b: Date): number {
  const dayA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const dayB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((dayB - dayA) / 86_400_000);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Relative time for ACTIVITY AND META CONTEXTS ONLY — "2 days ago" under a
 * comment, beside an audit entry, in a notification list.
 *
 * Never for an expense date, a report period or anything in a money column.
 * "3 days ago" is friendlier than "16 Aug 2026" and strictly worse: it can't
 * be compared to another row, can't be matched against a bank statement, and
 * silently changes meaning depending on when you read it.
 *
 * Past ~30 days it gives up and returns the absolute date. Relative time is a
 * shortcut for "recently"; "47 days ago" makes the reader do the arithmetic
 * the format was supposed to save them.
 *
 * `now` is injectable so the behaviour is testable rather than clock-dependent.
 */
export function formatRelative(d: Date | string, now: Date = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = now.getTime() - date.getTime();
  const past = diffMs >= 0;
  const absMs = Math.abs(diffMs);

  if (absMs < MINUTE) return "just now";

  if (absMs < HOUR) {
    const mins = Math.floor(absMs / MINUTE);
    return past ? `${plural(mins, "minute")} ago` : `in ${plural(mins, "minute")}`;
  }

  // Under 24 hours, hours win even when the calendar day has changed:
  // "13 hours ago" is more use than "yesterday", which is true but vaguer.
  // This is why the calendar-day branch below starts at 24h, not at midnight.
  if (absMs < 24 * HOUR) {
    const hours = Math.floor(absMs / HOUR);
    return past ? `${plural(hours, "hour")} ago` : `in ${plural(hours, "hour")}`;
  }

  // Past 24 hours, count CALENDAR days rather than 24-hour blocks, so the
  // label matches how the reader thinks: 25 hours ago is "yesterday" if it
  // falls on the previous date, and "2 days ago" if it falls the day before
  // that. Dividing by 86,400,000 would call both of them "1 day ago".
  const days = utcDayDelta(date, now);
  if (days === 1) return "yesterday";
  if (days === -1) return "tomorrow";
  if (days > 1 && days <= 30) return `${plural(days, "day")} ago`;
  if (days < -1 && days >= -30) return `in ${plural(-days, "day")}`;

  return formatDate(date);
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
