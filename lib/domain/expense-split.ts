// Split math (PLAN 6.3) — pure, unit-tested in tests/unit/expense-split.test.ts.
// INVARIANT: splits sum EXACTLY to the expense amount in integer minor
// units. Percent mode floors each share and the LAST split absorbs the
// remainder, so no paisa is ever lost or invented.
import { assertMinorUnits, parseToMinorUnits } from "@/lib/money";

export type SplitEntry = {
  categoryId: string;
  projectId: string | null;
  amount: number; // minor units
};

export type SplitInputAmount = {
  categoryId: string;
  projectId: string;
  /** decimal string from the form */
  value: string;
};

/** Amount mode: parse each row; the rows must sum exactly to `total`. */
export function splitsFromAmounts(
  total: number,
  rows: SplitInputAmount[]
): { splits: SplitEntry[] } | { error: string } {
  assertMinorUnits(total);
  if (rows.length < 2) return { error: "A split needs at least two lines." };
  const splits: SplitEntry[] = [];
  let sum = 0;
  for (const row of rows) {
    const amount = parseToMinorUnits(row.value);
    if (amount === null || amount === 0) {
      return { error: "Every split line needs an amount above zero." };
    }
    sum += amount;
    splits.push({
      categoryId: row.categoryId,
      projectId: row.projectId === "" ? null : row.projectId,
      amount,
    });
  }
  if (sum !== total) {
    return {
      error: "Split lines must add up exactly to the expense amount.",
    };
  }
  return { splits };
}

/**
 * Percent mode: integer percents summing to 100. Each share floors;
 * the last line absorbs the remainder.
 */
export function splitsFromPercents(
  total: number,
  rows: Array<{ categoryId: string; projectId: string; percent: number }>
): { splits: SplitEntry[] } | { error: string } {
  assertMinorUnits(total);
  if (rows.length < 2) return { error: "A split needs at least two lines." };
  let pctSum = 0;
  for (const row of rows) {
    if (!Number.isInteger(row.percent) || row.percent <= 0 || row.percent >= 100) {
      return { error: "Each percentage must be a whole number between 1 and 99." };
    }
    pctSum += row.percent;
  }
  if (pctSum !== 100) return { error: "Percentages must add up to 100." };

  const splits: SplitEntry[] = [];
  let allocated = 0;
  rows.forEach((row, i) => {
    const amount =
      i === rows.length - 1
        ? total - allocated // last absorbs the remainder
        : Math.floor((total * row.percent) / 100);
    allocated += amount;
    splits.push({
      categoryId: row.categoryId,
      projectId: row.projectId === "" ? null : row.projectId,
      amount,
    });
  });
  return { splits };
}

/** Defensive re-check used by the actions before persisting. */
export function splitsSumExactly(total: number, splits: SplitEntry[]): boolean {
  assertMinorUnits(total);
  let sum = 0;
  for (const s of splits) {
    assertMinorUnits(s.amount);
    if (s.amount <= 0) return false;
    sum += s.amount;
  }
  return sum === total;
}
