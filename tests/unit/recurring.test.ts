import { describe, expect, it } from "vitest";
import {
  isDue,
  isoWeekday,
  occurrenceOnOrBefore,
} from "@/lib/domain/recurring";
import { isValidDelegationPair } from "@/lib/domain/delegation";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("occurrenceOnOrBefore — monthly", () => {
  it("this month's day when it has passed; previous month's otherwise", () => {
    expect(occurrenceOnOrBefore("monthly", 5, d("2026-08-18"))?.toISOString())
      .toBe("2026-08-05T00:00:00.000Z");
    expect(occurrenceOnOrBefore("monthly", 25, d("2026-08-18"))?.toISOString())
      .toBe("2026-07-25T00:00:00.000Z");
    expect(occurrenceOnOrBefore("monthly", 18, d("2026-08-18"))?.toISOString())
      .toBe("2026-08-18T00:00:00.000Z"); // today counts
  });
  it("year rollover (January looking back to December)", () => {
    expect(occurrenceOnOrBefore("monthly", 20, d("2026-01-05"))?.toISOString())
      .toBe("2025-12-20T00:00:00.000Z");
  });
  it("rejects day 29–31 (validated upstream)", () => {
    expect(occurrenceOnOrBefore("monthly", 29, d("2026-08-18"))).toBeNull();
  });
});

describe("occurrenceOnOrBefore — weekly", () => {
  // 2026-08-18 is a Tuesday (ISO 2)
  it("weekday math incl. same-day and wrap", () => {
    expect(isoWeekday(d("2026-08-18"))).toBe(2);
    expect(occurrenceOnOrBefore("weekly", 2, d("2026-08-18"))?.toISOString())
      .toBe("2026-08-18T00:00:00.000Z");
    expect(occurrenceOnOrBefore("weekly", 1, d("2026-08-18"))?.toISOString())
      .toBe("2026-08-17T00:00:00.000Z");
    expect(occurrenceOnOrBefore("weekly", 7, d("2026-08-18"))?.toISOString())
      .toBe("2026-08-16T00:00:00.000Z"); // last Sunday
    expect(occurrenceOnOrBefore("weekly", 3, d("2026-08-18"))?.toISOString())
      .toBe("2026-08-12T00:00:00.000Z"); // last Wednesday
  });
});

describe("isDue — duplicate-safe drafting", () => {
  const tpl = { cadence: "monthly" as const, day: 15, lastRunAt: null as Date | null };

  it("due when never run and the day has passed", () => {
    const r = isDue(tpl, d("2026-08-18"));
    expect(r.due).toBe(true);
    if (r.due) expect(r.occurrence.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("NOT due again after drafting — same day, next day, rest of the month", () => {
    const ran = { ...tpl, lastRunAt: d("2026-08-15") };
    expect(isDue(ran, d("2026-08-15")).due).toBe(false);
    expect(isDue(ran, d("2026-08-16")).due).toBe(false);
    expect(isDue(ran, d("2026-08-31")).due).toBe(false);
  });

  it("due again at the next occurrence", () => {
    const ran = { ...tpl, lastRunAt: d("2026-08-15") };
    const r = isDue(ran, d("2026-09-15"));
    expect(r.due).toBe(true);
    if (r.due) expect(r.occurrence.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("cron missed the exact day → catches up on the next run", () => {
    const r = isDue(tpl, d("2026-08-17")); // job down on the 15th/16th
    expect(r.due).toBe(true);
    if (r.due) expect(r.occurrence.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("weekly dedupe works the same way", () => {
    const wk = { cadence: "weekly" as const, day: 1, lastRunAt: d("2026-08-17") };
    expect(isDue(wk, d("2026-08-18")).due).toBe(false);
    expect(isDue(wk, d("2026-08-24")).due).toBe(true);
  });
});

describe("delegation pair", () => {
  it("no self-delegation", () => {
    expect(isValidDelegationPair("u1", "u1")).toBe(false);
    expect(isValidDelegationPair("u1", "u2")).toBe(true);
  });
});
