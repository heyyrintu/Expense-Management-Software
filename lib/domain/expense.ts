// Pure expense rules — unit-tested without a database.
import { assertMinorUnits, parseToMinorUnits } from "@/lib/money";
import type { ExpenseInput } from "@/lib/schemas/expense";

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "reimbursed";

/** Only Draft expenses are editable (PRD 6.2 AC). */
export function isExpenseEditable(status: ExpenseStatus): boolean {
  return status === "draft";
}

/** Only Draft expenses may be hard-deleted (CLAUDE.md: nothing is
 *  hard-deleted once a report leaves Draft). */
export function isExpenseDeletable(status: ExpenseStatus): boolean {
  return status === "draft";
}

/**
 * Convert validated form input into persistable fields (minor units,
 * Date, null-normalized project). Returns null if the amount cannot be
 * represented as integer minor units.
 */
export function toExpenseData(input: ExpenseInput): {
  amount: number;
  date: Date;
  merchant: string;
  categoryId: string;
  projectId: string | null;
  purpose: string;
  billable: boolean;
  clientId: string | null;
  taxAmount: number | null;
  taxNumber: string | null;
} | null {
  const amount = parseToMinorUnits(input.amount);
  if (amount === null || amount === 0) return null; // zero-amount expenses are meaningless
  const taxAmount =
    input.taxAmount === "" ? null : parseToMinorUnits(input.taxAmount);
  if (input.taxAmount !== "" && taxAmount === null) return null;
  if (taxAmount !== null && taxAmount > amount) return null; // tax can't exceed the bill
  return {
    amount,
    date: new Date(`${input.date}T00:00:00.000Z`),
    merchant: input.merchant,
    categoryId: input.categoryId,
    projectId: input.projectId === "" ? null : input.projectId,
    purpose: input.purpose,
    billable: input.billable,
    clientId: input.billable && input.clientId !== "" ? input.clientId : null,
    taxAmount,
    taxNumber: input.taxNumber === "" ? null : input.taxNumber,
  };
}

export const MILEAGE_MERCHANT = "Mileage";

/**
 * distance (whole km) × org rate (minor units per km) — pure integer math.
 * Throws on non-integer/negative inputs; returns null when the result is
 * zero or unsafe (rate not configured, absurd distance).
 */
export function computeMileageAmount(
  distanceKm: number,
  ratePerKmMinor: number
): number | null {
  if (!Number.isSafeInteger(distanceKm) || distanceKm <= 0) return null;
  assertMinorUnits(ratePerKmMinor);
  if (ratePerKmMinor <= 0) return null;
  const amount = distanceKm * ratePerKmMinor;
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Convert validated mileage input + org rate into persistable fields. */
export function toMileageData(
  input: { distanceKm: string; date: string; categoryId: string; projectId: string; purpose: string },
  ratePerKmMinor: number
): {
  type: "mileage";
  amount: number;
  distanceKm: number;
  date: Date;
  merchant: string;
  categoryId: string;
  projectId: string | null;
  purpose: string;
} | null {
  const distanceKm = Number.parseInt(input.distanceKm, 10);
  const amount = computeMileageAmount(distanceKm, ratePerKmMinor);
  if (amount === null) return null;
  return {
    type: "mileage",
    amount,
    distanceKm,
    date: new Date(`${input.date}T00:00:00.000Z`),
    merchant: MILEAGE_MERCHANT,
    categoryId: input.categoryId,
    projectId: input.projectId === "" ? null : input.projectId,
    purpose: input.purpose,
  };
}
