// Date-range presets for the filter bar (D1.3).
//
// UTC throughout, for the same reason lib/format.ts formats in UTC: expense
// dates are calendar dates stored at UTC midnight, so a range computed in the
// viewer's local zone would include or exclude the boundary day depending on
// where the viewer happens to be sitting. A filter that returns different
// rows in Mumbai and London is not a filter.
//
// Ranges are INCLUSIVE at both ends and expressed as yyyy-mm-dd strings —
// the same shape the URL carries and the same shape buildExpenseListWhere
// expects, so nothing has to convert between representations.

export type DateRange = { from: string; to: string };

export const RANGE_PRESETS = [
  "this_month",
  "last_month",
  "this_quarter",
  "custom",
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABELS: Record<RangePreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  custom: "Custom",
};

export function isRangePreset(v: unknown): v is RangePreset {
  return typeof v === "string" && (RANGE_PRESETS as readonly string[]).includes(v);
}

/** yyyy-mm-dd for a UTC date. */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Last calendar day of the given UTC month. Day 0 of the next month. */
function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}

/**
 * Resolve a preset against a clock. `custom` has no computed range — it means
 * "the user picked the dates themselves", so it returns null and the caller
 * keeps whatever from/to it already had.
 */
export function resolvePreset(preset: RangePreset, now: Date = new Date()): DateRange | null {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  switch (preset) {
    case "this_month":
      return {
        from: toDateString(new Date(Date.UTC(year, month, 1))),
        to: toDateString(endOfMonth(year, month)),
      };
    case "last_month": {
      // Date.UTC normalises month -1 to December of the previous year, so
      // January needs no special case.
      const start = new Date(Date.UTC(year, month - 1, 1));
      return {
        from: toDateString(start),
        to: toDateString(endOfMonth(start.getUTCFullYear(), start.getUTCMonth())),
      };
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      return {
        from: toDateString(new Date(Date.UTC(year, quarterStartMonth, 1))),
        to: toDateString(endOfMonth(year, quarterStartMonth + 2)),
      };
    }
    case "custom":
      return null;
  }
}

/**
 * The preset a range corresponds to, or "custom" when it matches none. Lets
 * a URL carrying raw dates still light up the right preset button — the URL
 * stores dates, not the preset name, so a shared link means the same period
 * next month as it does today.
 */
export function presetForRange(range: Partial<DateRange>, now: Date = new Date()): RangePreset {
  if (!range.from || !range.to) return "custom";
  for (const preset of RANGE_PRESETS) {
    if (preset === "custom") continue;
    const resolved = resolvePreset(preset, now);
    if (resolved && resolved.from === range.from && resolved.to === range.to) return preset;
  }
  return "custom";
}
