"use client";

import { updateExpenseAction } from "../actions";
import type { ExpenseInput } from "@/lib/schemas/expense";
import { ExpenseForm, type ClientOption, type OcrSuggestion, type Option } from "../expense-form";

export function EditExpenseWrapper({
  expenseId,
  defaults,
  categories,
  projects,
  clients,
  currency,
  ocr,
  receiptCount,
}: {
  expenseId: string;
  defaults: ExpenseInput;
  categories: Option[];
  projects: Option[];
  clients: ClientOption[];
  currency: string;
  ocr?: OcrSuggestion;
  receiptCount?: number;
}) {
  return (
    <ExpenseForm
      defaults={defaults}
      categories={categories}
      projects={projects}
      clients={clients}
      currency={currency}
      expenseId={expenseId}
      ocr={ocr}
      receiptCount={receiptCount}
      action={(input) => updateExpenseAction({ id: expenseId, ...input })}
    />
  );
}
