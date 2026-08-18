// Policy flags render as amber warning chips with the message as tooltip
// text — they warn, never block (ui-screen skill).
export type FlagLike = { rule: string; message: string };

const RULE_LABELS: Record<string, string> = {
  per_expense_limit: "Over limit",
  monthly_limit: "Monthly limit",
  receipt_required: "Receipt needed",
  expense_age: "Too old",
  duplicate: "Possible duplicate",
};

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

export function FlagChips({ flags }: { flags: FlagLike[] }) {
  if (flags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f, i) => (
        <span
          key={`${f.rule}-${i}`}
          title={f.message}
          aria-label={f.message}
          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
        >
          {RULE_LABELS[f.rule] ?? f.rule}
        </span>
      ))}
    </span>
  );
}
