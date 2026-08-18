// Recurrence math (PLAN 6.5) — pure, unit-tested in tests/unit/recurring.test.ts.
// A template is DUE when its latest scheduled occurrence on-or-before `now`
// hasn't been drafted yet (lastRunAt < occurrence). Comparing against the
// occurrence (not "today") makes the daily cron duplicate-safe AND lets a
// missed day catch up on the next run.

export type Cadence = "monthly" | "weekly";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(d: Date): number {
  const js = d.getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/**
 * Latest scheduled occurrence on or before `now` (UTC midnight), or null
 * when the schedule has no past occurrence yet.
 * monthly: `day` 1–28 (validated upstream — every month has these days).
 * weekly:  `day` ISO weekday 1–7.
 */
export function occurrenceOnOrBefore(
  cadence: Cadence,
  day: number,
  now: Date
): Date | null {
  const today = utcMidnight(now);
  if (cadence === "monthly") {
    if (day < 1 || day > 28) return null;
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    if (thisMonth.getTime() <= today.getTime()) return thisMonth;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day));
  }
  if (day < 1 || day > 7) return null;
  const diff = (isoWeekday(today) - day + 7) % 7;
  return new Date(today.getTime() - diff * DAY_MS);
}

/** Should the cron draft this template now? */
export function isDue(
  template: { cadence: Cadence; day: number; lastRunAt: Date | null },
  now: Date
): { due: false } | { due: true; occurrence: Date } {
  const occurrence = occurrenceOnOrBefore(template.cadence, template.day, now);
  if (!occurrence) return { due: false };
  if (template.lastRunAt && template.lastRunAt.getTime() >= occurrence.getTime()) {
    return { due: false };
  }
  return { due: true, occurrence };
}
