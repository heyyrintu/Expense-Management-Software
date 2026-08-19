// Policy flag shape and labels — pure, no React.
//
// Extracted from components/ui/policy-flag-chip.tsx in D3.1, because
// lib/domain/approval-queue.ts needs asFlags to summarise a report's flags
// for the queue, and a domain module importing a client component is both a
// layering inversion and — as the failing test proved — unparseable by the
// unit runner.
//
// The chip renders these; it does not define them.

export type FlagLike = { rule: string; message: string };

/** Short labels for a chip; the full rule text lives in its tooltip. */
const RULE_LABELS: Record<string, string> = {
  per_expense_limit: "Over limit",
  monthly_limit: "Monthly limit",
  receipt_required: "Receipt needed",
  expense_age: "Too old",
  duplicate: "Possible duplicate",
  auto_created: "Auto-created",
  email_ingested: "From email",
};

export function ruleLabel(rule: string): string {
  return RULE_LABELS[rule] ?? rule.replace(/_/g, " ");
}

/** Narrow unknown JSON (Expense.flags is a Json column) to usable flags. */
export function asFlags(value: unknown): FlagLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is FlagLike =>
      typeof f === "object" &&
      f !== null &&
      typeof (f as FlagLike).rule === "string" &&
      typeof (f as FlagLike).message === "string"
  );
}
