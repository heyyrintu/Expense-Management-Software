// Payment math + bank-detail masking (6.1) — pure, unit-tested in
// tests/unit/reimbursement.test.ts.
import { assertMinorUnits } from "@/lib/money";

export const PAYMENT_METHODS = ["bank_transfer", "upi", "cash", "payroll"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Outstanding balance for a report given its prior payments. */
export function outstandingBalance(
  total: number,
  payments: Array<{ amountPaid: number }>
): number {
  assertMinorUnits(total);
  let paid = 0;
  for (const p of payments) {
    assertMinorUnits(p.amountPaid);
    paid += p.amountPaid;
  }
  return Math.max(0, total - paid);
}

/**
 * Validate a payment amount against the balance and pick the transition.
 * Returns an error string, or the workflow action to apply.
 */
export function planPayment(
  balance: number,
  amountPaid: number
): { error: string } | { action: "reimburse" | "reimburse_partial" } {
  assertMinorUnits(balance);
  assertMinorUnits(amountPaid);
  if (balance <= 0) return { error: "This report is already fully paid." };
  if (amountPaid <= 0) return { error: "Enter a payment amount above zero." };
  if (amountPaid > balance) {
    return { error: "The payment exceeds the outstanding balance." };
  }
  return {
    action: amountPaid === balance ? "reimburse" : "reimburse_partial",
  };
}

/** ****1234 — never show more than the last 4 digits anywhere. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `****${digits.slice(-4)}`;
}
