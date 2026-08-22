// Per-diem arithmetic and rate selection (PRD P1).
//
// The half-day rule and the rounding it forces are decisions, not emergent
// behaviour — see the header of lib/domain/per-diem.ts. These lock them down,
// because "how does a half day work here" is the question that gets answered
// differently by two people six months apart.
import { describe, expect, it } from "vitest";

import {
  currentRateOptions,
  describeDays,
  halfDaysFor,
  inclusiveDayCount,
  perDiemAmount,
  perDiemMerchant,
  planPerDiem,
  selectEffectiveRate,
  type PerDiemRateRow,
} from "@/lib/domain/per-diem";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const rate = (
  over: Partial<PerDiemRateRow> & Pick<PerDiemRateRow, "id" | "name">
): PerDiemRateRow => ({
  location: null,
  dailyAmount: 250_000, // ₹2,500.00
  effectiveFrom: d("2026-01-01"),
  active: true,
  ...over,
});

describe("inclusiveDayCount", () => {
  it("counts both ends", () => {
    expect(inclusiveDayCount(d("2026-08-10"), d("2026-08-10"))).toBe(1);
    expect(inclusiveDayCount(d("2026-08-10"), d("2026-08-12"))).toBe(3);
  });

  it("crosses a month and a year boundary", () => {
    expect(inclusiveDayCount(d("2026-01-30"), d("2026-02-02"))).toBe(4);
    expect(inclusiveDayCount(d("2025-12-30"), d("2026-01-02"))).toBe(4);
  });

  it("counts a leap day", () => {
    // 2028 is a leap year — Feb has 29 days.
    expect(inclusiveDayCount(d("2028-02-28"), d("2028-03-01"))).toBe(3);
  });
});

describe("halfDaysFor — THE half-day rule", () => {
  it("a full trip is two half-days per day", () => {
    expect(
      halfDaysFor({
        start: d("2026-08-10"),
        end: d("2026-08-12"),
        firstDayHalf: false,
        lastDayHalf: false,
      })
    ).toBe(6);
  });

  it("subtracts one half-day per travel day marked", () => {
    const claim = { start: d("2026-08-10"), end: d("2026-08-13") }; // 4 days
    expect(halfDaysFor({ ...claim, firstDayHalf: true, lastDayHalf: false })).toBe(7);
    expect(halfDaysFor({ ...claim, firstDayHalf: false, lastDayHalf: true })).toBe(7);
    expect(halfDaysFor({ ...claim, firstDayHalf: true, lastDayHalf: true })).toBe(6);
  });

  it("COLLAPSES the two flags on a one-day claim rather than reaching zero", () => {
    // The single day is both first and last. Subtracting twice would price a
    // real trip at nothing, which is the bug this rule exists to prevent.
    const day = { start: d("2026-08-10"), end: d("2026-08-10") };
    expect(halfDaysFor({ ...day, firstDayHalf: false, lastDayHalf: false })).toBe(2);
    expect(halfDaysFor({ ...day, firstDayHalf: true, lastDayHalf: false })).toBe(1);
    expect(halfDaysFor({ ...day, firstDayHalf: false, lastDayHalf: true })).toBe(1);
    expect(halfDaysFor({ ...day, firstDayHalf: true, lastDayHalf: true })).toBe(1);
  });

  it("refuses an inverted range instead of silently swapping it", () => {
    expect(
      halfDaysFor({
        start: d("2026-08-12"),
        end: d("2026-08-10"),
        firstDayHalf: false,
        lastDayHalf: false,
      })
    ).toBeNull();
  });

  it("never returns zero for any valid range and flag combination", () => {
    for (let span = 0; span < 10; span += 1) {
      for (const first of [true, false]) {
        for (const last of [true, false]) {
          const end = new Date(d("2026-08-10").getTime() + span * 86_400_000);
          const n = halfDaysFor({
            start: d("2026-08-10"),
            end,
            firstDayHalf: first,
            lastDayHalf: last,
          });
          expect(n).not.toBeNull();
          expect(n!).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe("perDiemAmount — integer minor units, half up", () => {
  it("multiplies a whole number of days exactly", () => {
    expect(perDiemAmount(250_000, 6)).toBe(750_000); // 3 days × ₹2,500
    expect(perDiemAmount(250_000, 2)).toBe(250_000); // 1 day
  });

  it("halves cleanly for an even rate", () => {
    expect(perDiemAmount(250_000, 1)).toBe(125_000); // half a day
    expect(perDiemAmount(250_000, 5)).toBe(625_000); // 2.5 days
  });

  it("rounds an odd rate on an odd half-day count HALF UP", () => {
    // 333 × 1 / 2 = 166.5 → 167. In the employee's favour, deterministic,
    // and at most one minor unit.
    expect(perDiemAmount(333, 1)).toBe(167);
    expect(perDiemAmount(333, 3)).toBe(500); // 999/2 = 499.5 → 500
  });

  it("does NOT compound the rounding across days", () => {
    // Rounding a half-day rate first (167) and multiplying by 3 would give
    // 501. Rounding once at the end gives 500. Over a long trip the first
    // approach drifts by rupees, which is why the division happens last.
    expect(perDiemAmount(333, 3)).toBe(500);
    expect(perDiemAmount(333, 3)).not.toBe(167 * 3);
  });

  it("stays exact for an even rate at every half-day count", () => {
    for (let h = 1; h <= 60; h += 1) {
      expect(perDiemAmount(250_000, h)).toBe((250_000 * h) / 2);
    }
  });

  it("rejects nonsense rather than returning a wrong number", () => {
    expect(perDiemAmount(0, 2)).toBeNull();
    expect(perDiemAmount(-100, 2)).toBeNull();
    expect(perDiemAmount(250_000, 0)).toBeNull();
    expect(perDiemAmount(250_000, -2)).toBeNull();
    expect(perDiemAmount(250_000, 1.5)).toBeNull();
    expect(perDiemAmount(Number.MAX_SAFE_INTEGER, 4)).toBeNull();
  });
});

describe("selectEffectiveRate — the rate in force on a date", () => {
  const rates: PerDiemRateRow[] = [
    rate({ id: "r1", name: "Metro", dailyAmount: 200_000, effectiveFrom: d("2025-04-01") }),
    rate({ id: "r2", name: "Metro", dailyAmount: 250_000, effectiveFrom: d("2026-04-01") }),
    rate({ id: "r3", name: "Metro", dailyAmount: 300_000, effectiveFrom: d("2027-04-01") }),
    rate({ id: "r4", name: "Non-metro", dailyAmount: 120_000, effectiveFrom: d("2025-04-01") }),
  ];

  it("takes the newest version at or before the date", () => {
    expect(selectEffectiveRate(rates, "Metro", d("2026-08-10"))?.id).toBe("r2");
    expect(selectEffectiveRate(rates, "Metro", d("2025-12-31"))?.id).toBe("r1");
  });

  it("is inclusive of the effective date itself", () => {
    expect(selectEffectiveRate(rates, "Metro", d("2026-04-01"))?.id).toBe("r2");
    // The day before belongs to the previous version.
    expect(selectEffectiveRate(rates, "Metro", d("2026-03-31"))?.id).toBe("r1");
  });

  it("does NOT reach forward to a future rate", () => {
    // A rate created for next April must not price this August's trip.
    expect(selectEffectiveRate(rates, "Metro", d("2026-08-10"))?.dailyAmount).toBe(250_000);
    expect(selectEffectiveRate(rates, "Metro", d("2024-01-01"))).toBeNull();
  });

  it("keeps names separate", () => {
    expect(selectEffectiveRate(rates, "Non-metro", d("2026-08-10"))?.id).toBe("r4");
    expect(selectEffectiveRate(rates, "Nowhere", d("2026-08-10"))).toBeNull();
  });

  it("ignores retired versions", () => {
    const withRetired = [
      ...rates,
      rate({ id: "r5", name: "Metro", dailyAmount: 999_000, effectiveFrom: d("2026-06-01"), active: false }),
    ];
    // r5 is newer than r2 but retired, so r2 still applies.
    expect(selectEffectiveRate(withRetired, "Metro", d("2026-08-10"))?.id).toBe("r2");
  });
});

describe("currentRateOptions", () => {
  it("lists one entry per name, at the amount in force", () => {
    const rates: PerDiemRateRow[] = [
      rate({ id: "a", name: "Metro", dailyAmount: 200_000, effectiveFrom: d("2025-04-01") }),
      rate({ id: "b", name: "Metro", dailyAmount: 250_000, effectiveFrom: d("2026-04-01") }),
      rate({ id: "c", name: "Non-metro", dailyAmount: 120_000, effectiveFrom: d("2025-04-01") }),
    ];
    const options = currentRateOptions(rates, d("2026-08-10"));
    expect(options).toHaveLength(2);
    expect(options.find((o) => o.name === "Metro")).toMatchObject({
      rateId: "b",
      dailyAmount: 250_000,
    });
  });

  it("omits a name whose only version is not yet in force", () => {
    const rates = [rate({ id: "future", name: "Metro", effectiveFrom: d("2027-01-01") })];
    expect(currentRateOptions(rates, d("2026-08-10"))).toEqual([]);
  });
});

describe("planPerDiem — one function, used by the form AND the action", () => {
  const rates: PerDiemRateRow[] = [
    rate({ id: "old", name: "Metro", dailyAmount: 200_000, effectiveFrom: d("2025-04-01") }),
    rate({ id: "cur", name: "Metro", dailyAmount: 250_000, effectiveFrom: d("2026-04-01") }),
  ];

  it("prices a plain three-day trip", () => {
    const plan = planPerDiem(rates, {
      rateName: "Metro",
      start: d("2026-08-10"),
      end: d("2026-08-12"),
      firstDayHalf: false,
      lastDayHalf: false,
    });
    expect(plan).toMatchObject({
      rateId: "cur",
      dailyAmount: 250_000,
      halfDays: 6,
      days: 3,
      amount: 750_000,
    });
  });

  it("prices travel days at half", () => {
    const plan = planPerDiem(rates, {
      rateName: "Metro",
      start: d("2026-08-10"),
      end: d("2026-08-12"),
      firstDayHalf: true,
      lastDayHalf: true,
    });
    // 3 days − two halves = 2 days.
    expect(plan).toMatchObject({ halfDays: 4, days: 2, amount: 500_000 });
  });

  it("prices the whole claim at the rate in force on the START date", () => {
    // A trip that begins before a rate change keeps the old rate throughout.
    // Splitting mid-claim is a finance decision, not something to infer.
    const plan = planPerDiem(rates, {
      rateName: "Metro",
      start: d("2026-03-30"),
      end: d("2026-04-02"),
      firstDayHalf: false,
      lastDayHalf: false,
    });
    expect(plan).toMatchObject({ rateId: "old", dailyAmount: 200_000, halfDays: 8 });
    if ("error" in plan) throw new Error("expected a plan");
    expect(plan.amount).toBe(800_000); // 4 days × ₹2,000
  });

  it("explains an inverted range instead of pricing it", () => {
    const plan = planPerDiem(rates, {
      rateName: "Metro",
      start: d("2026-08-12"),
      end: d("2026-08-10"),
      firstDayHalf: false,
      lastDayHalf: false,
    });
    expect(plan).toHaveProperty("error");
  });

  it("explains a date with no rate in force", () => {
    const plan = planPerDiem(rates, {
      rateName: "Metro",
      start: d("2024-01-01"),
      end: d("2024-01-02"),
      firstDayHalf: false,
      lastDayHalf: false,
    });
    expect(plan).toHaveProperty("error");
    if (!("error" in plan)) throw new Error("expected an error");
    expect(plan.error).toMatch(/effective date/i);
  });

  it("explains an unknown allowance name", () => {
    const plan = planPerDiem(rates, {
      rateName: "Atlantis",
      start: d("2026-08-10"),
      end: d("2026-08-11"),
      firstDayHalf: false,
      lastDayHalf: false,
    });
    expect(plan).toHaveProperty("error");
  });

  it("never produces a zero-value claim", () => {
    const plan = planPerDiem(rates, {
      rateName: "Metro",
      start: d("2026-08-10"),
      end: d("2026-08-10"),
      firstDayHalf: true,
      lastDayHalf: true,
    });
    if ("error" in plan) throw new Error("expected a plan");
    expect(plan.amount).toBeGreaterThan(0);
    expect(plan.amount).toBe(125_000); // half of ₹2,500
  });
});

describe("presentation helpers", () => {
  it("describes half-day counts the way a person would say them", () => {
    expect(describeDays(1)).toBe("half a day");
    expect(describeDays(2)).toBe("1 day");
    expect(describeDays(3)).toBe("1.5 days");
    expect(describeDays(6)).toBe("3 days");
  });

  it("names the allowance in the merchant field", () => {
    // A per-diem has no vendor, but the list, the ledger and the CSV all show
    // a merchant — so it carries the allowance name rather than a blank.
    expect(perDiemMerchant("Metro")).toBe("Per diem — Metro");
  });
});
