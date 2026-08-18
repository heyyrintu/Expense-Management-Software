// Pure expense rules — unit-tested without a database.
import { parseToMinorUnits } from "@/lib/money";
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
} | null {
  const amount = parseToMinorUnits(input.amount);
  if (amount === null || amount === 0) return null; // zero-amount expenses are meaningless
  return {
    amount,
    date: new Date(`${input.date}T00:00:00.000Z`),
    merchant: input.merchant,
    categoryId: input.categoryId,
    projectId: input.projectId === "" ? null : input.projectId,
    purpose: input.purpose,
  };
}
