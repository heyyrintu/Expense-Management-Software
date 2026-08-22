// Date formatting (D1.1). formatDate has been in use since 1.0; formatRelative
// and the UTC contract are new and are what these lock down.
import { describe, expect, it } from "vitest";

import {
  formatCount,
  formatDate,
  formatRelative,
  toDateInputValue,
  toIsoString,
} from "@/lib/format";

const NOW = new Date("2026-08-19T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatDate", () => {
  it("renders dd MMM yyyy", () => {
    expect(formatDate(new Date("2026-08-12T00:00:00Z"))).toBe("12 Aug 2026");
  });

  it("accepts a string", () => {
    expect(formatDate("2026-01-05T00:00:00Z")).toBe("05 Jan 2026");
  });

  it("formats in UTC, so a calendar date never slips a day", () => {
    // 00:00Z is the previous evening anywhere west of Greenwich. The date on
    // an expense filed on the 12th must read "12 Aug" for every viewer.
    expect(formatDate(new Date("2026-08-12T00:00:00Z"))).toBe("12 Aug 2026");
    expect(formatDate(new Date("2026-08-12T23:59:59Z"))).toBe("12 Aug 2026");
  });

  it("pads the day, so a column of dates aligns", () => {
    expect(formatDate("2026-08-05T00:00:00Z")).toBe("05 Aug 2026");
  });
});

describe("toDateInputValue / toIsoString", () => {
  it("gives yyyy-mm-dd for date inputs", () => {
    expect(toDateInputValue("2026-08-12T10:30:00Z")).toBe("2026-08-12");
  });

  it("gives the full instant for the time element", () => {
    expect(toIsoString(new Date("2026-08-12T10:30:00Z"))).toBe("2026-08-12T10:30:00.000Z");
  });
});

describe("formatRelative", () => {
  it("collapses the last minute to 'just now'", () => {
    expect(formatRelative(ago(5_000), NOW)).toBe("just now");
    expect(formatRelative(NOW, NOW)).toBe("just now");
  });

  it("counts minutes and hours, singular and plural", () => {
    expect(formatRelative(ago(MINUTE), NOW)).toBe("1 minute ago");
    expect(formatRelative(ago(2 * MINUTE), NOW)).toBe("2 minutes ago");
    expect(formatRelative(ago(HOUR), NOW)).toBe("1 hour ago");
    expect(formatRelative(ago(5 * HOUR), NOW)).toBe("5 hours ago");
  });

  it("prefers hours to 'yesterday' inside 24 hours, even across midnight", () => {
    // 13 hours ago is the previous date, but "13 hours ago" is more use to
    // the reader than "yesterday". Hours win until the 24-hour mark.
    expect(formatRelative(new Date("2026-08-18T23:00:00Z"), NOW)).toBe("13 hours ago");
  });

  it("counts calendar days past 24 hours, not 24-hour blocks", () => {
    // Both of these are "1 day ago" if you divide by 86,400,000. They are
    // different days to a reader, and the label has to agree with the reader.
    expect(formatRelative(new Date("2026-08-18T06:00:00Z"), NOW)).toBe("yesterday"); // 30h
    expect(formatRelative(new Date("2026-08-17T23:00:00Z"), NOW)).toBe("2 days ago"); // 37h
    expect(formatRelative(ago(2 * DAY), NOW)).toBe("2 days ago");
    expect(formatRelative(ago(29 * DAY), NOW)).toBe("29 days ago");
  });

  it("gives up past 30 days and returns the absolute date", () => {
    // "47 days ago" makes the reader do the arithmetic the format was meant
    // to save them.
    expect(formatRelative(new Date("2026-06-01T12:00:00Z"), NOW)).toBe("01 Jun 2026");
  });

  it("handles the future", () => {
    expect(formatRelative(new Date("2026-08-20T12:00:00Z"), NOW)).toBe("tomorrow");
    expect(formatRelative(new Date("2026-08-22T12:00:00Z"), NOW)).toBe("in 3 days");
    expect(formatRelative(new Date("2026-08-19T15:00:00Z"), NOW)).toBe("in 3 hours");
  });

  it("never returns an empty or 'NaN' string for any offset in range", () => {
    for (let d = -40; d <= 40; d += 1) {
      const out = formatRelative(new Date(NOW.getTime() + d * DAY), NOW);
      expect(out).not.toMatch(/NaN|undefined/);
      expect(out.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// formatCount (D-7)
//
// Extracted out of components/ui/stat-card.tsx, where it was an inline
// `toLocaleString("en-IN")` — a hard-coded locale inside a design-system
// primitive, which made every KPI in the product Indian-formatted from a line
// nobody would think to grep. These lock the behaviour so moving the locale
// later is one edit with a test that fails if it is missed.
// ---------------------------------------------------------------------------
describe("formatCount", () => {
  it("groups Indian-style, matching formatMoney and formatDate", () => {
    // 12,34,567 rather than 1,234,567 — the same convention as the rest of
    // the app, which is the only reason it is acceptable to hard-code at all.
    expect(formatCount(1234567)).toBe("12,34,567");
    expect(formatCount(100000)).toBe("1,00,000");
  });

  it("leaves small numbers alone", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(7)).toBe("7");
    expect(formatCount(999)).toBe("999");
  });

  it("renders a count as a whole number", () => {
    // A KPI count is never fractional; if one arrives, showing "12.4 expenses"
    // is worse than rounding it.
    expect(formatCount(12.4)).toBe("12");
  });

  it("handles negatives", () => {
    expect(formatCount(-4200)).toBe("-4,200");
  });

  it("returns an em dash for non-finite input, never 'NaN'", () => {
    // A KPI that has not loaded is a missing value; "NaN" reads as a bug in
    // the figure itself and sends the reader looking for one.
    expect(formatCount(Number.NaN)).toBe("—");
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
