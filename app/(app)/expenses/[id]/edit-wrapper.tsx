"use client";

import { updateExpenseAction } from "../actions";
import type { ExpenseInput } from "@/lib/schemas/expense";
import { ExpenseForm, type OcrSuggestion, type Option } from "../expense-form";

export function EditExpenseWrapper({
  expenseId,
  defaults,
  categories,
  projects,
  currency,
  ocr,
}: {
  expenseId: string;
  defaults: ExpenseInput;
  categories: Option[];
  projects: Option[];
  currency: string;
  ocr?: OcrSuggestion;
}) {
  return (
    <ExpenseForm
      defaults={defaults}
      categories={categories}
      projects={projects}
      currency={currency}
      expenseId={expenseId}
      ocr={ocr}
      action={(input) => updateExpenseAction({ id: expenseId, ...input })}
    />
  );
}
