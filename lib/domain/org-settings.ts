// Typed access to the Organization.settings JSON blob.
export type OrgSettings = {
  /** Reports above this total (minor units) need a second approval. */
  secondApprovalAbove?: number | null;
  /** Flag expenses older than this many days; null disables the rule. */
  expenseAgeLimitDays?: number | null;
  /** Tally export ledger names (7.1). */
  tallyExpenseLedger?: string;
  tallyBankLedger?: string;
};

export function parseOrgSettings(settings: unknown): OrgSettings {
  if (typeof settings !== "object" || settings === null) return {};
  const s = settings as Record<string, unknown>;
  const raw = s.secondApprovalAbove;
  const age = s.expenseAgeLimitDays;
  return {
    secondApprovalAbove:
      typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0
        ? raw
        : null,
    expenseAgeLimitDays:
      typeof age === "number" && Number.isSafeInteger(age) && age > 0 && age <= 3650
        ? age
        : null,
    tallyExpenseLedger:
      typeof s.tallyExpenseLedger === "string" && s.tallyExpenseLedger.trim() !== ""
        ? s.tallyExpenseLedger
        : "Expense Reimbursements",
    tallyBankLedger:
      typeof s.tallyBankLedger === "string" && s.tallyBankLedger.trim() !== ""
        ? s.tallyBankLedger
        : "Bank",
  };
}

export function secondApprovalThreshold(settings: unknown): number | null {
  return parseOrgSettings(settings).secondApprovalAbove ?? null;
}

export function expenseAgeLimitDays(settings: unknown): number | null {
  return parseOrgSettings(settings).expenseAgeLimitDays ?? null;
}
