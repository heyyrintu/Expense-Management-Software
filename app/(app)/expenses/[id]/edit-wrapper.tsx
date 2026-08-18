"use client";

import { updateExpenseAction } from "../actions";
import type { ExpenseInput } from "@/lib/schemas/expense";
import { ExpenseForm, type Option } from "../expense-form";

export function EditExpenseWrapper({
  expenseId,
  defaults,
  categories,
  projects,
  currency,
}: {
  expenseId: string;
  defaults: ExpenseInput;
  categories: Option[];
  projects: Option[];
  currency: string;
}) {
  return (
    <ExpenseForm
      defaults={defaults}
      categories={categories}
      projects={projects}
      currency={currency}
      expenseId={expenseId}
      action={(input) => updateExpenseAction({ id: expenseId, ...input })}
    />
  );
}
