// Per-diem allowances (PRD P1) — PURE. No database, no formatting.
//
// ═══ THE HALF-DAY RULE ════════════════════════════════════════════════════
// Stated once, here, because "how do half days work" is the question every
// per-diem implementation answers implicitly and then argues about later.
//
//   A claim covers an inclusive date range. Every day in it is a FULL day,
//   except that the FIRST and the LAST day may each be marked a half day —
//   the travel-day convention, where you leave after lunch and come back
//   before it. No other day can be half: a half day in the middle of a trip
//   is not a thing that happens, and allowing it would turn an auditable
//   range into an arbitrary number somebody typed.
//
// Consequences, all deliberate:
//
//   * Days are counted in HALF-DAY UNITS internally (`halfDays`), so the
//     stored quantity is an integer. 3 full days = 6. 4 days with a half at
//     each end = 8 − 1 − 1 = 6. Storing "3.5 days" as a float would put a
//     binary fraction into the one place this codebase refuses them.
//
//   * A ONE-DAY claim has a single day that is both first and last, so the
//     two flags collapse: marking either (or both) yields one half day, never
//     zero. A zero-value per-diem is not a claim, it is a mistake, and
//     `planPerDiem` refuses it rather than silently saving ₹0.
//
//   * ROUNDING. amount = dailyAmount × halfDays ÷ 2. The product is an
//     integer, so the division is exact except when `halfDays` is odd and
//     `dailyAmount` is odd — the result is then exactly x.5, and we round
//     HALF UP, in the employee's favour. Deterministic, and at most one minor
//     unit. No other rounding happens anywhere in the calculation: we do NOT
//     round a half-day rate first and then multiply, which would compound the
//     error once per day and drift by rupees over a long trip.
// ══════════════════════════════════════════════════════════════════════════
//
// Rates are versioned rather than edited in place — see the doc comment on
// PerDiemRate in schema.prisma. `selectEffectiveRate` implements the lookup;
// the chosen row's id is pinned onto the expense so a later rate change
// cannot re-price an expense that has already been approved.

/** One stored rate version. */
export type PerDiemRateRow = {
  id: string;
  name: string;
  location: string | null;
  /** Minor units, org base currency. */
  dailyAmount: number;
  /** Calendar date at UTC midnight. */
  effectiveFrom: Date;
  active: boolean;
};

export type PerDiemClaim = {
  /** Inclusive. Both are calendar dates at UTC midnight. */
  start: Date;
  end: Date;
  firstDayHalf: boolean;
  lastDayHalf: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Calendar days between two UTC-midnight dates, inclusive of both ends. */
export function inclusiveDayCount(start: Date, end: Date): number {
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((b - a) / MS_PER_DAY) + 1;
}

/**
 * The claim expressed in half-day units.
 *
 * Returns null when the range is inverted — that is a typo, and a silent
 * swap would price a trip the reader did not describe.
 */
export function halfDaysFor(claim: PerDiemClaim): number | null {
  const days = inclusiveDayCount(claim.start, claim.end);
  if (days < 1) return null;

  // One day is both the first and the last, so the flags collapse rather than
  // subtracting twice and reaching zero.
  if (days === 1) {
    return claim.firstDayHalf || claim.lastDayHalf ? 1 : 2;
  }

  return days * 2 - (claim.firstDayHalf ? 1 : 0) - (claim.lastDayHalf ? 1 : 0);
}

/**
 * Amount in minor units for a whole-number count of half-days.
 *
 * The only rounding in the feature, and it can only ever fire on an odd rate
 * with an odd half-day count. Half up.
 */
export function perDiemAmount(dailyAmount: number, halfDays: number): number | null {
  if (!Number.isSafeInteger(dailyAmount) || dailyAmount <= 0) return null;
  if (!Number.isSafeInteger(halfDays) || halfDays < 1) return null;
  const product = dailyAmount * halfDays;
  if (!Number.isSafeInteger(product)) return null;
  // `product / 2` is exact in binary floating point for any safe integer, so
  // the value is either whole or exactly .5 — Math.round then rounds .5 up
  // deterministically rather than to-even.
  const amount = Math.round(product / 2);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/**
 * The rate version in force for a trip.
 *
 * Newest `effectiveFrom` at or before `onDate`, among ACTIVE rows of that
 * name. Returns null when the name has no version yet in force — a rate
 * created for next quarter must not price this month's trip, and falling back
 * to "the closest one" would do exactly that without saying so.
 *
 * Ties are impossible: (orgId, name, effectiveFrom) is unique in the schema.
 */
export function selectEffectiveRate(
  rates: PerDiemRateRow[],
  name: string,
  onDate: Date
): PerDiemRateRow | null {
  const day = Date.UTC(onDate.getUTCFullYear(), onDate.getUTCMonth(), onDate.getUTCDate());
  const candidates = rates
    .filter((r) => r.active && r.name === name)
    .filter((r) => {
      const from = Date.UTC(
        r.effectiveFrom.getUTCFullYear(),
        r.effectiveFrom.getUTCMonth(),
        r.effectiveFrom.getUTCDate()
      );
      return from <= day;
    })
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return candidates[0] ?? null;
}

/** The distinct rate names an org offers, each with its currently-in-force
 *  version. What the capture form lists — a reader picks an allowance, not a
 *  historical row. */
export function currentRateOptions(
  rates: PerDiemRateRow[],
  onDate: Date
): Array<{ name: string; location: string | null; dailyAmount: number; rateId: string }> {
  const names = [...new Set(rates.filter((r) => r.active).map((r) => r.name))].sort();
  return names.flatMap((name) => {
    const rate = selectEffectiveRate(rates, name, onDate);
    return rate
      ? [
          {
            name: rate.name,
            location: rate.location,
            dailyAmount: rate.dailyAmount,
            rateId: rate.id,
          },
        ]
      : [];
  });
}

export type PerDiemPlan = {
  rateId: string;
  dailyAmount: number;
  halfDays: number;
  /** Presentational only — 6 half-days reads as "3 days". */
  days: number;
  amount: number;
  start: Date;
  end: Date;
};

/**
 * Everything the action needs to persist a per-diem expense, or a reason it
 * cannot. ONE function so the read-only preview in the form and the amount
 * written to the database are the same arithmetic — a preview that disagrees
 * with the server is a screen promising money that will not arrive.
 */
export function planPerDiem(
  rates: PerDiemRateRow[],
  input: { rateName: string } & PerDiemClaim
): PerDiemPlan | { error: string } {
  const halfDays = halfDaysFor(input);
  if (halfDays === null) {
    return { error: "The end date is before the start date." };
  }
  // Guarded by halfDaysFor's one-day collapse, but asserted rather than
  // assumed: a zero-value claim must never reach the database.
  if (halfDays < 1) {
    return { error: "A per-diem claim has to cover at least half a day." };
  }

  // The rate in force on the day the trip STARTS prices the whole claim. A
  // trip spanning a rate change would otherwise need splitting mid-claim,
  // which is a policy decision finance should make deliberately by filing two
  // expenses — not something this function should infer.
  const rate = selectEffectiveRate(rates, input.rateName, input.start);
  if (!rate) {
    return {
      error:
        "No per-diem rate is in force for those dates — ask a finance admin to check the rate's effective date.",
    };
  }

  const amount = perDiemAmount(rate.dailyAmount, halfDays);
  if (amount === null) {
    return { error: "That date range is too long to price." };
  }

  return {
    rateId: rate.id,
    dailyAmount: rate.dailyAmount,
    halfDays,
    days: halfDays / 2,
    amount,
    start: input.start,
    end: input.end,
  };
}

/** "3 days" / "2.5 days" / "half a day" — the human form of a half-day count. */
export function describeDays(halfDays: number): string {
  if (halfDays === 1) return "half a day";
  const days = halfDays / 2;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** The merchant field for a per-diem row. Expenses need a merchant and a
 *  per-diem has no vendor, so it names the allowance — which is what makes it
 *  legible in the list, the ledger and the CSV with no special-casing. */
export function perDiemMerchant(rateName: string): string {
  return `Per diem — ${rateName}`;
}
